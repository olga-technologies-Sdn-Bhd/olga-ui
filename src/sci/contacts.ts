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

export type DeviceContact = { id: string; name: string; email: string | null; phone: string | null };

// "0044 ..." is "+44 ...". A number with no country code can't be sent as
// E.164, so that contact is reached by email only.
export function phoneForImport(raw: string): string | null {
  const trimmed = raw.trim().replace(/^00/, '+');
  return normalizePhone(trimmed);
}

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// People who can be invited (an email or a usable phone), by name.
export function deviceContactsFrom(raw: RawContact[]): DeviceContact[] {
  const people: DeviceContact[] = [];
  for (const c of raw) {
    const email = (c.emailAddresses ?? []).map((e) => e.email.trim()).find(looksLikeEmail) ?? null;
    const phone = (c.phoneNumbers ?? []).map((p) => phoneForImport(p.number)).find((p): p is string => !!p) ?? null;
    if (!email && !phone) continue;
    const name = (c.displayName || `${c.givenName ?? ''} ${c.familyName ?? ''}`).trim().replace(/\s+/g, ' ') || email || phone || '';
    people.push({ id: c.recordID, name: name.slice(0, LABEL_MAX), email, phone });
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
