create extension if not exists pgcrypto;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  source text not null default 'waitlist page',
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists waitlist_email_unique_idx
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;

comment on table public.waitlist is 'Founder waitlist submissions captured from the Entrepreneuria site.';