import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../api/client';
import { coreApi } from '../api/core';
import { findMatches, MatchCard, MatchingError } from '../api/matching';
import type { ConsentDecision, LiveModeSession } from '../api/types';
import {
  LIVE_MODE_DURATION_MINUTES,
  PRESENCE_DEFAULT_CELL,
  PRESENCE_INTERVAL_MS,
} from '../config/env';
import { useAuth } from './AuthContext';
import { useEvents } from './EventsContext';
import { MatchFilters, usePrefs } from './PrefsContext';

type ActiveEvent = { eventId: string; name: string; endsAt: string; liveCount?: number } | null;

// What goLive() couldn't do, in terms the screen can act on. The server
// checks in this order: event, duration, registration, consent, event
// window, live_mode_enabled.
export type GoLiveBlocker =
  | 'CONSENT_REQUIRED' // ask the user, then recordConsentDecision('LIVE_MODE', 'GRANTED') and retry
  | 'REGISTRATION_REQUIRED'
  | 'EVENT_NOT_ACTIVE'
  | 'LIVE_MODE_NOT_ENABLED'
  | 'EVENT_NOT_FOUND' // cancelled or unpublished by an admin
  | 'TAKEN_OFFLINE'; // member's profile is no longer ACTIVE (admin action)

const BLOCKERS: Record<string, GoLiveBlocker> = {
  LIVE_MODE_CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  EVENT_REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  EVENT_NOT_LIVE: 'EVENT_NOT_ACTIVE',
  EVENT_NOT_ACTIVE: 'EVENT_NOT_ACTIVE', // pre-Core #27 name
  LIVE_MODE_DISABLED: 'LIVE_MODE_NOT_ENABLED',
  LIVE_MODE_NOT_ENABLED: 'LIVE_MODE_NOT_ENABLED', // pre-Core #27 name
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  MEMBER_NOT_ACTIVE: 'TAKEN_OFFLINE',
  PROFILE_NOT_FOUND: 'TAKEN_OFFLINE',
  MEMBER_NOT_REGISTERED: 'TAKEN_OFFLINE',
};

// Codes meaning the member's profile is no longer ACTIVE.
const OFFLINE_CODES = ['MEMBER_NOT_ACTIVE', 'PROFILE_NOT_FOUND', 'MEMBER_NOT_REGISTERED'];

// Consents the app asks for before Go Live. MATCHING: matching only
// considers members who granted it (requester and candidates).
export type ConsentPurpose = 'LIVE_MODE' | 'MATCHING';

// What checkConsent() found:
// GRANTED: already on record, don't ask. ASK: never answered, denied or withdrawn.
// NO_POLICY: 404 CONSENT_POLICY_NOT_ACTIVE, nothing to agree to; don't block.
// UNKNOWN: couldn't check (offline, server error); carry on and let the
// server decide (Live Mode still answers 403 LIVE_MODE_CONSENT_REQUIRED).
export type ConsentStatus = 'GRANTED' | 'ASK' | 'NO_POLICY' | 'UNKNOWN';

const TAKEN_OFFLINE_MESSAGE = "You've been taken offline. Contact support if you think this is a mistake.";

type LiveState = {
  activeEvent: ActiveEvent;
  setActiveEvent: (event: ActiveEvent) => void;
  // Live while the server session's active_until is in the future.
  isLive: boolean;
  activeUntil: Date | null;
  // Starts (or extends) Live Mode for activeEvent. Resolves with a blocker
  // the screen should handle, or null when live. Throws ApiError otherwise.
  goLive: () => Promise<GoLiveBlocker | null>;
  // The member's current decision for the active policy (GET
  // /v1/consent-policies/{purpose} current_decision). GRANTED is cached.
  checkConsent: (purpose: ConsentPurpose) => Promise<ConsentStatus>;
  // Records a decision for the active policy version. Throws ApiError.
  recordConsentDecision: (purpose: ConsentPurpose, decision: Exclude<ConsentDecision, 'WITHDRAWN'>) => Promise<void>;
  stopLive: () => Promise<void>;
  // What the member is looking for (Home "Your intent"); saved as the WANT
  // intent for the active event when matching runs.
  intentText: string;
  setIntentText: (text: string) => void;
  // Latest matches for the active event; null until matching has run.
  matches: MatchCard[] | null;
  // Saves the intent and runs a match request (src/api/matching.ts).
  // Throws MatchingError (CONSENT_DENIED when the member declined MATCHING)
  // / ApiError; keeps the previous matches on failure. Pass `next` with values
  // set in the same tick (state isn't updated until the next render).
  runMatching: (next?: { intentText?: string; minMatch?: number }) => Promise<MatchCard[]>;
  // Board 09: Pass is silent and only ever stored on this phone.
  passedIds: string[];
  pass: (memberId: string) => void;
  // Members this phone has sent a Commit to in the active event.
  committedIds: string[];
  markCommitted: (memberId: string) => void;
  // Board 07: while live the intent can be changed once per session.
  canEditIntent: boolean;
  markIntentEdited: () => void;
  // Saved on the phone per member (PrefsContext).
  filters: MatchFilters;
  setFilters: (filters: MatchFilters) => void;
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
  const { getEvent, isGone, markGone, refresh: refreshEvents } = useEvents();
  const [selectedEvent, setActiveEvent] = useState<ActiveEvent>(null);
  // Always render the latest admin-edited name/times for the selected event.
  const latest = selectedEvent ? getEvent(selectedEvent.eventId) : undefined;
  const activeEvent: ActiveEvent = useMemo(
    () =>
      selectedEvent && latest
        ? { ...selectedEvent, name: latest.name, endsAt: latest.ends_at, liveCount: latest.live_count }
        : selectedEvent,
    [selectedEvent, latest]
  );
  const [session, setSession] = useState<LiveModeSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const {
    prefs: { filters },
    setFilters,
    completeTip,
  } = usePrefs();
  const sessionRef = useRef<LiveModeSession | null>(null);
  const [intentText, setIntentText] = useState('');
  const [intentEditSession, setIntentEditSession] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchCard[] | null>(null);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [committedIds, setCommittedIds] = useState<string[]>([]);
  // Latest known consent decisions for this member (from GET or our POST).
  const decisions = useRef<Partial<Record<ConsentPurpose, string>>>({});

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
    decisions.current = {};
  }, [memberId, applySession]);

  // Matches (and passes) belong to one event.
  useEffect(() => {
    setMatches(null);
    setPassedIds([]);
    setCommittedIds([]);
  }, [activeEvent?.eventId]);

  // Event cancelled/unpublished by an admin (gone from GET /v1/events, or a
  // 404 EVENT_NOT_FOUND): drop local live state; Go Live shows "pick an event".
  const selectedId = selectedEvent?.eventId;
  const selectedGone = selectedId ? isGone(selectedId) : false;
  useEffect(() => {
    if (!selectedGone) return;
    applySession(null);
    setMatches(null);
    setActiveEvent(null);
  }, [selectedGone, applySession]);

  const takeOffline = useCallback(() => {
    applySession(null);
    setMatches(null);
    Alert.alert('Taken offline', TAKEN_OFFLINE_MESSAGE);
  }, [applySession]);

  // The server ended this member's live session before active_until:
  // cancelled event, admin took the member offline, or consent withdrawn.
  const handleSessionEnded = useCallback(
    async (eventId: string, error: ApiError) => {
      const wasActive = Boolean(sessionRef.current && new Date(sessionRef.current.active_until).getTime() > Date.now());
      applySession(null);
      if (error.code === 'EVENT_NOT_FOUND') {
        markGone(eventId);
        return;
      }
      if (OFFLINE_CODES.includes(error.code)) {
        takeOffline();
        return;
      }
      if (!wasActive) return; // simply expired
      try {
        const profile = await coreApi.getMyProfile();
        if (profile.profile_status !== 'ACTIVE') {
          takeOffline();
          return;
        }
      } catch (e) {
        if (e instanceof ApiError && OFFLINE_CODES.includes(e.code)) {
          takeOffline();
          return;
        }
      }
      refreshEvents(); // a cancelled event shows up as gone from the list
    },
    [applySession, markGone, takeOffline, refreshEvents]
  );

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
        if (
          e instanceof ApiError &&
          ['LIVE_MODE_NOT_ACTIVE', 'EVENT_NOT_FOUND', ...OFFLINE_CODES].includes(e.code) &&
          sessionRef.current?.event_id === eventId
        ) {
          handleSessionEnded(eventId, e);
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
      completeTip('wentLive');
      return null;
    } catch (e) {
      logApiError('Start Live Mode', e);
      const blocker = e instanceof ApiError ? BLOCKERS[e.code] : undefined;
      if (blocker === 'CONSENT_REQUIRED') delete decisions.current.LIVE_MODE;
      if (blocker === 'EVENT_NOT_FOUND') markGone(activeEvent.eventId);
      if (blocker === 'TAKEN_OFFLINE') applySession(null);
      if (blocker) return blocker;
      throw e;
    }
  }, [activeEvent, applySession, markGone, completeTip]);

  const checkConsent = useCallback(async (purpose: ConsentPurpose): Promise<ConsentStatus> => {
    if (decisions.current[purpose] === 'GRANTED') return 'GRANTED';
    try {
      const policy = await coreApi.getActiveConsentPolicy(purpose);
      decisions.current[purpose] = policy.current_decision;
      return policy.current_decision === 'GRANTED' ? 'GRANTED' : 'ASK';
    } catch (e) {
      logApiError(`${purpose} consent policy`, e);
      return e instanceof ApiError && e.code === 'CONSENT_POLICY_NOT_ACTIVE' ? 'NO_POLICY' : 'UNKNOWN';
    }
  }, []);

  const recordConsentDecision = useCallback(
    async (purpose: ConsentPurpose, decision: Exclude<ConsentDecision, 'WITHDRAWN'>) => {
      try {
        // The server owns the policy version; never hard-code it. The
        // wording is the app's (Core stores only its content hash).
        const policy = await coreApi.getActiveConsentPolicy(purpose);
        await coreApi.recordConsent({
          purpose_code: purpose,
          policy_version: policy.version,
          decision,
          capture_channel: 'MOBILE',
          evidence: { screen: purpose === 'LIVE_MODE' ? 'go_live_consent' : 'go_live_matching_consent' },
        });
        decisions.current[purpose] = decision;
      } catch (e) {
        logApiError(`${purpose} consent`, e);
        throw e;
      }
    },
    []
  );

  const stopLive = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    try {
      await coreApi.stopLiveMode(current.event_id);
    } catch (e) {
      // Already stopped/expired, or the event was removed: that's success.
      if (!(e instanceof ApiError && (e.code === 'LIVE_MODE_NOT_ACTIVE' || e.code === 'EVENT_NOT_FOUND'))) {
        logApiError('Stop Live Mode', e);
        throw e;
      }
    }
    applySession(null);
  }, [applySession]);

  const runMatching = useCallback(async (next?: { intentText?: string; minMatch?: number }) => {
    if (!activeEvent) return [];
    if (decisions.current.MATCHING === 'DENIED') throw new MatchingError('CONSENT_DENIED');
    try {
      const found = await findMatches({
        eventId: activeEvent.eventId,
        eventEndsAt: activeEvent.endsAt,
        wantText: next?.intentText ?? intentText,
        offerText: await profileOffer(),
        minMatchPercent: next?.minMatch ?? filters.minMatch,
      });
      setMatches(found);
      return found;
    } catch (e) {
      logApiError('Matching', e);
      throw e;
    }
  }, [activeEvent, intentText, filters.minMatch]);

  const value = useMemo(
    () => ({
      activeEvent,
      setActiveEvent,
      isLive,
      activeUntil: isLive ? activeUntil : null,
      goLive,
      checkConsent,
      recordConsentDecision,
      stopLive,
      intentText,
      setIntentText,
      matches,
      runMatching,
      passedIds,
      pass: (id: string) => setPassedIds((current) => (current.includes(id) ? current : [...current, id])),
      committedIds,
      markCommitted: (id: string) => setCommittedIds((current) => (current.includes(id) ? current : [...current, id])),
      canEditIntent: !(isLive && session && intentEditSession === session.session_id),
      markIntentEdited: () => {
        if (isLive && session) setIntentEditSession(session.session_id);
      },
      filters,
      setFilters,
    }),
    // activeUntil is derived from session; listing session keeps it stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEvent, isLive, session, goLive, checkConsent, recordConsentDecision, stopLive, intentText, matches, runMatching, filters, setFilters, intentEditSession, passedIds, committedIds]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
}
