// App environment. Change APP_ENV to switch every backend the app talks to:
//   'local' - Olga.Core / olga-nlp-api running on your machine (local DB).
//   'dev'   - the shared Azure dev deployment (default).
//   'prod'  - production. Not deployed yet: selecting it fails fast until the
//             URLs below (and the prod Entra settings) are filled in.
// Commit it as 'dev'. Sign-in (Entra) settings per environment live in
// src/auth/entraConfig.ts.
export type AppEnv = 'local' | 'dev' | 'prod';
export const APP_ENV: AppEnv = 'dev';

// 'local' only. Physical Android phone over USB: 'localhost' plus
//   adb reverse tcp:5000 tcp:5000 && adb reverse tcp:5080 tcp:5080
// Android emulator: '10.0.2.2' (the emulator's alias for your machine).
// Ports: Olga.Core `dotnet run --project src/Olga.Core.Api` -> 5000,
// olga-nlp-api launch profile -> 5080. Debug builds allow plain http.
const LOCAL_HOST = 'localhost';

const API_URLS: Record<AppEnv, { core: string; nlp: string }> = {
  local: {
    core: `http://${LOCAL_HOST}:5000`,
    nlp: `http://${LOCAL_HOST}:5080`,
  },
  dev: {
    core: 'https://ca-olga-core-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
    nlp: 'https://ca-olga-nlp-api-dev.agreeableocean-8bb4ca77.malaysiawest.azurecontainerapps.io',
  },
  // TODO(infra): fill in once prod is deployed (Olga.Infrastructure, prd).
  prod: {
    core: '',
    nlp: '',
  },
};

if (!API_URLS[APP_ENV].core || !API_URLS[APP_ENV].nlp) {
  throw new Error(`No API URLs configured for APP_ENV '${APP_ENV}' (src/config/env.ts)`);
}

// Both Olga.Core and olga-nlp-api run without authentication for the MVP
// (deliberate scope decision); calls carry X-Member-Id, not a token.
export const CORE_API_URL = API_URLS[APP_ENV].core;

export const NLP_API_URL = API_URLS[APP_ENV].nlp;




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
