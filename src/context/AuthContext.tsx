import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { newIdempotencyKey, setMemberIdProvider } from '../api/client';
import { coreApi } from '../api/core';
import { loadMemberStore, normalizeEmail, saveMemberStore, StoredMember } from '../auth/memberStore';
import { useEntraLogin } from '../auth/useEntraLogin';

type AuthState = {
  isAuthenticated: boolean;
  isRestoring: boolean;
  needsOnboarding: boolean;
  email: string | null;
  memberId: string | null;
  name: string | null;
  mobile: string | null;
  login: (emailHint?: string) => Promise<void>;
  // Registers the member with Olga.Core. Throws ApiError on failure; calling
  // it again retries with the same Idempotency-Key, so no duplicate member.
  completeOnboarding: (name: string, mobile: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isRestoring: entraRestoring, login: entraLogin, logOut: entraLogOut } = useEntraLogin();
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [member, setMember] = useState<StoredMember | null>(null);
  const memberRef = useRef<StoredMember | null>(null);
  const registrationKey = useRef<string | null>(null);

  const applyMember = useCallback((next: StoredMember | null) => {
    memberRef.current = next;
    setMember(next);
  }, []);

  // Every Olga API call reads X-Member-Id from here.
  useEffect(() => {
    setMemberIdProvider(() => memberRef.current?.member_id ?? null);
  }, []);

  useEffect(() => {
    loadMemberStore().then((store) => {
      if (store.current) {
        setEmail(store.current);
        applyMember(store.members[store.current] ?? null);
      }
      setStoreLoaded(true);
    });
  }, [applyMember]);

  const login = useCallback(
    async (emailHint?: string) => {
      const verified = await entraLogin(emailHint);
      const key = verified ? normalizeEmail(verified) : null;
      const store = await loadMemberStore();
      registrationKey.current = null;
      setEmail(key);
      applyMember(key ? store.members[key] ?? null : null);
      await saveMemberStore({ ...store, current: key });
    },
    [entraLogin, applyMember]
  );

  const completeOnboarding = useCallback(
    async (enteredName: string, enteredMobile: string) => {
      if (!email) throw new Error('No verified email for this session');
      registrationKey.current ??= newIdempotencyKey();

      const registered = await coreApi.registerMember(
        { display_name: enteredName, email, phone: enteredMobile, visibility: 'MEMBERS' },
        { idempotencyKey: registrationKey.current }
      );
      const next: StoredMember = {
        member_id: registered.member_id,
        etag: registered.etag,
        display_name: enteredName,
        phone: enteredMobile,
      };
      memberRef.current = next; // so the profile update below sends X-Member-Id

      // A new member starts as DRAFT (invisible, can't connect); the first
      // profile update activates it. If that fails the member still exists,
      // so keep going — it can be activated on a later profile edit.
      try {
        const profile = await coreApi.updateMyProfile({ display_name: enteredName, visibility: 'MEMBERS' }, next.etag);
        next.etag = profile.etag;
      } catch {
        // stays DRAFT
      }

      const store = await loadMemberStore();
      await saveMemberStore({ current: email, members: { ...store.members, [email]: next } });
      registrationKey.current = null;
      applyMember(next);
    },
    [email, applyMember]
  );

  const logOut = useCallback(async () => {
    await entraLogOut();
    // Keep the member record so the same email signs straight back in.
    const store = await loadMemberStore();
    await saveMemberStore({ ...store, current: null });
    setEmail(null);
    applyMember(null);
  }, [entraLogOut, applyMember]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: Boolean(accessToken),
      isRestoring: entraRestoring || !storeLoaded,
      needsOnboarding: Boolean(accessToken) && !member,
      email,
      memberId: member?.member_id ?? null,
      name: member?.display_name ?? null,
      mobile: member?.phone ?? null,
      login,
      completeOnboarding,
      logOut,
    }),
    [accessToken, entraRestoring, storeLoaded, member, email, login, completeOnboarding, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
