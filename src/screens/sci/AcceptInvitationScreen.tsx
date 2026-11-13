import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { newIdempotencyKey, withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import type { OpenedInvitation } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { clearInviteToken, heldInviteToken } from '../../navigation/inviteLinks';
import { navigationRef } from '../../navigation/navigationRef';
import { HomeStackParamList } from '../../navigation/types';
import { acceptProblem, EXPIRED_INVITATION, openProblem } from '../../sci/invitations';
import { safeLogLine } from '../../sci/problems';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'AcceptInvitation'>;

// Someone opened an invitation link. The token is read from memory (never from
// navigation state) and accepting is the member's own tap.
export function AcceptInvitationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const token = useRef(heldInviteToken()).current;
  // One key for this invitation: trying again after a lost answer is safe.
  const key = useRef(newIdempotencyKey()).current;
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [stuck, setStuck] = useState<string | null>(null);
  // Who sent it, once Ol-ga says; null while loading or if it couldn't say.
  const [opened, setOpened] = useState<OpenedInvitation | null>(null);
  const [opening, setOpening] = useState(!!token);

  // Opening the link tells the sender it was seen and says who sent it.
  useEffect(() => {
    if (!token) return;
    let live = true;
    coreApi
      .openInvitation(token)
      .then((o) => {
        if (!live) return;
        setOpened(o);
        if (o.status === 'EXPIRED' || o.status === 'REVOKED') {
          clearInviteToken();
          setStuck(o.status === 'EXPIRED' ? EXPIRED_INVITATION : "This invitation isn't valid any more. Ask the person who sent it for a new one.");
        }
      })
      .catch((e) => {
        if (!live) return;
        const line = safeLogLine('Open invitation', e);
        if (line) console.warn(line);
        const problem = openProblem(e);
        if (problem) {
          clearInviteToken();
          setStuck(problem);
        }
      })
      .finally(() => live && setOpening(false));
    return () => {
      live = false;
    };
  }, [token]);

  const accept = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const accepted = await withRetries((timeoutMs) => coreApi.acceptInvitation(token, { idempotencyKey: key, timeoutMs }));
      clearInviteToken();
      setConversationId(accepted.conversation_id);
    } catch (e) {
      const problem = acceptProblem(e);
      const line = safeLogLine('Accept invitation', e);
      if (line) console.warn(line);
      if (problem.final) {
        clearInviteToken();
        setStuck(problem.message);
      } else {
        showDialog("Couldn't accept", problem.message, undefined, { icon: CircleAlert, tone: 'danger' });
      }
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    clearInviteToken();
    navigation.goBack();
  };

  const openChat = () => {
    if (!conversationId) return;
    if (navigationRef.isReady()) navigationRef.navigate('ChatTab', { screen: 'Conversation', params: { conversationId }, initial: false });
  };

  return (
    <Screen>
      <BackHeader onBack={notNow} title="Invitation" />
      {conversationId ? (
        <>
          <Card>
            <Text style={styles.title}>You're connected</Text>
            <Text style={styles.body}>
              {opened ? `You can now chat with ${opened.inviter_display_name}.` : 'You can now chat with the person who invited you.'}
            </Text>
          </Card>
          <Button label="Open chat" onPress={openChat} />
        </>
      ) : stuck || !token ? (
        <Card>
          <Text style={styles.body}>{stuck ?? 'There is no invitation to accept here.'}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.title}>{opened ? `${opened.inviter_display_name} invited you to connect` : "You've been invited to connect"}</Text>
            {opened?.venture_name ? <Text style={styles.note}>{opened.venture_name}</Text> : null}
            <Text style={styles.body}>
              {opened ? 'If you accept, you will be connected and can chat.' : 'Someone you know invited you on Ol-ga. If you accept, you will be connected and can chat.'}
            </Text>
          </Card>
          <Button label="Accept" loading={busy || opening} onPress={accept} />
          <Button label="Not now" variant="secondary" onPress={notNow} />
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted, marginBottom: 6 },
  });
