import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiResponse } from '@hrm/shared-types';

const placeholderResponse: ApiResponse<{ message: string }> = {
  data: { message: 'HRM Mobile is running' },
};

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>HRM Platform</Text>
      <Text style={styles.title}>Mobile App Boilerplate</Text>
      <Text style={styles.subtitle}>
        Offline-first employee app will live here. Shared types are wired via
        @hrm/shared-types.
      </Text>
      <Text style={styles.code}>{placeholderResponse.data.message}</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  code: {
    color: '#e2e8f0',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: 'monospace',
  },
});
