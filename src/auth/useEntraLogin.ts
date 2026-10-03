import { useCallback, useEffect, useRef, useState } from 'react';
import { authorize, logout, refresh, AuthConfiguration, AuthorizeResult, RefreshResult } from 'react-native-app-auth';
import * as Keychain from 'react-native-keychain';
import { entraConfig, entraIssuer, entraScopes } from './entraConfig';
import {
  isNativeAuthUnavailable,
  isRegistrationRequired,
  isUserNotFound,
  NativeAuthError,
  nativeAuthClient,
  NativeTokenResponse,
} from './nativeAuthClient';

// Bare RN CLI equivalent of the Expo guide's expo-auth-session + expo-secure-store
// pair (see Olga.Infrastructure/docs/MOBILE_ENTRA_EXTERNAL_ID.md): authorize()
// runs the whole PKCE authorization-code flow in one native call instead of the
// manual discovery/useAuthRequest/exchangeCodeAsync steps that guide documents,
// and react-native-keychain replaces expo-secure-store for the token at rest.
const KEYCHAIN_SERVICE = 'olga.entra.session';

const authConfig: AuthConfiguration = {
  issuer: entraIssuer,
  clientId: entraConfig.clientId,
  redirectUrl: entraConfig.redirectUri,
  scopes: entraScopes,
  usePKCE: true,
};

type StoredSession = {
  accessToken: string;
  accessTokenExpirationDate: string;
  refreshToken: string | null;
  idToken: string;
  tokenType: string;
  scopes: string[];
};

async function saveSession(session: StoredSession) {
  await Keychain.setGenericPassword(KEYCHAIN_SERVICE, JSON.stringify(session), {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function loadSession(): Promise<StoredSession | null> {
  const result = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (!result) return null;
  try {
    return JSON.parse(result.password) as StoredSession;
  } catch {
    return null;
  }
}

async function clearSession() {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}

// Heuristic only — AppAuth doesn't give a dedicated "user cancelled" error code
// across iOS/Android, so a cancel/dismiss surfaces as a generic AppAuthError.
// Used to skip the "Sign-in failed" alert when the user just backed out.
export function isUserCancelledLogin(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('cancel') || message.includes('dismiss');
}

// Hermes (RN 0.74+) provides atob at runtime; RN's TS lib just doesn't declare it.
declare function atob(data: string): string;

// Reads the email claim from the ID token payload. No signature check: the
// token came straight from Microsoft over the PKCE flow and is only used to
// label the local session, never sent to Olga APIs.
// §10 check: the access token must come from the dev External ID tenant and
// target the OLGA API. Logs only issuer host and audience, never the token.
function logTokenTarget(accessToken: string) {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    const issuerHost = typeof claims.iss === 'string' ? claims.iss.split('/')[2] : 'none';
    console.info(`[auth] access token issuer=${issuerHost} audience=${claims.aud} expected_api=${entraConfig.apiScope.split('/')[2]}`);
  } catch {
    console.info('[auth] access token is not a readable JWT');
  }
}

function emailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    const email = claims.email ?? claims.emails?.[0] ?? claims.preferred_username;
    return typeof email === 'string' && email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

export type EntraProvider = 'google' | 'apple';

// In-app email OTP (Entra native auth). Kept in memory only, never persisted
// or logged: the continuation token is as sensitive as a password reset link.
type PendingEmail = { flow: 'signin' | 'signup'; email: string; continuationToken: string };

export type EmailStartResult =
  | { mode: 'otp'; codeLength: number } // code sent; show the in-app OTP screen
  | { mode: 'browser' }; // native auth not available on this tenant: use the hosted page

function sessionFromNative(tokens: NativeTokenResponse): StoredSession {
  return {
    accessToken: tokens.access_token,
    accessTokenExpirationDate: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token,
    tokenType: tokens.token_type,
    scopes: (tokens.scope ?? entraScopes.join(' ')).split(' '),
  };
}
export type EntraLoginOptions = { loginHint?: string; provider?: EntraProvider };

// Values that route Entra straight to the provider (no Microsoft chooser).
// Verified against the dev tenant on 2026-10-02 by following the authorize
// redirect: "Google" -> accounts.google.com, "apple" -> appleid.apple.com.
// Case matters for Google: "google" fails with AADSTS90023, and "google.com"
// / "apple.com" fall back to Entra's own sign-in page.
const PROVIDER_DOMAIN_HINT: Record<EntraProvider, string> = {
  google: 'Google',
  apple: 'apple',
};

export function useEntraLogin() {
  // undefined = still restoring from Keychain on app start.
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  const restoreStarted = useRef(false);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;

    (async () => {
      const stored = await loadSession();
      if (!stored) {
        setSession(null);
        return;
      }
      if (new Date(stored.accessTokenExpirationDate).getTime() > Date.now()) {
        setSession(stored);
        return;
      }
      if (!stored.refreshToken) {
        await clearSession();
        setSession(null);
        return;
      }
      try {
        const refreshed: RefreshResult = await refresh(authConfig, { refreshToken: stored.refreshToken });
        // Microsoft can rotate the refresh token; always replace the stored value.
        const next: StoredSession = {
          accessToken: refreshed.accessToken,
          accessTokenExpirationDate: refreshed.accessTokenExpirationDate,
          refreshToken: refreshed.refreshToken ?? stored.refreshToken,
          idToken: refreshed.idToken,
          tokenType: refreshed.tokenType,
          scopes: stored.scopes,
        };
        // §10: confirm a rotated refresh token replaces the stored one.
        console.info(`[auth] session refreshed, refresh token rotated=${Boolean(refreshed.refreshToken) && refreshed.refreshToken !== stored.refreshToken}`);
        logTokenTarget(next.accessToken);
        await saveSession(next);
        setSession(next);
      } catch {
        // Refresh failed (revoked/expired) — require an interactive login again.
        await clearSession();
        setSession(null);
      }
    })();
  }, []);

  // Resolves with the email Microsoft verified (from the ID token), falling
  // back to the hint the user typed if the token carries no email claim.
  //
  // Every sign-in goes through the same Microsoft-hosted user flow
  // (Docs/MOBILE_ENTRA_EXTERNAL_ID: "Mobile UI provider contract"):
  //   - email: login_hint pre-fills Email OTP;
  //   - provider: domain_hint=google|apple routes straight to that provider.
  // No Google/Apple SDK, client ID or key ever lives in the app.
  const login = useCallback(async ({ loginHint, provider }: EntraLoginOptions = {}): Promise<string | null> => {
    const result: AuthorizeResult = await authorize({
      ...authConfig,
      additionalParameters: provider
        ? { domain_hint: PROVIDER_DOMAIN_HINT[provider] }
        : loginHint
          ? { login_hint: loginHint }
          : undefined,
    });
    const next: StoredSession = {
      accessToken: result.accessToken,
      accessTokenExpirationDate: result.accessTokenExpirationDate,
      refreshToken: result.refreshToken || null,
      idToken: result.idToken,
      tokenType: result.tokenType,
      scopes: result.scopes,
    };
    logTokenTarget(next.accessToken);
    await saveSession(next);
    setSession(next);
    return emailFromIdToken(result.idToken) ?? loginHint ?? null;
  }, []);

  const pendingEmail = useRef<PendingEmail | null>(null);

  // Continue with Email: one action for new and existing customers. Tries
  // native sign-in; an unknown email goes straight into native sign-up — the
  // user is never asked whether they have an account, and both paths show
  // the same "enter the code sent to your email" screen.
  const startEmail = useCallback(async (email: string): Promise<EmailStartResult> => {
    const started = Date.now();
    let flow: PendingEmail['flow'] = 'signin';
    let continuation: string;
    try {
      continuation = (await nativeAuthClient.signInInitiate(email)).continuation_token;
    } catch (error) {
      if (isNativeAuthUnavailable(error) || isRegistrationRequired(error)) {
        console.info('[auth] native auth unavailable on this tenant; using the hosted page');
        return { mode: 'browser' };
      }
      if (!isUserNotFound(error)) throw error;
      flow = 'signup';
      continuation = (await nativeAuthClient.signUpStart(email)).continuation_token;
    }
    const challenge =
      flow === 'signin'
        ? await nativeAuthClient.signInChallenge(continuation)
        : await nativeAuthClient.signUpChallenge(continuation);
    pendingEmail.current = { flow, email, continuationToken: challenge.continuation_token };
    console.info(`[auth] email code requested in ${Date.now() - started} ms`);
    return { mode: 'otp', codeLength: challenge.code_length ?? 8 };
  }, []);

  // Verifies the code. New customers are signed in with the sign-up
  // continuation token, so there is no second OTP. Resolves with the email.
  const submitEmailCode = useCallback(async (code: string): Promise<string | null> => {
    const pending = pendingEmail.current;
    if (!pending) throw new NativeAuthError('no_pending_challenge', 'Start again');
    const started = Date.now();
    const tokens =
      pending.flow === 'signin'
        ? await nativeAuthClient.signInToken(pending.continuationToken, code)
        : await nativeAuthClient.signInAfterSignUp(
            (await nativeAuthClient.signUpContinue(pending.continuationToken, code)).continuation_token,
            pending.email
          );
    console.info(`[auth] code verified and tokens issued in ${Date.now() - started} ms`);
    const next = sessionFromNative(tokens);
    logTokenTarget(next.accessToken);
    const stored = Date.now();
    await saveSession(next);
    console.info(`[auth] session saved in ${Date.now() - stored} ms`);
    pendingEmail.current = null;
    setSession(next);
    return emailFromIdToken(tokens.id_token) ?? pending.email;
  }, []);

  // A new challenge sends a fresh code; Entra invalidates the previous one.
  const resendEmailCode = useCallback(async (): Promise<number> => {
    const pending = pendingEmail.current;
    if (!pending) throw new NativeAuthError('no_pending_challenge', 'Start again');
    const challenge =
      pending.flow === 'signin'
        ? await nativeAuthClient.signInChallenge(pending.continuationToken)
        : await nativeAuthClient.signUpChallenge(pending.continuationToken);
    pendingEmail.current = { ...pending, continuationToken: challenge.continuation_token };
    return challenge.code_length ?? 8;
  }, []);

  const cancelEmail = useCallback(() => {
    pendingEmail.current = null;
  }, []);

  // Sign-out (Docs/MOBILE_ENTRA_EXTERNAL_ID §8): local tokens are always
  // cleared first; then the Entra browser session is ended through the
  // discovered end_session_endpoint so the next sign-in starts fresh.
  // Ending the browser session is best effort: local sign-out stands even
  // if it fails or the user closes the page.
  const logOut = useCallback(async () => {
    pendingEmail.current = null;
    const idToken = (await loadSession())?.idToken;
    await clearSession();
    setSession(null);
    if (!idToken) return;
    try {
      await logout(authConfig, { idToken, postLogoutRedirectUrl: entraConfig.redirectUri });
      console.info('[auth] Entra browser session ended');
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.warn(`[auth] Entra browser sign-out did not complete (${err.code ?? 'no code'})`);
    }
  }, []);

  return {
    accessToken: session?.accessToken ?? null,
    // Verified email of the current (possibly restored) session.
    email: session ? emailFromIdToken(session.idToken) : null,
    isRestoring: session === undefined,
    login,
    startEmail,
    submitEmailCode,
    resendEmailCode,
    cancelEmail,
    logOut,
  };
}
