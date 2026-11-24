import type { SciContact, SciLifecycle, SciReachOut, SciSummary } from '../api/types';

// Scores, bands, lifecycle states and counts are the server's, shown as sent.
// Nothing here works out a score or a band; it only words what the server says.

// Whole number, 0-100. null when the server sent no score.
export function displayScore(score: number | null | undefined): number | null {
  return typeof score === 'number' && Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null;
}

// The server's band: REPOSITORY (under 10), WAITLIST (10-29), NETWORK (30+).
const BAND_LABEL: Record<string, string> = { REPOSITORY: 'Repository', WAITLIST: 'Waitlist', NETWORK: 'Network' };
export const bandLabel = (band: string): string | null => BAND_LABEL[band] ?? null;

const LIFECYCLE_LABEL: Record<string, string> = {
  ESTIMATED: 'Estimated',
  INVITED: 'Invited',
  JOINED: 'Joined',
  REQUEST_PENDING: 'Request pending',
  CONNECTED: 'Connected',
  REMOVED: 'Removed',
};
export const lifecycleLabel = (state: SciLifecycle): string => LIFECYCLE_LABEL[state] ?? humanize(state);

// "KEY_SUPPLIER" -> "Key supplier".
export function humanize(code: string): string {
  const words = code.trim().toLowerCase().replace(/_+/g, ' ');
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

// Removed and blocked people may stay as frozen history, but are not active.
export const isHistory = (c: Pick<SciContact, 'lifecycle_state' | 'frozen_at'>): boolean =>
  c.lifecycle_state === 'REMOVED' || !!c.frozen_at;

// Counts as big numbers with separators; never capped (1742 shows as 1,742).
export const formatCount = (n: number): string => n.toLocaleString('en-US');

// Scores are up to date when the server says READY; anything else means they
// are being recalculated and the last numbers stay on screen.
export const isRecalculating = (summary: Pick<SciSummary, 'projection_status'> | null | undefined): boolean =>
  !!summary && summary.projection_status !== 'READY';

// Safe to read from a server answer of any shape (an older or newer server must
// never crash a screen): a count that is not a number is treated as unknown.
export function countOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// A page that follows: new people go on the end, people already shown are
// updated where they are. Cursors may repeat a row, so this never doubles one.
export function appendPage<T extends { link_id: string }>(existing: T[], page: T[]): T[] {
  const next = [...existing];
  const at = new Map(next.map((c, i) => [c.link_id, i]));
  for (const c of page) {
    const i = at.get(c.link_id);
    if (i === undefined) {
      at.set(c.link_id, next.length);
      next.push(c);
    } else {
      next[i] = c;
    }
  }
  return next;
}

// A fresh first page (a refresh): it leads, and anyone loaded from later pages
// who isn't on it stays below.
export function refreshFirstPage<T extends { link_id: string }>(existing: T[], firstPage: T[]): T[] {
  const ids = new Set(firstPage.map((c) => c.link_id));
  return appendPage(firstPage, existing.filter((c) => !ids.has(c.link_id)));
}

// Reach-out items name only a link_id; the name comes from the contact list.
export function reachOutName(item: Pick<SciReachOut, 'link_id'>, contacts: SciContact[]): string {
  return contacts.find((c) => c.link_id === item.link_id)?.label ?? 'Someone you know';
}
