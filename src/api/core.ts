import { CORE_API_URL, USE_MOCK_EVENTS, USE_MOCK_LIVE, USE_MOCK_MATCHING } from '../config/env';
import { mockEvents } from '../mocks/events';
import { mockMembers } from '../mocks/matches';
import { makeApiClient, RequestOptions, withEtag } from './client';
import type {
  ConsentPolicy,
  ConsentRequest,
  ConsentResponse,
  EventRegistration,
  EventSummary,
  LiveModeRequest,
  LiveModeSession,
  MemberLookupBody,
  MemberLookupRequest,
  PresenceRequest,
  ProfileBody,
  RegisterMemberBody,
  RegisterMemberRequest,
  UpdateProfileRequest,
} from './types';

const client = makeApiClient(CORE_API_URL);

export type CoreEvent = EventSummary & {
  // Client-side convenience field for mock/demo data — how many attendees
  // match the member's intent. Not part of Olga.Core's response (that comes
  // from olga-nlp-api match requests instead).
  match_count?: number;
};

// Calls with a mock branch follow their area's switch in src/config/env.ts.
export const coreApi = {
  // Once, right after Entra OTP succeeds. X-Member-Id isn't set yet.
  registerMember: async (body: RegisterMemberRequest, options?: RequestOptions) =>
    withEtag(await client.send<RegisterMemberBody>('POST', '/v1/members', body, options)),

  // Existing member for a verified email (reinstall / new device / 409
  // recovery). No X-Member-Id. 404 MEMBER_NOT_REGISTERED = new user.
  lookupMember: async (email: string, options?: RequestOptions) =>
    withEtag(
      await client.send<MemberLookupBody>('POST', '/v1/members/lookup', { email } satisfies MemberLookupRequest, options)
    ),

  getMyProfile: async (options?: RequestOptions) =>
    withEtag(await client.send<ProfileBody>('GET', '/v1/me/profile', undefined, options)),

  // Full replace: send every field. ifMatch is the etag from the last
  // register/read/update, quotes included (e.g. "\"1\"").
  updateMyProfile: async (body: UpdateProfileRequest, ifMatch: string, options?: RequestOptions) =>
    withEtag(
      await client.send<ProfileBody>('PATCH', '/v1/me/profile', body, {
        ...options,
        headers: { ...options?.headers, 'If-Match': ifMatch },
      })
    ),

  getActiveConsentPolicy: (purposeCode: string) =>
    client.get<ConsentPolicy>(`/v1/consent-policies/${encodeURIComponent(purposeCode)}`),

  recordConsent: (body: ConsentRequest, options?: RequestOptions) =>
    client.post<ConsentResponse>('/v1/me/consents', body, options),

  getMember: async (memberId: string) => {
    if (USE_MOCK_MATCHING) return mockMembers[memberId];
    return withEtag(await client.send<ProfileBody>('GET', `/v1/members/${encodeURIComponent(memberId)}`));
  },

  getEvents: async (): Promise<CoreEvent[]> => {
    if (USE_MOCK_EVENTS) return mockEvents;
    return client.get<EventSummary[]>('/v1/events');
  },
  // Idempotent server-side: registering twice returns the same registration.
  registerForEvent: async (eventId: string, options?: RequestOptions) => {
    if (USE_MOCK_EVENTS) return;
    return client.post<EventRegistration>(`/v1/events/${eventId}/register`, undefined, options);
  },
  // Starts Live Mode, or extends the same session when already live.
  startLiveMode: async (eventId: string, body: LiveModeRequest, options?: RequestOptions): Promise<LiveModeSession> => {
    if (USE_MOCK_LIVE) {
      const minutes = body.duration_minutes ?? 60;
      return {
        session_id: 'mock-session',
        event_id: eventId,
        status: 'ACTIVE',
        active_until: new Date(Date.now() + minutes * 60000).toISOString(),
      };
    }
    return client.post<LiveModeSession>(`/v1/events/${eventId}/live-mode`, body, options);
  },
  // 404 LIVE_MODE_NOT_ACTIVE means already stopped/expired — treat as success.
  stopLiveMode: async (eventId: string, options?: RequestOptions) => {
    if (USE_MOCK_LIVE) return;
    return client.del<void>(`/v1/events/${eventId}/live-mode`, options);
  },
  recordPresence: async (eventId: string, body: PresenceRequest, options?: RequestOptions) => {
    if (USE_MOCK_LIVE) return;
    return client.post<void>(`/v1/events/${eventId}/presence`, body, options);
  },
};
