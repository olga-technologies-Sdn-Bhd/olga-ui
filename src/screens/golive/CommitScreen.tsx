import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { MatchSummary } from './LiveMatchesScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'Commit'>;

// Board 16. Five Commits per person per room, so each one is deliberate.
const COMMITS_PER_ROOM = 5;
// Venue spots come from the organiser (not in Core yet); "Their choice" is
// always offered.
const WHERE = ['Their choice'];
const WHEN = ['Now', 'In 10 min', 'Next break', 'After this session'];

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// A commitment to a short meeting here, while both are in the room. Not a
// connection request. Sending isn't wired yet: Core's connection request has
// no place/time, expiry-at-room-close or per-room limit (agreed: UI now).
export function CommitScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent, matches } = useLive();
  const card = matches?.find((m) => m.match.member_id === route.params.memberId);
  const [where, setWhere] = useState(WHERE[0]);
  const [when, setWhen] = useState(WHEN[1]);

  return (
    <Screen>
      <View style={styles.header}>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {activeEvent?.name ?? ''}
        </Text>
      </View>
      <View>
        <Text style={styles.h2}>Commit</Text>
        <Text style={styles.sub}>Not a connection request. A commitment to a short meeting, here, while you're both in the room.</Text>
      </View>

      {card ? (
        <Card>
          <MatchSummary card={card} />
        </Card>
      ) : (
        <Text style={styles.sub}>This match is no longer available.</Text>
      )}

      <Text style={styles.sectionTitle}>Where</Text>
      <View style={styles.tags}>
        {WHERE.map((w) => (
          <Pill key={w} label={w} tone={where === w ? 'active' : 'default'} onPress={() => setWhere(w)} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>When</Text>
      <View style={styles.tags}>
        {WHEN.map((w) => (
          <Pill key={w} label={w} tone={when === w ? 'active' : 'default'} onPress={() => setWhen(w)} />
        ))}
      </View>

      <View style={styles.consequence}>
        <Text style={styles.consequenceText}>
          They see your role, intent and this plan. Not your name. If they <Text style={styles.bold}>accept</Text>, you
          both see names at once. If not, nothing happens and you're never told.
          {activeEvent ? ` The request disappears at ${formatTime(activeEvent.endsAt)} with the room.` : ''}
        </Text>
      </View>

      <Button label={`Send commit · ${COMMITS_PER_ROOM} of ${COMMITS_PER_ROOM} left in this room`} variant="charcoal" disabled />
      <Text style={styles.note}>Sending Commits opens soon.</Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eyebrow: { flex: 1, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
    sub: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    consequence: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, marginTop: 6 },
    consequenceText: { fontSize: 13, lineHeight: 19, color: colors.text },
    bold: { fontWeight: '800' },
    note: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  });
