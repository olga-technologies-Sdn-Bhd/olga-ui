import type { CreateInviteBatchRequest, ImportContact, ImportContactsRequest } from '../api/types';
import { normalizePhone } from '../auth/phone';
import { newIdempotencyKey } from '../api/client';
import { newId } from './ids';

// Inviting people the member knows. Contact details are sensitive: they stay
// in memory, are sent only to Core (never NLP), and are never logged.

// Product: contacts are kept for a year; an invitation stays valid for two weeks
// (the guide's example). A batch holds at most 20 people.
export const CONTACT_RETENTION_DAYS = 365;
export const INVITE_VALID_DAYS = 14;
export const INVITE_BATCH_MAX = 20;
export const IMPORT_MAX = 500;
const LABEL_MAX = 250;

// What the contacts library gives, trimmed to what is read.
export type RawContact = {
  recordID: string;
  displayName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  emailAddresses?: { email: string }[];
  phoneNumbers?: { number: string }[];
};

// assumedCode: the phone was saved without a country code and the member's
// chosen one was put in front.
export type DeviceContact = { id: string; name: string; email: string | null; phone: string | null; assumedCode?: boolean };

// "0044 ..." is "+44 ...". A number saved without a country code gets
// dialCode (e.g. "+91") in front, minus its leading 0; with no dialCode it
// can't be sent as E.164.
export function phoneForImport(raw: string, dialCode?: string): string | null {
  const trimmed = raw.trim().replace(/^00/, '+');
  if (trimmed.startsWith('+') || !dialCode) return normalizePhone(trimmed);
  const local = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return local ? normalizePhone(`${dialCode}${local}`) : null;
}

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// People who can be invited (an email or a usable phone), by name. A full
// international number wins over one that needs dialCode.
export function deviceContactsFrom(raw: RawContact[], dialCode?: string): DeviceContact[] {
  const people: DeviceContact[] = [];
  for (const c of raw) {
    const email = (c.emailAddresses ?? []).map((e) => e.email.trim()).find(looksLikeEmail) ?? null;
    const numbers = (c.phoneNumbers ?? []).map((p) => p.number);
    const full = numbers.map((n) => phoneForImport(n)).find((p): p is string => !!p) ?? null;
    const assumed = full || !dialCode ? null : (numbers.map((n) => phoneForImport(n, dialCode)).find((p): p is string => !!p) ?? null);
    const phone = full ?? assumed;
    if (!email && !phone) continue;
    const name = (c.displayName || `${c.givenName ?? ''} ${c.familyName ?? ''}`).trim().replace(/\s+/g, ' ') || email || phone || '';
    people.push({ id: c.recordID, name: name.slice(0, LABEL_MAX), email, phone, ...(assumed ? { assumedCode: true } : {}) });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

// One go at "import these people and invite them": every ID and key made once,
// so trying again after a lost answer repeats the same requests.
export type InviteAttempt = {
  signature: string;
  importRequest: ImportContactsRequest;
  importKey: string;
  batch: CreateInviteBatchRequest;
  batchKey: string;
  // link_id -> the name to show beside its link.
  names: Record<string, string>;
  imported: boolean;
};

export const attemptSignature = (ventureId: string, people: DeviceContact[]) =>
  `${ventureId}|${people.map((p) => p.id).sort().join(',')}`;

export function buildInviteAttempt(ventureId: string, people: DeviceContact[], now = Date.now()): InviteAttempt {
  const contacts: ImportContact[] = [];
  const names: Record<string, string> = {};
  for (const p of people) {
    const link_id = newId('link', now);
    names[link_id] = p.name;
    contacts.push({ contact_record_id: newId('contact', now), link_id, label: p.name, email: p.email, phone: p.phone });
  }
  return {
    signature: attemptSignature(ventureId, people),
    importRequest: { contacts, retention_days: CONTACT_RETENTION_DAYS },
    importKey: newIdempotencyKey(),
    batch: { batch_id: newId('batch', now), venture_id: ventureId, link_ids: contacts.map((c) => c.link_id), expires_in_days: INVITE_VALID_DAYS },
    batchKey: newIdempotencyKey(),
    names,
    imported: false,
  };
}

// Country codes offered for numbers saved without one (Ol-ga's markets first).
export const DIAL_CODES = [
  { code: '+60', country: 'Malaysia' },
  { code: '+91', country: 'India' },
  { code: '+65', country: 'Singapore' },
  { code: '+62', country: 'Indonesia' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+1', country: 'US / Canada' },
] as const;

// The likeliest country code for numbers saved without one: the one most
// common among this phone's full numbers (Malaysia when there are none).
export function guessDialCode(raw: RawContact[]): string {
  const counts = new Map<string, number>();
  for (const c of raw) {
    for (const p of c.phoneNumbers ?? []) {
      const full = phoneForImport(p.number);
      const match = full && DIAL_CODES.find((d) => full.startsWith(d.code));
      if (match) counts.set(match.code, (counts.get(match.code) ?? 0) + 1);
    }
  }
  let best: string = DIAL_CODES[0].code;
  for (const [code, n] of counts) if (n > (counts.get(best) ?? 0)) best = code;
  return best;
}
