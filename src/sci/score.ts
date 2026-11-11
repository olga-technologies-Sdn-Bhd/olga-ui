import type { SciContact } from '../api/types';

// The score is the server's, shown as a rounded whole number with its band.
// Nothing is recalculated here. The bands are from the guide: Emerging 10-24,
// Relevant 25-49, Strong 50-74, Exact 75-100. Below 10 has no band yet.
export function displayScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export type Band = 'Emerging' | 'Relevant' | 'Strong' | 'Exact';

// Uses the rounded number, so the band always matches what is on screen.
export function scoreBand(score: number): Band | null {
  const s = displayScore(score);
  if (s >= 75) return 'Exact';
  if (s >= 50) return 'Strong';
  if (s >= 25) return 'Relevant';
  if (s >= 10) return 'Emerging';
  return null;
}

// "CLIENT" -> "Client", "KEY_SUPPLIER" -> "Key supplier".
export function roleLabel(role: string): string {
  const words = role.trim().toLowerCase().replace(/_+/g, ' ');
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

// A page that follows: new people go on the end, people already shown are
// updated where they are. Cursors may repeat a row, so this never doubles one.
export function appendPage(existing: SciContact[], page: SciContact[]): SciContact[] {
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
// who isn't on it stays below. Scores are never dropped while they update.
export function refreshFirstPage(existing: SciContact[], firstPage: SciContact[]): SciContact[] {
  const ids = new Set(firstPage.map((c) => c.link_id));
  return appendPage(firstPage, existing.filter((c) => !ids.has(c.link_id)));
}

// Scoring is done when there is something to show and nothing is updating.
export function scoringSettled(items: SciContact[]): boolean {
  return items.length > 0 && items.every((c) => !c.is_stale);
}
