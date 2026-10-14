import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { MATCH_LIMIT } from '../../config/env';
import { useNearby } from '../../context/NearbyContext';
import type { NearbyPerson } from '../../nearby/types';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { NearbyAvatar } from './NearbyView';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'NearbyPeople'>;

// "74%" from Ol-ga's matching; "~74%" while it's this phone's own estimate.
export function scoreLabel(person: Pick<NearbyPerson, 'score' | 'scoreSource'>) {
  return `${person.scoreSource === 'estimate' ? '~' : ''}${Math.round(person.score * 100)}%`;
}

export function NearbyPersonSummary({ person }: { person: Pick<NearbyPerson, 'card' | 'score' | 'scoreSource'> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { card } = person;
  return (
    <>
      <View style={styles.row}>
        <NearbyAvatar card={card} />
        <View style={styles.flex}>
          <Text style={styles.h3}>{card.h}</Text>
          {!!card.r && <Text style={styles.sub}>{card.r}</Text>}
        </View>
        <Pill label={scoreLabel(person)} tone="positive" />
      </View>
      <Text style={styles.label}>Looking for</Text>
      <Text style={styles.want}>{card.w}</Text>
    </>
  );
}

export function NearbyPeopleScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { people, requests, pass, available } = useNearby();
  const shown = people.slice(0, MATCH_LIMIT);

  const statusFor = (memberId: string) => {
    if (requests.some((x) => x.peer.m === memberId && x.status === 'accepted')) return 'Connected';
    return requests.some((x) => x.direction === 'out' && x.peer.m === memberId && x.status === 'pending') ? 'Commit sent' : null;
  };

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} right={available ? <Pill label="● AVAILABLE" tone="positive" /> : undefined} />
      <View>
        <Text style={styles.eyebrow}>Nearby</Text>
        <Text style={styles.h2}>People near you</Text>
      </View>

      {shown.length === 0 && (
        <Card>
          <Text style={styles.sub}>Nobody nearby right now. People appear here as they come close and go available.</Text>
        </Card>
      )}

      {shown.map((person) => {
        const status = statusFor(person.card.m);
        return (
          <Card key={person.card.m}>
            <NearbyPersonSummary person={person} />
            <View style={styles.actions}>
              <Button
                label={status ?? 'Commit'}
                variant="charcoal"
                small
                style={styles.flex}
                onPress={() => navigation.navigate('NearbyCommit', { memberId: person.card.m })}
              />
              <Button label="Pass" variant="secondary" small style={styles.flex} onPress={() => pass(person.card.m)} />
            </View>
          </Card>
        );
      })}

      {shown.length > 0 && (
        <Text style={styles.footer}>~ is an estimate made on your phone; Ol-ga's score replaces it when you're online. Passing is silent.</Text>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: '700', color: colors.text },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    label: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 12 },
    want: { fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    footer: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  });
