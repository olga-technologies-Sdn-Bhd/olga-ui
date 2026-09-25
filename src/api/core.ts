import { CORE_API_URL, USE_MOCK_DATA } from '../config/env';
import { mockEvents } from '../mocks/events';
import { mockMembers } from '../mocks/matches';
import { makeApiClient, RequestOptions } from './client';
import type {
  ConsentRequest,
  ConsentResponse,
  EventRegistration,
  EventSummary,
  LiveModeRequest,
  LiveModeSession,
  PresenceRequest,
  Profile,
  RegisterMemberRequest,
  RegisterMemberResponse,
  UpdateProfileRequest,
} from './types';

const client = makeApiClient(CORE_API_URL);

export type CoreEvent = EventSummary & {
  // Client-side convenience field for mock/demo data — how many attendees
  // match the member's intent. Not part of Olga.Core's response (that comes
  // from olga-nlp-api match requests instead).
  match_count?: number;
};

// Prefer the body's etag; fall back to the ETag response header.
function withEtag<T extends { etag?: string }>(r: { data: T; headers: Headers }): T {
  return { ...r.data, etag: r.data.etag ?? r.headers.get('ETag') ?? undefined } as T;
}

// While USE_MOCK_DATA is true (src/config/env.ts), the calls that already
// have a mock branch return canned data from src/mocks/ instead of hitting the
// network — remove each `if (USE_MOCK_DATA)` branch (and the mocks import)
// once the real endpoints are wired up and verified.
export const coreApi = {
  // Once, right after Entra OTP succeeds. X-Member-Id isn't set yet.
  registerMember: async (body: RegisterMemberRequest, options?: RequestOptions) =>
    withEtag(await client.send<RegisterMemberResponse>('POST', '/v1/members', body, options)),

  getMyProfile: async (options?: RequestOptions) =>
    withEtag(await client.send<Profile>('GET', '/v1/me/profile', undefined, options)),

  // Full replace: send every field. ifMatch is the etag from the last
  // register/read/update, quotes included (e.g. "\"1\"").
  updateMyProfile: async (body: UpdateProfileRequest, ifMatch: string, options?: RequestOptions) =>
    withEtag(
      await client.send<Profile>('PATCH', '/v1/me/profile', body, {
        ...options,
        headers: { ...options?.headers, 'If-Match': ifMatch },
      })
    ),

  recordConsent: (body: ConsentRequest, options?: RequestOptions) =>
    client.post<ConsentResponse>('/v1/me/consents', body, options),

  getMember: async (memberId: string) => {
    if (USE_MOCK_DATA) return mockMembers[memberId];
    return client.get<Profile>(`/v1/members/${encodeURIComponent(memberId)}`);
  },

  getEvents: async (): Promise<CoreEvent[]> => {
    if (USE_MOCK_DATA) return mockEvents;
    return client.get<EventSummary[]>('/v1/events');
  },
  registerForEvent: async (eventId: string, options?: RequestOptions) => {
    if (USE_MOCK_DATA) return;
    return client.post<EventRegistration>(`/v1/events/${eventId}/register`, undefined, options);
  },
  startLiveMode: async (eventId: string, body: LiveModeRequest, options?: RequestOptions) => {
    if (USE_MOCK_DATA) return;
    return client.post<LiveModeSession>(`/v1/events/${eventId}/live-mode`, body, options);
  },
  // 404 LIVE_MODE_NOT_ACTIVE means already stopped/expired — treat as success.
  stopLiveMode: async (eventId: string, options?: RequestOptions) => {
    if (USE_MOCK_DATA) return;
    return client.del<void>(`/v1/events/${eventId}/live-mode`, options);
  },
  recordPresence: async (eventId: string, body: PresenceRequest, options?: RequestOptions) => {
    if (USE_MOCK_DATA) return;
    return client.post<void>(`/v1/events/${eventId}/presence`, body, options);
  },
};
