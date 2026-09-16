// Backend base URLs. Both Olga.Core and olga-nlp-api currently run with no
// authentication (deliberate MVP scope decision) — no token/header required.
//
// Defaults to the live Azure dev environment so the app works over any
// network without local setup. For local backend development instead:
//   - Android emulator: http://10.0.2.2:<port>
//   - Physical device over USB: use `adb reverse tcp:<port> tcp:<port>` and
//     http://localhost:<port>, or your machine's LAN IP if on the same Wi-Fi.
export const CORE_API_URL =
  'https://ca-olga-core-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io';

export const NLP_API_URL =
  'https://ca-olga-nlp-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io';

// Single switch for prototype/demo data. While true, api/core.ts and
// api/nlp.ts return the mock data in src/mocks/ instead of calling the real
// backend — lets screens show realistic content before endpoints are ready
// or verified. Flip to false (or delete the mock branches + src/mocks/) once
// the real APIs are confirmed working end to end.
export const USE_MOCK_DATA = true;
