import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coreApi } from '../../api/core';
import type { SciContact } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { HomeStackParamList } from '../../navigation/types';
import { connectionProblem, GENERIC_PROBLEM, safeLogLine } from '../../sci/problems';
import { appendPage, displayScore, refreshFirstPage, roleLabel, scoreBand, scoringSettled } from '../../sci/score';
import { useBackoffPoll } from '../../sci/useBackoffPoll';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Sci'>;

function updatedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// The people scored for the business, with the server's score and band. Scoring
// happens in the background, so the first page is looked at again until
// nothing is updating. An empty list is a normal answer, not an error.
export function SciScreen({ navigation, route }: Props) {
  const { ventureId, name } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<SciContact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [looked, setLooked] = useState(false);
  const itemsRef = useRef<SciContact[]>([]);
  // Once a later page is loaded, a refresh no longer moves the cursor back.
  const pagedOn = useRef(false);

  const show = (next: SciContact[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  // Look at the first page. True when scoring has settled, so polling stops.
  const lookAgain = useCallback(async () => {
    try {
      const page = await coreApi.getVentureSci(ventureId);
      show(refreshFirstPage(itemsRef.current, page.items));
      if (!pagedOn.current) setCursor(page.next_cursor ?? null);
      setProblem(null);
      setLooked(true);
      return scoringSettled(itemsRef.current);
    } catch (e) {
      const line = safeLogLine('Load network', e);
      if (line) console.warn(line);
      // Whatever is on screen stays; only say so when there is nothing to show.
      if (itemsRef.current.length === 0) setProblem(connectionProblem(e) ?? GENERIC_PROBLEM);
      return false;
    }
  }, [ventureId]);

  const { timedOut, refresh } = useBackoffPoll(lookAgain, { enabled: true });

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await coreApi.getVentureSci(ventureId, { cursor });
      pagedOn.current = true;
      show(appendPage(itemsRef.current, page.items));
      setCursor(page.next_cursor ?? null);
    } catch (e) {
      const line = safeLogLine('Load more of network', e);
      if (line) console.warn(line);
      setProblem(connectionProblem(e) ?? GENERIC_PROBLEM);
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshNow = async () => {
    await lookAgain();
  };

  const anyUpdating = items.some((c) => c.is_stale);

  return (
    <Screen onRefresh={refreshNow}>
      <BackHeader onBack={() => navigation.goBack()} title="Your network" />
      {!!name && <Text style={styles.sub}>{name}</Text>}

      {items.length === 0 ? (
        <Card>
          {problem ? (
            <>
              <Text style={styles.body}>{problem}</Text>
              <Button label="Try again" variant="secondary" small onPress={refresh} style={styles.action} />
            </>
          ) : !looked ? (
            <Text style={styles.body}>Loading…</Text>
          ) : timedOut ? (
            <>
              <Text style={styles.title}>No one here yet</Text>
              <Text style={styles.body}>
                Invite people you know and Ol-ga will show how well each one fits your business. If you already did, check again in a little while.
              </Text>
              <Button label="Check again" variant="secondary" small onPress={refresh} style={styles.action} />
            </>
          ) : (
            <>
              <Text style={styles.title}>We’re building your network</Text>
              <Text style={styles.body}>This can take a minute. It updates by itself.</Text>
              <Button label="Check now" variant="secondary" small onPress={refresh} style={styles.action} />
            </>
          )}
        </Card>
      ) : (
        <>
          {anyUpdating && <Text style={styles.sub}>Some scores are updating.</Text>}
          {items.map((c) => {
            const band = scoreBand(c.score);
            const role = roleLabel(c.relationship_role);
            return (
              <Card key={c.link_id}>
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{c.label}</Text>
                    <View style={styles.tags}>
                      {!!role && <Pill label={role} />}
                      {c.competitor_overlay && <Pill label="Competitor" tone="soft" />}
                      {c.is_stale && <Pill label="Updating" tone="soft" />}
                    </View>
                    {!!updatedOn(c.scored_at) && <Text style={styles.sub}>Updated {updatedOn(c.scored_at)}</Text>}
                  </View>
                  <View style={styles.scoreBox} accessible accessibilityLabel={`Score ${displayScore(c.score)}${band ? `, ${band}` : ''}`}>
                    <Text style={styles.score}>{displayScore(c.score)}</Text>
                    {band && <Text style={styles.band}>{band}</Text>}
                  </View>
                </View>
              </Card>
            );
          })}
          {problem && <Text style={styles.sub}>{problem}</Text>}
          {cursor && <Button label="Show more" variant="secondary" loading={loadingMore} onPress={more} />}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sub: { fontSize: 12, color: colors.muted },
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
