import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Ban, BriefcaseBusiness, Camera, ChevronRight, Eye, Hash, LogOut, LucideIcon, Mail, Moon, Phone, Search, Server } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { coreApi } from '../../api/core';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { BottomSheet, SheetGroup, SheetOption } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { APP_ENV, TEAM_TOOLS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../context/LiveContext';
import { clearPictureError, PictureSource, pickMyPicture, removeMyPicture, useMyPicture } from '../../profile/myPicture';
import { HomeStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { showDialog } from '../../components/DialogHost';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

// Not in the client prototype — built from the same cards, eyebrow labels and
// `.switch` toggle used on the Filters screen so it reads as the same app.
export function ProfileScreen({ navigation }: Props) {
  const { name, email, mobile, memberId, logOut } = useAuth();
  const { colors, scheme, setScheme } = useTheme();
  const { intentText } = useLive();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);
  // The server only ever returns the masked number, so that is what a
  // reinstall, a new device or a fresh sign-in shows.
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const picture = useMyPicture(memberId);
  const [photoSheet, setPhotoSheet] = useState(false);
  const photoBusy = picture.busy !== null;

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    coreApi
      .getMyProfile()
      .then((profile) => {
        if (active) setPhoneHint(profile.phone_hint ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [memberId]);

  function openPhotoSheet() {
    if (photoBusy) return;
    clearPictureError();
    setPhotoSheet(true);
  }

  // iOS can't present the picker while the sheet is still sliding away.
  function choosePhoto(source: PictureSource) {
    setPhotoSheet(false);
    setTimeout(() => pickMyPicture(source), Platform.OS === 'ios' ? 500 : 0);
  }

  function confirmRemovePhoto() {
    setPhotoSheet(false);
    setTimeout(
      () =>
        showDialog('Remove your photo?', 'Your initials will show instead.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeMyPicture() },
        ]),
      Platform.OS === 'ios' ? 400 : 0
    );
  }

  function confirmLogOut() {
    showDialog('Log out?', 'You can sign back in any time with the same email.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ], { icon: LogOut });
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} title="Account" />

      <View style={styles.identity}>
        <Pressable
          onPress={openPhotoSheet}
          accessibilityRole="button"
          accessibilityLabel={picture.hasPicture ? 'Change your photo' : 'Add a photo'}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar
            own
            initials={(name ?? '?').slice(0, 1).toUpperCase()}
            size="xl"
            previewUri={picture.preview}
            busy={photoBusy}
          />
          <View style={styles.cameraBadge}>
            <Camera size={14} color={colors.white} strokeWidth={2.2} />
          </View>
        </Pressable>
        <Text style={styles.h2}>{name ?? 'Your profile'}</Text>
        {email && <Text style={styles.sub}>{email}</Text>}
        {picture.busy === 'uploading' && <Text style={styles.sub}>Uploading your photo…</Text>}
        {picture.busy === 'processing' && <Text style={styles.sub}>Checking your photo…</Text>}
        {picture.busy === 'removing' && <Text style={styles.sub}>Removing your photo…</Text>}
        {picture.slow && !photoBusy && <Text style={styles.sub}>Your photo is still being prepared. It will appear shortly.</Text>}
        {picture.error && (
          <Text style={styles.photoError} accessibilityLiveRegion="polite">
            {picture.error}
          </Text>
        )}
      </View>

      <BottomSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Your photo" subtitle="Other members see it next to your name once you are connected.">
        <SheetGroup>
          <SheetOption label="Take a photo" onPress={() => choosePhoto('camera')} />
          <SheetOption label="Choose from your photos" onPress={() => choosePhoto('library')} />
          {picture.hasPicture && <SheetOption label="Remove photo" danger onPress={confirmRemovePhoto} />}
        </SheetGroup>
      </BottomSheet>

      <Text style={styles.sectionTitle}>Your introduction</Text>
      <Card style={styles.list}>
        <Pressable
          onPress={() => navigation.navigate('ProfileSetup')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <RowIcon icon={BriefcaseBusiness} styles={styles} colors={colors} />
          <View style={styles.rowText}>
            <Text style={styles.label}>Your work and About you</Text>
            <Text style={styles.sub}>What relevant people see first</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={() => navigation.navigate('HowYouAppear')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <RowIcon icon={Eye} styles={styles} colors={colors} />
          <View style={styles.rowText}>
            <Text style={styles.label}>How you appear</Text>
            <Text style={styles.sub}>What people see before you both accept</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        {/* Intent is edited in the Go Live filter. */}
        <Pressable
          onPress={() => navigation.getParent()?.navigate('GoLiveTab', { screen: 'Filters' })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <RowIcon icon={Search} styles={styles} colors={colors} />
          <View style={styles.rowText}>
            <Text style={styles.label}>What you're looking for</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {intentText.trim() || 'Add what you’re looking for, so I can find relevant people'}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.list}>
        <Row icon={Mail} label="Email" value={email} styles={styles} colors={colors} />
        <View style={styles.divider} />
        <Row icon={Phone} label="Mobile" value={mobile ?? phoneHint} styles={styles} colors={colors} />
        <View style={styles.divider} />
        <Row icon={Hash} label="Member ID" value={memberId} styles={styles} colors={colors} small />
        {/* Which backend this build talks to. For the team only: production
            builds never show it. */}
        {TEAM_TOOLS && (
          <>
            <View style={styles.divider} />
            <Row icon={Server} label="Environment" value={APP_ENV} styles={styles} colors={colors} small />
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Safety</Text>
      <Card style={styles.list}>
        <Pressable
          onPress={() => navigation.navigate('BlockedMembers')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <RowIcon icon={Ban} styles={styles} colors={colors} />
          <View style={styles.rowText}>
            <Text style={styles.label}>Blocked members</Text>
            <Text style={styles.sub}>See who you blocked, or unblock them</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <Card style={styles.row}>
        <RowIcon icon={Moon} styles={styles} colors={colors} />
        <View style={styles.rowText}>
          <Text style={styles.label}>Dark mode</Text>
          <Text style={styles.sub}>{scheme === 'dark' ? 'On' : 'Off'} — applies across the app</Text>
        </View>
        <ToggleSwitch on={scheme === 'dark'} onToggle={() => setScheme(scheme === 'dark' ? 'light' : 'dark')} />
      </Card>

      <Button label="Log out" variant="secondary" loading={loggingOut} onPress={confirmLogOut} style={styles.logout} />
      <Pressable
        onPress={() => navigation.navigate('DeleteAccount')}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
      >
        <Text style={styles.deleteLabel}>Delete account</Text>
      </Pressable>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
  styles,
  colors,
  small,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  small?: boolean;
}) {
  return (
    <View style={styles.row}>
      <RowIcon icon={icon} styles={styles} colors={colors} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, small && styles.valueSmall]} numberOfLines={1} ellipsizeMode="middle">
        {value ?? '—'}
      </Text>
    </View>
  );
}

// A menu row's leading icon, in the brand colour (like a settings list).
function RowIcon({ icon: Icon, styles, colors }: { icon: LucideIcon; styles: ReturnType<typeof makeStyles>; colors: ThemeColors }) {
  return (
    <View style={styles.rowIcon}>
      <Icon size={19} color={colors.accent} strokeWidth={2} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  identity: { alignItems: 'center', gap: 6, marginTop: 4 },
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: semibold, color: colors.text, marginTop: 8 },
  sub: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoError: { fontSize: 12, color: colors.danger, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold, marginTop: 10 },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  rowText: { flex: 1 },
  rowIcon: { width: 22, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
  // Takes the rest of the row, so the label stays beside its icon.
  value: { flex: 1, fontSize: 13, color: colors.muted, textAlign: 'right' },
  valueSmall: { fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 34 },
  logout: { marginTop: 8 },
  delete: { alignSelf: 'center', paddingVertical: 10 },
  deleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.danger },
});
