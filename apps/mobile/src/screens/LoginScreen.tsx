import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser } from '@hrm/shared-types';
import { login } from '../api/client';
import { getDatabase } from '../db/database';
import {
  saveSession,
  setCachedWorkLocation,
  setGeofencePolicy,
} from '../db/session-repository';

interface LoginScreenProps {
  onLoggedIn: (user: AuthUser) => void;
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [email, setEmail] = useState('employee@cmsnbd.com');
  const [password, setPassword] = useState('password');
  const [tenant, setTenant] = useState('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await getDatabase();
      const response = await login({
        email: email.trim(),
        password,
        tenantSubdomain: tenant.trim(),
      });
      await saveSession({ accessToken: response.accessToken, user: response.user });
      await setGeofencePolicy('allow_with_warning');
      await setCachedWorkLocation({
        name: 'Sydney HQ',
        lat: -33.8688,
        lng: 151.2093,
        radiusM: 200,
      });
      onLoggedIn(response.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.eyebrow}>Employee ESS</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        Offline clock-in works without connectivity. Actions queue locally and sync when
        you&apos;re back online.
      </Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#64748b"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#64748b"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        placeholder="Tenant subdomain"
        placeholderTextColor="#64748b"
        value={tenant}
        onChangeText={setTenant}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => void handleLogin()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: '#fca5a5',
    marginBottom: 8,
  },
});
