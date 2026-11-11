import type { SavedBusiness } from './business';
import { makeMemberStore } from './memberStore';

// The member's saved Business, kept on this phone (see memberStore). The
// server is asked too, so a reinstall can bring it back.
const store = makeMemberStore<SavedBusiness>('olga.business');

export async function loadBusiness(memberId: string): Promise<SavedBusiness | null> {
  const saved = await store.load(memberId);
  return saved?.venture_id && saved.name ? saved : null;
}

export const saveBusiness = store.save;
