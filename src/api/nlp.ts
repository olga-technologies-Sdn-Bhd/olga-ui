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
// same intent instead of creating a new one.
export function intentIdFor(eventId: string, type: IntentType, memberId = getMemberId() ?? '') {
  return `${memberId}-${eventId}-${type.toLowerCase()}`;
}

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
