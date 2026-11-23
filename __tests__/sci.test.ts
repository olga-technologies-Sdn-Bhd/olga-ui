import { coreApi, pagedPath } from '../src/api/core';
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

describe('pagedPath', () => {
  it('asks for 50 by default', () => {
    expect(pagedPath('/v1/sci/contacts')).toBe('/v1/sci/contacts?limit=50');
  });

  it('keeps the limit between 1 and 100', () => {
    expect(pagedPath('/x', { limit: 0 })).toContain('limit=1');
    expect(pagedPath('/x', { limit: 500 })).toContain('limit=100');
    expect(pagedPath('/x', { limit: 20.7 })).toContain('limit=20');
  });

  it('passes the cursor back unchanged, only URL-encoded', () => {
    expect(pagedPath('/x', { cursor: 'a+b/c==' })).toBe('/x?limit=50&cursor=a%2Bb%2Fc%3D%3D');
  });

  it('leaves the cursor out on the first page', () => {
    expect(pagedPath('/x', { cursor: null })).not.toContain('cursor');
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
      { contacts: [{ contact_record_id: 'c1', link_id: 'link_1', label: 'Priya', email: 'p@example.com' }] },
      { idempotencyKey: 'key-1' }
    );
    // Retention is the backend's policy: the app never sends it.
    expect(sent[0].body).not.toContain('retention_days');
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

  it('reads one page of SCI contacts with GET and no Idempotency-Key', async () => {
    const sent = mockFetch(200, { items: [], next_cursor: null });
    const page = await coreApi.getSciContacts({ limit: 20, cursor: 'c=' });
    expect(sent[0].method).toBe('GET');
    expect(sent[0].url).toMatch(/\/v1\/sci\/contacts\?limit=20&cursor=c%3D$/);
    expect(sent[0].headers['Idempotency-Key']).toBeUndefined();
    expect(page.items).toEqual([]);
  });

  it('reads the SCI summary and the first three reach-out items', async () => {
    const sent = mockFetch(200, { sci_count: 1742, projection_status: 'READY' });
    const summary = await coreApi.getSciSummary();
    expect(sent[0].url).toMatch(/\/v1\/sci\/summary$/);
    expect(summary.sci_count).toBe(1742);
    const sent2 = mockFetch(200, { items: [], next_cursor: null });
    await coreApi.getSciReachOut({ limit: 3 });
    expect(sent2[0].url).toMatch(/\/v1\/sci\/reach-out\?limit=3$/);
  });

  it('creates an outcome and decides on it, each with its own key', async () => {
    const sent = mockFetch(201, { outcome_id: 'o1', points: 0, confirmation_count: 0, e_tag: '"1"' });
    await coreApi.createRelationshipOutcome({ outcome_id: 'o1', contact_member_id: 'm1', outcome_type: 'MEETING', occurred_at: '2026-11-22T09:00:00Z' });
    await coreApi.decideRelationshipOutcome('o1', 'CONFIRM');
    expect(sent[0].url).toMatch(/\/v1\/relationship-outcomes$/);
    expect(sent[1].url).toMatch(/\/v1\/relationship-outcomes\/o1\/decisions$/);
    expect(JSON.parse(sent[1].body!)).toEqual({ decision: 'CONFIRM' });
    expect(sent[0].headers['Idempotency-Key']).not.toBe(sent[1].headers['Idempotency-Key']);
  });

  it('writes the discovery preference with the ETag in If-Match', async () => {
    const sent = mockFetch(200, { find_by_phone: true, find_by_email: false, e_tag: '"2"', updated_at: 'x' });
    await coreApi.updateDiscoveryPreference({ find_by_phone: true, find_by_email: false }, '"1"');
    expect(sent[0].method).toBe('PUT');
    expect(sent[0].headers['If-Match']).toBe('"1"');
    expect(sent[0].headers['Idempotency-Key']).toBeTruthy();
  });

  it('updates a notification preference with PATCH', async () => {
    const sent = mockFetch(200, { purpose_code: 'p', push_enabled: true, email_enabled: false, updated_at: 'x', e_tag: '"1"' });
    await coreApi.updateNotificationPreference({ purpose_code: 'p', push_enabled: true, email_enabled: false, timezone_id: 'Asia/Kuala_Lumpur' });
    expect(sent[0].method).toBe('PATCH');
    expect(sent[0].url).toMatch(/\/v1\/me\/notification-preferences$/);
  });
});

describe('NLP calls for the primary intent', () => {
  it('previews without an Idempotency-Key', async () => {
    const sent = mockFetch(200, { canonical_tags: ['malaysia'], tag_fingerprint: 'f', previewed_at: 'x', preview_text: 'You offer: ...' });
    const preview = await nlpApi.previewPrimaryIntent({ offer_text: 'o', want_text: 'w', tags: ['Malaysia'] });
    expect(sent[0].url).toMatch(/\/v1\/primary-intents\/preview$/);
    expect(preview.canonical_tags).toEqual(['malaysia']);
  });

  it('reads the history with the cursor unchanged', async () => {
    const sent = mockFetch(200, { items: [], next_cursor: null });
    await nlpApi.getPrimaryIntentHistory({ cursor: 'a+b=' });
    expect(sent[0].url).toMatch(/\/v1\/primary-intents\/history\?limit=50&cursor=a%2Bb%3D$/);
  });
});

describe('NLP call for a business OFFER and WANT', () => {
  it('always sends the intent_set_id as the Idempotency-Key', async () => {
    const sent = mockFetch(202, { intent_set_id: 'intent_set_1', venture_id: 'venture_1', projection_status: 'RECALCULATING' });
    await nlpApi.submitVentureIntentSet(
      {
        intent_set_id: 'intent_set_1',
        venture_id: 'venture_1',
        offer_intent_id: 'intent_1',
        want_intent_id: 'intent_2',
        offer_text: 'We design packaging.',
        want_text: 'We want brand introductions.',
        expires_at: '2027-02-02T10:30:00Z',
        structured_intent: { tags: ['malaysia'] },
        tags: ['malaysia'],
        tag_fingerprint: 'f',
        previewed_at: '2026-11-22T10:00:00Z',
      },
      // A caller cannot send a different key.
      { idempotencyKey: 'something-else' }
    );
    expect(sent[0].url).toMatch(/\/v1\/venture-intent-sets$/);
    expect(sent[0].headers['Idempotency-Key']).toBe('intent_set_1');
  });
});
