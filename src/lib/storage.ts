import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '@/types/task';
import { DEFAULT_PROFILE, type UserProfile } from '@/types/profile';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

const TASKS_KEY = 'tasky:tasks';
const PROFILE_KEY = 'tasky:profile';
const SETTINGS_KEY = 'tasky:settings';

export async function loadTasks(): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(TASKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return DEFAULT_PROFILE;
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
