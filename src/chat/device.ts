import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { newIdempotencyKey } from '../api/client';
import { coreApi } from '../api/core';
import { APP_VERSION, keychainService } from '../config/env';

// This installation's ID for /v1/me/devices: made once, kept on the phone
// (not backed up, so a new phone is a new device).
const SERVICE = keychainService('olga.device');

async function deviceId(): Promise<string> {
  const saved = await Keychain.getGenericPassword({ service: SERVICE });
  if (saved) return saved.password;
  const id = `dev_${newIdempotencyKey().replace(/-/g, '')}`;
  await Keychain.setGenericPassword('device', id, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return id;
}

// On sign-in. No push token yet: push isn't set up.
export async function registerDevice() {
  await coreApi.registerDevice(await deviceId(), {
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    app_version: APP_VERSION,
  });
}

// On sign-out, while the member is still known (X-Member-Id).
export async function removeDevice() {
  const saved = await Keychain.getGenericPassword({ service: SERVICE });
  // Short: signing out never waits long on the network.
  if (saved) await coreApi.removeDevice(saved.password, { timeoutMs: 5000 });
}
