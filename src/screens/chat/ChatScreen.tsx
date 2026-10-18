import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { SlidingUnderline } from '../../components/SlidingUnderline';
import { useTopInset } from '../../components/Screen';
import { CHAT_COMING_SOON } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { ChatStackParamList, ChatTabKey } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { ChatsPanel } from './ChatsPanel';
import { CommitsPanel } from './CommitsPanel';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatHome'>;

const TABS: { key: ChatTabKey; label: string }[] = [
  { key: 'commits', label: 'Commits' },
  { key: 'chats', label: 'Chats' },
];

// The Chat tab: Commits (requests to meet) and Chats (connected members).
// Same header and tabs as Events.
export function ChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topInset = useTopInset();
  const { name } = useAuth();
  const [tab, setTab] = useState<ChatTabKey>(route.params?.tab ?? 'commits');

  // Opened with a tab (e.g. from a notification): show it.
  const asked = route.params?.tab;
  useEffect(() => {
    if (asked) setTab(asked);
  }, [asked]);

  return (
    <View style={styles.container}>
      <View style={[styles.top, { paddingTop: 12 + topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat</Text>
          <Pressable
            onPress={() => navigation.getParent()?.navigate('HomeTab', { screen: 'Profile' })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your account"
          >
            <Avatar initials={(name ?? '?').slice(0, 1).toUpperCase()} size="sm" dark />
          </Pressable>
        </View>
        <View style={styles.tabs}>
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                style={styles.tab}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
          <SlidingUnderline count={TABS.length} index={TABS.findIndex((t) => t.key === tab)} lineWidth={76} color={colors.selected} />
        </View>
      </View>

      {tab === 'commits' ? (
        <CommitsPanel />
      ) : CHAT_COMING_SOON ? (
        // Temporary: chat is built but not switched on for everyone yet.
        <View style={styles.soon}>
          <Text style={styles.soonText}>Chat feature is coming soon</Text>
        </View>
      ) : (
        <ChatsPanel />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    top: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
    title: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 18, fontWeight: semibold, color: colors.text },
    tabs: { flexDirection: 'row', marginTop: 10 },
    tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: 44 },
    tabText: { fontSize: 14, color: colors.muted, paddingBottom: 10 },
    tabTextActive: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.text },
    soon: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 100 },
    soonText: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: semibold, color: colors.muted, textAlign: 'center' },
  });
