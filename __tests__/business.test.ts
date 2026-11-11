import { ApiError, NETWORK_ERROR, TIMEOUT } from '../src/api/client';
import { BUSINESS_NAME_MAX, businessProblem, cleanBusinessName } from '../src/sci/business';

describe('cleanBusinessName', () => {
  it('trims the name and squeezes extra spaces', () => {
    expect(cleanBusinessName('  Acme   Circular  Packaging ')).toBe('Acme Circular Packaging');
  });

  it('refuses an empty name', () => {
    expect(cleanBusinessName('')).toBeNull();
    expect(cleanBusinessName('   ')).toBeNull();
  });

  it('allows 250 characters and no more', () => {
    expect(cleanBusinessName('a'.repeat(BUSINESS_NAME_MAX))).toHaveLength(BUSINESS_NAME_MAX);
    expect(cleanBusinessName('a'.repeat(BUSINESS_NAME_MAX + 1))).toBeNull();
  });
});

describe('businessProblem', () => {
  it('asks to check the name when Core says the request is invalid', () => {
    expect(businessProblem(new ApiError(400, 'VENTURE_INVALID', 'x')).message).toBe('Please check the name and try again.');
  });

  it('makes a new ID when the venture_id is taken', () => {
    expect(businessProblem(new ApiError(409, 'VENTURE_ID_CONFLICT', 'x')).newId).toBe(true);
    expect(businessProblem(new ApiError(400, 'VENTURE_INVALID', 'x')).newId).toBe(false);
  });

  it('says to wait when rate limited', () => {
    expect(businessProblem(new ApiError(429, 'HTTP_429', 'x')).message).toMatch(/wait/);
  });

  it('says it could not reach Ol-ga when there is no answer or the service is down', () => {
    for (const e of [new ApiError(0, NETWORK_ERROR, 'x'), new ApiError(0, TIMEOUT, 'x'), new ApiError(503, 'HTTP_503', 'x')]) {
      expect(businessProblem(e).message).toMatch(/reach Ol-ga/);
    }
  });

  it('never repeats the server message', () => {
    const problem = businessProblem(new ApiError(500, 'SOMETHING', 'secret server detail'));
    expect(problem.message).not.toMatch(/secret/);
  });

  it('copes with a plain error', () => {
    expect(businessProblem(new Error('boom')).message).toBe('Something went wrong. Please try again.');
  });
});
