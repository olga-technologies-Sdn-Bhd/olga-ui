import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

// Not in the client prototype — built from the same cards, eyebrow labels and
// `.switch` toggle used on the Filters screen so it reads as the same app.
export function ProfileScreen({ navigation }: Props) {
  const { name, email, mobile, memberId, logOut } = useAuth();
  const { colors, scheme, setScheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmLogOut() {
    Alert.alert('Log out?', 'You can sign back in any time with the same email.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} rightLabel="Profile" />

      <View style={styles.identity}>
        <Avatar initials={(name ?? '?').slice(0, 1).toUpperCase()} size="lg" />
        <Text style={styles.h2}>{name ?? 'Your profile'}</Text>
        {email && <Text style={styles.sub}>{email}</Text>}
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.list}>
        <Row label="Email" value={email} styles={styles} />
        <View style={styles.divider} />
        <Row label="Mobile" value={mobile} styles={styles} />
        <View style={styles.divider} />
        <Row label="Member ID" value={memberId} styles={styles} small />
      </Card>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Dark mode</Text>
          <Text style={styles.sub}>{scheme === 'dark' ? 'On' : 'Off'} — applies across the app</Text>
        </View>
        <ToggleSwitch on={scheme === 'dark'} onToggle={() => setScheme(scheme === 'dark' ? 'light' : 'dark')} />
      </Card>

      <Button label="Log out" variant="secondary" loading={loggingOut} onPress={confirmLogOut} style={styles.logout} />
    </Screen>
  );
}

function Row({
  label,
  value,
  styles,
  small,
}: {
  label: string;
  value: string | null;
  styles: ReturnType<typeof makeStyles>;
  small?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, small && styles.valueSmall]} numberOfLines={1} selectable>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  identity: { alignItems: 'center', gap: 6, marginTop: 4 },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.muted },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  rowText: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  value: { fontSize: 14, color: colors.muted, flexShrink: 1, textAlign: 'right' },
  valueSmall: { fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.line },
  logout: { marginTop: 8 },
});
