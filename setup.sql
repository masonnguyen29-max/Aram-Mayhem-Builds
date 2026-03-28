-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)

create table builds (
  id uuid default gen_random_uuid() primary key,
  champion_id text not null,
  champion_name text not null,
  items jsonb not null default '[]',
  augments jsonb not null default '[]',
  is_win boolean not null,
  fun_rating integer not null check (fun_rating >= 1 and fun_rating <= 5),
  submitted_by text not null,
  notes text,
  created_at timestamptz default now()
);

alter table builds enable row level security;

create policy "Public read" on builds for select using (true);
create policy "Public insert" on builds for insert with check (true);
