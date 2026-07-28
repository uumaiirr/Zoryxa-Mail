-- CEO Mail Agent — Supabase schema (v2: multiple mail accounts)
-- Run once on a fresh project: Dashboard → SQL Editor → paste everything → Run.

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('gmail','imap')),
  label text not null default '',
  email text not null default '',
  send_as text not null default '',
  -- gmail oauth (encrypted refresh token)
  refresh_token_enc text,
  watch_expires_at timestamptz,
  -- imap/smtp (passwords AES-256-GCM encrypted before they reach the DB)
  imap_host text,
  imap_port int,
  imap_user text,
  imap_pass_enc text,
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_pass_enc text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists emails (
  id text primary key, -- `${account_id}~${provider_id}`
  account_id uuid not null references accounts(id) on delete cascade,
  provider_id text not null, -- gmail message id, or imap uid
  thread_id text not null default '',
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
  suggest_reply boolean not null default false, -- AI: worth a written reply
  draft_subject text,
  draft_body text, -- auto-drafted reply (NEVER auto-sent)
  draft_generated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists emails_account_received_idx on emails (account_id, received_at desc);
create index if not exists emails_received_at_idx on emails (received_at desc);
create index if not exists emails_category_idx on emails (category);
create index if not exists emails_pending_idx on emails (summarized) where summarized = false;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists style_profile (
  account_id uuid primary key references accounts(id) on delete cascade,
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

-- The browser never talks to Supabase: every query goes through Netlify
-- Functions using the service-role key (which bypasses RLS). Enabling RLS with
-- NO policies blocks the public anon key completely.
alter table accounts enable row level security;
alter table emails enable row level security;
alter table app_settings enable row level security;
alter table style_profile enable row level security;
alter table digests enable row level security;
