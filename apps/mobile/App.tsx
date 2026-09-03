import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AuthUser } from '@hrm/shared-types';
import { SyncStatusIndicator } from './src/components/SyncStatusIndicator';
import { SyncStatusProvider } from './src/context/SyncStatusContext';
import { getDatabase } from './src/db/database';
import { clearSession, getStoredUser } from './src/db/session-repository';
import { ClockScreen } from './src/screens/ClockScreen';
import { LoginScreen } from './src/screens/LoginScreen';

function AuthenticatedApp({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <SyncStatusProvider employeeId={user.employeeId}>
      <View style={styles.authenticated}>
        <SyncStatusIndicator />
        <View style={styles.content}>
          <ClockScreen user={user} onLogout={onLogout} />
        </View>
      </View>
    </SyncStatusProvider>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function boot() {
      await getDatabase();
      const stored = await getStoredUser();
      setUser(stored);
      setBooting(false);
    }
    void boot();
  }, []);

  const handleLogout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {user ? (
          <AuthenticatedApp user={user} onLogout={() => void handleLogout()} />
        ) : (
          <LoginScreen onLoggedIn={setUser} />
        )}
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  boot: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authenticated: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
  },
});
