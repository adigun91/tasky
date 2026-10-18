import { router } from 'expo-router';
import type { Task } from '@/types/task';

// Expo's weekday trigger convention is 1=Sunday..7=Saturday; JS Date#getDay() is 0=Sunday..6=Saturday.
const WEEKDAY_TO_JS_DAY = (weekday: number): number => weekday - 1;

const TICK_MS = 5000;

let tasksRef: Task[] = [];
const lastFiredAt: Record<string, number> = {};
let timer: ReturnType<typeof setInterval> | null = null;

/** Computes the next time this task should ring strictly after `after`, or null if it won't ring again. */
function computeNextTrigger(task: Task, after: Date): Date | null {
  switch (task.repeat) {
    case 'once': {
      const [hour, minute] = task.time.split(':').map(Number);
      const [year, month, day] = task.date.split('-').map(Number);
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      return date.getTime() > after.getTime() ? date : null;
    }
    case 'daily': {
      const [hour, minute] = task.time.split(':').map(Number);
      const candidate = new Date(after);
      candidate.setHours(hour, minute, 0, 0);
      while (candidate.getTime() <= after.getTime()) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    }
    case 'weekly': {
      if (task.weekdays.length === 0) return null;
      const [hour, minute] = task.time.split(':').map(Number);
      for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(after);
        candidate.setDate(candidate.getDate() + offset);
        candidate.setHours(hour, minute, 0, 0);
        const isSelectedDay = task.weekdays.some(
          (weekday) => WEEKDAY_TO_JS_DAY(weekday) === candidate.getDay()
        );
        if (isSelectedDay && candidate.getTime() > after.getTime()) return candidate;
      }
      return null;
    }
    case 'hourly': {
      const ms = Math.max(1, task.intervalHours) * 60 * 60 * 1000;
      return new Date(after.getTime() + ms);
    }
    default:
      return null;
  }
}

function tick(): void {
  const now = Date.now();
  for (const task of tasksRef) {
    const after = new Date(lastFiredAt[task.id] ?? new Date(task.createdAt).getTime());
    const next = computeNextTrigger(task, after);
    if (next && next.getTime() <= now) {
      lastFiredAt[task.id] = next.getTime();
      router.push({ pathname: '/alarm', params: { taskId: task.id } });
    }
  }
}

/** Keeps the scheduler's view of tasks current; call whenever the task list changes. */
export function setWebSchedulerTasks(tasks: Task[]): void {
  tasksRef = tasks;
}

/**
 * Web has no background scheduling API, so alarms can only ring while this tab stays open.
 * Polls due tasks on an interval and navigates to the ringing screen instead of relying on
 * expo-notifications, which isn't implemented on web at all.
 */
export function startWebScheduler(): () => void {
  if (timer) return () => {};
  timer = setInterval(tick, TICK_MS);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
