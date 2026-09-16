import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { requestLoginOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await requestLoginOtp(phone.trim());
      navigation.navigate('LoginOtp', { phone: `+60 ${phone.trim()}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.navigate('SignUp')} rightLabel="OL-GA" />

      <View>
        <Text style={styles.eyebrow}>Welcome back</Text>
        <Text style={styles.h1}>Log in</Text>
        <Text style={styles.sub}>Enter the mobile number linked to your OL-GA account.</Text>
      </View>

      <Card style={{ gap: 9 }}>
        <Text style={styles.eyebrow}>Mobile number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.codeButton}>
            <Text style={styles.codeText}>+60 ▾</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="12 345 6789"
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <Text style={styles.hint}>We'll send you a 6-digit verification code.</Text>
      </Card>

      <Button label="Send OTP" onPress={handleSendOtp} loading={loading} disabled={!phone.trim()} />

      <View style={styles.footer}>
        <Text style={styles.sub}>
          New to OL-GA?{' '}
          <Text style={styles.linkText} onPress={() => navigation.navigate('SignUp')}>
            Create account
          </Text>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 7 },
  sub: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 8 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  codeButton: {
    width: 66,
    borderWidth: 1,
    borderColor: 'rgba(109,74,255,0.22)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontWeight: '700', color: colors.text },
  input: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.white, fontSize: 16 },
  hint: { fontSize: 12, color: colors.muted },
  footer: { alignItems: 'center', marginTop: 8 },
  linkText: { color: colors.brand, fontWeight: '800' },
});
