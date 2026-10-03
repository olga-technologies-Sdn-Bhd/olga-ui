import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { coreApi } from '../api/core';
import { findMatches, MatchCard } from '../api/matching';
import type { LiveModeSession } from '../api/types';
import {
  LIVE_MODE_CONSENT_POLICY_VERSION,
  LIVE_MODE_DURATION_MINUTES,
  PRESENCE_DEFAULT_CELL,
  PRESENCE_INTERVAL_MS,
} from '../config/env';
import { useAuth } from './AuthContext';

export type Seniority = 'any' | 'director' | 'c-level';

export type MatchFilters = {
  minMatch: number;
  lookingFor: string[];
  industries: string[];
  seniority: Seniority;
  allowNearMatches: boolean;
  shareIntentChanges: boolean;
};

const DEFAULT_FILTERS: MatchFilters = {
  minMatch: 74,
  lookingFor: ['Distribution partners', 'Investors', 'Talent suppliers'],
  industries: ['Telco', 'Government / GLC', 'Education'],
  seniority: 'director',
  allowNearMatches: false,
  shareIntentChanges: true,
};

type ActiveEvent = { eventId: string; name: string; endsAt: string; liveCount?: number; matchCount?: number } | null;

// Matches the prototype's pre-filled sample intent on the Home screen.
const SAMPLE_INTENT = 'Find telco / GLC distribution partners for an AI workforce platform';

// What goLive() couldn't do, in terms the screen can act on. The server
// checks in this order: event, duration, registration, consent, event
// window, live_mode_enabled.
export type GoLiveBlocker =
  | 'CONSENT_REQUIRED' // ask the user, then grantLiveModeConsent() and retry
  | 'REGISTRATION_REQUIRED'
  | 'EVENT_NOT_ACTIVE'
  | 'LIVE_MODE_NOT_ENABLED'
  | 'EVENT_NOT_FOUND';

const BLOCKERS: Record<string, GoLiveBlocker> = {
  LIVE_MODE_CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  EVENT_REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  EVENT_NOT_ACTIVE: 'EVENT_NOT_ACTIVE',
  LIVE_MODE_NOT_ENABLED: 'LIVE_MODE_NOT_ENABLED',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
};

type LiveState = {
  activeEvent: ActiveEvent;
  setActiveEvent: (event: ActiveEvent) => void;
  // Live while the server session's active_until is in the future.
  isLive: boolean;
  activeUntil: Date | null;
  // Starts (or extends) Live Mode for activeEvent. Resolves with a blocker
  // the screen should handle, or null when live. Throws ApiError otherwise.
  goLive: () => Promise<GoLiveBlocker | null>;
  // Records a LIVE_MODE consent decision (GRANTED) for the current policy.
  grantLiveModeConsent: () => Promise<void>;
  stopLive: () => Promise<void>;
  // What the member is looking for (Home "Your intent"); saved as the WANT
  // intent for the active event when matching runs.
  intentText: string;
  setIntentText: (text: string) => void;
  // Latest matches for the active event; null until matching has run.
  matches: MatchCard[] | null;
  // Saves the intent and runs a match request (src/api/matching.ts).
  // Throws MatchingError / ApiError; keeps the previous matches on failure.
  runMatching: () => Promise<MatchCard[]>;
  filters: MatchFilters;
  setFilters: (filters: MatchFilters) => void;
  sessionTags: string[];
  addSessionTag: (tag: string) => void;
  removeSessionTag: (tag: string) => void;
};

const LiveContext = createContext<LiveState | undefined>(undefined);

function logApiError(action: string, e: unknown) {
  if (e instanceof ApiError) console.warn(`${action} failed (${e.code}), correlation_id=${e.correlationId ?? 'none'}`);
}

// The member's OFFER is their profile headline + summary (the prototype has
// no separate "what I offer" field). Empty profile -> no offer.
async function profileOffer() {
  try {
    const p = await coreApi.getMyProfile();
    const text = [p.headline, p.professional_summary].filter((x) => x && x.trim()).join('. ');
    return text || undefined;
  } catch {
    return undefined;
  }
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { memberId } = useAuth();
  const [activeEvent, setActiveEvent] = useState<ActiveEvent>(null);
  const [session, setSession] = useState<LiveModeSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [sessionTags, setSessionTags] = useState<string[]>(['AI partnerships', 'Hiring', 'Malaysia market']);
  const sessionRef = useRef<LiveModeSession | null>(null);
  const [intentText, setIntentText] = useState(SAMPLE_INTENT);
  const [matches, setMatches] = useState<MatchCard[] | null>(null);

  const applySession = useCallback((next: LiveModeSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const activeUntil = session ? new Date(session.active_until) : null;
  const isLive = Boolean(activeUntil && activeUntil.getTime() > now);

  // Re-check every 30 s while live so isLive and the countdown follow active_until.
  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [session]);

  // Session ended by time: drop it.
  useEffect(() => {
    if (session && !isLive) applySession(null);
  }, [session, isLive, applySession]);

  // Signing out or switching member ends the local session and its matches.
  useEffect(() => {
    applySession(null);
    setMatches(null);
  }, [memberId, applySession]);

  // Matches belong to one event.
  useEffect(() => {
    setMatches(null);
  }, [activeEvent?.eventId]);

  // Presence heartbeat while live. 403 LIVE_MODE_NOT_ACTIVE means the
  // server ended the session (expired, consent withdrawn): stop.
  useEffect(() => {
    if (!session) return;
    const eventId = session.event_id;
    const beat = async () => {
      try {
        await coreApi.recordPresence(eventId, {
          coarse_cell: PRESENCE_DEFAULT_CELL,
          observed_at: new Date().toISOString(),
          source: 'CHECK_IN',
        });
      } catch (e) {
        logApiError('Presence', e);
        if (e instanceof ApiError && e.code === 'LIVE_MODE_NOT_ACTIVE' && sessionRef.current?.event_id === eventId) {
          applySession(null);
        }
      }
    };
    beat();
    const timer = setInterval(beat, PRESENCE_INTERVAL_MS);
    return () => clearInterval(timer);
    // Restart only when the session itself changes, not on every extend.
  }, [session?.session_id, session?.event_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goLive = useCallback(async (): Promise<GoLiveBlocker | null> => {
    if (!activeEvent) return 'EVENT_NOT_FOUND';
    try {
      const started = await coreApi.startLiveMode(activeEvent.eventId, { duration_minutes: LIVE_MODE_DURATION_MINUTES });
      applySession(started);
      return null;
    } catch (e) {
      logApiError('Start Live Mode', e);
      const blocker = e instanceof ApiError ? BLOCKERS[e.code] : undefined;
      if (blocker) return blocker;
      throw e;
    }
  }, [activeEvent, applySession]);

  const grantLiveModeConsent = useCallback(async () => {
    try {
      await coreApi.recordConsent({
        purpose_code: 'LIVE_MODE',
        policy_version: LIVE_MODE_CONSENT_POLICY_VERSION,
        decision: 'GRANTED',
        capture_channel: 'MOBILE',
        evidence: { screen: 'go_live_consent' },
      });
    } catch (e) {
      logApiError('Live Mode consent', e);
      throw e;
    }
  }, []);

  const stopLive = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    try {
      await coreApi.stopLiveMode(current.event_id);
    } catch (e) {
      // 404 LIVE_MODE_NOT_ACTIVE = already stopped/expired: that's success.
      if (!(e instanceof ApiError && e.code === 'LIVE_MODE_NOT_ACTIVE')) {
        logApiError('Stop Live Mode', e);
        throw e;
      }
    }
    applySession(null);
  }, [applySession]);

  const runMatching = useCallback(async () => {
    if (!activeEvent) return [];
    try {
      const found = await findMatches({
        eventId: activeEvent.eventId,
        eventEndsAt: activeEvent.endsAt,
        wantText: intentText,
        offerText: await profileOffer(),
        minMatchPercent: filters.minMatch,
      });
      setMatches(found);
      return found;
    } catch (e) {
      logApiError('Matching', e);
      throw e;
    }
  }, [activeEvent, intentText, filters.minMatch]);

  const addSessionTag = useCallback((tag: string) => {
    setSessionTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);
  const removeSessionTag = useCallback((tag: string) => {
    setSessionTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const value = useMemo(
    () => ({
      activeEvent,
      setActiveEvent,
      isLive,
      activeUntil: isLive ? activeUntil : null,
      goLive,
      grantLiveModeConsent,
      stopLive,
      intentText,
      setIntentText,
      matches,
      runMatching,
      filters,
      setFilters,
      sessionTags,
      addSessionTag,
      removeSessionTag,
    }),
    // activeUntil is derived from session; listing session keeps it stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEvent, isLive, session, goLive, grantLiveModeConsent, stopLive, intentText, matches, runMatching, filters, sessionTags, addSessionTag, removeSessionTag]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
}
