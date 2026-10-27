import { StyleSheet, Text, View } from 'react-native';
import type { NearbyCard } from '../nearby/types';
import { fonts, semibold } from '../theme/typography';
import { AVATAR_INK, pastelFor } from './GoLiveRadar';

// The person's initials on their pastel, as on the radar.
export function NearbyAvatar({ card, size = 40 }: { card: NearbyCard; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: pastelFor(card.m) }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{card.i}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: AVATAR_INK },
});
