import { useState } from 'react';
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
import { useAppTranslation } from '@hrm/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useSyncStatus } from '../context/SyncStatusContext';
import { recordAttendanceAction } from '../attendance/attendance-actions';
import { getGeofencePolicy } from '../db/session-repository';
import { requestCameraForFaceVerify } from '../permissions/camera-permission';
import { ensureLocationForClockIn } from '../permissions/location-permission';

interface ClockScreenProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onOpenHelp: () => void;
  onOpenKudos: () => void;
  onOpenSafety: () => void;
}

export function ClockScreen({
  user,
  onLogout,
  onOpenNotifications,
  onOpenHelp,
  onOpenKudos,
  onOpenSafety,
}: ClockScreenProps) {
  const { t } = useAppTranslation();
  const employeeId = user.employeeId;
  const [acting, setActing] = useState(false);
  const { phase, todayEvents, isOnline, syncNow, reload } = useSyncStatus();

  async function performAction(
    eventType: AttendanceEventType,
    needsLocation: boolean,
  ) {
    if (!employeeId) {
      Alert.alert(t('alerts.notLinkedTitle'), t('alerts.notLinkedBody'));
      return;
    }

    setActing(true);
    try {
      let location = null as Awaited<ReturnType<typeof ensureLocationForClockIn>>;
      if (needsLocation) {
        location = await ensureLocationForClockIn(t);
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
      Alert.alert(
        t('alerts.recordPunchTitle'),
        e instanceof Error ? e.message : t('common.unknownError'),
      );
    } finally {
      setActing(false);
    }
  }

  async function handleFaceVerify() {
    const granted = await requestCameraForFaceVerify(t);
    if (granted) {
      Alert.alert(t('alerts.faceVerifyTitle'), t('alerts.faceVerifyBody'));
    }
  }

  const busy = acting;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t('attendance.title')}</Text>
          <Text style={styles.title}>{t(`attendance.phase.${phase}`)}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <LanguageSwitcher />
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onOpenSafety} hitSlop={8}>
            <Text style={styles.notificationsLink}>{t('healthSafety.nav')}</Text>
          </Pressable>
          <Pressable onPress={onOpenKudos} hitSlop={8}>
            <Text style={styles.notificationsLink}>{t('engagement.nav')}</Text>
          </Pressable>
          <Pressable onPress={onOpenHelp} hitSlop={8}>
            <Text style={styles.notificationsLink}>{t('nav.help')}</Text>
          </Pressable>
          <Pressable onPress={onOpenNotifications} hitSlop={8}>
            <Text style={styles.notificationsLink}>{t('notifications.title')}</Text>
          </Pressable>
          <Pressable onPress={onLogout}>
            <Text style={styles.logout}>{t('common.signOut')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, (phase !== 'not_started' || busy) && styles.disabled]}
          disabled={phase !== 'not_started' || busy}
          onPress={() => void performAction('clock_in', true)}
        >
          <Text style={styles.primaryButtonText}>{t('dashboard.clockInAction')}</Text>
          <Text style={styles.hint}>{t('attendance.locationHint')}</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (phase !== 'working' || busy) && styles.disabled]}
          disabled={phase !== 'working' || busy}
          onPress={() => void performAction('break_start', false)}
        >
          <Text style={styles.secondaryButtonText}>{t('dashboard.startBreak')}</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (phase !== 'on_break' || busy) && styles.disabled]}
          disabled={phase !== 'on_break' || busy}
          onPress={() => void performAction('break_end', false)}
        >
          <Text style={styles.secondaryButtonText}>{t('dashboard.endBreak')}</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryButton, (phase !== 'working' || busy) && styles.disabled]}
          disabled={phase !== 'working' || busy}
          onPress={() => void performAction('clock_out', true)}
        >
          <Text style={styles.primaryButtonText}>{t('dashboard.clockOutAction')}</Text>
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={() => void handleFaceVerify()}>
          <Text style={styles.ghostButtonText}>{t('attendance.faceVerify')}</Text>
          <Text style={styles.hint}>{t('attendance.faceVerifyHint')}</Text>
        </Pressable>
      </View>

      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>{t('attendance.todayQueue')}</Text>
        {todayEvents.length === 0 ? (
          <Text style={styles.timelineEmpty}>{t('attendance.noPunches')}</Text>
        ) : (
          todayEvents.map((event) => (
            <View key={event.localId} style={styles.timelineRow}>
              <Text style={styles.timelineType}>
                {t(`attendance.event.${event.eventType}`)}
              </Text>
              <Text style={styles.timelineMeta}>
                {new Date(event.timestampDevice).toLocaleTimeString()} ·{' '}
                {t(`queue.status.${event.status}`)}
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
  headerActions: { alignItems: 'flex-end', gap: 8 },
  notificationsLink: { color: '#e2e8f0', fontWeight: '600' },
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
