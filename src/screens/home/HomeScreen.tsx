import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { coreApi, CoreEvent } from '../../api/core';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EventHero } from '../../components/EventHero';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { MainTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

// Matches the prototype's pre-filled sample intent on the Home screen.
const SAMPLE_INTENT = 'Find telco / GLC distribution partners for an AI workforce platform';

export function HomeScreen({ navigation }: Props) {
  const { name } = useAuth();
  const [intent, setIntent] = useState(SAMPLE_INTENT);
  const [draft, setDraft] = useState(SAMPLE_INTENT);
  const [editing, setEditing] = useState(false);
  const [nextEvent, setNextEvent] = useState<CoreEvent | null>(null);

  useEffect(() => {
    coreApi
      .getEvents()
      .then((events) => setNextEvent(events[0] ?? null))
      .catch(() => setNextEvent(null));
  }, []);

  function handleSave() {
    if (!draft.trim()) return;
    setIntent(draft.trim());
    setEditing(false);
  }

  return (
    <Screen>
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>Home</Text>
          <Text style={styles.h2}>Welcome{name ? `, ${name}` : ''}</Text>
        </View>
        <Avatar initials={(name ?? '?').slice(0, 1).toUpperCase()} size="sm" />
      </View>

      <Card soft>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>Your intent</Text>
        {editing ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TextInput value={draft} onChangeText={setDraft} style={styles.input} multiline />
            <Button label="Save intent" variant="secondary" small onPress={handleSave} disabled={!draft.trim()} />
          </View>
        ) : (
          <>
            <Text style={styles.h3}>{intent}</Text>
            <Button
              label="Edit intent"
              variant="ghost"
              small
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
              onPress={() => {
                setDraft(intent);
                setEditing(true);
              }}
            />
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>How OL-GA works</Text>
      <View style={{ gap: 10 }}>
        <Card style={styles.row}>
          <Avatar initials="1" size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={styles.h3}>Go Live when you arrive</Text>
            <Text style={styles.sub}>You stay invisible until you choose to be seen.</Text>
          </View>
        </Card>
        <Card style={styles.row}>
          <Avatar initials="2" size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={styles.h3}>Choose who you want to meet</Text>
            <Text style={styles.sub}>Filters shape who you see while you're live.</Text>
          </View>
        </Card>
      </View>

      {nextEvent && (
        <>
          <Text style={styles.sectionTitle}>Coming up</Text>
          <EventHero
            title={nextEvent.name}
            subtitle={[nextEvent.startsAt, nextEvent.venue].filter(Boolean).join(' · ')}
            topLeft={
              typeof nextEvent.liveCount === 'number' ? <Pill label={`● ${nextEvent.liveCount} going`} tone="green" /> : undefined
            }
          >
            <Button
              label="View event"
              variant="secondary"
              small
              style={{ alignSelf: 'flex-start', marginTop: 14 }}
              onPress={() => navigation.navigate('EventsTab')}
            />
          </EventHero>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
    fontSize: 14,
    minHeight: 44,
  },
});
