import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { StatusBar, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { warmUpApis } from './src/api/warmup';
import { DialogHost } from './src/components/DialogHost';
import { startEventLinks } from './src/navigation/eventLinks';
import { AuthProvider } from './src/context/AuthContext';
import { EventsProvider } from './src/context/EventsContext';
import { LiveProvider } from './src/context/LiveContext';
import { NearbyProvider } from './src/context/NearbyContext';
import { OfflineChatProvider } from './src/context/OfflineChatContext';
import { ChatRealtimeProvider } from './src/context/ChatRealtimeContext';
import { PrefsProvider } from './src/context/PrefsContext';
import { navigationRef } from './src/navigation/navigationRef';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { fonts } from './src/theme/typography';

// App-wide body font (the system typeface) so plain copy needs no explicit
// fontFamily — screens only set one explicitly for headings, scores and
// small uppercase labels.
(Text as any).defaultProps = { ...(Text as any).defaultProps, style: [{ fontFamily: fonts.bodyRegular }, (Text as any).defaultProps?.style] };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: [{ fontFamily: fonts.bodyRegular }, (TextInput as any).defaultProps?.style] };

// Status bar and navigator background follow the in-app theme, not the OS one,
// so screen transitions don't flash the wrong background.
function ThemedApp() {
  // Wake the dev APIs (cold start) while the user is still signing in.
  useEffect(() => {
    warmUpApis();
    // Event links (QR codes, shares) can open the app before sign-in.
    startEventLinks();
  }, []);
  const { scheme, colors } = useTheme();
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.surface, border: colors.line, text: colors.text },
    };
  }, [scheme, colors]);

  return (
    <>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <AuthProvider>
        <PrefsProvider>
          <EventsProvider>
            <LiveProvider>
              <NearbyProvider>
                <OfflineChatProvider>
                  <ChatRealtimeProvider>
                    <NavigationContainer ref={navigationRef} theme={navTheme}>
                      <RootNavigator />
                    </NavigationContainer>
                  </ChatRealtimeProvider>
                </OfflineChatProvider>
                {/* Every popup in the app (showDialog), themed. */}
                <DialogHost />
              </NearbyProvider>
            </LiveProvider>
          </EventsProvider>
        </PrefsProvider>
      </AuthProvider>
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
