# Bluetooth for Nearby

**Nearby** is Go Live without an event. While a member is *available*, Ol-ga phones close by find each other over Bluetooth Low Energy, swap cards (role and what they're looking for, never the name) and send each other Commits. It all works with no internet. Commits made this way are saved on the phone and sent to Ol-ga once there's a connection.

It runs in dev and local builds only for now (`BLE_DISCOVERY_ENABLED` in `bleDiscovery.ts`). The dev panel (`BleDebugPanel`) never shows in a production build.

## Protocol

One service UUID, the same on Android and iOS:

```
service  3eecebab-22bf-4234-bf1d-035cbe8539f4
CARD     3eecebab-22bf-4234-bf1d-035cbe8539f5   read
INBOX    3eecebab-22bf-4234-bf1d-035cbe8539f6   write (with response)
```

### Finding each other

Each time discovery starts, the phone picks a new **session token**: 8 random bytes from the platform's secure random source, written as 16 lowercase hex characters. It is how phones refer to each other over the air. It isn't a member ID, a device ID or a Bluetooth address.

| | Advertising packet | Scan response |
| --- | --- | --- |
| Android | 128-bit service UUID | Service data for the UUID: the 8 token bytes |
| iPhone | 128-bit service UUID | Local name: the token as 16 hex characters |

iOS only lets apps advertise service UUIDs and a local name; Android can't set a local name without renaming the phone. Scanners on both platforms accept either.

### Cards

A phone connects to each new token it sees and reads **CARD**. This is the JSON `NearbyCard` in `src/nearby/types.ts`, at most 512 bytes:

| Key | Content |
| --- | --- |
| `m` | Member ID (opaque, needed to save Commits to Ol-ga later) |
| `h` | Headline |
| `r` | Role category |
| `w` | What they're looking for |
| `o` | What they offer |
| `i` | Initials from the headline |

The name is never in the card.

### Messages

Phones write messages to each other's **INBOX** (`NearbyMessage` in `src/nearby/types.ts`):

- `commit`: carries the sender's card and the time they'd like to meet.
- `accept`: carries the accepter's name.
- `name`: the sender's name, sent back after an accept.
- A decline is never sent. As with Commits at events, the sender is never told.

Each write is a frame:

```
[message id, frame index, frame count, bytes...]
```

so any message fits any MTU.

## Scores

- **Offline:** the phone estimates a score from the two texts (`src/nearby/score.ts`), shown as `~74%`.
- **Online:** when either phone is online, NLP `POST /v1/matches/score-pair` gives Ol-ga's score (`reciprocal`), which replaces the estimate.

## Saving to Ol-ga (no backend change)

`NearbyContext` syncs every 30 s and when the app comes to the foreground. Requests are kept on the phone in the keychain, per member (`src/nearby/store.ts`), until Ol-ga has them.

1. **A Commit you sent** becomes a plain connection request: `POST /v1/connection-requests` with no `context_id`, and the Commit's ID as `Idempotency-Key`.
   - `CONNECTION_EXISTS` means you were already connected.
2. **A Commit you answered:** the app finds Ol-ga's copy in `GET /v1/sync/changes` (`CONNECTION_REQUEST` from that sender), then answers it with `PATCH /v1/connection-requests/{id}`. This waits until the sender has been online.
3. **Accepted while apart:** `GET /v1/connections` shows the new connection, and the app shows the accept notification.

## Lifecycle

- **Discovery runs** while the member is available nearby and the app is in the foreground.
- **When the app goes to the background,** discovery stops and the phone forgets what it saw.
- **Bluetooth turned off and on** is followed natively.
- **A phone not heard for 15 s** drops off the list.

## Files

| File | What |
| --- | --- |
| `specs/NativeOlgaBle.ts` | Codegen spec (`codegenConfig` in `package.json`) |
| `bleDiscovery.ts` | Service UUID, permissions, native calls |
| `useBluetoothDiscovery.ts` | Lifecycle, device list, stale clean-up |
| `src/nearby/` | Card format, scoring, storage |
| `src/context/NearbyContext.tsx` | Available, cards, Commits, delivery, sync |
| `src/screens/golive/Nearby*.tsx` | Nearby on Go Live, people, Commit, request |
| `src/components/NearbyBanner.tsx` | In-app banner for an incoming Commit |
| `android/app/src/main/java/com/olgamobile/ble/` | Android: `OlgaBleModule`, `OlgaGatt`, `OlgaNotifier` |
| `ios/OlgaMobile/RCTOlgaBle.mm` | iOS: CoreBluetooth and UserNotifications |
