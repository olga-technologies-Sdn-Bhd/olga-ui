import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import { EventsScreen } from '../screens/events/EventsScreen';
import { WhosGoingScreen } from '../screens/events/WhosGoingScreen';
import { EventsStackParamList } from './types';
import { STACK_OPTIONS } from './stackOptions';

const Stack = createNativeStackNavigator<EventsStackParamList>();

export function EventsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="WhosGoing" component={WhosGoingScreen} />
    </Stack.Navigator>
  );
}
