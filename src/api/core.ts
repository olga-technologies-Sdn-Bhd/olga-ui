import { CORE_API_URL } from '../config/env';
import { imageHeaders, makeApiClient, RequestOptions, withEtag } from './client';
import { cached } from './offlineCache';
import type {
  AcceptCommitResponse,
  AcceptInvitationResponse,
  CreateInviteBatchRequest,
  CreateVentureRequest,
  ImportContactsRequest,
  ImportContactsResponse,
  InviteBatchBody,
  InviteBatchDetail,
  ImportedContactPage,
  OpenedInvitation,
  PendingInvitation,
  ResendInvitationResponse,
  SciSummary,
  SciPage,
  VentureBody,
  MemberReportRequest,
  MemberReportResponse,
  BlockedMember,
  CommitQuota,
  Connection,
  IncomingCommit,
  MeetingPage,
  MeetingSpot,
  OutgoingCommit,
  SendCommitRequest,
  SendCommitResponse,
  SyncPage,
  ChatMessage,
  Conversation,
  ConversationPage,
  Device,
  DeviceRegistrationRequest,
  MessageReceiptRequest,
  EventAttendeesResponse,
  MessageReportRequest,
  MessageReportResponse,
  SendMessageRequest,
  ConsentPolicy,
  ConsentRequest,
  ConnectionRequestCreate,
  ConnectionRequestResponse,
  ConsentResponse,
  EventRegistration,
  EventSummary,
  LiveModeRequest,
  LiveModeSession,
  MemberLookupBody,
  MemberLookupRequest,
  MemberPhoneLookupRequest,
  PhoneVerificationCheckRequest,
  PhoneVerificationCheckResponse,
  PhoneVerificationRequest,
  PhoneVerificationResponse,
  PresenceRequest,
  PrivacyRequestCreate,
  PrivacyRequestResponse,
  ProfileBody,
  ProfileImageUploadResponse,
  RegisterMemberBody,
  RegisterMemberRequest,
  UpdateProfileRequest,
} from './types';

const conversationPath = (conversationId: string) => `/v1/conversations/${encodeURIComponent(conversationId)}`;
const messagePath = (messageId: string) => `/v1/messages/${encodeURIComponent(messageId)}`;

const client = makeApiClient(CORE_API_URL, { sendAccessToken: true });

export type CoreEvent = EventSummary & {
};

// A picture chosen on the phone, as React Native's FormData wants it.
export type PictureFile = { uri: string; name: string; type: string };

// thumbnail 64, small 256, large 512 px (WebP, square).
export type PictureSize = 'thumbnail' | 'small' | 'large';

// Where a member's picture is loaded from, and the headers it needs (Core
// serves it only to signed-in members). The URL stays the same when a picture
// is replaced, so `version` (the profile etag) keeps an old copy from showing.
export function memberPictureSource(memberId: string, size: PictureSize, version?: string | null) {
  const v = version ? `&v=${encodeURIComponent(version)}` : '';
  return {
    uri: `${CORE_API_URL}/v1/members/${encodeURIComponent(memberId)}/profile-picture?size=${size}${v}`,
    headers: imageHeaders(),
  };
}

// The SCI list is read a page at a time. limit is 1-100 (default 50); the
// cursor is Core's own and goes back exactly as it came, only URL-encoded.
export const SCI_PAGE_SIZE = 50;

export function sciPath(ventureId: string, params: { limit?: number; cursor?: string | null } = {}) {
  const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? SCI_PAGE_SIZE)));
  const cursor = params.cursor ? `&cursor=${encodeURIComponent(params.cursor)}` : '';
  return `/v1/ventures/${encodeURIComponent(ventureId)}/sci?limit=${limit}${cursor}`;
}

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

  // Phone OTP. Core talks to Twilio; the app never does. Each distinct send or
  // check is its own logical action (new Idempotency-Key); reuse the key only
  // to retry that exact request.
  sendPhoneCode: (phone: string, options?: RequestOptions) =>
    client.post<PhoneVerificationResponse>(
      '/v1/auth/phone/verifications',
      { phone, channel: 'sms' } satisfies PhoneVerificationRequest,
      options
    ),

  checkPhoneCode: (phone: string, code: string, options?: RequestOptions) =>
    client.post<PhoneVerificationCheckResponse>(
      '/v1/auth/phone/verification-checks',
      { phone, code } satisfies PhoneVerificationCheckRequest,
      options
    ),

  // Existing member for a verified phone. No X-Member-Id. 404
  // MEMBER_NOT_REGISTERED = new user.
  lookupMemberByPhone: async (phone: string, verificationToken: string, options?: RequestOptions) =>
    withEtag(
      await client.send<MemberLookupBody>(
        'POST',
        '/v1/members/lookup/phone',
        { phone, verification_token: verificationToken } satisfies MemberPhoneLookupRequest,
        options
      )
    ),

  // Businesses and the Social Capital Index. Every write is its own logical
  // action (new Idempotency-Key); reuse the key only to retry that exact
  // request. Contact details and invitation tokens are never logged.
  createVenture: async (body: CreateVentureRequest, options?: RequestOptions) =>
    withEtag(await client.send<VentureBody>('POST', '/v1/ventures', body, options)),

  // The member's businesses (to bring one back after a reinstall) and one by
  // ID. The list's shape isn't in the guide: read it with businessesFrom().
  listVentures: (options?: RequestOptions) => client.get<unknown>('/v1/ventures', options),

  getVenture: async (ventureId: string, options?: RequestOptions) =>
    withEtag(await client.send<VentureBody>('GET', `/v1/ventures/${encodeURIComponent(ventureId)}`, undefined, options)),

  importContacts: (body: ImportContactsRequest, options?: RequestOptions) =>
    client.post<ImportContactsResponse>('/v1/contacts/imports', body, options),

  createInviteBatch: async (body: CreateInviteBatchRequest, options?: RequestOptions) =>
    withEtag(await client.send<InviteBatchBody>('POST', '/v1/invite-batches', body, options)),

  // The token is exactly 64 hex characters; it travels in the path, so the
  // client must never log request URLs.
  acceptInvitation: (token: string, options?: RequestOptions) =>
    client.post<AcceptInvitationResponse>(`/v1/invitations/${encodeURIComponent(token)}/accept`, undefined, options),

  getVentureSci: (ventureId: string, params?: { limit?: number; cursor?: string | null }, options?: RequestOptions) =>
    client.get<SciPage>(sciPath(ventureId, params), options),

  // All businesses at once, for the Home card.
  getSciSummary: (options?: RequestOptions) => client.get<SciSummary>('/v1/sci/summary', options),

  // Imported people with their latest invitation (limit 1-100).
  listImportedContacts: (cursor?: string | null, limit = 100) =>
    client.get<ImportedContactPage>(`/v1/contacts?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),

  getInviteBatch: (batchId: string) => client.get<InviteBatchDetail>(`/v1/invite-batches/${encodeURIComponent(batchId)}`),

  // A new token: share a new link. Pass the same idempotencyKey when retrying.
  resendInvitation: (invitationId: string, expiresInDays: number, options?: RequestOptions) =>
    client.post<ResendInvitationResponse>(
      `/v1/invitations/${encodeURIComponent(invitationId)}/resend`,
      { expires_in_days: expiresInDays },
      options,
    ),

  // Read-only by contract: no Idempotency-Key. The token is in the path, so
  // the URL must never be logged.
  openInvitation: (token: string) =>
    client.post<OpenedInvitation>(`/v1/invitations/${encodeURIComponent(token)}/open`, undefined, { idempotencyKey: null }),

  // Invitations waiting for me (no link needed), and accepting one of them:
  // the same answer as accepting by link.
  listPendingInvitations: () => client.get<PendingInvitation[]>('/v1/me/invitations'),
  acceptPendingInvitation: (invitationId: string, options?: RequestOptions) =>
    client.post<AcceptInvitationResponse>(`/v1/me/invitations/${encodeURIComponent(invitationId)}/accept`, undefined, options),

  // Reads marked cached() are kept on the phone (encrypted) and answered from
  // there when there's no network: see offlineCache.ts.
  getMyProfile: (options?: RequestOptions) =>
    cached('profile', async () => withEtag(await client.send<ProfileBody>('GET', '/v1/me/profile', undefined, options))),

  // Full replace: send every field. ifMatch is the etag from the last
  // register/read/update, quotes included (e.g. "\"1\"").
  updateMyProfile: async (body: UpdateProfileRequest, ifMatch: string, options?: RequestOptions) =>
    withEtag(
      await client.send<ProfileBody>('PATCH', '/v1/me/profile', body, {
        ...options,
        headers: { ...options?.headers, 'If-Match': ifMatch },
      })
    ),

  // Upload or replace. 202: the picture is checked and resized by a worker, so
  // read the profile until profile_image_status is READY or REJECTED. ifMatch
  // is the profile etag; reuse the same idempotencyKey only to retry this same
  // file.
  uploadProfilePicture: async (file: PictureFile, ifMatch: string, options?: RequestOptions) => {
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    const r = await client.send<ProfileImageUploadResponse>('PUT', '/v1/me/profile-picture', form, {
      ...options,
      headers: { ...options?.headers, 'If-Match': ifMatch },
    });
    return { ...r.data, etag: r.data.etag ?? r.headers.get('ETag') ?? '' };
  },

  // 200 with the updated profile. Idempotent.
  deleteProfilePicture: async (ifMatch: string, options?: RequestOptions) =>
    withEtag(
      await client.send<ProfileBody>('DELETE', '/v1/me/profile-picture', undefined, {
        ...options,
        headers: { ...options?.headers, 'If-Match': ifMatch },
      })
    ),

  getEventAttendees: (eventId: string) =>
    cached('attendees', () => client.get<EventAttendeesResponse>(`/v1/events/${encodeURIComponent(eventId)}/attendees`), eventId),

  getActiveConsentPolicy: (purposeCode: string) =>
    client.get<ConsentPolicy>(`/v1/consent-policies/${encodeURIComponent(purposeCode)}`),

  recordConsent: (body: ConsentRequest, options?: RequestOptions) =>
    client.post<ConsentResponse>('/v1/me/consents', body, options),

  getMember: async (memberId: string) => {
    return withEtag(await client.send<ProfileBody>('GET', `/v1/members/${encodeURIComponent(memberId)}`));
  },

  getEvents: (): Promise<CoreEvent[]> => cached('events', () => client.get<EventSummary[]>('/v1/events')),
  // Idempotent server-side: registering twice returns the same registration.
  registerForEvent: async (eventId: string, options?: RequestOptions) => {
    return client.post<EventRegistration>(`/v1/events/${eventId}/register`, undefined, options);
  },
  // Starts Live Mode, or extends the same session when already live.
  startLiveMode: async (eventId: string, body: LiveModeRequest, options?: RequestOptions): Promise<LiveModeSession> => {
    return client.post<LiveModeSession>(`/v1/events/${eventId}/live-mode`, body, options);
  },
  // GOL-02: more time on the same session (same matches, no new search),
  // never past the event's end. 409 LIVE_MODE_NOT_ACTIVE once it has ended.
  extendLiveMode: async (eventId: string, durationMinutes: number, options?: RequestOptions): Promise<LiveModeSession> => {
    return client.post<LiveModeSession>(`/v1/events/${eventId}/live-mode/extend`, { duration_minutes: durationMinutes }, options);
  },
  // 404 LIVE_MODE_NOT_ACTIVE means already stopped/expired — treat as success.
  stopLiveMode: async (eventId: string, options?: RequestOptions) => {
    return client.del<void>(`/v1/events/${eventId}/live-mode`, options);
  },
  recordPresence: async (eventId: string, body: PresenceRequest, options?: RequestOptions) => {
    return client.post<void>(`/v1/events/${eventId}/presence`, body, options);
  },

  // Commits (Docs/Core Commit API (for mobile).md).
  sendCommit: (body: SendCommitRequest, options?: RequestOptions) =>
    client.post<SendCommitResponse>('/v1/connection-requests', body, options),
  getCommitQuota: (eventId: string) =>
    client.get<CommitQuota>(`/v1/events/${encodeURIComponent(eventId)}/commits/quota`),
  getMeetingSpots: (eventId: string) =>
    client.get<MeetingSpot[]>(`/v1/events/${encodeURIComponent(eventId)}/meeting-spots`),
  getIncomingCommits: () => cached('commits-in', () => client.get<IncomingCommit[]>('/v1/me/commits/incoming')),
  getOutgoingCommits: () => cached('commits-out', () => client.get<OutgoingCommit[]>('/v1/me/commits/outgoing')),
  acceptCommit: (requestId: string, options?: RequestOptions) =>
    client.patch<AcceptCommitResponse>(`/v1/connection-requests/${encodeURIComponent(requestId)}`, { decision: 'ACCEPT' }, options),
  // SAF-01 by request ID: the sender of a Commit sent to me stays anonymous.
  // Report: 201 (never names them), 409 REPORT_ALREADY_OPEN. Block: 204, also
  // when already blocked; a pending Commit is declined silently. Both 404
  // COMMIT_NOT_FOUND for anyone but the recipient.
  reportCommitSender: (requestId: string, body: Pick<MemberReportRequest, 'category' | 'description'>) =>
    client.post<MemberReportResponse>(`/v1/me/commits/incoming/${encodeURIComponent(requestId)}/report`, body),
  blockCommitSender: (requestId: string) => client.post<void>(`/v1/me/commits/incoming/${encodeURIComponent(requestId)}/block`),
  // 204, nothing changes for the sender.
  declineCommit: (requestId: string, options?: RequestOptions) =>
    client.patch<void>(`/v1/connection-requests/${encodeURIComponent(requestId)}`, { decision: 'DECLINE' }, options),
  // Accepted Commits become conversations; meetings read their plan and names.
  // Confirmed relationships (an accepted Commit creates one).
  getConnections: () => cached('connections', () => client.get<Connection[]>('/v1/connections')),
  // Straight from Ol-ga, never the saved copy: for checks that must know it answered.
  getConnectionsFresh: () => client.get<Connection[]>('/v1/connections'),
  getMeetings: () => cached('meetings', () => client.get<MeetingPage>('/v1/conversations?limit=50')),

  // Nearby: a plain connection request (no event). A pending request between
  // the same two members is returned rather than duplicated.
  sendConnectionRequest: (body: ConnectionRequestCreate, options?: RequestOptions) =>
    client.post<ConnectionRequestResponse>('/v1/connection-requests', body, options),
  // This member's change feed (requests sent to them, new connections).
  getChanges: (cursor?: string) =>
    client.get<SyncPage>(`/v1/sync/changes?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),

  // Chat. Writes take an Idempotency-Key per action; pass the same one when
  // retrying that action.
  // The first page is kept on the phone for when there's no network.
  listConversations: (cursor?: string, limit = 20) => {
    const load = () =>
      client.get<ConversationPage>(`/v1/conversations?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    return cursor ? load() : cached('conversations', load, `limit-${limit}`);
  },
  getConversation: (conversationId: string) => client.get<Conversation>(conversationPath(conversationId)),
  // Ascending server_sequence; there is no "before", so history pages forward.
  listMessages: (conversationId: string, after: number, limit: number) =>
    client.get<ChatMessage[]>(`${conversationPath(conversationId)}/messages?after=${after}&limit=${limit}`),
  sendMessage: (conversationId: string, body: SendMessageRequest, options?: RequestOptions) =>
    client.post<ChatMessage>(`${conversationPath(conversationId)}/messages`, body, options),
  // Marks the other member's messages up to and including this one as read.
  markConversationRead: (conversationId: string, lastReadMessageId: string) =>
    client.post<Conversation>(`${conversationPath(conversationId)}/read`, { last_read_message_id: lastReadMessageId }),
  // Tells the sender their message reached this phone (delivered ticks).
  saveReceipt: (messageId: string, body: MessageReceiptRequest, options?: RequestOptions) =>
    client.put<void>(`${messagePath(messageId)}/receipt`, body, options),
  // null unmutes.
  muteConversation: (conversationId: string, mutedUntil: string | null) =>
    client.put<Conversation>(`${conversationPath(conversationId)}/mute`, { muted_until: mutedUntil }),
  // Sender only; soft delete (the message stays, without a body).
  deleteMessage: (messageId: string, options?: RequestOptions) => client.del<void>(messagePath(messageId), options),
  reportMessage: (messageId: string, body: MessageReportRequest) =>
    client.post<MessageReportResponse>(`${messagePath(messageId)}/report`, body),
  // "I'm typing" (202), at most every 3 s. No Idempotency-Key, by contract.
  sendTyping: (conversationId: string) =>
    client.post<void>(`${conversationPath(conversationId)}/typing`, undefined, { idempotencyKey: null, timeoutMs: 10000 }),
  blockMember: (memberId: string) => client.post<void>('/v1/members/block', { member_id: memberId }),
  reportMember: (memberId: string, body: MemberReportRequest) =>
    client.post<MemberReportResponse>(`/v1/members/${encodeURIComponent(memberId)}/report`, body),
  listBlockedMembers: () => client.get<BlockedMember[]>('/v1/me/blocks'),
  // 404 BLOCK_NOT_FOUND: not blocked (any more).
  unblockMember: (memberId: string) => client.del<void>(`/v1/members/block/${encodeURIComponent(memberId)}`),

  // Where this member's chat events come from (Azure SignalR) and a
  // short-lived token for it. The member is X-Member-Id, as everywhere.
  negotiateChatRealtime: () =>
    client.post<{ url: string; accessToken: string }>('/v1/realtime/chat/negotiate?negotiateVersion=1'),
  // This phone, registered on sign-in and removed on sign-out.
  registerDevice: (deviceId: string, body: DeviceRegistrationRequest) =>
    client.put<Device>(`/v1/me/devices/${encodeURIComponent(deviceId)}`, body),
  removeDevice: (deviceId: string, options?: RequestOptions) =>
    client.del<void>(`/v1/me/devices/${encodeURIComponent(deviceId)}`, options),

  // Files a request to delete this member's account (202). Pass the same
  // idempotencyKey when retrying the same request.
  requestAccountDeletion: (options: RequestOptions) =>
    client.post<PrivacyRequestResponse>('/v1/me/privacy-requests', { request_type: 'DELETE' } satisfies PrivacyRequestCreate, options),
};
