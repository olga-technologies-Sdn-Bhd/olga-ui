import { Platform } from 'react-native';

// One typeface throughout: Inter (chosen by Sree; SIL Open Font License,
// src/assets/fonts/Inter-LICENSE.txt). Regular for body text, SemiBold for
// headings, labels and actions; size carries the rest of the hierarchy.
// It is also the app-wide Text/TextInput default (see App.tsx). The keys keep
// their old role names so screens need no changes.
const inter = 'Inter';

export const fonts = {
  headingBold: inter,
  headingExtraBold: inter,
  bodyRegular: inter,
  bodyBold: inter,
  monoRegular: inter,
  monoMedium: inter,
  monoBold: inter,
};

// The one heavier weight. React Native on Android only tells custom fonts
// "normal" or "bold", and res/font/inter.xml maps bold to Inter SemiBold; iOS
// picks SemiBold from 600 directly. Use this instead of a number.
export const semibold = Platform.OS === 'ios' ? ('600' as const) : ('700' as const);
