import { coreApi, sciPath } from '../src/api/core';
import { nlpApi } from '../src/api/nlp';
import { newId } from '../src/sci/ids';

const realFetch = globalThis.fetch;

type Sent = { url: string; method: string; headers: Record<string, string>; body?: string };

// Answers every call with `status` and `body`, and keeps what was sent.
function mockFetch(status: number, body: unknown) {
  const sent: Sent[] = [];
  globalThis.fetch = jest.fn(async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    sent.push({ url, method: init.method, headers: init.headers, body: init.body });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return sent;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('newId', () => {
  it('looks like prefix_ + 26 characters and fits in 64', () => {
    const id = newId('venture');
    expect(id).toMatch(/^venture_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('is different every time', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId('link')));
    expect(ids.size).toBe(500);
  });

  it('sorts newer IDs after older ones', () => {
    expect(newId('batch', 1_000_000) < newId('batch', 2_000_000)).toBe(true);
  });

  it('refuses a prefix that would make the ID too long', () => {
    expect(() => newId('x'.repeat(40))).toThrow();
  });
});

describe('sciPath', () => {
  it('asks for 50 by default', () => {
    expect(sciPath('venture_1')).toBe('/v1/ventures/venture_1/sci?limit=50');
  });

  it('keeps the limit between 1 and 100', () => {
    expect(sciPath('v', { limit: 0 })).toContain('limit=1');
    expect(sciPath('v', { limit: 500 })).toContain('limit=100');
    expect(sciPath('v', { limit: 20.7 })).toContain('limit=20');
  });

  it('passes the cursor back unchanged, only URL-encoded', () => {
    expect(sciPath('v', { cursor: 'a+b/c==' })).toBe('/v1/ventures/v/sci?limit=50&cursor=a%2Bb%2Fc%3D%3D');
  });

  it('leaves the cursor out on the first page', () => {
    expect(sciPath('v', { cursor: null })).not.toContain('cursor');
  });
});

describe('Core calls for businesses and SCI', () => {
  it('creates a business with its own Idempotency-Key', async () => {
    const sent = mockFetch(201, { venture_id: 'venture_1', name: 'Acme', status: 'ACTIVE', geography_codes: [], updated_at: 'x', e_tag: '"1"' });
    const venture = await coreApi.createVenture({ venture_id: 'venture_1', name: 'Acme' });
    expect(sent[0].method).toBe('POST');
    expect(sent[0].url).toMatch(/\/v1\/ventures$/);
    expect(sent[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(venture.etag).toBe('"1"');
  });

  it('reuses the key it is given when retrying', async () => {
    const sent = mockFetch(200, { imported_count: 1, link_ids: ['link_1'] });
    await coreApi.importContacts(
      { contacts: [{ contact_record_id: 'c1', link_id: 'link_1', label: 'Priya', email: 'p@example.com' }], retention_days: 365 },
      { idempotencyKey: 'key-1' }
    );
    expect(sent[0].url).toMatch(/\/v1\/contacts\/imports$/);
    expect(sent[0].headers['Idempotency-Key']).toBe('key-1');
  });

  it('creates an invite batch and keeps the tokens in the answer only', async () => {
    mockFetch(201, { batch_id: 'b1', status: 'APPROVED', invitations: [{ invitation_id: 'i1', link_id: 'l1', token: 'a'.repeat(64), expires_at: 'x' }], e_tag: '"1"' });
    const batch = await coreApi.createInviteBatch({ batch_id: 'b1', link_ids: ['l1'], expires_in_days: 14 });
    expect(batch.invitations[0].token).toHaveLength(64);
  });

  it('accepts an invitation with no body, the token in the path', async () => {
    const sent = mockFetch(200, { invitation_id: 'i1', connection_id: 'c1', conversation_id: 'chat_1', link_id: 'l1' });
    const token = 'ab12'.repeat(16);
    const accepted = await coreApi.acceptInvitation(token);
    expect(sent[0].method).toBe('POST');
    expect(sent[0].url).toMatch(new RegExp(`/v1/invitations/${token}/accept$`));
    expect(sent[0].body).toBeUndefined();
    expect(accepted.conversation_id).toBe('chat_1');
  });

  it('reads one page of the SCI network with GET and no Idempotency-Key', async () => {
    const sent = mockFetch(200, { items: [], next_cursor: null });
    const page = await coreApi.getVentureSci('venture_1', { limit: 20, cursor: 'c=' });
    expect(sent[0].method).toBe('GET');
    expect(sent[0].url).toMatch(/\/v1\/ventures\/venture_1\/sci\?limit=20&cursor=c%3D$/);
    expect(sent[0].headers['Idempotency-Key']).toBeUndefined();
    expect(page.items).toEqual([]);
  });
});

describe('NLP call for a business OFFER and WANT', () => {
  it('always sends the intent_set_id as the Idempotency-Key', async () => {
    const sent = mockFetch(202, {
      intent_set_id: 'intent_set_1',
      venture_id: 'venture_1',
      offer: { intent_id: 'intent_1', status: 'PROCESSING', model_version: '', preprocessing_version: 'v1', contains_pii: false },
      want: { intent_id: 'intent_2', status: 'PROCESSING', model_version: '', preprocessing_version: 'v1', contains_pii: false },
    });
    await nlpApi.submitVentureIntentSet(
      {
        intent_set_id: 'intent_set_1',
        venture_id: 'venture_1',
        offer_intent_id: 'intent_1',
        want_intent_id: 'intent_2',
        offer_text: 'We design packaging.',
        want_text: 'We want brand introductions.',
        expires_at: '2027-02-02T10:30:00Z',
        structured_intent: { competitor: false, qualification_met: true },
      },
      // A caller cannot send a different key.
      { idempotencyKey: 'something-else' }
    );
    expect(sent[0].url).toMatch(/\/v1\/venture-intent-sets$/);
    expect(sent[0].headers['Idempotency-Key']).toBe('intent_set_1');
  });
});
