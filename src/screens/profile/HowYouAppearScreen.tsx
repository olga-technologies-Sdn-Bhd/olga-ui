import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EyeOff } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coreApi } from '../../api/core';
import type { Profile } from '../../api/types';
import { BLE_DISCOVERY_ENABLED } from '../../bluetooth/bleDiscovery';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { useNearby } from '../../context/NearbyContext';
import { HomeStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { MatchSummary } from '../golive/LiveMatchesScreen';
import { NearbyPersonSummary } from '../golive/NearbyPeopleScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'HowYouAppear'>;

// The match % differs for every viewer, so the preview shows a neutral mark.
const PREVIEW_PERCENT = '··%';

// DS 14.19: a read-only mirror, not an editable profile. It draws the same
// card components strangers get (event match card, Nearby card), filled with
// this member's own data, so what's shown here is exactly what they see.
export function HowYouAppearScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId } = useAuth();
  const { myCard } = useNearby();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    coreApi
      .getMyProfile()
      .then((p) => active && setProfile(p))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const eventCard = {
    match: { member_id: memberId ?? '', score: 0, label: 'PLAUSIBLE_MATCH' as const, reason_codes: [], reason_text: '' },
    profile: profile ?? undefined,
  };

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="How you appear" />
      <Text style={styles.lead}>This is exactly what someone sees before you both accept.</Text>

      <View style={styles.hidden}>
        <EyeOff size={16} color={colors.muted} strokeWidth={2} />
        <Text style={styles.hiddenText}>Your name, photo, email and mobile stay hidden until you both accept.</Text>
      </View>

      <Text style={styles.sectionTitle}>At an event</Text>
      <Card>
        {profile || failed ? (
          <MatchSummary card={eventCard} percent={PREVIEW_PERCENT} />
        ) : (
          <Text style={styles.sub}>Loading your card…</Text>
        )}
      </Card>
      <Text style={styles.note}>
        {profile && !profile.headline?.trim()
          ? "You show as “Attendee” because your introduction doesn't say what you do yet. Add it below so people know who they're meeting."
          : "Their match % and why you're relevant are worked out for each person."}
      </Text>

      {BLE_DISCOVERY_ENABLED && (
        <>
          <Text style={styles.sectionTitle}>Nearby</Text>
          {myCard ? (
            <Card>
              <NearbyPersonSummary person={{ card: myCard, score: 0, scoreSource: 'estimate' }} percent={PREVIEW_PERCENT} />
            </Card>
          ) : (
            <Text style={styles.note}>Add what you're looking for, and people nearby will see your card here.</Text>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>After you both accept</Text>
      <Text style={styles.body}>You see each other's name and can chat in Ol-ga.</Text>

      <Button label="Edit your introduction" variant="secondary" onPress={() => navigation.navigate('ProfileSetup')} style={styles.edit} />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    lead: { fontSize: 13, lineHeight: 19, color: colors.muted },
    hidden: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 12 },
    hiddenText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.text },
    sectionTitle: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.muted,
      fontWeight: '700',
      marginTop: 6,
    },
    sub: { fontSize: 12, color: colors.muted },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: -4 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text, marginTop: -4 },
    edit: { marginTop: 8 },
  });
