const STOPWORDS = new Set(['of', 'the', 'a', 'an', 'in', 'at', 'for', 'and']);

// Matches the prototype's two-letter avatar initials (e.g. "Head of Channel
// Partnerships" -> "HC"): first letters of the first two significant words.
export function getInitials(text: string): string {
  const words = text
    .replace(/[,.]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
