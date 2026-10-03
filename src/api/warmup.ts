import { CORE_API_URL, NLP_API_URL } from '../config/env';

// The dev Azure containers scale to zero when idle and take ~30-60 s to start
// on the first request. Pinging /health as soon as the app opens wakes them
// while the user is still typing their email or entering the Microsoft code,
// so sign-in doesn't sit on "verifying". Fire-and-forget: errors are ignored.
export function warmUpApis() {
  if (typeof fetch !== 'function') return;
  for (const base of [CORE_API_URL, NLP_API_URL]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    fetch(`${base}/health`, { signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }
}
