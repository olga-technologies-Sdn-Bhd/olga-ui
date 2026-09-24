import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { isAuthenticated, isRestoring, needsOnboarding } = useAuth();

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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
