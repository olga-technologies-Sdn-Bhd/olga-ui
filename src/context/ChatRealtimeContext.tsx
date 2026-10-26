import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import type { ChatEvent } from '../api/types';
import { markDelivered } from '../chat/receipts';
import { coreApi } from '../api/core';
import { useAuth } from './AuthContext';

// Chat events from Core's /v1/realtime/chat (Azure SignalR), while the app is
// in the foreground. Events only say something changed: screens refetch over
// REST and keep polling as the backup, so a missed event or a dropped
// connection never loses a message.

// `null`: the connection came back, anything may have been missed.
type Listener = (event: ChatEvent | null) => void;

// TypingStarted.v1 comes straight from the API (no worker needed).
const KNOWN_EVENTS = new Set(['MessageCreated.v1', 'MessageDeleted.v1', 'ConversationRead.v1', 'TypingStarted.v1']);
const MAX_SEEN = 300;

const ChatRealtimeContext = createContext<{ subscribe: (listener: Listener) => () => void } | null>(null);

export function ChatRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { memberId } = useAuth();
  const listeners = useRef(new Set<Listener>());
  // At-least-once delivery: the same event_id can come twice.
  const seen = useRef(new Set<string>());

  const emit = useCallback((event: ChatEvent | null) => listeners.current.forEach((l) => l(event)), []);

  useEffect(() => {
    if (!memberId) return;
    let connection: HubConnection | null = null;
    let stopped = false;

    // The SignalR client's own negotiate edits URL.pathname, which React
    // Native's URL doesn't allow. So the app asks Core (X-Member-Id) for the
    // Azure SignalR address and token itself and opens the WebSocket straight
    // there; every (re)connect negotiates again for a fresh token.
    const connect = async () => {
      const first = await coreApi.negotiateChatRealtime();
      if (stopped) return;
      let firstToken: string | null = first.accessToken;
      const next = new HubConnectionBuilder()
        .withUrl(first.url, {
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
          accessTokenFactory: async () => {
            const token = firstToken ?? (await coreApi.negotiateChatRealtime()).accessToken;
            firstToken = null;
            return token;
          },
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.None)
        .build();
      connection = next;
      next.on('event', onEvent);
      next.onreconnected(() => emit(null));
      await next.start();
      emit(null);
    };

    // Must not return a value: SignalR would treat it as a reply.
    const onEvent = (event: ChatEvent) => {
      // Unknown types and versions (a future .v2) are skipped, not errors.
      if (!event?.event_id || !KNOWN_EVENTS.has(event.event_type) || !event.data?.conversation_id) return;
      if (seen.current.has(event.event_id)) return;
      seen.current.add(event.event_id);
      if (seen.current.size > MAX_SEEN) seen.current.delete(seen.current.values().next().value as string);
      // A message for me reached this phone: the sender's "delivered" tick.
      if (event.event_type === 'MessageCreated.v1' && event.data.recipient_member_id === memberId && event.data.message_id) {
        markDelivered(event.data.message_id);
      }
      emit(event);
    };

    let starting = false;
    const start = () => {
      if (stopped || starting || (connection && connection.state !== HubConnectionState.Disconnected)) return;
      starting = true;
      connect()
        .catch((e) => {
          if (__DEV__) console.warn(`Chat realtime unavailable (${e instanceof Error ? e.name : 'unknown'})`);
        })
        .finally(() => {
          starting = false;
        });
    };
    // Gave up reconnecting: the next foreground or retry tick tries again.
    const retry = setInterval(() => AppState.currentState === 'active' && start(), 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else if (state === 'background') connection?.stop();
    });
    if (AppState.currentState === 'active') start();
    return () => {
      stopped = true;
      clearInterval(retry);
      sub.remove();
      connection?.stop();
    };
  }, [memberId, emit]);

  const value = useMemo(
    () => ({
      subscribe: (listener: Listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    []
  );
  return <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>;
}

// Calls `listener` for each new chat event (and with null after a reconnect).
export function useChatEvents(listener: Listener) {
  const context = useContext(ChatRealtimeContext);
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  }, [listener]);
  useEffect(() => context?.subscribe((event) => ref.current(event)), [context]);
}
