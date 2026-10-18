import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

/**
 * Registers this device's Expo push token against the signed-in user, so the server-side
 * scheduled function (see supabase/functions/send-due-notifications) can reach this device
 * even when the app isn't open. No-ops gracefully until the project has an EAS projectId
 * (i.e. until `eas init`/`eas build` has been run at least once).
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return; // Expo push tokens aren't issued on web.

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId configured yet — skipping push token registration.');
    return;
  }

  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        device_name: Constants.deviceName ?? Platform.OS,
      },
      { onConflict: 'user_id,expo_push_token' }
    );
    if (error) console.warn('[push] Failed to save push token:', error.message);
  } catch (e) {
    console.warn('[push] Failed to register push token:', e);
  }
}
