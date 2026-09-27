import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, House, LucideIcon, MessageCircle, Radio } from 'lucide-react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComingSoonModal } from '../components/ComingSoonModal';
import { ChatPlaceholderScreen } from '../screens/chat/ChatPlaceholderScreen';
import { HomeStack } from './HomeStack';
import { useTheme } from '../theme/ThemeContext';
import { EventsStack } from './EventsStack';
import { GoLiveStack } from './GoLiveStack';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, LucideIcon> = {
  HomeTab: House,
  GoLiveTab: Radio,
  EventsTab: CalendarDays,
  ChatTab: MessageCircle,
};

const ICON_SIZE = 26;

const LABELS: Record<keyof MainTabParamList, string> = {
  HomeTab: 'Home',
  GoLiveTab: 'Go Live',
  EventsTab: 'Events',
  ChatTab: 'Chat',
};

export function MainTabs() {
  const [chatComingSoon, setChatComingSoon] = useState(false);
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
            height: 64 + bottom,
            paddingTop: 8,
            paddingBottom: Math.max(bottom, 8),
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
          tabBarIcon: ({ color, focused }) => {
            const Icon = ICONS[route.name as keyof MainTabParamList];
            return <Icon size={ICON_SIZE} color={color} strokeWidth={focused ? 2.4 : 1.8} />;
          },
          tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="GoLiveTab" component={GoLiveStack} />
        <Tab.Screen name="EventsTab" component={EventsStack} />
        <Tab.Screen
          name="ChatTab"
          component={ChatPlaceholderScreen}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setChatComingSoon(true);
            },
          }}
        />
      </Tab.Navigator>

      <ComingSoonModal
        visible={chatComingSoon}
        onClose={() => setChatComingSoon(false)}
        title="Chat — coming soon!"
        message="Conversations with your connections will land here once accepted commits go live."
      />
    </>
  );
}
