import { useEffect, useState } from 'react';
import { Splash, SPLASH_MIN_MS } from '../components/Splash';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { isAuthenticated, isRestoring, needsOnboarding } = useAuth();
  // The splash stays for two full breaths of the logo even when the session restores
  // faster, so the app never opens on a flicker.
  const [beatDone, setBeatDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBeatDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Also avoids flashing the sign-up screen while a stored Entra session is
  // still being read from the Keychain on app start.
  if (isRestoring || !beatDone) return <Splash />;

  return isAuthenticated && !needsOnboarding ? <MainTabs /> : <AuthStack />;
}
