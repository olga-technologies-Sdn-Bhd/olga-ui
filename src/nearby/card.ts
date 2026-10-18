import { isPublicKey } from '../chat/crypto';
import type { NearbyCard, NearbyMessage } from './types';

const MAX_CARD_BYTES = 500; // the characteristic holds 512

function utf8Length(text: string) {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function clip(text: string, max: number) {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

// Two letters from the headline, never from the name (it's shown before an accept).
export function initialsFromHeadline(headline: string) {
  const word = headline.trim().split(/\s+/)[0] ?? '';
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return letters ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase() : '··';
}

export function buildCard(
  memberId: string,
  headline: string,
  roleCategory: string | undefined,
  want: string,
  offer: string,
  chatKey?: string
): NearbyCard {
  const h = headline.trim() || 'Ol-ga member';
  let card: NearbyCard = {
    v: 1,
    m: memberId,
    h: clip(h, 80),
    ...(roleCategory ? { r: clip(roleCategory, 40) } : {}),
    w: clip(want.trim(), 220),
    ...(offer.trim() ? { o: clip(offer.trim(), 160) } : {}),
    i: initialsFromHeadline(h),
    ...(chatKey ? { k: chatKey } : {}),
  };
  // Shorten what we offer, then what we want, until it fits.
  for (let room = 150; utf8Length(JSON.stringify(card)) > MAX_CARD_BYTES && room > 20; room -= 20) {
    card = { ...card, ...(card.o ? { o: clip(card.o, room) } : {}), w: clip(card.w, room + 60) };
  }
  return card;
}

export function parseCard(text: string): NearbyCard | null {
  try {
    const c = JSON.parse(text);
    if (c?.v !== 1 || typeof c.m !== 'string' || typeof c.h !== 'string' || typeof c.w !== 'string' || typeof c.i !== 'string') return null;
    return {
      v: 1,
      m: c.m,
      h: c.h,
      w: c.w,
      i: c.i,
      ...(typeof c.r === 'string' ? { r: c.r } : {}),
      ...(typeof c.o === 'string' ? { o: c.o } : {}),
      ...(isPublicKey(c.k) ? { k: c.k } : {}),
    };
  } catch {
    return null;
  }
}

export function parseMessage(text: string): NearbyMessage | null {
  try {
    const m = JSON.parse(text);
    if (m?.v !== 1 || typeof m.id !== 'string') return null;
    if (m.t === 'commit') {
      const from = parseCard(JSON.stringify(m.from));
      return from ? { v: 1, t: 'commit', id: m.id, from } : null;
    }
    if (typeof m.from !== 'string') return null;
    if (m.t === 'accept') return { v: 1, t: 'accept', id: m.id, from: m.from, ...(typeof m.name === 'string' ? { name: m.name } : {}) };
    if (m.t === 'decline') return { v: 1, t: 'decline', id: m.id, from: m.from };
    if (m.t === 'name' && typeof m.name === 'string') return { v: 1, t: 'name', id: m.id, from: m.from, name: m.name };
    return null;
  } catch {
    return null;
  }
}
