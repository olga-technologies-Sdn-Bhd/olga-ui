import { ApiError } from '../api/client';

// A member's Business or Project for the Social Capital Index (SCI). The pilot
// API has no list or detail call, so the app keeps the venture_id it made.

export const BUSINESS_NAME_MAX = 250;

export type SavedBusiness = { venture_id: string; name: string };

// The name as it will be sent: trimmed, 1-250 characters.
export function cleanBusinessName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= BUSINESS_NAME_MAX ? name : null;
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
  if (!(error instanceof ApiError)) return plain('Something went wrong. Please try again.');
  if (error.code === 'VENTURE_ID_CONFLICT') return plain('Something went wrong saving that. Please try again.', true);
  if (error.code === 'VENTURE_INVALID' || error.status === 400) return plain('Please check the name and try again.');
  if (error.status === 429) return plain('Too many tries. Please wait a little and try again.');
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return plain("Couldn't reach Ol-ga. Check your connection and try again.");
  }
  return plain('Something went wrong. Please try again.');
}
