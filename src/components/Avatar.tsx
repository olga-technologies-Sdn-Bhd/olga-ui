import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { memberPictureSource, type PictureSize } from '../api/core';
import { useAuth } from '../context/AuthContext';
import { markPictureMissing, pictureIsMissing, useMyPicture } from '../profile/myPicture';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

type Size = 'sm' | 'md' | 'list' | 'lg' | 'xl';

type Props = {
  initials: string;
  size?: Size;
  // Charcoal fill with light text: the account button in screen headers.
  dark?: boolean;
  // White fill: stands out on a tinted ground (a conversation header).
  light?: boolean;
  // Another member whose picture to show (only when you may see it: the server
  // answers 404 otherwise and the initials stay).
  memberId?: string;
  // The signed-in member's own picture.
  own?: boolean;
  // A photo just chosen, shown (with a spinner while `busy`) until the server
  // has finished with it.
  previewUri?: string | null;
  busy?: boolean;
};

// list: a row in the Chats list.
const SIZES: Record<Size, number> = { sm: 34, md: 42, list: 50, lg: 58, xl: 96 };
const FONT_SIZES: Record<Size, number> = { sm: 12, md: 15, list: 16, lg: 18, xl: 30 };

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// The smallest server size that stays sharp at this size on this screen.
function pictureSize(dimension: number): PictureSize {
  const pixels = dimension * PixelRatio.get();
  return pixels <= 64 ? 'thumbnail' : pixels <= 256 ? 'small' : 'large';
}

export function Avatar({ initials, size = 'md', dark, light, memberId, own, previewUri, busy }: Props) {
  const dimension = SIZES[size];
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          // Initials on a soft brand tint, like iOS contacts.
          backgroundColor: colors.accentFill,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        text: {
          fontFamily: fonts.bodyBold,
          fontWeight: semibold,
          color: colors.accent,
        },
        dark: { backgroundColor: colors.charcoal },
        light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        textDark: { color: colors.white },
        photo: FILL,
        busy: { ...FILL, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
      }),
    [colors]
  );

  return (
    <View
      style={[
        styles.base,
        dark && styles.dark,
        light && styles.light,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
      ]}
    >
      {/* The initials stay underneath: they show until a picture has loaded,
          and whenever there is none (or it cannot be loaded). */}
      <Text style={[styles.text, dark && styles.textDark, { fontSize: FONT_SIZES[size] }]}>{initials}</Text>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.photo} resizeMode="cover" />
      ) : own ? (
        <OwnPhoto dimension={dimension} style={styles.photo} />
      ) : memberId ? (
        <MemberPhoto memberId={memberId} dimension={dimension} style={styles.photo} />
      ) : null}
      {busy && (
        <View style={styles.busy}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

type PhotoProps = { dimension: number; style: object };

// The signed-in member's own picture.
function OwnPhoto({ dimension, style }: PhotoProps) {
  const { memberId } = useAuth();
  const picture = useMyPicture(memberId);
  if (!memberId || !picture.hasPicture) return null;
  return <MemberPhoto memberId={memberId} version={picture.version} dimension={dimension} style={style} />;
}

function MemberPhoto({ memberId, version, dimension, style }: PhotoProps & { memberId: string; version?: string | null }) {
  const [failed, setFailed] = useState(() => pictureIsMissing(memberId));
  if (failed) return null;
  const source = memberPictureSource(memberId, pictureSize(dimension), version);
  return (
    <Image
      // A new version is a new picture: do not keep the old one on screen.
      key={`${memberId}${version ?? ''}`}
      source={source}
      style={style}
      resizeMode="cover"
      onError={() => {
        markPictureMissing(memberId);
        setFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  );
}
