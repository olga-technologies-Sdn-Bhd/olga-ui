import { CORE_API_URL, NLP_API_URL } from '../config/env';

// The dev Azure containers scale to zero when idle and can take a minute to
// start on the first request. Pinging /health wakes them while the user is
// still busy: on app open, and again when sign-in starts (the app may have
// been open for hours, long enough for the servers to sleep again), so the
// code arrives while they start. Fire-and-forget: errors are ignored, and a
// ping still in flight is not repeated.
let inFlight = false;

export function warmUpApis() {
  if (typeof fetch !== 'function' || inFlight) return;
  inFlight = true;
  const pings = [CORE_API_URL, NLP_API_URL].map((base) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    return fetch(`${base}/health`, { signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  });
  Promise.all(pings).finally(() => {
    inFlight = false;
  });
}
