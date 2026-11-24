import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, withRetries } from '../../api/client';
import { nlpApi } from '../../api/nlp';
import type { PrimaryIntentPreview, VentureIntentSetRequest } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { RemovableTag } from '../../components/RemovableTag';
import { Screen } from '../../components/Screen';
import { TagInput } from '../../components/TagInput';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { loadIntentSet, saveIntentSet } from '../../sci/intentStore';
import {
  buildIntentSet,
  cleanIntentText,
  cleanTags,
  INTENT_TEXT_MAX,
  intentProblem,
  IntentIds,
  MAX_TAGS,
  newIntentIds,
  previewProblem,
  SavedIntentSet,
} from '../../sci/intents';
import { safeLogLine } from '../../sci/problems';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'OfferWant'>;

// What the business offers and wants, with tags. The member previews it, then
// saves it exactly as previewed. Saving starts a recalculation of their scores,
// which the network screen follows.
export function OfferWantScreen({ navigation, route }: Props) {
  const { ventureId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState('');
  const [want, setWant] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedIntentSet | null>(null);
  const [preview, setPreview] = useState<PrimaryIntentPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // The IDs of this business's offer and want stay the same on every save.
  const ids = useRef<IntentIds | null>(null);
  // The same preview saved again after a lost answer is the same request (same
  // intent_set_id and key); anything else is a new one.
  const attempt = useRef<{ signature: string; request: VentureIntentSetRequest } | null>(null);

  useEffect(() => {
    let active = true;
    if (!memberId) {
      setLoading(false);
      return;
    }
    loadIntentSet(memberId, ventureId)
      .then((s) => {
        if (!active || !s) return;
        setSaved(s);
        setOffer(s.offer_text);
        setWant(s.want_text);
        setTags(s.tags);
        ids.current = { offer_intent_id: s.offer_intent_id, want_intent_id: s.want_intent_id };
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [memberId, ventureId]);

  const cleanOffer = cleanIntentText(offer);
  const cleanWant = cleanIntentText(want);
  const ready = !!cleanOffer && !!cleanWant && tags.length > 0;

  // Any change to the words or tags makes the preview out of date.
  const changeOffer = (v: string) => (setOffer(v), setPreview(null), setJustSaved(false));
  const changeWant = (v: string) => (setWant(v), setPreview(null), setJustSaved(false));
  const changeTags = (v: string[]) => (setTags(cleanTags(v)), setPreview(null), setJustSaved(false));

  const runPreview = async () => {
    if (!ready || busy) return;
    setBusy('preview');
    try {
      setPreview(await nlpApi.previewPrimaryIntent({ offer_text: cleanOffer!, want_text: cleanWant!, tags }));
    } catch (e) {
      const line = safeLogLine('Preview primary intent', e);
      if (line) console.warn(line);
      showDialog("Couldn't preview that", previewProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!preview || !cleanOffer || !cleanWant || !memberId || busy) return;
    ids.current ??= newIntentIds();
    const signature = `${cleanOffer}|${cleanWant}|${preview.tag_fingerprint}|${preview.previewed_at}`;
    if (attempt.current?.signature !== signature) {
      attempt.current = { signature, request: buildIntentSet(ventureId, cleanOffer, cleanWant, preview, ids.current) };
    }
    const request = attempt.current.request;
    setBusy('save');
    try {
      await withRetries((timeoutMs) => nlpApi.submitVentureIntentSet(request, { timeoutMs }));
      const next: SavedIntentSet = { venture_id: ventureId, ...ids.current, offer_text: cleanOffer, want_text: cleanWant, tags: preview.canonical_tags };
      await saveIntentSet(memberId, next).catch(() => undefined);
      attempt.current = null;
      setSaved(next);
      setTags(preview.canonical_tags);
      setPreview(null);
      setJustSaved(true);
    } catch (e) {
      // The server refused this exact request for good (e.g. tags changed too
      // recently): the next try is a new one.
      if (e instanceof ApiError && e.status === 409) attempt.current = null;
      const line = safeLogLine('Save primary intent', e);
      if (line) console.warn(line);
      showDialog("Couldn't save that", intentProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const seeNetwork = () => navigation.navigate('Sci', { ventureId });

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Offer and want" />
      {loading ? (
        <Text style={styles.sub}>Loading…</Text>
      ) : (
        <>
          <Text style={styles.lead}>Tell Ol-ga what your business offers and what it wants, then add a few tags. Plain words are best.</Text>
          <Text style={styles.label}>What you offer</Text>
          <TextInput
            value={offer}
            onChangeText={changeOffer}
            placeholder="e.g. I help manufacturers automate procurement"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={INTENT_TEXT_MAX}
            multiline
            accessibilityLabel="What you offer"
          />
          <Text style={styles.label}>What you want</Text>
          <TextInput
            value={want}
            onChangeText={changeWant}
            placeholder="e.g. Introductions to regional manufacturers"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={INTENT_TEXT_MAX}
            multiline
            accessibilityLabel="What you want"
          />
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tags}>
            {tags.map((t) => (
              <RemovableTag key={t} label={t} onRemove={() => changeTags(tags.filter((x) => x !== t))} />
            ))}
          </View>
          {tags.length < MAX_TAGS && <TagInput placeholder="e.g. Manufacturing" onAdd={(t) => changeTags([...tags, t])} />}
          <Text style={styles.note}>Add at least one tag. Changing your tags is limited to once every 24 hours; rewording is fine.</Text>

          {!preview && <Button label="Preview" loading={busy === 'preview'} disabled={!ready} onPress={runPreview} style={styles.action} />}

          {preview && (
            <>
              <Card>
                <Text style={styles.title}>This is what Ol-ga will use</Text>
                <Text style={styles.body}>{preview.preview_text}</Text>
              </Card>
              <Button label="Save" loading={busy === 'save'} onPress={save} />
              <Button label="Edit" variant="secondary" onPress={() => setPreview(null)} />
            </>
          )}

          {justSaved && !preview && (
            <Card>
              <Text style={styles.title}>Saved</Text>
              <Text style={styles.body}>Ol-ga is updating your scores. Your current numbers stay on screen until they are ready.</Text>
              <Button label="See your network" small onPress={seeNetwork} style={styles.action} />
            </Card>
          )}
          {saved && !justSaved && !preview && <Button label="See your network" variant="secondary" onPress={seeNetwork} />}
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
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted },
    gap: { marginTop: 8 },
    action: { marginTop: 8, alignSelf: 'flex-start' },
    sub: { fontSize: 12, color: colors.muted },
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
  });
