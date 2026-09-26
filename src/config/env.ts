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

// Single switch for prototype/demo data. While true, api/core.ts and
// api/nlp.ts return the mock data in src/mocks/ instead of calling the real
// backend — lets screens show realistic content before endpoints are ready
// or verified. Flip to false (or delete the mock branches + src/mocks/) once
// the real APIs are confirmed working end to end.
export const USE_MOCK_DATA = true;
