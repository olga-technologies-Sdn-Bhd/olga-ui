import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

type Props = {
  codeLength: number;
  // Resolves when verified; rejects with a message to show inline.
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangeEmail: () => void;
};

const RESEND_COOLDOWN_S = 30;

// In-app email OTP entry. One field (not one box per digit) so paste and the
// keyboard's one-time-code suggestion fill it in a single step. The code lives
// only in this component's state: never stored or logged.
export function OtpEntry({ codeLength, onSubmit, onResend, onChangeEmail }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(value: string) {
    if (busy || value.length !== codeLength) return; // no duplicate submits
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, codeLength);
    setCode(digits);
    setError(null);
    if (digits.length === codeLength) submit(digits);
  }

  async function resend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setCode('');
    try {
      await onResend();
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a new code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={code}
        onChangeText={handleChange}
        autoFocus
        editable={!busy}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={codeLength}
        placeholder={'•'.repeat(codeLength)}
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Verification code"
      />
      {busy && (
        <View style={styles.row}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.sub}>Signing you in…</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Verify" onPress={() => submit(code)} disabled={busy || code.length !== codeLength} />
      <View style={styles.links}>
        <Pressable onPress={resend} disabled={busy || cooldown > 0} hitSlop={8}>
          <Text style={[styles.link, (busy || cooldown > 0) && styles.linkDisabled]}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
        <Pressable onPress={onChangeEmail} disabled={busy} hitSlop={8}>
          <Text style={[styles.link, busy && styles.linkDisabled]}>Use a different email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.surface2,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sub: { fontSize: 14, color: colors.muted },
    error: { fontSize: 14, color: colors.danger },
    links: { flexDirection: 'row', justifyContent: 'space-between' },
    link: { fontSize: 14, fontWeight: '600', color: colors.text },
    linkDisabled: { color: colors.muted },
  });
