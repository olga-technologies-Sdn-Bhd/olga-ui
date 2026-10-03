import { NLP_API_URL, NLP_TIMEOUT_MS, USE_MOCK_MATCHING } from '../config/env';
import { mockMatches } from '../mocks/matches';
import { getMemberId, makeApiClient, RequestOptions, withEtag } from './client';
import type {
  IntentBody,
  IntentType,
  MatchRequest,
  MatchRequestResponse,
  MatchRequestStatusResponse,
  MatchResult,
  UpsertIntentBody,
  UpsertIntentRequest,
  UpsertIntentResponse,
} from './types';

const client = makeApiClient(NLP_API_URL);

export type MatchCandidate = MatchResult;

// Deterministic intent ID per member/event/type, so re-posting updates the
// same intent instead of creating a new one. Hashed because olga-nlp-api
// stores intent_id as varchar(64) and member + event IDs alone exceed that.
export function intentIdFor(eventId: string, type: IntentType, memberId = getMemberId() ?? '') {
  return `int_${hash128(`${memberId}
${eventId}
${type}`)}`; // 36 chars
}

// cyrb128: fast non-cryptographic 128-bit string hash, as 32 hex chars.
/* eslint-disable no-bitwise */
function hash128(str: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}
/* eslint-enable no-bitwise */

// Longer timeout for every NLP call (cold starts), unless the caller sets one.
const nlp = (options?: RequestOptions): RequestOptions => ({ timeoutMs: NLP_TIMEOUT_MS, ...options });

// While USE_MOCK_MATCHING is true (src/config/env.ts) these return canned data
// from src/mocks/ instead of calling olga-nlp-api.
export const nlpApi = {
  // 200 = processed; 202 = still processing, poll getIntent until MATCH_READY.
  // ifMatch: etag from a previous save, for edits.
  createIntent: async (body: UpsertIntentRequest, ifMatch?: string, options?: RequestOptions): Promise<UpsertIntentResponse> => {
    if (USE_MOCK_MATCHING) {
      return {
        intent_id: body.intent_id,
        status: 'MATCH_READY',
        model_version: 'mock',
        preprocessing_version: 'mock',
        contains_pii: false,
        etag: '"mock"',
      };
    }
    return withEtag(
      await client.send<UpsertIntentBody>(
        'POST',
        '/v1/intents',
        body,
        nlp({ ...options, headers: { ...options?.headers, ...(ifMatch ? { 'If-Match': ifMatch } : {}) } })
      )
    );
  },
  getIntent: async (intentId: string) =>
    withEtag(await client.send<IntentBody>('GET', `/v1/intents/${encodeURIComponent(intentId)}`, undefined, nlp())),

  // Leave request_id out: the server uses the Idempotency-Key. status other
  // than COMPLETED → poll getMatchRequest(request_id) every 1–2 s.
  requestMatches: async (body: MatchRequest, options?: RequestOptions): Promise<MatchRequestResponse> => {
    if (USE_MOCK_MATCHING) {
      return {
        request_id: 'mock-request',
        matches: mockMatches,
        model_version: 'mock',
        preprocessing_version: 'mock',
        ranking_version: 'mock',
        status: 'COMPLETED',
      };
    }
    return client.post<MatchRequestResponse>('/v1/match-requests', body, nlp(options));
  },
  getMatchRequest: (requestId: string) =>
    client.get<MatchRequestStatusResponse>(`/v1/match-requests/${encodeURIComponent(requestId)}`, nlp()),
};
