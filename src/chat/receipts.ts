import { ApiError, newIdempotencyKey } from '../api/client';
import { coreApi } from '../api/core';

// "Delivered" for the sender's ticks: one receipt for the newest of their
// messages is enough (Core counts everything at or below it). Each receipt
// keeps its Idempotency-Key until it goes through, so a retry is the same
// operation; once saved it isn't sent again.
const keys = new Map<string, string>();
const done = new Set<string>();
const MAX_DONE = 500;

export async function markDelivered(messageId: string) {
  if (done.has(messageId)) return;
  let key = keys.get(messageId);
  if (!key) {
    key = newIdempotencyKey();
    keys.set(messageId, key);
  }
  try {
    await coreApi.saveReceipt(messageId, { delivered_at: new Date().toISOString() }, { idempotencyKey: key });
  } catch (e) {
    // No answer: try again next time with the same key. Anything else
    // (deleted, my own message, key reused) won't get better.
    if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) return;
  }
  keys.delete(messageId);
  done.add(messageId);
  if (done.size > MAX_DONE) done.delete(done.values().next().value as string);
}
