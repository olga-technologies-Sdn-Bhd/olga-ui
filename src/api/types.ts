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
  // From POST /v1/auth/phone/verification-checks. Required whenever `phone`
  // is sent (even with an email), and bound to that exact phone.
  phone_verification_token?: string;
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

// Phone OTP (Twilio Verify behind Core). Phones are E.164, e.g. +60123456789.
// POST /v1/auth/phone/verifications -> 202 { status: 'PENDING' }.
export type PhoneVerificationRequest = {
  phone: string;
  channel: 'sms';
};
export type PhoneVerificationResponse = {
  status: 'PENDING';
};

// POST /v1/auth/phone/verification-checks. The token is a signed proof bound
// to the phone, good for 300 s; memory only, never stored or logged.
export type PhoneVerificationCheckRequest = {
  phone: string;
  code: string;
};
export type PhoneVerificationCheckResponse = {
  verification_token: string;
  expires_at: string;
};

// POST /v1/members/lookup/phone (no X-Member-Id). 404 MEMBER_NOT_REGISTERED = new user.
export type MemberPhoneLookupRequest = {
  phone: string;
  verification_token: string;
};

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
// (Nearby, general matching). Accepting it creates the connection and
// conversation, as a Commit does. match_result_id: the general match it came from.
export type ConnectionRequestCreate = { recipient_member_id: string; note?: string; expires_in_days?: number; match_result_id?: number };
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

// ---- Businesses and the Social Capital Index (SCI) ----
// "Business" or "Project" in the app's words; `venture` on the wire. Source:
// SCI UI Integration Guide (Core + NLP pilot API). The pilot has no business
// list or detail endpoint: the app keeps the venture_id from the create call.

// POST /v1/ventures -> 201. The app chooses venture_id (max 64 chars). The
// code lists (industry, stage, bands) are not published yet.
export type CreateVentureRequest = {
  venture_id: string;
  name: string; // max 250
  organization_id?: string | null;
  industry_code?: string | null;
  stage_code?: string | null;
  revenue_band_code?: string | null;
  team_size_band_code?: string | null;
  geography_codes?: string[]; // max 20, each max 64
};

export type VentureBody = {
  venture_id: string;
  name: string;
  status: string;
  geography_codes: string[];
  updated_at: string;
  e_tag?: string;
};

export type ImportContactsResponse = {
  imported_count: number;
  link_ids: string[];
};

// POST /v1/invite-batches -> 201. 1-20 unique link_ids; expires_in_days 1-30.
// venture_id, if sent, must be an active business of the caller.
export type CreateInviteBatchRequest = {
  batch_id: string;
  venture_id?: string;
  link_ids: string[];
  expires_in_days: number;
};

// The token is a secret (64 hex chars): never log it or send it to analytics.
export type Invitation = {
  invitation_id: string;
  link_id: string;
  token: string;
  expires_at: string;
};

export type InviteBatchBody = {
  batch_id: string;
  status: string;
  invitations: Invitation[];
  e_tag?: string;
};

// POST /v1/invitations/{token}/accept -> 200. No request body.
export type AcceptInvitationResponse = {
  invitation_id: string;
  connection_id: string;
  conversation_id: string;
  link_id: string;
};

export type InvitationStatus = 'APPROVED' | 'OPENED' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

// GET /v1/contacts: people this member imported, newest first, with their
// latest invitation. No contact details come back, only the label.
export type ImportedContact = {
  link_id: string;
  contact_record_id: string;
  label: string;
  lifecycle_state: string;
  contact_member_id?: string | null;
  has_email: boolean;
  has_phone: boolean;
  invitation_id?: string | null;
  invitation_status?: InvitationStatus | null;
  invitation_expires_at?: string | null;
  imported_at: string;
  expires_at: string;
};

export type ImportedContactPage = {
  items: ImportedContact[];
  next_cursor?: string | null;
};

// GET /v1/invite-batches/{batch_id}: no tokens come back.
export type InviteBatchDetail = {
  batch_id: string;
  venture_id?: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  invitations: {
    invitation_id: string;
    link_id: string;
    label: string;
    status: InvitationStatus;
    first_opened_at?: string | null;
    accepted_at?: string | null;
    expires_at: string;
  }[];
};

// POST /v1/invitations/{invitation_id}/resend -> a NEW token (the old link
// stops working). 409 INVITATION_NOT_RESENDABLE once accepted or revoked.
export type ResendInvitationResponse = {
  invitation_id: string;
  link_id: string;
  token: string;
  expires_at: string;
};

// POST /v1/invitations/{token}/open: who sent it, before Accept. 404 when the
// token is unknown or the invitation was withdrawn.
export type OpenedInvitation = {
  invitation_id: string;
  inviter_member_id: string;
  inviter_display_name: string;
  venture_name?: string | null;
  status: InvitationStatus;
  expires_at: string;
};

// GET /v1/me/invitations: invitations waiting for the signed-in member, found
// by their verified phone or email. No tokens.
export type PendingInvitation = {
  invitation_id: string;
  inviter_member_id: string;
  inviter_display_name: string;
  inviter_headline?: string | null;
  venture_name?: string | null;
  invited_at: string;
  expires_at: string;
};

// ---- SCI Mobile Integration Contract v1.0 (22 Nov 2026) ----
// Everything below is the server's: scores, bands, layers, goals and counts
// are shown as sent and never worked out in the app.

// GET /v1/sci/summary. sci_count counts accepted, Connected people whose rounded
// primary-intent score is 30 or more. It is never capped (1,742 shows as 1,742).
export type SciGoalMilestone = { percent: number; reached_at: string };

export type SciGoal = {
  goal_id: string;
  goal_value: number;
  goal_sequence: number;
  owner_type: string;
  progress_percent: number;
  target_at?: string | null;
  milestones: SciGoalMilestone[];
};

// projection_status is READY once scores are up to date; anything else
// (e.g. RECALCULATING) means they are being worked out.
export type SciSummary = {
  sci_count: number;
  potential_count: number;
  waitlist_count: number;
  repository_count: number;
  total_contact_count: number;
  core_count: number;
  month_change: number;
  intent_update_count: number;
  projection_status: string;
  projection_version: number;
  scorer_version?: string | null;
  scoring_config_id?: string | null;
  as_of: string;
  goal?: SciGoal | null; // null for company or event-organiser owners
  e_tag?: string;
};

// ESTIMATED, INVITED, JOINED, REQUEST_PENDING, CONNECTED or REMOVED.
export type SciLifecycle = 'ESTIMATED' | 'INVITED' | 'JOINED' | 'REQUEST_PENDING' | 'CONNECTED' | 'REMOVED' | (string & {});

// REPOSITORY (under 10), WAITLIST (10-29) or NETWORK (30 and over).
export type SciBand = 'REPOSITORY' | 'WAITLIST' | 'NETWORK' | (string & {});

// GET /v1/sci/contacts. The flags are the authority on what counts.
export type SciContact = {
  link_id: string;
  contact_member_id?: string | null;
  label: string;
  lifecycle_state: SciLifecycle;
  score?: number | null; // whole number; an estimated score is capped at 85 by the server
  band: SciBand;
  is_estimated: boolean;
  counts_in_sci: boolean;
  counts_in_potential: boolean;
  projection_state: string;
  frozen_at?: string | null;
  freeze_reason?: string | null;
  layer_code?: string | null;
  layer_ordinal?: number | null;
  outcome_points: number;
  tie_strength: number;
  reason_code?: string | null;
  score_calculated_at?: string | null;
  last_activity_at?: string | null;
  projection_version: number;
  as_of: string;
  e_tag?: string;
};

export type SciPage = {
  items: SciContact[];
  next_cursor?: string | null; // pass back unchanged; null/absent = last page
};

// GET /v1/sci/reach-out: shown in the order sent, never re-sorted.
export type SciReachOut = {
  recommendation_id: string;
  link_id: string;
  contact_member_id: string;
  reason_code: string;
  match_score: number;
  relevance_score: number;
  rank: number;
  projection_version: number;
  generated_at: string;
  expires_at: string;
};

export type SciReachOutPage = {
  items: SciReachOut[];
  next_cursor?: string | null;
};

// NLP POST /v1/primary-intents/preview (no Idempotency-Key needed). 1-4,000
// characters each for offer and want; 1-50 distinct tags.
export type PrimaryIntentPreviewRequest = {
  offer_text: string;
  want_text: string;
  tags: string[];
};

// Pass canonical_tags, tag_fingerprint and previewed_at back unchanged on save.
export type PrimaryIntentPreview = {
  canonical_tags: string[];
  tag_fingerprint: string;
  previewed_at: string;
  preview_text: string;
};

// NLP GET /v1/primary-intents/history: metadata only (the contract has no
// endpoint that returns the whole current intent).
export type PrimaryIntentHistoryPage = {
  items: Record<string, unknown>[];
  next_cursor?: string | null;
};

// NLP POST /v1/venture-intent-sets -> 202 with projection_status RECALCULATING.
// intent_set_id must equal the Idempotency-Key. One request makes or updates
// both the offer and the want: /v1/intents is not called for this flow.
export type VentureIntentSetRequest = {
  intent_set_id: string;
  venture_id: string;
  offer_intent_id: string;
  want_intent_id: string;
  offer_text: string;
  want_text: string;
  expires_at: string;
  structured_intent: { tags: string[] };
  category?: string | null;
  industry?: string | null;
  geography?: string | null;
  language?: string | null;
  tags: string[];
  tag_fingerprint: string;
  previewed_at: string;
};

export type VentureIntentSetResponse = {
  intent_set_id: string;
  venture_id: string;
  projection_status?: string;
  offer?: { intent_id: string; status: string };
  want?: { intent_id: string; status: string };
};

// POST /v1/contacts/imports. Only a name, phone, email, job title, company,
// industry and city may be collected. retention_days is left out: retention is
// the backend's policy. Never sent to NLP, never logged.
export type ImportContact = {
  contact_record_id: string;
  link_id: string;
  label: string; // max 250
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company?: string | null;
  industry?: string | null;
  city?: string | null;
};

export type ImportContactsRequest = {
  contacts: ImportContact[];
};

// POST /v1/relationship-outcomes: only for a Connected member.
export type OutcomeType = 'MEETING' | 'INTRODUCTION' | 'RESULT';

export type CreateOutcomeRequest = {
  outcome_id: string;
  contact_member_id: string;
  outcome_type: OutcomeType;
  occurred_at: string;
  result_type?: string | null; // required for RESULT, max 32
};

export type OutcomeDecision = 'CONFIRM' | 'DENY' | 'WITHDRAW';

export type RelationshipOutcome = {
  outcome_id: string;
  outcome_type: string;
  status: string;
  initiated_by_member_id: string;
  contact_member_id: string;
  occurred_at: string;
  confirmation_due_at: string;
  verified_at?: string | null;
  withdrawal_due_at?: string | null;
  valid_until?: string | null;
  points: number; // zero until both members confirm
  confirmation_count: number;
  e_tag?: string;
};

// GET /v1/notifications: template and resource metadata only, no title or body,
// and no read or dismiss call yet (a gap in the contract).
export type InAppNotification = {
  notification_id: string;
  purpose_code: string;
  resource_type?: string | null;
  resource_id?: string | null;
  template_code: string;
  status: string;
  scheduled_at: string;
  expires_at: string;
  created_at: string;
  e_tag?: string;
};

export type InAppNotificationPage = {
  items: InAppNotification[];
  next_cursor?: string | null;
};

// PATCH /v1/me/notification-preferences. Times are local, "22:00:00", with an
// IANA timezone_id. No WhatsApp or SMS channel in this phase.
export type NotificationPreferenceRequest = {
  purpose_code: string;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_start_local?: string | null;
  quiet_end_local?: string | null;
  timezone_id?: string | null;
};

export type NotificationPreference = NotificationPreferenceRequest & {
  e_tag?: string;
  updated_at: string;
};

// GET/PUT /v1/me/discovery-preference. Off by default. PUT sends the ETag from
// the read in If-Match.
export type DiscoveryPreference = {
  find_by_phone: boolean;
  find_by_email: boolean;
  e_tag?: string;
  updated_at: string;
};
