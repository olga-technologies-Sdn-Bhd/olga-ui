import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { StatusBar, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { warmUpApis } from './src/api/warmup';
import { AuthProvider } from './src/context/AuthContext';
import { EventsProvider } from './src/context/EventsContext';
import { LiveProvider } from './src/context/LiveContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { fonts } from './src/theme/typography';

// App-wide body font (Instrument Sans) so plain copy needs no explicit
// fontFamily — screens only set one explicitly for headings, scores and
// small uppercase labels (Outfit / IBM Plex Mono).
(Text as any).defaultProps = { ...(Text as any).defaultProps, style: [{ fontFamily: fonts.bodyRegular }, (Text as any).defaultProps?.style] };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: [{ fontFamily: fonts.bodyRegular }, (TextInput as any).defaultProps?.style] };

// Status bar and navigator background follow the in-app theme, not the OS one,
// so screen transitions don't flash the wrong background.
function ThemedApp() {
  // Wake the dev APIs (cold start) while the user is still signing in.
  useEffect(() => {
    warmUpApis();
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
        <EventsProvider>
          <LiveProvider>
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          </LiveProvider>
        </EventsProvider>
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
