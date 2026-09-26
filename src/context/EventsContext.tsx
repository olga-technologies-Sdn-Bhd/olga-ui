import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { coreApi, CoreEvent } from '../api/core';
import { useAuth } from './AuthContext';

type EventsState = {
  events: CoreEvent[] | null; // null until the first load finishes
  error: string | null;
  refresh: () => Promise<void>;
  // POST /v1/events/{id}/register, then marks the event registered right away
  // and refetches in the background (attendee_count). Throws ApiError.
  register: (eventId: string) => Promise<void>;
};

const EventsContext = createContext<EventsState | undefined>(undefined);

// is_registered comes from the server (GET /v1/events with X-Member-Id); a
// missing field (no member / older server) means not registered.
export function isRegistered(event: CoreEvent) {
  return event.is_registered === true;
}

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CoreEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const { memberId } = useAuth();

  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const data = await coreApi.getEvents();
      if (seq !== loadSeq.current) return; // a newer load won
      setEvents(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) {
        console.warn(`Events load failed (${e.code}): ${e.message}, correlation_id=${e.correlationId ?? 'none'}`);
      }
      if (seq !== loadSeq.current) return;
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't load events (${e.status})` : "Couldn't reach the server");
      setEvents((prev) => prev ?? []);
    }
  }, []);

  // is_registered is per member: drop the previous member's list and reload.
  useEffect(() => {
    loadSeq.current++;
    setEvents(null);
    setError(null);
    if (memberId) refresh();
  }, [memberId, refresh]);

  const register = useCallback(
    async (eventId: string) => {
      try {
        await coreApi.registerForEvent(eventId);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'EVENT_NOT_FOUND') refresh();
        throw e;
      }
      setEvents((prev) => prev?.map((ev) => (ev.event_id === eventId ? { ...ev, is_registered: true } : ev)) ?? prev);
      refresh();
    },
    [refresh]
  );

  const value = useMemo(() => ({ events, error, refresh, register }), [events, error, refresh, register]);
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
