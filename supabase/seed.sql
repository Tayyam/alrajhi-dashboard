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

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

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
  slug text not null unique,
  label text,
  country text,
  created_at timestamptz not null default now()
);

alter table public.worksheets enable row level security;
alter table public.worksheets add column if not exists label text;
alter table public.worksheets add column if not exists country text;

drop policy if exists "Anyone can read worksheets" on public.worksheets;
create policy "Anyone can read worksheets"
  on public.worksheets for select
  using (true);

drop policy if exists "Admins can manage worksheets" on public.worksheets;
create policy "Admins can manage worksheets"
  on public.worksheets for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

insert into public.worksheets (name, slug, label)
values ('Pilgrimage Affairs', 'Pilgrimage Affairs', 'مكاتب شؤون الحج')
on conflict (slug) do update set name = excluded.name, label = excluded.label, country = excluded.country;

insert into public.worksheets (name, slug, label, country)
values
  ('Niger', 'Niger', 'النيجر', 'النيجر'),
  ('Egypt', 'Egypt', 'مصر', 'مصر'),
  ('Pakistan', 'Pakistan', 'باكستان', 'باكستان')
on conflict (slug) do update set name = excluded.name, label = excluded.label, country = excluded.country;

-- ============================================
-- 3. Timeline nodes table
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
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- 4. Seed timeline data
-- ============================================
insert into public.timeline_nodes (title, date, icon, progress, worksheet_id) values
  ('بداية وصول الحجاج',                               '2026-04-18', 'pilgrim',       0, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('استلام المخيمات جاهزة',                            '2026-04-18', 'camping',       0, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('ادخال بيانات الاستعداد المسبق',                     '2026-03-25', 'approved',      0, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('اصدار التأشيرات',                                  '2026-03-20', 'passport',      0, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('رفع بيانات الحجاج وتكوين المجموعات',                '2026-02-08', 'group',        100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('الانتهاء من التعاقدات على خدمات النقل',              '2026-02-01', 'logistic',     100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('الانتهاء من التعاقدات على السكن',                    '2026-02-01', 'home',         100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('تحويل الأموال للسكن وخدمات النقل',                   '2026-01-20', 'accommodation',100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('تعيين الناقلات الجوية وجدولة الرحلات',               '2026-01-04', 'airplane',     100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('التعاقد على حزم الخدمات ودفع قيمتها',                '2026-01-04', 'box',          100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('تحويل الأموال المطلوبة للتعاقد على الخدمات الأساسية', '2025-12-21', 'credit-card',  100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('توقيع اتفاقية رغبات التفويج',                       '2025-11-09', 'application',  100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('توثيق التعاقدات مع الشركات في مؤتمر الحج',           '2025-11-09', 'contract',     100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('توقيع اتفاقياة وترتيب شؤون الحجاج',                 '2025-11-09', 'agreement',    100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('الموعد النهائي لإعلان تسجيل الحجاج',                 '2025-10-12', 'calendar',     100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('بدأ الاجتماعات التحضيرية',                          '2025-10-12', 'people',       100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('تأكيد الاحتفاظ بالمخيمات من الموسم السابق',          '2025-08-23', 'folder',       100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('الاطلاع على بيانات المخيمات عبر منصة نسك مسار',      '2025-07-26', 'data',         100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('استلام نموذج التوعية للضيوف الرحمن',                 '2025-06-08', 'checklist',    100, (select id from public.worksheets where slug = 'Pilgrimage Affairs')),
  ('استلام وثيقة الترتيبات الأولية والبرنامج',           '2025-06-08', 'document',     100, (select id from public.worksheets where slug = 'Pilgrimage Affairs'));
