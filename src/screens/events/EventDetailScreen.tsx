import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EventHero } from '../../components/EventHero';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { formatEventDate } from '../../utils/formatEventDate';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetail'>;

export function EventDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { event } = route.params;
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      await coreApi.registerForEvent(event.event_id);
      setRegistered(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't register (${e.status})` : "Couldn't reach the server");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <Screen>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={typeof event.match_count === 'number' ? <Pill label={`${event.match_count} matches`} tone="green" /> : undefined}
      />

      <EventHero
        minHeight={250}
        topLeft={<Pill label={event.name} tone="green" />}
        title="The room where useful conversations start."
      >
        <Text style={styles.heroSub}>{[formatEventDate(event.starts_at), event.venue].filter(Boolean).join(' · ')}</Text>
      </EventHero>

      <Text style={styles.sectionTitle}>Your fit</Text>
      <Card soft>
        <Text style={[styles.eyebrowBrand]}>Intent for this event</Text>
        <Text style={styles.intentText}>Find telco or GLC distribution partners for an AI workforce platform.</Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.statRow}>
          <Text style={styles.sub}>Signed up</Text>
          <Text style={styles.statValue}>{event.attendee_count ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.sub}>Match your intent</Text>
          <Text style={[styles.statValue, { color: colors.green }]}>{event.match_count ?? '—'}</Text>
        </View>
      </Card>

      {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Button
          label={registered ? "You're signed up" : 'Sign up for this event'}
          onPress={handleRegister}
          loading={registering}
          disabled={registered}
        />
        <Button label="See who's going" variant="secondary" onPress={() => navigation.navigate('WhosGoing', { event })} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 13 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 4 },
  eyebrowBrand: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.brand, fontWeight: '700' },
  intentText: { marginTop: 8, lineHeight: 20, color: colors.text },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.line },
  sub: { fontSize: 13, color: colors.muted },
});
