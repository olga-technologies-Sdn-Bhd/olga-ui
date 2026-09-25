import type { MatchCandidate } from '../api/nlp';
import type { Profile } from '../api/types';

// Mirrors the Live Matches cards in the client's HTML prototype
// (olga_interactive_prototype_mobile_v10.html). Shaped like the
// POST /v1/match-requests `matches` array.
export const mockMatches: MatchCandidate[] = [
  {
    member_id: 'm1',
    score: 0.94,
    label: 'STRONG_MATCH',
    reason_codes: [],
    reason_text: 'Looking for a telco distribution partner. Strong fit with your current intent.',
    rank: 1,
  },
  {
    member_id: 'm2',
    score: 0.88,
    label: 'STRONG_MATCH',
    reason_codes: [],
    reason_text: "Hiring annotation staff at volume. You match each other's stated needs.",
    rank: 2,
  },
  {
    member_id: 'm3',
    score: 0.81,
    label: 'PLAUSIBLE_MATCH',
    reason_codes: [],
    reason_text: 'Writes first cheques at your stage and is looking for founders here.',
    rank: 3,
  },
];

// Mirrors the "Who's Going" blinded attendee list in the prototype — a
// wider preview list than the live-matches set above.
export const mockWhosGoing: MatchCandidate[] = [
  ...mockMatches,
  { member_id: 'm4', score: 0.78, label: 'PLAUSIBLE_MATCH', reason_codes: [], reason_text: '', rank: 4 },
  { member_id: 'm5', score: 0.75, label: 'PLAUSIBLE_MATCH', reason_codes: [], reason_text: '', rank: 5 },
];

// GET /v1/members/{memberId} for the members above. The prototype's
// "Industry · N yrs" subtitle has no dedicated backend field yet, so it
// lives in role_category for now.
function member(member_id: string, headline: string, role_category: string): Profile {
  return {
    member_id,
    display_name: 'Attendee',
    headline,
    role_category,
    profile_status: 'ACTIVE',
    visibility: 'MEMBERS',
    completeness_score: 100,
    etag: '"1"',
    updated_at: '2026-09-26T00:00:00Z',
  };
}

export const mockMembers: Record<string, Profile> = {
  m1: member('m1', 'Head of Channel Partnerships', 'Telecommunications · 14 yrs'),
  m2: member('m2', 'Director, Industry Engagement', 'TVET · 9 yrs'),
  m3: member('m3', 'Principal, Ventures', 'Sovereign fund · 7 yrs'),
  m4: member('m4', 'GM, Enterprise Solutions', 'Telco · 11 yrs'),
  m5: member('m5', 'Head of Digital Skills', 'Government agency · 6 yrs'),
};
