import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { loadTasks, saveTasks } from '@/lib/storage';
import {
  rescheduleTaskAlarms,
  cancelTaskAlarms,
  requestNotificationPermissions,
  setupNotificationChannels,
} from '@/lib/notifications';
import { setWebSchedulerTasks, startWebScheduler } from '@/lib/web-scheduler';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Database } from '@/types/database';
import type { Task, TaskInput, Weekday } from '@/types/task';

type TaskRow = Database['public']['Tables']['tasks']['Row'];

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskComplete: (id: string) => Promise<void>;
  getTask: (id: string) => Task | undefined;
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Notification ids are per-device artifacts and never stored in the cloud — merged in locally only.
function rowToTask(row: TaskRow, notificationIds: string[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    repeat: row.repeat,
    weekdays: row.weekdays as Weekday[],
    intervalHours: row.interval_hours,
    alarmEnabled: row.alarm_enabled,
    completed: row.completed,
    notificationIds,
    createdAt: row.created_at,
  };
}

function taskInputToRow(input: TaskInput, userId: string) {
  return {
    user_id: userId,
    title: input.title,
    description: input.description,
    date: input.date,
    time: input.time,
    repeat: input.repeat,
    weekdays: input.weekdays,
    interval_hours: input.intervalHours,
    alarm_enabled: input.alarmEnabled,
  };
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { cloudEnabled, user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks each task's locally-scheduled notification ids in cloud mode (never persisted to the DB).
  const notificationIdsRef = useRef<Map<string, string[]>>(new Map());

  // ── Local-only mode (no Supabase project configured): unchanged AsyncStorage-backed behavior. ──
  useEffect(() => {
    if (cloudEnabled) return;
    (async () => {
      await setupNotificationChannels();
      await requestNotificationPermissions();
      const stored = await loadTasks();
      setTasks(stored);
      setLoading(false);
    })();
  }, [cloudEnabled]);

  // ── Cloud mode: fetch once signed in, then stay in sync via Supabase Realtime. ──
  useEffect(() => {
    if (!cloudEnabled || authLoading) return;
    if (!user) {
      (async () => {
        setTasks([]);
        setLoading(false);
      })();
      return;
    }

    let cancelled = false;

    (async () => {
      await setupNotificationChannels();
      await requestNotificationPermissions();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[tasks] failed to load from Supabase:', error.message);
        setLoading(false);
        return;
      }
      const next: Task[] = [];
      for (const row of data ?? []) {
        const ids = await rescheduleTaskAlarms(rowToTask(row, []));
        notificationIdsRef.current.set(row.id, ids);
        next.push(rowToTask(row, ids));
      }
      if (!cancelled) {
        setTasks(next);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`tasks-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id: string }).id;
            const ids = notificationIdsRef.current.get(oldId) ?? [];
            await cancelTaskAlarms({ notificationIds: ids });
            notificationIdsRef.current.delete(oldId);
            setTasks((prev) => prev.filter((t) => t.id !== oldId));
            return;
          }

          const row = payload.new as TaskRow;
          const prevIds = notificationIdsRef.current.get(row.id) ?? [];
          const draft = rowToTask(row, prevIds);
          let nextIds: string[];
          if (draft.completed) {
            await cancelTaskAlarms(draft);
            nextIds = [];
          } else {
            nextIds = await rescheduleTaskAlarms(draft);
          }
          notificationIdsRef.current.set(row.id, nextIds);
          const finalTask = rowToTask(row, nextIds);
          setTasks((prev) =>
            prev.some((t) => t.id === row.id)
              ? prev.map((t) => (t.id === row.id ? finalTask : t))
              : [finalTask, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [cloudEnabled, authLoading, user]);

  // expo-notifications can't schedule anything on web, so poll due tasks instead while this tab is open.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return startWebScheduler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') setWebSchedulerTasks(tasks);
  }, [tasks]);

  const persist = useCallback(async (next: Task[]) => {
    setTasks(next);
    await saveTasks(next);
  }, []);

  const addTask = useCallback(
    async (input: TaskInput) => {
      if (cloudEnabled && user) {
        // Local state updates via the realtime subscription above once the insert lands.
        const { error } = await supabase.from('tasks').insert(taskInputToRow(input, user.id));
        if (error) console.warn('[tasks] insert failed:', error.message);
        return;
      }
      const task: Task = {
        ...input,
        id: createId(),
        notificationIds: [],
        createdAt: new Date().toISOString(),
        completed: false,
      };
      task.notificationIds = await rescheduleTaskAlarms(task);
      await persist([task, ...tasks]);
    },
    [cloudEnabled, user, tasks, persist]
  );

  const updateTask = useCallback(
    async (id: string, input: TaskInput) => {
      if (cloudEnabled && user) {
        const { error } = await supabase
          .from('tasks')
          .update(taskInputToRow(input, user.id))
          .eq('id', id);
        if (error) console.warn('[tasks] update failed:', error.message);
        return;
      }
      const existing = tasks.find((t) => t.id === id);
      if (!existing) return;
      const updated: Task = { ...existing, ...input };
      updated.notificationIds = await rescheduleTaskAlarms(updated);
      await persist(tasks.map((t) => (t.id === id ? updated : t)));
    },
    [cloudEnabled, user, tasks, persist]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (cloudEnabled && user) {
        // Optimistic: don't rely solely on the realtime echo (DELETE broadcasts need
        // `replica identity full` on the table — see supabase/schema.sql — to reach
        // subscribers at all, so update local state immediately as well).
        const ids = notificationIdsRef.current.get(id) ?? [];
        await cancelTaskAlarms({ notificationIds: ids });
        notificationIdsRef.current.delete(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) console.warn('[tasks] delete failed:', error.message);
        return;
      }
      const existing = tasks.find((t) => t.id === id);
      if (existing) await cancelTaskAlarms(existing);
      await persist(tasks.filter((t) => t.id !== id));
    },
    [cloudEnabled, user, tasks, persist]
  );

  const toggleTaskComplete = useCallback(
    async (id: string) => {
      const existing = tasks.find((t) => t.id === id);
      if (!existing) return;

      if (cloudEnabled && user) {
        const { error } = await supabase
          .from('tasks')
          .update({ completed: !existing.completed })
          .eq('id', id);
        if (error) console.warn('[tasks] toggle complete failed:', error.message);
        return;
      }

      const completed = !existing.completed;
      let notificationIds: string[];
      if (completed) {
        // Completing a task cancels any pending alarms/reminders so it won't ring again.
        await cancelTaskAlarms(existing);
        notificationIds = [];
      } else {
        notificationIds = await rescheduleTaskAlarms({ ...existing, completed });
      }
      const updated: Task = { ...existing, completed, notificationIds };
      await persist(tasks.map((t) => (t.id === id ? updated : t)));
    },
    [cloudEnabled, user, tasks, persist]
  );

  const getTask = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);

  const value = useMemo(
    () => ({ tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete, getTask }),
    [tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete, getTask]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
}
