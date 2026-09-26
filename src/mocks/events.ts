import type { CoreEvent } from '../api/core';

// Mirrors the events shown in the client's HTML prototype
// (olga_interactive_prototype_mobile_v10.html) so screens have realistic
// content before the backend has real event data to serve. Shaped like
// GET /v1/events; match_count is a client-only demo field.
export const mockEvents: CoreEvent[] = [
  {
    event_id: 'brand-laureate-2026',
    name: 'Brand Laureate 2026',
    starts_at: '2026-11-14T04:00:00Z',
    ends_at: '2026-11-14T12:00:00Z',
    status: 'PUBLISHED',
    live_mode_enabled: true,
    venue: 'Grand Hyatt KL',
    attendee_count: 612,
    live_count: 212,
    match_count: 41,
    is_registered: true,
  },
  {
    event_id: 'mdec-digital-forum',
    name: 'MDEC Digital Forum',
    starts_at: '2026-11-26T04:00:00Z',
    ends_at: '2026-11-26T12:00:00Z',
    status: 'PUBLISHED',
    live_mode_enabled: true,
    venue: 'KLCC',
    attendee_count: 340,
    match_count: 27,
  },
  {
    event_id: 'nasscom-product-conclave',
    name: 'NASSCOM Product Conclave',
    starts_at: '2026-12-08T04:00:00Z',
    ends_at: '2026-12-08T12:00:00Z',
    status: 'PUBLISHED',
    live_mode_enabled: true,
    venue: 'Bengaluru',
    attendee_count: 1100,
    match_count: 88,
  },
];
