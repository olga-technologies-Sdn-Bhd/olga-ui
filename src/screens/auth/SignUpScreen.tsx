import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AutoImageCarousel } from '../../components/AutoImageCarousel';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ApiError } from '../../api/client';
import { isUserCancelledLogin } from '../../auth/useEntraLogin';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const SIGNUP_BG_IMAGES = [
  require('../../assets/onboarding/signup-bg-1.jpg'),
  require('../../assets/onboarding/signup-bg-2.jpg'),
  require('../../assets/onboarding/signup-bg-3.jpg'),
  require('../../assets/onboarding/signup-bg-4.jpg'),
  require('../../assets/onboarding/signup-bg-5.jpg'),
];

type Step = 'email' | 'verifying' | 'name' | 'mobile' | 'registering';

// One continuous chat: email -> verify -> name -> mobile, all on this same
// screen. No screen transition after login — the user comes back to exactly
// where they started, and the conversation just continues.
export function SignUpScreen() {
  const { login, completeOnboarding } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');

  async function handleEmailSubmit(value: string) {
    setEmail(value);
    setStep('verifying');
    try {
      await login(value);
      setStep('name');
    } catch (error) {
      setEmail('');
      setStep('email');
      if (!isUserCancelledLogin(error)) {
        Alert.alert('Sign-in failed', 'Something went wrong verifying your email. Please try again.');
      }
    }
  }

  function handleNameSubmit(value: string) {
    setName(value);
    setStep('mobile');
  }

  async function handleMobileSubmit(value: string) {
    // Olga.Core only accepts E.164 (+<country code><number>).
    const e164 = value.replace(/[\s\-().]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      Alert.alert('Check your number', 'Please include your country code, e.g. +60 12 345 6789.');
      return;
    }
    setMobile(value);
    setStep('registering');
    try {
      await completeOnboarding(name.trim(), e164);
    } catch (error) {
      setMobile('');
      setStep('mobile');
      const conflict = error instanceof ApiError && error.status === 409;
      Alert.alert(
        conflict ? 'Already registered' : 'Could not create your profile',
        conflict
          ? 'This email or number is already linked to an Ol-ga account.'
          : 'Please check your connection and try again.'
      );
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
        <Text style={styles.logo}>Ol-ga</Text>
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
          text="Hi — I'm Ol-ga. What's your email? We'll send a one-time code there — already have an account? Same email signs you back in."
        />
        {email !== '' && <ChatBubble from="me" text={email} />}

        {step === 'verifying' && <ChatBubble from="them" text="One sec — verifying that…" />}

        {(step === 'name' || step === 'mobile' || step === 'registering') && (
          <>
            <ChatBubble from="them" text="Login or signup successful! Two quick things and you're in the room." />
            <ChatBubble from="them" text="What should I call you?" />
          </>
        )}
        {name !== '' && <ChatBubble from="me" text={name} />}

        {(step === 'mobile' || step === 'registering') && (
          <ChatBubble
            from="them"
            text={`Good to meet you, ${name}. What's the best number to reach you on? We'll only use it for meetup coordination — never spam.`}
          />
        )}
        {mobile !== '' && <ChatBubble from="me" text={mobile} />}
      </View>

      {step === 'email' && (
        <ChatComposer placeholder="you@example.com" keyboardType="email-address" onSubmit={handleEmailSubmit} />
      )}
      {step === 'verifying' && <Text style={styles.sub}>Opening secure sign-in…</Text>}
      {step === 'registering' && <Text style={styles.sub}>Setting up your profile…</Text>}
      {step === 'name' && <ChatComposer placeholder="Type your name…" onSubmit={handleNameSubmit} />}
      {step === 'mobile' && (
        <ChatComposer placeholder="+60 12 345 6789" keyboardType="phone-pad" onSubmit={handleMobileSubmit} />
      )}
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
