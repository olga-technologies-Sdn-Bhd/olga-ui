import { createContext, useContext, useMemo, useState } from 'react';

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

type ActiveEvent = { eventId: string; name: string; liveCount?: number; matchCount?: number } | null;

type LiveState = {
  activeEvent: ActiveEvent;
  setActiveEvent: (event: ActiveEvent) => void;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  filters: MatchFilters;
  setFilters: (filters: MatchFilters) => void;
  sessionTags: string[];
  addSessionTag: (tag: string) => void;
  removeSessionTag: (tag: string) => void;
};

const LiveContext = createContext<LiveState | undefined>(undefined);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [activeEvent, setActiveEvent] = useState<ActiveEvent>(null);
  const [isLive, setIsLive] = useState(false);
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [sessionTags, setSessionTags] = useState<string[]>(['AI partnerships', 'Hiring', 'Malaysia market']);

  function addSessionTag(tag: string) {
    setSessionTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }
  function removeSessionTag(tag: string) {
    setSessionTags((prev) => prev.filter((t) => t !== tag));
  }

  const value = useMemo(
    () => ({ activeEvent, setActiveEvent, isLive, setIsLive, filters, setFilters, sessionTags, addSessionTag, removeSessionTag }),
    [activeEvent, isLive, filters, sessionTags]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
}
