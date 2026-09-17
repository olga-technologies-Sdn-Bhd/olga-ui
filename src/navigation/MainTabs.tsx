import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Text } from 'react-native';
import { ComingSoonModal } from '../components/ComingSoonModal';
import { ChatPlaceholderScreen } from '../screens/chat/ChatPlaceholderScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { colors } from '../theme/colors';
import { EventsStack } from './EventsStack';
import { GoLiveStack } from './GoLiveStack';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  HomeTab: '⌂',
  GoLiveTab: '◉',
  EventsTab: '□',
  ChatTab: '✉',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  HomeTab: 'Home',
  GoLiveTab: 'Go Live',
  EventsTab: 'Events',
  ChatTab: 'Chat',
};

export function MainTabs() {
  const [chatComingSoon, setChatComingSoon] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: '#9a95a0',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{ICONS[route.name as keyof MainTabParamList]}</Text>,
          tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} />
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
