import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBlock } from '../../components/DateBlock';
import { GoLiveMark } from '../../components/GoLiveMark';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useLive } from '../../context/LiveContext';
import { TipKey, usePrefs } from '../../context/PrefsContext';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  BottomTabScreenProps<MainTabParamList>
>;

// Board 01: three tips. Each disappears once the member does the action (not
// on tap) and never returns. "Confirm you met" is amber: an outcome state.
const TIPS: { key: TipKey; title: string; body: string }[] = [
  { key: 'wentLive', title: 'Go Live when you arrive', body: 'Check in, then press and hold Go Live. Only your matches in the room can see you.' },
  { key: 'savedFilter', title: 'Set who you want to meet', body: 'Your filter decides who you see, and who can reach you.' },
  { key: 'confirmedMeeting', title: 'Confirm you met', body: 'The morning after, two taps. Only meetings you both confirm count.' },
];

export function HomeScreen({ navigation }: Props) {
  const { name } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { prefs } = usePrefs();
  // Shared with Go Live: saved as the WANT intent when matching runs.
  const { intentText: intent, setIntentText: setIntent } = useLive();
  const [draft, setDraft] = useState(intent);
  const [editing, setEditing] = useState(!intent.trim());
  // Shared, admin-managed list (soonest first): always the latest data.
  const { events, refresh, refreshIfStale } = useEvents();
  const nextEvent = events?.find((e) => new Date(e.ends_at).getTime() > Date.now()) ?? null;
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const tipsLeft = TIPS.filter((t) => !prefs.tipsDone[t.key]);

  // The intent can also change from the Go Live filter.
  useEffect(() => {
    if (!editing) setDraft(intent);
    if (intent.trim()) setEditing(false);
    // Only follow outside changes to the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
    }, [refreshIfStale])
  );

  function handleSave() {
    if (!draft.trim()) return;
    setIntent(draft.trim());
    setEditing(false);
  }

  function tipIcon(key: TipKey) {
    if (key === 'wentLive') return <GoLiveMark size={20} color={colors.text} />;
    if (key === 'savedFilter') return <SlidersHorizontal size={18} color={colors.text} />;
    return <Check size={18} color={colors.amberText} strokeWidth={2.6} />;
  }

  function openTip(key: TipKey) {
    if (key === 'wentLive') navigation.navigate('GoLiveTab', { screen: 'GoLive' });
    if (key === 'savedFilter') navigation.navigate('GoLiveTab', { screen: 'Filters' });
  }

  return (
    <Screen onRefresh={refresh}>
      <View style={styles.topline}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>Home</Text>
          <Text style={styles.h2}>Welcome{firstName ? `, ${firstName}` : ''}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityLabel="Your account">
          <Avatar initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" />
        </Pressable>
      </View>

      <Card soft>
        <View style={styles.space}>
          <Text style={styles.eyebrow}>Your intent</Text>
          {!editing && (
            <Button
              label="Edit"
              variant="secondary"
              small
              onPress={() => {
                setDraft(intent);
                setEditing(true);
              }}
            />
          )}
        </View>
        {editing ? (
          <View style={styles.editor}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              style={styles.input}
              placeholder="What are you looking for at your next event?"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Button label="Save intent" variant="secondary" small onPress={handleSave} disabled={!draft.trim()} />
          </View>
        ) : (
          <Text style={styles.intent}>{intent}</Text>
        )}
        <Text style={styles.hint}>Used wherever an event doesn't set its own.</Text>
      </Card>

      {tipsLeft.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Get started · {TIPS.length - tipsLeft.length} of {TIPS.length}
          </Text>
          <View style={styles.list}>
            {tipsLeft.map((tip) => (
              <Pressable
                key={tip.key}
                onPress={() => openTip(tip.key)}
                disabled={tip.key === 'confirmedMeeting'}
                accessibilityRole={tip.key === 'confirmedMeeting' ? undefined : 'button'}
              >
                <Card style={styles.row}>
                  <View style={[styles.tipIcon, tip.key === 'confirmedMeeting' && styles.tipIconAmber]}>{tipIcon(tip.key)}</View>
                  <View style={styles.flex}>
                    <Text style={styles.h3}>{tip.title}</Text>
                    <Text style={styles.sub}>{tip.body}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {nextEvent && (
        <>
          <Text style={styles.sectionTitle}>Coming up</Text>
          <Pressable
            onPress={() => navigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId: nextEvent.event_id } })}
            accessibilityRole="button"
            accessibilityLabel={`${nextEvent.name}, open event`}
          >
            <Card style={styles.row}>
              <DateBlock iso={nextEvent.starts_at} />
              <View style={styles.flex}>
                <Text style={styles.h3}>{nextEvent.name}</Text>
                <Text style={styles.sub}>
                  {[nextEvent.venue, isRegistered(nextEvent) ? "You're signed up" : null].filter(Boolean).join(' · ')}
                </Text>
                {typeof nextEvent.attendee_count === 'number' && (
                  <Text style={styles.sub}>{nextEvent.attendee_count} signed up</Text>
                )}
              </View>
              <ChevronRight size={20} color={colors.muted} />
            </Card>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    space: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    intent: { fontFamily: fonts.headingBold, fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.text, marginTop: 10 },
    hint: { fontSize: 12, color: colors.muted, marginTop: 10 },
    sub: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
    list: { gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tipIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipIconAmber: { backgroundColor: colors.amberSoft },
    editor: { marginTop: 12, gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.sm,
      padding: 12,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 14,
      minHeight: 44,
    },
  });
