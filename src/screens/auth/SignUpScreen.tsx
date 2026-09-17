import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AutoImageCarousel } from '../../components/AutoImageCarousel';
import { Button } from '../../components/Button';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { OtpInput } from '../../components/OtpInput';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
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

type Step = 'name' | 'phone' | 'otp';

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  function handleNameSubmit(value: string) {
    setName(value);
    setStep('phone');
  }

  function handlePhoneSubmit(value: string) {
    setPhone(value);
    setStep('otp');
  }

  async function handleContinue() {
    setLoading(true);
    try {
      await signUp(name, phone);
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
        <ChatBubble from="them" text="Hi — I'm OL-GA. Two quick questions and you're in." />
        <ChatBubble from="them" text="What should I call you?" />
        {name !== '' && <ChatBubble from="me" text={name} />}

        {step === 'phone' && (
          <ChatBubble from="them" text={`Nice to meet you, ${name}. What's your mobile number?`} />
        )}
        {phone !== '' && <ChatBubble from="me" text={phone} />}
      </View>

      {step === 'name' && <ChatComposer placeholder="Type your name…" onSubmit={handleNameSubmit} />}
      {step === 'phone' && (
        <ChatComposer placeholder="+60 12 345 6789" keyboardType="phone-pad" onSubmit={handlePhoneSubmit} />
      )}

      {step === 'otp' && (
        <>
          <Text style={styles.sectionTitle}>Verification</Text>
          <OtpInput value={otp} onChange={setOtp} />
          <Text style={styles.sub}>Code sent to {phone}.</Text>

          <View style={{ gap: 10, marginTop: 6 }}>
            <Button label="Continue" onPress={handleContinue} loading={loading} disabled={otp.length !== 6} />
          </View>
        </>
      )}

      <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
        <Text style={styles.sub}>
          Already have an account? <Text style={styles.linkText}>Log in</Text>
        </Text>
      </Pressable>
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
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '700',
    marginTop: 4,
    ...textShadow,
  },
  chatStack: { gap: 10, marginTop: 6 },
  loginLink: { alignItems: 'center', marginTop: 8 },
  linkText: { color: colors.brand2, fontWeight: '800' },
});
