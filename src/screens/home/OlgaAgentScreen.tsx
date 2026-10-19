import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowUp, CalendarDays, Mic, Plus, Sparkles, TrendingUp, UsersRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { display } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'OlgaAgent'>;

type Message = { id: number; from: 'olga' | 'me'; text: string };

// Starter prompts, shown until the member sends something.
export const OLGA_PROMPTS = [
  { icon: TrendingUp, label: 'Find investors for my startup' },
  { icon: CalendarDays, label: 'Meet the right people at events' },
  { icon: UsersRound, label: 'Explore strategic partners in SEA' },
];

// Not built yet: Olga answers every message with the same short note.
const NOT_YET =
  "I'm still learning to do this. Soon I'll find the right people for it from your network and events. For now, Go Live at an event to meet them.";

// The Olga agent (Req1): a chat with Olga about what the member wants to
// achieve. A preview only: nothing is sent anywhere, and the replies are fixed.
export function OlgaAgentScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useSafeAreaInsets();
  const { name } = useAuth();
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function send(text: string) {
    const body = text.trim();
    if (!body) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((list) => [...list, { id: nextId.current++, from: 'me', text: body }]);
    setDraft('');
    if (replyTimer.current) clearTimeout(replyTimer.current);
    // A short pause, so the reply reads as an answer.
    replyTimer.current = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((list) => [...list, { id: nextId.current++, from: 'olga', text: NOT_YET }]);
    }, 700);
  }

  // A prompt picked on Home arrives as the first message.
  const prompt = route.params?.prompt;
  useEffect(() => {
    if (prompt) send(prompt);
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
    // Only once, for the prompt this screen opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false} contentStyle={[styles.screen, { paddingBottom: 10 + bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <X size={24} color={colors.text} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.wordmark}>Ol-ga</Text>
          <Text style={styles.preview}>Preview</Text>
        </View>
        <Avatar initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" dark />
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <OlgaSays styles={styles} colors={colors}>
          Hi {firstName || 'there'} 👋{'\n'}I'm Ol-ga. Tell me what you're looking to achieve, and I'll help you find the right people from your
          network, events and beyond.
        </OlgaSays>

        {messages.length === 0 && (
          <View style={styles.prompts}>
            {OLGA_PROMPTS.map(({ icon: Icon, label }) => (
              <Pressable
                key={label}
                onPress={() => send(label)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}
              >
                <Icon size={17} color={colors.text} strokeWidth={1.8} />
                <Text style={styles.promptText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((m) =>
          m.from === 'me' ? (
            <View key={m.id} style={styles.mine}>
              <Text style={styles.mineText}>{m.text}</Text>
            </View>
          ) : (
            <OlgaSays key={m.id} styles={styles} colors={colors}>
              {m.text}
            </OlgaSays>
          )
        )}
      </ScrollView>

      <View style={styles.composer}>
        <Pressable style={styles.round} disabled accessibilityLabel="Attach (coming soon)">
          <Plus size={20} color={colors.muted} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.inputWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message Ol-ga…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={() => send(draft)}
            returnKeyType="send"
            maxLength={500}
          />
          {draft.trim() ? (
            <Pressable onPress={() => send(draft)} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
              <ArrowUp size={18} color={colors.onInk} strokeWidth={2.2} />
            </Pressable>
          ) : (
            <View style={styles.mic} accessibilityLabel="Voice (coming soon)">
              <Mic size={19} color={colors.muted} strokeWidth={1.8} />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

// Olga's turn: the sparkle mark beside a white bubble.
function OlgaSays({ children, styles, colors }: { children: React.ReactNode; styles: ReturnType<typeof makeStyles>; colors: ThemeColors }) {
  return (
    <View style={styles.olgaRow}>
      <OlgaMark size={36} colors={colors} />
      <View style={styles.olgaBubble}>
        <Text style={styles.olgaText}>{children}</Text>
      </View>
    </View>
  );
}

// Olga's mark: an apricot sparkle on a soft glow. Used wherever Olga speaks
// or is offered (the Ask Olga bar on Home).
export function OlgaMark({ size, colors }: { size: number; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.glowSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sparkles size={Math.round(size * 0.5)} color={colors.glow} strokeWidth={1.8} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, gap: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
    titleWrap: { alignItems: 'center' },
    wordmark: { fontFamily: display, fontSize: 28, lineHeight: 32, color: colors.text },
    preview: { fontSize: 11, color: colors.muted, letterSpacing: 0.4 },
    thread: { gap: 14, paddingTop: 10, paddingBottom: 16 },
    olgaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingRight: 28 },
    olgaBubble: {
      flexShrink: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderTopLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    olgaText: { fontSize: 15, lineHeight: 22, color: colors.text },
    prompts: { gap: 8, paddingLeft: 46 },
    prompt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingVertical: 10,
      paddingHorizontal: 14,
      maxWidth: '100%',
    },
    promptText: { flexShrink: 1, fontSize: 14, color: colors.text },
    pressed: { opacity: 0.7 },
    mine: {
      alignSelf: 'flex-end',
      maxWidth: '80%',
      backgroundColor: colors.bubbleMe,
      borderRadius: radius.lg,
      borderBottomRightRadius: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    mineText: { fontSize: 15, lineHeight: 22, color: colors.onBubbleMe },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
    round: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 46,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingLeft: 16,
      paddingRight: 5,
    },
    input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
    send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    mic: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  });
