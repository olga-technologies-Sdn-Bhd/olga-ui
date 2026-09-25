import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { isAuthenticated, isRestoring, needsOnboarding } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg } }),
    [colors]
  );

  // Avoids flashing the sign-up screen while a stored Entra session is still
  // being read from the Keychain on app start.
  if (isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return isAuthenticated && !needsOnboarding ? <MainTabs /> : <AuthStack />;
}
