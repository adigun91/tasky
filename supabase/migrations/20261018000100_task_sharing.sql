create table if not exists public.task_shares (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  shared_with_user_id uuid not null references auth.users (id) on delete cascade,
  shared_with_email text not null,
  permission text not null default 'edit' check (permission in ('read', 'edit')),
  created_at timestamptz not null default now(),
  unique (task_id, shared_with_user_id),
  check (owner_id <> shared_with_user_id)
);

create index if not exists task_shares_shared_with_user_id_idx
  on public.task_shares (shared_with_user_id);

alter table public.task_shares enable row level security;
alter publication supabase_realtime add table public.task_shares;
alter table public.task_shares replica identity full;

create or replace function public.prevent_task_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Task ownership cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_task_owner_change on public.tasks;
create trigger prevent_task_owner_change
  before update of user_id on public.tasks
  for each row execute function public.prevent_task_owner_change();

drop policy if exists "task shares visible to participants" on public.task_shares;
create policy "task shares visible to participants" on public.task_shares
  for select using (auth.uid() = owner_id or auth.uid() = shared_with_user_id);

drop policy if exists "owners can remove task shares" on public.task_shares;
create policy "owners can remove task shares" on public.task_shares
  for delete using (auth.uid() = owner_id);

drop policy if exists "tasks visible to owners and shared users" on public.tasks;
create policy "tasks visible to owners and shared users" on public.tasks
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.task_shares s
      where s.task_id = tasks.id and s.shared_with_user_id = auth.uid()
    )
  );

drop policy if exists "owners and editors can update tasks" on public.tasks;
create policy "owners and editors can update tasks" on public.tasks
  for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.task_shares s
      where s.task_id = tasks.id
        and s.owner_id = tasks.user_id
        and s.shared_with_user_id = auth.uid()
        and s.permission = 'edit'
    )
  ) with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.task_shares s
      where s.task_id = tasks.id
        and s.owner_id = tasks.user_id
        and s.shared_with_user_id = auth.uid()
        and s.permission = 'edit'
    )
  );

create or replace function public.share_task_with_email(
  p_task_id uuid,
  p_email text,
  p_permission text default 'edit'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_owner uuid;
  recipient_id uuid;
  normalized_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if p_permission not in ('read', 'edit') then
    raise exception 'Permission must be read or edit.';
  end if;
  if normalized_email = '' then
    raise exception 'Enter an email address.';
  end if;

  select t.user_id into task_owner
  from public.tasks t
  where t.id = p_task_id;

  if task_owner is null or task_owner <> auth.uid() then
    raise exception 'Only the task owner can share this task.';
  end if;

  select u.id into recipient_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if recipient_id is null then
    raise exception 'No Tasky account was found for that email.';
  end if;
  if recipient_id = auth.uid() then
    raise exception 'You cannot share a task with yourself.';
  end if;

  insert into public.task_shares (
    task_id, owner_id, shared_with_user_id, shared_with_email, permission
  ) values (
    p_task_id, auth.uid(), recipient_id, normalized_email, p_permission
  )
  on conflict (task_id, shared_with_user_id) do update
    set shared_with_email = excluded.shared_with_email,
        permission = excluded.permission;
end;
$$;

create or replace function public.list_task_shares(p_task_id uuid)
returns table (
  id uuid,
  shared_with_user_id uuid,
  shared_with_email text,
  permission text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.tasks t where t.id = p_task_id and t.user_id = auth.uid()
  ) then
    raise exception 'Only the task owner can view its shares.';
  end if;

  return query
  select s.id, s.shared_with_user_id, s.shared_with_email, s.permission
  from public.task_shares s
  where s.task_id = p_task_id and s.owner_id = auth.uid()
  order by s.created_at;
end;
$$;

revoke all on function public.share_task_with_email(uuid, text, text) from public;
revoke all on function public.list_task_shares(uuid) from public;
grant execute on function public.share_task_with_email(uuid, text, text) to authenticated;
grant execute on function public.list_task_shares(uuid) to authenticated;