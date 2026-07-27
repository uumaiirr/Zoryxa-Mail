-- CEO Mail Agent — Supabase schema
-- Run once: Supabase Dashboard → SQL Editor → paste everything → Run.

create table if not exists emails (
  gmail_id text primary key,
  thread_id text not null,
  from_name text not null default '',
  from_email text not null default '',
  to_emails text[] not null default '{}',
  subject text not null default '',
  snippet text not null default '',
  received_at timestamptz not null,
  category text not null default 'uncategorized',
  tldr text,
  participants text[] not null default '{}',
  deadlines jsonb not null default '[]',
  action_required boolean not null default false,
  tasks jsonb not null default '[]',
  is_read boolean not null default false,
  summarized boolean not null default false,
  suggest_reply boolean not null default false, -- AI: worth a written reply from the CEO
  draft_subject text,
  draft_body text, -- auto-drafted reply (NEVER auto-sent)
  draft_generated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists emails_received_at_idx on emails (received_at desc);
create index if not exists emails_category_idx on emails (category);
create index if not exists emails_pending_idx on emails (summarized) where summarized = false;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists style_profile (
  id int primary key default 1 check (id = 1),
  profile jsonb,
  examples jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists digests (
  digest_date date primary key,
  content jsonb not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists oauth_tokens (
  id int primary key default 1 check (id = 1),
  refresh_token_enc text not null, -- AES-256-GCM encrypted before it reaches the DB
  granted_email text,
  updated_at timestamptz not null default now()
);

create table if not exists sync_state (
  id int primary key default 1 check (id = 1),
  last_sync_at timestamptz,
  watch_expires_at timestamptz -- Gmail push-notification watch expiry (renewed by the hourly cron)
);

-- The browser never talks to Supabase: every query goes through Netlify
-- Functions using the service-role key (which bypasses RLS). Enabling RLS with
-- NO policies blocks the public anon key completely.
alter table emails enable row level security;
alter table app_settings enable row level security;
alter table style_profile enable row level security;
alter table digests enable row level security;
alter table oauth_tokens enable row level security;
alter table sync_state enable row level security;
