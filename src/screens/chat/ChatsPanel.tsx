import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellOff } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { Conversation } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { CHAT_INBOX_POLL_MS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useNearby } from '../../context/NearbyContext';
import { useOfflineChat } from '../../context/OfflineChatContext';
import { isOffensive } from '../../chat/moderation';
import { ChatStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { formatRelativeTime } from '../../utils/chatTime';
import { getInitials } from '../../utils/initials';
import { usePollWhileFocused } from '../../utils/usePollWhileFocused';

export const FALLBACK_NAME = 'OL-GA member';

const byActivity = (a: Conversation, b: Conversation) => b.last_activity_at.localeCompare(a.last_activity_at);

function preview(conversation: Conversation, myId: string | null) {
  const last = conversation.last_message;
  if (!last) return 'Say hello 👋';
  if (last.deleted_at) return 'This message was deleted';
  if (last.sender_member_id !== myId && isOffensive(last.body ?? '')) return 'Message hidden';
  return `${last.sender_member_id === myId ? 'You: ' : ''}${last.body ?? ''}`;
}

export function ChatsPanel() {
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId: myId } = useAuth();
  const chat = useOfflineChat();
  const { inRange } = useNearby();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pages beyond the first that have been loaded; a refresh keeps them.
  const loadedMore = useRef(false);

  // First page. A refresh merges it in (newest activity first) so pages
  // loaded with "Load more" stay put.
  const refresh = useCallback(async () => {
    try {
      const page = await coreApi.listConversations();
      setError(null);
      setItems((current) => {
        if (!current || !loadedMore.current) return page.items;
        const fresh = new Map(page.items.map((c) => [c.conversation_id, c]));
        const rest = current.filter((c) => !fresh.has(c.conversation_id));
        return [...page.items, ...rest].sort(byActivity);
      });
      if (!loadedMore.current) {
        setCursor(page.next_cursor);
        setHasMore(page.has_more);
      }
    } catch (e) {
      if (__DEV__) console.warn(`Conversations load failed (${e instanceof ApiError ? e.code : 'unknown'})`);
      setError(
        e instanceof ApiError && e.status > 0
          ? "Couldn't load your chats. Pull down to try again."
          : 'No connection. Pull down to try again.'
      );
    }
  }, []);

  usePollWhileFocused(refresh, CHAT_INBOX_POLL_MS);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await coreApi.listConversations(cursor);
      loadedMore.current = true;
      setItems((current) => {
        const seen = new Set((current ?? []).map((c) => c.conversation_id));
        return [...(current ?? []), ...page.items.filter((c) => !seen.has(c.conversation_id))];
      });
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONVERSATION_CURSOR_INVALID') {
        // Cursor no longer valid: start paging again from the top.
        loadedMore.current = false;
        setItems(null);
        await refresh();
      } else {
        setError("Couldn't load more conversations. Try again.");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePullRefresh() {
    loadedMore.current = false;
    await refresh();
  }

  return (
    <Screen onRefresh={handlePullRefresh} contentStyle={styles.panel}>
      {/* No internet isn't an error here: chats on the phone still work. */}
      {error && !error.startsWith('No connection') && <Text style={styles.error}>{error}</Text>}
      {items === null && !error && <ActivityIndicator color={colors.brand} style={styles.loading} />}
      <View style={styles.list}>
        {/* People reached only over Bluetooth (no Ol-ga conversation listed yet). */}
        {(() => {
          const listed = new Set((items ?? []).map((c) => c.member_id));
          return chat.peers
            .filter((p) => !listed.has(p.memberId))
            .map((p) => {
              const last = chat.messagesWith(p.memberId).slice(-1)[0];
              return (
                <ChatRow
                  key={p.memberId}
                  name={p.name || FALLBACK_NAME}
                  initials={p.name ? getInitials(p.name) : p.initials ?? '?'}
                  time={last ? formatRelativeTime(last.sentAt) : undefined}
                  preview={
                    last
                      ? last.from === 'them' && isOffensive(last.body)
                        ? 'Message hidden'
                        : `${last.from === 'me' ? 'You: ' : ''}${last.body}`
                      : p.conversationId
                        ? 'Say hello 👋'
                        : 'Connected nearby. Say hello 👋'
                  }
                  nearby={Boolean(inRange[p.memberId])}
                  onPress={() =>
                    navigation.navigate('Conversation', p.conversationId ? { conversationId: p.conversationId, memberId: p.memberId } : { memberId: p.memberId })
                  }
                  styles={styles}
                  colors={colors}
                />
              );
            });
        })()}

        {items?.map((c) => (
          <ChatRow
            key={c.conversation_id}
            name={c.display_name || FALLBACK_NAME}
            initials={c.display_name ? getInitials(c.display_name) : '?'}
            time={formatRelativeTime(c.last_activity_at)}
            preview={preview(c, myId)}
            unread={c.unread_count}
            muted={Boolean(c.muted_until)}
            nearby={Boolean(inRange[c.member_id])}
            onPress={() => navigation.navigate('Conversation', { conversationId: c.conversation_id, memberId: c.member_id })}
            styles={styles}
            colors={colors}
          />
        ))}
      </View>

      {items?.length === 0 && chat.peers.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.sub}>When a Commit is accepted, your chat opens here.</Text>
        </View>
      )}

      {hasMore && <Button label="Load more" variant="secondary" small loading={loadingMore} onPress={loadMore} />}
    </Screen>
  );
}

// One chat in the list, as in WhatsApp: avatar, name and time on top, the
// last message and an unread count below, hairline divider after the avatar.
function ChatRow({
  name,
  initials,
  time,
  preview: text,
  unread = 0,
  muted,
  nearby,
  onPress,
  styles,
  colors,
}: {
  name: string;
  initials: string;
  time?: string;
  preview: string;
  unread?: number;
  muted?: boolean;
  nearby?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const hasUnread = unread > 0;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.accentSoft }}
      style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}${hasUnread ? `, ${unread} unread` : ''}`}
    >
      <Avatar initials={initials} size="list" />
      <View style={styles.rowBody}>
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {!!time && <Text style={[styles.time, hasUnread && styles.timeUnread]}>{time}</Text>}
        </View>
        <View style={styles.line}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {text}
          </Text>
          <View style={styles.marks}>
            {nearby && <Pill label="Nearby" tone="positive" />}
            {muted && <BellOff size={15} color={colors.muted} accessibilityLabel="Muted" />}
            {hasUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: { paddingTop: 4 },
    sub: { fontSize: 14, lineHeight: 20, color: colors.muted },
    error: { fontSize: 14, color: colors.danger },
    loading: { marginTop: 24 },
    // Edge to edge, like a chat list.
    list: { marginHorizontal: -20, backgroundColor: colors.surface },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16 },
    rowPressed: { backgroundColor: colors.accentSoft },
    // The divider starts after the avatar.
    rowBody: { flex: 1, gap: 2, paddingVertical: 12, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    // As in WhatsApp: a medium-weight name, not heavy bold.
    name: { flex: 1, fontFamily: fonts.bodyRegular, fontSize: 16, fontWeight: '600', color: colors.text },
    time: { fontSize: 12, color: colors.muted },
    timeUnread: { color: colors.brand, fontWeight: '700' },
    preview: { flex: 1, fontSize: 14, lineHeight: 18, color: colors.muted },
    previewUnread: { color: colors.text },
    marks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.onInk, fontSize: 12, fontWeight: '800' },
    empty: { alignItems: 'center', gap: 6, paddingVertical: 40 },
    emptyTitle: { fontFamily: fonts.headingBold, fontSize: 16, fontWeight: '700', color: colors.text },
  });
