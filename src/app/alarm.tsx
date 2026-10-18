import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '@/context/TasksContext';
import { useProfile } from '@/context/ProfileContext';
import { ALARM_CHANNEL_ID } from '@/lib/notifications';
import { useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';

const VIBRATION_PATTERN = [0, 500, 250, 500, 250, 500];

export default function AlarmScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { getTask, toggleTaskComplete } = useTasks();
  const { settings } = useProfile();
  const contentStyle = useResponsiveContentStyle(420);
  const task = taskId ? getTask(taskId) : undefined;
  const snoozeMinutes = settings.defaultSnoozeMinutes;
  const player = useAudioPlayer(require('../../assets/sounds/alarm.wav'));

  useEffect(() => {
    // expo-audio's AudioPlayer is a native shared object meant to be configured via property setters.
    // eslint-disable-next-line react-hooks/immutability
    player.loop = true;
    player.play();
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      player.pause();
      Vibration.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAlarm() {
    player.pause();
    Vibration.cancel();
    router.replace('/');
  }

  async function completeAlarm() {
    player.pause();
    Vibration.cancel();
    if (task && !task.completed) {
      await toggleTaskComplete(task.id);
    }
    router.replace('/');
  }

  async function snoozeAlarm() {
    player.pause();
    Vibration.cancel();
    if (task && Platform.OS !== 'web') {
      const date = new Date(Date.now() + snoozeMinutes * 60 * 1000);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: task.description || 'Snoozed alarm',
          data: { taskId: task.id, alarmEnabled: true },
          sound: 'alarm.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          interruptionLevel: 'timeSensitive',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: ALARM_CHANNEL_ID,
        },
      });
    }
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.center, contentStyle]}>
        <Ionicons name="alarm" size={96} color="#fff" />
        <Text style={styles.time}>{new Date().toLocaleTimeString()}</Text>
        <Text style={styles.title}>{task?.title ?? 'Task reminder'}</Text>
        {!!task?.description && <Text style={styles.description}>{task.description}</Text>}
      </View>
      <View style={[styles.actions, contentStyle]}>
        <Pressable style={styles.snoozeButton} onPress={snoozeAlarm}>
          <Text style={styles.snoozeText}>Snooze {snoozeMinutes} min</Text>
        </Pressable>
        {!!task && (
          <Pressable style={styles.completeButton} onPress={completeAlarm}>
            <Text style={styles.completeText}>Mark complete</Text>
          </Pressable>
        )}
        <Pressable style={styles.stopButton} onPress={stopAlarm}>
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>

      <Footer light />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4F46E5',
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  center: { alignItems: 'center', gap: 12, marginTop: 40 },
  time: { fontSize: 20, color: '#E0E7FF', fontWeight: '500' },
  title: { fontSize: 28, color: '#fff', fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 16, color: '#E0E7FF', textAlign: 'center' },
  actions: { gap: 14 },
  snoozeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  snoozeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  completeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  completeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stopButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  stopText: { color: '#4F46E5', fontSize: 16, fontWeight: '700' },
});
