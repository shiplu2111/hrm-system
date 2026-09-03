import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '../context/SyncStatusContext';
import type { SyncIndicatorTone } from '../sync/sync-status';

const toneStyles: Record<
  SyncIndicatorTone,
  { background: string; border: string; dot: string; text: string; sub: string }
> = {
  success: {
    background: '#052e16',
    border: '#166534',
    dot: '#4ade80',
    text: '#dcfce7',
    sub: '#86efac',
  },
  warning: {
    background: '#422006',
    border: '#92400e',
    dot: '#fbbf24',
    text: '#fef3c7',
    sub: '#fcd34d',
  },
  danger: {
    background: '#450a0a',
    border: '#991b1b',
    dot: '#f87171',
    text: '#fee2e2',
    sub: '#fca5a5',
  },
  info: {
    background: '#0c4a6e',
    border: '#0369a1',
    dot: '#38bdf8',
    text: '#e0f2fe',
    sub: '#7dd3fc',
  },
  neutral: {
    background: '#1e293b',
    border: '#334155',
    dot: '#94a3b8',
    text: '#e2e8f0',
    sub: '#94a3b8',
  },
};

export function SyncStatusIndicator() {
  const { indicator, syncNow, isSyncing } = useSyncStatus();
  const palette = toneStyles[indicator.tone];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          backgroundColor: palette.background,
          borderBottomColor: palette.border,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${indicator.title}. ${indicator.subtitle}`}
    >
      <View style={styles.row}>
        <View style={styles.leading}>
          {indicator.showSpinner ? (
            <ActivityIndicator size="small" color={palette.dot} style={styles.spinner} />
          ) : (
            <View style={[styles.dot, { backgroundColor: palette.dot }]} />
          )}
          <View style={styles.copy}>
            <Text style={[styles.title, { color: palette.text }]}>{indicator.title}</Text>
            <Text style={[styles.subtitle, { color: palette.sub }]} numberOfLines={2}>
              {indicator.subtitle}
            </Text>
          </View>
        </View>
        {indicator.showRetry ? (
          <Pressable
            style={[styles.retry, { borderColor: palette.border }]}
            disabled={isSyncing}
            onPress={() => void syncNow()}
            accessibilityRole="button"
            accessibilityLabel="Retry sync"
          >
            <Text style={[styles.retryText, { color: palette.text }]}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  spinner: {
    marginTop: 2,
    width: 10,
    height: 10,
  },
  copy: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  retry: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
