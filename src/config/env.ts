// Backend base URLs. Both Olga.Core and olga-nlp-api currently run with no
// authentication (deliberate MVP scope decision) — no token/header required.
//
// Defaults to the live Azure dev environment so the app works over any
// network without local setup. To hit a locally running backend instead, set
// API_TARGET to 'local' and point LOCAL_HOST at your machine:
//   - Android emulator: '10.0.2.2' (the emulator's alias for the host).
//   - Physical Android device over USB: run
//       adb reverse tcp:5000 tcp:5000 && adb reverse tcp:5080 tcp:5080
//     and use 'localhost'.
//   - iOS simulator: 'localhost'.
// Local ports: Olga.Core `dotnet run --project src/Olga.Core.Api` → 5000,
// olga-nlp-api launch profile → 5080. Android blocks cleartext HTTP in release
// builds; debug builds allow it.
type ApiTarget = 'dev' | 'local';
const API_TARGET: ApiTarget = 'dev';
const LOCAL_HOST = '10.0.2.2';

const API_URLS: Record<ApiTarget, { core: string; nlp: string }> = {
  dev: {
    core: 'https://ca-olga-core-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
    nlp: 'https://ca-olga-nlp-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
  },
  local: {
    core: `http://${LOCAL_HOST}:5000`,
    nlp: `http://${LOCAL_HOST}:5080`,
  },
};

export const CORE_API_URL = API_URLS[API_TARGET].core;

export const NLP_API_URL = API_URLS[API_TARGET].nlp;

// TODO(backend): confirm the active LIVE_MODE consent policy_version on dev
// before release. Local seed is "1"; the dev DB test seed was "test-v1", and
// what dev actually runs is unconfirmed. A wrong value fails POST
// /v1/me/consents with 409 CONSENT_POLICY_NOT_ACTIVE.
export const LIVE_MODE_CONSENT_POLICY_VERSION = '1';


// Mock switches per area. While one is true, that area's calls in api/core.ts
// or api/nlp.ts return canned data from src/mocks/ instead of the backend.
// Who's going always uses mocks: Olga.Core has no attendee list endpoint.
export const USE_MOCK_EVENTS = false;

export const USE_MOCK_LIVE = false; // consent, start/stop, presence
export const USE_MOCK_MATCHING = false; // intents, match requests, match profiles

// Timeout for NLP calls (cold starts can take ~50 s); same as the client default.
export const NLP_TIMEOUT_MS = 60000;
// Match request polling (202 -> GET until COMPLETED/FAILED): every 1-2 s.
export const MATCH_POLL_INTERVAL_MS = 1500;
export const MATCH_POLL_TIMEOUT_MS = 45000;
export const MATCH_LIMIT = 7; // server allows 3-7

// Requested Live Mode length; the server allows 5-240 and caps it at the
// event's end. Tapping Go Live again while live extends the same session.
export const LIVE_MODE_DURATION_MINUTES = 60;

// Presence heartbeat while live. observed_at must be within ±10 min of
// server time, so stay well under that.
export const PRESENCE_INTERVAL_MS = 4 * 60 * 1000;

// TODO(backend): coarse venue zones don't exist yet, so every heartbeat
// reports one zone per event. Never send raw GPS here.
export const PRESENCE_DEFAULT_CELL = 'venue';
