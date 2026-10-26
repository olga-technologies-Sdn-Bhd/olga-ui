import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellOff, EllipsisVertical, Lock, ShieldAlert } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, newIdempotencyKey } from '../../api/client';
import { coreApi } from '../../api/core';
import type { ChatMessage, Conversation, ReportCategory } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { BottomSheet, SheetChoices, SheetGroup, SheetOption } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { ChatWallpaper } from '../../components/ChatWallpaper';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pill } from '../../components/Pill';
import { ReportMemberSheet } from '../../components/ReportMemberSheet';
import { Screen } from '../../components/Screen';
import { CHAT_MESSAGE_POLL_MS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { ChatStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { dayKey, formatClock, formatDayLabel } from '../../utils/chatTime';
import { getInitials } from '../../utils/initials';
import { usePollWhileFocused } from '../../utils/usePollWhileFocused';
import { useNearby } from '../../context/NearbyContext';
import { useChatEvents } from '../../context/ChatRealtimeContext';
import { MAX_NEARBY_BODY, NearbyReach, useOfflineChat } from '../../context/OfflineChatContext';
import { isOffensive } from '../../chat/moderation';
import { attachmentError, checkFile, pickPdf, pickPhoto, rememberSent, retryDownloads, uploadAttachment, type LocalFile, type PickResult } from '../../chat/attachments';
import { askMicrophone, cancelRecording, startRecording, stopPlayback, stopRecording } from '../../chat/voice';
import { ChatAttachment } from '../../components/ChatAttachment';
import { FALLBACK_NAME } from './ChatsPanel';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversation'>;

const PAGE_SIZE = 100; // server max
const MAX_BODY = 4000;
const MAX_REPORT_NOTE = 2000;
const HOUR_MS = 60 * 60 * 1000;
// "I'm typing" goes to Core at most this often, and only for real text.
const TYPING_EVERY_MS = 3000;
// How long their "typing…" shows when expires_at can't be trusted (clock skew).
const TYPING_FALLBACK_MS = 6000;
const NOTE_FOR_MS = 4000;

// The prototype's quick replies (pill label -> message text).
const QUICK_REPLIES = [
  { label: 'Coffee bar, 10 min', text: 'Coffee bar in 10 minutes?' },
  { label: 'Here, now', text: 'I’m here now.' },
  { label: 'After keynote', text: 'Can we meet after the keynote?' },
];

const MUTE_OPTIONS = [
  { label: '8 hours', ms: 8 * HOUR_MS },
  { label: '1 week', ms: 7 * 24 * HOUR_MS },
  // No "forever" on the server: a date far in the future.
  { label: 'Until I turn it back on', ms: 100 * 365 * 24 * HOUR_MS },
];

const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'OTHER', label: 'Other' },
];

// Sent by me, not yet confirmed by the server. The same message_id, body and
// Idempotency-Key are reused on every retry so the server never stores it twice.
type Outgoing = {
  message_id: string;
  idempotencyKey: string;
  body: string;
  client_sent_at: string;
  // pending: sending, or waiting to retry on the next poll.
  status: 'pending' | 'failed';
  attempts: number;
  // false: retrying can't help (a client bug), so no "Tap to retry".
  retryable: boolean;
  // From the last error, for support; never shown.
  correlationId?: string;
  // A photo, PDF or voice note (body is then the caption, maybe empty). It's
  // uploaded first, with its own key; file_asset_id once that worked.
  file?: { local: LocalFile; uploadKey: string; fileAssetId?: string; progress?: number };
  // Shown instead of "Not sent" (e.g. "This file is too large").
  errorText?: string;
};

// A 500 is retried a few times with the same key, then left to the user.
const MAX_SERVER_ERROR_ATTEMPTS = 3;

type Sheet =
  | { kind: 'mine'; message: ChatMessage }
  // The key is made once per delete and reused if that delete is retried.
  | { kind: 'confirmDelete'; message: ChatMessage; idempotencyKey: string }
  | { kind: 'theirs'; message: ChatMessage }
  | { kind: 'report'; message: ChatMessage }
  | { kind: 'reported' }
  | { kind: 'confirmBlock' }
  | { kind: 'mute' }
  // The composer's paperclip: camera, photos, PDF.
  | { kind: 'attach' }
  // The header's ⋮: mute, report the member, block.
  | { kind: 'menu' };

const bySequence = (a: ChatMessage, b: ChatMessage) => a.server_sequence - b.server_sequence;

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.message_id, m]));
  incoming.forEach((m) => byId.set(m.message_id, m));
  return [...byId.values()].sort(bySequence);
}

function cantSendNote(conversation: Conversation) {
  if (conversation.status === 'CLOSED') return 'This conversation has ended.';
  if (conversation.status === 'RESTRICTED') return "You can't send messages in this conversation.";
  return "Messaging isn't available in this conversation right now.";
}

function errorCode(e: unknown) {
  return e instanceof ApiError ? e.code : 'unknown';
}

// Bluetooth status under the composer when Ol-ga can't be reached.
function nearbyNote(reach: NearbyReach, firstName: string) {
  switch (reach) {
    case 'ready':
      return `No internet. Messages go to ${firstName} over Bluetooth, encrypted`;
    case 'nearby-off':
      return 'No internet. Turn on Nearby in Go Live to send over Bluetooth';
    case 'key-changed':
      return `${firstName} is on a new phone. Trust it to send over Bluetooth`;
    default:
      return `No internet. Messages send when ${firstName} is close by or you’re online`;
  }
}

// Just the time; only a message still on this phone says so.
function localStatus(m: { from: 'me' | 'them'; delivered: boolean; synced: boolean; sentAt: string }) {
  return m.from === 'me' && !m.delivered && !m.synced ? 'Waiting to send' : formatClock(m.sentAt);
}

export function ConversationScreen({ route, navigation }: Props) {
  const chat = useOfflineChat();
  const { online } = useNearby();
  const givenPeer = route.params.memberId ? chat.peerFor(route.params.memberId) : undefined;
  const conversationPeer = route.params.conversationId ? chat.peerForConversation(route.params.conversationId) : undefined;
  // Bluetooth-only connections have no Ol-ga conversation yet ('' until they do).
  const conversationId = route.params.conversationId ?? givenPeer?.conversationId ?? '';
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useSafeAreaInsets();
  const { memberId: myId } = useAuth();
  const isFocused = useIsFocused();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory | null>(null);
  const [reportNote, setReportNote] = useState('');
  // Reporting the member (SAF-01), not one message.
  const [reportingMember, setReportingMember] = useState(false);
  // Ol-ga couldn't be reached on the last try: send over Bluetooth instead.
  const [networkDown, setNetworkDown] = useState(false);
  // They're typing (TypingStarted.v1), until the timer runs out.
  const [theyType, setTheyType] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  // A voice note being recorded: milliseconds so far, null when not.
  const [recordingMs, setRecordingMs] = useState<number | null>(null);
  const recordingRef = useRef(false);
  const wantsRecording = useRef(false);
  // A short note above the composer (a file that can't be sent, mic denied).
  const [composerNote, setComposerNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Uploads in flight, to cancel them.
  const aborts = useRef(new Map<string, () => void>());
  const lastProgress = useRef(new Map<string, number>());
  const peerId = route.params.memberId ?? conversationPeer?.memberId ?? conversation?.member_id ?? null;
  const peer = peerId ? chat.peerFor(peerId) : undefined;

  // Highest server_sequence fetched with GET .../messages. Only fetches move
  // it: a sent message's sequence could skip past one still unseen.
  const lastSequence = useRef(0);
  const lastReadSequence = useRef(0);
  // Re-fetch the whole history on focus: polling with after= can't see
  // deletions of older messages.
  const needsFullReload = useRef(true);
  // Ticks: fetch the header again (it carries delivered/read through).
  const needsHeader = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // A message that looked abusive, waiting for "Edit" or "Send anyway".
  const [offensiveDraft, setOffensiveDraft] = useState<string | null>(null);
  // Their messages that looked abusive and were tapped open.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const reveal = (id: string) => setRevealed((current) => new Set(current).add(id));
  const hiddenFor = (id: string, from: 'me' | 'them', body?: string) => from === 'them' && !revealed.has(id) && isOffensive(body ?? '');
  const dayOffsets = useRef<Record<string, { y: number; label: string }>>({});
  const [floatingDay, setFloatingDay] = useState<string | null>(null);
  const floatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUnavailable = useCallback((e: unknown) => {
    const code = errorCode(e);
    if (code === 'CONVERSATION_NOT_FOUND' || code === 'CONVERSATION_FORBIDDEN') {
      setUnavailable("This conversation isn't available any more.");
      return true;
    }
    return false;
  }, []);

  // Pages forward from `after` until a short page.
  const fetchFrom = useCallback(
    async (after: number) => {
      const all: ChatMessage[] = [];
      let from = after;
      for (;;) {
        const page = await coreApi.listMessages(conversationId, from, PAGE_SIZE);
        all.push(...page);
        if (page.length > 0) from = page[page.length - 1].server_sequence;
        if (page.length < PAGE_SIZE) return { messages: all, last: from };
      }
    },
    [conversationId]
  );

  // Mirrors `outbox` for retries started from a poll; `sending` holds the
  // message_ids with a request in flight.
  const outboxRef = useRef<Outgoing[]>([]);
  outboxRef.current = outbox;
  const sending = useRef(new Set<string>());
  const deliverRef = useRef<(item: Outgoing) => void>(() => {});

  const sync = useCallback(async () => {
    if (unavailable || !conversationId) return;
    try {
      if (needsFullReload.current) {
        const [header, history] = await Promise.all([coreApi.getConversation(conversationId), fetchFrom(0)]);
        needsFullReload.current = false;
        setConversation(header);
        setMessages([...history.messages].sort(bySequence));
        lastSequence.current = history.last;
      } else {
        const refreshHeader = needsHeader.current;
        needsHeader.current = false;
        const [fresh, header] = await Promise.all([
          fetchFrom(lastSequence.current),
          refreshHeader ? coreApi.getConversation(conversationId) : Promise.resolve(null),
        ]);
        if (header) setConversation(header);
        lastSequence.current = fresh.last;
        if (fresh.messages.length > 0) setMessages((current) => mergeMessages(current ?? [], fresh.messages));
      }
      setLoadError(null);
      setNetworkDown(false);
      // Ol-ga answers again: send what's still waiting, same IDs and keys.
      outboxRef.current.filter((o) => o.status === 'pending' && !sending.current.has(o.message_id)).forEach((o) => deliverRef.current(o));
    } catch (e) {
      if (handleUnavailable(e)) return;
      if (__DEV__) console.warn(`Conversation sync failed (${errorCode(e)})`);
      const offline = !(e instanceof ApiError && e.status > 0);
      setNetworkDown(offline);
      setLoadError(offline ? null : "Couldn't load messages.");
    }
  }, [conversationId, fetchFrom, handleUnavailable, unavailable]);

  // Declared before the poll so it runs first on focus.
  const { setActivePeer } = chat;
  useFocusEffect(
    useCallback(() => {
      needsFullReload.current = true;
      setActivePeer(peerId);
      // Attachments still being scanned ("Processing…") are asked again.
      retryDownloads();
      return () => {
        setActivePeer(null);
        stopTypingRef.current();
        stopPlayback();
        if (recordingRef.current) {
          recordingRef.current = false;
          setRecordingMs(null);
          cancelRecording();
        }
      };
    }, [setActivePeer, peerId])
  );
  // Nearby noticed Ol-ga answering again: catch up from the last sequence.
  const wasOnline = useRef(online);
  useEffect(() => {
    const cameBack = online && wasOnline.current === false;
    wasOnline.current = online;
    if (!online) return;
    setNetworkDown(false);
    if (cameBack && isFocused) sync();
  }, [online, isFocused, sync]);
  usePollWhileFocused(sync, CHAT_MESSAGE_POLL_MS);

  // Realtime: something changed in this conversation, or the connection came
  // back (null). Fetch over REST; the event itself holds no message.
  useChatEvents((event) => {
    if (!isFocused) return;
    if (event && event.data.conversation_id !== conversationId) return;
    if (event?.event_type === 'TypingStarted.v1') {
      if (event.data.member_id && event.data.member_id !== myId) showTyping(event.data.expires_at);
      return;
    }
    // Their message is here: they've stopped typing.
    if (event?.event_type === 'MessageCreated.v1' && event.data.sender_member_id !== myId) stopTyping();
    if (!event || event.event_type === 'MessageDeleted.v1') needsFullReload.current = true;
    if (event?.event_type === 'ConversationRead.v1') needsHeader.current = true;
    sync();
  });

  // Server-confirmed messages drop out of the outbox.
  useEffect(() => {
    if (!messages) return;
    const confirmed = new Set(messages.map((m) => m.message_id));
    setOutbox((current) =>
      current.some((o) => confirmed.has(o.message_id)) ? current.filter((o) => !confirmed.has(o.message_id)) : current
    );
  }, [messages]);

  // Read: on open and whenever a new message from the other member shows
  // up, mark up to the newest visible message (no per-message receipts).
  useEffect(() => {
    if (!isFocused || !messages || messages.length === 0 || !myId) return;
    const newestTheirs = [...messages].reverse().find((m) => m.sender_member_id !== myId);
    if (!newestTheirs || newestTheirs.server_sequence <= lastReadSequence.current) return;
    const newest = messages[messages.length - 1];
    lastReadSequence.current = newest.server_sequence;
    coreApi
      .markConversationRead(conversationId, newest.message_id)
      .then(setConversation)
      .catch((e) => {
        lastReadSequence.current = 0; // try again on the next poll
        if (__DEV__) console.warn(`Mark read failed (${errorCode(e)})`);
      });
  }, [messages, isFocused, myId, conversationId]);

  function stopTyping() {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    setTheyType(false);
  }
  const stopTypingRef = useRef(stopTyping);
  stopTypingRef.current = stopTyping;

  // Each event extends the timer. expires_at is the server's clock; if the
  // phone's disagrees by much, a short fixed time instead.
  function showTyping(expiresAt?: string) {
    let ms = expiresAt ? Date.parse(expiresAt) - Date.now() : NaN;
    if (!(ms > 0 && ms <= 15000)) ms = TYPING_FALLBACK_MS;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, ms);
    setTheyType(true);
  }

  // A new message from them also ends "typing…" (no realtime event needed).
  const newestTheirsId = [...(messages ?? [])].reverse().find((m) => m.sender_member_id !== myId)?.message_id;
  const seenTheirs = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seenTheirs.current !== undefined && newestTheirsId !== seenTheirs.current) stopTypingRef.current();
    seenTheirs.current = newestTheirsId;
  }, [newestTheirsId]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      aborts.current.forEach((abort) => abort());
    },
    []
  );

  function changeDraft(text: string) {
    setDraft(text);
    const now = Date.now();
    if (!text.trim() || !canSendOnline || now - lastTypingSent.current < TYPING_EVERY_MS) return;
    lastTypingSent.current = now;
    coreApi.sendTyping(conversationId).catch(() => {});
  }

  function showNote(note: string) {
    setComposerNote(note);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setComposerNote(null), NOTE_FOR_MS);
  }

  const patchOutgoing = (id: string, change: Partial<Outgoing>) =>
    setOutbox((current) => current.map((o) => (o.message_id === id ? { ...o, ...change } : o)));
  const dropOutgoing = (id: string) => setOutbox((current) => current.filter((o) => o.message_id !== id));

  async function deliver(item: Outgoing) {
    if (sending.current.has(item.message_id)) return;
    sending.current.add(item.message_id);
    patchOutgoing(item.message_id, { status: 'pending', errorText: undefined });
    try {
      let file = item.file;
      if (file && !file.fileAssetId) {
        const upload = uploadAttachment(conversationId, file.local, file.uploadKey, (fraction) => {
          // Re-render on whole percents only.
          const pct = Math.round(fraction * 100);
          if (lastProgress.current.get(item.message_id) === pct) return;
          lastProgress.current.set(item.message_id, pct);
          setOutbox((current) =>
            current.map((o) => (o.message_id === item.message_id && o.file ? { ...o, file: { ...o.file, progress: fraction } } : o))
          );
        });
        aborts.current.set(item.message_id, upload.abort);
        try {
          const uploaded = await upload.done;
          rememberSent(uploaded.file_asset_id, file.local);
          file = { ...file, fileAssetId: uploaded.file_asset_id, progress: 1 };
          patchOutgoing(item.message_id, { file });
        } finally {
          aborts.current.delete(item.message_id);
          lastProgress.current.delete(item.message_id);
        }
      }
      const sent = await coreApi.sendMessage(
        conversationId,
        file?.fileAssetId
          ? {
              message_id: item.message_id,
              message_type: 'FILE',
              file_asset_id: file.fileAssetId,
              ...(item.body ? { body: item.body } : {}),
              client_sent_at: item.client_sent_at,
            }
          : {
              message_id: item.message_id,
              body: item.body,
              message_type: 'TEXT',
              client_sent_at: item.client_sent_at,
            },
        { idempotencyKey: item.idempotencyKey }
      );
      // The 201 is authoritative: upsert by message_id.
      setMessages((current) => mergeMessages(current ?? [], [sent]));
    } catch (e) {
      if (__DEV__) console.warn(`Send failed (${errorCode(e)})`);
      const status = e instanceof ApiError ? e.status : 0;
      const code = errorCode(e);
      const correlationId = e instanceof ApiError ? e.correlationId : undefined;
      if (item.file) {
        // Cancelled by the member.
        if (code === 'ABORTED') {
          dropOutgoing(item.message_id);
          return;
        }
        // Sent before (a retry after a lost answer): fetch it.
        if (code === 'ATTACHMENT_ALREADY_USED') {
          dropOutgoing(item.message_id);
          sync();
          return;
        }
        // The upload expired (24 h) or isn't usable: upload again, new key.
        // Stays pending, so the next poll sends it.
        if (code === 'ATTACHMENT_NOT_AVAILABLE' || code === 'ATTACHMENT_NOT_FOUND') {
          const attempts = item.attempts + 1;
          patchOutgoing(item.message_id, {
            attempts,
            correlationId,
            status: attempts < MAX_SERVER_ERROR_ATTEMPTS ? 'pending' : 'failed',
            file: { ...item.file, fileAssetId: undefined, uploadKey: newIdempotencyKey(), progress: undefined },
          });
          return;
        }
        const refused = attachmentError(e);
        if (refused) {
          patchOutgoing(item.message_id, { status: 'failed', correlationId, retryable: false, errorText: refused });
          return;
        }
      }
      // No internet: the same message goes over Bluetooth (and to Ol-ga later).
      // Files can't go over Bluetooth: they wait for Ol-ga instead.
      if (status === 0 && !item.file && peerId && chat.peerFor(peerId)) {
        setNetworkDown(true);
        dropOutgoing(item.message_id);
        chat.sendNearby(peerId, item.body, {
          id: item.message_id,
          key: item.idempotencyKey,
          sentAt: item.client_sent_at,
        });
        return;
      }
      // Timeout, no answer or Ol-ga starting up: stays pending, the next poll
      // sends it again unchanged.
      if (status === 0 || status === 502 || status === 503 || status === 504) {
        if (status === 0) setNetworkDown(true);
        patchOutgoing(item.message_id, { correlationId });
        return;
      }
      if (status === 500) {
        const attempts = item.attempts + 1;
        patchOutgoing(item.message_id, { attempts, correlationId, status: attempts < MAX_SERVER_ERROR_ATTEMPTS ? 'pending' : 'failed' });
        return;
      }
      // The key already went with this message: it's saved. Fetch it.
      if (code === 'IDEMPOTENCY_KEY_REUSED') {
        dropOutgoing(item.message_id);
        sync();
        return;
      }
      if (status === 404) {
        navigation.goBack(); // the list refreshes on focus
        return;
      }
      patchOutgoing(item.message_id, { status: 'failed', correlationId, retryable: code !== 'IDEMPOTENCY_KEY_REQUIRED' });
      if (handleUnavailable(e)) return;
      // can_send may have changed (blocked, closed): refresh the header.
      if (status === 403)
        coreApi
          .getConversation(conversationId)
          .then(setConversation)
          .catch(() => {});
    } finally {
      sending.current.delete(item.message_id);
    }
  }
  deliverRef.current = deliver;

  // A nudge, not a block: abusive-looking text asks first (works offline too).
  function send(body: string) {
    if (isOffensive(body)) setOffensiveDraft(body);
    else sendNow(body);
  }

  function sendNow(body: string) {
    if (!canSendOnline) {
      if (peerId) chat.sendNearby(peerId, body);
      setDraft('');
      return;
    }
    const item: Outgoing = {
      message_id: newIdempotencyKey(),
      idempotencyKey: newIdempotencyKey(),
      body,
      client_sent_at: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      retryable: true,
    };
    setOutbox((current) => [...current, item]);
    deliver(item);
  }

  // A photo, PDF or voice note; whatever is typed goes with it as the caption.
  function sendFile(local: LocalFile) {
    const problem = checkFile(local);
    if (problem) {
      showNote(problem);
      return;
    }
    const caption = local.type.startsWith('audio/') ? '' : draft.trim();
    if (caption) setDraft('');
    const item: Outgoing = {
      message_id: newIdempotencyKey(),
      idempotencyKey: newIdempotencyKey(),
      body: caption,
      client_sent_at: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      retryable: true,
      file: { local, uploadKey: newIdempotencyKey(), progress: 0 },
    };
    setOutbox((current) => [...current, item]);
    deliver(item);
  }

  function cancelUpload(item: Outgoing) {
    const abort = aborts.current.get(item.message_id);
    if (abort) abort();
    else dropOutgoing(item.message_id);
  }

  async function attach(pickFile: () => Promise<PickResult>) {
    setSheet(null);
    // Let the sheet slide away before the picker comes up.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 300));
    const result = await pickFile();
    if (!result) return;
    if ('error' in result) showNote(result.error);
    else sendFile(result.file);
  }

  // Hold the mic: record while held, send on release.
  async function recordStart() {
    if (!canSendOnline || recordingRef.current) return;
    wantsRecording.current = true;
    const allowed = await askMicrophone();
    if (!allowed) {
      showNote('Allow microphone access in Settings to send voice messages.');
      return;
    }
    // Let go while the permission prompt was up.
    if (!wantsRecording.current) return;
    recordingRef.current = true;
    stopPlayback();
    setRecordingMs(0);
    try {
      // A tick can still arrive just after release: ignore it, or the
      // recording pill comes back.
      await startRecording(
        (ms) => {
          if (recordingRef.current) setRecordingMs(ms);
        },
        () => recordEnd(false)
      );
    } catch {
      recordingRef.current = false;
      setRecordingMs(null);
      showNote('Couldn’t start recording. Please try again.');
    }
  }

  async function recordEnd(cancelled: boolean) {
    wantsRecording.current = false;
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecordingMs(null);
    if (cancelled) {
      cancelRecording();
      return;
    }
    const note = await stopRecording().catch(() => null);
    if (note) sendFile(note);
    else showNote('Hold to record, release to send.');
  }

  function openSheet(next: Sheet) {
    setSheetError(null);
    setSheetBusy(false);
    setSheet(next);
  }

  function closeSheet() {
    if (sheetBusy) return;
    setSheet(null);
    setReportCategory(null);
    setReportNote('');
  }

  async function runSheetAction(action: () => Promise<void>, failure: (code: string) => string) {
    setSheetBusy(true);
    setSheetError(null);
    try {
      await action();
    } catch (e) {
      if (__DEV__) console.warn(`Chat action failed (${errorCode(e)})`);
      setSheetError(failure(errorCode(e)));
    } finally {
      setSheetBusy(false);
    }
  }

  function deleteMessage(message: ChatMessage, idempotencyKey: string) {
    runSheetAction(
      async () => {
        try {
          await coreApi.deleteMessage(message.message_id, { idempotencyKey });
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) throw e;
          // Gone on the server: drop it here too.
          setMessages((current) => (current ?? []).filter((m) => m.message_id !== message.message_id));
          setSheet(null);
          return;
        }
        const deletedAt = new Date().toISOString();
        setMessages((current) =>
          (current ?? []).map((m) => (m.message_id === message.message_id ? { ...m, body: undefined, deleted_at: deletedAt } : m))
        );
        setSheet(null);
      },
      (code) =>
        code === 'MESSAGE_DELETE_FORBIDDEN'
          ? 'You can only delete your own messages.'
          : "Couldn't delete the message. Try again."
    );
  }

  function submitReport(message: ChatMessage) {
    if (!reportCategory) return;
    runSheetAction(
      async () => {
        const note = reportNote.trim() || undefined;
        if (onServer.has(message.message_id) && !networkDown) {
          await coreApi.reportMessage(message.message_id, {
            category: reportCategory,
            ...(note ? { description: note } : {}),
          });
        } else {
          // Over Bluetooth, or no internet: reported as soon as Ol-ga has it.
          chat.reportMessage(message.message_id, reportCategory, note);
        }
        setSheet({ kind: 'reported' });
      },
      (code) =>
        code === 'MESSAGE_REPORT_FORBIDDEN'
          ? "You can't report this message."
          : code === 'MESSAGE_NOT_FOUND'
          ? 'This message no longer exists.'
          : code === 'MESSAGE_REPORT_INVALID'
          ? 'Check the report and try again.'
          : "Couldn't send the report. Try again."
    );
  }

  function block() {
    const target = conversation?.member_id ?? peerId;
    if (!target) return;
    runSheetAction(
      async () => {
        // On this phone straight away (Bluetooth included); Ol-ga gets it now
        // or as soon as it can be reached.
        chat.blockPeer(target);
        // The conversation is closed to both members from now on (dev
        // answers 403 CONVERSATION_FORBIDDEN), so leave the thread.
        setSheet(null);
        setUnavailable(`You blocked ${name}. They can't message you any more.`);
      },
      () => "Couldn't block this member. Try again."
    );
  }

  function mute(ms: number | null) {
    runSheetAction(
      async () => {
        setConversation(await coreApi.muteConversation(conversationId, ms === null ? null : new Date(Date.now() + ms).toISOString()));
        setSheet(null);
      },
      () => "Couldn't update notifications. Try again."
    );
  }

  // ✓ / ✓✓ / seen for my messages, from the header's through-sequences.
  const deliveredThrough = conversation?.other_delivered_through_sequence ?? 0;
  const readThrough = conversation?.other_read_through_sequence ?? 0;
  const tickFor = (m: ChatMessage) =>
    m.server_sequence <= readThrough ? 'read' : m.server_sequence <= deliveredThrough ? 'delivered' : 'sent';
  // Polls also refresh the header while one of mine isn't seen yet.
  const unseen = (messages ?? []).some((m) => m.sender_member_id === myId && !m.deleted_at && m.server_sequence > readThrough);
  useEffect(() => {
    needsHeader.current = unseen;
  });

  // Bluetooth messages Ol-ga doesn't have (yet), shown with the rest.
  const onServer = new Set((messages ?? []).map((m) => m.message_id));
  const local = peerId ? chat.messagesWith(peerId).filter((m) => !onServer.has(m.id)) : [];
  const canSendOnline = Boolean(conversation?.can_send) && !networkDown;
  // Only connected members, and never where Ol-ga has closed the conversation.
  const canSendNearby = Boolean(peer) && !(conversation && !conversation.can_send);
  const canSend = canSendOnline || canSendNearby;
  const reach = peerId ? chat.reach(peerId) : 'out-of-range';

  // One list with Today / Yesterday / date sections. Ol-ga's messages go by
  // server_sequence only (`messages` is kept sorted), then Bluetooth-only
  // ones, then what's still sending, each of those by when it was written.
  // Never by clock across the groups: phone clocks drift.
  type Row = { kind: 'msg'; key: string; at: string; node: React.ReactNode } | { kind: 'day'; key: string; label: string };
  const byWritten = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
  const rows: { at: string; key: string; node: React.ReactNode }[] = [
    ...(messages ?? []).map((m) => {
      const mine = m.sender_member_id === myId;
      const deleted = Boolean(m.deleted_at);
      return {
        at: m.created_at,
        key: m.message_id,
        node: (
          <ChatBubble
            person
            key={m.message_id}
            from={mine ? 'me' : 'them'}
            text={m.body ?? ''}
            media={m.attachment ? <ChatAttachment mine={mine} messageId={m.message_id} attachment={m.attachment} /> : undefined}
            deleted={deleted}
            hidden={!deleted && hiddenFor(m.message_id, mine ? 'me' : 'them', m.body)}
            onPress={!deleted && hiddenFor(m.message_id, mine ? 'me' : 'them', m.body) ? () => reveal(m.message_id) : undefined}
            time={formatClock(m.created_at)}
            tick={mine && !deleted ? tickFor(m) : undefined}
            onLongPress={deleted ? undefined : () => openSheet({ kind: mine ? 'mine' : 'theirs', message: m })}
          />
        ),
      };
    }),
    ...local
      .map((m) => ({
      at: m.sentAt,
      key: m.id,
      node: (
        <ChatBubble
          key={m.id}
          person
          from={m.from}
          text={m.body}
          hidden={hiddenFor(m.id, m.from, m.body)}
          onPress={hiddenFor(m.id, m.from, m.body) ? () => reveal(m.id) : undefined}
          time={localStatus(m)}
          onLongPress={
            m.from === 'them'
              ? () =>
                  openSheet({
                    kind: 'theirs',
                    message: {
                      message_id: m.id,
                      conversation_id: conversationId,
                      sender_member_id: m.peer,
                      message_type: 'TEXT',
                      body: m.body,
                      server_sequence: 0,
                      moderation_status: 'NEARBY',
                      created_at: m.sentAt,
                    },
                  })
              : undefined
          }
        />
      ),
    }))
      .sort(byWritten),
    // Until the server copy shows up; never both at once.
    ...outbox
      .filter((o) => !onServer.has(o.message_id))
      .map((o) => ({
        at: o.client_sent_at,
        key: o.message_id,
        node: (
          <ChatBubble
            key={o.message_id}
            person
            from="me"
            text={o.body}
            status={o.status}
            failedText={o.errorText}
            media={
              o.file ? (
                <ChatAttachment
                  mine
                  local={o.file.local}
                  progress={o.status === 'pending' && !o.file.fileAssetId ? o.file.progress ?? 0 : undefined}
                  onCancel={() => cancelUpload(o)}
                />
              ) : undefined
            }
            onRetry={o.retryable ? () => deliver({ ...o, attempts: 0 }) : undefined}
            onLongPress={o.status === 'failed' ? () => dropOutgoing(o.message_id) : undefined}
          />
        ),
      }))
      .sort(byWritten),
  ];
  const thread: Row[] = [];
  rows.forEach((r, i) => {
    if (i === 0 || dayKey(rows[i - 1].at) !== dayKey(r.at)) thread.push({ kind: 'day', key: `day-${dayKey(r.at)}-${i}`, label: formatDayLabel(r.at) });
    thread.push({ kind: 'msg', ...r });
  });

  // While scrolling, the day of what's at the top floats there.
  const onThreadScroll = (y: number) => {
    const above = Object.values(dayOffsets.current)
      // Only once its own section chip has scrolled out of view (no double chip).
      .filter((d) => d.y + 28 < y)
      .sort((a, b) => b.y - a.y)[0];
    setFloatingDay(above ? above.label : null);
    if (floatTimer.current) clearTimeout(floatTimer.current);
    floatTimer.current = setTimeout(() => setFloatingDay(null), 1500);
  };

  // Auto-scroll to the newest message when something is added.
  const itemCount = (messages?.length ?? 0) + outbox.length + local.length;
  useEffect(() => {
    if (itemCount > 0) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [itemCount]);

  const displayName = conversation?.display_name || peer?.name;
  const name = displayName || FALLBACK_NAME;
  const firstName = displayName?.split(/\s+/)[0];

  if (!conversationId && !peer && !unavailable) {
    return (
      <Screen>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.h3}>This conversation isn't available any more.</Text>
        <Button label="Back to Chat" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (unavailable) {
    return (
      <Screen>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.h3}>{unavailable}</Text>
        <Button label="Back to Chat" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={styles.ground} contentStyle={[styles.screen, { paddingBottom: 12 + bottom }]}>
      {/* Who you're talking to sits right beside the arrow. */}
      <BackHeader
          chevron
        onBack={() => navigation.goBack()}
        left={
          <View style={styles.header}>
            <Avatar initials={displayName ? getInitials(displayName) : '?'} size="sm" light memberId={displayName && peerId ? peerId : undefined} />
            <View style={styles.headerText}>
              <Text style={styles.h3} numberOfLines={1}>
                {conversation || peer ? name : ' '}
              </Text>
              {theyType ? (
                <Text style={styles.typing}>typing…</Text>
              ) : conversation?.muted_until ? (
                <View style={styles.mutedRow}>
                  <BellOff size={12} color={colors.muted} />
                  <Text style={styles.small}>Muted</Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        right={
          <Pressable
            onPress={() => (conversation || peer) && openSheet({ kind: 'menu' })}
            style={styles.menu}
            hitSlop={8}
            accessibilityLabel="Conversation options"
          >
            <EllipsisVertical size={22} color={colors.text} />
          </Pressable>
        }
      />

      {/* The chat area only: doodles and a faint Ol-ga mark behind the
          messages (never over the header or composer, never take a touch). */}
      <View style={styles.thread}>
        <ChatWallpaper />
        <View style={styles.watermark} pointerEvents="none">
          <Text style={styles.watermarkText}>Ol-ga</Text>
        </View>
        <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent} keyboardShouldPersistTaps="handled"
          onScroll={(e) => onThreadScroll(e.nativeEvent.contentOffset.y)}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={64}
        >
          {(conversation || peer) && (
            <View style={styles.connected}>
              <Text style={styles.eyebrow}>You're connected</Text>
              {(conversation?.headline || conversation?.role_category || peer?.headline) && (
                <Text style={styles.sub}>
                  {conversation ? [conversation.headline, conversation.role_category].filter(Boolean).join(' · ') : peer?.headline}
                </Text>
              )}
            </View>
          )}

          {messages === null && !loadError && !networkDown && conversationId !== '' && (
            <ActivityIndicator color={colors.brand} style={styles.loading} />
          )}
          {loadError && <Text style={styles.error}>{loadError}</Text>}
          {(messages?.length ?? 0) === 0 &&
            outbox.length === 0 &&
            local.length === 0 &&
            (messages !== null || networkDown || !conversationId) && (
              <Text style={[styles.sub, styles.center]}>No messages yet. Say hello to {firstName ?? 'your connection'}.</Text>
            )}

          {thread.map((item) =>
            item.kind === 'day' ? (
              <View
                key={item.key}
                style={styles.dayRow}
                onLayout={(e) => {
                  dayOffsets.current[item.key] = { y: e.nativeEvent.layout.y, label: item.label };
                }}
              >
                <Text style={styles.dayChip}>{item.label}</Text>
              </View>
            ) : (
              item.node
            )
          )}
        </ScrollView>
        {floatingDay && (
          <View style={styles.floatingDay} pointerEvents="none">
            <Text style={styles.dayChip}>{floatingDay}</Text>
          </View>
        )}
      </View>

      <View style={styles.composerBar}>
        {conversation && !conversation.can_send && <Text style={styles.note}>{cantSendNote(conversation)}</Text>}
        {!canSendOnline && canSendNearby && (
          <View style={styles.nearbyNote}>
            <Text style={styles.noteSmall} numberOfLines={1}>
              {nearbyNote(reach, firstName ?? 'them')}
              {reach === 'ready' && (
                <View style={styles.lock}>
                  <Lock size={10} color={colors.muted} strokeWidth={2.2} />
                </View>
              )}
            </Text>
            {reach === 'key-changed' && peerId && <Pill label="Trust new phone" tone="active" onPress={() => chat.trustNewKey(peerId)} />}
          </View>
        )}
        {/* Quick replies sit right above the input, and step aside while typing. */}
        {canSend && !draft.trim() && recordingMs === null && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quickReplies}>
            {QUICK_REPLIES.map((q) => (
              <Pill key={q.label} label={q.label} tone="white" onPress={() => setDraft(q.text)} />
            ))}
          </ScrollView>
        )}
        {composerNote && <Text style={styles.note}>{composerNote}</Text>}
        <ChatComposer
          placeholder={firstName ? `Message ${firstName}…` : 'Message…'}
          value={draft}
          onChangeText={changeDraft}
          onSubmit={send}
          disabled={!canSend}
          maxLength={canSendOnline ? MAX_BODY : MAX_NEARBY_BODY}
          // Files and voice notes need Ol-ga (never over Bluetooth).
          onAttach={canSendOnline ? () => openSheet({ kind: 'attach' }) : undefined}
          onRecordStart={canSendOnline ? recordStart : undefined}
          onRecordEnd={canSendOnline ? recordEnd : undefined}
          recordingMs={recordingMs}
        />
      </View>

      <ConfirmDialog
        visible={offensiveDraft !== null}
        icon={ShieldAlert}
        title="This might come across as offensive"
        message="Ol-ga is for professional connections. Edit your message?"
        primaryLabel="Edit message"
        onPrimary={() => {
          setDraft(offensiveDraft ?? '');
          setOffensiveDraft(null);
        }}
        secondaryLabel="Send anyway"
        onSecondary={() => {
          const body = offensiveDraft;
          setOffensiveDraft(null);
          if (body) sendNow(body);
        }}
        onDismiss={() => {
          setDraft(offensiveDraft ?? '');
          setOffensiveDraft(null);
        }}
      />

      <BottomSheet visible={sheet !== null} onClose={closeSheet} title={sheetTitle(sheet, name)} subtitle={sheetSubtitle(sheet, name)}>
        {sheet?.kind === 'mine' && (
          <SheetGroup>
            <SheetOption
              label="Delete message"
              danger
              onPress={() => openSheet({ kind: 'confirmDelete', message: sheet.message, idempotencyKey: newIdempotencyKey() })}
            />
          </SheetGroup>
        )}
        {sheet?.kind === 'confirmDelete' && (
          <>
            <Button label="Delete" loading={sheetBusy} onPress={() => deleteMessage(sheet.message, sheet.idempotencyKey)} />
            <Button label="Cancel" variant="secondary" disabled={sheetBusy} onPress={closeSheet} />
          </>
        )}
        {sheet?.kind === 'theirs' && (
          <SheetGroup>
            <SheetOption label="Report message" onPress={() => openSheet({ kind: 'report', message: sheet.message })} />
            <SheetOption label={`Block ${firstName ?? 'this member'}`} danger onPress={() => openSheet({ kind: 'confirmBlock' })} />
          </SheetGroup>
        )}
        {sheet?.kind === 'report' && (
          <>
            <SheetChoices options={REPORT_CATEGORIES} value={reportCategory} onChange={setReportCategory} />
            <TextInput
              value={reportNote}
              onChangeText={setReportNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.muted}
              style={styles.noteInput}
              multiline
              maxLength={MAX_REPORT_NOTE}
            />
            <Button label="Send report" loading={sheetBusy} disabled={!reportCategory} onPress={() => submitReport(sheet.message)} />
          </>
        )}
        {sheet?.kind === 'reported' && (
          <>
            <Button label="Done" onPress={closeSheet} />
            {conversation?.can_send && (
              <Button
                label={`Block ${firstName ?? 'this member'}`}
                variant="secondary"
                onPress={() => openSheet({ kind: 'confirmBlock' })}
              />
            )}
          </>
        )}
        {sheet?.kind === 'confirmBlock' && (
          <>
            <Button label="Block" loading={sheetBusy} onPress={block} />
            <Button label="Cancel" variant="secondary" disabled={sheetBusy} onPress={closeSheet} />
          </>
        )}
        {sheet?.kind === 'menu' && (
          <SheetGroup>
            {conversation && !networkDown && <SheetOption label="Mute notifications" onPress={() => openSheet({ kind: 'mute' })} />}
            {peerId && (
              <SheetOption
                label={`Report ${firstName ?? 'this member'}`}
                onPress={() => {
                  closeSheet();
                  // Let this sheet slide away before the report sheet comes up.
                  setTimeout(() => setReportingMember(true), 300);
                }}
              />
            )}
            <SheetOption label={`Block ${firstName ?? 'this member'}`} danger onPress={() => openSheet({ kind: 'confirmBlock' })} />
          </SheetGroup>
        )}
        {sheet?.kind === 'attach' && (
          <SheetGroup>
            <SheetOption label="Take a photo" onPress={() => attach(() => pickPhoto('camera'))} />
            <SheetOption label="Choose a photo" onPress={() => attach(() => pickPhoto('library'))} />
            <SheetOption label="PDF document" onPress={() => attach(pickPdf)} />
          </SheetGroup>
        )}
        {sheet?.kind === 'mute' && (
          <SheetGroup>
            {MUTE_OPTIONS.map((o) => (
              <SheetOption key={o.label} label={o.label} onPress={() => mute(o.ms)} />
            ))}
            {conversation?.muted_until && <SheetOption label="Unmute" onPress={() => mute(null)} />}
          </SheetGroup>
        )}
        {sheetError && <Text style={styles.error}>{sheetError}</Text>}
      </BottomSheet>

      {peerId && (
        <ReportMemberSheet
          visible={reportingMember}
          onClose={() => setReportingMember(false)}
          target={{ memberId: peerId }}
          who={firstName ?? displayName}
        />
      )}
    </Screen>
  );
}

function sheetTitle(sheet: Sheet | null, name: string) {
  switch (sheet?.kind) {
    case 'mine':
    case 'theirs':
      return 'Message';
    case 'confirmDelete':
      return 'Delete this message?';
    case 'report':
      return 'Report message';
    case 'reported':
      return 'Thanks, our team will review it';
    case 'confirmBlock':
      return `Block ${name}?`;
    case 'mute':
      return 'Mute conversation';
    case 'attach':
      return 'Send';
    case 'menu':
      return name;
    default:
      return undefined;
  }
}

function sheetSubtitle(sheet: Sheet | null, name: string) {
  switch (sheet?.kind) {
    case 'confirmDelete':
      return 'It will show as "This message was deleted" for both of you.';
    case 'report':
      return 'Why are you reporting this message? Only our team sees your report.';
    case 'reported':
      return `${name} won't know you reported this message.`;
    case 'confirmBlock':
      return "They won't be able to message you, and they won't be told you blocked them.";
    case 'mute':
      return "You won't be notified about new messages while muted.";
    case 'attach':
      return 'Photos and PDFs up to 10 MB. Anything typed goes with it as a caption.';
    default:
      return undefined;
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, paddingBottom: 12 },
    ground: { backgroundColor: colors.chatGround },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: -8,
    },
    watermark: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Thin, not bold: a mark in the background, not a heading.
    watermarkText: {
      fontFamily: Platform.OS === 'android' ? 'sans-serif-thin' : fonts.bodyRegular,
      fontSize: 72,
      fontWeight: '200',
      color: colors.text,
      opacity: 0.07,
    },
    headerText: { flex: 1 },
    mutedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    // Just the three vertical dots, the tap area stays 38 x 38.
    menu: { width: 38, height: 38, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
    eyebrow: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.text,
      fontWeight: semibold,
    },
    h3: {
      fontFamily: fonts.headingBold,
      fontSize: 16,
      fontWeight: semibold,
      color: colors.text,
    },
    sub: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6 },
    small: { fontSize: 12, color: colors.muted },
    typing: { fontSize: 12, color: colors.brand, marginTop: 2 },
    center: { textAlign: 'center', marginTop: 18 },
    error: { fontSize: 14, color: colors.danger },
    loading: { marginTop: 24 },
    thread: { flex: 1 },
    dayRow: { alignItems: 'center', marginVertical: 4 },
    dayChip: {
      fontSize: 11,
      fontWeight: semibold,
      color: colors.muted,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    floatingDay: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' },
    threadContent: { gap: 10, paddingBottom: 12 },
    connected: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.lg,
      padding: 16,
      marginBottom: 8,
    },
    quickReplies: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
    composerBar: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: 10,
    },
    note: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    nearbyNote: { alignItems: 'center', gap: 8 },
    noteSmall: { fontSize: 10, color: colors.muted, textAlign: 'center' },
    lock: { paddingLeft: 3, transform: [{ translateY: 1 }] },
    noteInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: 12,
      minHeight: 72,
      color: colors.text,
      fontSize: 14,
      textAlignVertical: 'top',
    },
  });
