import { ApiError } from '../api/client';
import type { VentureIntentSetRequest, VentureIntentSummary } from '../api/types';
import { connectionProblem, GENERIC_PROBLEM } from './problems';
import { newId } from './ids';

// What a business offers and wants (the paired OFFER and WANT intents of the
// Social Capital Index). Product decisions: structured_intent is {}, and the
// set is valid for 90 days from the day it is sent.

// Core and NLP publish no length limit; this keeps the text a sensible size.
export const INTENT_TEXT_MAX = 1000;
export const INTENT_VALID_DAYS = 90;

export function cleanIntentText(input: string): string | null {
  const text = input.trim().replace(/[ \t]+/g, ' ');
  return text.length > 0 && text.length <= INTENT_TEXT_MAX ? text : null;
}

// ISO 8601 in UTC with no fractions, like 2027-02-02T10:30:00Z.
export function expiresAt(now: number, days = INTENT_VALID_DAYS): string {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// A set is one logical action: three new IDs every time, none ever reused. The
// same request is sent again only to retry that exact attempt.
export function buildIntentSet(ventureId: string, offerText: string, wantText: string, now = Date.now()): VentureIntentSetRequest {
  return {
    intent_set_id: newId('intent_set', now),
    venture_id: ventureId,
    offer_intent_id: newId('intent', now),
    want_intent_id: newId('intent', now),
    offer_text: offerText,
    want_text: wantText,
    expires_at: expiresAt(now),
    structured_intent: {},
  };
}

export type IntentProgress = 'processing' | 'ready' | 'failed';

// Both must be MATCH_READY; either one FAILED stops it.
export function intentProgress(offer: Pick<VentureIntentSummary, 'status'>, want: Pick<VentureIntentSummary, 'status'>): IntentProgress {
  if (offer.status === 'FAILED' || want.status === 'FAILED') return 'failed';
  return offer.status === 'MATCH_READY' && want.status === 'MATCH_READY' ? 'ready' : 'processing';
}

// What was sent last, so progress can be checked again after leaving the screen.
export type SavedIntentSet = {
  venture_id: string;
  offer_intent_id: string;
  want_intent_id: string;
  offer_text: string;
  want_text: string;
};

export function intentProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VENTURE_INTENT_SET_INVALID' || error.status === 400) return 'Please check what you wrote and try again.';
    if (error.status === 404) return "We couldn't find your business. Go back and save it first.";
    if (error.status === 409) return 'Something went wrong saving that. Please try again.';
  }
  return connectionProblem(error) ?? GENERIC_PROBLEM;
}
