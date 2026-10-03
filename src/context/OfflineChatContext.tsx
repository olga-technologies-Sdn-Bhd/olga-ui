import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, newIdempotencyKey } from '../api/client';
import { coreApi } from '../api/core';
import { showLocalNotification } from '../bluetooth/bleDiscovery';
import { ChatKeyPair, loadKeyPair, open, pairKey, seal } from '../chat/crypto';
import type { ReportCategory } from '../api/types';
import { ChatPeer, ChatSaved, EMPTY_CHAT, loadChat, LocalChatMessage, saveChat } from '../chat/store';
import { isOffensive } from '../chat/moderation';
import { pastelFor } from '../components/GoLiveRadar';
import { getInitials } from '../utils/initials';
import { useAuth } from './AuthContext';
import { useNearby } from './NearbyContext';

// Chat between connected members (a Commit accepted, either way) that also
// works with no internet: text goes phone to phone over Bluetooth, encrypted
// for the pair, while Nearby is on and the two are close. Each phone saves
// its own sent messages to Ol-ga Chat once it's online (same message_id and
// send time), so both end up with one history.

const TICK_MS = 4000; // deliver waiting messages to phones in range
const SYNC_MS = 30000; // save sent messages to Ol-ga while online
const PEERS_MS = 60000; // refresh who you're connected to
export const MAX_NEARBY_BODY = 1000; // Bluetooth is slow; keep messages short

// What phones write to each other's inbox for chat (beside Nearby's own).
type ChatWire = { v: 1; t: 'chat'; id: string; from: string; to: string; at: string; n: string; c: string };

function parseWire(text: string): ChatWire | null {
  try {
    const m = JSON.parse(text);
    const strings = ['id', 'from', 'to', 'at', 'n', 'c'].every((k) => typeof m?.[k] === 'string');
    return m?.v === 1 && m.t === 'chat' && strings ? (m as ChatWire) : null;
  } catch {
    return null;
  }
}

// Can a message reach this member over Bluetooth right now?
// ready: in range, with their key. Otherwise it waits on the phone.
export type NearbyReach = 'ready' | 'out-of-range' | 'nearby-off' | 'no-key' | 'key-changed';

type OfflineChatState = {
  peers: ChatPeer[];
  peerFor: (memberId: string) => ChatPeer | undefined;
  peerForConversation: (conversationId: string) => ChatPeer | undefined;
  messagesWith: (memberId: string) => LocalChatMessage[];
  reach: (memberId: string) => NearbyReach;
  // Saves the message on the phone and sends it over Bluetooth when it can.
  // Pass id/key/sentAt to keep a message that failed online the same one.
  sendNearby: (memberId: string, body: string, same?: { id: string; key: string; sentAt: string }) => LocalChatMessage | null;
  // The conversation on screen: no notification for it.
  setActivePeer: (memberId: string | null) => void;
  // Their chat key changed (new phone or reinstall): use the new one.
  trustNewKey: (memberId: string) => void;
  refreshPeers: () => Promise<void>;
  // Stops their messages on this phone straight away (Bluetooth included) and
  // blocks them on Ol-ga as soon as it can be reached.
  blockPeer: (memberId: string) => void;
  isBlocked: (memberId: string) => boolean;
  // Files a report now if Ol-ga has the message, else keeps it until it does.
  reportMessage: (messageId: string, category: ReportCategory, description?: string) => void;
  // Dev only (the debug panel's Reset Nearby): forget Bluetooth chats on this phone.
  resetForTesting: () => void;
};

const OfflineChatContext = createContext<OfflineChatState | undefined>(undefined);

export function OfflineChatProvider({ children }: { children: React.ReactNode }) {
  const { memberId } = useAuth();
  const { available, inRange, sendPayload, addPayloadListener, requests, online } = useNearby();
  const [saved, setSaved] = useState<ChatSaved>(EMPTY_CHAT);
  const savedRef = useRef(saved);
  const [loaded, setLoaded] = useState(false);
  const [keys, setKeys] = useState<ChatKeyPair | null>(null);
  const activePeer = useRef<string | null>(null);
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  const update = useCallback(
    (change: (current: ChatSaved) => ChatSaved) => {
      const next = change(savedRef.current);
      savedRef.current = next;
      setSaved(next);
      if (memberId) saveChat(memberId, next);
    },
    [memberId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setKeys(null);
    savedRef.current = EMPTY_CHAT;
    setSaved(EMPTY_CHAT);
    if (!memberId) return;
    Promise.all([loadChat(memberId), loadKeyPair(memberId).catch(() => null)]).then(([chat, pair]) => {
      if (cancelled) return;
      const full = { ...EMPTY_CHAT, ...chat };
      savedRef.current = full;
      setSaved(full);
      setKeys(pair);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const patchPeer = useCallback(
    (peerId: string, change: (p: ChatPeer) => ChatPeer) =>
      update((s) => ({ ...s, peers: { ...s.peers, [peerId]: change(s.peers[peerId] ?? { memberId: peerId }) } })),
    [update]
  );

  // ---- who you can chat with ----

  // Ol-ga's connections (kept on the phone for offline) and Commits accepted nearby.
  const refreshPeers = useCallback(async () => {
    if (!memberId) return;
    try {
      // Straight from Ol-ga when it answers (then a removed connection, e.g.
      // a block, stops the chat); else what's on the phone.
      let fresh = true;
      const connections = await coreApi.getConnectionsFresh().catch(() => {
        fresh = false;
        return coreApi.getConnections();
      });
      const page = await coreApi.listConversations(undefined, 50).catch(() => null);
      const about = new Map((page?.items ?? []).map((c) => [c.member_id, c]));
      update((s) => {
        const peers = { ...s.peers };
        if (fresh) {
          const active = new Set(connections.filter((c) => c.status === 'ACTIVE').map((c) => c.member_id));
          // Accepted nearby but not on Ol-ga yet: still connected.
          requestsRef.current.forEach((r) => r.status === 'accepted' && !r.sync.done && active.add(r.peer.m));
          Object.keys(peers).forEach((id) => !active.has(id) && delete peers[id]);
        }
        for (const c of connections) {
          if (c.status !== 'ACTIVE') continue;
          const conversation = about.get(c.member_id);
          const known = peers[c.member_id] ?? { memberId: c.member_id };
          const name = c.display_name ?? conversation?.display_name ?? known.name;
          peers[c.member_id] = {
            ...known,
            name,
            headline: conversation?.headline ?? known.headline,
            initials: name ? getInitials(name) : known.initials,
            conversationId: c.conversation_id ?? known.conversationId,
          };
        }
        return { ...s, peers };
      });
    } catch {
      // offline with nothing saved yet: Nearby accepts still count (below)
    }
  }, [memberId, update]);

  useEffect(() => {
    if (!loaded) return;
    refreshPeers();
    const timer = setInterval(() => AppState.currentState === 'active' && refreshPeers(), PEERS_MS);
    return () => clearInterval(timer);
  }, [loaded, refreshPeers]);

  // A Commit accepted nearby connects the two, even before Ol-ga knows.
  useEffect(() => {
    if (!loaded) return;
    for (const r of requests) {
      if (r.status !== 'accepted') continue;
      const known = savedRef.current.peers[r.peer.m];
      if (known && known.name === (r.peerName ?? known.name) && known.headline) continue;
      patchPeer(r.peer.m, (p) => ({
        ...p,
        name: p.name ?? r.peerName,
        headline: p.headline ?? r.peer.h,
        initials: p.initials ?? (r.peerName ? getInitials(r.peerName) : r.peer.i),
        publicKey: p.publicKey ?? r.peer.k,
      }));
    }
  }, [loaded, requests, patchPeer]);

  // Pin each connected member's key the first time their card shows it.
  useEffect(() => {
    if (!loaded) return;
    for (const [peerId, seen] of Object.entries(inRange)) {
      const peer = savedRef.current.peers[peerId];
      const k = seen.card.k;
      if (!peer || !k) continue;
      if (!peer.publicKey) patchPeer(peerId, (p) => ({ ...p, publicKey: k, keyChanged: false }));
      else if (peer.publicKey !== k && !peer.keyChanged) patchPeer(peerId, (p) => ({ ...p, keyChanged: true }));
      else if (peer.publicKey === k && peer.keyChanged) patchPeer(peerId, (p) => ({ ...p, keyChanged: false }));
    }
  }, [loaded, inRange, patchPeer]);

  const reach = useCallback(
    (peerId: string): NearbyReach => {
      const peer = saved.peers[peerId];
      if (peer?.keyChanged) return 'key-changed';
      if (!available) return 'nearby-off';
      if (!inRange[peerId]) return 'out-of-range';
      if (!peer?.publicKey) return 'no-key';
      return 'ready';
    },
    [saved.peers, available, inRange]
  );

  // ---- over Bluetooth ----

  const keyFor = useCallback(
    (peer: ChatPeer | undefined) => (keys && memberId && peer?.publicKey ? pairKey(keys, memberId, peer.publicKey, peer.memberId) : null),
    [keys, memberId]
  );

  const inRangeRef = useRef(inRange);
  inRangeRef.current = inRange;
  const delivering = useRef(false);
  const deliver = useCallback(async () => {
    if (delivering.current || !memberId) return;
    delivering.current = true;
    try {
      for (const m of savedRef.current.messages) {
        if (m.from !== 'me' || m.delivered || !inRangeRef.current[m.peer] || savedRef.current.blocked.includes(m.peer)) continue;
        const peer = savedRef.current.peers[m.peer];
        const key = peer?.keyChanged ? null : keyFor(peer);
        if (!key) continue;
        const wire: ChatWire = { v: 1, t: 'chat', id: m.id, from: memberId, to: m.peer, at: m.sentAt, ...seal(key, memberId, m.peer, m.id, m.body) };
        if (await sendPayload(m.peer, JSON.stringify(wire))) {
          update((s) => ({ ...s, messages: s.messages.map((x) => (x.id === m.id ? { ...x, delivered: true } : x)) }));
        }
      }
    } finally {
      delivering.current = false;
    }
  }, [memberId, keyFor, sendPayload, update]);

  useEffect(() => {
    if (!loaded || !available) return;
    const timer = setInterval(deliver, TICK_MS);
    return () => clearInterval(timer);
  }, [loaded, available, deliver]);

  // Straight away when someone with a waiting message comes into range.
  const inRangeCount = Object.keys(inRange).length;
  useEffect(() => {
    if (loaded && available && inRangeCount) deliver();
  }, [loaded, available, inRangeCount, deliver]);

  const receive = useRef<(payload: string) => void>(() => {});
  receive.current = (payload: string) => {
    const wire = parseWire(payload);
    const drop = (why: string) => __DEV__ && console.warn(`[chat] nearby message dropped: ${why}`);
    if (!wire || !memberId || wire.to !== memberId) return drop(wire ? 'not for me' : 'not chat');
    // Only connected members; a stranger's message is dropped unread.
    if (savedRef.current.blocked.includes(wire.from)) return drop('blocked');
    let peer = savedRef.current.peers[wire.from];
    if (!peer) return drop('not connected');
    if (!peer.publicKey && inRangeRef.current[wire.from]?.card.k) {
      peer = { ...peer, publicKey: inRangeRef.current[wire.from].card.k };
      patchPeer(wire.from, () => peer as ChatPeer);
    }
    const key = peer.keyChanged ? null : keyFor(peer);
    if (!key) return drop(peer.keyChanged ? 'key changed' : 'no key');
    if (savedRef.current.messages.some((m) => m.id === wire.id)) return;
    const body = open(key, wire.from, memberId, wire.id, wire.n, wire.c);
    if (body === null) return drop('does not open');
    const message: LocalChatMessage = {
      id: wire.id,
      peer: wire.from,
      from: 'them',
      body: body.slice(0, MAX_NEARBY_BODY),
      sentAt: Number.isNaN(Date.parse(wire.at)) ? new Date().toISOString() : wire.at,
      delivered: true,
      synced: true,
      key: '',
    };
    update((s) => ({ ...s, messages: [...s.messages, message] }));
    if (activePeer.current !== wire.from || AppState.currentState !== 'active') {
      showLocalNotification(
        `chat-${wire.from}`,
        peer.name ?? 'Message from a connection',
        isOffensive(message.body) ? 'New message (hidden: it may be offensive)' : message.body,
        peer.initials ?? '··',
        pastelFor(wire.from)
      );
    }
  };
  useEffect(() => addPayloadListener((payload) => receive.current(payload)), [addPayloadListener]);

  const sendNearby = useCallback(
    (peerId: string, body: string, same?: { id: string; key: string; sentAt: string }) => {
      const text = body.trim();
      if (!text || !savedRef.current.peers[peerId]) return null;
      if (savedRef.current.messages.some((m) => m.id === same?.id)) return null;
      const message: LocalChatMessage = {
        id: same?.id ?? newIdempotencyKey(),
        peer: peerId,
        from: 'me',
        body: text.slice(0, MAX_NEARBY_BODY),
        sentAt: same?.sentAt ?? new Date().toISOString(),
        delivered: false,
        synced: false,
        key: same?.key ?? newIdempotencyKey(),
      };
      update((s) => ({ ...s, messages: [...s.messages, message] }));
      setTimeout(deliver, 0);
      return message;
    },
    [update, deliver]
  );

  // ---- to Ol-ga ----

  // Blocks and reports made offline, to Ol-ga.
  const syncSafety = useCallback(async () => {
    const s = savedRef.current;
    for (const id of s.blocked.filter((b) => !s.blockSynced.includes(b))) {
      try {
        await coreApi.blockMember(id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status > 0)) return; // offline: later
        if (e.status !== 409) continue; // 409: already blocked
      }
      update((x) => ({ ...x, blockSynced: [...x.blockSynced, id] }));
    }
    const month = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const r of savedRef.current.reports) {
      let done = r.createdAt < month; // give up after a month
      if (!done) {
        try {
          await coreApi.reportMessage(r.messageId, { category: r.category, ...(r.description ? { description: r.description } : {}) });
          done = true;
        } catch (e) {
          if (!(e instanceof ApiError && e.status > 0)) return; // offline: later
          // 404: the sender's phone hasn't saved it to Ol-ga yet; try again later.
          done = e.code !== 'MESSAGE_NOT_FOUND';
        }
      }
      if (done) update((x) => ({ ...x, reports: x.reports.filter((y) => y.messageId !== r.messageId) }));
    }
  }, [update]);

  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (syncing.current || !memberId) return;
    await syncSafety();
    const waiting = savedRef.current.messages.filter((m) => m.from === 'me' && !m.synced && !savedRef.current.blocked.includes(m.peer));
    if (!waiting.length) return;
    syncing.current = true;
    try {
      if (waiting.some((m) => !savedRef.current.peers[m.peer]?.conversationId)) await refreshPeers();
      for (const m of waiting) {
        const conversationId = savedRef.current.peers[m.peer]?.conversationId;
        if (!conversationId) continue; // Ol-ga doesn't have the connection yet
        try {
          await coreApi.sendMessage(
            conversationId,
            { message_id: m.id, body: m.body, message_type: 'TEXT', client_sent_at: m.sentAt },
            { idempotencyKey: m.key }
          );
        } catch (e) {
          // Already saved under this message_id: done.
          if (!(e instanceof ApiError && e.code === 'IDEMPOTENCY_KEY_REUSED')) {
            if (!(e instanceof ApiError && e.status > 0)) return; // offline: try later
            continue; // e.g. blocked: keep it on the phone
          }
        }
        update((s) => ({ ...s, messages: s.messages.map((x) => (x.id === m.id ? { ...x, synced: true } : x)) }));
      }
    } finally {
      syncing.current = false;
    }
  }, [memberId, refreshPeers, update, syncSafety]);

  useEffect(() => {
    if (!loaded) return;
    sync();
    const timer = setInterval(() => AppState.currentState === 'active' && sync(), SYNC_MS);
    const subscription = AppState.addEventListener('change', (next) => next === 'active' && sync());
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [loaded, sync]);

  // Back online (Nearby noticed): save straight away.
  useEffect(() => {
    if (online) sync();
  }, [online, sync]);

  const value = useMemo<OfflineChatState>(() => {
    const peers = Object.values(saved.peers).filter((p) => !saved.blocked.includes(p.memberId));
    return {
      peers,
      peerFor: (id) => saved.peers[id],
      peerForConversation: (conversationId) => peers.find((p) => p.conversationId === conversationId),
      messagesWith: (id) => saved.messages.filter((m) => m.peer === id),
      reach,
      sendNearby,
      setActivePeer: (id) => {
        activePeer.current = id;
      },
      trustNewKey: (id) => {
        const k = inRangeRef.current[id]?.card.k;
        if (k) patchPeer(id, (p) => ({ ...p, publicKey: k, keyChanged: false }));
      },
      refreshPeers,
      blockPeer: (id) => {
        update((s) => (s.blocked.includes(id) ? s : { ...s, blocked: [...s.blocked, id] }));
        setTimeout(sync, 0);
      },
      isBlocked: (id) => saved.blocked.includes(id),
      resetForTesting: () => update(() => EMPTY_CHAT),
      reportMessage: (messageId, category, description) => {
        update((s) =>
          s.reports.some((r) => r.messageId === messageId)
            ? s
            : { ...s, reports: [...s.reports, { messageId, category, description, key: newIdempotencyKey(), createdAt: Date.now() }] }
        );
        setTimeout(sync, 0);
      },
    };
  }, [saved, reach, sendNearby, patchPeer, refreshPeers, update, sync]);

  return <OfflineChatContext.Provider value={value}>{children}</OfflineChatContext.Provider>;
}

export function useOfflineChat() {
  const ctx = useContext(OfflineChatContext);
  if (!ctx) throw new Error('useOfflineChat must be used within OfflineChatProvider');
  return ctx;
}
