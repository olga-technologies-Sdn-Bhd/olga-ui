import { MATCH_LIMIT, MATCH_POLL_INTERVAL_MS, MATCH_POLL_TIMEOUT_MS } from '../config/env';
import { ApiError } from './client';
import { coreApi } from './core';
import { intentIdFor, MatchCandidate, nlpApi } from './nlp';
import type { Profile, UpsertIntentRequest } from './types';

export type MatchCard = { match: MatchCandidate; profile?: Profile };

// Why matching couldn't produce a list, in terms the screen can show.
export type MatchingFailure =
  | 'INTENT_HAS_PII' // ask the user to remove personal details from the intent
  | 'INTENT_FAILED' // intent couldn't be processed: ask the user to rephrase
  | 'MATCHING_FAILED' // match request FAILED server-side
  | 'TIMED_OUT' // still processing after MATCH_POLL_TIMEOUT_MS
  | 'CONSENT_DENIED'; // the member declined MATCHING consent: don't call NLP

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

// General matching: people worth meeting anywhere, not at one event. The
// NLP API's built-in context; event intents and general ones never match
// each other.
export const GENERAL_CONTEXT = 'GENERAL';
// Go Live > Anywhere shares the general intents for a chosen time (their
// expires_at). The NLP API has no delete, so stopping re-saves them to
// expire in STOP_AFTER_MS.
const DAY_MS = 24 * 60 * 60 * 1000;
export const GENERAL_DURATIONS = [
  { ms: DAY_MS, label: '1 day', short: '1d' },
  { ms: 7 * DAY_MS, label: '1 week', short: '1w' },
  { ms: 30 * DAY_MS, label: '30 days', short: '30d' },
];
const STOP_AFTER_MS = 60 * 1000;

type FindMatchesInput = {
  contextId: string; // the event_id, or GENERAL_CONTEXT
  expiresAt: string; // event intents expire with the event
  wantText: string; // what the member is looking for (Home "Your intent")
  // What the member offers, from their profile. Others' WANTs match against
  // it; without one this member can't show up in anyone's matches.
  offerText?: string;
  minMatchPercent?: number; // Filters "Minimum match"; omitted: the server's default
  // General: don't re-save an intent whose text hasn't changed and that
  // still has over half its time left without outlasting expiresAt (each
  // save is reprocessed, ~20 s on dev).
  keepUnchanged?: boolean;
};

// The last version saved from this phone, per intent, sent as If-Match.
const etags = new Map<string, string>();

// POST /v1/intents. Intent IDs are stable per member/context/type, so a
// second save updates the existing intent, which needs its current version:
// 409 IF_MATCH_REQUIRED, 409 RESOURCE_VERSION_CONFLICT (a stale one, e.g.
// edited on another phone) or 412 -> read it and retry once.
async function saveIntent(body: UpsertIntentRequest) {
  let saved;
  try {
    saved = await nlpApi.createIntent(body, etags.get(body.intent_id));
  } catch (e) {
    const stale = e instanceof ApiError && (e.code === 'IF_MATCH_REQUIRED' || e.code === 'RESOURCE_VERSION_CONFLICT' || e.status === 412);
    if (!stale) throw e;
    const current = await nlpApi.getIntent(body.intent_id);
    saved = await nlpApi.createIntent(body, current.etag);
  }
  if (saved.etag) etags.set(body.intent_id, saved.etag);
  return saved;
}

// The saved intent when keepUnchanged applies, else null. 404: never saved.
async function unchangedIntent(body: UpsertIntentRequest) {
  try {
    const current = await nlpApi.getIntent(body.intent_id);
    if (current.etag) etags.set(body.intent_id, current.etag);
    const now = Date.now();
    const saved = new Date(current.expires_at).getTime();
    const wanted = new Date(body.expires_at).getTime();
    const fits = saved <= wanted + STOP_AFTER_MS && saved - now > (wanted - now) / 2;
    return current.original_text === body.text && current.status === 'MATCH_READY' && fits ? current : null;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'INTENT_NOT_FOUND') return null;
    throw e;
  }
}

async function readGeneral(type: 'WANT' | 'OFFER') {
  try {
    const intent = await nlpApi.getIntent(intentIdFor(GENERAL_CONTEXT, type));
    if (intent.etag) etags.set(intent.intent_id, intent.etag);
    return intent;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'INTENT_NOT_FOUND') return undefined;
    throw e;
  }
}

// The member's general sharing: the WANT text, and until when they're
// shared (null: not shared, or already expired / stopped).
export async function loadGeneralIntents(): Promise<{ want?: string; until: Date | null }> {
  const [want, offer] = await Promise.all([readGeneral('WANT'), readGeneral('OFFER')]);
  const ends = [want, offer].filter(Boolean).map((i) => new Date(i!.expires_at).getTime());
  const until = ends.length ? Math.max(...ends) : 0;
  return { want: want?.original_text, until: until - Date.now() > STOP_AFTER_MS * 2 ? new Date(until) : null };
}

// Stop sharing: the same intents, expiring in a minute (there's no delete).
export async function stopGeneralSharing() {
  const expires_at = new Date(Date.now() + STOP_AFTER_MS).toISOString();
  const current = await Promise.all([readGeneral('WANT'), readGeneral('OFFER')]);
  await Promise.all(
    current
      .filter((i): i is NonNullable<typeof i> => Boolean(i) && new Date(i!.expires_at).getTime() > Date.now() + STOP_AFTER_MS)
      .map((i) => saveIntent({ intent_id: i.intent_id, context_id: GENERAL_CONTEXT, intent_type: i.intent_type, text: i.original_text, expires_at }))
  );
}

// Phase 1 matching flow (Docs/Phase 1 API Handoff.md §10-§11):
//   1. Save the member's WANT intent for the event, or GENERAL (POST /v1/intents,
//      deterministic intent_id so re-saving updates it). 202 -> poll
//      GET /v1/intents/{id} until MATCH_READY.
//   2. POST /v1/match-requests (request_id omitted: the Idempotency-Key is
//      used). Not COMPLETED -> poll GET /v1/match-requests/{id}.
//   3. Load each matched member's profile for the cards (GET /v1/members/{id});
//      a failed lookup just shows the generic card.
// Throws MatchingError for the cases above, ApiError for anything else.
export async function findMatches({ contextId, expiresAt, wantText, offerText, minMatchPercent, keepUnchanged }: FindMatchesInput): Promise<MatchCard[]> {
  const deadline = Date.now() + MATCH_POLL_TIMEOUT_MS;
  const intentId = intentIdFor(contextId, 'WANT');
  const save = async (body: UpsertIntentRequest) => (keepUnchanged && (await unchangedIntent(body))) || saveIntent(body);

  // 0. Offer (best effort): it only affects other members' matches, so a
  // failure here must not stop this member's own matching.
  if (offerText) {
    try {
      await save({
        intent_id: intentIdFor(contextId, 'OFFER'),
        context_id: contextId,
        intent_type: 'OFFER',
        text: offerText,
        expires_at: expiresAt,
      });
    } catch (e) {
      console.warn(`Offer intent not saved (${e instanceof ApiError ? e.code : 'error'})`);
    }
  }

  // 1. Intent
  const saved = await save({
    intent_id: intentId,
    context_id: contextId,
    intent_type: 'WANT',
    text: wantText,
    expires_at: expiresAt,
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
    context_id: contextId,
    limit: MATCH_LIMIT,
    ...(minMatchPercent === undefined ? {} : { options: { threshold: minMatchPercent / 100 } }),
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
