import { useEffect, useMemo, useState } from 'react';
import { Flag, LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '../api/client';
import { coreApi } from '../api/core';
import type { MemberReportCategory, MemberReportRequest } from '../api/types';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { BottomSheet, SheetChoices } from './BottomSheet';
import { Button } from './Button';

const CATEGORIES: { value: MemberReportCategory; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'OTHER', label: 'Other' },
];

const MAX_NOTE = 2000;

type Props = {
  visible: boolean;
  onClose: () => void;
  // Who: a member, or (anonymous) the sender of a Commit sent to me.
  target: { memberId: string } | { commitRequestId: string };
  // Their name if it's known (connected); otherwise their headline, or nothing.
  who?: string | null;
  // What the report is about, if more than their profile (member reports only).
  resource?: { type: 'REQUEST' | 'MESSAGE'; id: string };
};

type Step = 'pick' | 'sent' | 'already';

// SAF-01: report a member (from a match card, their profile before a Commit,
// Nearby, or a conversation). The same sheet everywhere: why, an optional
// note, send. They're never told; an open report isn't sent twice.
export function ReportMemberSheet({ visible, onClose, target, who, resource }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('pick');
  const [category, setCategory] = useState<MemberReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStep('pick');
    setCategory(null);
    setNote('');
    setError(null);
  }, [visible]);

  async function send() {
    if (!category || busy) return;
    setBusy(true);
    setError(null);
    const description = note.trim();
    const body: MemberReportRequest = {
      category,
      ...(description ? { description } : {}),
      ...(resource ? { resource_type: resource.type, resource_id: resource.id } : {}),
    };
    try {
      if ('commitRequestId' in target) await coreApi.reportCommitSender(target.commitRequestId, { category, ...(description ? { description } : {}) });
      else await coreApi.reportMember(target.memberId, body);
      setStep('sent');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'REPORT_ALREADY_OPEN') setStep('already');
      else if (code === 'PROFILE_NOT_FOUND') setError('This member is no longer on Ol-ga.');
      else if (code === 'COMMIT_NOT_FOUND') setError('This Commit is no longer available.');
      else if (code === 'MEMBER_REPORT_INVALID') setError('Check the report and try again.');
      else setError("Couldn't send the report. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = step === 'pick' ? (who ? `Report ${who}` : 'Report this member') : step === 'sent' ? 'Thanks for telling us' : 'Already reported';
  const subtitle =
    step === 'pick'
      ? "They won't know you reported them."
      : step === 'sent'
      ? "We'll review it. They won't be told who reported them."
      : "You've already reported this member, and we're reviewing it.";

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      {step === 'pick' ? (
        <>
          <SheetChoices options={CATEGORIES} value={category} onChange={setCategory} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.muted}
            style={styles.note}
            multiline
            maxLength={MAX_NOTE}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Send report" loading={busy} disabled={!category} onPress={send} />
        </>
      ) : (
        <Button label="Done" onPress={onClose} />
      )}
    </BottomSheet>
  );
}

// A quiet link (Report, or Block with its own icon): on match cards, profiles
// and incoming Commits.
export function ReportMemberLink({ onPress, label = 'Report', icon: Icon = Flag }: { onPress: () => void; label?: string; icon?: LucideIcon }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon size={13} color={colors.muted} strokeWidth={2} />
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // White, like every text box in the app.
    note: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 48,
      color: colors.text,
      fontSize: 14,
      textAlignVertical: 'top',
    },
    error: { fontSize: 13, color: colors.danger },
    link: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingVertical: 2 },
    linkText: { fontSize: 12, color: colors.muted },
    pressed: { opacity: 0.6 },
  });
