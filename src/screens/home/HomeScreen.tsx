import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronRight, Mic, SlidersHorizontal, Ticket, UsersRound } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { coreApi } from '../../api/core';
import type { Meeting } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { ComingSoonModal } from '../../components/ComingSoonModal';
import { GoLiveMark } from '../../components/GoLiveMark';
import { FLOATING_TAB_SPACE, Screen, usePullToRefresh } from '../../components/Screen';
import { SlidingUnderline } from '../../components/SlidingUnderline';
import { useAuth } from '../../context/AuthContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useNearby } from '../../context/NearbyContext';
import { TipKey, usePrefs } from '../../context/PrefsContext';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { display, fonts, semibold } from '../../theme/typography';
import { OLGA_PROMPTS, OlgaMark } from './OlgaAgentScreen';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Home'>, BottomTabScreenProps<MainTabParamList>>;

// Each tip disappears once the member does the action (not on tap) and never
// returns. "Confirm you met" is amber: an outcome state.
const TIPS: { key: TipKey; title: string; body: string }[] = [
  {
    key: 'wentLive',
    title: 'Go Live when you arrive.',
    body: 'Check in, then press and hold Go Live. Only relevant people in the room can see you.',
  },
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

// Space between the collapsing part (greeting, card) and the Updates title.
const COLLAPSIBLE_GAP = 14;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase() || '?';
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
    const [connections, page] = await Promise.all([coreApi.getConnections().catch(() => null), coreApi.getMeetings().catch(() => null)]);
    if (connections) setRelationships(connections.filter(c => c.status === 'ACTIVE').length);
    if (page) setMeetings(page.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
      loadNetwork();
    }, [refreshIfStale, loadNetwork]),
  );

  async function refresh() {
    await Promise.all([refreshEvents(), loadNetwork()]);
  }
  // Pull to refresh on the updates list.
  const { refreshing, handleRefresh } = usePullToRefresh(refresh);

  // Collapsing header (native driver, so it stays smooth): as the list
  // scrolls up, the greeting and card drift up at about half speed and fade,
  // and the Updates tabs rise until they stick at the top.
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const [headHeight, setHeadHeight] = useState(0);
  const [collapse, setCollapse] = useState(1);
  const range = Math.max(1, collapse);
  const headShift = scrollY.interpolate({ inputRange: [0, range], outputRange: [0, -range], extrapolate: 'clamp' });
  const headParallax = scrollY.interpolate({ inputRange: [0, range], outputRange: [0, range * 0.4], extrapolate: 'clamp' });
  const headFade = scrollY.interpolate({ inputRange: [0, range * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });

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
  const changesThisMonth = meetings.filter(m => {
    const at = new Date(m.last_activity_at);
    return at.getFullYear() === today.getFullYear() && at.getMonth() === today.getMonth();
  }).length;

  // Commits made over Bluetooth with people nearby, newest first.
  const nearbyUpdates = nearbyRequests
    .filter(r => (r.direction === 'in' && r.status !== 'declined') || (r.direction === 'out' && r.status === 'accepted'))
    .map(r => {
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
    .map(x => x.update);

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
      .filter(e => new Date(e.ends_at).getTime() > now)
      .map((e): Update => {
        const started = new Date(e.starts_at).getTime() <= now;
        const attending = typeof e.attendee_count === 'number' ? ` ${e.attendee_count.toLocaleString('en-US')} members attending.` : '';
        return {
          key: `event-${e.event_id}`,
          kind: 'event',
          meta: ['Event', eventDay(e.starts_at, now)].filter(Boolean).join(' · '),
          title: e.name,
          body: `${started ? ' is on now.' : isRegistered(e) ? ' is coming up.' : ''}${
            isRegistered(e) ? ' You are registered.' : started ? ' Registration is open.' : ' is open for registration.'
          }${attending}`,
          icon: <Ticket size={20} color={colors.text} />,
          onPress: () => navigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId: e.event_id } }),
        };
      }),
    ...TIPS.filter(t => !prefs.tipsDone[t.key]).map(
      (t): Update => ({
        key: `tip-${t.key}`,
        kind: 'tip',
        meta: 'Tip',
        title: t.title,
        body: ` ${t.body}`,
        icon: tipIcon(t.key),
        onPress: t.key === 'confirmedMeeting' ? undefined : () => openTip(t.key),
      }),
    ),
  ];
  const shown = filter === 'all' ? updates : updates.filter(u => u.kind === filter);

  return (
    // Only the updates list scrolls; the header, card and tabs stay put.
    <Screen scroll={false} style={styles.page} contentStyle={styles.fixed}>
      <View style={styles.header}>
        <Text style={styles.brand}>Ol-ga</Text>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Your account">
          <Avatar initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" dark />
        </Pressable>
      </View>

      {/* The list scrolls under this header; see the collapse values above. */}
      <View style={styles.scrollArea}>
        <Animated.ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingTop: headHeight }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} progressViewOffset={headHeight} />}
        >
          {shown.map(u => (
            <Pressable
              key={u.key}
              onPress={u.onPress}
              disabled={!u.onPress}
              style={styles.row}
              accessibilityRole={u.onPress ? 'button' : undefined}
            >
              <View style={[styles.icon, u.kind === 'network' && styles.iconPerson, u.key === 'tip-confirmedMeeting' && styles.iconAmber]}>
                {u.icon}
              </View>
              <View style={styles.flex}>
                <Text style={styles.meta}>{u.meta}</Text>
                <Text style={styles.body} numberOfLines={2}>
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
        </Animated.ScrollView>

        <Animated.View
          style={[styles.head, { transform: [{ translateY: headShift }] }]}
          onLayout={e => setHeadHeight(e.nativeEvent.layout.height)}
        >
          <Animated.View
            style={[styles.collapsible, { opacity: headFade }]}
            onLayout={e => setCollapse(e.nativeEvent.layout.height + COLLAPSIBLE_GAP)}
          >
            {/* Clipped, so the slower drift slides under the edge, never over the tabs. */}
            <Animated.View style={[styles.collapsibleInner, { transform: [{ translateY: headParallax }] }]}>
              {/* Short and calm, as in Calendar or Mail: "Sun, 18 Oct". */}
              <Text style={styles.date}>
                {WEEKDAYS[today.getDay()].slice(0, 3)}, {today.getDate()} {MONTHS[today.getMonth()].slice(0, 3)}
              </Text>
              {/* Sree: a simple "Hey <first name>", no time-of-day wishes. */}
              <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit>
                Hey {firstName || 'there'},
              </Text>
              <Text style={styles.achieve}>What do you want to achieve today?</Text>

              {/* The Olga agent (a preview for now). */}
              <Pressable
                onPress={() => navigation.navigate('OlgaAgent')}
                accessibilityRole="button"
                accessibilityLabel="Ask Ol-ga anything"
                style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
              >
                <OlgaMark size={32} colors={colors} />
                <Text style={styles.askText}>Ask Ol-ga anything…</Text>
                <View style={styles.askMic}>
                  <Mic size={18} color={colors.onInk} strokeWidth={2} />
                </View>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBleed} contentContainerStyle={styles.chips}>
                {OLGA_PROMPTS.map(({ icon: Icon, label }) => (
                  <Pressable
                    key={label}
                    onPress={() => navigation.navigate('OlgaAgent', { prompt: label })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  >
                    <Icon size={15} color={colors.text} strokeWidth={1.8} />
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

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
                accessibilityLabel="Your Social Capital Index"
              >
                {/* Soft overlapping rings: the member's circles of people. */}
                <View style={styles.rings}>
                  <View style={[styles.ring, styles.ringOuter]} />
                  <View style={[styles.ring, styles.ringMid]} />
                  <View style={[styles.ring, styles.ringInner]} />
                </View>
                <View style={styles.flex}>
                  {/* Sree: "Your", not the member's name. */}
                  <Text style={styles.capitalTitle} numberOfLines={1}>
                    Your Social Capital Index
                  </Text>
                  <View style={styles.countRow}>
                    <Text style={styles.count}>{relationships === null ? '–' : relationships.toLocaleString('en-US')}</Text>
                    <Text style={styles.month}>
                      {MONTHS[today.getMonth()].slice(0, 3)} {today.getFullYear()}
                    </Text>
                  </View>
                  <Text style={styles.countLabel}>Confirmed professional relationships</Text>
                </View>
                <View style={styles.capitalGo}>
                  <ChevronRight size={18} color={colors.text} />
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>

          <View style={styles.updatesHead}>
            <Text style={styles.h2}>Updates</Text>
            {changesThisMonth > 0 && (
              <Text style={styles.sub}>
                {changesThisMonth} network {changesThisMonth === 1 ? 'change' : 'changes'} this month
              </Text>
            )}
          </View>
          <View style={styles.tabs}>
            {FILTERS.map(f => {
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
                </Pressable>
              );
            })}
            <SlidingUnderline
              count={FILTERS.length}
              index={FILTERS.findIndex(f => f.key === filter)}
              lineWidth={44}
              color={colors.selected}
              inset={8}
            />
          </View>
        </Animated.View>
      </View>

      <ComingSoonModal
        visible={indexSoon}
        onClose={() => setIndexSoon(false)}
        icon={UsersRound}
        title="Your Social Capital Graph"
        message="Your graph is coming soon. For now, this card shows your confirmed relationships."
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    brand: { fontFamily: display, fontSize: 30, lineHeight: 34, color: colors.text },
    date: { fontSize: 12, letterSpacing: 0.3, color: colors.muted, marginTop: 4 },
    // The display serif, large, as in Req1.
    greeting: { fontFamily: display, fontSize: 46, lineHeight: 50, color: colors.text, marginTop: -8 },
    achieve: { fontSize: 16, lineHeight: 22, color: colors.muted, marginTop: -10 },
    // Ask Olga: a white pill with Olga's mark and a round ink mic.
    ask: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 56,
      marginTop: 6,
      paddingLeft: 12,
      paddingRight: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      shadowColor: '#3A2A1A',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    askText: { flex: 1, fontSize: 15, color: colors.muted },
    askMic: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    // Prompts scroll sideways, edge to edge.
    chipsBleed: { marginHorizontal: -20, marginTop: -2 },
    chips: { gap: 8, paddingHorizontal: 20 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 36,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    chipText: { fontSize: 13, color: colors.text },
    // A quiet line, not a call to action: no box, small muted text.
    setup: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22, marginTop: -2, alignSelf: 'flex-start' },
    // No font padding and a fixed line height, so the chevron sits on the text's centre.
    setupText: { fontSize: 13, lineHeight: 16, includeFontPadding: false, textAlignVertical: 'center', color: colors.muted },
    // A light card with soft rings (Req1), not a dark block.
    capital: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    rings: { width: 60, height: 60 },
    ring: { position: 'absolute', borderRadius: 999, borderWidth: 1.5 },
    ringOuter: { left: 0, top: 4, width: 54, height: 54, borderColor: colors.glowRing, backgroundColor: colors.glowSoft },
    ringMid: { left: 7, top: 0, width: 52, height: 52, borderColor: colors.glowRing2 },
    ringInner: { left: 14, top: 11, width: 36, height: 36, borderColor: colors.glowRing },
    capitalTitle: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
    countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    count: { fontFamily: display, fontSize: 44, lineHeight: 50, color: colors.text },
    month: { fontSize: 12, color: colors.muted },
    countLabel: { fontSize: 12, color: colors.muted, marginTop: -2 },
    capitalGo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.85 },
    // The screen's 12 gap is too loose here: the title sits close to the card, its tabs and the list.
    updatesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 2, marginBottom: -8 },
    h2: { fontFamily: fonts.bodyBold, fontSize: 18, fontWeight: semibold, color: colors.text },
    sub: { fontSize: 12, color: colors.muted },
    // Filters as text tabs with an underline, edge to edge above the list.
    tabs: {
      flexDirection: 'row',
      marginHorizontal: -20,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    // The underline sits on the divider (no gap below it); 40 still makes a comfortable tap target.
    tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 4, minHeight: 36 },
    tabText: { fontSize: 14, color: colors.muted, paddingBottom: 9 },
    tabTextActive: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.text },
    // Rows run edge to edge, split by hairlines.
    // The page itself doesn't scroll: no bottom padding here, the list has it.
    fixed: { flex: 1, paddingBottom: 0 },
    scrollArea: { flex: 1, overflow: 'hidden' },
    list: { flex: 1, marginHorizontal: -20 },
    listContent: { paddingBottom: FLOATING_TAB_SPACE },
    // Over the list; its background hides the rows scrolling under it.
    head: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
    collapsible: { marginBottom: COLLAPSIBLE_GAP, overflow: 'hidden' },
    collapsibleInner: { gap: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      // Same height for every update: meta line + up to two lines of text.
      height: 78,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // People's initials on the soft brand tint (as Avatar).
    iconPerson: { backgroundColor: colors.accentFill },
    iconAmber: { backgroundColor: colors.amberSoft },
    initials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.accent },
    meta: { fontSize: 12, color: colors.muted },
    body: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 1 },
    bodyBold: { fontFamily: fonts.bodyBold, fontWeight: semibold },
    empty: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingVertical: 18 },
  });
