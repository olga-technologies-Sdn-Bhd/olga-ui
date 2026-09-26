import { NLP_API_URL, USE_MOCK_DATA } from '../config/env';
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
} from './types';

const client = makeApiClient(NLP_API_URL);

export type MatchCandidate = MatchResult;

// Deterministic intent ID per member/event/type, so re-posting updates the
// same intent instead of creating a new one.
export function intentIdFor(eventId: string, type: IntentType, memberId = getMemberId() ?? '') {
  return `${memberId}-${eventId}-${type.toLowerCase()}`;
}

// While USE_MOCK_DATA is true (src/config/env.ts), requestMatches returns
// canned data from src/mocks/ instead of hitting the network — remove the
// `if (USE_MOCK_DATA)` branches (and the mocks import) once the real
// endpoints are wired up and verified.
export const nlpApi = {
  // 200 = processed; 202 = still processing, poll getIntent until MATCH_READY.
  // ifMatch: etag from a previous save, for edits.
  createIntent: async (body: UpsertIntentRequest, ifMatch?: string, options?: RequestOptions) => {
    if (USE_MOCK_DATA) return;
    return withEtag(
      await client.send<UpsertIntentBody>('POST', '/v1/intents', body, {
        ...options,
        headers: { ...options?.headers, ...(ifMatch ? { 'If-Match': ifMatch } : {}) },
      })
    );
  },
  getIntent: async (intentId: string) =>
    withEtag(await client.send<IntentBody>('GET', `/v1/intents/${encodeURIComponent(intentId)}`)),

  // Leave request_id out: the server uses the Idempotency-Key. status other
  // than COMPLETED → poll getMatchRequest(request_id) every 1–2 s.
  requestMatches: async (body: MatchRequest, options?: RequestOptions): Promise<MatchRequestResponse> => {
    if (USE_MOCK_DATA) {
      return {
        request_id: 'mock-request',
        matches: mockMatches,
        model_version: 'mock',
        preprocessing_version: 'mock',
        ranking_version: 'mock',
        status: 'COMPLETED',
      };
    }
    return client.post<MatchRequestResponse>('/v1/match-requests', body, options);
  },
  getMatchRequest: (requestId: string) =>
    client.get<MatchRequestStatusResponse>(`/v1/match-requests/${encodeURIComponent(requestId)}`),
};
