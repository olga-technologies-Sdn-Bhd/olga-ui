import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useEntraLogin } from '../auth/useEntraLogin';

type AuthState = {
  isAuthenticated: boolean;
  isRestoring: boolean;
  needsOnboarding: boolean;
  name: string | null;
  mobile: string | null;
  login: (emailHint?: string) => Promise<void>;
  completeOnboarding: (name: string, mobile: string) => void;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isRestoring, login: entraLogin, logOut: entraLogOut } = useEntraLogin();
  // Only set on a fresh interactive login, not on session restore — a restored
  // session belongs to someone who already onboarded in a previous app run.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);

  const login = useCallback(
    async (emailHint?: string) => {
      await entraLogin(emailHint);
      setNeedsOnboarding(true);
    },
    [entraLogin]
  );

  const completeOnboarding = useCallback((enteredName: string, enteredMobile: string) => {
    // TODO(backend): persist via PATCH /v1/me/profile once Olga.Core actually
    // validates the Entra access token and links it to a member (see
    // Olga.Infrastructure/docs/SECURITY_DEBT.md) — local-only for now so the
    // app flow works end to end.
    setName(enteredName);
    setMobile(enteredMobile);
    setNeedsOnboarding(false);
  }, []);

  const logOut = useCallback(async () => {
    await entraLogOut();
    setName(null);
    setMobile(null);
    setNeedsOnboarding(false);
  }, [entraLogOut]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: Boolean(accessToken),
      isRestoring,
      needsOnboarding,
      name,
      mobile,
      login,
      completeOnboarding,
      logOut,
    }),
    [accessToken, isRestoring, needsOnboarding, name, mobile, login, completeOnboarding, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
