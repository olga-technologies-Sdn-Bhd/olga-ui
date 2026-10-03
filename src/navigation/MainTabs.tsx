import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, House, LucideIcon, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoLiveMark } from '../components/GoLiveMark';
import { useLive } from '../context/LiveContext';
import { CommitsStack } from './CommitsStack';
import { HomeStack } from './HomeStack';
import { useTheme } from '../theme/ThemeContext';
import { EventsStack } from './EventsStack';
import { GoLiveStack } from './GoLiveStack';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Go Live uses its own mark (board 11), not a Lucide icon.
const ICONS: Record<Exclude<keyof MainTabParamList, 'GoLiveTab'>, LucideIcon> = {
  HomeTab: House,
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
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { isLive } = useLive();

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
            if (route.name === 'GoLiveTab') {
              // The dot steps inside while live; the live dot is green.
              return <GoLiveMark size={ICON_SIZE} color={color} live={isLive} dotColor={isLive ? colors.liveFill : undefined} />;
            }
            const Icon = ICONS[route.name as Exclude<keyof MainTabParamList, 'GoLiveTab'>];
            return <Icon size={ICON_SIZE} color={color} strokeWidth={focused ? 2.4 : 1.8} />;
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
