import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock, FileText, Pause, Play, X } from 'lucide-react-native';
import { viewDocument } from '@react-native-documents/viewer';
import type { ChatAttachment as Attachment } from '../api/types';
import { download, formatBytes, formatDuration, kindOf, useDownload, type LocalFile } from '../chat/attachments';
import { togglePlay, usePlayback } from '../chat/voice';
import { useTheme } from '../theme/ThemeContext';
import { semibold } from '../theme/typography';

type Props = {
  mine: boolean;
  // On Ol-ga: the message and its attachment.
  messageId?: string;
  attachment?: Attachment;
  // Still on this phone (sending): the picked file and upload progress (0..1).
  local?: LocalFile;
  progress?: number;
  onCancel?: () => void;
};

const IMAGE_WIDTH = 220;

// The inside of a FILE bubble: a photo, a PDF card or a voice player.
export function ChatAttachment({ mine, messageId, attachment, local, progress, onCancel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: { width: IMAGE_WIDTH, borderRadius: 14, backgroundColor: colors.accentSoft },
        placeholder: {
          width: IMAGE_WIDTH,
          height: 160,
          borderRadius: 14,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, minWidth: 200 },
        cardIcon: {
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardText: { flexShrink: 1 },
        name: { fontSize: 14, fontWeight: semibold, color: mine ? colors.onBubbleMe : colors.text },
        meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
        player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 4, width: 220 },
        play: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // The triangle, nudged right so it looks centred.
        playIcon: { marginLeft: 2 },
        track: { flex: 1, gap: 6 },
        bar: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
        barFill: { height: 4, backgroundColor: colors.brand },
        upload: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, paddingHorizontal: 4 },
        uploadBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
        uploadFill: { height: 3, backgroundColor: colors.brand },
        cancel: { padding: 2 },
      }),
    [colors, mine]
  );

  const kind = kindOf(attachment?.media_type ?? local?.type ?? '');
  // Photos and voice notes load straight away; a PDF when it's opened.
  const fetched = useDownload(messageId, attachment, kind !== 'pdf');
  const uri = local?.uri ?? (fetched.state === 'ready' ? fetched.uri : null);
  const [aspect, setAspect] = useState(4 / 3);
  const [opening, setOpening] = useState(false);
  const playback = usePlayback(uri);

  const name = attachment?.file_name ?? local?.name ?? '';
  const size = attachment?.size_bytes ?? local?.size;
  const mediaType = attachment?.media_type ?? local?.type;

  const status =
    fetched.state === 'processing'
      ? 'Processing…'
      : fetched.state === 'gone'
      ? 'No longer available'
      : fetched.state === 'forbidden'
      ? 'Not available'
      : fetched.state === 'failed'
      ? 'Couldn’t load. Tap to try again'
      : null;

  const show = (fileUri: string) => viewDocument({ uri: fileUri, mimeType: mediaType, grantPermissions: 'read', headerTitle: name }).catch(() => {});

  // One tap: download if needed, then open it in the phone's viewer.
  async function open() {
    if (uri) {
      show(uri);
      return;
    }
    if (!messageId || !attachment) return;
    setOpening(true);
    const ready = await download(messageId, attachment);
    setOpening(false);
    if (ready) show(ready);
  }

  let body: React.ReactNode;
  if (kind === 'image') {
    body = uri ? (
      <Pressable onPress={open} accessibilityRole="imagebutton" accessibilityLabel="Photo">
        <Image
          source={{ uri }}
          style={[styles.image, { height: Math.min(IMAGE_WIDTH / aspect, 300) }]}
          resizeMode="cover"
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source;
            if (width && height) setAspect(width / height);
          }}
        />
      </Pressable>
    ) : (
      <Pressable style={styles.placeholder} onPress={fetched.state === 'failed' ? open : undefined} accessibilityLabel={status ?? 'Photo'}>
        {fetched.state === 'loading' || fetched.state === 'idle' ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <>
            <Clock size={20} color={colors.muted} />
            <Text style={styles.meta}>{status}</Text>
          </>
        )}
      </Pressable>
    );
  } else if (kind === 'voice') {
    const duration = playback.durationMs || local?.durationMs || 0;
    const shown = playback.positionMs > 0 ? playback.positionMs : duration;
    const fraction = duration > 0 ? Math.min(playback.positionMs / duration, 1) : 0;
    body = (
      <View style={styles.player}>
        <Pressable
          style={styles.play}
          onPress={() => (uri ? togglePlay(uri) : open())}
          disabled={!uri && fetched.state !== 'failed'}
          accessibilityLabel={playback.playing ? 'Pause voice message' : 'Play voice message'}
        >
          {!uri && (fetched.state === 'loading' || fetched.state === 'idle') ? (
            <ActivityIndicator color={colors.onInk} size="small" />
          ) : playback.playing ? (
            <Pause size={18} color={colors.onInk} fill={colors.onInk} />
          ) : (
            <Play size={18} color={colors.onInk} fill={colors.onInk} style={styles.playIcon} />
          )}
        </Pressable>
        <View style={styles.track}>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${fraction * 100}%` }]} />
          </View>
          <Text style={styles.meta}>{status && !uri ? status : duration > 0 ? formatDuration(shown) : 'Voice message'}</Text>
        </View>
      </View>
    );
  } else {
    body = (
      <Pressable style={styles.card} onPress={open} disabled={opening || fetched.state === 'loading'} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
        <View style={styles.cardIcon}>
          {opening || fetched.state === 'loading' ? <ActivityIndicator color={colors.brand} size="small" /> : <FileText size={20} color={colors.brand} />}
        </View>
        <View style={styles.cardText}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.meta}>{status && !uri ? status : ['PDF', size ? formatBytes(size) : null].filter(Boolean).join(' · ')}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View>
      {body}
      {progress !== undefined && (
        <View style={styles.upload}>
          <View style={styles.uploadBar}>
            <View style={[styles.uploadFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          {onCancel && (
            <Pressable onPress={onCancel} hitSlop={10} style={styles.cancel} accessibilityLabel="Cancel upload">
              <X size={14} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
