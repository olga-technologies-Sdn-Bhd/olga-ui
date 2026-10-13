This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Environments (read this first)

The app talks to Olga.Core, olga-nlp-api and Microsoft Entra External ID (sign-in). Which deployment a build uses is set by the `OLGA_ENV` variable when the app is bundled. You never edit code to switch.

| `OLGA_ENV` | Backend and sign-in | Who uses it |
| --- | --- | --- |
| `dev` (default) | Shared Azure dev APIs and the dev Entra tenant. Redirect `olga-dev://auth` | **Everyone, for all development** |
| `prod` | Production APIs and the "OLGA Connect Production" Entra tenant. Redirect `olga://auth` | iOS Release builds (always), Android release via `OLGA_ENV=prod`, and production checks |
| `local` | Olga.Core and olga-nlp-api on your own machine, dev Entra tenant | Backend developers only |

How it works:

- Each environment's values live in one file: `src/config/environments/dev.ts`, `prod.ts`, `local.ts`. They hold public identifiers only. Never add a secret, key or token.
- Metro swaps `src/config/environments/selected.ts` for the chosen file (`metro.config.js`), so a bundle holds one environment's values. A production bundle has no dev URL or dev sign-in value in it.
- The app fails on start if a URL or sign-in value is missing. Nothing falls back to another environment.
- Android reads the same variable for the sign-in redirect scheme (`android/app/build.gradle`). **A release build fails unless `OLGA_ENV` is set.**
- Saved sessions are kept per environment, so a dev sign-in is never used by a production build.
- **Profile → Environment** shows which one the running app uses.

## Frontend developers: always run on `dev`

1. `npm install`
2. Start Metro: `npm start`
3. Connect an Android phone by USB (or start an emulator), then run `npm run android`.
   On a physical phone, if the app can't load the bundle, run `adb reverse tcp:8081 tcp:8081`.
4. Sign in. Microsoft handles the email code, Google and Apple (Entra External ID, dev tenant).
5. Open **Profile** (tap your avatar). The **Environment** row should say `dev`.

Good to know:

- The dev containers sleep when idle. The first call after a while can take up to a minute, so the first load may be slow. Pull to refresh if it times out.
- The app has no mock or sample data: every screen uses the real API for the selected environment.

## Production

Production data is real. Use a production build only for release and for agreed production checks.

**Android**

| Goal | Command |
| --- | --- |
| Debug build against production (needs Metro) | `npm run start:prod`, then in a second terminal `npm run android:prod` |
| Release bundle (AAB) | `npm run build:android:prod` |

Both commands set `OLGA_ENV=prod` for you. To run Gradle yourself, set the variable first (PowerShell: `$env:OLGA_ENV='prod'`; bash: `export OLGA_ENV=prod`).

Metro and the native build must use the same environment. If they differ, sign-in can't return to the app. The dev and production builds share one app ID (`com.olga.connect`), so a phone holds one of them at a time.

The release build is still signed with the debug keystore. A store upload needs the real upload keystore, which is not in this repo.

**iOS**

- **Release builds (TestFlight, App Store) are always production.** The Release `OLGA_AUTH_SCHEME` is `olga` in the Xcode project, and `ios/.xcode.env` sets `OLGA_ENV=prod` for the Release bundle. There is nothing to set by hand.
- **Debug builds stay on dev**, with the `olga-dev` scheme, unless you start Metro on production. For a production debug build on a phone, run `npm run start:prod`, set the Debug `OLGA_AUTH_SCHEME` to `olga` in Xcode, and revert both afterwards.
- Signing: Release uses manual signing with the Apple Distribution certificate and the `Olga-Prod` App Store profile (team `Y3X4KPFWM9`). Import the shared `.p12` and install the profile first.

**Sign-in in production**

- One Microsoft-hosted flow (`olga_signup_signin_prd`) handles the email code, Google and Apple. The app opens it in the system browser with Authorization Code + PKCE.
- The email code is entered on the Microsoft page. The in-app code screen is off in production (`inAppEmailOtp: false`).
- Google and Apple go through Entra with `domain_hint`. The value for Google is `Google` with a capital G: lower-case `google` fails with `AADSTS90023` on both tenants.
- Tokens are stored only in the device Keychain / Keystore and are removed on sign-out.

**Check before a release**

```
GET <core>/health  -> 200      GET <core>/ready  -> 200
GET <nlp>/health   -> 200      GET <nlp>/ready   -> 200
```

The production URLs are in `src/config/environments/prod.ts`.

## Backend developers: `local`

Start Metro with `OLGA_ENV=local` and run the APIs locally: Olga.Core with `dotnet run --project src/Olga.Core.Api` (port 5000) and olga-nlp-api (port 5080). On a physical phone also run `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:5080 tcp:5080`; on an emulator set `LOCAL_HOST = '10.0.2.2'` in `src/config/environments/local.ts`. Local sign-in still uses the dev Entra tenant. `local` can't be used in a release build.

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
