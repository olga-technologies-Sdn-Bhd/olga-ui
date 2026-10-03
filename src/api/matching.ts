import { MATCH_LIMIT, MATCH_POLL_INTERVAL_MS, MATCH_POLL_TIMEOUT_MS } from '../config/env';
import { ApiError } from './client';
import { coreApi } from './core';
import { intentIdFor, MatchCandidate, nlpApi } from './nlp';
import type { Profile } from './types';

export type MatchCard = { match: MatchCandidate; profile?: Profile };

// Why matching couldn't produce a list, in terms the screen can show.
export type MatchingFailure =
  | 'INTENT_HAS_PII' // ask the user to remove personal details from the intent
  | 'INTENT_FAILED' // intent couldn't be processed: ask the user to rephrase
  | 'MATCHING_FAILED' // match request FAILED server-side
  | 'TIMED_OUT'; // still processing after MATCH_POLL_TIMEOUT_MS

export class MatchingError extends Error {
  reason: MatchingFailure;
  correlationId?: string;
  constructor(reason: MatchingFailure, correlationId?: string) {
    super(reason);
    this.name = 'MatchingError';
    this.reason = reason;
    this.correlationId = correlationId;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Polls fn until done() or the deadline passes.
async function pollUntil<T>(fn: () => Promise<T>, done: (value: T) => boolean, deadline: number): Promise<T> {
  for (;;) {
    const value = await fn();
    if (done(value) || Date.now() >= deadline) return value;
    await sleep(MATCH_POLL_INTERVAL_MS);
  }
}

type FindMatchesInput = {
  eventId: string;
  eventEndsAt: string; // the intent expires with the event
  wantText: string; // what the member is looking for (Home "Your intent")
  // What the member offers, from their profile. Others' WANTs match against
  // it; without one this member can't show up in anyone's matches.
  offerText?: string;
  minMatchPercent: number; // Filters "Minimum match"
};

// Phase 1 matching flow (Docs/Phase 1 API Handoff.md §10-§11):
//   1. Save the member's WANT intent for this event (POST /v1/intents,
//      deterministic intent_id so re-saving updates it). 202 -> poll
//      GET /v1/intents/{id} until MATCH_READY.
//   2. POST /v1/match-requests (request_id omitted: the Idempotency-Key is
//      used). Not COMPLETED -> poll GET /v1/match-requests/{id}.
//   3. Load each matched member's profile for the cards (GET /v1/members/{id});
//      a failed lookup just shows the generic card.
// Throws MatchingError for the cases above, ApiError for anything else.
export async function findMatches({ eventId, eventEndsAt, wantText, offerText, minMatchPercent }: FindMatchesInput): Promise<MatchCard[]> {
  const deadline = Date.now() + MATCH_POLL_TIMEOUT_MS;
  const intentId = intentIdFor(eventId, 'WANT');

  // 0. Offer (best effort): it only affects other members' matches, so a
  // failure here must not stop this member's own matching.
  if (offerText) {
    try {
      await nlpApi.createIntent({
        intent_id: intentIdFor(eventId, 'OFFER'),
        context_id: eventId,
        intent_type: 'OFFER',
        text: offerText,
        expires_at: eventEndsAt,
      });
    } catch (e) {
      console.warn(`Offer intent not saved (${e instanceof ApiError ? e.code : 'error'})`);
    }
  }

  // 1. Intent
  const saved = await nlpApi.createIntent({
    intent_id: intentId,
    context_id: eventId,
    intent_type: 'WANT',
    text: wantText,
    expires_at: eventEndsAt,
  });
  if (saved.contains_pii) throw new MatchingError('INTENT_HAS_PII');
  let status = saved.status;
  if (status !== 'MATCH_READY' && status !== 'FAILED') {
    const intent = await pollUntil(
      () => nlpApi.getIntent(intentId),
      (i) => i.status === 'MATCH_READY' || i.status === 'FAILED',
      deadline
    );
    if (intent.contains_pii) throw new MatchingError('INTENT_HAS_PII');
    status = intent.status;
  }
  if (status === 'FAILED') throw new MatchingError('INTENT_FAILED');
  if (status !== 'MATCH_READY') throw new MatchingError('TIMED_OUT');

  // 2. Match request
  const started = await nlpApi.requestMatches({
    intent_id: intentId,
    context_id: eventId,
    limit: MATCH_LIMIT,
    options: { threshold: minMatchPercent / 100 },
  });
  let matches = started.matches ?? [];
  if (started.status !== 'COMPLETED') {
    if (started.status === 'FAILED') throw new MatchingError('MATCHING_FAILED');
    const result = await pollUntil(
      () => nlpApi.getMatchRequest(started.request_id),
      (r) => r.status === 'COMPLETED' || r.status === 'FAILED',
      deadline
    );
    if (result.status === 'FAILED') {
      console.warn(`Match request failed (${result.error_code ?? 'unknown'}), request_id=${started.request_id}`);
      throw new MatchingError('MATCHING_FAILED');
    }
    if (result.status !== 'COMPLETED') throw new MatchingError('TIMED_OUT');
    matches = result.matches ?? [];
  }

  // 3. Profiles for the cards (best effort, in parallel)
  const sorted = [...matches].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const profiles = await Promise.all(
    sorted.map((m) =>
      coreApi.getMember(m.member_id).catch((e: unknown) => {
        if (e instanceof ApiError) console.warn(`Match profile failed (${e.code}), correlation_id=${e.correlationId ?? 'none'}`);
        return undefined;
      })
    )
  );
  return sorted.map((match, i) => ({ match, profile: profiles[i] }));
}
