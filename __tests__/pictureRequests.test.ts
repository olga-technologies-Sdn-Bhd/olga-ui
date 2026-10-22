import { makeApiClient, setAccessTokenProvider, setMemberIdProvider, imageHeaders } from '../src/api/client';
import { memberPictureSource } from '../src/api/core';

const okResponse = () => ({
  ok: true,
  status: 202,
  headers: new Headers({ ETag: '"4"' }),
  text: async () => JSON.stringify({ image_id: 'img_1', status: 'PENDING', etag: '"4"' }),
});

describe('picture requests', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends a photo as multipart without setting the content type by hand', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const form = new FormData();
    form.append('file', { uri: 'file:///a.jpg', name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
    await makeApiClient('http://core.test').send('PUT', '/v1/me/profile-picture', form, {
      idempotencyKey: 'key-1',
      headers: { 'If-Match': '"3"' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://core.test/v1/me/profile-picture');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['Idempotency-Key']).toBe('key-1');
    expect(init.headers['If-Match']).toBe('"3"');
  });

  it('still sends other bodies as JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await makeApiClient('http://core.test').send('PATCH', '/v1/me/profile', { display_name: 'A' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"display_name":"A"}');
  });

  it('asks Core for a member picture with the same member and token headers as other calls', () => {
    setMemberIdProvider(() => 'mem_me');
    setAccessTokenProvider(() => 'tok');
    expect(imageHeaders()).toEqual({ 'X-Member-Id': 'mem_me', Authorization: 'Bearer tok' });

    const source = memberPictureSource('mem 1', 'small', '"5"');
    expect(source.uri).toMatch(/\/v1\/members\/mem%201\/profile-picture\?size=small&v=%225%22$/);
    expect(source.headers).toEqual({ 'X-Member-Id': 'mem_me', Authorization: 'Bearer tok' });
    expect(memberPictureSource('m1', 'thumbnail').uri).toMatch(/size=thumbnail$/);
  });
});
