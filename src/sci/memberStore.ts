import * as Keychain from 'react-native-keychain';
import { keychainService } from '../config/env';

// Small per-member records kept on this phone in the Keychain (the way the app
// already keeps per-member data, see PrefsContext). Keyed by member ID, so a
// second account on the same phone starts fresh.
export function makeMemberStore<T>(name: string) {
  const service = keychainService(name);

  async function readAll(): Promise<Record<string, T>> {
    try {
      const result = await Keychain.getGenericPassword({ service });
      return result ? (JSON.parse(result.password) as Record<string, T>) : {};
    } catch {
      return {};
    }
  }

  return {
    async load(memberId: string): Promise<T | null> {
      return (await readAll())[memberId] ?? null;
    },
    async save(memberId: string, value: T) {
      const all = await readAll();
      await Keychain.setGenericPassword(service, JSON.stringify({ ...all, [memberId]: value }), {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
  };
}
