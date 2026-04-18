-- ─── Team Chat System ────────────────────────────────────────────────────────
-- Migration: 20260418_chat.sql

-- Chat channels
create table if not exists chat_channels (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('company', 'incident', 'unit', 'direct')),
  name text not null,
  description text,
  incident_id uuid references incidents(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  created_by uuid references employees(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Channel members
create table if not exists chat_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channels(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  role text default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(channel_id, employee_id)
);

-- Messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channels(id) on delete cascade,
  sender_id uuid not null references employees(id),
  content text not null,
  message_type text default 'text' check (message_type in ('text', 'image', 'file', 'system')),
  file_url text,
  file_name text,
  reply_to uuid references chat_messages(id),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_chat_messages_channel on chat_messages(channel_id, created_at desc);
create index if not exists idx_chat_members_employee on chat_members(employee_id);
create index if not exists idx_chat_members_channel on chat_members(channel_id);
create index if not exists idx_chat_channels_type on chat_channels(type);
create index if not exists idx_chat_channels_incident on chat_channels(incident_id) where incident_id is not null;
create index if not exists idx_chat_channels_unit on chat_channels(unit_id) where unit_id is not null;

-- RLS
alter table chat_channels enable row level security;
alter table chat_members enable row level security;
alter table chat_messages enable row level security;

-- Policies: employees can see channels they're members of
create policy "Members can view channels" on chat_channels for select
  using (
    id in (select channel_id from chat_members where employee_id in (
      select id from employees where auth_user_id = auth.uid()
    ))
  );

create policy "Members can view membership" on chat_members for select
  using (
    channel_id in (select channel_id from chat_members where employee_id in (
      select id from employees where auth_user_id = auth.uid()
    ))
  );

create policy "Members can read messages" on chat_messages for select
  using (
    channel_id in (select channel_id from chat_members where employee_id in (
      select id from employees where auth_user_id = auth.uid()
    ))
  );

create policy "Members can send messages" on chat_messages for insert
  with check (
    sender_id in (select id from employees where auth_user_id = auth.uid())
    and channel_id in (select channel_id from chat_members where employee_id = sender_id)
  );

create policy "Senders can edit own messages" on chat_messages for update
  using (sender_id in (select id from employees where auth_user_id = auth.uid()));

-- Members can update their own last_read_at
create policy "Members can update own read status" on chat_members for update
  using (employee_id in (select id from employees where auth_user_id = auth.uid()));

-- Allow service role full access (for API routes that create channels/members)
-- Service role bypasses RLS by default in Supabase

-- Enable realtime for chat_messages
alter publication supabase_realtime add table chat_messages;
