import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronRight, SlidersHorizontal, Ticket } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { coreApi } from '../../api/core';
import type { Meeting } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { ComingSoonModal } from '../../components/ComingSoonModal';
import { GoLiveMark } from '../../components/GoLiveMark';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useNearby } from '../../context/NearbyContext';
import { TipKey, usePrefs } from '../../context/PrefsContext';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  BottomTabScreenProps<MainTabParamList>
>;

// Each tip disappears once the member does the action (not on tap) and never
// returns. "Confirm you met" is amber: an outcome state.
const TIPS: { key: TipKey; title: string; body: string }[] = [
  { key: 'wentLive', title: 'Go Live when you arrive.', body: 'Check in, then press and hold Go Live. Only relevant people in the room can see you.' },
  { key: 'savedFilter', title: 'Set who you want to meet.', body: 'Your filter decides who you see, and who can reach you.' },
  { key: 'confirmedMeeting', title: 'Confirm you met.', body: 'The morning after, two taps. Only meetings you both confirm count.' },
];

type Kind = 'network' | 'event' | 'tip';
type Filter = 'all' | Kind;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'network', label: 'Network' },
  { key: 'event', label: 'Events' },
  { key: 'tip', label: 'Tips' },
];

type Update = {
  key: string;
  kind: Kind;
  meta: string;
  title: string; // shown bold, then the body
  body: string;
  icon: React.ReactNode;
  onPress?: () => void;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function greeting(date: Date) {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase() || '?';
}

// "2h", "3d", then a short date.
function ago(iso: string, now: number) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.round(minutes / (24 * 60))}d`;
  const date = new Date(then);
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

function eventDay(iso: string, now: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === new Date(now).toDateString()) return 'Today';
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

// Home: the Social Capital card, then updates (network, events, tips). Every
// number comes from Core; parts of the design with no API yet (monthly change,
// last-event summary, the index itself) are left out rather than faked.
export function HomeScreen({ navigation }: Props) {
  const { name } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { prefs } = usePrefs();
  // Shared, admin-managed list (soonest first): always the latest data.
  const { events, refresh: refreshEvents, refreshIfStale } = useEvents();
  // null until the first load finishes.
  const [relationships, setRelationships] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [indexSoon, setIndexSoon] = useState(false);
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const now = Date.now();
  const { requests: nearbyRequests } = useNearby();

  const loadNetwork = useCallback(async () => {
    const [connections, page] = await Promise.all([
      coreApi.getConnections().catch(() => null),
      coreApi.getMeetings().catch(() => null),
    ]);
    if (connections) setRelationships(connections.filter((c) => c.status === 'ACTIVE').length);
    if (page) setMeetings(page.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
      loadNetwork();
    }, [refreshIfStale, loadNetwork])
  );

  async function refresh() {
    await Promise.all([refreshEvents(), loadNetwork()]);
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

  const today = new Date(now);
  const changesThisMonth = meetings.filter((m) => {
    const at = new Date(m.last_activity_at);
    return at.getFullYear() === today.getFullYear() && at.getMonth() === today.getMonth();
  }).length;

  // Commits made over Bluetooth with people nearby, newest first.
  const nearbyUpdates = nearbyRequests
    .filter((r) => (r.direction === 'in' && r.status !== 'declined') || (r.direction === 'out' && r.status === 'accepted'))
    .map((r) => {
      const at = r.respondedAt ?? r.createdAt;
      const connected = r.status === 'accepted';
      const update: Update = {
        key: `nearby-${r.id}`,
        kind: 'network',
        meta: ['Nearby', ago(new Date(at).toISOString(), now)].filter(Boolean).join(' · '),
        title: connected ? r.peerName || r.peer.h : r.peer.h,
        body: connected ? ' is in your network. You met nearby.' : ' wants to meet you nearby.',
        icon: <Text style={styles.initials}>{r.peer.i}</Text>,
        onPress: () => navigation.navigate('GoLiveTab', { screen: 'NearbyRequest', params: { requestId: r.id } }),
      };
      return { at, update };
    })
    .sort((a, b) => b.at - a.at)
    .map((x) => x.update);

  const updates: Update[] = [
    ...nearbyUpdates,
    ...[...meetings]
      .sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())
      .map((m): Update => {
        const who = m.display_name ?? 'A new contact';
        return {
          key: `network-${m.conversation_id}`,
          kind: 'network',
          meta: ['Network', ago(m.last_activity_at, now)].filter(Boolean).join(' · '),
          title: who,
          body: ` is in your network${m.headline ? `: ${m.headline}` : ''}.`,
          icon: <Text style={styles.initials}>{m.display_name ? initialsOf(m.display_name) : '?'}</Text>,
          onPress: () => navigation.navigate('ChatTab'),
        };
      }),
    ...(events ?? [])
      .filter((e) => new Date(e.ends_at).getTime() > now)
      .map((e): Update => {
        const started = new Date(e.starts_at).getTime() <= now;
        const attending = typeof e.attendee_count === 'number' ? ` ${e.attendee_count.toLocaleString('en-US')} members attending.` : '';
        return {
          key: `event-${e.event_id}`,
          kind: 'event',
          meta: ['Event', eventDay(e.starts_at, now)].filter(Boolean).join(' · '),
          title: e.name,
          body: `${started ? ' is on now.' : isRegistered(e) ? ' is coming up.' : ''}${isRegistered(e) ? ' You are registered.' : started ? ' Registration is open.' : ' is open for registration.'}${attending}`,
          icon: <Ticket size={20} color={colors.text} />,
          onPress: () => navigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId: e.event_id } }),
        };
      }),
    ...TIPS.filter((t) => !prefs.tipsDone[t.key]).map(
      (t): Update => ({
        key: `tip-${t.key}`,
        kind: 'tip',
        meta: 'Tip',
        title: t.title,
        body: ` ${t.body}`,
        icon: tipIcon(t.key),
        onPress: t.key === 'confirmedMeeting' ? undefined : () => openTip(t.key),
      })
    ),
  ];
  const shown = filter === 'all' ? updates : updates.filter((u) => u.kind === filter);

  return (
    <Screen onRefresh={refresh} style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.brand}>Ol-ga</Text>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Your account">
          <Avatar initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" dark />
        </Pressable>
      </View>

      <View>
        <Text style={styles.date}>
          {WEEKDAYS[today.getDay()]} {today.getDate()} {MONTHS[today.getMonth()]}
        </Text>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting(today)}
          {firstName ? `, ${firstName}` : ''}
        </Text>
      </View>

      <Pressable
        onPress={() => navigation.navigate('ProfileSetup')}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.setup, pressed && styles.pressed]}
      >
        <Text style={styles.setupText}>Let me help you with your introduction</Text>
        <ChevronRight size={15} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.capital, pressed && styles.pressed]}
        onPress={() => setIndexSoon(true)}
        accessibilityRole="button"
        accessibilityLabel="Your Social Capital Graph"
      >
        <LinearGradient
          colors={[colors.cardFrom, colors.cardTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.capitalTop}>
          <Text style={styles.capitalTitle} numberOfLines={1}>
            {firstName ? `${firstName}'s Social Capital` : 'My Social Capital'}
          </Text>
          <View style={styles.month}>
            <Text style={styles.monthText}>
              {MONTHS[today.getMonth()]} {today.getFullYear()}
            </Text>
          </View>
        </View>
        <Text style={styles.count}>{relationships === null ? '–' : relationships.toLocaleString('en-US')}</Text>
        <View style={styles.capitalFoot}>
          <Text style={styles.countLabel}>Confirmed professional relationships</Text>
          <ChevronRight size={22} color={colors.white} />
        </View>
      </Pressable>

      <View style={styles.updatesHead}>
        <Text style={styles.h2}>Updates</Text>
        {changesThisMonth > 0 && (
          <Text style={styles.sub}>
            {changesThisMonth} network {changesThisMonth === 1 ? 'change' : 'changes'} this month
          </Text>
        )}
      </View>
      <View style={styles.tabs}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{f.label}</Text>
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {shown.map((u) => (
          <Pressable key={u.key} onPress={u.onPress} disabled={!u.onPress} style={styles.row} accessibilityRole={u.onPress ? 'button' : undefined}>
            <View style={[styles.icon, u.key === 'tip-confirmedMeeting' && styles.iconAmber]}>{u.icon}</View>
            <View style={styles.flex}>
              <Text style={styles.meta}>{u.meta}</Text>
              <Text style={styles.body}>
                <Text style={styles.bodyBold}>{u.title}</Text>
                {u.body}
              </Text>
            </View>
          </Pressable>
        ))}
        {shown.length === 0 && (
          <Text style={styles.empty}>
            {filter === 'network'
              ? 'People you meet through a Commit appear here.'
              : filter === 'event'
                ? 'More events are on the way.'
                : filter === 'tip'
                  ? "You're all set."
                  : 'New updates will appear here.'}
          </Text>
        )}
      </View>

      <ComingSoonModal
        visible={indexSoon}
        onClose={() => setIndexSoon(false)}
        title="Your Social Capital Graph"
        message="Your graph is coming soon. For now, this card shows your confirmed relationships."
        icon="◎"
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { backgroundColor: colors.surface },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    // Same width as the avatar, so the wordmark sits in the true centre.
    headerSpacer: { width: 34 },
    brand: { flex: 1, textAlign: 'center', fontSize: 21, color: colors.text },
    date: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
    greeting: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 28, fontWeight: '800', color: colors.text, marginTop: 1 },
    // A quiet line, not a call to action: no box, small muted text.
    // Tucked under the greeting (the screen's 12 gap is too much here).
    setup: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22, marginTop: -11, alignSelf: 'flex-start' },
    // No font padding and a fixed line height, so the chevron sits on the text's centre.
    setupText: { fontSize: 13, lineHeight: 16, includeFontPadding: false, textAlignVertical: 'center', color: colors.muted },
    // The one large dark element on the screen, the same in both themes.
    capital: {
      backgroundColor: colors.charcoal,
      borderRadius: radius.xl,
      padding: 18,
      marginHorizontal: 0,
      marginTop: 2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    capitalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    capitalTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: colors.champagne },
    month: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    monthText: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', color: colors.white },
    count: { fontFamily: fonts.headingBold, fontSize: 40, lineHeight: 44, fontWeight: '700', color: colors.white, marginTop: 6 },
    capitalFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
    countLabel: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.78)' },
    pressed: { opacity: 0.85 },
    updatesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 8 },
    h2: { fontFamily: fonts.bodyBold, fontSize: 18, fontWeight: '700', color: colors.text },
    sub: { fontSize: 12, color: colors.muted },
    // Filters as text tabs with an underline, edge to edge above the list.
    tabs: { flexDirection: 'row', marginHorizontal: -20, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
    tab: { flex: 1, alignItems: 'center', paddingTop: 8, minHeight: 44 },
    tabText: { fontSize: 14, color: colors.muted, paddingBottom: 9 },
    tabTextActive: { fontFamily: fonts.bodyBold, fontWeight: '700', color: colors.text },
    tabLine: { height: 3, width: 44, borderRadius: 2, backgroundColor: 'transparent' },
    tabLineActive: { backgroundColor: colors.selected },
    // Rows run edge to edge, split by hairlines.
    list: { marginHorizontal: -20 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    iconAmber: { backgroundColor: colors.amberSoft },
    initials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.muted },
    body: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 1 },
    bodyBold: { fontFamily: fonts.bodyBold, fontWeight: '700' },
    empty: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingVertical: 18 },
  });
