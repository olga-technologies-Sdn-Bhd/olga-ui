// Bluetooth proximity discovery, phase 1: nearby phones running Ol-ga find
// each other over BLE. Nothing here says who the other phone belongs to.

export type BluetoothState = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown';

// Another phone advertising the Ol-ga service. discoveryId is that phone's
// random session token: it changes every time discovery starts, and it is
// not a member ID, a device ID or a Bluetooth address.
export type DiscoveredDevice = {
  discoveryId: string;
  deviceName: null;
  rssi: number;
  discoveredAt: number;
  lastSeenAt: number;
  source: 'BLE';
};

export type BleDiscoveryState = {
  // Discovery is wanted: live, app in the foreground, and allowed in this build.
  active: boolean;
  bluetooth: BluetoothState;
  advertising: boolean;
  scanning: boolean;
  error: string | null;
  // This phone's own session token, for matching up two phones when testing.
  ownId: string | null;
  // Seen within the last STALE_AFTER_MS, nearest first.
  devices: DiscoveredDevice[];
};
