import { useFocusEffect } from '@react-navigation/native';
import { CircleAlert } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { newIdempotencyKey, withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import type { PendingInvitation } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { navigationRef } from '../../navigation/navigationRef';
import { acceptProblem } from '../../sci/invitations';
import { safeLogLine } from '../../sci/problems';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

// Invitations waiting for the signed-in member (matched to their verified
// phone or email), shown on Home. Nothing shows when there are none or Ol-ga
// can't be reached.
export function PendingInvitations() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pending, setPending] = useState<PendingInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // One key per invitation being accepted, kept until it works.
  const keys = useRef<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      coreApi
        .listPendingInvitations()
        .then((list) => setPending(Array.isArray(list) ? list : []))
        .catch((e) => {
          const line = safeLogLine('Load pending invitations', e);
          if (line) console.warn(line);
        });
    }, []),
  );

  const accept = async (invite: PendingInvitation) => {
    if (busy) return;
    const id = invite.invitation_id;
    const key = (keys.current[id] ??= newIdempotencyKey());
    setBusy(id);
    try {
      const accepted = await withRetries((timeoutMs) => coreApi.acceptPendingInvitation(id, { idempotencyKey: key, timeoutMs }));
      delete keys.current[id];
      setPending((prev) => prev.filter((p) => p.invitation_id !== id));
      if (navigationRef.isReady()) {
        navigationRef.navigate('ChatTab', { screen: 'Conversation', params: { conversationId: accepted.conversation_id }, initial: false });
      }
    } catch (e) {
      const problem = acceptProblem(e);
      const line = safeLogLine('Accept pending invitation', e);
      if (line) console.warn(line);
      if (problem.final) setPending((prev) => prev.filter((p) => p.invitation_id !== id));
      showDialog("Couldn't accept", problem.message, undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {pending.map((p) => (
        <Card key={p.invitation_id}>
          <Text style={styles.title}>{p.inviter_display_name} invited you to connect</Text>
          {!!(p.inviter_headline || p.venture_name) && (
            <Text style={styles.note} numberOfLines={2}>
              {[p.inviter_headline, p.venture_name].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={styles.body}>If you accept, you will be connected and can chat.</Text>
          <Button label="Accept" small loading={busy === p.invitation_id} onPress={() => accept(p)} style={styles.action} />
        </Card>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 4 },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    action: { marginTop: 10, alignSelf: 'flex-start' },
  });
