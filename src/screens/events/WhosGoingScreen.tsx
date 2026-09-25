import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { mockMembers, mockWhosGoing } from '../../mocks/matches';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { EventsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<EventsStackParamList, 'WhosGoing'>;

export function WhosGoingScreen({ route, navigation }: Props) {
  const { event } = route.params;
  const attendees = mockWhosGoing;

  return (
    <Screen>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={<Pill label={`${attendees.length} of ${event.attendee_count ?? attendees.length}`} />}
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

const styles = StyleSheet.create({
  h2: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 7, lineHeight: 19 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub2: { fontSize: 13, color: colors.muted, marginTop: 2 },
  match: { fontWeight: '800', color: colors.green, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
