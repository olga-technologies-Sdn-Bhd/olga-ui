import { ApiError, NETWORK_ERROR } from '../src/api/client';
import {
  maskPhone,
  normalizePhone,
  PhoneProofExpiredError,
  phoneProblem,
  proofFrom,
  proofIsFresh,
  withPhoneRetries,
} from '../src/auth/phone';

describe('normalizePhone', () => {
  it.each([
    ['+60 12-345 6789', '+60123456789'],
    ['+60 (12) 345.6789', '+60123456789'],
    ['+1 415 555 0100', '+14155550100'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['0123456789', '60123456789', '+0123456789', '+6012', '+601234567890123456', 'abc', ''])(
    'rejects %j (no country code or not E.164)',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    }
  );
});

describe('maskPhone', () => {
  it('shows only the last four digits', () => {
    expect(maskPhone('+60123456789')).toBe('•••• 6789');
    expect(maskPhone('+60123456789')).not.toContain('12345');
  });
});

describe('proof', () => {
  const response = { verification_token: 'tok', expires_at: '2026-10-29T12:10:00Z' };
  const expires = Date.parse(response.expires_at);

  it('takes the expiry from the response', () => {
    expect(proofFrom('+60123456789', response)).toEqual({ phone: '+60123456789', token: 'tok', expiresAt: expires });
  });

  it('falls back to 300 s when the expiry is unreadable', () => {
    expect(proofFrom('+60123456789', { ...response, expires_at: 'nonsense' }, 1000).expiresAt).toBe(301000);
  });

  it('is fresh until a few seconds before it expires', () => {
    const proof = proofFrom('+60123456789', response);
    expect(proofIsFresh(proof, expires - 60000)).toBe(true);
    expect(proofIsFresh(proof, expires - 5000)).toBe(false);
    expect(proofIsFresh(proof, expires + 1)).toBe(false);
    expect(proofIsFresh(null)).toBe(false);
    expect(proofIsFresh(undefined)).toBe(false);
  });
});

describe('phoneProblem', () => {
  const err = (status: number, code: string) => new ApiError(status, code, 'x');

  it('wrong code stays on the code screen', () => {
    expect(phoneProblem(err(400, 'PHONE_VERIFICATION_CODE_INVALID'))).toEqual({
      message: "That code didn't work. Check it, or resend a new one.",
      restart: false,
    });
  });

  it('bad number asks for the country code', () => {
    const problem = phoneProblem(err(400, 'MEMBER_PHONE_INVALID'));
    expect(problem.restart).toBe(false);
    expect(problem.message).toContain('country code');
  });

  it.each([
    ['403 PHONE_VERIFICATION_INVALID', err(403, 'PHONE_VERIFICATION_INVALID')],
    ['403 PHONE_VERIFICATION_REQUIRED', err(403, 'PHONE_VERIFICATION_REQUIRED')],
    ['missing/expired proof', new PhoneProofExpiredError()],
  ])('%s -> verify the number again', (_label, error) => {
    expect(phoneProblem(error).restart).toBe(true);
  });

  it('429 respects Retry-After', () => {
    const limited = err(429, 'PHONE_VERIFICATION_RATE_LIMITED');
    limited.retryAfterSeconds = 45;
    expect(phoneProblem(limited)).toEqual({ message: 'Too many tries. Please wait 45 seconds and try again.', restart: false });
  });

  it('429 without Retry-After is still neutral', () => {
    const problem = phoneProblem(err(429, 'PHONE_VERIFICATION_RATE_LIMITED'));
    expect(problem.message).toBe('Too many tries. Please wait a little and try again.');
  });

  it.each([
    ['offline', err(0, NETWORK_ERROR)],
    ['503', err(503, 'PHONE_VERIFICATION_UNAVAILABLE')],
  ])('%s -> connection message, nothing lost', (_label, error) => {
    expect(phoneProblem(error)).toEqual({ message: "Couldn't reach Ol-ga. Check your connection and try again.", restart: false });
  });

  it('never repeats the server message', () => {
    const odd = new ApiError(400, 'SOMETHING_ELSE', 'secret detail +60123456789');
    expect(phoneProblem(odd).message).not.toContain('60123456789');
  });
});

describe('withPhoneRetries', () => {
  const inProgress = new ApiError(409, 'PHONE_VERIFICATION_IN_PROGRESS', 'busy');

  it('retries 409 IN_PROGRESS with the same call', async () => {
    const call = jest.fn().mockRejectedValueOnce(inProgress).mockResolvedValueOnce('ok');
    await expect(withPhoneRetries(call, 0)).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('gives up after a couple of tries', async () => {
    const call = jest.fn().mockRejectedValue(inProgress);
    await expect(withPhoneRetries(call, 0)).rejects.toBe(inProgress);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['wrong code', new ApiError(400, 'PHONE_VERIFICATION_CODE_INVALID', 'x')],
    ['key reused', new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'x')],
    ['rate limited', new ApiError(429, 'PHONE_VERIFICATION_RATE_LIMITED', 'x')],
    ['not registered', new ApiError(404, 'MEMBER_NOT_REGISTERED', 'x')],
  ])('never retries a permanent error (%s)', async (_label, error) => {
    const call = jest.fn().mockRejectedValue(error);
    await expect(withPhoneRetries(call, 0)).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries a lost connection with the same call', async () => {
    const call = jest.fn().mockRejectedValueOnce(new ApiError(0, NETWORK_ERROR, 'x')).mockResolvedValueOnce('ok');
    await expect(withPhoneRetries(call, 0)).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(2);
  });
});
