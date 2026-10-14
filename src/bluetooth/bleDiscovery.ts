import { Permission, PermissionsAndroid, Platform } from 'react-native';
import { APP_ENV } from '../config/env';
import NativeOlgaBle, { NativeBleMessage, NativeBleSighting, NativeBleStatus } from './specs/NativeOlgaBle';
import type { BluetoothState } from './types';

// The Ol-ga BLE service. The same on Android and iOS; it identifies the app,
// never a member. Changing it splits old and new app versions apart.
export const OLGA_BLE_SERVICE_UUID = '3eecebab-22bf-4234-bf1d-035cbe8539f4';

// Nearby is still being built: it runs in dev and local builds only, so
// production users get no Bluetooth prompt for a feature they can't use yet.
export const BLE_DISCOVERY_ENABLED = APP_ENV !== 'prod';

// A device not heard from for this long has gone (walked away, Bluetooth off,
// app closed). Phones advertise several times a second, so this is generous.
export const STALE_AFTER_MS = 15000;

const BLUETOOTH_STATES: BluetoothState[] = ['on', 'off', 'unauthorized', 'unsupported', 'unknown'];

export function toBluetoothState(value: string): BluetoothState {
  return (BLUETOOTH_STATES as string[]).includes(value) ? (value as BluetoothState) : 'unknown';
}

// False when the native module isn't in this build (for example a binary
// built before it was added).
export function isBleAvailable() {
  return NativeOlgaBle != null;
}

// Android: BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE and BLUETOOTH_CONNECT (to swap
// cards and deliver Commits) from Android 12 (API 31); before that, scanning
// needs location permission (the BLUETOOTH and BLUETOOTH_ADMIN install-time
// permissions cover the rest). iOS asks by itself the first time the native
// module touches Bluetooth.
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const needed: Permission[] =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const missing: Permission[] = [];
  for (const permission of needed) {
    if (!(await PermissionsAndroid.check(permission))) missing.push(permission);
  }
  if (missing.length === 0) return true;
  const result = await PermissionsAndroid.requestMultiple(missing);
  return missing.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

// Asked once, when the member first makes themselves available nearby.
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) return true;
    return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
  }
  return NativeOlgaBle ? NativeOlgaBle.requestNotificationPermission() : false;
}

export function startBle() {
  NativeOlgaBle?.start(OLGA_BLE_SERVICE_UUID);
}

export function stopBle() {
  NativeOlgaBle?.stop();
}

export function getBleStatus(): Promise<NativeBleStatus | null> {
  return NativeOlgaBle ? NativeOlgaBle.getStatus() : Promise.resolve(null);
}

export function setBleCard(card: string) {
  NativeOlgaBle?.setCard(card);
}

export function readBleCard(token: string): Promise<string> {
  return NativeOlgaBle ? NativeOlgaBle.readCard(token) : Promise.reject(new Error('Bluetooth unavailable'));
}

export function sendBleMessage(token: string, payload: string): Promise<void> {
  return NativeOlgaBle ? NativeOlgaBle.sendMessage(token, payload) : Promise.reject(new Error('Bluetooth unavailable'));
}

export function showLocalNotification(id: string, title: string, body: string, initials: string, color: string) {
  NativeOlgaBle?.showNotification(id, title, body, initials, color);
}

// The notification Ol-ga was opened from (cold start), once; '' if none.
export function consumeOpenedNotification(): Promise<string> {
  return NativeOlgaBle ? NativeOlgaBle.consumeOpenedNotification() : Promise.resolve('');
}

// A tap on one of our notifications while Ol-ga is running. Returns an unsubscribe function.
export function subscribeNotificationOpened(onOpened: (id: string) => void) {
  if (!NativeOlgaBle) return () => {};
  const subscription = NativeOlgaBle.onNotificationOpened((opened) => onOpened(opened.id));
  return () => subscription.remove();
}

// Returns an unsubscribe function.
export function subscribeBle(
  onStatus: (status: NativeBleStatus) => void,
  onSighting: (sighting: NativeBleSighting) => void,
  onMessage: (message: NativeBleMessage) => void
) {
  if (!NativeOlgaBle) return () => {};
  const subscriptions = [NativeOlgaBle.onStatus(onStatus), NativeOlgaBle.onSighting(onSighting), NativeOlgaBle.onMessage(onMessage)];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}
