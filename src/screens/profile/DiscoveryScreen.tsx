import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CircleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { HomeStackParamList } from '../../navigation/types';
import { discoveryProblem } from '../../sci/discovery';
import { safeLogLine } from '../../sci/problems';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Discovery'>;

type Setting = { find_by_phone: boolean; find_by_email: boolean; etag: string };

// Who can find the member by their phone number or email. Both are off until
// the member turns them on.
export function DiscoveryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const p = await withRetries((timeoutMs) => coreApi.getDiscoveryPreference({ timeoutMs }));
      setSetting({ find_by_phone: p.find_by_phone, find_by_email: p.find_by_email, etag: p.etag });
    } catch (e) {
      const line = safeLogLine('Load discovery preference', e);
      if (line) console.warn(line);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (patch: Partial<Pick<Setting, 'find_by_phone' | 'find_by_email'>>) => {
    if (!setting || saving) return;
    const next = { find_by_phone: setting.find_by_phone, find_by_email: setting.find_by_email, ...patch };
    setSaving(true);
    try {
      const saved = await coreApi.updateDiscoveryPreference(next, setting.etag);
      setSetting({ find_by_phone: saved.find_by_phone, find_by_email: saved.find_by_email, etag: saved.etag });
    } catch (e) {
      const problem = discoveryProblem(e);
      const line = safeLogLine('Save discovery preference', e);
      if (line) console.warn(line);
      showDialog("Couldn't save that", problem.message, undefined, { icon: CircleAlert, tone: 'danger' });
      if (problem.stale) await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Who can find me" />
      <Text style={styles.lead}>
        When someone has your phone number or email saved, Ol-ga can match you to them. Both are off until you turn them on.
      </Text>
      {failed ? (
        <Card>
          <Text style={styles.body}>Couldn't load this right now.</Text>
          <Button label="Try again" variant="secondary" small onPress={load} style={styles.action} />
        </Card>
      ) : !setting ? (
        <Text style={styles.sub}>Loading…</Text>
      ) : (
        <Card>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>By my phone number</Text>
              <Text style={styles.sub}>People who have your number saved</Text>
            </View>
            <ToggleSwitch on={setting.find_by_phone} onToggle={() => change({ find_by_phone: !setting.find_by_phone })} label="Find me by phone number" />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>By my email</Text>
              <Text style={styles.sub}>People who have your email saved</Text>
            </View>
            <ToggleSwitch on={setting.find_by_email} onToggle={() => change({ find_by_email: !setting.find_by_email })} label="Find me by email" />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    lead: { fontSize: 14, lineHeight: 20, color: colors.text },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    sub: { fontSize: 12, color: colors.muted },
    label: { fontSize: 15, fontWeight: semibold, color: colors.text },
    action: { marginTop: 10, alignSelf: 'flex-start' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    rowText: { flex: 1, gap: 2 },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: 6 },
  });
