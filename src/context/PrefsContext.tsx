import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import { useAuth } from './AuthContext';

// Per-member settings that only live on this phone: the Go Live colour
// (personal and cosmetic, board 15), the filter (no Core field yet) and which
// Home tips are done. Keyed by member so a second account starts fresh.
const SERVICE = 'olga.prefs';

export type GoLiveColorKey = 'charcoal' | 'green' | 'coral' | 'ocean' | 'violet' | 'pearl';

export type Seniority = 'manager' | 'director' | 'c-level';

export type MatchFilters = {
  minMatch: number;
  lookingFor: string[];
  industries: string[];
  seniority: Seniority;
  // Both off by default (board 07).
  allowNearMatches: boolean; // Commits from below your bar
  shareIntentChanges: boolean;
};

export const DEFAULT_FILTERS: MatchFilters = {
  minMatch: 74,
  lookingFor: [],
  industries: [],
  seniority: 'director',
  allowNearMatches: false,
  shareIntentChanges: false,
};

// Home tips (board 01): each disappears once the member does the action and
// never comes back.
export type TipKey = 'wentLive' | 'savedFilter' | 'confirmedMeeting';

export type MemberPrefs = {
  goLiveColor: GoLiveColorKey;
  filters: MatchFilters;
  tipsDone: Partial<Record<TipKey, true>>;
};

const DEFAULT_PREFS: MemberPrefs = { goLiveColor: 'charcoal', filters: DEFAULT_FILTERS, tipsDone: {} };

type PrefsState = {
  prefs: MemberPrefs;
  setGoLiveColor: (color: GoLiveColorKey) => void;
  setFilters: (filters: MatchFilters) => void;
  completeTip: (tip: TipKey) => void;
};

const PrefsContext = createContext<PrefsState | undefined>(undefined);

type Stored = Record<string, Partial<MemberPrefs>>;

async function loadAll(): Promise<Stored> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    return result ? (JSON.parse(result.password) as Stored) : {};
  } catch {
    return {};
  }
}

function withDefaults(stored?: Partial<MemberPrefs>): MemberPrefs {
  return {
    ...DEFAULT_PREFS,
    ...stored,
    // Older filters may lack newer fields (or use an old seniority value).
    filters: { ...DEFAULT_FILTERS, ...stored?.filters },
    tipsDone: { ...stored?.tipsDone },
  };
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { memberId } = useAuth();
  const [prefs, setPrefs] = useState<MemberPrefs>(DEFAULT_PREFS);
  const all = useRef<Stored>({});

  useEffect(() => {
    let cancelled = false;
    setPrefs(DEFAULT_PREFS);
    loadAll().then((stored) => {
      if (cancelled) return;
      all.current = stored;
      setPrefs(withDefaults(memberId ? stored[memberId] : undefined));
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const update = useCallback(
    (change: (current: MemberPrefs) => MemberPrefs) => {
      setPrefs((current) => {
        const next = change(current);
        if (memberId) {
          all.current = { ...all.current, [memberId]: next };
          Keychain.setGenericPassword(SERVICE, JSON.stringify(all.current), {
            service: SERVICE,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }).catch(() => {});
        }
        return next;
      });
    },
    [memberId]
  );

  const value = useMemo(
    () => ({
      prefs,
      setGoLiveColor: (goLiveColor: GoLiveColorKey) => update((p) => ({ ...p, goLiveColor })),
      setFilters: (filters: MatchFilters) =>
        update((p) => ({ ...p, filters, tipsDone: { ...p.tipsDone, savedFilter: true } })),
      completeTip: (tip: TipKey) =>
        update((p) => (p.tipsDone[tip] ? p : { ...p, tipsDone: { ...p.tipsDone, [tip]: true } })),
    }),
    [prefs, update]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider');
  return ctx;
}
