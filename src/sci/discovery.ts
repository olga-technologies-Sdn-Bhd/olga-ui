import { ApiError } from '../api/client';
import { connectionProblem, GENERIC_PROBLEM } from './problems';

// Who may find this member by phone or email. Off by default. The ETag from the
// read goes back in If-Match. When someone else (another device) changed it
// first, the server says so (409 or 412): show the latest value.
export function discoveryProblem(error: unknown): { message: string; stale: boolean } {
  if (error instanceof ApiError && (error.status === 409 || error.status === 412)) {
    return { message: 'This was changed somewhere else. Showing the latest.', stale: true };
  }
  return { message: connectionProblem(error) ?? GENERIC_PROBLEM, stale: false };
}
