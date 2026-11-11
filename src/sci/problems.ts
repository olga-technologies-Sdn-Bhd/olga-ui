import { ApiError } from '../api/client';

// Plain-words messages for the problems every Social Capital Index call can
// have. Server messages are never repeated to the member. Returns null when the
// error is something the caller should word itself.
export function connectionProblem(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 429) return 'Too many tries. Please wait a little and try again.';
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return "Couldn't reach Ol-ga. Check your connection and try again.";
  }
  return null;
}

export const GENERIC_PROBLEM = 'Something went wrong. Please try again.';

// Only the code and correlation id may be logged: never names, contacts,
// invitation tokens or request bodies.
export function safeLogLine(what: string, error: unknown): string | null {
  return error instanceof ApiError ? `${what} failed (${error.code}), correlation_id=${error.correlationId ?? 'none'}` : null;
}
