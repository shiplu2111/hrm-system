import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser, WorkplaceIncidentRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { ApiError } from '../api/client';
import { getEmployee } from '../api/engagement-api';
import {
  listEmployeeIncidents,
  reportEmployeeIncident,
} from '../api/health-safety-api';
import { ensureLocationForClockIn } from '../permissions/location-permission';

interface IncidentReportScreenProps {
  user: AuthUser;
  onBack: () => void;
}

const INCIDENT_TYPES = [
  'near_miss',
  'injury',
  'first_aid',
  'slip_trip',
  'equipment_damage',
  'environmental',
  'other',
] as const;

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export function IncidentReportScreen({ user, onBack }: IncidentReportScreenProps) {
  const { t } = useAppTranslation();
  const employeeId = user.employeeId;
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<WorkplaceIncidentRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [incidentType, setIncidentType] = useState<(typeof INCIDENT_TYPES)[number]>('near_miss');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('medium');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const profile = await getEmployee(employeeId);
      const rows = await listEmployeeIncidents(profile.companyId);
      setFeed(rows);
    } catch (err) {
      Alert.alert(
        t('healthSafety.loadFailedTitle'),
        err instanceof ApiError ? err.message : t('errors.unknownError'),
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!employeeId || !location.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      const gps = await ensureLocationForClockIn(t);
      if (gps) {
        gpsLat = gps.lat;
        gpsLng = gps.lng;
        if (!location.trim()) {
          setLocation(t('healthSafety.gpsLocationFallback'));
        }
      }

      const created = await reportEmployeeIncident(employeeId, {
        incidentType,
        severity,
        location: location.trim() || t('healthSafety.gpsLocationFallback'),
        occurredAt: new Date().toISOString(),
        description: description.trim(),
        gpsLat,
        gpsLng,
      });
      setFeed((current) => [created, ...current]);
      setSent(true);
      setShowForm(false);
      setDescription('');
      setLocation('');
    } catch (err) {
      Alert.alert(
        t('healthSafety.submitFailedTitle'),
        err instanceof ApiError ? err.message : t('errors.unknownError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('healthSafety.title')}</Text>
        <Text style={styles.subtitle}>{t('healthSafety.subtitle')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {sent ? <Text style={styles.success}>{t('healthSafety.reportSent')}</Text> : null}

          <Pressable
            style={styles.toggleButton}
            onPress={() => {
              setShowForm((open) => !open);
              setSent(false);
            }}
          >
            <Text style={styles.toggleButtonText}>
              {showForm ? t('common.cancel') : t('healthSafety.reportIncident')}
            </Text>
          </Pressable>

          {showForm ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t('healthSafety.incidentType')}</Text>
              <View style={styles.chips}>
                {INCIDENT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, incidentType === type && styles.chipSelected]}
                    onPress={() => setIncidentType(type)}
                  >
                    <Text style={styles.chipText}>{t(`healthSafety.types.${type}`)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{t('healthSafety.severity')}</Text>
              <View style={styles.chips}>
                {SEVERITIES.map((level) => (
                  <Pressable
                    key={level}
                    style={[styles.chip, severity === level && styles.chipSelected]}
                    onPress={() => setSeverity(level)}
                  >
                    <Text style={styles.chipText}>{t(`healthSafety.severities.${level}`)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{t('healthSafety.location')}</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder={t('healthSafety.locationPlaceholder')}
                placeholderTextColor="#64748b"
                style={styles.input}
              />

              <Text style={styles.label}>{t('healthSafety.description')}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('healthSafety.descriptionPlaceholder')}
                placeholderTextColor="#64748b"
                multiline
                style={[styles.input, styles.textarea]}
              />

              <Pressable
                style={[
                  styles.button,
                  (submitting || !description.trim()) && styles.buttonDisabled,
                ]}
                disabled={submitting || !description.trim()}
                onPress={() => void submit()}
              >
                <Text style={styles.buttonText}>
                  {submitting ? t('common.submitting') : t('healthSafety.submitReport')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('healthSafety.recentIncidents')}</Text>
          {feed.length === 0 ? (
            <Text style={styles.muted}>{t('healthSafety.emptyFeed')}</Text>
          ) : (
            feed.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardMeta}>
                  {item.incidentNumber} · {t(`healthSafety.types.${item.incidentType}`)}
                </Text>
                <Text style={styles.cardTitle}>{item.location}</Text>
                <Text style={styles.cardBody}>{item.description}</Text>
                {item.regulatorReportRequired ? (
                  <Text style={styles.regulator}>{t('healthSafety.regulatorRequired')}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  back: { color: '#38bdf8', marginBottom: 8 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  content: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#f8fafc',
    marginTop: 4,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  cardMeta: { color: '#64748b', fontSize: 11 },
  cardTitle: { color: '#f8fafc', fontWeight: '600', marginTop: 4 },
  cardBody: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  regulator: { color: '#fbbf24', fontSize: 11, marginTop: 6 },
  muted: { color: '#64748b', marginTop: 8 },
  success: { color: '#4ade80', marginBottom: 8 },
  toggleButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleButtonText: { color: '#fff', fontWeight: '600' },
  form: { marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    backgroundColor: '#1e293b',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSelected: { backgroundColor: '#0c4a6e', borderColor: '#38bdf8' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
  button: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
