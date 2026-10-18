import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '@/context/TasksContext';
import { useProfile } from '@/context/ProfileContext';
import { formatTaskSchedule } from '@/lib/format';
import { useColumns, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';
import type { Task } from '@/types/task';

const REPEAT_ICON: Record<Task['repeat'], keyof typeof Ionicons.glyphMap> = {
  once: 'calendar-outline',
  daily: 'sunny-outline',
  weekly: 'calendar-number-outline',
  hourly: 'time-outline',
};

type Filter = 'all' | 'active' | 'completed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function TaskCard({ task }: { task: Task }) {
  const { deleteTask, toggleTaskComplete } = useTasks();

  return (
    <View style={[styles.card, task.completed && styles.cardCompleted]}>
      <Pressable
        hitSlop={10}
        style={[styles.checkbox, task.completed && styles.checkboxCompleted]}
        disabled={task.isOwnedByMe === false && !task.canEditSharedTask}
        onPress={() => toggleTaskComplete(task.id)}>
        {task.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
      </Pressable>
      <Pressable
        style={styles.cardMain}
        disabled={task.isOwnedByMe === false && !task.canEditSharedTask}
        onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })}>
        <View style={styles.cardIcon}>
          <Ionicons name={REPEAT_ICON[task.repeat]} size={22} color="#4F46E5" />
        </View>
        <View style={styles.cardBody}>
          <Text
            style={[styles.cardTitle, task.completed && styles.cardTitleCompleted]}
            numberOfLines={1}>
            {task.title}
          </Text>
          {!!task.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {task.description}
            </Text>
          )}
          <Text style={styles.cardSchedule}>{formatTaskSchedule(task)}</Text>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        {task.isOwnedByMe === false && (
          <Ionicons name="people-outline" size={18} color="#059669" />
        )}
        {task.alarmEnabled && <Ionicons name="alarm" size={18} color="#4F46E5" />}
        {task.isOwnedByMe === false ? null : (
          <>
            {task.isOwnedByMe === true && (
              <Pressable
                accessibilityLabel="Share task"
                hitSlop={10}
                onPress={() =>
                  router.push({ pathname: '/task-sharing' as never, params: { id: task.id } })
                }>
                <Ionicons name="person-add-outline" size={19} color="#6B7280" />
              </Pressable>
            )}
            <Pressable hitSlop={10} onPress={() => deleteTask(task.id)}>
              <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { tasks, loading } = useTasks();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const columns = useColumns();
  const contentStyle = useResponsiveContentStyle();

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [tasks]
  );

  const filtered = useMemo(
    () =>
      sorted.filter((t) => {
        if (filter === 'active') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
      }),
    [sorted, filter]
  );

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = tasks.length === 0 ? 0 : completedCount / tasks.length;
  const initial = profile.name.trim().charAt(0).toUpperCase() || 'Y';

  const emptyMessage =
    filter === 'completed'
      ? "You haven't completed any tasks yet."
      : filter === 'active'
        ? 'Nothing left to do — nice work!'
        : 'Tap the + button to add a daily, hourly, or weekly routine with an alarm.';

  return (
    <View style={styles.container}>
      <View
        style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 12 }, contentStyle]}>
        <View style={styles.headerText}>
          <Text style={styles.greeting} numberOfLines={1}>
            {getGreeting()}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            tasky
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.avatar, { backgroundColor: profile.avatarColor }]}
            onPress={() => router.push('/profile')}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
          <Pressable
            hitSlop={10}
            style={styles.iconButton}
            onPress={() => router.push('/calendar')}>
            <Ionicons name="calendar-outline" size={20} color="#4F46E5" />
          </Pressable>
          <Pressable
            hitSlop={10}
            style={styles.iconButton}
            onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={20} color="#4F46E5" />
          </Pressable>
        </View>
      </View>

      {tasks.length > 0 && (
        <View style={[styles.progressWrap, contentStyle]}>
          <View style={styles.progressCard}>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressLabel}>Your progress</Text>
              <Text style={styles.progressCount}>
                {completedCount}/{tasks.length}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>
      )}

      <View style={[styles.filterRow, contentStyle]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}>
            <Text
              style={[styles.filterChipText, filter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!loading && filtered.length === 0 ? (
        <View style={[styles.empty, contentStyle]}>
          <Ionicons name="checkmark-done-circle-outline" size={64} color="#C7D2FE" />
          <Text style={styles.emptyTitle}>{filter === 'all' ? 'No tasks yet' : 'Nothing here'}</Text>
          <Text style={styles.emptySubtitle}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          key={columns}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.listRow : undefined}
          style={[styles.listOuter, contentStyle]}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          renderItem={({ item }) => (
            <View style={columns > 1 ? styles.cardColumn : undefined}>
              <TaskCard task={item} />
            </View>
          )}
        />
      )}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 28 }]}
        onPress={() => router.push('/task-form')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerText: { flex: 1, flexShrink: 1, marginRight: 12 },
  greeting: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { paddingHorizontal: 20, marginBottom: 16 },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  progressCount: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF2FF', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#4F46E5' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, gap: 12 },
  listOuter: { flex: 1 },
  listRow: { gap: 12 },
  cardColumn: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardCompleted: { opacity: 0.6 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: { borderColor: '#059669', backgroundColor: '#059669' },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardTitleCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  cardDescription: { fontSize: 13, color: '#6B7280' },
  cardSchedule: { fontSize: 13, color: '#4F46E5', marginTop: 2, fontWeight: '500' },
  cardActions: { alignItems: 'center', gap: 10 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
