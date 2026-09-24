import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AutoImageCarousel } from '../../components/AutoImageCarousel';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { isUserCancelledLogin } from '../../auth/useEntraLogin';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

const SIGNUP_BG_IMAGES = [
  require('../../assets/onboarding/signup-bg-1.png'),
  require('../../assets/onboarding/signup-bg-2.png'),
  require('../../assets/onboarding/signup-bg-3.png'),
  require('../../assets/onboarding/signup-bg-4.png'),
  require('../../assets/onboarding/signup-bg-5.png'),
];

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Microsoft owns the OTP entirely on its hosted page — we only collect the
  // email here (as a login_hint) and open the browser. No in-app OTP input.
  async function handleEmailSubmit(value: string) {
    setEmail(value);
    setLoading(true);
    try {
      await login(value);
      navigation.replace('Onboarding');
    } catch (error) {
      setEmail('');
      if (!isUserCancelledLogin(error)) {
        Alert.alert('Sign-in failed', 'Something went wrong verifying your email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      background={
        <>
          <AutoImageCarousel images={SIGNUP_BG_IMAGES} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          <LinearGradient
            colors={['rgba(10,8,16,0.15)', 'rgba(10,8,16,0.55)', 'rgba(10,8,16,0.92)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      }
    >
      <View style={styles.topline}>
        <Text style={styles.logo}>OL-GA</Text>
        <Text style={styles.eyebrow}>Join the room</Text>
      </View>

      <Pill label="Made for real-world connection" tone="active" />
      <Text style={styles.h1}>Meet people who actually matter.</Text>
      <Text style={styles.sub}>
        A faster way to find the right conversations at events — without awkward networking.
      </Text>

      <View style={styles.chatStack}>
        <ChatBubble
          from="them"
          text="Hi — I'm OL-GA. What's your email? We'll send a one-time code there — already have an account? Same email signs you back in."
        />
        {email !== '' && <ChatBubble from="me" text={email} />}
      </View>

      {email === '' && (
        <ChatComposer placeholder="you@example.com" keyboardType="email-address" onSubmit={handleEmailSubmit} />
      )}
      {loading && <Text style={styles.sub}>Opening secure sign-in…</Text>}
    </Screen>
  );
}

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(8,6,12,0.35)' },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontWeight: '800', letterSpacing: 3, fontSize: 14, color: colors.white, ...textShadow },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '700',
    ...textShadow,
  },
  h1: { fontSize: 28, fontWeight: '800', color: colors.white, marginTop: 8, ...textShadow },
  sub: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.82)', ...textShadow },
  chatStack: { gap: 10, marginTop: 6 },
});
