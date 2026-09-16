import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { OtpInput } from '../../components/OtpInput';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

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
    <Screen>
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

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontWeight: '800', letterSpacing: 3, fontSize: 14, color: colors.text },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 8 },
  sub: { fontSize: 14, lineHeight: 20, color: colors.muted },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 4 },
  chatStack: { gap: 10, marginTop: 6 },
  loginLink: { alignItems: 'center', marginTop: 8 },
  linkText: { color: colors.brand, fontWeight: '800' },
});
