import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { OlgaAgentScreen } from '../screens/home/OlgaAgentScreen';
import { BlockedMembersScreen } from '../screens/profile/BlockedMembersScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { HowYouAppearScreen } from '../screens/profile/HowYouAppearScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileSetupScreen } from '../screens/profile/ProfileSetupScreen';
import { AcceptInvitationScreen } from '../screens/sci/AcceptInvitationScreen';
import { BusinessScreen } from '../screens/sci/BusinessScreen';
import { InviteScreen } from '../screens/sci/InviteScreen';
import { OfferWantScreen } from '../screens/sci/OfferWantScreen';
import { SciScreen } from '../screens/sci/SciScreen';
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
      <Stack.Screen name="Business" component={BusinessScreen} />
      <Stack.Screen name="OfferWant" component={OfferWantScreen} />
      <Stack.Screen name="Sci" component={SciScreen} />
      <Stack.Screen name="Invite" component={InviteScreen} />
      <Stack.Screen name="AcceptInvitation" component={AcceptInvitationScreen} />
      {/* Olga rises from the bottom, like a sheet you close with X. */}
      <Stack.Screen name="OlgaAgent" component={OlgaAgentScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
