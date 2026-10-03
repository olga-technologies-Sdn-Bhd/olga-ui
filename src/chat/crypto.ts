import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import * as Keychain from 'react-native-keychain';
import { secureRandomBase64 } from '../bluetooth/bleDiscovery';
import { keychainService } from '../config/env';

// Chat over Bluetooth is encrypted between the two phones. Each member has an
// X25519 key pair on this phone; the private key never leaves the encrypted
// keychain. Two connected members derive the same key for their pair, and
// every message is sealed with XChaCha20-Poly1305, bound to who sent it, who
// it's for and its message ID (so it can't be replayed to someone else).

const SERVICE = keychainService('olga.chatkey');
const INFO = utf8ToBytes('olga-chat-v1');

export type ChatKeyPair = { privateKey: Uint8Array; publicKey: string };

/* eslint-disable no-bitwise */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string) {
  const clean = text.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) throw new Error('Not base64');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let j = 0;
  for (const ch of clean) {
    value = (value << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[j++] = (value >> bits) & 255;
    }
  }
  return bytes;
}

// UTF-8 by hand: Hermes has no TextDecoder (and noble's helpers use it).
export function utf8ToBytes(text: string) {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

export function bytesToUtf8(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const n = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
    let c = n === 1 ? b : b & (0xff >> (n + 1));
    for (let k = 1; k < n; k++) c = (c << 6) | ((bytes[i + k] ?? 0) & 63);
    out += String.fromCodePoint(c);
    i += n;
  }
  return out;
}

/* eslint-enable no-bitwise */

function randomBytes(count: number) {
  const value = secureRandomBase64(count);
  if (!value) throw new Error('No secure random source');
  const bytes = fromBase64(value);
  if (bytes.length !== count) throw new Error('Short random read');
  return bytes;
}

// A public key as other phones see it: base64 of 32 bytes.
export function isPublicKey(text: unknown): text is string {
  if (typeof text !== 'string' || text.length !== 44) return false;
  try {
    return fromBase64(text).length === 32;
  } catch {
    return false;
  }
}

type Stored = Record<string, string>; // member ID -> private key (base64)

async function loadAll(): Promise<Stored> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? (JSON.parse(result.password) as Stored) : {};
  } catch {
    return {};
  }
}

async function saveAll(all: Stored) {
  await Keychain.setGenericPassword(SERVICE, JSON.stringify(all), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

// This member's key pair on this phone, made the first time it's needed.
// One load per member at a time: two callers at first run must not each make
// (and save) a different key.
const loading = new Map<string, Promise<ChatKeyPair>>();

export function loadKeyPair(memberId: string): Promise<ChatKeyPair> {
  let pending = loading.get(memberId);
  if (!pending) {
    pending = makeOrLoad(memberId);
    loading.set(memberId, pending);
    pending.catch(() => loading.delete(memberId));
  }
  return pending;
}

async function makeOrLoad(memberId: string): Promise<ChatKeyPair> {
  const all = await loadAll();
  let privateKey = all[memberId] ? fromBase64(all[memberId]) : null;
  if (!privateKey || privateKey.length !== 32) {
    privateKey = randomBytes(32);
    await saveAll({ ...all, [memberId]: toBase64(privateKey) });
  }
  return { privateKey, publicKey: toBase64(x25519.getPublicKey(privateKey)) };
}

// Account deletion: forget this member's key on this phone.
export async function forgetKeyPair(memberId: string) {
  loading.delete(memberId);
  const all = await loadAll();
  delete all[memberId];
  await saveAll(all);
}

// The same 32-byte key on both phones (salted with both member IDs).
export function pairKey(mine: ChatKeyPair, myId: string, theirPublicKey: string, theirId: string) {
  const shared = x25519.getSharedSecret(mine.privateKey, fromBase64(theirPublicKey));
  const salt = utf8ToBytes([myId, theirId].sort().join('\n'));
  return hkdf(sha256, shared, salt, INFO, 32);
}

const aad = (from: string, to: string, id: string) => utf8ToBytes(`${from}>${to}:${id}`);

export function seal(key: Uint8Array, from: string, to: string, id: string, text: string) {
  const nonce = randomBytes(24);
  const sealed = xchacha20poly1305(key, nonce, aad(from, to, id)).encrypt(utf8ToBytes(text));
  return { n: toBase64(nonce), c: toBase64(sealed) };
}

// null when it doesn't open: wrong key, or changed on the way.
export function open(key: Uint8Array, from: string, to: string, id: string, n: string, c: string) {
  try {
    const plain = xchacha20poly1305(key, fromBase64(n), aad(from, to, id)).decrypt(fromBase64(c));
    return bytesToUtf8(plain);
  } catch {
    return null;
  }
}
