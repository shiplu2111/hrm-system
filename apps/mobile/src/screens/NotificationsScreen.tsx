import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNotificationsCenter } from '../notifications/useNotificationsCenter';

interface NotificationsScreenProps {
  onBack: () => void;
}

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { items, loading, error, pushReady, refresh, markRead } =
    useNotificationsCenter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.hint}>
        {pushReady
          ? 'Push alerts are enabled. All notifications are also saved here for offline access.'
          : 'Enable push alerts for instant updates, or check this list anytime — notifications are always stored on the server.'}
      </Text>

      {loading && items.length === 0 ? (
        <ActivityIndicator color="#38bdf8" style={styles.loader} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor="#38bdf8" />
        }
        contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No notifications yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.readAt && styles.unreadCard]}
            onPress={() => {
              if (!item.readAt) {
                void markRead(item.id);
              }
            }}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.cardMeta}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  back: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 16,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: { width: 40 },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  loader: { marginTop: 24 },
  error: {
    color: '#fca5a5',
    marginBottom: 8,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unreadCard: {
    borderColor: '#38bdf8',
  },
  cardTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  cardBody: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
});
