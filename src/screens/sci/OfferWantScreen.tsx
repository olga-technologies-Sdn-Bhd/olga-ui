import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { ApiError, withRetries } from '../../api/client';
import { nlpApi } from '../../api/nlp';
import type { VentureIntentSetRequest } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { loadIntentSet, saveIntentSet } from '../../sci/intentStore';
import { buildIntentSet, cleanIntentText, INTENT_TEXT_MAX, intentProblem, intentProgress, IntentProgress, SavedIntentSet } from '../../sci/intents';
import { safeLogLine } from '../../sci/problems';
import { useBackoffPoll } from '../../sci/useBackoffPoll';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'OfferWant'>;

// What the business offers and what it wants. Sent together; Ol-ga reads them
// in the background, so progress is checked until both are ready.
export function OfferWantScreen({ navigation, route }: Props) {
  const { ventureId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState('');
  const [want, setWant] = useState('');
  const [sent, setSent] = useState<SavedIntentSet | null>(null);
  const [progress, setProgress] = useState<IntentProgress>('processing');
  const [sending, setSending] = useState(false);
  // The same texts sent again reuse the same IDs (a retry of one action); any
  // change is a new set with new IDs.
  const attempt = useRef<VentureIntentSetRequest | null>(null);

  useEffect(() => {
    let active = true;
    if (!memberId) {
      setLoading(false);
      return;
    }
    loadIntentSet(memberId, ventureId)
      .then((saved) => {
        if (!active || !saved) return;
        setSent(saved);
        setOffer(saved.offer_text);
        setWant(saved.want_text);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [memberId, ventureId]);

  const cleanOffer = cleanIntentText(offer);
  const cleanWant = cleanIntentText(want);
  const changed = !sent || sent.offer_text !== cleanOffer || sent.want_text !== cleanWant;

  const { timedOut, refresh } = useBackoffPoll(
    async () => {
      if (!sent) return true;
      const [o, w] = await Promise.all([nlpApi.getIntent(sent.offer_intent_id), nlpApi.getIntent(sent.want_intent_id)]);
      const now = intentProgress(o, w);
      setProgress(now);
      return now !== 'processing';
    },
    { enabled: !!sent && progress === 'processing' }
  );

  const submit = async () => {
    if (!cleanOffer || !cleanWant || !memberId || sending) return;
    if (attempt.current?.offer_text !== cleanOffer || attempt.current.want_text !== cleanWant) {
      attempt.current = buildIntentSet(ventureId, cleanOffer, cleanWant);
    }
    const request = attempt.current;
    setSending(true);
    try {
      await withRetries((timeoutMs) => nlpApi.submitVentureIntentSet(request, { timeoutMs }));
      const saved: SavedIntentSet = {
        venture_id: ventureId,
        offer_intent_id: request.offer_intent_id,
        want_intent_id: request.want_intent_id,
        offer_text: cleanOffer,
        want_text: cleanWant,
      };
      await saveIntentSet(memberId, saved).catch(() => undefined);
      attempt.current = null;
      setProgress('processing');
      setSent(saved);
    } catch (e) {
      // An ID clash or key mismatch: this attempt cannot be repeated as it is.
      if (e instanceof ApiError && e.status === 409) attempt.current = null;
      const line = safeLogLine('Send offer and want', e);
      if (line) console.warn(line);
      showDialog("Couldn't save that", intentProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const status = !sent || changed
    ? null
    : progress === 'ready'
      ? 'Ready. Ol-ga has read what you offer and want.'
      : progress === 'failed'
        ? "Ol-ga couldn't read this. Change the words a little and save again."
        : timedOut
          ? 'This is taking longer than usual.'
          : 'Ol-ga is reading what you wrote…';

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Offer and want" />
      {loading ? (
        <Text style={styles.sub}>Loading…</Text>
      ) : (
        <>
          <Text style={styles.lead}>Tell Ol-ga what your business offers and what it wants. Plain words are best.</Text>
          <Text style={styles.label}>What you offer</Text>
          <TextInput
            value={offer}
            onChangeText={setOffer}
            placeholder="e.g. Recyclable packaging design and small-batch manufacturing"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={INTENT_TEXT_MAX}
            multiline
            accessibilityLabel="What you offer"
          />
          <Text style={styles.label}>What you want</Text>
          <TextInput
            value={want}
            onChangeText={setWant}
            placeholder="e.g. Introductions to consumer brands and sustainable-material suppliers"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={INTENT_TEXT_MAX}
            multiline
            accessibilityLabel="What you want"
          />
          <Text style={styles.note}>Both are needed. You can change them any time.</Text>
          <Button
            label={sent ? 'Save changes' : 'Save'}
            loading={sending}
            disabled={!cleanOffer || !cleanWant || (!changed && progress !== 'failed')}
            onPress={submit}
            style={styles.save}
          />
          {status && (
            <Card>
              <Text style={styles.body}>{status}</Text>
              {(timedOut || progress === 'failed') && progress !== 'ready' && (
                <Button label="Check again" variant="secondary" small onPress={refresh} style={styles.again} />
              )}
            </Card>
          )}
          {sent && progress === 'ready' && !changed && (
            <Button
              label="See your network"
              variant="secondary"
              onPress={() => navigation.navigate('Sci', { ventureId })}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    lead: { fontSize: 14, lineHeight: 20, color: colors.text },
    label: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.muted,
      fontWeight: semibold,
      marginTop: 6,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
      minHeight: 96,
      textAlignVertical: 'top',
    },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted },
    save: { marginTop: 8 },
    again: { marginTop: 10, alignSelf: 'flex-start' },
    sub: { fontSize: 12, color: colors.muted },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
  });
