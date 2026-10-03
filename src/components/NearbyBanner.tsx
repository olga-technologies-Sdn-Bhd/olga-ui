import { useEffect, useMemo } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { consumeOpenedNotification, subscribeNotificationOpened } from '../bluetooth/bleDiscovery';
import { useNearby } from '../context/NearbyContext';
import { navigationRef } from '../navigation/navigationRef';
import { NearbyAvatar } from '../screens/golive/NearbyView';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';
import { useTopInset } from './Screen';

const SHOW_MS = 8000;

// Notification ids are nearby-in-<request id> (a Commit for you) and
// nearby-ok-<request id> (your Commit was accepted): both open that request.
// chat-<member id> (a message over Bluetooth) opens that conversation.
function openFromNotification(id: string, attempt = 0) {
  const match = /^nearby-(?:in|ok)-(.+)$/.exec(id);
  const chat = /^chat-(.+)$/.exec(id);
  if (!match && !chat) return;
  if (!navigationRef.isReady()) {
    // Cold start: the navigator mounts after the splash.
    if (attempt < 40) setTimeout(() => openFromNotification(id, attempt + 1), 250);
    return;
  }
  if (chat) navigationRef.navigate('ChatTab', { screen: 'Conversation', params: { memberId: chat[1] } });
  else if (match) navigationRef.navigate('GoLiveTab', { screen: 'NearbyRequest', params: { requestId: match[1] } });
}

// Drops in over any screen when someone nearby sends a Commit; tap to answer.
export function NearbyBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const top = useTopInset();
  const { banner, dismissBanner } = useNearby();

  // Tapping a Nearby notification opens that request, not just the app.
  useEffect(() => {
    const check = () => consumeOpenedNotification().then((id) => id && openFromNotification(id)).catch(() => {});
    check();
    const unsubscribe = subscribeNotificationOpened((id) => openFromNotification(id));
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(dismissBanner, SHOW_MS);
    return () => clearTimeout(timer);
  }, [banner, dismissBanner]);

  if (!banner) return null;
  const open = () => {
    dismissBanner();
    if (navigationRef.isReady()) navigationRef.navigate('GoLiveTab', { screen: 'NearbyRequest', params: { requestId: banner.id } });
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: top + 8 }]}>
      <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
        <NearbyAvatar card={banner.peer} size={42} />
        <View style={styles.flex}>
          <Text style={styles.title}>Someone nearby wants to meet</Text>
          <Text style={styles.body} numberOfLines={2}>
            {banner.peer.h}
          </Text>
        </View>
        <Text style={styles.cta}>View</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 12, right: 12 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    pressed: { opacity: 0.85 },
    flex: { flex: 1, minWidth: 0 },
    title: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: '700', color: colors.text },
    body: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    cta: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.text },
  });
