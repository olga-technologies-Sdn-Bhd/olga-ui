import { environment } from '../config/environments/selected';
import type { Environment } from '../config/environments/types';

// Invitation links. The token is a secret (64 hex characters): never log it,
// never put it in analytics, and hold it in memory only.
//   <inviteLinkBase>/i#<token>          shared links (https, tappable in any app;
//                                       the token is in the fragment, so it
//                                       never reaches a server)
//   <linkScheme>://invitations/<token>  when no host is set, and from the
//                                       fallback page's "Open in Ol-ga" button

const TOKEN = /^[0-9a-fA-F]{64}$/;

export function isInviteToken(value: string): boolean {
  return TOKEN.test(value);
}

type LinkEnv = Pick<Environment, 'linkScheme' | 'inviteLinkBase'>;

export function inviteUrl(token: string, env: LinkEnv = environment): string {
  return env.inviteLinkBase ? `${env.inviteLinkBase}/i#${token}` : `${env.linkScheme}://invitations/${token}`;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function inviteTokenFromLink(url: string | null | undefined, env: LinkEnv = environment): string | null {
  if (!url) return null;
  const prefixes = [`${env.linkScheme}://invitations/`];
  if (env.inviteLinkBase) prefixes.push(`${env.inviteLinkBase}/i#`, `${env.inviteLinkBase}/i/#`, `${env.inviteLinkBase}/invitations/`);
  for (const prefix of prefixes) {
    const match = new RegExp(`^${escape(prefix)}([0-9a-fA-F]{64})/?(?:[?#].*)?$`).exec(url.trim());
    if (match) return match[1];
  }
  return null;
}
