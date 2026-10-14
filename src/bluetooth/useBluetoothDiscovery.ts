import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  BLE_DISCOVERY_ENABLED,
  getBleStatus,
  isBleAvailable,
  requestBlePermissions,
  STALE_AFTER_MS,
  startBle,
  stopBle,
  subscribeBle,
  toBluetoothState,
} from './bleDiscovery';
import type { NativeBleStatus } from './specs/NativeOlgaBle';
import type { BleDiscoveryState, DiscoveredDevice } from './types';

// How often sightings reach React state. Native code already sends at most
// one sighting per device per second; batching keeps re-renders to one a second.
const FLUSH_MS = 1000;

const IDLE: BleDiscoveryState = {
  active: false,
  bluetooth: 'unknown',
  advertising: false,
  scanning: false,
  error: null,
  ownId: null,
  devices: [],
};

function sameDevices(a: DiscoveredDevice[], b: DiscoveredDevice[]) {
  return a.length === b.length && a.every((d, i) => d.discoveryId === b[i].discoveryId && d.rssi === b[i].rssi && d.lastSeenAt === b[i].lastSeenAt);
}

// Advertises and scans for nearby Ol-ga phones while `enabled` (the member is
// available nearby) and the app is in the foreground. Works without internet: nothing
// here calls the backend. Stops, and forgets what it saw, otherwise.
// onMessage receives what other phones write to this one (see src/nearby).
export function useBluetoothDiscovery(enabled: boolean, onMessage?: (payload: string) => void): BleDiscoveryState {
  // Only 'background' stops discovery. iOS reports 'inactive' while a system
  // prompt (the Bluetooth permission itself) or Control Center is showing.
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [state, setState] = useState<BleDiscoveryState>(IDLE);
  const seen = useRef(new Map<string, DiscoveredDevice>());
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setForeground(next !== 'background'));
    return () => subscription.remove();
  }, []);

  const run = enabled && foreground && BLE_DISCOVERY_ENABLED && isBleAvailable();

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    const devices = seen.current;
    const applyStatus = (status: NativeBleStatus) =>
      setState((current) => ({
        ...current,
        bluetooth: toBluetoothState(status.bluetooth),
        advertising: status.advertising,
        scanning: status.scanning,
        error: status.error || null,
        ownId: status.token || null,
      }));

    setState({ ...IDLE, active: true });
    const unsubscribe = subscribeBle(applyStatus, (sighting) => {
      const known = devices.get(sighting.token);
      devices.set(sighting.token, {
        discoveryId: sighting.token,
        deviceName: null,
        rssi: sighting.rssi,
        discoveredAt: known?.discoveredAt ?? sighting.seenAt,
        lastSeenAt: sighting.seenAt,
        source: 'BLE',
      });
    }, (message) => messageHandler.current?.(message.payload));
    const flush = setInterval(() => {
      const now = Date.now();
      for (const [id, device] of devices) {
        if (now - device.lastSeenAt > STALE_AFTER_MS) devices.delete(id);
      }
      const next = [...devices.values()].sort((a, b) => b.rssi - a.rssi);
      setState((current) => (sameDevices(current.devices, next) ? current : { ...current, devices: next }));
    }, FLUSH_MS);

    (async () => {
      let granted = false;
      try {
        granted = await requestBlePermissions();
      } catch (e) {
        console.warn('Bluetooth permission request failed', e);
      }
      if (cancelled) return;
      if (!granted) {
        setState((current) => ({ ...current, bluetooth: 'unauthorized' }));
        return;
      }
      startBle();
      const status = await getBleStatus();
      if (!cancelled && status) applyStatus(status);
    })();

    return () => {
      cancelled = true;
      stopBle();
      unsubscribe();
      clearInterval(flush);
      devices.clear();
      setState(IDLE);
    };
  }, [run]);

  return state;
}
