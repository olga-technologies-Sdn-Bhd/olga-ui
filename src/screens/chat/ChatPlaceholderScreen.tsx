import { Text } from 'react-native';
import { Screen } from '../../components/Screen';

// Tapping the Chat tab is intercepted (see MainTabs) to show a "coming
// soon" modal instead of navigating here — this only renders in the
// unlikely event that interception is bypassed (e.g. deep link).
export function ChatPlaceholderScreen() {
  return (
    <Screen>
      <Text>Chat is coming soon.</Text>
    </Screen>
  );
}
