import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommitsScreen } from '../screens/commits/CommitsScreen';
import { MeetupScreen } from '../screens/commits/MeetupScreen';
import { CommitsStackParamList } from './types';

const Stack = createNativeStackNavigator<CommitsStackParamList>();

export function CommitsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Commits" component={CommitsScreen} />
      <Stack.Screen name="Meetup" component={MeetupScreen} />
    </Stack.Navigator>
  );
}
