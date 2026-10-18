import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '@/context/TasksContext';
import { formatTaskSchedule, formatTime } from '@/lib/format';
import { useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';
import type { Task, Weekday } from '@/types/task';

const REPEAT_ICON: Record<Task['repeat'], keyof typeof Ionicons.glyphMap> = {
  once: 'calendar-outline',
  daily: 'sunny-outline',
  weekly: 'calendar-number-outline',
  hourly: 'time-outline',
};

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Only this many task titles fit in a day cell before the rest collapse into a "+N more" label.
const MAX_CELL_LABELS = 2;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

// Daily/hourly tasks repeat indefinitely, so they're treated as occurring every day.
function occursOnDate(task: Task, date: Date): boolean {
  switch (task.repeat) {
    case 'once':
      return task.date === toDateKey(date);
    case 'daily':
    case 'hourly':
      return true;
    case 'weekly': {
      const weekday = (date.getDay() + 1) as Weekday;
      return task.weekdays.includes(weekday);
    }
    default:
      return false;
  }
}

function getMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );
}

// Keeps day cells compact: only the first 3 words of a title are shown, with an ellipsis if trimmed.
function truncateTitle(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length <= 3) return title.trim();
  return `${words.slice(0, 3).join(' ')}\u2026`;
}

export default function CalendarScreen() {
  const { tasks, toggleTaskComplete } = useTasks();
  const insets = useSafeAreaInsets();
  const contentStyle = useResponsiveContentStyle();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  const days = useMemo(() => getMonthGrid(month), [month]);

  const tasksForSelectedDate = useMemo(
    () => tasks.filter((t) => occursOnDate(t, selectedDate)),
    [tasks, selectedDate]
  );

  function goToMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function goToToday() {
    const today = new Date();
    today.setDate(1);
    setMonth(today);
    setSelectedDate(new Date());
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          contentStyle,
          { paddingBottom: insets.bottom + 100 },
        ]}>
        <View style={styles.monthRow}>
        <Pressable hitSlop={10} onPress={() => goToMonth(-1)}>
          <Ionicons name="chevron-back" size={22} color="#4F46E5" />
        </Pressable>
        <Text style={styles.monthLabel}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable hitSlop={10} onPress={() => goToMonth(1)}>
          <Ionicons name="chevron-forward" size={22} color="#4F46E5" />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((w) => (
          <Text key={w} style={styles.weekdayHeader}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const dayTasks = tasks.filter((t) => occursOnDate(t, day));
          return (
            <Pressable
              key={toDateKey(day)}
              style={styles.cell}
              onPress={() => setSelectedDate(day)}>
              <View
                style={[
                  styles.cellCircle,
                  isSelected && styles.cellCircleSelected,
                  isToday && !isSelected && styles.cellCircleToday,
                ]}>
                <Text
                  style={[
                    styles.cellText,
                    !inMonth && styles.cellTextMuted,
                    isSelected && styles.cellTextSelected,
                  ]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.cellLabels}>
                {dayTasks.slice(0, MAX_CELL_LABELS).map((t) => (
                  <Text
                    key={t.id}
                    style={[styles.cellLabel, !inMonth && styles.cellTextMuted]}
                    numberOfLines={1}>
                    {truncateTitle(t.title)}
                  </Text>
                ))}
                {dayTasks.length > MAX_CELL_LABELS && (
                  <Text style={[styles.cellMoreLabel, !inMonth && styles.cellTextMuted]}>
                    +{dayTasks.length - MAX_CELL_LABELS} more
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.todayButton} onPress={goToToday}>
        <Text style={styles.todayButtonText}>Today</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.dayListTitle}>
        {selectedDate.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </Text>

      {tasksForSelectedDate.length === 0 ? (
        <View style={styles.emptyDayCard}>
          <Ionicons name="add-circle-outline" size={28} color="#C7D2FE" />
          <Text style={styles.emptyText}>No tasks on this day.</Text>
          <Pressable
            style={styles.emptyAddButton}
            onPress={() =>
              router.push({ pathname: '/task-form', params: { date: toDateKey(selectedDate) } })
            }>
            <Text style={styles.emptyAddButtonText}>+ Add task</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.dayList}>
          {tasksForSelectedDate.map((task) => (
            <Pressable
              key={task.id}
              style={[styles.taskCard, task.completed && styles.taskCardCompleted]}
              onPress={() => setDetailsTask(task)}>
              <Ionicons name={REPEAT_ICON[task.repeat]} size={20} color="#4F46E5" />
              <View style={styles.taskCardBody}>
                <Text
                  style={[styles.taskCardTitle, task.completed && styles.taskCardTitleCompleted]}
                  numberOfLines={1}>
                  {task.title}
                </Text>
                {task.repeat !== 'hourly' && (
                  <Text style={styles.taskCardTime}>{formatTime(task.time)}</Text>
                )}
              </View>
              {task.alarmEnabled && <Ionicons name="alarm" size={16} color="#4F46E5" />}
            </Pressable>
          ))}
        </View>
      )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 28 }]}
        onPress={() =>
          router.push({ pathname: '/task-form', params: { date: toDateKey(selectedDate) } })
        }>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
      <Footer />

      <Modal
        visible={!!detailsTask}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsTask(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailsTask(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {detailsTask && (
              <>
                <View style={styles.modalHeader}>
                  <Ionicons name={REPEAT_ICON[detailsTask.repeat]} size={22} color="#4F46E5" />
                  <Text
                    style={[
                      styles.modalTitle,
                      detailsTask.completed && styles.taskCardTitleCompleted,
                    ]}>
                    {detailsTask.title}
                  </Text>
                  <Pressable hitSlop={10} onPress={() => setDetailsTask(null)}>
                    <Ionicons name="close" size={22} color="#9CA3AF" />
                  </Pressable>
                </View>

                {!!detailsTask.description && (
                  <Text style={styles.modalDescription}>{detailsTask.description}</Text>
                )}

                <Text style={styles.modalSchedule}>{formatTaskSchedule(detailsTask)}</Text>

                <View style={styles.modalRow}>
                  <Ionicons
                    name={detailsTask.alarmEnabled ? 'alarm' : 'notifications-outline'}
                    size={16}
                    color="#6B7280"
                  />
                  <Text style={styles.modalRowText}>
                    {detailsTask.alarmEnabled ? 'Ringing alarm' : 'Quiet notification'}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalSecondaryButton}
                    onPress={() => {
                      toggleTaskComplete(detailsTask.id);
                      setDetailsTask(null);
                    }}>
                    <Text style={styles.modalSecondaryButtonText}>
                      {detailsTask.completed ? 'Mark incomplete' : 'Mark complete'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalPrimaryButton}
                    onPress={() => {
                      const id = detailsTask.id;
                      setDetailsTask(null);
                      router.push({ pathname: '/task-form', params: { id } });
                    }}>
                    <Text style={styles.modalPrimaryButtonText}>Edit</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  weekdayRow: { flexDirection: 'row' },
  weekdayHeader: {
    flexBasis: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { flexBasis: '14.28%', alignItems: 'center', paddingVertical: 4, gap: 2 },
  cellCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCircleSelected: { backgroundColor: '#4F46E5' },
  cellCircleToday: { borderWidth: 1.5, borderColor: '#4F46E5' },
  cellText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  cellTextMuted: { color: '#D1D5DB' },
  cellTextSelected: { color: '#fff', fontWeight: '700' },
  cellLabel: { fontSize: 9, color: '#4F46E5', fontWeight: '600', textAlign: 'center', width: '100%' },
  cellLabels: { width: '100%', alignItems: 'center' },
  cellMoreLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '600', textAlign: 'center' },
  todayButton: { alignSelf: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 16 },
  todayButtonText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  dayListTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  emptyDayCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  emptyAddButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
  },
  emptyAddButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dayList: { gap: 10 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  taskCardCompleted: { opacity: 0.6 },
  taskCardBody: { flex: 1, gap: 2 },
  taskCardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  taskCardTitleCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  taskCardTime: { fontSize: 13, color: '#4F46E5', fontWeight: '500' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
  modalDescription: { fontSize: 14, color: '#4B5563' },
  modalSchedule: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalRowText: { fontSize: 13, color: '#6B7280' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalSecondaryButtonText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalPrimaryButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#4F46E5',
  },
  modalPrimaryButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
