import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser, EmployeeKudosRecord, EmployeeRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { ApiError } from '../api/client';
import {
  createEmployeeKudos,
  getEmployee,
  listCompanyEmployees,
  listKudos,
} from '../api/engagement-api';

interface KudosScreenProps {
  user: AuthUser;
  onBack: () => void;
}

export function KudosScreen({ user, onBack }: KudosScreenProps) {
  const { t } = useAppTranslation();
  const employeeId = user.employeeId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<EmployeeKudosRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [toEmployeeId, setToEmployeeId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setError(t('errors.notLinked'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await getEmployee(employeeId);
      const [kudosRows, employeeRows] = await Promise.all([
        listKudos(profile.companyId),
        listCompanyEmployees(profile.companyId),
      ]);
      setFeed(kudosRows);
      setEmployees(
        employeeRows.filter(
          (emp) => emp.id !== employeeId && emp.employmentStatus === 'active',
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadKudos'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitKudos = async () => {
    if (!employeeId || !toEmployeeId || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createEmployeeKudos(employeeId, {
        toEmployeeId,
        message: message.trim(),
      });
      setFeed((current) => [created, ...current]);
      setSent(true);
      setShowForm(false);
      setToEmployeeId('');
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.sendKudos'));
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
        <Text style={styles.title}>{t('engagement.recognitionTitle')}</Text>
        <Text style={styles.subtitle}>{t('engagement.recognitionSubtitle')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {sent ? (
            <Text style={styles.success}>{t('engagement.kudosSent')}</Text>
          ) : null}

          <Pressable
            style={styles.toggleButton}
            onPress={() => {
              setShowForm((open) => !open);
              setSent(false);
            }}
          >
            <Text style={styles.toggleButtonText}>
              {showForm ? t('common.cancel') : t('engagement.giveKudos')}
            </Text>
          </Pressable>

          {showForm ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t('engagement.recipient')}</Text>
              <ScrollView style={styles.picker} nestedScrollEnabled>
                {employees.map((emp) => {
                  const selected = emp.id === toEmployeeId;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                      onPress={() => setToEmployeeId(emp.id)}
                    >
                      <Text style={styles.pickerName}>{emp.fullName}</Text>
                      {emp.designation?.name ? (
                        <Text style={styles.pickerMeta}>{emp.designation.name}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                {employees.length === 0 ? (
                  <Text style={styles.muted}>{t('engagement.noRecipients')}</Text>
                ) : null}
              </ScrollView>

              <Text style={styles.label}>{t('engagement.message')}</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('engagement.messagePlaceholder')}
                placeholderTextColor="#64748b"
                multiline
                style={[styles.input, styles.textarea]}
              />

              <Pressable
                style={[
                  styles.button,
                  (submitting || !toEmployeeId || !message.trim()) && styles.buttonDisabled,
                ]}
                onPress={() => void submitKudos()}
                disabled={submitting || !toEmployeeId || !message.trim()}
              >
                <Text style={styles.buttonText}>
                  {submitting ? t('common.submitting') : t('engagement.sendRecognition')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('engagement.companyFeed')}</Text>
          {feed.length === 0 ? (
            <Text style={styles.muted}>{t('engagement.emptyFeed')}</Text>
          ) : (
            feed.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardMeta}>
                  {item.kudosType === 'manager'
                    ? t('engagement.typeManager')
                    : t('engagement.typePeer')}
                  {' · '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.cardTitle}>
                  {item.fromEmployeeName} → {item.toEmployeeName}
                </Text>
                <Text style={styles.cardBody}>{item.message}</Text>
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
  muted: { color: '#64748b', marginTop: 8 },
  error: { color: '#f87171', marginBottom: 8 },
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
  picker: {
    maxHeight: 160,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginTop: 4,
  },
  pickerRow: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  pickerRowSelected: { backgroundColor: '#0c4a6e' },
  pickerName: { color: '#f8fafc', fontWeight: '600' },
  pickerMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
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
