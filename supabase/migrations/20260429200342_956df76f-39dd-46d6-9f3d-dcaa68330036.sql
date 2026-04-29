create table if not exists public.email_send_state (
  id integer primary key default 1,
  cooldown_until timestamptz,
  last_provider_error text,
  last_provider_status integer,
  updated_at timestamptz not null default now(),
  constraint email_send_state_singleton check (id = 1)
);

insert into public.email_send_state (id) values (1)
on conflict (id) do nothing;

alter table public.email_send_state enable row level security;

drop policy if exists "email_send_state_admin_select" on public.email_send_state;
create policy "email_send_state_admin_select"
  on public.email_send_state
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.suppressed_emails (
  email text primary key,
  reason text not null,
  source text,
  created_at timestamptz not null default now()
);

alter table public.suppressed_emails enable row level security;

drop policy if exists "suppressed_emails_admin_select" on public.suppressed_emails;
create policy "suppressed_emails_admin_select"
  on public.suppressed_emails
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid,
  email_type text not null,
  recipient_email text,
  status text not null,
  provider_status integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_send_log_registration_idx
  on public.email_send_log (registration_id, created_at desc);
create index if not exists email_send_log_status_idx
  on public.email_send_log (status, created_at desc);

alter table public.email_send_log enable row level security;

drop policy if exists "email_send_log_admin_select" on public.email_send_log;
create policy "email_send_log_admin_select"
  on public.email_send_log
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));