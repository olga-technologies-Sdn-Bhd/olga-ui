import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { CommitsStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { WHEN_LABELS, whereLabel } from '../../utils/commitText';
import { getInitials } from '../../utils/initials';

type Props = NativeStackScreenProps<CommitsStackParamList, 'Meetup'>;

// After Accept both members see each other's name and the agreed plan. The
// chat itself isn't Phase 1, so this is where the meeting is confirmed.
export function MeetupScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { name, headline, where, when, eventName, picker } = route.params;
  const who = name || 'your match';

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} />
      <View>
        {eventName && <Text style={styles.eyebrow}>{eventName}</Text>}
        <Text style={styles.h2}>You're meeting {who}</Text>
        <Text style={styles.sub}>You can both see each other's names now.</Text>
      </View>

      <Card style={styles.row}>
        <Avatar initials={name ? getInitials(name) : '?'} size="lg" />
        <View style={styles.flex}>
          <Text style={styles.h3}>{name ?? 'Your match'}</Text>
          {headline && <Text style={styles.sub}>{headline}</Text>}
        </View>
      </Card>

      <View style={styles.plan}>
        <Text style={styles.label}>The plan</Text>
        <View style={styles.planRow}>
          <Check size={16} color={colors.positive} strokeWidth={2.6} />
          <Text style={styles.planText}>
            {whereLabel(where)} · {WHEN_LABELS[when] ?? when}
          </Text>
        </View>
        <Text style={styles.sub}>
          {where !== 'THEIR_CHOICE'
            ? 'Head there at the agreed time.'
            : picker === 'you'
              ? 'You pick the spot. Look out for each other in the room.'
              : picker === 'them'
                ? `${who} picks the spot. Look out for each other in the room.`
                : 'Agree on a spot and look out for each other in the room.'}
        </Text>
      </View>

      <Button label="Done" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginBottom: 4 },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, lineHeight: 27, fontWeight: '800', color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 16, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    plan: { backgroundColor: colors.positiveSoft, borderRadius: radius.md, padding: 16 },
    label: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.positive, fontWeight: '700' },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    planText: { fontFamily: fonts.headingBold, fontSize: 17, fontWeight: '700', color: colors.positive },
  });
