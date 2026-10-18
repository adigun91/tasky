import { Alert, ScrollView, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/context/AuthContext';
import { FORM_MAX_WIDTH, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';
import { useTasks } from '@/context/TasksContext';
import { useState } from 'react';

export default function SettingsScreen() {
  const { settings, updateSettings } = useProfile();
  const { cloudEnabled, user, signOut } = useAuth();
  const { importLocalTasks } = useTasks();
  const contentStyle = useResponsiveContentStyle(FORM_MAX_WIDTH);
  const [importing, setImporting] = useState(false);

  function confirmImport() {
    Alert.alert(
      'Back up this device’s tasks?',
      'Local tasks will be copied to your cloud account. The local copy is cleared only after the cloud import succeeds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Back up tasks',
          onPress: async () => {
            setImporting(true);
            const result = await importLocalTasks();
            setImporting(false);
            if (result.error) Alert.alert('Backup failed', result.error);
            else Alert.alert('Backup complete', `${result.count} task${result.count === 1 ? '' : 's'} backed up.`);
          },
        },
      ]
    );
  }

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, contentStyle]}>
        <View style={styles.card}>
        <Text style={styles.label}>Default snooze length</Text>
        <Text style={styles.helperText}>
          How long the &quot;Snooze&quot; button on a ringing alarm delays it by.
        </Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() =>
              updateSettings({
                defaultSnoozeMinutes: Math.max(1, settings.defaultSnoozeMinutes - 1),
              })
            }>
            <Ionicons name="remove" size={20} color="#4F46E5" />
          </Pressable>
          <Text style={styles.stepperValue}>
            {settings.defaultSnoozeMinutes} {settings.defaultSnoozeMinutes === 1 ? 'min' : 'mins'}
          </Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() =>
              updateSettings({
                defaultSnoozeMinutes: Math.min(60, settings.defaultSnoozeMinutes + 1),
              })
            }>
            <Ionicons name="add" size={20} color="#4F46E5" />
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Alarm by default</Text>
            <Text style={styles.helperText}>
              New tasks start with the ringing alarm enabled instead of a quiet notification.
            </Text>
          </View>
          <Switch
            value={settings.defaultAlarmEnabled}
            onValueChange={(value) => updateSettings({ defaultAlarmEnabled: value })}
          />
        </View>
      </View>

      {cloudEnabled && (
        <View style={styles.card}>
          <Text style={styles.label}>Account</Text>
          <Text style={styles.helperText}>Signed in as {user?.email}</Text>
          <Text style={styles.helperText}>
            Tasks are stored in your account and restore automatically when you sign in again.
          </Text>
          <Pressable style={styles.backupButton} onPress={confirmImport} disabled={importing}>
            <Ionicons name="cloud-upload-outline" size={18} color="#18543E" />
            <Text style={styles.backupText}>{importing ? 'Backing up…' : 'Back up local tasks'}</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      )}
      </ScrollView>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 90,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E5F2EA',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backupText: { color: '#18543E', fontSize: 14, fontWeight: '600' },
  signOutText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
});
