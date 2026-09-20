import { createContext, useContext, useMemo, useState } from 'react';

type AuthState = {
  isAuthenticated: boolean;
  name: string | null;
  // TODO(backend): Olga.Core/olga-nlp-api have no OTP send/verify or
  // signup/login endpoints yet (see project notes) — these are local
  // stand-ins so the app flow works end to end; swap for real API calls
  // once that backend work lands.
  signUp: (name: string, phone: string) => Promise<void>;
  requestLoginOtp: (phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  logOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      name,
      signUp: async (enteredName: string, _phone: string) => {
        setName(enteredName);
        setIsAuthenticated(true);
      },
      requestLoginOtp: async (_phone: string) => {
        // no-op stub until Olga.Core exposes an OTP-send endpoint
      },
      verifyOtp: async (_code: string) => {
        setIsAuthenticated(true);
      },
      logOut: () => {
        setIsAuthenticated(false);
        setName(null);
      },
    }),
    [isAuthenticated, name]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
