import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, newIdempotencyKey } from '../api/client';
import { coreApi } from '../api/core';
import { nlpApi } from '../api/nlp';
import {
  readBleCard,
  requestNotificationPermission,
  sendBleMessage,
  setBleCard,
  showLocalNotification,
} from '../bluetooth/bleDiscovery';
import type { BleDiscoveryState } from '../bluetooth/types';
import { useBluetoothDiscovery } from '../bluetooth/useBluetoothDiscovery';
import { loadKeyPair } from '../chat/crypto';
import { pastelFor } from '../components/GoLiveRadar';
import { buildCard, parseCard, parseMessage } from '../nearby/card';
import { estimateScore } from '../nearby/score';
import { EMPTY_NEARBY, loadNearby, NearbySaved, saveNearby } from '../nearby/store';
import type { NearbyCard, NearbyMessage, NearbyPerson, NearbyRequest } from '../nearby/types';
import { useAuth } from './AuthContext';
import { useLive } from './LiveContext';

// Nearby: Go Live without an event. While the member is available, phones
// close by find each other over Bluetooth, swap cards (role and intent, never
// the name) and can send each other Commits, with or without internet.
// Commits made over Bluetooth are kept on the phone and saved to Ol-ga as
// plain connection requests once there's a connection; an accept there
// connects the two and reveals names, as an accepted Commit does.

// Go Live at an event, or everywhere: members anywhere and, over Bluetooth,
// people close by.
export type GoLiveMode = 'event' | 'anywhere';

export type NearbyInRange = { token: string; card: NearbyCard; lastSeenAt: number };

export type AvailableResult = 'OK' | 'NEED_INTENT' | 'NEED_CONSENT';

type NearbyState = {
  // Go Live shows this event's room or Everywhere; null lets the screen decide.
  mode: GoLiveMode | null;
  setMode: (mode: GoLiveMode) => void;
  available: boolean;
  setAvailable: (on: boolean) => Promise<AvailableResult>;
  grantConsent: () => void;
  ble: BleDiscoveryState;
  // Available Ol-ga members close by, best fit first (passed ones left out).
  people: NearbyPerson[];
  myCard: NearbyCard | null;
  requests: NearbyRequest[];
  sendCommit: (memberId: string) => Promise<NearbyRequest | null>;
  // Accept or decline a Commit from someone nearby. A decline is never sent to them.
  respond: (requestId: string, accept: boolean) => void;
  passedIds: string[];
  pass: (memberId: string) => void;
  // The latest Commit from someone nearby, for the in-app banner.
  banner: NearbyRequest | null;
  dismissBanner: () => void;
  // Ol-ga answered the last sync (null: not tried yet).
  online: boolean | null;
  // Every Ol-ga member in range right now (passed ones too), by member ID.
  inRange: Record<string, NearbyInRange>;
  // Writes to that member's phone if it's in range. false: not in range or failed.
  sendPayload: (memberId: string, payload: string) => Promise<boolean>;
  // Messages from other phones that aren't Nearby's own (chat). Returns unsubscribe.
  addPayloadListener: (listener: (payload: string) => void) => () => void;
  // Dev only (the debug panel): forget consent, Commits and passes on this phone.
  resetForTesting: () => void;
};

const NearbyContext = createContext<NearbyState | undefined>(undefined);

const TICK_MS = 4000; // deliver pending messages to phones in range
const SYNC_MS = 30000; // save to Ol-ga while there's a connection
const CARD_RETRY_MS = 10000; // after a failed card read
const CARD_REFRESH_MS = 60000; // re-read cards, in case they changed their intent
const REQUEST_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000; // as Ol-ga's plain requests

const isNetworkError = (e: unknown) => !(e instanceof ApiError && e.status > 0);

function notifyIncoming(request: NearbyRequest) {
  const { peer } = request;
  showLocalNotification(
    `nearby-in-${request.id}`,
    'Someone nearby wants to meet',
    `${peer.h}\nLooking for: ${peer.w}`,
    peer.i,
    pastelFor(peer.m)
  );
}

function notifyAccepted(request: NearbyRequest) {
  const { peer } = request;
  showLocalNotification(
    `nearby-ok-${request.id}`,
    `${request.peerName || peer.h} accepted your Commit`,
    `You're connected. Say hello while you're both nearby.`,
    peer.i,
    pastelFor(peer.m)
  );
}

export function NearbyProvider({ children }: { children: React.ReactNode }) {
  const { memberId, name } = useAuth();
  const { intentText, setIntentText } = useLive();
  const [saved, setSaved] = useState<NearbySaved>(EMPTY_NEARBY);
  const savedRef = useRef(saved);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<GoLiveMode | null>(null);
  const [cards, setCards] = useState<Record<string, NearbyCard>>({});
  const [realScores, setRealScores] = useState<Record<string, number>>({});
  const [online, setOnline] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<NearbyRequest | null>(null);
  const intentRef = useRef(intentText);
  intentRef.current = intentText;

  const update = useCallback(
    (change: (current: NearbySaved) => NearbySaved) => {
      const next = change(savedRef.current);
      savedRef.current = next;
      setSaved(next);
      if (memberId) saveNearby(memberId, next);
    },
    [memberId]
  );

  const patchRequest = useCallback(
    (id: string, change: (r: NearbyRequest) => NearbyRequest) =>
      update((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? change(r) : r)) })),
    [update]
  );

  // Load this member's Nearby state; the intent comes back too, so Nearby
  // works after a restart with no internet.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setCards({});
    setRealScores({});
    setBanner(null);
    savedRef.current = EMPTY_NEARBY;
    setSaved(EMPTY_NEARBY);
    if (!memberId) return;
    loadNearby(memberId).then((s) => {
      if (cancelled) return;
      savedRef.current = s;
      setSaved(s);
      setLoaded(true);
      if (s.intent && !intentRef.current.trim()) setIntentText(s.intent);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId, setIntentText]);

  useEffect(() => {
    if (loaded && intentText.trim() && intentText !== savedRef.current.intent) update((s) => ({ ...s, intent: intentText }));
  }, [intentText, loaded, update]);

  // The profile behind the card, refreshed whenever Ol-ga can be reached.
  const refreshProfile = useCallback(async () => {
    try {
      const p = await coreApi.getMyProfile();
      update((s) => ({
        ...s,
        headline: p.headline ?? '',
        roleCategory: p.role_category,
        offer: [p.headline, p.professional_summary].filter((x) => x && x.trim()).join('. '),
        name: p.display_name ?? s.name,
      }));
    } catch {
      // offline: keep the saved copy
    }
  }, [update]);

  useEffect(() => {
    if (loaded) refreshProfile();
  }, [loaded, refreshProfile]);

  // Public chat key on the card, so connected members can chat over Bluetooth.
  const [chatKey, setChatKey] = useState<string | undefined>();
  useEffect(() => {
    setChatKey(undefined);
    if (!memberId) return;
    let cancelled = false;
    loadKeyPair(memberId)
      .then((pair) => !cancelled && setChatKey(pair.publicKey))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const want = (intentText || saved.intent).trim();
  const myCard = useMemo(
    () => (memberId && want ? buildCard(memberId, saved.headline, saved.roleCategory, want, saved.offer, chatKey) : null),
    [memberId, want, saved.headline, saved.roleCategory, saved.offer, chatKey]
  );
  const myName = saved.name || name || '';

  useEffect(() => {
    if (myCard) setBleCard(JSON.stringify(myCard));
  }, [myCard]);

  // ---- Bluetooth ----

  const handleMessage = useRef<(payload: string) => void>(() => {});
  const onMessage = useCallback((payload: string) => handleMessage.current(payload), []);
  const enabled = loaded && saved.available && myCard !== null;
  const ble = useBluetoothDiscovery(enabled, onMessage);

  // Read the card of every Ol-ga phone in range (one connection at a time natively).
  const reading = useRef(new Set<string>());
  const readAt = useRef(new Map<string, number>());
  const failedAt = useRef(new Map<string, number>());
  useEffect(() => {
    if (!enabled) {
      setCards({});
      readAt.current.clear();
      failedAt.current.clear();
      return;
    }
    const now = Date.now();
    for (const device of ble.devices) {
      const token = device.discoveryId;
      if (reading.current.has(token)) continue;
      if (now - (failedAt.current.get(token) ?? 0) < CARD_RETRY_MS) continue;
      if (now - (readAt.current.get(token) ?? 0) < CARD_REFRESH_MS) continue;
      reading.current.add(token);
      readBleCard(token)
        .then((text) => {
          const card = parseCard(text);
          if (!card) throw new Error('Not an Ol-ga card');
          readAt.current.set(token, Date.now());
          setCards((current) => ({ ...current, [token]: card }));
        })
        .catch(() => failedAt.current.set(token, Date.now()))
        .finally(() => reading.current.delete(token));
    }
  }, [enabled, ble.devices]);

  const scoreKey = (them: NearbyCard) => `${them.m}\n${them.w}\n${myCard?.w ?? ''}`;

  const people = useMemo<NearbyPerson[]>(() => {
    if (!myCard) return [];
    const byMember = new Map<string, NearbyPerson>();
    for (const device of ble.devices) {
      const card = cards[device.discoveryId];
      if (!card || card.m === memberId) continue;
      const real = realScores[scoreKey(card)];
      const person: NearbyPerson = {
        token: device.discoveryId,
        card,
        rssi: device.rssi,
        lastSeenAt: device.lastSeenAt,
        score: real ?? estimateScore(myCard, card),
        scoreSource: real != null ? 'ol-ga' : 'estimate',
      };
      const known = byMember.get(card.m);
      if (!known || person.lastSeenAt > known.lastSeenAt) byMember.set(card.m, person);
    }
    return [...byMember.values()].filter((p) => !saved.passedIds.includes(p.card.m)).sort((a, b) => b.score - a.score);
    // scoreKey only reads myCard, listed already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCard, ble.devices, cards, realScores, memberId, saved.passedIds]);

  // Ol-ga's own score, whenever it can be reached (it's slow from cold: in the background).
  const scoring = useRef(new Set<string>());
  useEffect(() => {
    if (!myCard || online === false) return;
    for (const person of people) {
      const key = scoreKey(person.card);
      if (realScores[key] != null || scoring.current.has(key)) continue;
      scoring.current.add(key);
      nlpApi
        .scorePair({
          requester_offer: myCard.o || myCard.h,
          requester_want: myCard.w,
          candidate_offer: person.card.o || person.card.h,
          candidate_want: person.card.w,
        })
        .then((r) => setRealScores((current) => ({ ...current, [key]: r.reciprocal })))
        .catch(() => {})
        .finally(() => scoring.current.delete(key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, myCard, online]);

  // ---- messages between phones ----

  const payloadListeners = useRef(new Set<(payload: string) => void>());
  const addPayloadListener = useCallback((listener: (payload: string) => void) => {
    payloadListeners.current.add(listener);
    return () => {
      payloadListeners.current.delete(listener);
    };
  }, []);

  handleMessage.current = (payload: string) => {
    const message = parseMessage(payload);
    if (!message) {
      payloadListeners.current.forEach((listener) => listener(payload));
      return;
    }
    if (!memberId) return;
    const known = savedRef.current.requests.find((r) => r.id === message.id);
    if (message.t === 'commit') {
      if (known || message.from.m === memberId) return;
      const request: NearbyRequest = {
        id: message.id,
        direction: 'in',
        peer: message.from,
        createdAt: Date.now(),
        status: 'pending',
        delivered: false,
        sync: {},
      };
      update((s) => ({ ...s, requests: [request, ...s.requests] }));
      notifyIncoming(request);
      setBanner(request);
      return;
    }
    if (!known || known.peer.m !== message.from) return;
    if (message.t === 'accept' && known.direction === 'out' && known.status !== 'accepted') {
      const accepted: NearbyRequest = { ...known, status: 'accepted', respondedAt: Date.now(), peerName: message.name ?? known.peerName };
      patchRequest(known.id, () => accepted);
      notifyAccepted(accepted);
    } else if (message.t === 'name' && known.direction === 'in') {
      patchRequest(known.id, (r) => ({ ...r, peerName: message.name, nameShared: true }));
    }
  };

  // What still has to reach the other phone, and the message that carries it.
  const outgoingMessage = useCallback(
    (r: NearbyRequest): NearbyMessage | null => {
      if (!myCard || !memberId) return null;
      if (r.direction === 'out' && r.status === 'pending' && !r.delivered) return { v: 1, t: 'commit', id: r.id, from: myCard };
      if (r.direction === 'in' && r.status === 'accepted' && !r.delivered)
        return { v: 1, t: 'accept', id: r.id, from: memberId, ...(myName ? { name: myName } : {}) };
      if (r.direction === 'out' && r.status === 'accepted' && !r.nameShared && myName) return { v: 1, t: 'name', id: r.id, from: memberId, name: myName };
      return null;
    },
    [myCard, memberId, myName]
  );

  const peopleRef = useRef(people);
  peopleRef.current = people;

  const inRange = useMemo(() => {
    const byMember: Record<string, NearbyInRange> = {};
    for (const device of ble.devices) {
      const card = cards[device.discoveryId];
      if (!card || card.m === memberId) continue;
      const known = byMember[card.m];
      if (!known || device.lastSeenAt > known.lastSeenAt) byMember[card.m] = { token: device.discoveryId, card, lastSeenAt: device.lastSeenAt };
    }
    return byMember;
  }, [ble.devices, cards, memberId]);
  const inRangeRef = useRef(inRange);
  inRangeRef.current = inRange;

  const sendPayload = useCallback(async (peerId: string, payload: string) => {
    const peer = inRangeRef.current[peerId];
    if (!peer) return false;
    try {
      await sendBleMessage(peer.token, payload);
      return true;
    } catch {
      return false;
    }
  }, []);
  const delivering = useRef(false);
  const deliver = useCallback(async () => {
    if (delivering.current) return;
    delivering.current = true;
    try {
      const fresh = Date.now() - REQUEST_LIFETIME_MS;
      for (const r of savedRef.current.requests) {
        if (r.createdAt < fresh) continue;
        const message = outgoingMessage(r);
        const person = message && peopleRef.current.find((p) => p.card.m === r.peer.m);
        if (!message || !person) continue;
        try {
          await sendBleMessage(person.token, JSON.stringify(message));
          patchRequest(r.id, (x) => (message.t === 'name' ? { ...x, nameShared: true } : { ...x, delivered: true }));
        } catch {
          // out of range or busy: next tick
        }
      }
    } finally {
      delivering.current = false;
    }
  }, [outgoingMessage, patchRequest]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(deliver, TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, deliver]);

  // Deliver straight away when someone we owe a message to comes into range.
  useEffect(() => {
    if (enabled && people.length) deliver();
  }, [enabled, people.length, deliver]);

  // ---- saving to Ol-ga ----

  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (syncing.current || !memberId) return;
    syncing.current = true;
    let reached = false;
    const note = (ok: boolean) => {
      reached = reached || ok;
    };
    try {
      const open = savedRef.current.requests.filter((r) => !r.sync.done);
      if (open.length === 0) {
        // Nothing to save: a cheap call tells us whether Ol-ga can be reached.
        await coreApi.getConnectionsFresh().then(() => note(true));
        return;
      }

      // 1. Commits we sent: Ol-ga gets a plain connection request.
      for (const r of open.filter((x) => x.direction === 'out' && !x.sync.created)) {
        try {
          const saved1 = await coreApi.sendConnectionRequest(
            { recipient_member_id: r.peer.m, note: 'Met nearby on Ol-ga' },
            { idempotencyKey: r.id }
          );
          note(true);
          patchRequest(r.id, (x) => ({ ...x, sync: { ...x.sync, created: true, serverRequestId: saved1.request_id } }));
        } catch (e) {
          if (isNetworkError(e)) throw e;
          note(true);
          const code = e instanceof ApiError ? e.code : '';
          const outcome = code === 'CONNECTION_EXISTS' ? 'already-connected' : 'not-allowed';
          patchRequest(r.id, (x) => ({ ...x, sync: { ...x.sync, created: true, done: true, outcome } }));
        }
      }

      // 2. Commits we answered: find Ol-ga's copy of their request, then answer it there.
      const answered = savedRef.current.requests.filter((x) => x.direction === 'in' && x.status !== 'pending' && !x.sync.decided && !x.sync.done);
      if (answered.length) {
        const bySender = new Map<string, string>();
        let cursor: string | undefined;
        for (let page = 0; page < 10; page++) {
          const changes = await coreApi.getChanges(cursor);
          note(true);
          for (const item of changes.items) {
            if (item.resource_type !== 'CONNECTION_REQUEST' || !item.payload) continue;
            const sender = (item.payload.sender_member_id ?? item.payload.SenderMemberId) as string | undefined;
            if (sender) bySender.set(sender, item.resource_id);
          }
          if (!changes.has_more || !changes.next_cursor) break;
          cursor = changes.next_cursor;
        }
        for (const r of answered) {
          const requestId = bySender.get(r.peer.m);
          if (!requestId) continue; // they haven't been online since; next time
          try {
            if (r.status === 'accepted') {
              const result = await coreApi.acceptCommit(requestId, { idempotencyKey: `${r.id}-answer` });
              patchRequest(r.id, (x) => ({
                ...x,
                peerName: x.peerName || result.display_name,
                sync: { ...x.sync, decided: true, done: true, outcome: 'connected' },
              }));
            } else {
              await coreApi.declineCommit(requestId, { idempotencyKey: `${r.id}-answer` });
              patchRequest(r.id, (x) => ({ ...x, sync: { ...x.sync, decided: true, done: true } }));
            }
          } catch (e) {
            if (isNetworkError(e)) throw e;
            patchRequest(r.id, (x) => ({ ...x, sync: { ...x.sync, decided: true, done: true } }));
          }
        }
      }

      // 3. Commits we sent that were accepted while we were apart.
      const waiting = savedRef.current.requests.filter((x) => x.direction === 'out' && x.sync.created && !x.sync.done);
      if (waiting.length) {
        const connections = await coreApi.getConnectionsFresh();
        note(true);
        for (const r of waiting) {
          const connection = connections.find((c) => c.member_id === r.peer.m && c.status === 'ACTIVE');
          if (!connection) continue;
          const wasPending = r.status === 'pending';
          const accepted: NearbyRequest = {
            ...r,
            status: 'accepted',
            respondedAt: r.respondedAt ?? Date.now(),
            peerName: r.peerName || connection.display_name,
            sync: { ...r.sync, done: true, outcome: 'connected' },
          };
          patchRequest(r.id, () => accepted);
          if (wasPending) notifyAccepted(accepted);
        }
      }

      // Open items that needed no call this round (e.g. a Commit still waiting
      // for our decision) say nothing about the network: ask Ol-ga directly,
      // or a working connection would read as "no internet".
      if (!reached) await coreApi.getConnectionsFresh().then(() => note(true));
    } catch (e) {
      if (!isNetworkError(e)) note(true);
    } finally {
      syncing.current = false;
      setOnline(reached);
    }
  }, [memberId, patchRequest]);

  useEffect(() => {
    if (!loaded) return;
    sync();
    const timer = setInterval(sync, SYNC_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [loaded, sync]);

  // ---- actions ----

  const setAvailable = useCallback(
    async (on: boolean): Promise<AvailableResult> => {
      if (!on) {
        update((s) => ({ ...s, available: false }));
        return 'OK';
      }
      if (!want) return 'NEED_INTENT';
      if (!savedRef.current.consented) return 'NEED_CONSENT';
      await requestNotificationPermission().catch(() => false);
      update((s) => ({ ...s, available: true }));
      // Going invisible later keeps the member in Everywhere, not their event.
      setMode('anywhere');
      refreshProfile();
      return 'OK';
    },
    [update, want, refreshProfile]
  );

  const sendCommit = useCallback(
    async (peerMemberId: string) => {
      const person = peopleRef.current.find((p) => p.card.m === peerMemberId);
      // Already connected (either way round), or a Commit of ours is waiting: don't send another.
      const already =
        savedRef.current.requests.find((r) => r.peer.m === peerMemberId && r.status === 'accepted') ??
        savedRef.current.requests.find((r) => r.direction === 'out' && r.peer.m === peerMemberId && r.status === 'pending');
      if (already) return already;
      if (!person) return null;
      const request: NearbyRequest = {
        id: newIdempotencyKey(),
        direction: 'out',
        peer: person.card,
        createdAt: Date.now(),
        status: 'pending',
        delivered: false,
        sync: {},
      };
      update((s) => ({ ...s, requests: [request, ...s.requests] }));
      setTimeout(() => {
        deliver();
        sync();
      }, 0);
      return request;
    },
    [update, deliver, sync]
  );

  const respond = useCallback(
    (requestId: string, accept: boolean) => {
      // A decline isn't sent: like a Commit at an event, they're never told.
      patchRequest(requestId, (r) =>
        r.status !== 'pending' ? r : { ...r, status: accept ? 'accepted' : 'declined', respondedAt: Date.now(), delivered: !accept }
      );
      setBanner((current) => (current?.id === requestId ? null : current));
      setTimeout(() => {
        deliver();
        sync();
      }, 0);
    },
    [patchRequest, deliver, sync]
  );

  const value = useMemo<NearbyState>(
    () => ({
      mode,
      setMode,
      available: saved.available,
      setAvailable,
      grantConsent: () => update((s) => ({ ...s, consented: true })),
      ble,
      people,
      myCard,
      requests: saved.requests.filter((r) => Date.now() - r.createdAt < REQUEST_LIFETIME_MS || r.status !== 'pending'),
      sendCommit,
      respond,
      passedIds: saved.passedIds,
      pass: (id: string) => update((s) => (s.passedIds.includes(id) ? s : { ...s, passedIds: [...s.passedIds, id] })),
      banner,
      dismissBanner: () => setBanner(null),
      online,
      inRange,
      sendPayload,
      addPayloadListener,
      resetForTesting: () => {
        update((s) => ({ ...EMPTY_NEARBY, intent: s.intent, headline: s.headline, roleCategory: s.roleCategory, offer: s.offer, name: s.name }));
        setCards({});
        setRealScores({});
        setBanner(null);
      },
    }),
    [mode, saved, setAvailable, update, ble, people, myCard, sendCommit, respond, banner, online, inRange, sendPayload, addPayloadListener]
  );

  return <NearbyContext.Provider value={value}>{children}</NearbyContext.Provider>;
}

export function useNearby() {
  const ctx = useContext(NearbyContext);
  if (!ctx) throw new Error('useNearby must be used within NearbyProvider');
  return ctx;
}
