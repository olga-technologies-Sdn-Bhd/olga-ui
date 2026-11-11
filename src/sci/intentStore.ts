import type { SavedIntentSet } from './intents';
import { makeMemberStore } from './memberStore';

// The last OFFER/WANT the member sent, kept on this phone. The API cannot read
// a set back (only single intents), so this is how the text and progress come
// back when the screen is opened again.
const store = makeMemberStore<SavedIntentSet>('olga.business.intents');

export async function loadIntentSet(memberId: string, ventureId: string): Promise<SavedIntentSet | null> {
  const saved = await store.load(memberId);
  return saved?.venture_id === ventureId ? saved : null;
}

export const saveIntentSet = store.save;
