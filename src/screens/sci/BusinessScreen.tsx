import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Briefcase, CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { newIdempotencyKey, withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { BUSINESS_NAME_MAX, businessesFrom, businessProblem, chooseBusiness, cleanBusinessName, SavedBusiness } from '../../sci/business';
import { loadBusiness, saveBusiness } from '../../sci/businessStore';
import { newId } from '../../sci/ids';
import { safeLogLine } from '../../sci/problems';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Business'>;

// The member's Business or Project, the start of their Social Capital Index.
// The API has no list call, so the saved one is kept on this phone.
export function BusinessScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<SavedBusiness | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  // Trying again with the same name reuses the same ID and key, so a lost
  // answer never makes a second business; a new name is a new action.
  const attempt = useRef<{ name: string; ventureId: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!memberId) {
      setLoading(false);
      return;
    }
    (async () => {
      const saved = await loadBusiness(memberId);
      if (active) {
        setBusiness(saved);
        setLoading(false);
      }
      // Ask Core too, so a business made before a reinstall comes back. If
      // that fails, what is on the phone stays.
      try {
        const found = chooseBusiness(saved, businessesFrom(await coreApi.listVentures()));
        if (found && active) {
          setBusiness(found);
          if (found.venture_id !== saved?.venture_id || found.name !== saved?.name) await saveBusiness(memberId, found);
        }
      } catch {
        // Offline or Core asleep: nothing to show the member.
      }
    })();
    return () => {
      active = false;
    };
  }, [memberId]);

  const clean = cleanBusinessName(name);

  const save = async () => {
    if (!clean || !memberId || saving) return;
    if (attempt.current?.name !== clean) attempt.current = { name: clean, ventureId: newId('venture'), key: newIdempotencyKey() };
    const { ventureId, key } = attempt.current;
    setSaving(true);
    try {
      const venture = await withRetries((timeoutMs) =>
        coreApi.createVenture({ venture_id: ventureId, name: clean }, { idempotencyKey: key, timeoutMs })
      );
      const saved = { venture_id: venture.venture_id, name: venture.name };
      await saveBusiness(memberId, saved);
      attempt.current = null;
      setBusiness(saved);
    } catch (e) {
      const problem = businessProblem(e);
      if (problem.newId) attempt.current = null;
      // Only the code and correlation id: never the name or the request.
      const line = safeLogLine('Save business', e);
      if (line) console.warn(line);
      showDialog("Couldn't save your business", problem.message, undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Your business" />
      {loading ? (
        <Text style={styles.sub}>Loading…</Text>
      ) : business ? (
        <>
          <Card>
            <View style={styles.row}>
              <View style={styles.icon}>
                <Briefcase size={20} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{business.name}</Text>
                <Text style={styles.sub}>Saved</Text>
              </View>
            </View>
          </Card>
          <Button label="What you offer and want" onPress={() => navigation.navigate('OfferWant', { ventureId: business.venture_id })} />
          <Button label="Invite people" variant="secondary" onPress={() => navigation.navigate('Invite', { ventureId: business.venture_id })} />
          <Button
            label="Your network"
            variant="secondary"
            onPress={() => navigation.navigate('Sci', { ventureId: business.venture_id, name: business.name })}
          />
        </>
      ) : (
        <>
          <Text style={styles.lead}>Add the business or project you want to grow your network around.</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Acme Circular Packaging"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={BUSINESS_NAME_MAX}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="Business or project name"
          />
          <Text style={styles.note}>You can add more details later.</Text>
          <Button label="Save" loading={saving} disabled={!clean} onPress={save} style={styles.save} />
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
    },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: -4 },
    save: { marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: semibold, color: colors.text },
    sub: { fontSize: 12, color: colors.muted },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
  });
