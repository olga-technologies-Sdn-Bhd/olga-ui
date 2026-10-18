import { Linking } from 'react-native';
import { environment } from '../config/environments/selected';

// Event links from partner QR codes and shares (EVT-03):
//   <linkScheme>://event/<eventId>   e.g. olgaapp://event/evt_123
// They can arrive before sign-in (the link opened the app); the newest one is
// held until the signed-in app registers an opener, then opened once.

const PATTERN = new RegExp(`^${environment.linkScheme}://event/([A-Za-z0-9_-]{1,64})/?(?:[?#].*)?$`);

export function eventIdFromLink(url: string | null | undefined): string | null {
  const match = url ? PATTERN.exec(url.trim()) : null;
  return match ? match[1] : null;
}

let pending: string | null = null;
let opener: ((eventId: string) => void) | null = null;

function flush() {
  if (pending && opener) {
    const eventId = pending;
    pending = null;
    opener(eventId);
  }
}

function capture(url: string | null | undefined) {
  const eventId = eventIdFromLink(url);
  if (!eventId) return;
  pending = eventId;
  flush();
}

let started = false;

// Once, at app start: the link that launched the app, and any opened later.
export function startEventLinks() {
  if (started) return;
  started = true;
  Linking.getInitialURL()
    .then(capture)
    .catch(() => {});
  Linking.addEventListener('url', ({ url }) => capture(url));
}

// The signed-in app says how to open an event (null when it goes away).
export function setEventOpener(open: ((eventId: string) => void) | null) {
  opener = open;
  flush();
}
