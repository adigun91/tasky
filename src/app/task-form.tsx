import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '@/context/TasksContext';
import { useProfile } from '@/context/ProfileContext';
import { FORM_MAX_WIDTH, useResponsiveContentStyle } from '@/lib/responsive';
import { Footer } from '@/components/Footer';
import { WEEKDAY_LABELS, type RepeatType, type Weekday } from '@/types/task';

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'hourly', label: 'Hourly' },
];

const ALL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

// Plain DOM style object for the web-only <input type="date"/"time"> fallback (RN's DateTimePicker has no web support).
const webInputStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  color: '#111827',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  marginTop: 4,
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeKey(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function TaskFormScreen() {
  const { id, date: dateParam } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { getTask, addTask, updateTask, deleteTask } = useTasks();
  const { settings } = useProfile();
  const contentStyle = useResponsiveContentStyle(FORM_MAX_WIDTH);
  const existing = id ? getTask(id) : undefined;
  const isEditing = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [repeat, setRepeat] = useState<RepeatType>(
    existing?.repeat ?? (dateParam ? 'once' : 'daily')
  );
  const [date, setDate] = useState<Date>(() => {
    if (existing) return new Date(`${existing.date}T00:00:00`);
    if (dateParam) return new Date(`${dateParam}T00:00:00`);
    return new Date();
  });
  const [time, setTime] = useState<Date>(() => {
    if (existing) {
      const [h, m] = existing.time.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);
      return t;
    }
    const t = new Date();
    t.setMinutes(t.getMinutes() + 5, 0, 0);
    return t;
  });
  const [weekdays, setWeekdays] = useState<Set<Weekday>>(new Set(existing?.weekdays ?? [2]));
  const [intervalHours, setIntervalHours] = useState(existing?.intervalHours ?? 1);
  const [alarmEnabled, setAlarmEnabled] = useState(existing?.alarmEnabled ?? settings.defaultAlarmEnabled);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!title.trim()) return false;
    if (repeat === 'weekly' && weekdays.size === 0) return false;
    return true;
  }, [title, repeat, weekdays]);

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        repeat,
        date: toDateKey(date),
        time: toTimeKey(time),
        weekdays: Array.from(weekdays).sort((a, b) => a - b),
        intervalHours,
        alarmEnabled,
      };

      if (repeat === 'once') {
        const [h, m] = input.time.split(':').map(Number);
        const target = new Date(date);
        target.setHours(h, m, 0, 0);
        if (target.getTime() <= Date.now()) {
          Alert.alert('Pick a future time', 'That date and time has already passed.');
          setSaving(false);
          return;
        }
      }

      if (isEditing && existing) {
        await updateTask(existing.id, input);
      } else {
        await addTask(input);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete task', `Delete "${existing.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, contentStyle]}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Take medication"
          value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Optional details"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Repeat</Text>
      <View style={styles.segmented}>
        {REPEAT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.segment, repeat === opt.value && styles.segmentActive]}
            onPress={() => setRepeat(opt.value)}>
            <Text style={[styles.segmentText, repeat === opt.value && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {repeat === 'once' && (
        <>
          <Text style={styles.label}>Date</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={toDateKey(date)}
              min={toDateKey(new Date())}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                if (y && m && d) setDate(new Date(y, m - 1, d));
              }}
              style={webInputStyle}
            />
          ) : (
            <>
              <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text>{date.toDateString()}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selected) setDate(selected);
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {(repeat === 'once' || repeat === 'daily' || repeat === 'weekly') && (
        <>
          <Text style={styles.label}>Time</Text>
          {Platform.OS === 'web' ? (
            <input
              type="time"
              value={toTimeKey(time)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!Number.isNaN(h) && !Number.isNaN(m)) {
                  const next = new Date(time);
                  next.setHours(h, m, 0, 0);
                  setTime(next);
                }
              }}
              style={webInputStyle}
            />
          ) : (
            <>
              <Pressable style={styles.input} onPress={() => setShowTimePicker(true)}>
                <Text>{toTimeKey(time)}</Text>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  onChange={(_, selected) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selected) setTime(selected);
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {repeat === 'weekly' && (
        <>
          <Text style={styles.label}>Days</Text>
          <View style={styles.weekdayRow}>
            {ALL_WEEKDAYS.map((day) => (
              <Pressable
                key={day}
                style={[styles.weekdayChip, weekdays.has(day) && styles.weekdayChipActive]}
                onPress={() => toggleWeekday(day)}>
                <Text
                  style={[
                    styles.weekdayChipText,
                    weekdays.has(day) && styles.weekdayChipTextActive,
                  ]}>
                  {WEEKDAY_LABELS[day]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {repeat === 'hourly' && (
        <>
          <Text style={styles.label}>Repeat every</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setIntervalHours((h) => Math.max(1, h - 1))}>
              <Ionicons name="remove" size={20} color="#4F46E5" />
            </Pressable>
            <Text style={styles.stepperValue}>
              {intervalHours} {intervalHours === 1 ? 'hour' : 'hours'}
            </Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setIntervalHours((h) => Math.min(12, h + 1))}>
              <Ionicons name="add" size={20} color="#4F46E5" />
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.alarmRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Ring an alarm</Text>
          <Text style={styles.helperText}>
            Shows a full-screen ringing alarm instead of a quiet notification.
          </Text>
        </View>
        <Switch value={alarmEnabled} onValueChange={setAlarmEnabled} />
      </View>

      <Pressable
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        disabled={!canSave || saving}
        onPress={handleSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save changes' : 'Create task'}</Text>
      </Pressable>

      {isEditing && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </Pressable>
      )}
      </ScrollView>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 8, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12 },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#4F46E5' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  segmentTextActive: { color: '#fff' },
  weekdayRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  weekdayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: { backgroundColor: '#4F46E5' },
  weekdayChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  weekdayChipTextActive: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: 16, fontWeight: '600', color: '#111827', minWidth: 90, textAlign: 'center' },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  saveButton: {
    marginTop: 28,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  deleteButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
});
