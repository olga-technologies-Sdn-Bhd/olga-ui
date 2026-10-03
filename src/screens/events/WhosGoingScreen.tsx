import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { EventAttendeesResponse } from '../../api/types';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useEvents } from '../../context/EventsContext';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<EventsStackParamList, 'WhosGoing'>;

export function WhosGoingScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const [data, setData] = useState<EventAttendeesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await coreApi.getEventAttendees(route.params.eventId));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setError(
        code === 'EVENT_REGISTRATION_REQUIRED'
          ? "Sign up for this event to see who's going."
          : code === 'EVENT_NOT_FOUND'
            ? 'This event is no longer available.'
            : e instanceof ApiError && e.status > 0
              ? `Couldn't load who's going (${e.status})`
              : "Couldn't reach the server"
      );
    }
  }, [route.params.eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const attendees = data?.attendees ?? [];

  return (
    <Screen>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={data ? <Pill label={`${data.total} of ${event?.attendee_count ?? data.total}`} /> : undefined}
      />

      <View>
        <Text style={styles.h2}>Who's going</Text>
        <Text style={styles.sub}>Names appear when you both accept.</Text>
      </View>

      {!data && !error && <ActivityIndicator color={colors.muted} style={{ marginTop: 24 }} />}
      {error && (
        <View style={{ gap: 10 }}>
          <Text style={styles.sub}>{error}</Text>
          <Button label="Try again" variant="secondary" small onPress={load} />
        </View>
      )}
      {data && attendees.length === 0 && <Text style={styles.sub}>Nobody else has signed up yet.</Text>}

      <View style={{ gap: 10 }}>
        {attendees.map((person) => (
          <Card key={person.member_id} style={styles.row}>
            <Avatar initials="?" />
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>{person.headline || 'Attendee'}</Text>
              {person.role_category && <Text style={styles.sub2}>{roleLabel(person.role_category)}</Text>}
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

// "PRODUCT_MANAGEMENT" -> "Product management"
function roleLabel(code: string) {
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 7, lineHeight: 19 },
  h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
  sub2: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
