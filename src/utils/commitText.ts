import { ApiError } from '../api/client';
import type { CommitWhen } from '../api/types';

// Board 16 wording for a Commit's plan.
export const WHEN_LABELS: Record<CommitWhen, string> = {
  NOW: 'Now',
  IN_10_MIN: 'In 10 min',
  NEXT_BREAK: 'Next break',
  AFTER_SESSION: 'After this session',
};

export const THEIR_CHOICE_LABEL = 'Their choice';

export function whereLabel(where: string) {
  return where === 'THEIR_CHOICE' ? THEIR_CHOICE_LABEL : where;
}

export function planLine(plan: { where: string; when: CommitWhen }) {
  return `${whereLabel(plan.where)} · ${WHEN_LABELS[plan.when] ?? plan.when}`;
}

// "PRODUCT_MANAGEMENT" -> "Product management"
export function roleLabel(code?: string) {
  if (!code) return undefined;
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Time left until a Commit expires with its room: "Expires in 2h 10m".
export function expiresIn(iso: string, now = Date.now()) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (minutes <= 0) return 'Expired';
  if (minutes < 60) return `Expires in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Expires in ${hours}h ${minutes % 60}m`;
  return `Expires in ${Math.floor(hours / 24)} days`;
}

// Every code in the contract's error table, in words. PROFILE_NOT_FOUND is
// deliberately neutral: it can mean they blocked you.
const COMMIT_ERRORS: Record<string, string> = {
  COMMIT_LIMIT_REACHED: "You've used all 5 Commits in this room.",
  COMMIT_ALREADY_SENT: "You've already sent this person a Commit.",
  COMMIT_NOT_PENDING: 'This Commit has already been answered.',
  COMMIT_EXPIRED: 'This Commit expired when the room closed.',
  COMMIT_SENDER_NOT_LIVE: 'Go Live in this room to send a Commit.',
  EVENT_REGISTRATION_REQUIRED: 'You both need to be signed up for this event.',
  EVENT_NOT_FOUND: 'This event is no longer available.',
  MEETING_SPOT_NOT_FOUND: "That spot isn't available any more. Pick another.",
  PLAN_INVALID: 'Pick where and when, then try again.',
  PROFILE_NOT_FOUND: "This person isn't available.",
  CONNECTION_EXISTS: "You're already connected.",
  CONNECTION_NOTE_INVALID: 'Your note is too long.',
  IDEMPOTENCY_KEY_REUSED: 'Something went wrong. Please try again.',
  CONNECTION_REQUEST_NOT_FOUND: 'This Commit is no longer available.',
};

export function commitErrorMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) {
    if (COMMIT_ERRORS[e.code]) return COMMIT_ERRORS[e.code];
    if (e.status === 0) return 'No connection. Check your internet and try again.';
    return `${fallback} (${e.status})`;
  }
  return fallback;
}
