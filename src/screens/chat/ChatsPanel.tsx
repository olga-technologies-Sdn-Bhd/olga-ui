import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellOff } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { Conversation } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
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
          ? "Couldn't load your conversations. Pull down to try again."
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
      {(() => {
        const listed = new Set((items ?? []).map((c) => c.member_id));
        const extra = chat.peers.filter((p) => !listed.has(p.memberId));
        return extra.map((p) => {
          const last = chat.messagesWith(p.memberId).slice(-1)[0];
          return (
            <Pressable
              key={p.memberId}
              onPress={() =>
                navigation.navigate('Conversation', p.conversationId ? { conversationId: p.conversationId, memberId: p.memberId } : { memberId: p.memberId })
              }
              accessibilityRole="button"
              accessibilityLabel={p.name || FALLBACK_NAME}
            >
              <Card style={styles.row}>
                <Avatar initials={p.name ? getInitials(p.name) : p.initials ?? '?'} />
                <View style={styles.rowBody}>
                  <View style={styles.space}>
                    <Text style={styles.h3} numberOfLines={1}>
                      {p.name || FALLBACK_NAME}
                    </Text>
                    {inRange[p.memberId] && <Pill label="Nearby" tone="positive" />}
                  </View>
                  {p.headline && (
                    <Text style={styles.headline} numberOfLines={1}>
                      {p.headline}
                    </Text>
                  )}
                  <Text style={[styles.sub, styles.preview]} numberOfLines={1}>
                    {last
                      ? last.from === 'them' && isOffensive(last.body)
                        ? 'Message hidden'
                        : `${last.from === 'me' ? 'You: ' : ''}${last.body}`
                      : p.conversationId ? 'Say hello 👋' : 'Connected nearby. Say hello 👋'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        });
      })()}

      {items?.length === 0 && chat.peers.length === 0 && (
        <Card>
          <Text style={styles.h3}>No conversations yet</Text>
          <Text style={styles.sub}>When you and someone accept each other's commit, your conversation opens here.</Text>
        </Card>
      )}

      {items?.map((c) => {
        const name = c.display_name || FALLBACK_NAME;
        const unread = c.unread_count > 0;
        return (
          <Pressable
            key={c.conversation_id}
            onPress={() => navigation.navigate('Conversation', { conversationId: c.conversation_id, memberId: c.member_id })}
            accessibilityRole="button"
            accessibilityLabel={`${name}${unread ? `, ${c.unread_count} unread` : ''}`}
          >
            <Card style={styles.row}>
              <Avatar initials={c.display_name ? getInitials(c.display_name) : '?'} />
              <View style={styles.rowBody}>
                <View style={styles.space}>
                  <View style={styles.nameRow}>
                    <Text style={styles.h3} numberOfLines={1}>
                      {name}
                    </Text>
                    {c.muted_until && <BellOff size={14} color={colors.muted} accessibilityLabel="Muted" />}
                    {inRange[c.member_id] && <Pill label="Nearby" tone="positive" />}
                  </View>
                  <Text style={styles.time}>{formatRelativeTime(c.last_activity_at)}</Text>
                </View>
                {c.headline && (
                  <Text style={styles.headline} numberOfLines={1}>
                    {c.headline}
                  </Text>
                )}
                <View style={styles.space}>
                  <Text style={[styles.sub, styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                    {preview(c, myId)}
                  </Text>
                  {unread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{c.unread_count > 99 ? '99+' : c.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}

      {hasMore && <Button label="Load more" variant="secondary" small loading={loadingMore} onPress={loadMore} />}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: { paddingTop: 12 },
    h3: { fontFamily: fonts.headingBold, fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
    sub: { fontSize: 14, lineHeight: 20, color: colors.muted },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 12 },
    error: { fontSize: 14, color: colors.danger },
    loading: { marginTop: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowBody: { flex: 1, gap: 2 },
    space: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    time: { fontSize: 13, color: colors.muted },
    headline: { fontSize: 13, color: colors.muted },
    preview: { flex: 1 },
    previewUnread: { color: colors.text, fontWeight: '700' },
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
  });
