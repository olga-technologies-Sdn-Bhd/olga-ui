import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { BlockedMembersScreen } from '../screens/profile/BlockedMembersScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { HowYouAppearScreen } from '../screens/profile/HowYouAppearScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileSetupScreen } from '../screens/profile/ProfileSetupScreen';
import { HomeStackParamList } from './types';
import { STACK_OPTIONS } from './stackOptions';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="HowYouAppear" component={HowYouAppearScreen} />
      <Stack.Screen name="BlockedMembers" component={BlockedMembersScreen} />
    </Stack.Navigator>
  );
}
