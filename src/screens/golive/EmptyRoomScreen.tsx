import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'EmptyRoom'>;

export function EmptyRoomScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent } = useLive();
  const [notifyRequested, setNotifyRequested] = useState(false);

  return (
    <Screen>
      <View style={styles.topline}>
        <Text style={styles.h2Header}>{activeEvent?.name ?? 'This room'}</Text>
        {typeof activeEvent?.liveCount === 'number' && <Pill label={`● ${activeEvent.liveCount} live`} tone="green" />}
      </View>

      <View style={styles.center}>
        <Avatar initials="…" size="lg" />
        <Text style={styles.h2}>It's still quiet in here</Text>
        <Text style={styles.sub}>
          {typeof activeEvent?.liveCount === 'number' ? `${activeEvent.liveCount} people are live and none` : 'Nobody'}{' '}
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
  h2Header: { fontSize: 22, fontWeight: '800', color: colors.text },
  center: { alignItems: 'center', marginTop: 40, gap: 10 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  actions: { width: '100%', gap: 10, marginTop: 20 },
});
