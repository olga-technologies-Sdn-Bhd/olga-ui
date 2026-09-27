This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Environments (read this first)

The app talks to Olga.Core and olga-nlp-api. Which deployment it uses is set by one value, `APP_ENV`, in [`src/config/env.ts`](src/config/env.ts):

| `APP_ENV` | Backend | Who uses it |
| --- | --- | --- |
| `dev` (default) | Shared Azure dev APIs (`ca-olga-core-api-dev…`, `ca-olga-nlp-api-dev…`) | **Everyone, including all frontend developers** |
| `local` | Olga.Core and olga-nlp-api running on your own machine, with a local database | Backend developers only |
| `prod` | Production | Not deployed yet; the app fails on start until its URLs are filled in |

## Frontend developers: always run on `dev`

**Don't switch `APP_ENV` to `local`.** It needs Olga.Core, olga-nlp-api and a local database running on your machine, which frontend developers don't have set up. The app will just show "Couldn't reach the server".

Steps:

1. Check `src/config/env.ts` says `export const APP_ENV: AppEnv = 'dev';` (it's committed that way).
2. `npm install`
3. Start Metro: `npm start`
4. Connect an Android phone by USB (or start an emulator), then run `npm run android`.
   On a physical phone, if the app can't load the bundle, run `adb reverse tcp:8081 tcp:8081`.
5. Sign in with your email. Microsoft sends a one-time code (Entra External ID, dev tenant).
6. Open **Profile** (tap your avatar on Home). The **Environment** row should say `dev`.

Good to know:

- The dev containers sleep when idle. The first call after a while can take up to a minute, so the first load may be slow. Pull to refresh if it times out.
- Each area has a mock switch in `env.ts` (`USE_MOCK_EVENTS`, `USE_MOCK_LIVE`, `USE_MOCK_MATCHING`). All are `false`, so the app uses the real dev APIs. Who's going always uses mock data (no backend endpoint yet).
- Never commit `APP_ENV` as anything other than `'dev'`, and never commit a mock switch set to `true`.

## Backend developers: `local`

Set `APP_ENV = 'local'` (don't commit it) and run the APIs locally: Olga.Core with `dotnet run --project src/Olga.Core.Api` (port 5000) and olga-nlp-api (port 5080). On a physical phone also run `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:5080 tcp:5080`; on an emulator set `LOCAL_HOST = '10.0.2.2'` in `env.ts`. Local sign-in still uses the dev Entra tenant.

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
