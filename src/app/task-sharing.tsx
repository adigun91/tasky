import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FORM_MAX_WIDTH, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';

type Permission = 'read' | 'edit';
interface TaskShare {
  id: string;
  shared_with_user_id: string;
  shared_with_email: string;
  permission: Permission;
}

export default function TaskSharingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cloudEnabled } = useAuth();
  const contentStyle = useResponsiveContentStyle(FORM_MAX_WIDTH);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('edit');
  const [shares, setShares] = useState<TaskShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!id || !cloudEnabled) {
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase.rpc('list_task_shares', { p_task_id: id });
    if (loadError) setError(loadError.message);
    else setShares((data ?? []) as TaskShare[]);
    setLoading(false);
  }, [id, cloudEnabled]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadShares(), 0);
    return () => clearTimeout(timeout);
  }, [loadShares]);

  async function handleShare() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!id || !normalizedEmail || saving) return;
    setSaving(true);
    setError(null);
    const { error: shareError } = await supabase.rpc('share_task_with_email', {
      p_task_id: id,
      p_email: normalizedEmail,
      p_permission: permission,
    });
    setSaving(false);
    if (shareError) setError(shareError.message);
    else {
      setEmail('');
      await loadShares();
      Alert.alert('Task shared', `Shared with ${normalizedEmail}.`);
    }
  }

  function handleRemove(share: TaskShare) {
    Alert.alert('Remove access', `Stop sharing this task with ${share.shared_with_email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error: removeError } = await supabase
            .from('task_shares')
            .delete()
            .eq('id', share.id);
          if (removeError) setError(removeError.message);
          else await loadShares();
        },
      },
    ]);
  }

  return (
    <View style={styles.outer}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]}>
        <Text style={styles.title}>Share this task</Text>
        <Text style={styles.description}>
          Invite someone with a Tasky account. Shared changes sync between your devices.
        </Text>
        {!cloudEnabled && <Text style={styles.error}>Cloud sharing is not configured for this build.</Text>}
        <Text style={styles.label}>Account email</Text>
        <TextInput
          style={styles.input}
          placeholder="person@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={cloudEnabled && !saving}
        />
        <Text style={styles.label}>Access</Text>
        <View style={styles.segmented}>
          {(['read', 'edit'] as const).map((value) => (
            <Pressable
              key={value}
              style={[styles.segment, permission === value && styles.segmentActive]}
              onPress={() => setPermission(value)}>
              <Text style={[styles.segmentText, permission === value && styles.segmentTextActive]}>
                {value === 'read' ? 'View only' : 'Can edit'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primaryButton, (!email.trim() || saving || !cloudEnabled) && styles.disabled]}
          disabled={!email.trim() || saving || !cloudEnabled}
          onPress={handleShare}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Share task</Text>}
        </Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.divider} />
        <Text style={styles.label}>People with access</Text>
        {loading ? (
          <ActivityIndicator color="#4F46E5" />
        ) : shares.length === 0 ? (
          <Text style={styles.empty}>Only you can access this task right now.</Text>
        ) : (
          shares.map((share) => (
            <View key={share.id} style={styles.shareRow}>
              <View style={styles.shareIcon}>
                <Ionicons name="person-outline" size={18} color="#276749" />
              </View>
              <View style={styles.shareDetails}>
                <Text style={styles.shareEmail}>{share.shared_with_email}</Text>
                <Text style={styles.sharePermission}>
                  {share.permission === 'edit' ? 'Can edit' : 'View only'}
                </Text>
              </View>
              <Pressable accessibilityLabel={`Remove ${share.shared_with_email}`} onPress={() => handleRemove(share)}>
                <Ionicons name="close-circle-outline" size={23} color="#B42318" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F7F8F5' },
  content: { padding: 20, gap: 10, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#17231F' },
  description: { fontSize: 14, color: '#59665F', lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#34443C', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#D6DDD8', borderRadius: 8, padding: 13, backgroundColor: '#fff', fontSize: 15 },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, borderWidth: 1, borderColor: '#D6DDD8', borderRadius: 8, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  segmentActive: { borderColor: '#216E52', backgroundColor: '#E5F2EA' },
  segmentText: { color: '#526159', fontWeight: '600' },
  segmentTextActive: { color: '#18543E' },
  primaryButton: { marginTop: 8, backgroundColor: '#216E52', borderRadius: 8, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#B42318', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#DDE3DE', marginVertical: 12 },
  empty: { color: '#66736C', fontSize: 14, paddingVertical: 8 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E4E9E5' },
  shareIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5F2EA', alignItems: 'center', justifyContent: 'center' },
  shareDetails: { flex: 1, gap: 3 },
  shareEmail: { color: '#17231F', fontWeight: '600', fontSize: 14 },
  sharePermission: { color: '#69766E', fontSize: 12 },
});