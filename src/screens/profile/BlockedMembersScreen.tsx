import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ban, CircleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { BlockedMember } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { ListGroup, ListRow } from '../../components/ListGroup';
import { Screen } from '../../components/Screen';
import { useOfflineChat } from '../../context/OfflineChatContext';
import { HomeStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { getInitials } from '../../utils/initials';

type Props = NativeStackScreenProps<HomeStackParamList, 'BlockedMembers'>;

// ACC-04: the members I blocked, newest first, each with Unblock. Unblocking
// restores nothing by itself: no connection or chat comes back.
export function BlockedMembersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const chat = useOfflineChat();
  const [blocked, setBlocked] = useState<BlockedMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    coreApi
      .listBlockedMembers()
      .then(setBlocked)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  async function unblock(member: BlockedMember) {
    setBusy(member.member_id);
    try {
      await coreApi.unblockMember(member.member_id);
    } catch (e) {
      // 404 BLOCK_NOT_FOUND: already unblocked (e.g. on another phone).
      if (!(e instanceof ApiError && e.status === 404)) {
        setBusy(null);
        showDialog("Couldn't unblock", 'Check your connection and try again.', undefined, { icon: CircleAlert, tone: 'danger' });
        return;
      }
    }
    chat.unblockPeer(member.member_id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBlocked((list) => list?.filter((m) => m.member_id !== member.member_id) ?? null);
    setBusy(null);
  }

  function confirmUnblock(member: BlockedMember) {
    const name = member.display_name ?? 'this member';
    showDialog(
      `Unblock ${name}?`,
      "You may see each other at events again. Your old chat doesn't come back, and they won't be told.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblock(member) },
      ],
      { icon: Ban }
    );
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Blocked members" />
      <Text style={styles.lead}>Blocked members can't see you or message you, and they aren't told.</Text>

      {blocked === null && !failed && <ActivityIndicator color={colors.accent} style={styles.loading} />}

      {failed && (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>Couldn't load your blocked members.</Text>
          <Button label="Try again" variant="secondary" small onPress={load} />
        </Card>
      )}

      {blocked?.length === 0 && (
        <Card style={styles.empty}>
          <Ban size={22} color={colors.muted} strokeWidth={2} />
          <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
        </Card>
      )}

      {!!blocked?.length && (
        <ListGroup>
          {blocked.map((m) => (
            <ListRow
              key={m.member_id}
              leading={<Avatar initials={m.display_name ? getInitials(m.display_name) : '?'} />}
              title={m.display_name ?? 'Member'}
              subtitle={`Blocked ${blockedOn(m.blocked_at)}`}
              trailing={
                <Pressable
                  onPress={() => confirmUnblock(m)}
                  disabled={busy !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${m.display_name ?? 'member'}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.unblock, pressed && styles.pressed]}
                >
                  {busy === m.member_id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.unblockLabel}>Unblock</Text>
                  )}
                </Pressable>
              }
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "3 Oct", or "3 Oct 2025" from another year.
function blockedOn(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    lead: { fontSize: 13, lineHeight: 19, color: colors.muted },
    loading: { marginTop: 24 },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
    emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    unblock: { minWidth: 84, height: 34, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill },
    pressed: { opacity: 0.7 },
    unblockLabel: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.accent },
  });
