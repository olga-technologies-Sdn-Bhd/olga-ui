import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { Profile } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { ChatBubble } from '../../components/ChatBubble';
import { ChatComposer } from '../../components/ChatComposer';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<HomeStackParamList, 'ProfileSetup'>;

type Step = 'loading' | 'unavailable' | 'headline' | 'summary' | 'saving' | 'done';

const HEADLINE_MAX = 240;
const SUMMARY_MAX = 2000;

// Ol-ga asks for the two things matches see before a Commit is accepted:
// headline, then summary. Same chat pattern as sign-up. Role has no agreed
// list yet, so it is sent back unchanged.
export function ProfileSetupScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { name } = useAuth();
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  const [step, setStep] = useState<Step>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    coreApi
      .getMyProfile()
      .then((loaded) => {
        if (!active) return;
        setProfile(loaded);
        setStep('headline');
      })
      .catch(() => {
        if (active) setStep('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  function answerHeadline(value: string) {
    setHeadline(value.slice(0, HEADLINE_MAX));
    setStep('summary');
  }

  async function answerSummary(value: string) {
    const next = value.slice(0, SUMMARY_MAX);
    setSummary(next);
    await save(headline ?? '', next);
  }

  async function save(nextHeadline: string, nextSummary: string) {
    if (!profile) return;
    setStep('saving');
    setFailed(false);
    try {
      // Full replace: every field goes back, including the ones not asked here.
      await coreApi.updateMyProfile(
        {
          display_name: profile.display_name ?? '',
          headline: nextHeadline || undefined,
          professional_summary: nextSummary || undefined,
          role_category: profile.role_category,
          visibility: profile.visibility,
        },
        profile.etag
      );
      setStep('done');
    } catch (e) {
      if (e instanceof ApiError) console.warn(`Profile update failed (${e.code}), correlation_id=${e.correlationId}`);
      setFailed(true);
      setStep('summary');
    }
  }

  const currentHeadline = profile?.headline?.trim();
  const currentSummary = profile?.professional_summary?.trim();
  const askedSummary = step === 'summary' || step === 'saving' || step === 'done';

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Profile" />

      <View style={styles.chatStack}>
        <ChatBubble
          from="them"
          text={`${firstName ? `${firstName}, let` : 'Let'} me help you set up your profile. Two quick questions, and your matches will know who they're meeting.`}
        />
        {step === 'loading' && <ChatBubble from="them" text="One moment while I find what you've told me so far…" />}
        {step === 'unavailable' && (
          <ChatBubble from="them" text="I'm having trouble reaching your profile right now. Please come back to this in a moment." />
        )}

        {profile && (
          <ChatBubble
            from="them"
            text={
              currentHeadline
                ? `First, your headline. Right now it says “${currentHeadline}”. Send me a new one, or keep it as it is.`
                : 'First, your headline. What is your role, and what do you work on?'
            }
          />
        )}
        {headline !== null && <ChatBubble from="me" text={headline} />}

        {askedSummary && (
          <ChatBubble
            from="them"
            text={
              currentSummary
                ? `Lovely. Now a little about your work. I have “${currentSummary.replace(/[.!?]+$/, "")}”. Send me a new version, or keep it.`
                : 'Lovely. Now tell me a little about your work: what you do, and who you help.'
            }
          />
        )}
        {summary !== null && <ChatBubble from="me" text={summary} />}

        {failed && <ChatBubble from="them" text="That needs another try. Please check your connection and send it again." />}
        {step === 'saving' && <ChatBubble from="them" text="Saving that for you…" />}
        {step === 'done' && (
          <ChatBubble from="them" text="All set. That is what your matches will see. Your name stays private until you both accept a Commit." />
        )}
      </View>

      {step === 'headline' && (
        <>
          <ChatComposer placeholder="Your role and what you work on" onSubmit={answerHeadline} />
          {currentHeadline && <Button label="Keep my headline" variant="ghost" small onPress={() => answerHeadline(currentHeadline)} />}
        </>
      )}
      {step === 'summary' && (
        <>
          <ChatComposer placeholder="What you do and who you help" onSubmit={answerSummary} />
          {currentSummary && <Button label="Keep my summary" variant="ghost" small onPress={() => answerSummary(currentSummary)} />}
        </>
      )}
      {step === 'saving' && <Text style={styles.sub}>Updating your profile…</Text>}
      {step === 'done' && <Button label="Done" onPress={() => navigation.goBack()} />}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chatStack: { gap: 10, marginTop: 6 },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted },
  });
