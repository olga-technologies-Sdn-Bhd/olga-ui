import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

// Runs once, right after a fresh Entra login. Name and mobile number are
// plain profile fields here, not auth data — see [[olga-auth-decision]].
export function OnboardingScreen({}: Props) {
  const { completeOnboarding } = useAuth();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');

  function handleContinue() {
    completeOnboarding(name.trim(), mobile.trim());
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>Almost there</Text>
        <Text style={styles.h1}>Tell us a bit about you</Text>
        <Text style={styles.sub}>Your email's verified — just a couple more details before you're in.</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Your name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Shree" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.codeButton}>
              <Text style={styles.codeText}>+60 ▾</Text>
            </View>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="12 345 6789"
              keyboardType="phone-pad"
              style={styles.phoneInput}
            />
          </View>
        </View>
      </Card>

      <Button label="Continue" onPress={handleContinue} disabled={!name.trim() || !mobile.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 7 },
  sub: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 8 },
  card: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.white, fontSize: 16 },
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
  phoneInput: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.white, fontSize: 16 },
});
