import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, setAccessTokenProvider, setMemberIdProvider, withRetries } from '../api/client';
import { clearCache } from '../api/offlineCache';
import { coreApi } from '../api/core';
import { clearNearby } from '../nearby/store';
import { registerDevice, removeDevice } from '../chat/device';
import {
  AccountDeletionPendingError,
  activateMember,
  deletionPendingNotice,
  lookupExistingMember,
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
import { EmailStartResult, EntraLoginOptions, useEntraLogin } from '../auth/useEntraLogin';

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
  login: (options?: EntraLoginOptions) => Promise<boolean>;
  // Continue with Email (in-app OTP via Entra native auth). 'browser' means
  // the tenant doesn't allow native auth yet: call login({ loginHint }).
  startEmail: (email: string) => Promise<EmailStartResult>;
  // Verifies the code; resolves like login() (true = existing member).
  submitEmailCode: (code: string) => Promise<boolean>;
  resendEmailCode: () => Promise<number>;
  cancelEmail: () => void;
  // Registers the member with Olga.Core. Throws ApiError on failure (calling
  // again reuses the same Idempotency-Key) or MemberRecoveryUnavailableError
  // when the email/phone is already registered elsewhere.
  completeOnboarding: (name: string, mobile: string) => Promise<void>;
  logOut: () => Promise<void>;
  // Files the deletion request with Core, then signs out and forgets this
  // member on the phone. Throws ApiError on failure (still signed in). Pass
  // the same idempotencyKey when retrying.
  deleteAccount: (idempotencyKey: string) => Promise<void>;
  // One-off message for the sign-in screen (after a deletion request).
  notice: string | null;
  clearNotice: () => void;
};

export const DELETION_NOTICE = 'Your account has been deleted from Ol-ga. We erase your data within 30 days.';

const AuthContext = createContext<AuthState | undefined>(undefined);

// The reads that decide who signs in are retried while Core wakes up (dev
// scales to zero), instead of one long wait that can run out.
const memberApi: MemberApi = {
  getMyProfile: (memberId) => withRetries((timeoutMs) => coreApi.getMyProfile({ headers: { 'X-Member-Id': memberId }, timeoutMs })),
  updateMyProfile: (memberId, body, ifMatch) =>
    coreApi.updateMyProfile(body, ifMatch, { headers: { 'X-Member-Id': memberId } }),
  // Lookup changes nothing, so one key for every attempt is enough.
  lookupMember: (email) => {
    const idempotencyKey = newIdempotencyKey();
    return withRetries((timeoutMs) => coreApi.lookupMember(email, { idempotencyKey, timeoutMs }));
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const entra = useEntraLogin();
  const { accessToken, login: entraLogin, logOut: entraLogOut, startEmail, resendEmailCode, cancelEmail } = entra;
  const entraSubmitEmailCode = entra.submitEmailCode;
  const [store, setStore] = useState<MemberStore | null>(null);
  const [member, setMember] = useState<StoredMember | null>(null);
  const memberRef = useRef<StoredMember | null>(null);
  // Latest Entra access token for the Bearer header (read at request time).
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;
  const registrationKey = useRef<string | null>(null);
  const restoreChecked = useRef(false);
  const [restoreLookup, setRestoreLookup] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  const applyMember = useCallback((next: StoredMember | null) => {
    memberRef.current = next;
    setMember(next);
  }, []);

  const persist = useCallback(async (next: MemberStore) => {
    setStore(next);
    await saveMemberStore(next);
  }, []);

  // The member behind this email asked to be deleted: nothing of them stays on
  // the phone, the session ends and the sign-in screen says why.
  const signOutPendingDeletion = useCallback(
    async (forEmail: string, dueAt?: string) => {
      const latest = await loadMemberStore();
      const cached = latest.members[forEmail];
      if (cached) {
        await clearCache(cached.member_id);
        await clearNearby(cached.member_id);
      }
      await entraLogOut();
      await persist({ ...withoutMember(latest, forEmail), current: null });
      registrationKey.current = null;
      setNotice(deletionPendingNotice(dueAt));
      applyMember(null);
    },
    [entraLogOut, persist, applyMember]
  );

  // Every Olga API call reads X-Member-Id from here.
  useEffect(() => {
    setMemberIdProvider(() => memberRef.current?.member_id ?? null);
    setAccessTokenProvider(() => accessTokenRef.current);
  }, []);

  // This phone, for Ol-ga's device list (and push later). Best effort.
  const signedInMemberId = member?.member_id;
  useEffect(() => {
    if (!signedInMemberId) return;
    registerDevice().catch((e) => {
      if (__DEV__) console.warn(`Device registration failed (${e instanceof ApiError ? e.code : 'unknown'})`);
    });
  }, [signedInMemberId]);

  useEffect(() => {
    loadMemberStore().then((loaded) => {
      setStore(loaded);
      applyMember(loaded.current ? loaded.members[loaded.current] ?? null : null);
    });
  }, [applyMember]);

  const storesLoaded = !entra.isRestoring && store !== null;
  // Also covers the member lookup below, so the name question never flashes.
  const isRestoring = !storesLoaded || restoreLookup;
  // The verified email of this session: from the Entra ID token, else the
  // store's current pointer (set at the last login).
  const email = accessToken ? (entra.email ? normalizeEmail(entra.email) : store?.current ?? null) : null;

  // App start with a restored session + cached member: go in immediately,
  // then confirm the member with the backend in the background.
  useEffect(() => {
    if (!storesLoaded || restoreChecked.current || !store) return;
    restoreChecked.current = true;
    const cached = accessToken && email ? store.members[email] : undefined;
    applyMember(cached ?? null);
    if (accessToken && email && !cached) {
      // Session but no member on device (e.g. sign-up interrupted): ask Core
      // before falling back to onboarding (name + mobile, no new OTP).
      setRestoreLookup(true);
      lookupExistingMember(email, memberApi)
        .then(async (lookup) => {
          if (lookup.status === 'deletion_pending') return signOutPendingDeletion(email, lookup.dueAt);
          if (lookup.status !== 'found') return;
          const latest = await loadMemberStore();
          await persist(withMember({ ...latest, current: email }, email, lookup.member));
          applyMember(lookup.member);
        })
        .finally(() => setRestoreLookup(false));
      return;
    }
    if (!cached || !email) return;
    refreshMember(cached, memberApi).then(async (result) => {
      if (memberRef.current?.member_id !== cached.member_id) return; // logged out meanwhile
      const latest = await loadMemberStore();
      if (result.status === 'stale') {
        await persist(withoutMember(latest, email));
        applyMember(null); // -> onboarding (name + mobile, no new OTP)
      } else if (result.status === 'not_active') {
        const lookup = await lookupExistingMember(email, memberApi);
        if (lookup.status === 'deletion_pending') await signOutPendingDeletion(email, lookup.dueAt);
      } else {
        await persist(withMember({ ...latest, current: email }, email, result.member));
        applyMember(result.member);
      }
    });
  }, [storesLoaded, store, accessToken, email, applyMember, persist, signOutPendingDeletion]);

  // After Entra (any method) verified the user: find or create their member.
  const finishSignIn = useCallback(
    async (verified: string | null) => {
      const started = Date.now();
      registrationKey.current = null;
      restoreChecked.current = true;
      if (!verified) {
        applyMember(null);
        return false;
      }
      let resolved;
      try {
        resolved = await resolveLogin(await loadMemberStore(), verified, memberApi);
      } catch (error) {
        if (error instanceof AccountDeletionPendingError) await signOutPendingDeletion(normalizeEmail(verified), error.dueAt);
        throw error;
      }
      if (resolved.lookup?.status === 'unavailable') {
        // Falls back to sign-up; a 409 there retries the lookup. Never log the email.
        console.warn(`Member lookup unavailable, correlation_id=${resolved.lookup.correlationId ?? 'none'}`);
      }
      await persist(resolved.store);
      applyMember(resolved.member);
      console.info(`[auth] member resolved in ${Date.now() - started} ms (existing=${resolved.member !== null})`);
      return resolved.member !== null;
    },
    [applyMember, persist, signOutPendingDeletion]
  );

  const login = useCallback(
    async (options?: EntraLoginOptions) => finishSignIn(await entraLogin(options)),
    [entraLogin, finishSignIn]
  );

  const submitEmailCode = useCallback(
    async (code: string) => finishSignIn(await entraSubmitEmailCode(code)),
    [entraSubmitEmailCode, finishSignIn]
  );

  const completeOnboarding = useCallback(
    async (enteredName: string, enteredMobile: string) => {
      if (!email) throw new Error('No verified email for this session');
      registrationKey.current ??= newIdempotencyKey();

      let next: StoredMember;
      try {
        // Same key on every attempt, so a retry never creates a second member.
        const key = registrationKey.current;
        const registered = await withRetries((timeoutMs) =>
          coreApi.registerMember({ display_name: enteredName, email, phone: enteredMobile, visibility: 'MEMBERS' }, { idempotencyKey: key, timeoutMs })
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
          try {
            next = await recoverExistingMember(email, error, memberApi);
          } catch (recoverError) {
            if (recoverError instanceof AccountDeletionPendingError) await signOutPendingDeletion(email, recoverError.dueAt);
            throw recoverError;
          }
        } else {
          throw error;
        }
      }

      const latest = await loadMemberStore();
      await persist(withMember({ ...latest, current: email }, email, next));
      registrationKey.current = null;
      applyMember(next);
    },
    [email, applyMember, persist, signOutPendingDeletion]
  );

  const logOut = useCallback(async () => {
    // Before the member is cleared: the call needs X-Member-Id.
    await removeDevice().catch(() => {});
    // What was kept on the phone for offline use goes with the session.
    if (member?.member_id) await clearCache(member.member_id);
    await entraLogOut();
    // Keep the member records so the same email signs straight back in.
    const latest = await loadMemberStore();
    await persist({ ...latest, current: null });
    registrationKey.current = null;
    applyMember(null);
  }, [entraLogOut, applyMember, persist, member?.member_id]);

  const deleteAccount = useCallback(
    async (idempotencyKey: string) => {
      const memberId = member?.member_id;
      if (!memberId || !email) throw new Error('Not signed in');
      try {
        await coreApi.requestAccountDeletion({ idempotencyKey });
      } catch (error) {
        // Already requested (e.g. from another phone): same outcome, carry on.
        const alreadyOpen = error instanceof ApiError && error.status === 409 && error.code === 'PRIVACY_REQUEST_ALREADY_OPEN';
        if (!alreadyOpen) {
          // Not a member any more: back to sign-up, as at app start.
          if (error instanceof ApiError && error.status === 404 && error.code === 'MEMBER_NOT_REGISTERED') {
            await clearCache(memberId);
            await persist(withoutMember(await loadMemberStore(), email));
            applyMember(null);
          }
          throw error;
        }
      }
      // Requested: nothing of this member stays on the phone.
      await clearCache(memberId);
      await clearNearby(memberId);
      await entraLogOut();
      const latest = await loadMemberStore();
      await persist({ ...withoutMember(latest, email), current: null });
      registrationKey.current = null;
      setNotice(DELETION_NOTICE);
      applyMember(null);
    },
    [member?.member_id, email, entraLogOut, applyMember, persist]
  );

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
      startEmail,
      submitEmailCode,
      resendEmailCode,
      cancelEmail,
      completeOnboarding,
      logOut,
      deleteAccount,
      notice,
      clearNotice,
    }),
    [
      accessToken,
      isRestoring,
      member,
      email,
      login,
      startEmail,
      submitEmailCode,
      resendEmailCode,
      cancelEmail,
      completeOnboarding,
      logOut,
      deleteAccount,
      notice,
      clearNotice,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
