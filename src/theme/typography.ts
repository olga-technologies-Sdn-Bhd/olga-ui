import { Platform } from 'react-native';

// One typeface throughout, the platform's own (Roboto on Android, San
// Francisco on iOS), with hierarchy carried by weight and size alone. It is
// also set as the app-wide Text/TextInput default (see App.tsx). The keys
// keep their old role names so screens need no changes.
const system = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export const fonts = {
  headingBold: system,
  headingExtraBold: system,
  bodyRegular: system,
  bodyBold: system,
  monoRegular: system,
  monoMedium: system,
  monoBold: system,
};
