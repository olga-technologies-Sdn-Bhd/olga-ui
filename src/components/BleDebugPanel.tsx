import { RotateCcw } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_ENV } from '../config/env';
import { useOfflineChat } from '../context/OfflineChatContext';
import { useNearby } from '../context/NearbyContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';
import { showDialog } from './DialogHost';

// Development only: what Bluetooth discovery is doing, for testing two or
// more phones side by side. Never in a production build, whether or not
// Nearby itself is switched on there.
export function BleDebugPanel() {
  if (APP_ENV === 'prod') return null;
  return <Panel />;
}

function Panel() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { ble, people, resetForTesting } = useNearby();
  const chat = useOfflineChat();
  const confirmReset = () =>
    showDialog(
      'Reset Nearby on this phone?',
      "Forgets this member's Nearby consent, Commits, passes and Bluetooth chats on this phone, and goes invisible. Ol-ga's own data isn't touched.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetForTesting();
            chat.resetForTesting();
          },
        },
      ],
      { icon: RotateCcw, tone: 'danger' }
    );
  // Ages tick once a second while the list is showing.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!ble.active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ble.active]);

  const row = (label: string, value: string, on: boolean) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, on ? styles.on : styles.off]}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.title}>BLUETOOTH · DEV</Text>
        <Pressable onPress={confirmReset} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.reset}>Reset Nearby</Text>
        </Pressable>
      </View>
      {row('Bluetooth status', ble.bluetooth.toUpperCase(), ble.bluetooth === 'on')}
      {row('BLE advertising', ble.advertising ? 'ACTIVE' : 'INACTIVE', ble.advertising)}
      {row('BLE scanning', ble.scanning ? 'ACTIVE' : 'INACTIVE', ble.scanning)}
      {row('Ol-ga phones in range', String(ble.devices.length), ble.devices.length > 0)}
      {row('Cards read', String(people.length), people.length > 0)}
      {ble.ownId && <Text style={styles.note}>This phone: {ble.ownId}</Text>}
      {ble.error && <Text style={styles.error}>{ble.error}</Text>}
      {ble.devices.map((device) => (
        <View key={device.discoveryId} style={styles.device}>
          <Text style={styles.mono}>{device.discoveryId}</Text>
          <Text style={styles.mono}>
            {device.rssi} dBm · {Math.max(0, Math.round((now - device.lastSeenAt) / 1000))}s ago
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.line,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    title: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: semibold, letterSpacing: 1.2, color: colors.muted, marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 12, color: colors.text },
    value: { fontFamily: fonts.monoBold, fontSize: 12, fontWeight: semibold },
    on: { color: colors.positive },
    off: { color: colors.muted },
    reset: { fontSize: 11, fontWeight: semibold, color: colors.danger },
    note: { fontSize: 11, color: colors.muted, marginTop: 2 },
    error: { fontSize: 11, color: colors.danger },
    device: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 4 },
    mono: { fontFamily: fonts.monoRegular, fontSize: 11, color: colors.text },
  });
