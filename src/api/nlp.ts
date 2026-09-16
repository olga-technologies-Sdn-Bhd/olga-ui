import { NLP_API_URL, USE_MOCK_DATA } from '../config/env';
import { mockMatches } from '../mocks/matches';
import { makeApiClient } from './client';

const client = makeApiClient(NLP_API_URL);

export type MatchCandidate = {
  memberId: string;
  headline?: string;
  subheadline?: string;
  matchScore: number;
  rationale?: string;
};

// TODO(backend): confirm exact request/response shapes for /v1/match-requests
// against the dev environment before wiring this up for real.
//
// While USE_MOCK_DATA is true (src/config/env.ts), requestMatches returns
// canned data from src/mocks/ instead of hitting the network — remove the
// `if (USE_MOCK_DATA)` branch (and the mocks import) once the real endpoint
// is wired up and verified.
export const nlpApi = {
  createIntent: async (body: unknown) => {
    if (USE_MOCK_DATA) return;
    return client.post('/v1/intents', body);
  },
  requestMatches: async (body: unknown): Promise<{ matches: MatchCandidate[] }> => {
    if (USE_MOCK_DATA) return { matches: mockMatches };
    return client.post('/v1/match-requests', body);
  },
};
