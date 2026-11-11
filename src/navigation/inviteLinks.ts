import { Linking } from 'react-native';
import { inviteTokenFromLink } from '../sci/inviteLink';

// Invitation links: the app can be opened by one before anyone is signed in.
// The token is held in memory only (never in navigation state, storage or
// logs) until the signed-in app registers an opener; the Accept screen then
// reads it. It is cleared once accepted or found to be no good.

let pending: string | null = null;
let opener: (() => void) | null = null;

function flush() {
  if (pending && opener) opener();
}

function capture(url: string | null | undefined) {
  const token = inviteTokenFromLink(url);
  if (!token) return;
  pending = token;
  flush();
}

let started = false;

// Once, at app start: the link that launched the app, and any opened later.
export function startInviteLinks() {
  if (started) return;
  started = true;
  Linking.getInitialURL()
    .then(capture)
    .catch(() => {});
  Linking.addEventListener('url', ({ url }) => capture(url));
}

export function heldInviteToken(): string | null {
  return pending;
}

export function clearInviteToken() {
  pending = null;
}

// The signed-in app says how to show the Accept screen (null when it goes away).
export function setInviteOpener(open: (() => void) | null) {
  opener = open;
  flush();
}
