import { CORE_API_URL } from '../config/env';
import { makeApiClient, RequestOptions, withEtag } from './client';
import type {
  EventAttendeesResponse,
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

const client = makeApiClient(CORE_API_URL, { sendAccessToken: true });

export type CoreEvent = EventSummary & {
};

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

  getEventAttendees: (eventId: string) =>
    client.get<EventAttendeesResponse>(`/v1/events/${encodeURIComponent(eventId)}/attendees`),

  getActiveConsentPolicy: (purposeCode: string) =>
    client.get<ConsentPolicy>(`/v1/consent-policies/${encodeURIComponent(purposeCode)}`),

  recordConsent: (body: ConsentRequest, options?: RequestOptions) =>
    client.post<ConsentResponse>('/v1/me/consents', body, options),

  getMember: async (memberId: string) => {
    return withEtag(await client.send<ProfileBody>('GET', `/v1/members/${encodeURIComponent(memberId)}`));
  },

  getEvents: async (): Promise<CoreEvent[]> => {
    return client.get<EventSummary[]>('/v1/events');
  },
  // Idempotent server-side: registering twice returns the same registration.
  registerForEvent: async (eventId: string, options?: RequestOptions) => {
    return client.post<EventRegistration>(`/v1/events/${eventId}/register`, undefined, options);
  },
  // Starts Live Mode, or extends the same session when already live.
  startLiveMode: async (eventId: string, body: LiveModeRequest, options?: RequestOptions): Promise<LiveModeSession> => {
    return client.post<LiveModeSession>(`/v1/events/${eventId}/live-mode`, body, options);
  },
  // 404 LIVE_MODE_NOT_ACTIVE means already stopped/expired — treat as success.
  stopLiveMode: async (eventId: string, options?: RequestOptions) => {
    return client.del<void>(`/v1/events/${eventId}/live-mode`, options);
  },
  recordPresence: async (eventId: string, body: PresenceRequest, options?: RequestOptions) => {
    return client.post<void>(`/v1/events/${eventId}/presence`, body, options);
  },
};
