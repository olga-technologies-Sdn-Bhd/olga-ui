import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AnywhereMatchesScreen } from '../screens/golive/AnywhereMatchesScreen';
import { CommitScreen } from '../screens/golive/CommitScreen';
import { EmptyRoomScreen } from '../screens/golive/EmptyRoomScreen';
import { FiltersScreen } from '../screens/golive/FiltersScreen';
import { GoLiveScreen } from '../screens/golive/GoLiveScreen';
import { LiveMatchesScreen } from '../screens/golive/LiveMatchesScreen';
import { NearbyCommitScreen } from '../screens/golive/NearbyCommitScreen';
import { NearbyPeopleScreen } from '../screens/golive/NearbyPeopleScreen';
import { NearbyRequestScreen } from '../screens/golive/NearbyRequestScreen';
import { GoLiveStackParamList } from './types';
import { STACK_OPTIONS } from './stackOptions';

const Stack = createNativeStackNavigator<GoLiveStackParamList>();

export function GoLiveStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="GoLive" component={GoLiveScreen} />
      <Stack.Screen name="Filters" component={FiltersScreen} />
      <Stack.Screen name="LiveMatches" component={LiveMatchesScreen} />
      <Stack.Screen name="EmptyRoom" component={EmptyRoomScreen} />
      <Stack.Screen name="Commit" component={CommitScreen} />
      <Stack.Screen name="NearbyPeople" component={NearbyPeopleScreen} />
      <Stack.Screen name="NearbyCommit" component={NearbyCommitScreen} />
      <Stack.Screen name="NearbyRequest" component={NearbyRequestScreen} />
      <Stack.Screen name="AnywhereMatches" component={AnywhereMatchesScreen} />
    </Stack.Navigator>
  );
}
