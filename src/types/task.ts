export type RepeatType = 'once' | 'hourly' | 'daily' | 'weekly';

/** 1 = Sunday ... 7 = Saturday, matching expo-notifications' weekday convention. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Task {
  id: string;
  title: string;
  description: string;
  /** ISO date (yyyy-MM-dd). Only meaningful for 'once' tasks. */
  date: string;
  /** 24h time (HH:mm). Used by 'once', 'daily', and 'weekly' tasks. */
  time: string;
  repeat: RepeatType;
  /** Selected weekdays, only used when repeat === 'weekly'. */
  weekdays: Weekday[];
  /** Repeat interval in hours, only used when repeat === 'hourly'. */
  intervalHours: number;
  alarmEnabled: boolean;
  /** Scheduled notification identifiers, kept so they can be cancelled/rescheduled. */
  notificationIds: string[];
  createdAt: string;
  completed: boolean;
  /** False when the task belongs to another account and is shared with this user. */
  isOwnedByMe?: boolean;
  /** True when a shared task grants this account edit permission. */
  canEditSharedTask?: boolean;
}

export type TaskInput = Omit<Task, 'id' | 'notificationIds' | 'createdAt' | 'completed'>;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Sun',
  2: 'Mon',
  3: 'Tue',
  4: 'Wed',
  5: 'Thu',
  6: 'Fri',
  7: 'Sat',
};
