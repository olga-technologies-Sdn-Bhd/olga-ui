import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../api/client';
import { coreApi, CoreEvent } from '../api/core';
import { useAuth } from './AuthContext';

type EventsState = {
  events: CoreEvent[] | null; // null until the first load finishes
  error: string | null;
  refresh: () => Promise<void>;
  // Screen focus: refetches only if the list is older than FOCUS_REFRESH_MS.
  refreshIfStale: () => void;
  // Latest data for an event (admins can edit name, times, venue); undefined
  // while loading or when it's gone from the list.
  getEvent: (eventId: string) => CoreEvent | undefined;
  // True once the list has loaded and this event is no longer in it: an
  // admin cancelled or unpublished it (GET /v1/events lists PUBLISHED only).
  isGone: (eventId: string) => boolean;
  // Called on 404 EVENT_NOT_FOUND from register / live-mode / presence.
  markGone: (eventId: string) => void;
  // POST /v1/events/{id}/register, then marks the event registered right away
  // and refetches in the background (attendee_count). Throws ApiError.
  register: (eventId: string) => Promise<void>;
};

const FOCUS_REFRESH_MS = 30000;

const EventsContext = createContext<EventsState | undefined>(undefined);

// is_registered comes from the server (GET /v1/events with X-Member-Id); a
// missing field (no member / older server) means not registered.
export function isRegistered(event: CoreEvent) {
  return event.is_registered === true;
}

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CoreEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const loadSeq = useRef(0);
  const lastLoadedAt = useRef(0);
  const eventsRef = useRef<CoreEvent[] | null>(null);
  // The cancellation notice is shown once per event.
  const notified = useRef<Set<string>>(new Set());
  const { memberId } = useAuth();

  const notifyCancelled = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !notified.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => notified.current.add(id));
    Alert.alert('Event cancelled', 'This event was cancelled.');
  }, []);

  const applyEvents = useCallback(
    (next: CoreEvent[]) => {
      const previous = eventsRef.current ?? [];
      const nextIds = new Set(next.map((e) => e.event_id));
      const removed = previous.filter((e) => !nextIds.has(e.event_id));
      eventsRef.current = next;
      setEvents(next);
      setGone((prev) => {
        const merged = new Set([...prev].filter((id) => !nextIds.has(id)));
        removed.forEach((e) => merged.add(e.event_id));
        return merged;
      });
      // Only events the member had signed up for get a notice.
      const cancelledForMember = removed.filter(isRegistered).map((e) => e.event_id);
      if (cancelledForMember.length) notifyCancelled(cancelledForMember);
    },
    [notifyCancelled]
  );

  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const data = await coreApi.getEvents();
      if (seq !== loadSeq.current) return; // a newer load won
      lastLoadedAt.current = Date.now();
      applyEvents(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) {
        console.warn(`Events load failed (${e.code}): ${e.message}, correlation_id=${e.correlationId ?? 'none'}`);
      }
      if (seq !== loadSeq.current) return;
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't load events (${e.status})` : "Couldn't reach the server");
      setEvents((prev) => prev ?? []);
    }
  }, [applyEvents]);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastLoadedAt.current >= FOCUS_REFRESH_MS) refresh();
  }, [refresh]);

  // is_registered is per member: drop the previous member's list and reload.
  useEffect(() => {
    loadSeq.current++;
    eventsRef.current = null;
    lastLoadedAt.current = 0;
    notified.current = new Set();
    setEvents(null);
    setGone(new Set());
    setError(null);
    if (memberId) refresh();
  }, [memberId, refresh]);

  const markGone = useCallback(
    (eventId: string) => {
      setGone((prev) => (prev.has(eventId) ? prev : new Set(prev).add(eventId)));
      notifyCancelled([eventId]);
      refresh();
    },
    [notifyCancelled, refresh]
  );

  const getEvent = useCallback((eventId: string) => events?.find((e) => e.event_id === eventId), [events]);
  const isGone = useCallback(
    (eventId: string) => gone.has(eventId) || (events !== null && !error && !events.some((e) => e.event_id === eventId)),
    [gone, events, error]
  );

  const register = useCallback(
    async (eventId: string) => {
      try {
        await coreApi.registerForEvent(eventId);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'EVENT_NOT_FOUND') markGone(eventId);
        throw e;
      }
      setEvents((prev) => prev?.map((ev) => (ev.event_id === eventId ? { ...ev, is_registered: true } : ev)) ?? prev);
      refresh();
    },
    [markGone, refresh]
  );

  const value = useMemo(
    () => ({ events, error, refresh, refreshIfStale, getEvent, isGone, markGone, register }),
    [events, error, refresh, refreshIfStale, getEvent, isGone, markGone, register]
  );
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
