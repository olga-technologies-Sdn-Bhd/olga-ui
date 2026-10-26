// Wire models for the Phase 1 endpoints, snake_case exactly as sent/received.
// Source of truth: Docs/Phase 1 API Handoff.md (checked against Olga.Core and
// olga-nlp-api Contracts.cs). Nullable fields are optional because Core omits
// nulls from responses. Timestamps are ISO-8601 strings.

// ---- Shared ----

export type ApiErrorBody = {
  code: string;
  message: string;
  correlation_id: string;
  field_errors?: Record<string, string[]>;
  // Extra facts for some codes, e.g. 409 MEMBER_DELETION_PENDING: { due_at }.
  details?: Record<string, unknown>;
};

// Core/NLP serialize `ETag` as `e_tag` in bodies (also sent as the ETag
// header). Wire types below carry `e_tag`; withEtag() in client.ts turns them
// into the app-facing shape with a single normalized `etag`.
export type WithEtag<T extends { e_tag?: string }> = Omit<T, 'e_tag'> & { etag: string };

export type Visibility = 'PUBLIC' | 'MEMBERS' | 'CONNECTED' | 'HIDDEN';
export type ProfileStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'HIDDEN';

// ---- Core: members & profile ----

// POST /v1/members (no X-Member-Id). At least one of email / phone (E.164).
export type RegisterMemberRequest = {
  display_name: string;
  email?: string;
  phone?: string;
  headline?: string;
  professional_summary?: string;
  role_category?: string;
  locale?: string;
  visibility?: Visibility;
};

export type RegisterMemberBody = {
  member_id: string;
  email_hint?: string;
  phone_hint?: string;
  profile_status: ProfileStatus;
  e_tag?: string;
};
export type RegisterMemberResponse = WithEtag<RegisterMemberBody>;

// POST /v1/members/lookup (no X-Member-Id). Email identities only.
export type MemberLookupRequest = {
  email: string;
};

export type MemberLookupBody = {
  member_id: string;
  display_name: string;
  profile_status: ProfileStatus;
  e_tag?: string;
};
export type MemberLookupResponse = WithEtag<MemberLookupBody>;

// GET /v1/me/profile, PATCH /v1/me/profile, GET /v1/members/{memberId}.
// Email and phone are never returned.
export type ProfileBody = {
  member_id: string;
  // GET /v1/members/{id} only sends it for yourself or a connected member:
  // names stay hidden until a Commit is accepted.
  display_name?: string;
  headline?: string;
  professional_summary?: string;
  role_category?: string;
  profile_status: ProfileStatus;
  visibility: Visibility;
  completeness_score: number;
  e_tag?: string;
  updated_at: string;
  // /v1/me/profile only: the member's own masked contact details. Omitted
  // when the member has no value; the full values are never returned.
  email_hint?: string;
  phone_hint?: string;
  // A relative Core URL (never a blob URL), e.g.
  // /v1/members/mem_123/profile-picture?size=thumbnail. Null/absent: no picture.
  profile_image_url?: string | null;
  profile_image_status?: ProfileImageStatus | null;
};
export type Profile = WithEtag<ProfileBody>;

// Pictures are processed by a worker after the upload: PENDING / PROCESSING
// until READY, or REJECTED (the previous picture then stays).
export type ProfileImageStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETED';

// PUT /v1/me/profile-picture -> 202. `etag` is the new profile version.
export type ProfileImageUploadResponse = {
  image_id: string;
  status: ProfileImageStatus;
  etag: string;
};

// PATCH /v1/me/profile is a full replace: omitted optional fields are cleared.
export type UpdateProfileRequest = {
  display_name: string;
  headline?: string;
  professional_summary?: string;
  role_category?: string;
  visibility?: Visibility;
};

// ---- Core: consents ----

export type ConsentDecision = 'GRANTED' | 'DENIED' | 'WITHDRAWN';

export type ConsentRequest = {
  purpose_code: 'LIVE_MODE' | 'MATCHING' | (string & {});
  policy_version: string;
  decision: ConsentDecision;
  capture_channel?: string; // server default "MOBILE"
  evidence?: Record<string, unknown>;
};

// GET /v1/events/{eventId}/attendees: blinded (no name, email or phone).
// 403 EVENT_REGISTRATION_REQUIRED until the caller registers.
export type EventAttendee = { member_id: string; headline?: string; role_category?: string };
export type EventAttendeesResponse = { attendees: EventAttendee[]; total: number };

// GET /v1/consent-policies/{purposeCode}: the active version to send in
// POST /v1/me/consents. 404 CONSENT_POLICY_NOT_ACTIVE when none is active.
export type ConsentPolicy = {
  policy_id?: string;
  purpose_code: string;
  version: string;
  locale?: string;
  content_hash?: string;
  effective_from: string;
  // The caller's latest decision for this policy (with X-Member-Id); absent
  // when they've never answered.
  current_decision?: ConsentDecision | (string & {});
  decision_captured_at?: string;
};

export type ConsentResponse = {
  member_consent_id: number;
  policy_id: string;
  purpose_code: string;
  policy_version: string;
  decision: ConsentDecision;
  captured_at: string;
  withdrawn_at?: string;
};

// ---- Core: events, registration, live mode, presence ----

// GET /v1/events — PUBLISHED only, soonest first. No single-event endpoint.
// venue / attendee_count / live_count may be missing if dev is behind develop.
export type EventSummary = {
  event_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  live_mode_enabled: boolean;
  venue?: string;
  // Admin-entered; optional until the backend ships them.
  description?: string;
  venue_id?: string;
  attendee_count?: number;
  live_count?: number;
  // Only sent when X-Member-Id is present: true for a REGISTERED or
  // CHECKED_IN registration (the same rule that allows Go Live).
  is_registered?: boolean;
  // When true, matching only includes members whose registration_status is
  // CHECKED_IN (event staff check them in). Registration and Live Mode
  // aren't blocked. registration_status is only sent with X-Member-Id.
  check_in_required?: boolean;
  registration_status?: 'REGISTERED' | 'CHECKED_IN' | (string & {});
};

export type EventRegistration = {
  event_id: string;
  member_id: string;
  status: string;
  registered_at: string;
  checked_in_at?: string;
};

export type LiveModeRequest = {
  duration_minutes?: number; // 5–240, server default 60
};

export type LiveModeSession = {
  session_id: string;
  event_id: string;
  status: 'ACTIVE' | (string & {});
  active_until: string;
};

export type PresenceSource = 'FOREGROUND_GEO' | 'CHECK_IN' | 'VENUE_ZONE';

// Never send raw GPS — coarse_cell is a zone ID (≤32 chars).
export type PresenceRequest = {
  coarse_cell: string;
  observed_at: string; // within ±10 min of server time
  source?: PresenceSource;
};

// ---- NLP: intents ----

export type IntentType = 'WANT' | 'OFFER';

// GET /v1/events/{eventId}/live-match-count: how many live members clear the
// threshold for the member's own WANT intent. Private, never cached.
export type LiveMatchCountResponse = {
  event_id: string;
  intent_id: string;
  threshold: number;
  require_reciprocal: boolean;
  count: number;
  candidates_evaluated: number;
  candidate_limit_reached: boolean;
  model_version?: string;
};

export type IntentStatus = 'MATCH_READY' | 'FAILED' | (string & {});

export type UpsertIntentRequest = {
  intent_id: string; // client-chosen and stable, e.g. <member_id>-<event_id>-want
  context_id: string; // event_id
  intent_type: IntentType;
  text: string;
  expires_at: string; // required, future (use the event's ends_at)
  category?: string;
  industry?: string;
  geography?: string;
  language?: string;
};

// POST /v1/intents: 200 when processed, 202 while still processing.
export type UpsertIntentBody = {
  intent_id: string;
  status: IntentStatus;
  model_version: string;
  preprocessing_version: string;
  normalized_hash?: string;
  language?: string;
  contains_pii: boolean;
  updated_at?: string;
  e_tag?: string;
};
export type UpsertIntentResponse = WithEtag<UpsertIntentBody>;

// GET /v1/intents/{intentId}
export type IntentBody = {
  intent_id: string;
  context_id: string;
  intent_type: IntentType;
  original_text: string;
  normalized_text: string;
  normalized_hash: string;
  language: string;
  contains_pii: boolean;
  status: IntentStatus;
  expires_at: string;
  preprocessing_version: string;
  model_version?: string;
  category?: string;
  industry?: string;
  geography?: string;
  created_at: string;
  updated_at: string;
  e_tag?: string;
};
export type Intent = WithEtag<IntentBody>;

// ---- NLP: match requests ----

export type MatchRequestStatus = 'COMPLETED' | 'FAILED' | (string & {});

export type MatchRequest = {
  // Must equal the Idempotency-Key, or be omitted (recommended).
  request_id?: string;
  intent_id: string; // the member's WANT intent for context_id
  context_id: string;
  limit?: number; // 3–7, default 7
  options?: {
    threshold?: number; // 0.0–1.0
    language?: string;
    require_reciprocal?: boolean;
  };
};

export type MatchLabel = 'STRONG_MATCH' | 'PLAUSIBLE_MATCH';

export type MatchResult = {
  member_id: string;
  score: number; // 0.0–1.0
  label: MatchLabel;
  reason_codes: string[];
  reason_text: string;
  match_result_id?: number;
  rank?: number;
  semantic_score?: number;
  reciprocal_score?: number;
};

// POST /v1/match-requests: 200 when done, 202 while processing (poll GET).
export type MatchRequestResponse = {
  request_id: string;
  matches: MatchResult[];
  model_version: string;
  preprocessing_version: string;
  ranking_version: string;
  status: MatchRequestStatus;
  applied_threshold?: number;
  candidate_count?: number;
  completed_at?: string;
};

// GET /v1/match-requests/{requestId}
export type MatchRequestStatusResponse = {
  request_id: string;
  status: MatchRequestStatus;
  matches: MatchResult[];
  model_version?: string;
  preprocessing_version?: string;
  ranking_version?: string;
  applied_threshold?: number;
  candidate_count?: number;
  created_at: string;
  completed_at?: string;
  error_code?: string;
};

// ---- Core: Commits (Docs/Core Commit API (for mobile).md) ----
// A Commit is a connection request scoped to an event (context_id), with a
// plan: a short meeting in this room. Names stay hidden until Accept.

export type CommitWhen = 'NOW' | 'IN_10_MIN' | 'NEXT_BREAK' | 'AFTER_SESSION';

export type CommitWhereRequest = { type: 'THEIR_CHOICE' } | { type: 'SPOT'; spot_id: string };

export type SendCommitRequest = {
  recipient_member_id: string;
  context_id: string; // event_id
  match_result_id?: number;
  plan: { where: CommitWhereRequest; when: CommitWhen };
  note?: string;
};

export type SendCommitResponse = {
  request_id: string;
  sender_member_id: string;
  recipient_member_id: string;
  status: 'PENDING';
  expires_at: string;
  commits_remaining: number;
};

export type CommitQuota = { limit: number; used: number; remaining: number };

export type MeetingSpot = { spot_id: string; label: string };

// "THEIR_CHOICE" or a spot label.
export type CommitPlan = { where: string; when: CommitWhen; event_id: string };

export type IncomingCommit = {
  request_id: string;
  event: { event_id: string; name: string };
  plan: CommitPlan;
  // Never a name, photo, contact or member ID before Accept.
  sender: { headline?: string; role_category?: string; score?: number };
  expires_at: string;
  created_at: string;
};

// A declined Commit stays PENDING for the sender until it expires.
export type OutgoingCommitStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export type OutgoingCommit = {
  request_id: string;
  event: { event_id: string; name: string };
  plan: CommitPlan;
  recipient: { headline?: string; role_category?: string; display_name?: string }; // name only once ACCEPTED
  status: OutgoingCommitStatus;
  expires_at: string;
  created_at: string;
  conversation_id?: string; // only once ACCEPTED
};

// PATCH /v1/connection-requests/{id} ACCEPT -> 200 (DECLINE -> 204, no body).
export type AcceptCommitResponse = {
  connection_id: string;
  member_id: string;
  status: 'ACTIVE';
  conversation_id: string;
  display_name?: string;
};

// POST /v1/connection-requests with no context_id: a plain connection request
// (Nearby). Accepting it creates the connection and conversation, as a Commit does.
export type ConnectionRequestCreate = { recipient_member_id: string; note?: string; expires_in_days?: number };
export type ConnectionRequestResponse = {
  request_id: string;
  sender_member_id: string;
  recipient_member_id: string;
  status: string;
  expires_at: string;
};

// POST /v1/me/privacy-requests. A DELETE request takes the member out of
// Ol-ga at once (Core ends Live Mode and hides them from matches, events and
// Commits); the data is erased within 30 days. A second open one is 409
// PRIVACY_REQUEST_ALREADY_OPEN.
export type PrivacyRequestType = 'DELETE';
export type PrivacyRequestCreate = { request_type: PrivacyRequestType };
export type PrivacyRequestResponse = {
  privacy_request_id: string;
  request_type: PrivacyRequestType;
  status: string;
  created_at: string;
  due_at: string;
};

// GET /v1/sync/changes: what changed for this member, oldest first.
export type SyncItem = {
  sequence: number;
  resource_type: string; // CONNECTION_REQUEST, CONNECTION, ...
  resource_id: string;
  change_type: string; // UPSERT | DELETE
  payload?: Record<string, unknown> | null;
  occurred_at: string;
};
export type SyncPage = { items: SyncItem[]; next_cursor?: string | null; has_more: boolean };

// GET /v1/connections: the member's confirmed relationships.
export type Connection = {
  connection_id: string;
  member_id: string;
  status: string; // ACTIVE
  conversation_id: string;
  display_name?: string;
};

// GET /v1/conversations: only what meetings need (the chat itself isn't
// Phase 1). Null fields are omitted.
export type Meeting = {
  conversation_id: string;
  member_id: string;
  display_name?: string;
  headline?: string;
  role_category?: string;
  plan?: CommitPlan;
  last_activity_at: string;
};

export type MeetingPage = { items: Meeting[]; next_cursor?: string; has_more: boolean };

// Chat (dev Core). Null fields are omitted from the JSON, hence optional.
export type ConversationStatus = 'ACTIVE' | 'CLOSED' | 'RESTRICTED';

export type ChatMessage = {
  message_id: string;
  conversation_id: string;
  sender_member_id: string;
  message_type: string;
  body?: string; // absent once deleted
  server_sequence: number;
  moderation_status: string;
  created_at: string;
  deleted_at?: string; // soft delete: render a placeholder
  // FILE messages: the photo, PDF or voice note (null once deleted).
  attachment?: ChatAttachment | null;
};

// media_type comes from the file's bytes on the server, not its name.
export type ChatAttachment = {
  file_asset_id: string;
  media_type: string;
  size_bytes: number;
  file_name: string;
};

export type Conversation = {
  conversation_id: string;
  connection_id: string;
  status: ConversationStatus;
  member_id: string; // the other member
  display_name?: string;
  headline?: string;
  role_category?: string;
  last_message?: ChatMessage;
  unread_count: number;
  last_activity_at: string;
  can_send: boolean;
  muted_until?: string; // only present while a mute is active
  // The highest server_sequence of my messages the other member has received /
  // read: mine at or below count as delivered / seen. Absent until the first receipt.
  other_delivered_through_sequence?: number;
  other_read_through_sequence?: number;
};

// PUT /v1/messages/{id}/receipt: at least one of the two.
export type MessageReceiptRequest = { delivered_at?: string; read_at?: string };

// PUT /v1/me/devices/{deviceId}: this app installation. push_provider and
// push_token go together (none until push is set up).
export type DeviceRegistrationRequest = {
  platform: 'ANDROID' | 'IOS';
  app_version: string;
  push_provider?: 'FCM' | 'APNS';
  push_token?: string;
};

export type Device = {
  device_id: string;
  platform: string;
  app_version: string;
  status: string;
  push_enabled: boolean;
  last_seen_at: string;
};

// What /v1/realtime/chat sends on its "event" method: the integration
// envelope. At least once, in any order; only ids and sequences, never a body.
export type ChatEvent = {
  event_id: string;
  event_type: string; // MessageCreated.v1, MessageDeleted.v1, ConversationRead.v1, TypingStarted.v1, more later
  aggregate_id: string;
  occurred_at: string;
  data: {
    conversation_id: string;
    message_id?: string;
    sender_member_id?: string;
    recipient_member_id?: string;
    reader_member_id?: string;
    server_sequence?: number;
    last_read_server_sequence?: number;
    // TypingStarted.v1: who is typing, and until when.
    member_id?: string;
    expires_at?: string;
  };
};

// GET /v1/conversations: newest first; next_cursor is opaque.
export type ConversationPage = {
  items: Conversation[];
  next_cursor?: string;
  has_more: boolean;
};

export type SendMessageRequest =
  | {
      message_id: string; // client-generated; reused on retry
      body: string; // 1-4000 chars, not blank
      message_type: 'TEXT';
      client_sent_at: string;
    }
  | {
      message_id: string;
      message_type: 'FILE';
      file_asset_id: string; // from POST .../attachments, sent once
      body?: string; // optional caption
      client_sent_at: string;
    };

export type ReportCategory = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'SCAM' | 'OTHER';

// POST /v1/members/{memberId}/report (SAF-01). resource: what the report is
// about, if more than the member's profile (a Commit request or a message they
// sent you). 409 REPORT_ALREADY_OPEN while an earlier report is still open.
export type MemberReportCategory = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'FAKE_PROFILE' | 'OTHER';
export type MemberReportRequest = {
  category: MemberReportCategory;
  description?: string; // max 2000 chars
  resource_type?: 'PROFILE' | 'REQUEST' | 'MESSAGE';
  resource_id?: string;
};
// Never carries the reported member's name or details.
export type MemberReportResponse = { report_id: string; category: MemberReportCategory; status: string; created_at: string };

export type MessageReportRequest = {
  category: ReportCategory;
  description?: string; // max 2000 chars
};

export type MessageReportResponse = {
  report_id: string;
  message_id: string;
  category: ReportCategory;
  status: string;
  created_at: string;
};

// GET /v1/me/blocks: members I blocked (newest first). The blocker knows who
// they blocked, so the name is included.
export type BlockedMember = {
  member_id: string;
  display_name: string | null;
  blocked_at: string;
};
