// Codegen spec for the app's own BLE module (android/.../ble/, ios/OlgaMobile/
// RCTOlgaBle.mm). Phones advertise and scan for one Ol-ga service UUID,
// foreground only, and connect briefly to read each other's card and to
// deliver Nearby messages. See src/bluetooth/README.md.
import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeBleStatus = {
  // on | off | unauthorized | unsupported | unknown
  bluetooth: string;
  advertising: boolean;
  scanning: boolean;
  // Last advertising or scanning failure; '' when there is none.
  error: string;
  // This phone's session token (16 hex characters); '' when stopped.
  token: string;
};

export type NativeBleSighting = {
  // The other phone's session token (16 lowercase hex characters).
  token: string;
  rssi: number;
  seenAt: number;
};

export type NativeBleMessage = {
  // UTF-8 text another phone wrote to this one (a JSON message, see src/nearby).
  payload: string;
};

export type NativeOpenedNotification = {
  // The id given to showNotification.
  id: string;
};

export interface Spec extends TurboModule {
  readonly onStatus: CodegenTypes.EventEmitter<NativeBleStatus>;
  readonly onSighting: CodegenTypes.EventEmitter<NativeBleSighting>;
  readonly onMessage: CodegenTypes.EventEmitter<NativeBleMessage>;
  // The member tapped one of our notifications while the app was running.
  readonly onNotificationOpened: CodegenTypes.EventEmitter<NativeOpenedNotification>;
  // Picks a new random session token (8 bytes from the platform's secure
  // random source), advertises serviceUuid with it, scans for serviceUuid and
  // serves this phone's card and inbox. Keeps going across Bluetooth off and
  // on until stop().
  start(serviceUuid: string): void;
  // Stops advertising, scanning and serving, and forgets the token.
  stop(): void;
  getStatus(): Promise<NativeBleStatus>;
  // The card other phones read from this one (UTF-8 JSON, at most 512 bytes).
  setCard(card: string): void;
  // Connects to the phone seen with this token and reads its card.
  readCard(token: string): Promise<string>;
  // Connects to the phone seen with this token and writes a message to its inbox.
  sendMessage(token: string, payload: string): Promise<void>;
  // A local notification (no internet needed). initials and color draw the avatar.
  showNotification(id: string, title: string, body: string, initials: string, color: string): void;
  // iOS asks for notification permission; Android answers from its runtime permission.
  requestNotificationPermission(): Promise<boolean>;
  // The notification the app was opened from (cold start), once; '' if none.
  consumeOpenedNotification(): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('OlgaBle');
