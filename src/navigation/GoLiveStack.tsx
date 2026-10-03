import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommitScreen } from '../screens/golive/CommitScreen';
import { EmptyRoomScreen } from '../screens/golive/EmptyRoomScreen';
import { FiltersScreen } from '../screens/golive/FiltersScreen';
import { GoLiveColourScreen } from '../screens/golive/GoLiveColourScreen';
import { GoLiveScreen } from '../screens/golive/GoLiveScreen';
import { LiveMatchesScreen } from '../screens/golive/LiveMatchesScreen';
import { GoLiveStackParamList } from './types';

const Stack = createNativeStackNavigator<GoLiveStackParamList>();

export function GoLiveStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GoLive" component={GoLiveScreen} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
      <Stack.Screen name="LiveMatches" component={LiveMatchesScreen} />
      <Stack.Screen name="EmptyRoom" component={EmptyRoomScreen} />
      <Stack.Screen name="GoLiveColour" component={GoLiveColourScreen} />
      <Stack.Screen name="Commit" component={CommitScreen} />
    </Stack.Navigator>
  );
}
