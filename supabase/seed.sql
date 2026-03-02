create extension if not exists pgcrypto;

-- ============================================
-- 1. Profiles table (linked to auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid and role = 'admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;
grant execute on function public.is_admin() to authenticated, anon;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'admin@test.com' then 'admin' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 2. Worksheets table
-- ============================================
create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  label text,
  country text,
  company text not null default 'alrajhi',
  created_at timestamptz not null default now()
);

alter table public.worksheets enable row level security;
alter table public.worksheets add column if not exists label text;
alter table public.worksheets add column if not exists country text;
alter table public.worksheets add column if not exists company text not null default 'alrajhi';
drop index if exists worksheets_slug_key;
create unique index if not exists worksheets_company_slug_key on public.worksheets (company, slug);

drop policy if exists "Anyone can read worksheets" on public.worksheets;
create policy "Anyone can read worksheets"
  on public.worksheets for select
  using (true);

drop policy if exists "Admins can manage worksheets" on public.worksheets;
create policy "Admins can manage worksheets"
  on public.worksheets for all
  using (public.is_admin(auth.uid()));

drop policy if exists "Authenticated users can manage worksheets" on public.worksheets;
create policy "Authenticated users can manage worksheets"
  on public.worksheets for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.worksheets (name, slug, label, company)
values ('Pilgrimage Affairs', 'Pilgrimage Affairs', 'مكاتب شؤون الحج', 'alrajhi')
on conflict (company, slug) do update set
  name = excluded.name,
  label = excluded.label,
  country = excluded.country;

insert into public.worksheets (name, slug, label, country, company)
values
  ('Niger', 'Niger', 'النيجر', 'النيجر', 'alrajhi'),
  ('Egypt', 'Egypt', 'مصر', 'مصر', 'alrajhi'),
  ('Pakistan', 'Pakistan', 'باكستان', 'باكستان', 'alrajhi')
on conflict (company, slug) do update set
  name = excluded.name,
  label = excluded.label,
  country = excluded.country;

-- ============================================
-- 3. User settings table
-- ============================================
create table if not exists public.settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  default_worksheet_id uuid references public.worksheets(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, company)
);

alter table public.settings enable row level security;

drop policy if exists "Users can read own settings" on public.settings;
create policy "Users can read own settings"
  on public.settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.settings;
create policy "Users can insert own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.settings;
create policy "Users can update own settings"
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================
-- 4. Timeline nodes table
-- ============================================
create table if not exists public.timeline_nodes (
  id bigint generated always as identity primary key,
  title text not null,
  date date not null,
  icon text not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  worksheet_id uuid references public.worksheets(id),
  created_at timestamptz not null default now()
);

alter table public.timeline_nodes enable row level security;

alter table public.timeline_nodes add column if not exists worksheet_id uuid;

update public.timeline_nodes
set worksheet_id = (select id from public.worksheets where slug = 'Pilgrimage Affairs')
where worksheet_id is null;

alter table public.timeline_nodes alter column worksheet_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'timeline_nodes_worksheet_id_fkey'
  ) then
    alter table public.timeline_nodes
      add constraint timeline_nodes_worksheet_id_fkey
      foreign key (worksheet_id) references public.worksheets(id) on delete cascade;
  end if;
end
$$;

create index if not exists idx_timeline_nodes_worksheet_id
  on public.timeline_nodes (worksheet_id);

drop policy if exists "Anyone can read timeline nodes" on public.timeline_nodes;
create policy "Anyone can read timeline nodes"
  on public.timeline_nodes for select
  using (true);

drop policy if exists "Admins can manage timeline nodes" on public.timeline_nodes;
create policy "Admins can manage timeline nodes"
  on public.timeline_nodes for all
  using (public.is_admin(auth.uid()));

drop policy if exists "Authenticated users can manage timeline nodes" on public.timeline_nodes;
create policy "Authenticated users can manage timeline nodes"
  on public.timeline_nodes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================
-- 5. Timeline tasks table (Saudia sub-tasks)
-- ============================================
create table if not exists public.timeline_tasks (
  id bigint generated always as identity primary key,
  node_id bigint references public.timeline_nodes(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  icon text,
  created_at timestamptz not null default now()
);

alter table public.timeline_tasks enable row level security;
alter table public.timeline_tasks add column if not exists is_done boolean not null default false;

drop policy if exists "Anyone can read timeline tasks" on public.timeline_tasks;
create policy "Anyone can read timeline tasks"
  on public.timeline_tasks for select
  using (true);

drop policy if exists "Admins can manage timeline tasks" on public.timeline_tasks;
create policy "Admins can manage timeline tasks"
  on public.timeline_tasks for all
  using (public.is_admin(auth.uid()));

drop policy if exists "Authenticated users can manage timeline tasks" on public.timeline_tasks;
create policy "Authenticated users can manage timeline tasks"
  on public.timeline_tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
