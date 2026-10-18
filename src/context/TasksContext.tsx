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
  importLocalTasks: () => Promise<{ count: number; error: string | null }>;
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Notification ids are per-device artifacts and never stored in the cloud — merged in locally only.
function rowToTask(
  row: TaskRow,
  notificationIds: string[],
  userId: string,
  canEditSharedTask: boolean
): Task {
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
    isOwnedByMe: row.user_id === userId,
    canEditSharedTask,
  };
}

function taskInputToRow(input: TaskInput) {
  return {
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
    let sharedPermissions = new Map<string, string>();

    (async () => {
      await setupNotificationChannels();
      await requestNotificationPermissions();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[tasks] failed to load from Supabase:', error.message);
        setLoading(false);
        return;
      }
      const { data: shares } = await supabase
        .from('task_shares')
        .select('task_id, permission')
        .eq('shared_with_user_id', user.id);
      sharedPermissions = new Map(
        (shares ?? []).map((share) => [share.task_id, share.permission])
      );
      const next: Task[] = [];
      for (const row of data ?? []) {
        const task = rowToTask(
          row,
          [],
          user.id,
          row.user_id === user.id || sharedPermissions.get(row.id) === 'edit'
        );
        const ids = await rescheduleTaskAlarms(task);
        notificationIdsRef.current.set(row.id, ids);
        next.push({ ...task, notificationIds: ids });
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
        { event: '*', schema: 'public', table: 'tasks' },
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
          const canEditSharedTask =
            row.user_id === user.id || sharedPermissions.get(row.id) === 'edit';
          const draft = rowToTask(row, prevIds, user.id, canEditSharedTask);
          let nextIds: string[];
          if (draft.completed) {
            await cancelTaskAlarms(draft);
            nextIds = [];
          } else {
            nextIds = await rescheduleTaskAlarms(draft);
          }
          notificationIdsRef.current.set(row.id, nextIds);
          const finalTask = rowToTask(row, nextIds, user.id, canEditSharedTask);
          setTasks((prev) =>
            prev.some((t) => t.id === row.id)
              ? prev.map((t) => (t.id === row.id ? finalTask : t))
              : [finalTask, ...prev]
          );
        }
      )
      .subscribe();

    const sharesChannel = supabase
      .channel(`task-shares-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_shares',
          filter: `shared_with_user_id=eq.${user.id}`,
        },
        () => {
          for (const notificationIds of notificationIdsRef.current.values()) {
            void cancelTaskAlarms({ notificationIds });
          }
          notificationIdsRef.current.clear();
          setTasks([]);
          setLoading(true);
          supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false })
            .then(async ({ data, error }) => {
              if (cancelled || error || !data) return;
              const { data: currentShares } = await supabase
                .from('task_shares')
                .select('task_id, permission')
                .eq('shared_with_user_id', user.id);
              if (cancelled) return;
              sharedPermissions = new Map(
                (currentShares ?? []).map((share) => [share.task_id, share.permission])
              );
              const refreshed = await Promise.all(
                data.map(async (row) => {
                  const task = rowToTask(
                    row,
                    [],
                    user.id,
                    row.user_id === user.id || sharedPermissions.get(row.id) === 'edit'
                  );
                  const ids = await rescheduleTaskAlarms(task);
                  notificationIdsRef.current.set(row.id, ids);
                  return { ...task, notificationIds: ids };
                })
              );
              if (!cancelled) {
                setTasks(refreshed);
                setLoading(false);
              }
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(sharesChannel);
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
        const { error } = await supabase
          .from('tasks')
          .insert({ ...taskInputToRow(input), user_id: user.id });
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
        const existing = tasks.find((task) => task.id === id);
        if (existing?.isOwnedByMe === false && !existing.canEditSharedTask) return;
        const { error } = await supabase
          .from('tasks')
          .update(taskInputToRow(input))
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
        const existing = tasks.find((task) => task.id === id);
        if (existing?.isOwnedByMe === false) return;
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
        if (existing.isOwnedByMe === false && !existing.canEditSharedTask) return;
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

  const importLocalTasks = useCallback(async () => {
    if (!cloudEnabled || !user) return { count: 0, error: 'Sign in to a cloud account first.' };
    const localTasks = await loadTasks();
    if (localTasks.length === 0) return { count: 0, error: null };

    const rows = localTasks.map((task) => ({
      ...taskInputToRow(task),
      user_id: user.id,
      completed: task.completed,
    }));
    const { error } = await supabase.from('tasks').insert(rows);
    if (error) return { count: 0, error: error.message };

    await saveTasks([]);
    return { count: localTasks.length, error: null };
  }, [cloudEnabled, user]);

  const value = useMemo(
    () => ({ tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete, getTask, importLocalTasks }),
    [tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete, getTask, importLocalTasks]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
}
