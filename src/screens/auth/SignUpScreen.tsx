import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { OtpEntry } from '../../components/OtpEntry';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { SocialSignInButton } from '../../components/SocialSignInButton';
import { MemberRecoveryUnavailableError } from '../../auth/memberSession';
import { isExpiredSession, isInvalidCode, NativeAuthError } from '../../auth/nativeAuthClient';
import { EntraProvider, isUserCancelledLogin } from '../../auth/useEntraLogin';
import { useAuth } from '../../context/AuthContext';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Step = 'email' | 'verifying' | 'otp' | 'name' | 'mobile' | 'registering';

// One continuous chat: email -> verify -> name -> mobile, all on this same
// screen. No screen transition after login — the user comes back to exactly
// where they started, and the conversation just continues.
export function SignUpScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { login, startEmail, submitEmailCode, resendEmailCode, cancelEmail, completeOnboarding, logOut, isAuthenticated } =
    useAuth();
  // Already signed in to Entra but no Olga member yet (e.g. restored session
  // whose member was removed) -> only name + mobile are needed, no new OTP.
  const [step, setStep] = useState<Step>(isAuthenticated ? 'name' : 'email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  // Verifying waits on the dev API, which can take up to a minute to wake
  // from a cold start; say so instead of looking stuck.
  const [slowVerify, setSlowVerify] = useState(false);
  useEffect(() => {
    if (step !== 'verifying') {
      setSlowVerify(false);
      return;
    }
    const timer = setTimeout(() => setSlowVerify(true), 5000);
    return () => clearTimeout(timer);
  }, [step]);
  const [codeLength, setCodeLength] = useState(8);
  // Ignores repeated taps while a sign-in is already running.
  const inProgress = useRef(false);

  async function signIn(options: { loginHint?: string; provider?: EntraProvider }, shown: string) {
    if (inProgress.current) return;
    inProgress.current = true;
    setEmail(shown);
    setStep('verifying');
    try {
      const existingMember = await login(options);
      // Existing members go straight in (the navigator switches to the app).
      if (!existingMember) setStep('name');
    } catch (error) {
      // Safe to log: AppAuth error codes/messages carry no code or token values.
      const err = error as { code?: string; message?: string };
      console.warn(`Sign-in did not complete (${err.code ?? 'no code'}): ${err.message ?? ''}`);
      setEmail('');
      setStep('email');
      if (!isUserCancelledLogin(error)) {
        Alert.alert('Sign-in failed', "Something went wrong signing you in. Please try again.");
      }
    } finally {
      inProgress.current = false;
    }
  }

  // Continue with Email: in-app code via Entra native auth for new and
  // existing customers alike; falls back to the Microsoft page only if the
  // tenant doesn't allow native auth yet.
  async function handleEmailSubmit(value: string) {
    if (inProgress.current) return;
    inProgress.current = true;
    setEmail(value);
    setStep('verifying');
    let result;
    try {
      result = await startEmail(value.trim());
    } catch (error) {
      setEmail('');
      setStep('email');
      Alert.alert(
        "Couldn't send a code",
        error instanceof NativeAuthError && error.code === 'network_error'
          ? 'Check your connection and try again.'
          : 'Something went wrong. Please try again.'
      );
      inProgress.current = false;
      return;
    }
    inProgress.current = false;
    if (result.mode === 'browser') {
      signIn({ loginHint: value }, value);
      return;
    }
    setCodeLength(result.codeLength);
    setStep('otp');
  }

  async function handleCodeSubmit(code: string) {
    try {
      const existingMember = await submitEmailCode(code);
      if (!existingMember) setStep('name');
    } catch (error) {
      if (isInvalidCode(error)) throw new Error("That code didn't work. Check it, or resend a new one.");
      if (isExpiredSession(error)) throw new Error('That code has expired. Tap Resend code for a new one.');
      if (error instanceof NativeAuthError && error.code === 'network_error') {
        throw new Error('No connection. Check your internet and try again.');
      }
      throw new Error('Something went wrong. Please try again.');
    }
  }

  async function handleResend() {
    try {
      setCodeLength(await resendEmailCode());
    } catch {
      throw new Error("Couldn't send a new code. Please try again.");
    }
  }

  function handleChangeEmail() {
    cancelEmail();
    setEmail('');
    setStep('email');
  }

  // Google / Apple go through the same Entra user flow (domain_hint), not a
  // direct provider SDK.
  function handleProvider(provider: EntraProvider) {
    signIn({ provider }, provider === 'google' ? 'Continue with Google' : 'Continue with Apple');
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
      if (error instanceof MemberRecoveryUnavailableError) {
        // Registered on another device / before a reinstall; retrying can't
        // help until the backend can look the member up, so sign out.
        Alert.alert(
          'Already registered',
          "This email or number already has an Ol-ga account, but signing back in on a new or reinstalled device isn't available yet. Please contact Ol-ga support."
        );
        await logOut();
        setName('');
        setEmail('');
        setStep('email');
        return;
      }
      setStep('mobile');
      Alert.alert('Could not create your profile', 'Please check your connection and try again.');
    }
  }

  return (
    <Screen>
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
        {step === 'verifying' && slowVerify && (
          <ChatBubble from="them" text="Still connecting — our server is waking up. This can take up to a minute…" />
        )}
        {step === 'otp' && <ChatBubble from="them" text="Enter the verification code sent to your email." />}

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
        <>
          <ChatComposer placeholder="you@example.com" keyboardType="email-address" onSubmit={handleEmailSubmit} />
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <SocialSignInButton provider="google" onPress={() => handleProvider('google')} />
          <SocialSignInButton provider="apple" onPress={() => handleProvider('apple')} />
        </>
      )}
      {step === 'verifying' && <Text style={styles.sub}>Signing you in…</Text>}
      {step === 'otp' && (
        <OtpEntry
          codeLength={codeLength}
          onSubmit={handleCodeSubmit}
          onResend={handleResend}
          onChangeEmail={handleChangeEmail}
        />
      )}
      {step === 'registering' && <Text style={styles.sub}>Setting up your profile…</Text>}
      {step === 'name' && <ChatComposer placeholder="Type your name…" onSubmit={handleNameSubmit} />}
      {step === 'mobile' && (
        <ChatComposer placeholder="+60 12 345 6789" keyboardType="phone-pad" onSubmit={handleMobileSubmit} />
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontFamily: fonts.headingExtraBold, fontWeight: '800', letterSpacing: 3, fontSize: 14, color: colors.text },
    eyebrow: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.muted,
      fontWeight: '700',
    },
    h1: { fontFamily: fonts.headingExtraBold, fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 8 },
    sub: { fontSize: 14, lineHeight: 20, color: colors.muted },
    chatStack: { gap: 10, marginTop: 6 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dividerText: { fontSize: 13, color: colors.muted },
  });
