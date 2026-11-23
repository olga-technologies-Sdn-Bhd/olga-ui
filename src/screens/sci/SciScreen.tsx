import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coreApi } from '../../api/core';
import type { SciContact, SciReachOut, SciSummary } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { HomeStackParamList } from '../../navigation/types';
import { connectionProblem, GENERIC_PROBLEM, safeLogLine } from '../../sci/problems';
import {
  appendPage,
  bandLabel,
  countOrNull,
  displayScore,
  formatCount,
  humanize,
  isHistory,
  isRecalculating,
  lifecycleLabel,
  reachOutName,
  refreshFirstPage,
} from '../../sci/score';
import { useBackoffPoll } from '../../sci/useBackoffPoll';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Sci'>;

// "Reach out" starts with three people; "See more" follows the server's cursor.
const REACH_OUT_FIRST = 3;

function updatedOn(iso: string | null | undefined): string {
  const d = new Date(iso ?? '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// The member's Social Capital Index: the summary, who to reach out to, and the
// people with the server's score, band and flags. Scoring runs in the
// background, so the last numbers stay on screen while they are recalculated.
export function SciScreen({ navigation, route }: Props) {
  const { ventureId, name } = route.params ?? {};
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [summary, setSummary] = useState<SciSummary | null>(null);
  const [items, setItems] = useState<SciContact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reach, setReach] = useState<SciReachOut[]>([]);
  const [reachCursor, setReachCursor] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [looked, setLooked] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsRef = useRef<SciContact[]>([]);
  // Once a later page is loaded, a refresh no longer moves the cursor back.
  const pagedOn = useRef(false);

  const show = (next: SciContact[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const report = (what: string, e: unknown) => {
    const line = safeLogLine(what, e);
    if (line) console.warn(line);
  };

  // Everything, from the first pages. Whatever is on screen stays if a call
  // fails; each part reports its own failure only when it has nothing to show.
  const loadAll = useCallback(async () => {
    const [s, c, r] = await Promise.allSettled([
      coreApi.getSciSummary(),
      coreApi.getSciContacts(),
      coreApi.getSciReachOut({ limit: REACH_OUT_FIRST }),
    ]);
    if (s.status === 'fulfilled') setSummary(s.value);
    else report('Load SCI summary', s.reason);
    if (c.status === 'fulfilled') {
      const page = c.value;
      show(refreshFirstPage(itemsRef.current, Array.isArray(page.items) ? page.items : []));
      if (!pagedOn.current) setCursor(page.next_cursor ?? null);
      setProblem(null);
    } else {
      report('Load SCI contacts', c.reason);
      if (itemsRef.current.length === 0) setProblem(connectionProblem(c.reason) ?? GENERIC_PROBLEM);
    }
    if (r.status === 'fulfilled') {
      setReach(Array.isArray(r.value.items) ? r.value.items : []);
      setReachCursor(r.value.next_cursor ?? null);
    } else {
      report('Load reach-out', r.reason);
    }
    setLooked(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // While the server says it is recalculating, look at the summary every few
  // seconds; once it is READY, read the lists again and stop.
  const recalculating = isRecalculating(summary);
  const { timedOut, refresh } = useBackoffPoll(
    async () => {
      const s = await coreApi.getSciSummary();
      setSummary(s);
      if (isRecalculating(s)) return false;
      await loadAll();
      return true;
    },
    { enabled: recalculating }
  );

  const moreContacts = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await coreApi.getSciContacts({ cursor });
      pagedOn.current = true;
      show(appendPage(itemsRef.current, page.items));
      setCursor(page.next_cursor ?? null);
    } catch (e) {
      report('Load more contacts', e);
      setProblem(connectionProblem(e) ?? GENERIC_PROBLEM);
    } finally {
      setLoadingMore(false);
    }
  };

  const moreReachOut = async () => {
    if (!reachCursor) return;
    try {
      const page = await coreApi.getSciReachOut({ cursor: reachCursor });
      setReach((prev) => [...prev, ...page.items.filter((i) => !prev.some((p) => p.recommendation_id === i.recommendation_id))]);
      setReachCursor(page.next_cursor ?? null);
    } catch (e) {
      report('Load more reach-out', e);
    }
  };

  const invite = () => navigation.navigate('Invite', { ventureId: ventureId ?? '' });
  const total = countOrNull(summary?.total_contact_count) ?? items.length;
  const active = items.filter((c) => !isHistory(c));
  const history = items.filter(isHistory);
  const goal = summary?.goal;
  const change = countOrNull(summary?.month_change);

  const person = (c: SciContact, muted = false) => {
    const score = displayScore(c.score);
    const band = bandLabel(c.band);
    return (
      <Card key={c.link_id}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.name, muted && styles.muted]}>{c.label}</Text>
            <View style={styles.tags}>
              <Pill label={lifecycleLabel(c.lifecycle_state)} />
              {c.is_estimated && <Pill label="Estimated" tone="soft" />}
              {c.counts_in_sci && <Pill label="Counts in your index" tone="positive" />}
              {muted && !!c.freeze_reason && <Pill label={humanize(c.freeze_reason)} />}
            </View>
            {!!updatedOn(c.score_calculated_at) && <Text style={styles.sub}>Updated {updatedOn(c.score_calculated_at)}</Text>}
          </View>
          {score !== null && (
            <View style={styles.scoreBox} accessible accessibilityLabel={`Score ${score}${band ? `, ${band}` : ''}${c.is_estimated ? ', estimated' : ''}`}>
              <Text style={[styles.score, muted && styles.muted]}>{score}</Text>
              {band && <Text style={styles.band}>{band}</Text>}
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <Screen onRefresh={loadAll}>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={total > 0 ? <Pill label={`${formatCount(total)} ${total === 1 ? 'person' : 'people'}`} /> : undefined}
      />
      <Text style={styles.heading}>Your network</Text>
      <Text style={styles.lead}>A private view of how your real-world relationships are evolving.</Text>
      {!!name && <Text style={styles.sub}>{name}</Text>}

      {summary && (
        <Card>
          <Text style={styles.sub}>Your Social Capital Index</Text>          <Text style={styles.big}>{formatCount(countOrNull(summary.sci_count) ?? 0)}</Text>
          {change !== null && change !== 0 && (
            <Text style={styles.sub}>
              {change > 0 ? '+' : ''}
              {formatCount(change)} this month
            </Text>
          )}
          {goal && (
            <Text style={styles.sub}>
              Goal {formatCount(goal.goal_value)}: {goal.progress_percent}%
            </Text>
          )}
          {recalculating && (
            <View style={styles.recalc}>
              <Text style={styles.sub}>{timedOut ? 'Still updating. Check again in a little while.' : 'Updating your scores…'}</Text>
              {timedOut && <Button label="Check again" variant="secondary" small onPress={() => { loadAll(); refresh(); }} style={styles.action} />}
            </View>
          )}
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.metric}>{formatCount(countOrNull(summary.potential_count) ?? 0)}</Text>
              <Text style={styles.sub}>Potential</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.metric}>{formatCount(countOrNull(summary.waitlist_count) ?? 0)}</Text>
              <Text style={styles.sub}>Waitlist</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.metric}>{formatCount(countOrNull(summary.repository_count) ?? 0)}</Text>
              <Text style={styles.sub}>Repository</Text>
            </View>
          </View>
        </Card>
      )}

      {reach.length > 0 && (
        <>
          <Text style={styles.section}>Reach out</Text>
          {reach.map((r) => (
            <Card key={r.recommendation_id}>
              <Text style={styles.name}>{reachOutName(r, items)}</Text>
              {!!humanize(r.reason_code) && <Text style={styles.sub}>{humanize(r.reason_code)}</Text>}
            </Card>
          ))}
          {reachCursor && <Button label="See more" variant="secondary" small onPress={moreReachOut} style={styles.action} />}
        </>
      )}

      {items.length === 0 ? (
        <Card>
          {problem ? (
            <>
              <Text style={styles.body}>{problem}</Text>
              <Button label="Try again" variant="secondary" small onPress={loadAll} style={styles.action} />
            </>
          ) : !looked ? (
            <Text style={styles.body}>Loading…</Text>
          ) : (
            <>
              <Text style={styles.title}>No one here yet</Text>
              <Text style={styles.body}>Invite people you know and Ol-ga will show how well each one fits your business.</Text>
              <Button label="Invite people" small onPress={invite} style={styles.action} />
            </>
          )}
        </Card>
      ) : (
        <>
          <Text style={styles.section}>People</Text>
          {active.map((c) => person(c))}
          {cursor && <Button label="Show more" variant="secondary" loading={loadingMore} onPress={moreContacts} />}
          {problem && <Text style={styles.sub}>{problem}</Text>}
          {history.length > 0 && (
            <>
              <Text style={styles.section}>History</Text>
              {history.map((c) => person(c, true))}
            </>
          )}
          <Button label="Invite more people" variant="secondary" onPress={invite} />
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sub: { fontSize: 12, color: colors.muted },
    muted: { color: colors.muted },
    heading: { fontFamily: fonts.headingBold, fontSize: 26, fontWeight: semibold, color: colors.text },
    lead: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: -6 },
    section: { fontSize: 13, fontWeight: semibold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
    big: { fontSize: 40, fontWeight: '800', color: colors.text },
    grid: { flexDirection: 'row', gap: 10, marginTop: 12 },
    cell: { flex: 1, backgroundColor: colors.accentSoft, borderRadius: 14, padding: 12, gap: 2 },
    metric: { fontSize: 22, fontWeight: '800', color: colors.text },
    recalc: { marginTop: 6 },
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 4 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    action: { marginTop: 10, alignSelf: 'flex-start' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { flex: 1, gap: 6 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    name: { fontSize: 16, fontWeight: semibold, color: colors.text },
    scoreBox: { alignItems: 'center', minWidth: 64 },
    score: { fontSize: 28, fontWeight: semibold, color: colors.text },
    band: { fontSize: 11, color: colors.muted },
  });
