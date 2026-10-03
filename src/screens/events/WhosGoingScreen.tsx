import { useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { mockMembers, mockWhosGoing } from '../../mocks/matches';
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
  const attendees = mockWhosGoing;

  return (
    <Screen>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={<Pill label={`${attendees.length} of ${event?.attendee_count ?? attendees.length}`} />}
      />

      <View>
        <Text style={styles.h2}>Who's going</Text>
        <Text style={styles.sub}>
          These people match what you're looking for. Names appear when you both go live and connect.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {attendees.map((person) => {
          const profile = mockMembers[person.member_id];
          return (
            <Card key={person.member_id} style={styles.row}>
              <Avatar initials="?" />
              <View style={{ flex: 1 }}>
                <Text style={styles.h3}>{profile?.headline}</Text>
                {profile?.role_category && <Text style={styles.sub2}>{profile.role_category}</Text>}
              </View>
              <Text style={styles.match}>{Math.round(person.score * 100)}%</Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 7, lineHeight: 19 },
  h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
  sub2: { fontSize: 13, color: colors.muted, marginTop: 2 },
  match: { fontFamily: fonts.headingExtraBold, fontWeight: '800', color: colors.positive, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
