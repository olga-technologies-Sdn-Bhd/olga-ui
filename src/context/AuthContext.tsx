import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, setMemberIdProvider } from '../api/client';
import { coreApi } from '../api/core';
import {
  activateMember,
  MemberApi,
  MemberStore,
  normalizeEmail,
  recoverExistingMember,
  refreshMember,
  resolveLogin,
  StoredMember,
  withMember,
  withoutMember,
} from '../auth/memberSession';
import { loadMemberStore, saveMemberStore } from '../auth/memberStore';
import { useEntraLogin } from '../auth/useEntraLogin';

type AuthState = {
  isAuthenticated: boolean;
  isRestoring: boolean;
  needsOnboarding: boolean;
  email: string | null;
  memberId: string | null;
  name: string | null;
  mobile: string | null;
  // Resolves true when this email already has a member (go straight in),
  // false when name + mobile must be collected.
  login: (emailHint?: string) => Promise<boolean>;
  // Registers the member with Olga.Core. Throws ApiError on failure (calling
  // again reuses the same Idempotency-Key) or MemberRecoveryUnavailableError
  // when the email/phone is already registered elsewhere.
  completeOnboarding: (name: string, mobile: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const memberApi: MemberApi = {
  getMyProfile: (memberId) => coreApi.getMyProfile({ headers: { 'X-Member-Id': memberId } }),
  updateMyProfile: (memberId, body, ifMatch) =>
    coreApi.updateMyProfile(body, ifMatch, { headers: { 'X-Member-Id': memberId } }),
  lookupMember: (email) => coreApi.lookupMember(email),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const entra = useEntraLogin();
  const { accessToken, login: entraLogin, logOut: entraLogOut } = entra;
  const [store, setStore] = useState<MemberStore | null>(null);
  const [member, setMember] = useState<StoredMember | null>(null);
  const memberRef = useRef<StoredMember | null>(null);
  const registrationKey = useRef<string | null>(null);
  const restoreChecked = useRef(false);

  const applyMember = useCallback((next: StoredMember | null) => {
    memberRef.current = next;
    setMember(next);
  }, []);

  const persist = useCallback(async (next: MemberStore) => {
    setStore(next);
    await saveMemberStore(next);
  }, []);

  // Every Olga API call reads X-Member-Id from here.
  useEffect(() => {
    setMemberIdProvider(() => memberRef.current?.member_id ?? null);
  }, []);

  useEffect(() => {
    loadMemberStore().then((loaded) => {
      setStore(loaded);
      applyMember(loaded.current ? loaded.members[loaded.current] ?? null : null);
    });
  }, [applyMember]);

  const isRestoring = entra.isRestoring || store === null;
  // The verified email of this session: from the Entra ID token, else the
  // store's current pointer (set at the last login).
  const email = accessToken ? (entra.email ? normalizeEmail(entra.email) : store?.current ?? null) : null;

  // App start with a restored session + cached member: go in immediately,
  // then confirm the member with the backend in the background.
  useEffect(() => {
    if (isRestoring || restoreChecked.current || !store) return;
    restoreChecked.current = true;
    const cached = accessToken && email ? store.members[email] : undefined;
    applyMember(cached ?? null); // session but no member -> onboarding (name + mobile)
    if (!cached || !email) return;
    refreshMember(cached, memberApi).then(async (result) => {
      if (memberRef.current?.member_id !== cached.member_id) return; // logged out meanwhile
      const latest = await loadMemberStore();
      if (result.status === 'stale') {
        await persist(withoutMember(latest, email));
        applyMember(null); // -> onboarding (name + mobile, no new OTP)
      } else {
        await persist(withMember({ ...latest, current: email }, email, result.member));
        applyMember(result.member);
      }
    });
  }, [isRestoring, store, accessToken, email, applyMember, persist]);

  const login = useCallback(
    async (emailHint?: string) => {
      const verified = await entraLogin(emailHint);
      registrationKey.current = null;
      restoreChecked.current = true;
      if (!verified) {
        applyMember(null);
        return false;
      }
      const resolved = await resolveLogin(await loadMemberStore(), verified, memberApi);
      if (resolved.lookup?.status === 'unavailable') {
        // Falls back to sign-up; a 409 there retries the lookup. Never log the email.
        console.warn(`Member lookup unavailable, correlation_id=${resolved.lookup.correlationId ?? 'none'}`);
      }
      await persist(resolved.store);
      applyMember(resolved.member);
      return resolved.member !== null;
    },
    [entraLogin, applyMember, persist]
  );

  const completeOnboarding = useCallback(
    async (enteredName: string, enteredMobile: string) => {
      if (!email) throw new Error('No verified email for this session');
      registrationKey.current ??= newIdempotencyKey();

      let next: StoredMember;
      try {
        const registered = await coreApi.registerMember(
          { display_name: enteredName, email, phone: enteredMobile, visibility: 'MEMBERS' },
          { idempotencyKey: registrationKey.current }
        );
        next = await activateMember(
          {
            member_id: registered.member_id,
            etag: registered.etag,
            display_name: enteredName,
            phone: enteredMobile,
            profile_status: registered.profile_status,
          },
          memberApi
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          console.warn(`Member registration conflict (${error.code}), correlation_id=${error.correlationId}`);
          registrationKey.current = null;
          // Existing member as the server has it (lookup already activated a
          // DRAFT); the name/mobile just typed are not applied.
          next = await recoverExistingMember(email, error, memberApi);
        } else {
          throw error;
        }
      }

      const latest = await loadMemberStore();
      await persist(withMember({ ...latest, current: email }, email, next));
      registrationKey.current = null;
      applyMember(next);
    },
    [email, applyMember, persist]
  );

  const logOut = useCallback(async () => {
    await entraLogOut();
    // Keep the member records so the same email signs straight back in.
    const latest = await loadMemberStore();
    await persist({ ...latest, current: null });
    registrationKey.current = null;
    applyMember(null);
  }, [entraLogOut, applyMember, persist]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: Boolean(accessToken),
      isRestoring,
      needsOnboarding: Boolean(accessToken) && !member,
      email,
      memberId: member?.member_id ?? null,
      name: member?.display_name ?? null,
      mobile: member?.phone ?? null,
      login,
      completeOnboarding,
      logOut,
    }),
    [accessToken, isRestoring, member, email, login, completeOnboarding, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
