import { ApiError } from '../api/client';
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
  return `I'd like to connect with you on Ol-ga. Open this link to accept: ${url}`;
}
