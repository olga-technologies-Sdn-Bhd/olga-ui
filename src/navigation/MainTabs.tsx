import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, LucideIcon, MessageCircle, Radio, Ticket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive } from '../context/LiveContext';
import { CommitsStack } from './CommitsStack';
import { HomeStack } from './HomeStack';
import { useTheme } from '../theme/ThemeContext';
import { EventsStack } from './EventsStack';
import { GoLiveStack } from './GoLiveStack';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, LucideIcon> = {
  HomeTab: House,
  GoLiveTab: Radio,
  EventsTab: Ticket,
  ChatTab: MessageCircle,
};

const ICON_SIZE = 21;
const FLOATING_TAB_HEIGHT = 54;

const LABELS: Record<keyof MainTabParamList, string> = {
  HomeTab: 'Home',
  GoLiveTab: 'Go Live',
  EventsTab: 'Events',
  ChatTab: 'Chat',
};

export function MainTabs() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { isLive } = useLive();

  return (
    <>
      <Tab.Navigator
        // The pill floats above the home indicator, so the library must not pad
        // the tabs for it again (that pushed them off centre).
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.muted,
          // A floating glass pill above the content, not a bar docked to the edge.
          tabBarStyle: {
            position: 'absolute',
            marginHorizontal: 32,
            bottom: Math.max(bottom, 8) + 6,
            height: FLOATING_TAB_HEIGHT,
            paddingTop: 0,
            paddingBottom: 0,
            borderRadius: FLOATING_TAB_HEIGHT / 2,
            backgroundColor: colors.glass,
            borderWidth: 1,
            borderTopWidth: 1,
            borderColor: colors.glassLine,
            borderTopColor: colors.glassLine,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarItemStyle: { height: FLOATING_TAB_HEIGHT - 2, padding: 0, justifyContent: 'center' },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 0 },
          tabBarIcon: ({ color, focused }) => {
            const Icon = ICONS[route.name as keyof MainTabParamList];
            // Go Live turns green while the member is live.
            const tint = route.name === 'GoLiveTab' && isLive ? colors.liveFill : color;
            return <Icon size={ICON_SIZE} color={tint} strokeWidth={focused ? 2.4 : 1.8} />;
          },
          tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="GoLiveTab" component={GoLiveStack} />
        <Tab.Screen name="EventsTab" component={EventsStack} />
        {/* Board 10: Commits for you and meetings (the chat itself isn't Phase 1). */}
        <Tab.Screen name="ChatTab" component={CommitsStack} />
      </Tab.Navigator>
    </>
  );
}
