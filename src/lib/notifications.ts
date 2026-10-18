import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Task } from '@/types/task';

export const ALARM_CHANNEL_ID = 'alarms';
export const REMINDER_CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Task alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alarm.wav',
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Task reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
  });
  return requested.granted;
}

function timeParts(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

function dateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** Cancels any notifications previously scheduled for this task. */
export async function cancelTaskAlarms(task: Pick<Task, 'notificationIds'>): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    task.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id))
  );
}

/** Schedules notifications for a task based on its repeat type, returning the new notification ids. */
export async function scheduleTaskAlarms(task: Task): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const channelId = task.alarmEnabled ? ALARM_CHANNEL_ID : REMINDER_CHANNEL_ID;
  const baseContent: Notifications.NotificationContentInput = {
    title: task.title,
    body: task.description || 'Tap to view your task',
    data: { taskId: task.id, alarmEnabled: task.alarmEnabled },
    sound: task.alarmEnabled ? 'alarm.wav' : 'default',
    priority: Notifications.AndroidNotificationPriority.MAX,
    interruptionLevel: task.alarmEnabled ? 'timeSensitive' : 'active',
  };

  const ids: string[] = [];

  switch (task.repeat) {
    case 'once': {
      const { hour, minute } = timeParts(task.time);
      const { year, month, day } = dateParts(task.date);
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (date.getTime() <= Date.now()) break;
      const id = await Notifications.scheduleNotificationAsync({
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
      });
      ids.push(id);
      break;
    }
    case 'daily': {
      const { hour, minute } = timeParts(task.time);
      const id = await Notifications.scheduleNotificationAsync({
        content: baseContent,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId },
      });
      ids.push(id);
      break;
    }
    case 'weekly': {
      const { hour, minute } = timeParts(task.time);
      for (const weekday of task.weekdays) {
        const id = await Notifications.scheduleNotificationAsync({
          content: baseContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour,
            minute,
            channelId,
          },
        });
        ids.push(id);
      }
      break;
    }
    case 'hourly': {
      const seconds = Math.max(1, task.intervalHours) * 3600;
      const id = await Notifications.scheduleNotificationAsync({
        content: baseContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: true,
          channelId,
        },
      });
      ids.push(id);
      break;
    }
  }

  return ids;
}

/** Cancels existing alarms for the task and schedules fresh ones reflecting its current fields. */
export async function rescheduleTaskAlarms(task: Task): Promise<string[]> {
  await cancelTaskAlarms(task);
  return scheduleTaskAlarms(task);
}
