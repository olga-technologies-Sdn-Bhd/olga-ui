import type { MatchCandidate } from '../api/nlp';

// Mirrors the Live Matches cards in the client's HTML prototype
// (olga_interactive_prototype_mobile_v10.html).
export const mockMatches: MatchCandidate[] = [
  {
    memberId: 'm1',
    headline: 'Head of Channel Partnerships',
    subheadline: 'Telecommunications · 14 yrs',
    matchScore: 94,
    rationale: 'Looking for a telco distribution partner. Strong fit with your current intent.',
  },
  {
    memberId: 'm2',
    headline: 'Director, Industry Engagement',
    subheadline: 'TVET · 9 yrs',
    matchScore: 88,
    rationale: "Hiring annotation staff at volume. You match each other's stated needs.",
  },
  {
    memberId: 'm3',
    headline: 'Principal, Ventures',
    subheadline: 'Sovereign fund · 7 yrs',
    matchScore: 81,
    rationale: 'Writes first cheques at your stage and is looking for founders here.',
  },
];

// Mirrors the "Who's Going" blinded attendee list in the prototype — a
// wider preview list than the live-matches set above.
export const mockWhosGoing: MatchCandidate[] = [
  ...mockMatches,
  { memberId: 'm4', headline: 'GM, Enterprise Solutions', subheadline: 'Telco · 11 yrs', matchScore: 78 },
  { memberId: 'm5', headline: 'Head of Digital Skills', subheadline: 'Government agency · 6 yrs', matchScore: 75 },
];
