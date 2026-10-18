import * as Keychain from 'react-native-keychain';
import { keychainService } from '../config/env';
import type { NearbyRequest } from './types';

// Nearby state kept on the phone, per member: Commits made over Bluetooth
// (until Ol-ga has them), and what's needed to be found with no internet.
export type NearbySaved = {
  available: boolean;
  consented: boolean;
  intent: string;
  // From the last profile load, for the card when there's no internet.
  headline: string;
  roleCategory?: string;
  offer: string;
  name: string;
  requests: NearbyRequest[];
  passedIds: string[];
};

export const EMPTY_NEARBY: NearbySaved = {
  available: false,
  consented: false,
  intent: '',
  headline: '',
  offer: '',
  name: '',
  requests: [],
  passedIds: [],
};

const SERVICE = keychainService('olga.nearby');

// Requests that are finished and older than this are dropped from the phone.
const KEEP_DONE_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = Record<string, NearbySaved>;

async function loadAll(): Promise<Stored> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? (JSON.parse(result.password) as Stored) : {};
  } catch {
    return {};
  }
}

export async function loadNearby(memberId: string): Promise<NearbySaved> {
  const all = await loadAll();
  return { ...EMPTY_NEARBY, ...all[memberId] };
}

// Writes are chained so two quick saves never land out of order.
let chain: Promise<unknown> = Promise.resolve();

// Removes everything Nearby kept for this member (account deletion).
export function clearNearby(memberId: string) {
  chain = chain
    .then(async () => {
      const all = await loadAll();
      delete all[memberId];
      await Keychain.setGenericPassword(SERVICE, JSON.stringify(all), {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    })
    .catch(() => {});
  return chain;
}

export function saveNearby(memberId: string, data: NearbySaved) {
  const now = Date.now();
  const trimmed: NearbySaved = {
    ...data,
    requests: data.requests.filter((r) => !(r.sync.done && now - (r.respondedAt ?? r.createdAt) > KEEP_DONE_MS)),
  };
  chain = chain
    .then(async () => {
      const all = await loadAll();
      all[memberId] = trimmed;
      await Keychain.setGenericPassword(SERVICE, JSON.stringify(all), {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    })
    .catch(() => {});
  return chain;
}
