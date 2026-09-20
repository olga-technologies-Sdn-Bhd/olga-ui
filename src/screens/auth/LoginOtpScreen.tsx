import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OtpInput } from '../../components/OtpInput';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginOtp'>;

export function LoginOtpScreen({ route, navigation }: Props) {
  const { verifyOtp, requestLoginOtp } = useAuth();
  const { phone } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleVerify() {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await verifyOtp(otp);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    await requestLoginOtp(phone);
    setResent(true);
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} rightLabel="Verification" />

      <View>
        <Text style={styles.eyebrow}>Check your phone</Text>
        <Text style={styles.h1}>Enter your OTP</Text>
        <Text style={styles.sub}>We sent a 6-digit code to {phone}.</Text>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={styles.eyebrow}>6-digit code</Text>
        <OtpInput value={otp} onChange={setOtp} />
        <View style={styles.resendRow}>
          <Text style={styles.hint}>Didn't receive it?</Text>
          <Button label={resent ? 'Sent' : 'Resend OTP'} variant="ghost" small onPress={handleResend} disabled={resent} />
        </View>
      </Card>

      <Button label="Verify & log in" onPress={handleVerify} loading={loading} disabled={otp.length !== 6} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 7 },
  sub: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 8 },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  hint: { fontSize: 12, color: colors.muted },
});
