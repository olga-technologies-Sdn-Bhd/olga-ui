import * as Keychain from 'react-native-keychain';
import { keychainService } from '../config/env';
import { ApiError, getMemberId } from './client';

// Offline first: what the member has already seen is kept on the phone and
// shown when there's no network, then refreshed as soon as Ol-ga answers.
//
// Stored encrypted (Android Keystore / iOS Keychain, this device only, while
// unlocked), per environment and per member. Only the member's own data and
// what the app already shows them: no tokens, no contact details of others,
// no location. Entries expire after MAX_AGE_MS and are deleted on sign-out.

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Every cached read, so sign-out can delete them all.
export const CACHED = ['events', 'profile', 'connections', 'meetings', 'commits-in', 'commits-out', 'attendees', 'conversations'] as const;
export type CachedName = (typeof CACHED)[number];

type Entry<T> = { savedAt: number; key: string; value: T };

const service = (memberId: string, name: CachedName) => keychainService(`olga.cache.${memberId}.${name}`);

async function read<T>(memberId: string, name: CachedName, key: string): Promise<T | undefined> {
  try {
    const stored = await Keychain.getGenericPassword({ service: service(memberId, name) });
    if (!stored) return undefined;
    const entry = JSON.parse(stored.password) as Entry<T>;
    if (entry.key !== key || Date.now() - entry.savedAt > MAX_AGE_MS) return undefined;
    return entry.value;
  } catch {
    return undefined;
  }
}

function write<T>(memberId: string, name: CachedName, key: string, value: T) {
  const entry: Entry<T> = { savedAt: Date.now(), key, value };
  Keychain.setGenericPassword(name, JSON.stringify(entry), {
    service: service(memberId, name),
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => {});
}

// No network or a timeout: worth falling back to what's on the phone. A real
// answer from Ol-ga (an error included) never is.
export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0;

// Runs fetch; keeps a good answer; with no network, answers from the phone
// (key tells apart, say, two events' attendee lists: only the latest is kept).
export async function cached<T>(name: CachedName, fetch: () => Promise<T>, key: string = name): Promise<T> {
  const memberId = getMemberId();
  try {
    const value = await fetch();
    if (memberId) write(memberId, name, key, value);
    return value;
  } catch (e) {
    if (memberId && isOffline(e)) {
      const saved = await read<T>(memberId, name, key);
      if (saved !== undefined) return saved;
    }
    throw e;
  }
}

export async function clearCache(memberId: string) {
  await Promise.all(CACHED.map((name) => Keychain.resetGenericPassword({ service: service(memberId, name) }).catch(() => false)));
}
