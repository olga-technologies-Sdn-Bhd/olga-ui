import * as Keychain from 'react-native-keychain';
import { EMPTY_STORE, MemberStore } from './memberSession';

export type { MemberStore, StoredMember } from './memberSession';
export { normalizeEmail } from './memberSession';

// Keychain persistence for the member store. The decisions about what goes in
// it live in memberSession.ts (pure, unit-tested).
const SERVICE = 'olga.members';

export async function loadMemberStore(): Promise<MemberStore> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? { ...EMPTY_STORE, ...(JSON.parse(result.password) as MemberStore) } : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

export async function saveMemberStore(store: MemberStore) {
  await Keychain.setGenericPassword(SERVICE, JSON.stringify(store), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
