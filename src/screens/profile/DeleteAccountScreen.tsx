import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, newIdempotencyKey } from '../../api/client';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'DeleteAccount'>;

// DS 14.21 isn't in the corrected screens yet: built from the app's cards and
// copy rules. Says only what Core does today: the account leaves Ol-ga at once
// (hidden from matches, events and Commits) and the data is erased within 30 days.
const DELETED = [
  'Your profile and contact details',
  "What you're looking for",
  'Your Commits and connections',
  'Your messages',
];

export function DeleteAccountScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One request: a retry or a double tap reuses the same key.
  const requestKey = useRef(newIdempotencyKey());
  const busy = useRef(false);
  const [asking, setAsking] = useState(false);

  async function send() {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError(null);
    try {
      // On success the app signs out and this screen goes away.
      await deleteAccount(requestKey.current);
    } catch (e) {
      busy.current = false;
      setDeleting(false);
      setError(
        e instanceof ApiError && e.status > 0
          ? `We couldn't send your request (${e.status}). Please try again.`
          : 'No connection. Check your internet and try again.'
      );
    }
  }

  function confirm() {
    if (!busy.current) setAsking(true);
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Delete account" />

      <Card>
        <Text style={styles.label}>What's deleted</Text>
        {DELETED.map((item) => (
          <View key={item} style={styles.item}>
            <View style={styles.dot} />
            <Text style={styles.body}>{item}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.note}>
        <Text style={styles.body}>Your account leaves Ol-ga straight away, and we erase your data within 30 days. You'll be signed out on this phone.</Text>
        <Text style={[styles.body, styles.strong]}>This can't be undone.</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label={error ? 'Try again' : 'Delete account'} variant="danger" loading={deleting} onPress={confirm} />
      <Button label="Keep my account" variant="secondary" disabled={deleting} onPress={() => navigation.goBack()} />

      {/* The safe choice is the ink button; deleting is the quiet one below it. */}
      <ConfirmDialog
        visible={asking}
        icon={Trash2}
        title="Delete your account?"
        message="You'll leave Ol-ga and lose your connections and messages. This can't be undone."
        primaryLabel="Keep my account"
        onPrimary={() => setAsking(false)}
        secondaryLabel="Delete account"
        onSecondary={() => {
          setAsking(false);
          send();
        }}
        onDismiss={() => setAsking(false)}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold, marginBottom: 6 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    strong: { fontFamily: fonts.bodyBold, fontWeight: semibold, marginTop: 6 },
    note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14 },
    error: { fontSize: 12, lineHeight: 18, color: colors.danger, textAlign: 'center' },
  });
