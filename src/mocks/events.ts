import type { CoreEvent } from '../api/core';

// Mirrors the events shown in the client's HTML prototype
// (olga_interactive_prototype_mobile_v10.html) so screens have realistic
// content before the backend has real event data to serve.
export const mockEvents: CoreEvent[] = [
  {
    eventId: 'brand-laureate-2026',
    name: 'Brand Laureate 2026',
    venue: 'Grand Hyatt KL',
    startsAt: '14 Nov',
    attendeeCount: 612,
    liveCount: 212,
    matchCount: 41,
  },
  {
    eventId: 'mdec-digital-forum',
    name: 'MDEC Digital Forum',
    venue: 'KLCC',
    attendeeCount: 340,
    matchCount: 27,
  },
  {
    eventId: 'nasscom-product-conclave',
    name: 'NASSCOM Product Conclave',
    venue: 'Bengaluru',
    attendeeCount: 1100,
    matchCount: 88,
  },
];
