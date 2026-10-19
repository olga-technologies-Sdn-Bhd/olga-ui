import { trigger } from 'react-native-haptic-feedback';

// The app's haptic vocabulary, in one place (GOL-01). Uses the phone's own
// haptic engine and follows the system's vibration/haptics setting.
//   tap:     a finger lands on something that responds (press-in)
//   tick:    a step passes (a seekbar stop, the hold ring filling)
//   success: something worked (live, a Commit sent or accepted)
const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

export const haptics = {
  tap: () => trigger('impactLight', OPTIONS),
  tick: () => trigger('selection', OPTIONS),
  success: () => trigger('notificationSuccess', OPTIONS),
};
