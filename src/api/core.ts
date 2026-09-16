import { CORE_API_URL, USE_MOCK_DATA } from '../config/env';
import { mockEvents } from '../mocks/events';
import { makeApiClient } from './client';

const client = makeApiClient(CORE_API_URL);

export type CoreEvent = {
  eventId: string;
  name: string;
  venue?: string;
  startsAt?: string;
  attendeeCount?: number;
  liveCount?: number;
  // Client-side convenience field for mock/demo data — how many attendees
  // match the member's intent. Not part of Olga.Core's actual response
  // shape (that comes from olga-nlp-api match requests instead).
  matchCount?: number;
};

// TODO(backend): confirm exact response shapes once /v1/events and
// /v1/events/{id} are exercised against the dev environment — Olga.Core's
// Program.cs defines the routes but this app hasn't verified payload shape yet.
//
// While USE_MOCK_DATA is true (src/config/env.ts), every call below returns
// canned data from src/mocks/ instead of hitting the network — remove the
// `if (USE_MOCK_DATA)` branch from each function (and the mocks import) once
// the real endpoints are wired up and verified.
export const coreApi = {
  getEvents: async () => {
    if (USE_MOCK_DATA) return mockEvents;
    return client.get<CoreEvent[]>('/v1/events');
  },
  registerForEvent: async (eventId: string) => {
    if (USE_MOCK_DATA) return;
    return client.post(`/v1/events/${eventId}/register`);
  },
  startLiveMode: async (eventId: string, body: unknown) => {
    if (USE_MOCK_DATA) return;
    return client.post(`/v1/events/${eventId}/live-mode`, body);
  },
  stopLiveMode: async (eventId: string) => {
    if (USE_MOCK_DATA) return;
    return client.del(`/v1/events/${eventId}/live-mode`);
  },
  recordPresence: async (eventId: string, body: unknown) => {
    if (USE_MOCK_DATA) return;
    return client.post(`/v1/events/${eventId}/presence`, body);
  },
};
