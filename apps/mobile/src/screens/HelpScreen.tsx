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
import type { KbArticleListItem, SupportTicketRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { ApiError } from '../api/client';
import {
  createSupportTicket,
  listKbArticles,
  listSupportTickets,
} from '../api/support-api';

interface HelpScreenProps {
  onBack: () => void;
}

export function HelpScreen({ onBack }: HelpScreenProps) {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [arts, tix] = await Promise.all([
        listKbArticles({ search: query.trim() || undefined }),
        listSupportTickets(),
      ]);
      setArticles(arts);
      setTickets(tix);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadHelpShort'));
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority: 'medium',
      });
      setSubmitted(true);
      setSubject('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.submitTicket'));
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
        <Text style={styles.title}>{t('support.helpSupport')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>{t('support.searchArticlesShort')}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('support.searchPlaceholder')}
            placeholderTextColor="#64748b"
            style={styles.input}
          />

          <Text style={styles.sectionTitle}>{t('support.articles')}</Text>
          {articles.map((article) => (
            <View key={article.id} style={styles.card}>
              <Text style={styles.cardMeta}>{article.categoryName}</Text>
              <Text style={styles.cardTitle}>{article.title}</Text>
              <Text style={styles.cardBody}>{article.summary}</Text>
            </View>
          ))}
          {articles.length === 0 ? (
            <Text style={styles.muted}>{t('support.noArticles')}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>{t('support.myTickets')}</Text>
          {tickets.map((ticket) => (
            <View key={ticket.id} style={styles.card}>
              <Text style={styles.cardMeta}>{ticket.ticketNumber}</Text>
              <Text style={styles.cardTitle}>{ticket.subject}</Text>
              <Text style={styles.cardBody}>
                {t(`support.ticketStatus.${ticket.status}`)}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>{t('support.newTicketSection')}</Text>
          {submitted ? (
            <Text style={styles.success}>{t('support.ticketSubmittedFollowUp')}</Text>
          ) : (
            <>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder={t('support.subject')}
                placeholderTextColor="#64748b"
                style={styles.input}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('support.describeIssue')}
                placeholderTextColor="#64748b"
                multiline
                style={[styles.input, styles.textarea]}
              />
              <Pressable
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={() => void submitTicket()}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>
                  {submitting ? t('common.submitting') : t('support.submitTicket')}
                </Text>
              </Pressable>
            </>
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
  success: { color: '#4ade80', marginTop: 8 },
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
