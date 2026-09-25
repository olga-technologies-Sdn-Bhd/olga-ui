import { useCallback, useEffect, useRef, useState } from 'react';
import { authorize, refresh, AuthConfiguration, AuthorizeResult, RefreshResult } from 'react-native-app-auth';
import * as Keychain from 'react-native-keychain';
import { entraConfig, entraIssuer, entraScopes } from './entraConfig';

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
        await saveSession(next);
        setSession(next);
      } catch {
        // Refresh failed (revoked/expired) — require an interactive login again.
        await clearSession();
        setSession(null);
      }
    })();
  }, []);

  const login = useCallback(async (loginHint?: string) => {
    const result: AuthorizeResult = await authorize({
      ...authConfig,
      additionalParameters: loginHint ? { login_hint: loginHint } : undefined,
    });
    const next: StoredSession = {
      accessToken: result.accessToken,
      accessTokenExpirationDate: result.accessTokenExpirationDate,
      refreshToken: result.refreshToken || null,
      idToken: result.idToken,
      tokenType: result.tokenType,
      scopes: result.scopes,
    };
    await saveSession(next);
    setSession(next);
  }, []);

  const logOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  return {
    accessToken: session?.accessToken ?? null,
    isRestoring: session === undefined,
    login,
    logOut,
  };
}
