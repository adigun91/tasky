import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/context/ProfileContext';
import { FORM_MAX_WIDTH, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';
import { AVATAR_COLORS } from '@/types/profile';

export default function ProfileScreen() {
  const { profile, updateProfile } = useProfile();
  const contentStyle = useResponsiveContentStyle(FORM_MAX_WIDTH);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const [saving, setSaving] = useState(false);

  const initial = name.trim().charAt(0).toUpperCase() || 'Y';

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() || 'You', email: email.trim(), avatarColor });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, contentStyle]}>
        <View style={styles.avatarPreview}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Avatar color</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((color) => (
            <Pressable
              key={color}
              style={[styles.colorSwatch, { backgroundColor: color }]}
              onPress={() => setAvatarColor(color)}>
              {avatarColor === color && <Ionicons name="checkmark" size={18} color="#fff" />}
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </Pressable>
      </ScrollView>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  avatarPreview: { alignItems: 'center', marginBottom: 4 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
