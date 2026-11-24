import { ApiError } from '../api/client';
import type { PrimaryIntentPreview, VentureIntentSetRequest } from '../api/types';
import { newId } from './ids';
import { connectionProblem, GENERIC_PROBLEM } from './problems';

// The primary intent: what a business offers and wants, with tags. The member
// always previews it before it is saved. The preview's values go back unchanged.

// Limits from the contract: 1-4,000 characters each, 1-50 distinct tags, and a
// canonical tag is at most 64 characters.
export const INTENT_TEXT_MAX = 4000;
export const MAX_TAGS = 50;
export const TAG_MAX = 64;

// The contract requires expires_at but defines no expiry for a primary intent;
// a year is its own example. Backend/product still has to confirm this.
export const INTENT_VALID_DAYS = 365;

export function cleanIntentText(input: string): string | null {
  const text = input.trim().replace(/[ \t]+/g, ' ');
  return text.length > 0 && text.length <= INTENT_TEXT_MAX ? text : null;
}

// Tags as the member typed them: trimmed, no blanks, no repeats (any case).
export function cleanTags(input: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

// ISO 8601 in UTC with no fractions, like 2027-11-22T10:00:00Z.
export function expiresAt(now: number, days = INTENT_VALID_DAYS): string {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// The offer and want intent IDs stay the same for a business (a save creates or
// updates them); every save is a new intent_set_id, which is also its key.
export type IntentIds = { offer_intent_id: string; want_intent_id: string };

export const newIntentIds = (now = Date.now()): IntentIds => ({
  offer_intent_id: newId('intent_offer', now),
  want_intent_id: newId('intent_want', now),
});

export function buildIntentSet(
  ventureId: string,
  offerText: string,
  wantText: string,
  preview: PrimaryIntentPreview,
  ids: IntentIds,
  now = Date.now()
): VentureIntentSetRequest {
  return {
    intent_set_id: newId('intentset', now),
    venture_id: ventureId,
    ...ids,
    offer_text: offerText,
    want_text: wantText,
    expires_at: expiresAt(now),
    structured_intent: { tags: preview.canonical_tags },
    tags: preview.canonical_tags,
    tag_fingerprint: preview.tag_fingerprint,
    previewed_at: preview.previewed_at,
  };
}

// What was saved last, kept on the phone: the contract has no call that returns
// the whole current intent, so this is how the form comes back.
export type SavedIntentSet = IntentIds & {
  venture_id: string;
  offer_text: string;
  want_text: string;
  tags: string[];
};

export function previewProblem(error: unknown): string {
  if (error instanceof ApiError && (error.status === 400 || error.code === 'VALIDATION_FAILED')) {
    return 'Please check your offer, want and tags, then try again.';
  }
  return connectionProblem(error) ?? GENERIC_PROBLEM;
}

// A second change of tags within 24 hours is a 409: the current intent stays,
// and the server decides when it can be changed (never worked out here).
export function intentProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.code === 'RESOURCE_STATE_CONFLICT') {
      return 'Your tags were changed recently, so they can’t be changed again yet. Your current offer and want are unchanged. Try again in 24 hours.';
    }
    if (error.status === 400) return 'Please check what you wrote and try again.';
    if (error.status === 404) return "We couldn't find your business. Go back and save it first.";
  }
  return connectionProblem(error) ?? GENERIC_PROBLEM;
}
