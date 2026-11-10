import * as Keychain from 'react-native-keychain';
import { keychainService } from '../config/env';
import type { SavedBusiness } from './business';

// The member's saved Business, kept on this phone and keyed by member ID, so a
// second account on the same phone starts fresh. Not secret, but the Keychain
// is already how the app keeps per-member data (see PrefsContext).
const SERVICE = keychainService('olga.business');

type Stored = Record<string, SavedBusiness>;

async function readAll(): Promise<Stored> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? (JSON.parse(result.password) as Stored) : {};
  } catch {
    return {};
  }
}

export async function loadBusiness(memberId: string): Promise<SavedBusiness | null> {
  const saved = (await readAll())[memberId];
  return saved?.venture_id && saved.name ? saved : null;
}

export async function saveBusiness(memberId: string, business: SavedBusiness) {
  const all = await readAll();
  await Keychain.setGenericPassword(SERVICE, JSON.stringify({ ...all, [memberId]: business }), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
