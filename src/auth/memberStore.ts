import * as Keychain from 'react-native-keychain';

// The Olga member created by POST /v1/members after the first email OTP
// sign-in. Kept per verified email so logging out and back in with the same
// email reuses the same member instead of re-registering (which Olga.Core
// rejects with 409 once the email is taken).
export type StoredMember = {
  member_id: string;
  etag: string;
  display_name: string;
  phone?: string;
};

type MemberStore = {
  current: string | null; // email of the signed-in member
  members: Record<string, StoredMember>;
};

const SERVICE = 'olga.members';
const EMPTY: MemberStore = { current: null, members: {} };

export async function loadMemberStore(): Promise<MemberStore> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? { ...EMPTY, ...(JSON.parse(result.password) as MemberStore) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function saveMemberStore(store: MemberStore) {
  await Keychain.setGenericPassword(SERVICE, JSON.stringify(store), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
