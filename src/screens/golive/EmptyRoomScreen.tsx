import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'EmptyRoom'>;

export function EmptyRoomScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent, matches } = useLive();
  const [notifyRequested, setNotifyRequested] = useState(false);

  // A new search (e.g. after "Widen my filter") found someone: show them.
  const found = (matches?.length ?? 0) > 0;
  useEffect(() => {
    if (found) navigation.replace('LiveMatches');
  }, [found, navigation]);

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} />
      <View style={styles.topline}>
        <Text style={styles.h2Header}>{activeEvent?.name ?? 'This room'}</Text>
        {typeof activeEvent?.liveCount === 'number' && <Pill label={`● ${activeEvent.liveCount} live`} tone="positive" />}
      </View>

      <View style={styles.center}>
        <Avatar initials="…" size="lg" />
        <Text style={styles.h2}>It's still quiet in here</Text>
        <Text style={styles.sub}>
          {typeof activeEvent?.liveCount === 'number'
            ? `${activeEvent.liveCount} ${activeEvent.liveCount === 1 ? 'person is' : 'people are'} live and none`
            : 'Nobody'}{' '}
          match your filter yet. We'll tell you the moment someone does.
        </Text>
        <View style={styles.actions}>
          <Button
            label={notifyRequested ? "We'll notify you" : 'Notify me'}
            onPress={() => setNotifyRequested(true)}
            disabled={notifyRequested}
          />
          <Button label="Widen my filter" variant="secondary" onPress={() => navigation.navigate('Filters')} />
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2Header: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
  center: { alignItems: 'center', marginTop: 40, gap: 10 },
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  actions: { width: '100%', gap: 10, marginTop: 20 },
});
