import * as Keychain from 'react-native-keychain';
import type { ReportCategory } from '../api/types';
import { keychainService } from '../config/env';

// Chat kept on the phone, per member, in the encrypted keychain: messages
// sent or received over Bluetooth (until Ol-ga has them) and what's needed to
// chat with no internet (who you're connected to and their chat key).

// A message that went over Bluetooth. Its id is the message_id on Ol-ga too,
// so the copy Ol-ga returns later replaces it instead of doubling it.
export type LocalChatMessage = {
  id: string;
  peer: string; // the other member's ID
  from: 'me' | 'them';
  body: string;
  sentAt: string; // ISO, when it was written (client_sent_at on Ol-ga)
  // me: it reached their phone. them: always true.
  delivered: boolean;
  // me: Ol-ga has it. them: their phone saves it to Ol-ga, not us.
  synced: boolean;
  key: string; // Idempotency-Key when it's saved to Ol-ga
};

// Someone this member is connected to (their Commit was accepted, either way).
export type ChatPeer = {
  memberId: string;
  name?: string;
  headline?: string;
  initials?: string;
  conversationId?: string;
  // Their chat key, pinned the first time we saw it. A different key later
  // is never used silently (keyChanged).
  publicKey?: string;
  keyChanged?: boolean;
};

// A report made with no internet. Ol-ga takes it once it has the message
// (the sender's phone saves it when that phone is online).
export type PendingReport = {
  messageId: string;
  category: ReportCategory;
  description?: string;
  key: string;
  createdAt: number;
};

export type ChatSaved = {
  messages: LocalChatMessage[];
  peers: Record<string, ChatPeer>;
  // Blocked on this phone at once; `blockSynced` once Ol-ga has the block too.
  blocked: string[];
  blockSynced: string[];
  reports: PendingReport[];
};

export const EMPTY_CHAT: ChatSaved = { messages: [], peers: {}, blocked: [], blockSynced: [], reports: [] };

const SERVICE = keychainService('olga.chat');
// Keep the newest messages only; Ol-ga has the rest once synced.
const MAX_MESSAGES = 500;

type Stored = Record<string, ChatSaved>;

async function loadAll(): Promise<Stored> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? (JSON.parse(result.password) as Stored) : {};
  } catch {
    return {};
  }
}

export async function loadChat(memberId: string): Promise<ChatSaved> {
  const all = await loadAll();
  return { ...EMPTY_CHAT, ...all[memberId] };
}

// Writes are chained so two quick saves never land out of order.
let chain: Promise<unknown> = Promise.resolve();

function write(change: (all: Stored) => Stored) {
  chain = chain
    .then(async () => {
      const next = change(await loadAll());
      await Keychain.setGenericPassword(SERVICE, JSON.stringify(next), {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    })
    .catch(() => {});
  return chain;
}

export function saveChat(memberId: string, data: ChatSaved) {
  // Unsynced messages are never dropped; the oldest synced ones go first.
  const extra = data.messages.length - MAX_MESSAGES;
  let messages = data.messages;
  if (extra > 0) {
    let drop = extra;
    messages = data.messages.filter((m) => !(drop > 0 && (m.synced || m.from === 'them') && drop-- > 0));
  }
  return write((all) => ({ ...all, [memberId]: { ...data, messages } }));
}

// Account deletion: nothing of this member's chat stays on the phone.
export function clearChat(memberId: string) {
  return write(({ [memberId]: _, ...rest }) => rest);
}
