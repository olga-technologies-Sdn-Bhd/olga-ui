import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, MessageCircle, Radio, Ticket } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NearbyBanner } from '../components/NearbyBanner';
import { useLive } from '../context/LiveContext';
import { useNearby } from '../context/NearbyContext';
import { CommitsStack } from './CommitsStack';
import { HomeStack } from './HomeStack';
import { useTheme } from '../theme/ThemeContext';
import { EventsStack } from './EventsStack';
import { GlassTab, GlassTabBar, TAB_BAR_HEIGHT } from './GlassTabBar';
import { GoLiveStack } from './GoLiveStack';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { colors, scheme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { isLive } = useLive();
  const { available } = useNearby();

  // While live (or available nearby) Go Live stays bold in the Go Live
  // button's dark blue, on any tab.
  const tabs: Record<keyof MainTabParamList, GlassTab> = {
    HomeTab: { icon: House, label: 'Home' },
    GoLiveTab: { icon: Radio, label: 'Go Live', strong: (isLive || available) && scheme === 'light' },
    EventsTab: { icon: Ticket, label: 'Events' },
    ChatTab: { icon: MessageCircle, label: 'Chat' },
  };

  return (
    <>
      <Tab.Navigator
        // Screens cross-fade on a tab switch (native), as the pill glides.
        screenOptions={{ headerShown: false, animation: 'fade' }}
        tabBar={(props) => (
          <>
            {/* Content fades out under the floating bar instead of being cut off. */}
            <LinearGradient
              pointerEvents="none"
              colors={[colors.bgClear, colors.bg]}
              locations={[0, 0.7]}
              style={[fadeStyles.fade, { height: Math.max(bottom, 8) + TAB_BAR_HEIGHT + 34 }]}
            />
            <GlassTabBar {...props} tabs={tabs} />
          </>
        )}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="GoLiveTab" component={GoLiveStack} />
        <Tab.Screen name="EventsTab" component={EventsStack} />
        {/* Board 10: Commits for you and meetings (the chat itself isn't Phase 1). */}
        <Tab.Screen name="ChatTab" component={CommitsStack} />
      </Tab.Navigator>
      <NearbyBanner />
    </>
  );
}

const fadeStyles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
