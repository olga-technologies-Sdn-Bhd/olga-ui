import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Check, ChevronRight, Mic, SlidersHorizontal, Ticket, TrendingUp, UsersRound } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { coreApi } from '../../api/core';
import type { Meeting } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { CapitalOrb } from '../../components/CapitalOrb';
import { ComingSoonModal } from '../../components/ComingSoonModal';
import { GoLiveMark } from '../../components/GoLiveMark';
import { APP_ENV } from '../../config/env';
import { FLOATING_TAB_SPACE, usePullToRefresh, useTopInset } from '../../components/Screen';
import { SlidingUnderline } from '../../components/SlidingUnderline';
import { useAuth } from '../../context/AuthContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useNearby } from '../../context/NearbyContext';
import { TipKey, usePrefs } from '../../context/PrefsContext';
import { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { OlgaMark } from '../../components/OlgaMark';
import { OLGA_PROMPTS } from './OlgaAgentScreen';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Home'>, BottomTabScreenProps<MainTabParamList>>;

// The hero photo follows the time of day (Unsplash License; see
// home-photos.CREDIT.txt). The title's colour suits each photo, measured where
// the title sits: bright skies (mean luminance 216-236 of 255) get ink text,
// the night sky (30) white text. wash: a soft veil down from the top of the
// photo, the same tone as the paper behind the text, to keep it crisp.
type Period = 'morning' | 'noon' | 'evening' | 'night';
type Photo = { source: number; lightText: boolean; wash: string };
const PHOTOS: Record<Period, Photo> = {
  morning: { source: require('../../assets/images/home-morning.jpg'), lightText: false, wash: 'rgba(255,250,244,0.35)' },
  noon: { source: require('../../assets/images/home-noon.jpg'), lightText: false, wash: 'rgba(255,255,255,0.4)' },
  evening: { source: require('../../assets/images/home-evening.jpg'), lightText: false, wash: 'rgba(255,246,236,0.35)' },
  night: { source: require('../../assets/images/home-night.jpg'), lightText: true, wash: 'rgba(0,0,0,0.2)' },
};
const PERIODS: Period[] = ['morning', 'noon', 'evening', 'night'];
// Shown after "Hey <name>," in the small header greeting once scrolled (the
// big greeting at rest stays plain, as Sree asked). Night says evening:
// "good night" reads as a goodbye.
const WISHES: Record<Period, string> = { morning: 'good morning', noon: 'good afternoon', evening: 'good evening', night: 'good evening' };
// Morning 5-11, noon 11-16, evening 16-19, night after that.
function periodAt(hour: number): Period {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'noon';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}
// The photos' shape (1080 x 1384), so they fill the width without distortion.
const HERO_RATIO = 1384 / 1080;

// The fixed header under the status bar: the wordmark, large at rest and
// shrinking as the page scrolls.
const HEADER_H = 52;
const BRAND_SIZE = 30;
const BRAND_MIN_SCALE = 0.7;
// The Ask bar's band (bar + its padding). Once settled, the photo above it
// stays as a short banner whose bottom fades softly into the white below.
const ASK_BAND = 66;
const BANNER_FADE = 28;
// The Updates tabs' height (pinned under the banner once they reach it).
const TABS_H = 39;
// Side margin of the top section (header, greeting, Ask bar, prompts, card).
const SIDE = 14;

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

// Home (after Req1). At rest: a photo for the time of day behind a large
// "Ol-ga", the greeting, the Ask Ol-ga bar and its prompts, then the Social
// Capital card. As the page scrolls (all on the native driver): the wordmark
// shrinks, the greeting fades, the Ask bar glides up under the header and the
// photo shrinks with it into a short banner that stays at the top; the card
// fades away, the updates rise on a white sheet and their tabs pin under the
// banner. Every number comes from Core; parts of the design with no API yet
// are left out, not faked.
export function HomeScreen({ navigation }: Props) {
  const { name } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topInset = useTopInset();
  const { width, height: screenHeight } = useWindowDimensions();
  const { prefs } = usePrefs();
  // Shared, admin-managed list (soonest first): always the latest data.
  const { events, refresh: refreshEvents, refreshIfStale } = useEvents();
  // null until the first load finishes.
  const [relationships, setRelationships] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [indexSoon, setIndexSoon] = useState(false);
  // Measured positions: how far down the page the Ask bar rests (the
  // greeting's height), where the tabs rest, and the wordmark's width (to
  // shrink it towards its left edge).
  const [askAt, setAskAt] = useState(160);
  const [sheetAt, setSheetAt] = useState(800);
  const [tabsInSheet, setTabsInSheet] = useState(50);
  const [brandWidth, setBrandWidth] = useState(80);
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const now = Date.now();
  const today = new Date(now);
  // Team builds only: a long press on the wordmark tries the next time of day.
  const [tryPeriod, setTryPeriod] = useState<Period | null>(null);
  const period = tryPeriod ?? periodAt(today.getHours());
  const photo = PHOTOS[period];
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

  // Status bar icons match the title over the photo (the banner keeps the
  // photo at the top), back to the usual style when Home is left.
  const usualBar = scheme === 'dark' ? 'light-content' : 'dark-content';
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(photo.lightText ? 'light-content' : 'dark-content', true);
      return () => StatusBar.setBarStyle(usualBar, true);
    }, [photo.lightText, usualBar]),
  );

  async function refresh() {
    await Promise.all([refreshEvents(), loadNetwork()]);
  }
  const { refreshing, handleRefresh } = usePullToRefresh(refresh);

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const span = Math.max(1, askAt);
  const clamp = 'clamp' as const;
  // The wordmark shrinks towards its left edge.
  const brandScale = scrollY.interpolate({ inputRange: [0, span], outputRange: [1, BRAND_MIN_SCALE], extrapolate: clamp });
  const brandShift = scrollY.interpolate({
    inputRange: [0, span],
    outputRange: [0, (-brandWidth * (1 - BRAND_MIN_SCALE)) / 2],
    extrapolate: clamp,
  });
  // As it shrinks, the wordmark lifts a little and a small "Hey <name>,"
  // rises in beneath it.
  const brandLift = scrollY.interpolate({ inputRange: [0, span], outputRange: [0, -8], extrapolate: clamp });
  const helloIn = scrollY.interpolate({ inputRange: [span * 0.55, span], outputRange: [0, 1], extrapolate: clamp });
  const helloRise = scrollY.interpolate({ inputRange: [span * 0.55, span], outputRange: [8, 0], extrapolate: clamp });
  // The big greeting drifts up slower than the page and fades.
  const greetFade = scrollY.interpolate({ inputRange: [0, span * 0.75], outputRange: [1, 0], extrapolate: clamp });
  const greetShift = scrollY.interpolate({ inputRange: [0, span], outputRange: [0, span * 0.4], extrapolate: clamp });
  // The Ask bar moves with the page until it reaches the header, then stays.
  const askY = scrollY.interpolate({ inputRange: [0, span], outputRange: [span, 0], extrapolate: clamp });
  // The photo at the top moves with the page until the bar settles, then
  // stays as the banner (the same pixels as the page's photo until then).
  const photoShift = scrollY.interpolate({ inputRange: [0, span], outputRange: [0, -span], extrapolate: clamp });
  // The banner (the photo behind the settled bar) eases in as the bar
  // arrives; it shows the same pixels as the page's photo underneath.
  // (It starts after the page has moved, so at rest there's no trace of it.)
  const bannerIn = scrollY.interpolate({ inputRange: [span * 0.35, span], outputRange: [0, 1], extrapolate: clamp });
  // The Social Capital card fades gently as it passes under the banner.
  const cardFade = scrollY.interpolate({ inputRange: [span - 20, span + 260], outputRange: [1, 0], extrapolate: clamp });
  // The tabs move with the page until they reach the banner, then pin there.
  const tabsAt = sheetAt + tabsInSheet;
  const tabsTravel = Math.max(1, tabsAt - ASK_BAND);
  const tabsY = scrollY.interpolate({ inputRange: [0, tabsTravel], outputRange: [tabsAt, ASK_BAND], extrapolate: clamp });

  function tipIcon(key: TipKey) {
    if (key === 'wentLive') return <GoLiveMark size={20} color={colors.accent} />;
    if (key === 'savedFilter') return <SlidersHorizontal size={18} color={colors.accent} />;
    return <Check size={18} color={colors.accent} strokeWidth={2.4} />;
  }

  function openTip(key: TipKey) {
    if (key === 'wentLive') navigation.navigate('GoLiveTab', { screen: 'GoLive' });
    if (key === 'savedFilter') navigation.navigate('GoLiveTab', { screen: 'Filters' });
  }

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
          icon: <Ticket size={18} color={colors.accent} />,
          onPress: () => navigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId: e.event_id }, initial: false }),
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
  const headerHeight = topInset + HEADER_H;
  const onPhoto = photo.lightText ? styles.onPhotoLight : styles.onPhotoDark;
  const imageHeight = Math.round(width * HERO_RATIO);
  // The photo with its top wash; every copy (page, header, banner) carries
  // the same wash so they line up exactly.
  const photoImage = (
    <View>
      <Animated.Image source={photo.source} style={{ width, height: imageHeight }} resizeMode="cover" />
      <LinearGradient
        colors={[photo.wash, photo.wash.replace(/[\d.]+\)$/, '0)')]}
        style={[styles.scrim, { height: imageHeight * 0.55 }]}
      />
    </View>
  );

  return (
    <View style={styles.page}>
      <Animated.ScrollView
        style={[styles.flex, { marginTop: headerHeight }]}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* The greeting, over the photo (which starts under the status bar
            and fades into the page ground below the card's top). */}
        <View style={styles.hero} onLayout={e => setAskAt(e.nativeEvent.layout.height)}>
          <View style={[styles.photo, { top: -headerHeight }]} pointerEvents="none">
            {photoImage}
            <LinearGradient
              colors={[colors.bgClear, colors.bg]}
              style={[styles.photoFade, { top: imageHeight * 0.5, height: imageHeight * 0.5 }]}
            />
          </View>
          <Animated.View style={{ opacity: greetFade, transform: [{ translateY: greetShift }] }}>
            {/* Calm, as in Calendar or Mail: "Monday, 19 October". */}
            <Text style={[styles.date, onPhoto]}>
              {WEEKDAYS[today.getDay()]}, {today.getDate()} {MONTHS[today.getMonth()]}
            </Text>
            {/* Sree: a simple "Hey <first name>", no time-of-day wishes. */}
            <Text style={[styles.greeting, onPhoto]} numberOfLines={1} adjustsFontSizeToFit>
              Hey {firstName || 'there'},
            </Text>
            <Text style={[styles.achieve, onPhoto]}>What do you want to achieve today?</Text>
          </Animated.View>
        </View>

        {/* Room for the Ask bar, which floats above the page (see below). */}
        <View style={{ height: ASK_BAND }} />

        {/* Prompts and the Social Capital card (fade as the page scrolls). */}
        <Animated.View style={[styles.body, { opacity: cardFade }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBleed} contentContainerStyle={styles.chips}>
            {OLGA_PROMPTS.map(({ icon: Icon, label }) => (
              <Pressable
                key={label}
                onPress={() => navigation.navigate('OlgaAgent', { prompt: label })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <View style={styles.chipIcon}>
                  <Icon size={13} color={colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.capital, pressed && styles.pressed]}
            onPress={() => setIndexSoon(true)}
            accessibilityRole="button"
            accessibilityLabel="Your Social Capital Index"
          >
            <View style={styles.capitalTop}>
              {/* Sree: "Your", not the member's name. */}
              <Text style={styles.capitalTitle}>Your Social Capital Index</Text>
              <ChevronRight size={20} color={colors.muted} />
            </View>
            <View style={styles.capitalRow}>
              <CapitalOrb size={76} />
              <View style={styles.flex} collapsable={false}>
                <View style={styles.countRow}>
                  <Text style={styles.count}>{relationships === null ? '–' : relationships.toLocaleString('en-US')}</Text>
                </View>
                <Text style={styles.countLabel}>Confirmed professional relationships</Text>
                {changesThisMonth > 0 && (
                  <View style={styles.delta}>
                    {/* Growth: an up-trend mark before the count. */}
                    <TrendingUp size={14} color={colors.positive} strokeWidth={2.4} />
                    <Text style={styles.deltaText}>
                      +{changesThisMonth} network {changesThisMonth === 1 ? 'change' : 'changes'} this month
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('ProfileSetup')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.setup, pressed && styles.pressed]}
          >
            <Text style={styles.setupText}>Let me help you with your introduction</Text>
            <ChevronRight size={15} color={colors.muted} />
          </Pressable>
        </Animated.View>

        {/* The updates, on a white sheet. */}
        <View
          style={[styles.sheet, { minHeight: screenHeight - headerHeight - ASK_BAND }]}
          onLayout={e => setSheetAt(e.nativeEvent.layout.y)}
        >
          <View style={styles.updatesHead}>
            <Text style={styles.h2}>Updates</Text>
          </View>
          {/* Room for the tabs, which float above the page (see below). */}
          <View style={{ height: TABS_H }} onLayout={e => setTabsInSheet(e.nativeEvent.layout.y)} />

          {/* One white panel holding the rows, on the page ground. */}
          {shown.length > 0 && (
            <View style={styles.panel} collapsable={false}>
              {shown.map((u, i) => {
                // "Network · 3h" -> a small label on the left, the time on the right.
                const [label, when] = u.meta.split(' · ');
                return (
                  <Pressable
                    key={u.key}
                    onPress={u.onPress}
                    disabled={!u.onPress}
                    android_ripple={u.onPress ? { color: colors.accentFill } : undefined}
                    style={styles.row}
                    accessibilityRole={u.onPress ? 'button' : undefined}
                  >
                    {/* People: soft grey initials. Events and tips: a caramel circle. */}
                    <View style={[styles.icon, u.kind !== 'network' && styles.iconInk]}>{u.icon}</View>
                    {/* collapsable={false}: the divider comes and goes as the list changes, and a
                        flattened view here makes Fabric fail to insert (addViewAt, count=0). */}
                    <View style={[styles.rowBody, i < shown.length - 1 && styles.rowDivider]} collapsable={false}>
                      <View style={styles.flex}>
                        <View style={styles.metaRow} collapsable={false}>
                          <Text style={styles.meta}>{label}</Text>
                          {!!when && <Text style={styles.when}>{when}</Text>}
                        </View>
                        <Text style={styles.rowText} numberOfLines={2}>
                          <Text style={styles.bodyBold}>{u.title}</Text>
                          {u.body}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
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
      </Animated.ScrollView>

      {/* Above the page: the header, the banner, the Ask bar and the pinned
          tabs. Touches elsewhere fall through to the page. */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* The photo's top, behind the status bar and the header. */}
        <View style={[styles.clip, { height: headerHeight }]} pointerEvents="none">
          <Animated.View style={{ transform: [{ translateY: photoShift }] }}>{photoImage}</Animated.View>
        </View>
        {/* The banner: the photo behind the header and the settled bar. */}
        <Animated.View style={[styles.clip, { height: headerHeight + ASK_BAND, opacity: bannerIn }]} pointerEvents="none">
          <Animated.View style={{ transform: [{ translateY: photoShift }] }}>{photoImage}</Animated.View>
          <LinearGradient colors={[colors.bgClear, colors.bg]} style={styles.bannerFade} />
        </Animated.View>

        {/* The tabs (they ride with the page until they reach the banner, then pin). */}
        <Animated.View style={[styles.tabsFloat, { top: headerHeight, transform: [{ translateY: tabsY }] }]}>
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
        </Animated.View>

        <View style={[styles.header, { height: headerHeight, paddingTop: topInset }]} pointerEvents="box-none">
          <Pressable
            disabled={APP_ENV === 'prod'}
            onLongPress={() => setTryPeriod(PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length])}
            accessibilityElementsHidden
          >
            <Animated.Text
              style={[styles.brand, onPhoto, { transform: [{ translateX: brandShift }, { translateY: brandLift }, { scale: brandScale }] }]}
              onLayout={e => setBrandWidth(e.nativeEvent.layout.width)}
            >
              Ol-ga
            </Animated.Text>
            <Animated.Text
              style={[styles.hello, onPhoto, { opacity: helloIn, transform: [{ translateY: helloRise }] }]}
              numberOfLines={1}
            >
              Hey {firstName || 'there'}, {WISHES[period]}
            </Animated.Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Your account">
            <Avatar initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" dark />
          </Pressable>
        </View>

        <Animated.View style={[styles.askWrap, { top: headerHeight, transform: [{ translateY: askY }] }]} pointerEvents="box-none">
          <Pressable
            onPress={() => navigation.navigate('OlgaAgent')}
            accessibilityRole="button"
            accessibilityLabel="Ask Ol-ga anything"
            style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
          >
            <OlgaMark size={32} />
            <Text style={styles.askText}>Ask Ol-ga anything…</Text>
            <View style={styles.askMic}>
              <Mic size={18} color={colors.onInk} strokeWidth={2} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <ComingSoonModal
        visible={indexSoon}
        onClose={() => setIndexSoon(false)}
        icon={UsersRound}
        title="Your Social Capital Index"
        message="Your full index is coming soon. For now, this card shows your confirmed relationships."
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { flex: 1, backgroundColor: colors.bg },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    clip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
    bannerFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BANNER_FADE },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: SIDE },
    brand: { fontFamily: fonts.headingBold, fontSize: BRAND_SIZE, fontWeight: semibold, letterSpacing: -0.6, color: colors.text },
    // Small, under the shrunk wordmark once the big greeting has scrolled away.
    hello: { position: 'absolute', left: 0, top: 26, width: 280, fontSize: 13, color: colors.text },
    photo: { position: 'absolute', left: 0, right: 0 },
    photoFade: { position: 'absolute', left: 0, right: 0 },
    content: { paddingBottom: FLOATING_TAB_SPACE },
    hero: { paddingHorizontal: SIDE, paddingTop: 2, paddingBottom: 2 },
    date: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text, opacity: 0.75 },
    greeting: { fontFamily: fonts.headingBold, fontSize: 36, lineHeight: 42, fontWeight: semibold, letterSpacing: -1, color: colors.text },
    achieve: { fontSize: 16, lineHeight: 21, color: colors.text, opacity: 0.92 },
    // The title over the photo: ink with a soft light halo on a bright sky,
    // white with a soft shadow on a dark one.
    onPhotoDark: { color: '#14110F', textShadowColor: 'rgba(255,255,255,0.55)', textShadowRadius: 10 },
    onPhotoLight: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } },
    askWrap: { position: 'absolute', left: 0, right: 0, height: ASK_BAND, paddingHorizontal: SIDE, justifyContent: 'center' },
    // Ask Olga: a crisp white pill (hairline, no shadow) with Olga's mark and a round ink mic.
    ask: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 52,
      paddingLeft: 9,
      paddingRight: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    askText: { flex: 1, fontSize: 15, color: colors.muted },
    askMic: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: SIDE, paddingTop: 0, paddingBottom: 12, gap: 10 },
    // Prompts scroll sideways, edge to edge.
    chipsBleed: { marginHorizontal: -SIDE },
    chips: { gap: 8, paddingHorizontal: SIDE },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 38,
      paddingLeft: 5,
      paddingRight: 13,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    chipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill },
    chipText: { fontSize: 13, color: colors.text },
    // A quiet line, not a call to action: no box, small muted text.
    setup: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22, alignSelf: 'flex-start' },
    // No font padding and a fixed line height, so the chevron sits on the text's centre.
    setupText: { fontSize: 13, lineHeight: 16, includeFontPadding: false, textAlignVertical: 'center', color: colors.muted },
    capital: {
      backgroundColor: colors.surface,
      overflow: 'hidden',
      borderRadius: radius.xl,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    capitalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    capitalTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: semibold, color: colors.text },
    capitalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -16, marginTop: 4 },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    count: { fontFamily: fonts.headingBold, fontSize: 44, lineHeight: 48, fontWeight: semibold, letterSpacing: -1.5, color: colors.text },
    delta: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.positiveSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
    deltaText: { fontFamily: fonts.bodyBold, fontSize: 11.5, fontWeight: semibold, color: colors.positive },
    countLabel: { fontSize: 13, color: colors.muted },
    pressed: { opacity: 0.85 },
    // The updates' white sheet: rounded top.
    sheet: { backgroundColor: colors.bg, paddingTop: 6 },
    // The rows' white panel: one rounded group, a hairline edge.
    panel: {
      marginHorizontal: SIDE,
      marginTop: 10,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    updatesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingHorizontal: 20 },
    h2: { fontFamily: fonts.bodyBold, fontSize: 19, fontWeight: semibold, color: colors.text },
    // The tabs float above the page on its ground, edge to edge.
    tabsFloat: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: TABS_H,
      flexDirection: 'row',
      paddingHorizontal: 12,
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    // The underline sits on the divider (no gap below it).
    tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 6 },
    tabText: { fontSize: 14, color: colors.muted, paddingBottom: 9 },
    tabTextActive: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.text },
    // One compact height for every update; the hairline starts after the icon.
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, height: 76 },
    rowBody: { flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    // One soft warm circle for every update, with an ink icon.
    icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill },
    iconInk: { backgroundColor: colors.accentWash },
    initials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    // A small uppercase label (NETWORK, EVENT, TIP) and the time on the right.
    meta: { fontFamily: fonts.bodyBold, fontSize: 10.5, fontWeight: semibold, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
    when: { fontSize: 12, color: colors.muted },
    rowText: { fontSize: 14.5, lineHeight: 20, color: colors.text, marginTop: 3 },
    bodyBold: { fontFamily: fonts.bodyBold, fontWeight: semibold },
    empty: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingVertical: 18 },
  });
