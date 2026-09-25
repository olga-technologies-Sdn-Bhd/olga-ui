import { ApiError } from '../api/client';
import type { Profile, ProfileStatus, UpdateProfileRequest } from '../api/types';

// The Olga member created by POST /v1/members after the first email OTP
// sign-in, kept per verified email so the same email signs straight back in.
export type StoredMember = {
  member_id: string;
  etag: string;
  display_name: string;
  phone?: string;
  profile_status?: ProfileStatus;
  // Registered but the activating PATCH /v1/me/profile hasn't succeeded yet;
  // retried silently on the next app start or login.
  needs_activation?: boolean;
};

export type MemberStore = {
  current: string | null; // normalized email of the signed-in member
  members: Record<string, StoredMember>;
};

export const EMPTY_STORE: MemberStore = { current: null, members: {} };

// Member-scoped calls take the member ID explicitly so they work before the
// member is the app's current one (login, restore, registration).
export type MemberApi = {
  getMyProfile: (memberId: string) => Promise<Profile>;
  updateMyProfile: (memberId: string, body: UpdateProfileRequest, ifMatch: string) => Promise<Profile>;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function withMember(store: MemberStore, email: string, member: StoredMember): MemberStore {
  return { ...store, members: { ...store.members, [email]: member } };
}

export function withoutMember(store: MemberStore, email: string): MemberStore {
  const members = { ...store.members };
  delete members[email];
  return { ...store, members };
}

// The stored member ID no longer exists server-side (e.g. dev DB reset).
export function isStaleMemberError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    (error.code === 'MEMBER_NOT_REGISTERED' || error.code === 'PROFILE_NOT_FOUND')
  );
}

// First profile update moves DRAFT -> ACTIVE. Never throws: on failure the
// member is kept and flagged for a silent retry.
export async function activateMember(member: StoredMember, api: MemberApi): Promise<StoredMember> {
  try {
    const profile = await api.updateMyProfile(
      member.member_id,
      { display_name: member.display_name, visibility: 'MEMBERS' },
      member.etag
    );
    return { ...member, etag: profile.etag, profile_status: profile.profile_status, needs_activation: false };
  } catch {
    return { ...member, needs_activation: true };
  }
}

export type RefreshResult =
  | { status: 'active'; member: StoredMember } // confirmed by the server
  | { status: 'offline'; member: StoredMember } // couldn't check; keep the cached member
  | { status: 'stale' }; // server doesn't know this member any more

// Checks a cached member against GET /v1/me/profile. Only a definite
// "not registered" drops the member; network errors and 5xx never force
// re-onboarding.
export async function refreshMember(member: StoredMember, api: MemberApi): Promise<RefreshResult> {
  let profile: Profile;
  try {
    profile = await api.getMyProfile(member.member_id);
  } catch (error) {
    return isStaleMemberError(error) ? { status: 'stale' } : { status: 'offline', member };
  }
  let next: StoredMember = {
    ...member,
    etag: profile.etag,
    display_name: profile.display_name,
    profile_status: profile.profile_status,
  };
  if (next.needs_activation || profile.profile_status === 'DRAFT') {
    next = await activateMember(next, api);
  }
  return { status: 'active', member: next };
}

// After Entra login: the member for this email, or null when it's a new user
// (or the cached one turned out stale) and sign-up must run.
export async function resolveLogin(
  store: MemberStore,
  email: string,
  api: MemberApi
): Promise<{ store: MemberStore; member: StoredMember | null }> {
  const key = normalizeEmail(email);
  const base = { ...store, current: key };
  const cached = store.members[key];
  if (!cached) return { store: base, member: null };

  const result = await refreshMember(cached, api);
  if (result.status === 'stale') return { store: withoutMember(base, key), member: null };
  return { store: withMember(base, key, result.member), member: result.member };
}

export class MemberRecoveryUnavailableError extends Error {
  correlationId?: string;
  constructor(correlationId?: string) {
    super('This email or number is already registered, and recovering an existing member is not supported yet');
    this.name = 'MemberRecoveryUnavailableError';
    this.correlationId = correlationId;
  }
}

// Called when POST /v1/members returns 409 (already registered, but not on
// this device — reinstall, cleared data, new phone). TODO(backend): Olga.Core
// has no way to find the member for a verified email yet. Once it has a
// lookup (or register returns the existing member instead of 409), implement
// it here and return the member; nothing else needs to change.
export async function recoverExistingMember(_email: string, conflict: ApiError): Promise<StoredMember> {
  throw new MemberRecoveryUnavailableError(conflict.correlationId);
}
