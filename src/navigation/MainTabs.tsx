import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, LucideIcon, MessageCircle, Radio, Ticket } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NearbyBanner } from '../components/NearbyBanner';
import { useLive } from '../context/LiveContext';
import { useNearby } from '../context/NearbyContext';
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
  const { colors, scheme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { isLive } = useLive();
  const { available } = useNearby();

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
            // The glass itself is drawn by tabBarBackground.
            backgroundColor: 'transparent',
            overflow: 'visible',
            borderWidth: 1,
            borderTopWidth: 1,
            borderColor: colors.glassLine,
            borderTopColor: colors.glassLine,
            elevation: 0,
            // A soft lift on iOS; Android draws elevation shadows through
            // translucent fills, so it goes without.
            ...Platform.select({
              ios: { shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
              default: { shadowOpacity: 0 },
            }),
          },
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, glassStyles.clip]}>
              <LinearGradient colors={[colors.glass, colors.glassLow]} style={StyleSheet.absoluteFill} />
              <View style={[glassStyles.highlight, { borderColor: colors.glassHighlight }]} />
            </View>
          ),
          tabBarItemStyle: { height: FLOATING_TAB_HEIGHT - 2, padding: 0, justifyContent: 'center' },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 0 },
          tabBarIcon: ({ color, focused }) => {
            const Icon = ICONS[route.name as keyof MainTabParamList];
            // While live (or available nearby) Go Live stays in the Go Live
            // button's dark blue, bold, on any tab.
            const active = route.name === 'GoLiveTab' && (isLive || available);
            return <Icon size={ICON_SIZE} color={active && scheme === 'light' ? colors.charcoal : color} strokeWidth={focused || active ? 2.4 : 1.8} />;
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
      <NearbyBanner />
    </>
  );
}

const glassStyles = StyleSheet.create({
  clip: { borderRadius: FLOATING_TAB_HEIGHT / 2, overflow: 'hidden' },
  // Light catching the top edge of the glass.
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FLOATING_TAB_HEIGHT / 2,
    borderTopWidth: 1,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0,
  },
});
