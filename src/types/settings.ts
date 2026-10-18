export interface AppSettings {
  /** Minutes to snooze for when the ringing alarm's "Snooze" button is tapped. */
  defaultSnoozeMinutes: number;
  /** Whether new tasks default to having the ringing alarm enabled. */
  defaultAlarmEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultSnoozeMinutes: 9,
  defaultAlarmEnabled: true,
};
