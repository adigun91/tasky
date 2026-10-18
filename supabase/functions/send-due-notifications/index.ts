// Supabase Edge Function: deno run (no npm install needed, Supabase builds/deploys this for you).
//
// Deploy:   supabase functions deploy send-due-notifications
// Schedule: Dashboard -> Edge Functions -> send-due-notifications -> Cron -> every 1 minute
//           (or: select cron.schedule('send-due-notifications', '* * * * *', $$ ... $$); via pg_cron)
//
// Known simplification: task.time is compared against the DATABASE's current UTC time directly —
// there's no per-user timezone column yet, so this assumes tasks were entered in UTC-equivalent
// local time or all users share one timezone. Add a `timezone` column to `profiles` and adjust the
// `now_time`/`now_date` expressions below (e.g. `now() at time zone profiles.timezone`) to support
// multiple timezones properly.
//
// Known simplification: 'hourly' tasks fire approximately — every run where the elapsed hours
// since `created_at` is a multiple of `interval_hours` — since there's no stored "last fired at".

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  repeat: 'once' | 'daily' | 'weekly' | 'hourly';
  weekdays: number[];
  interval_hours: number;
  alarm_enabled: boolean;
  completed: boolean;
  created_at: string;
}

interface PushTokenRow {
  user_id: string;
  expo_push_token: string;
}

function isDue(task: TaskRow, now: Date): boolean {
  const hhmm = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  // App's Weekday convention: 1 = Sunday ... 7 = Saturday (matches JS getUTCDay() + 1).
  const weekday = now.getUTCDay() + 1;

  switch (task.repeat) {
    case 'once':
      return task.date === today && task.time === hhmm;
    case 'daily':
      return task.time === hhmm;
    case 'weekly':
      return task.weekdays.includes(weekday) && task.time === hhmm;
    case 'hourly': {
      if (now.getUTCMinutes() !== 0) return false;
      const createdAt = new Date(task.created_at);
      const elapsedHours = Math.round((now.getTime() - createdAt.getTime()) / 3_600_000);
      return elapsedHours > 0 && elapsedHours % Math.max(1, task.interval_hours) === 0;
    }
    default:
      return false;
  }
}

Deno.serve(async (request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const cronSecret = request.headers.get('x-tasky-cron-secret');
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { data: authorized, error: authorizationError } = await supabase.rpc(
    'is_tasky_cron_authorized',
    { p_secret: cronSecret }
  );
  if (authorizationError || authorized !== true) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const now = new Date();
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('completed', false);

  if (tasksError) {
    return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 });
  }

  const dueTasks = (tasks ?? []).filter((t: TaskRow) => isDue(t, now));
  if (dueTasks.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const dueTaskIds = dueTasks.map((task: TaskRow) => task.id);
  const { data: shares, error: sharesError } = await supabase
    .from('task_shares')
    .select('task_id, shared_with_user_id')
    .in('task_id', dueTaskIds);

  if (sharesError) {
    return new Response(JSON.stringify({ error: sharesError.message }), { status: 500 });
  }

  const recipientsByTask = new Map<string, Set<string>>();
  for (const task of dueTasks as TaskRow[]) {
    recipientsByTask.set(task.id, new Set([task.user_id]));
  }
  for (const share of shares ?? []) {
    recipientsByTask.get(share.task_id)?.add(share.shared_with_user_id);
  }

  const userIds = [
    ...new Set([...recipientsByTask.values()].flatMap((recipients) => [...recipients])),
  ];
  const { data: tokens, error: tokensError } = await supabase
    .from('push_tokens')
    .select('user_id, expo_push_token')
    .in('user_id', userIds);

  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), { status: 500 });
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokens ?? []) as PushTokenRow[]) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.expo_push_token);
    tokensByUser.set(row.user_id, list);
  }

  const messages = dueTasks.flatMap((task: TaskRow) =>
    [...(recipientsByTask.get(task.id) ?? [])].flatMap((userId) =>
      (tokensByUser.get(userId) ?? []).map((token) => ({
        to: token,
        title: task.title,
        body: task.description || 'Tap to view your task',
        sound: task.alarm_enabled ? 'alarm.wav' : 'default',
        priority: 'high',
        data: { taskId: task.id, alarmEnabled: task.alarm_enabled },
      }))
    )
  );

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0, dueTasks: dueTasks.length }), { status: 200 });
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json();

  return new Response(JSON.stringify({ sent: messages.length, expo: result }), { status: 200 });
});
