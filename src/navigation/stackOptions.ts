import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// Screens inside a tab slide in from the right like iOS on both platforms
// (native, smooth), and swipe back from the edge on iOS.
export const STACK_OPTIONS: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'ios_from_right',
  gestureEnabled: true,
};
