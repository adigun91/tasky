import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { FORM_MAX_WIDTH, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const contentStyle = useResponsiveContentStyle(FORM_MAX_WIDTH);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const result =
      mode === 'sign-in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === 'sign-up') {
      setInfo('Account created! Check your email to confirm, then sign in.');
      setMode('sign-in');
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.content, contentStyle]}>
        <View style={styles.logo}>
          <Ionicons name="checkmark-done-circle" size={48} color="#4F46E5" />
        </View>
        <Text style={styles.title}>{mode === 'sign-in' ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-in'
            ? 'Sign in to sync your tasks across devices.'
            : 'Sign up to back up and sync your tasks.'}
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!info && <Text style={styles.infoText}>{info}</Text>}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchModeButton}
          onPress={() => {
            setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'));
            setError(null);
            setInfo(null);
          }}>
          <Text style={styles.switchModeText}>
            {mode === 'sign-in'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center' },
  content: { padding: 24, gap: 4 },
  logo: { alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  infoText: { color: '#059669', fontSize: 13, marginTop: 10 },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchModeButton: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  switchModeText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
});
