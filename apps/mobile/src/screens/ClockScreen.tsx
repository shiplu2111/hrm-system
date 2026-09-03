import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AttendanceEventType, AuthUser } from '@hrm/shared-types';
import { useSyncStatus } from '../context/SyncStatusContext';
import { recordAttendanceAction } from '../attendance/attendance-actions';
import { getGeofencePolicy } from '../db/session-repository';
import { requestCameraForFaceVerify } from '../permissions/camera-permission';
import { ensureLocationForClockIn } from '../permissions/location-permission';

interface ClockScreenProps {
  user: AuthUser;
  onLogout: () => void;
}

const phaseLabels = {
  not_started: 'Ready to clock in',
  working: 'On the clock',
  on_break: 'On break',
  completed: 'Shift completed',
} as const;

export function ClockScreen({ user, onLogout }: ClockScreenProps) {
  const employeeId = user.employeeId;
  const [acting, setActing] = useState(false);
  const { phase, todayEvents, isOnline, syncNow, reload } = useSyncStatus();

  async function performAction(
    eventType: AttendanceEventType,
    needsLocation: boolean,
  ) {
    if (!employeeId) {
      Alert.alert('Not linked', 'Your user account is not linked to an employee profile.');
      return;
    }

    setActing(true);
    try {
      let location = null as Awaited<ReturnType<typeof ensureLocationForClockIn>>;
      if (needsLocation) {
        location = await ensureLocationForClockIn();
        if (location === null) {
          const policy = await getGeofencePolicy();
          if (policy === 'block') {
            return;
          }
        }
      }

      await recordAttendanceAction({
        employeeId,
        eventType,
        location,
      });
      reload();
      if (isOnline) {
        await syncNow();
      }
    } catch (e) {
      Alert.alert('Could not record punch', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActing(false);
    }
  }

  async function handleFaceVerify() {
    const granted = await requestCameraForFaceVerify();
    if (granted) {
      Alert.alert(
        'Face verify',
        'Face recognition attendance will connect to your company device policy. For now, use Clock In after verification.',
      );
    }
  }

  const busy = acting;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Attendance</Text>
          <Text style={styles.title}>{phaseLabels[phase]}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, (phase !== 'not_started' || busy) && styles.disabled]}
          disabled={phase !== 'not_started' || busy}
          onPress={() => void performAction('clock_in', true)}
        >
          <Text style={styles.primaryButtonText}>Clock In</Text>
          <Text style={styles.hint}>Requests location on first use</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (phase !== 'working' || busy) && styles.disabled]}
          disabled={phase !== 'working' || busy}
          onPress={() => void performAction('break_start', false)}
        >
          <Text style={styles.secondaryButtonText}>Start Break</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (phase !== 'on_break' || busy) && styles.disabled]}
          disabled={phase !== 'on_break' || busy}
          onPress={() => void performAction('break_end', false)}
        >
          <Text style={styles.secondaryButtonText}>End Break</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryButton, (phase !== 'working' || busy) && styles.disabled]}
          disabled={phase !== 'working' || busy}
          onPress={() => void performAction('clock_out', true)}
        >
          <Text style={styles.primaryButtonText}>Clock Out</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={() => void handleFaceVerify()}>
          <Text style={styles.ghostButtonText}>Verify with face (camera)</Text>
          <Text style={styles.hint}>Optional — falls back if camera denied</Text>
        </Pressable>
      </View>

      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Today (local queue)</Text>
        {todayEvents.length === 0 ? (
          <Text style={styles.timelineEmpty}>No punches yet</Text>
        ) : (
          todayEvents.map((event) => (
            <View key={event.localId} style={styles.timelineRow}>
              <Text style={styles.timelineType}>{event.eventType.replace('_', ' ')}</Text>
              <Text style={styles.timelineMeta}>
                {new Date(event.timestampDevice).toLocaleTimeString()} · {event.status}
              </Text>
            </View>
          ))
        )}
      </View>

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="none">
          <ActivityIndicator color="#38bdf8" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: '#0f172a',
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  eyebrow: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  email: { color: '#94a3b8', marginTop: 4, fontSize: 13 },
  logout: { color: '#38bdf8', fontWeight: '600' },
  actions: { gap: 10, marginBottom: 24 },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 17 },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: { color: '#e2e8f0', fontWeight: '600', fontSize: 16 },
  ghostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: { color: '#94a3b8', fontWeight: '600' },
  hint: { color: '#64748b', fontSize: 11, marginTop: 4 },
  disabled: { opacity: 0.45 },
  timeline: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  timelineTitle: { color: '#e2e8f0', fontWeight: '700', marginBottom: 8 },
  timelineEmpty: { color: '#64748b' },
  timelineRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  timelineType: {
    color: '#f8fafc',
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  timelineMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
});
