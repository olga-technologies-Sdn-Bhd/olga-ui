import { ApiError } from '../api/client';
import { coreApi } from '../api/core';
import type { ImportedContact, ImportedContactPage, InvitationStatus } from '../api/types';
import { connectionProblem, GENERIC_PROBLEM } from './problems';

export type InviteProblem = {
  message: string;
  // This attempt cannot be repeated as it is: start over with new IDs.
  restart: boolean;
};

// Importing the people and creating their invitations. Server messages are
// never repeated to the member.
export function inviteProblem(error: unknown): InviteProblem {
  const plain = (message: string, restart = false) => ({ message, restart });
  if (error instanceof ApiError) {
    if (error.status === 413) return plain('That is too many people at once. Pick fewer and try again.');
    if (error.status === 409) return plain('Something went wrong sending that. Please try again.', true);
    if (error.status === 400 || error.status === 404) return plain("Some of the people you picked can't be invited. Try different ones.", true);
    if (error.status === 403) return plain("You can't invite people for this business.");
  }
  return plain(connectionProblem(error) ?? GENERIC_PROBLEM);
}

export type AcceptProblem = {
  message: string;
  // No point trying again with this link.
  final: boolean;
};

export function acceptProblem(error: unknown): AcceptProblem {
  const result = (message: string, final = false) => ({ message, final });
  if (error instanceof ApiError) {
    if (error.code === 'INVITATION_SELF_ACCEPT_INVALID') return result("You can't accept an invitation you sent yourself.", true);
    if (error.code === 'INVITATION_TOKEN_INVALID' || error.code === 'INVITATION_NOT_FOUND' || error.status === 404) {
      return result("This invitation isn't valid any more. Ask the person who sent it for a new one.", true);
    }
    if (error.status === 403) return result("This invitation isn't for you.", true);
  }
  return result(connectionProblem(error) ?? GENERIC_PROBLEM);
}

// What goes with the link when it is shared.
export function inviteMessage(url: string): string {
  return (
    `I'd like to connect with you on Ol-ga. Open this link to accept: ${url}

` +
    "If the link doesn't open, install Ol-ga and sign in with this email or phone number. Your invitation will be waiting."
  );
}

// How an invitation's state reads to the member who sent it.
export const INVITE_STATUS_LABEL: Record<InvitationStatus, string> = {
  APPROVED: 'Sent',
  OPENED: 'Opened',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  REVOKED: 'Withdrawn',
};

// Accepted or withdrawn invitations can't be sent again (409 INVITATION_NOT_RESENDABLE).
export const canResend = (status: InvitationStatus | null | undefined) =>
  status === 'APPROVED' || status === 'OPENED' || status === 'EXPIRED';

export function resendProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVITATION_NOT_RESENDABLE' || error.status === 409) return "This invitation can't be sent again.";
    if (error.status === 404) return "This invitation isn't there any more.";
  }
  return connectionProblem(error) ?? GENERIC_PROBLEM;
}

// Opening a link before Accept. null: couldn't tell (no connection), so the
// member can still try to accept.
export function openProblem(error: unknown): string | null {
  if (error instanceof ApiError && (error.status === 404 || error.code === 'INVITATION_TOKEN_INVALID' || error.code === 'INVITATION_NOT_FOUND')) {
    return "This invitation isn't valid any more. Ask the person who sent it for a new one.";
  }
  return null;
}

export const EXPIRED_INVITATION = 'This invitation has expired. Ask the person who sent it for a new one.';

// Everyone this member has invited (people imported but never invited are
// left out), newest first. A few pages at most: a batch holds 20 people.
export async function loadInvitedContacts(maxPages = 5): Promise<ImportedContact[]> {
  const people: ImportedContact[] = [];
  const seen = new Set<string>();
  let cursor: string | null | undefined = null;
  for (let page = 0; page < maxPages; page++) {
    const result: ImportedContactPage = await coreApi.listImportedContacts(cursor);
    for (const c of result.items) {
      if (!c.invitation_id || seen.has(c.link_id)) continue;
      seen.add(c.link_id);
      people.push(c);
    }
    cursor = result.next_cursor;
    if (!cursor) break;
  }
  return people;
}
