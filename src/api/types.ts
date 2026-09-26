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
  display_name: string;
  headline?: string;
  professional_summary?: string;
  role_category?: string;
  profile_status: ProfileStatus;
  visibility: Visibility;
  completeness_score: number;
  e_tag?: string;
  updated_at: string;
};
export type Profile = WithEtag<ProfileBody>;

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
  attendee_count?: number;
  live_count?: number;
};

export type EventRegistration = {
  event_id: string;
  member_id: string;
  status: string;
  registered_at: string;
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
