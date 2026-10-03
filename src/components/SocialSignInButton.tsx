import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { EntraProvider } from '../auth/useEntraLogin';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  provider: EntraProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

// Branded "Continue with Google / Apple" buttons, styled per each provider's
// sign-in button guidelines (Google Identity branding; Apple HIG "Sign in with
// Apple"). Text uses the platform system font (Roboto / San Francisco), as
// both guidelines ask. Sign-in itself still goes through Entra (domain_hint),
// not a provider SDK.
const PALETTE = {
  google: {
    light: { bg: '#FFFFFF', border: '#747775', text: '#1F1F1F' },
    dark: { bg: '#131314', border: '#8E918F', text: '#E3E3E3' },
  },
  apple: {
    light: { bg: '#000000', border: '#000000', text: '#FFFFFF' },
    dark: { bg: '#FFFFFF', border: '#FFFFFF', text: '#000000' },
  },
} as const;

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </Svg>
  );
}

function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={18} height={22} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

export function SocialSignInButton({ provider, onPress, loading, disabled }: Props) {
  const { scheme } = useTheme();
  const palette = PALETTE[provider][scheme];
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 48,
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 20,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        pressed: { opacity: 0.85 },
        disabled: { opacity: 0.5 },
        label: { fontSize: 16, fontWeight: '500', color: palette.text },
        logo: { width: 22, alignItems: 'center' },
      }),
    [palette]
  );

  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || loading) && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          <View style={styles.logo}>{provider === 'google' ? <GoogleLogo /> : <AppleLogo color={palette.text} />}</View>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
