import { ApiError, isTransient, NETWORK_ERROR, TIMEOUT, withRetries } from '../src/api/client';

const timeout = () => new ApiError(0, TIMEOUT, 'Request timed out');

describe('withRetries', () => {
  it('answers on the first try without waiting', async () => {
    const call = jest.fn().mockResolvedValue('ok');
    await expect(withRetries(call, [100, 200], 0)).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith(100);
  });

  it('keeps asking while the server wakes up, with growing timeouts', async () => {
    const call = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(new ApiError(503, 'HTTP_503', 'starting'))
      .mockResolvedValue('ok');
    await expect(withRetries(call, [100, 200, 300], 0)).resolves.toBe('ok');
    expect(call.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 300]);
  });

  it('stops at once on a real answer (e.g. new user 404)', async () => {
    const notRegistered = new ApiError(404, 'MEMBER_NOT_REGISTERED', 'not found');
    const call = jest.fn().mockRejectedValue(notRegistered);
    await expect(withRetries(call, [100, 200, 300], 0)).rejects.toBe(notRegistered);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt with the last error', async () => {
    const offline = new ApiError(0, NETWORK_ERROR, 'Network request failed');
    const call = jest.fn().mockRejectedValue(offline);
    await expect(withRetries(call, [100, 200], 0)).rejects.toBe(offline);
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe('isTransient', () => {
  it.each([
    [new ApiError(0, TIMEOUT, ''), true],
    [new ApiError(0, NETWORK_ERROR, ''), true],
    [new ApiError(502, 'HTTP_502', ''), true],
    [new ApiError(504, 'HTTP_504', ''), true],
    [new ApiError(500, 'INTERNAL_ERROR', ''), false],
    [new ApiError(409, 'MEMBER_IDENTITY_ALREADY_REGISTERED', ''), false],
    [new Error('other'), false],
  ])('%s -> %s', (error, expected) => {
    expect(isTransient(error)).toBe(expected);
  });
});
