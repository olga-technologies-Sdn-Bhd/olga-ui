// App environment: which backends and sign-in tenant this build talks to.
//   'dev'   - the shared Azure dev deployment (default).
//   'prod'  - production.
//   'local' - Olga.Core / olga-nlp-api running on your machine (local DB).
// It is chosen when the app is bundled, by the OLGA_ENV variable (see
// src/config/environments/selected.ts and the README), not by editing code.
// The values live in src/config/environments/<name>.ts.
import { environment } from './environments/selected';
import type { AppEnv } from './environments/types';

export type { AppEnv };
export const APP_ENV: AppEnv = environment.name;

// The team's own tools (the Bluetooth panel, the Environment row, the logo's
// long-press): dev and local builds only. Listed, not "not prod", so any
// environment added later hides them too.
export const TEAM_TOOLS = APP_ENV === 'dev' || APP_ENV === 'local';

// Fail closed: a build with a missing or malformed value must not start, and
// must never fall back to another environment's value.
function requireUrl(name: string, value: string) {
  const scheme = APP_ENV === 'local' ? /^https?:\/\// : /^https:\/\//;
  if (!value || !scheme.test(value) || value.endsWith('/')) {
    throw new Error(`${name} is missing or invalid for APP_ENV '${APP_ENV}' (src/config/environments/${APP_ENV}.ts)`);
  }
  return value;
}

// A release build is never allowed to point at a developer's machine.
if (APP_ENV === 'local' && !__DEV__) {
  throw new Error("APP_ENV 'local' can't be used in a release build");
}

// Both Olga.Core and olga-nlp-api run without authentication for the MVP
// (deliberate scope decision); calls carry X-Member-Id, not a token.
export const CORE_API_URL = requireUrl('Core API URL', environment.coreApiUrl);

// Chat has no real-time channel yet, so it polls while the screen is focused.
export const CHAT_MESSAGE_POLL_MS = 4000;
// Sent when registering this phone; keep in step with versionName
// (android/app/build.gradle) and CFBundleShortVersionString (iOS).
export const APP_VERSION = '1.0';
export const CHAT_INBOX_POLL_MS = 15000;


export const NLP_API_URL = requireUrl('NLP API URL', environment.nlpApiUrl);

// Keychain entries are kept per environment, so tokens and member IDs from
// one environment are never read by a build for another.
export const keychainService = (name: string) => `${name}.${APP_ENV}`;

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
