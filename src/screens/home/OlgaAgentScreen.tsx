import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, TrendingUp, UsersRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { ChatWallpaper } from '../../components/ChatWallpaper';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

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
// It uses the app's one chat look (ChatBubble, ChatComposer, the white
// wallpaper), the same as conversations, sign-up and your introduction.
export function OlgaAgentScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useSafeAreaInsets();
  const { name } = useAuth();
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const nextId = useRef(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function send(text: string) {
    const body = text.trim();
    if (!body) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((list) => [...list, { id: nextId.current++, from: 'me', text: body }]);
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
    <Screen scroll={false} style={styles.ground} contentStyle={[styles.screen, { paddingBottom: 10 + bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <X size={24} color={colors.text} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.wordmark}>Ol-ga</Text>
          <Text style={styles.preview}>Preview</Text>
        </View>
        <Avatar own initials={(firstName || '?').slice(0, 1).toUpperCase()} size="sm" dark />
      </View>

      {/* The chat area: the same white wallpaper as a conversation. */}
      <View style={styles.thread}>
        <ChatWallpaper />
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <ChatBubble
            from="them"
            text={`Hi ${firstName || 'there'} 👋\nI'm Ol-ga. Tell me what you're looking to achieve, and I'll help you find the right people from your network, events and beyond.`}
          />

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

          {messages.map((m) => (
            <ChatBubble key={m.id} from={m.from === 'me' ? 'me' : 'them'} text={m.text} />
          ))}
        </ScrollView>
      </View>

      <ChatComposer placeholder="Message Ol-ga…" onSubmit={send} maxLength={500} voice />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    ground: { backgroundColor: colors.chatGround },
    screen: { flex: 1, gap: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
    titleWrap: { alignItems: 'center' },
    wordmark: { fontFamily: fonts.bodyBold, fontSize: 21, fontWeight: semibold, color: colors.text },
    preview: { fontSize: 11, color: colors.muted, letterSpacing: 0.4 },
    thread: { flex: 1, marginHorizontal: -20 },
    threadContent: { gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
    // Prompts line up with Ol-ga's bubble (past her mark).
    prompts: { gap: 8, paddingLeft: 40 },
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
  });
