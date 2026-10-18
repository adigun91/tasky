import type { Task } from '@/types/task';
import { WEEKDAY_LABELS } from '@/types/task';

export function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTaskSchedule(task: Task): string {
  switch (task.repeat) {
    case 'once':
      return `${formatDate(task.date)} · ${formatTime(task.time)}`;
    case 'daily':
      return `Every day · ${formatTime(task.time)}`;
    case 'weekly': {
      const days = task.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d])
        .join(', ');
      return `Weekly (${days || 'no days set'}) · ${formatTime(task.time)}`;
    }
    case 'hourly':
      return task.intervalHours === 1 ? 'Every hour' : `Every ${task.intervalHours} hours`;
    default:
      return '';
  }
}
