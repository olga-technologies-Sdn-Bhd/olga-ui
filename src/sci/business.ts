import { ApiError } from '../api/client';
import { connectionProblem, GENERIC_PROBLEM } from './problems';

// A member's Business or Project for the Social Capital Index (SCI). The app
// keeps the venture_id it made on the phone, and asks Core for the member's
// businesses too (GET /v1/ventures), so a reinstall can bring it back.

export const BUSINESS_NAME_MAX = 250;

export type SavedBusiness = { venture_id: string; name: string };

// The name as it will be sent: trimmed, 1-250 characters.
export function cleanBusinessName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= BUSINESS_NAME_MAX ? name : null;
}

// The guide doesn't show the list's shape, so a bare array and `{ items: [] }`
// are both read. Anything else is an empty list. Archived ones are skipped.
export function businessesFrom(raw: unknown): SavedBusiness[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  const found: SavedBusiness[] = [];
  for (const row of rows) {
    const r = row as { venture_id?: unknown; name?: unknown; status?: unknown };
    if (typeof r?.venture_id !== 'string' || typeof r.name !== 'string' || !r.venture_id || !r.name) continue;
    if (typeof r.status === 'string' && r.status !== 'ACTIVE') continue;
    found.push({ venture_id: r.venture_id, name: r.name });
  }
  return found;
}

// The one business to show: the one saved on this phone if Core still has it,
// otherwise Core's first. (The pilot has one business per member.)
export function chooseBusiness(saved: SavedBusiness | null, fromCore: SavedBusiness[]): SavedBusiness | null {
  return fromCore.find((b) => b.venture_id === saved?.venture_id) ?? fromCore[0] ?? saved;
}

export type BusinessProblem = {
  message: string;
  // The venture_id is taken by another business: make a new one and ask again.
  newId: boolean;
};

// What to tell the member when saving the business fails. Server messages are
// never repeated to the member.
export function businessProblem(error: unknown): BusinessProblem {
  const plain = (message: string, newId = false) => ({ message, newId });
  if (error instanceof ApiError) {
    if (error.code === 'VENTURE_ID_CONFLICT') return plain('Something went wrong saving that. Please try again.', true);
    if (error.code === 'VENTURE_INVALID' || error.status === 400) return plain('Please check the name and try again.');
  }
  return plain(connectionProblem(error) ?? GENERIC_PROBLEM);
}
