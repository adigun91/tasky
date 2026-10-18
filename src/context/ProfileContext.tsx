import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadProfile, loadSettings, saveProfile, saveSettings } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_PROFILE, type UserProfile } from '@/types/profile';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

interface ProfileContextValue {
  profile: UserProfile;
  settings: AppSettings;
  loading: boolean;
  updateProfile: (input: Partial<UserProfile>) => Promise<void>;
  updateSettings: (input: Partial<AppSettings>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { cloudEnabled, user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ── Local-only mode: unchanged AsyncStorage-backed behavior. ──
  useEffect(() => {
    if (cloudEnabled) return;
    (async () => {
      const [storedProfile, storedSettings] = await Promise.all([loadProfile(), loadSettings()]);
      setProfile(storedProfile);
      setSettings(storedSettings);
      setLoading(false);
    })();
  }, [cloudEnabled]);

  // ── Cloud mode: profile/settings rows are auto-created on signup (see supabase/schema.sql). ──
  useEffect(() => {
    if (!cloudEnabled || authLoading) return;
    if (!user) {
      (async () => {
        setProfile(DEFAULT_PROFILE);
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      })();
      return;
    }
    (async () => {
      const [{ data: profileRow }, { data: settingsRow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRow) {
        setProfile({
          name: profileRow.name,
          email: profileRow.email,
          avatarColor: profileRow.avatar_color,
        });
      }
      if (settingsRow) {
        setSettings({
          defaultSnoozeMinutes: settingsRow.default_snooze_minutes,
          defaultAlarmEnabled: settingsRow.default_alarm_enabled,
        });
      }
      setLoading(false);
    })();
  }, [cloudEnabled, authLoading, user]);

  const updateProfile = useCallback(
    async (input: Partial<UserProfile>) => {
      const next = { ...profile, ...input };
      setProfile(next);
      if (cloudEnabled && user) {
        await supabase
          .from('profiles')
          .update({ name: next.name, email: next.email, avatar_color: next.avatarColor })
          .eq('id', user.id);
        return;
      }
      await saveProfile(next);
    },
    [profile, cloudEnabled, user]
  );

  const updateSettings = useCallback(
    async (input: Partial<AppSettings>) => {
      const next = { ...settings, ...input };
      setSettings(next);
      if (cloudEnabled && user) {
        await supabase
          .from('settings')
          .update({
            default_snooze_minutes: next.defaultSnoozeMinutes,
            default_alarm_enabled: next.defaultAlarmEnabled,
          })
          .eq('user_id', user.id);
        return;
      }
      await saveSettings(next);
    },
    [settings, cloudEnabled, user]
  );

  const value = useMemo(
    () => ({ profile, settings, loading, updateProfile, updateSettings }),
    [profile, settings, loading, updateProfile, updateSettings]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
