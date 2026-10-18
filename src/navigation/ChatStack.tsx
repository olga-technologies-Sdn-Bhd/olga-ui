import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { ConversationScreen } from '../screens/chat/ConversationScreen';
import { MeetupScreen } from '../screens/commits/MeetupScreen';
import { STACK_OPTIONS } from './stackOptions';
import { ChatStackParamList } from './types';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="ChatHome" component={ChatScreen} />
      <Stack.Screen name="Meetup" component={MeetupScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  );
}
