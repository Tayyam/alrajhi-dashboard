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
-- 2. Timeline nodes table
-- ============================================
create table if not exists public.timeline_nodes (
  id bigint generated always as identity primary key,
  title text not null,
  date date not null,
  icon text not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

alter table public.timeline_nodes enable row level security;

create policy "Anyone can read timeline nodes"
  on public.timeline_nodes for select
  using (true);

create policy "Admins can manage timeline nodes"
  on public.timeline_nodes for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- 3. Seed timeline data
-- ============================================
insert into public.timeline_nodes (title, date, icon, progress, sort_order) values
  ('بداية وصول الحجاج',                               '2026-04-18', 'pilgrim',       0,   1),
  ('استلام المخيمات جاهزة',                            '2026-04-18', 'camping',       0,   2),
  ('ادخال بيانات الاستعداد المسبق',                     '2026-03-25', 'approved',      0,   3),
  ('اصدار التأشيرات',                                  '2026-03-20', 'passport',      0,   4),
  ('رفع بيانات الحجاج وتكوين المجموعات',                '2026-02-08', 'group',        100,  5),
  ('الانتهاء من التعاقدات على خدمات النقل',              '2026-02-01', 'logistic',     100,  6),
  ('الانتهاء من التعاقدات على السكن',                    '2026-02-01', 'home',         100,  7),
  ('تحويل الأموال للسكن وخدمات النقل',                   '2026-01-20', 'accommodation',100,  8),
  ('تعيين الناقلات الجوية وجدولة الرحلات',               '2026-01-04', 'airplane',     100,  9),
  ('التعاقد على حزم الخدمات ودفع قيمتها',                '2026-01-04', 'box',          100, 10),
  ('تحويل الأموال المطلوبة للتعاقد على الخدمات الأساسية', '2025-12-21', 'credit-card',  100, 11),
  ('توقيع اتفاقية رغبات التفويج',                       '2025-11-09', 'application',  100, 12),
  ('توثيق التعاقدات مع الشركات في مؤتمر الحج',           '2025-11-09', 'contract',     100, 13),
  ('توقيع اتفاقياة وترتيب شؤون الحجاج',                 '2025-11-09', 'agreement',    100, 14),
  ('الموعد النهائي لإعلان تسجيل الحجاج',                 '2025-10-12', 'calendar',     100, 15),
  ('بدأ الاجتماعات التحضيرية',                          '2025-10-12', 'people',       100, 16),
  ('تأكيد الاحتفاظ بالمخيمات من الموسم السابق',          '2025-08-23', 'folder',       100, 17),
  ('الاطلاع على بيانات المخيمات عبر منصة نسك مسار',      '2025-07-26', 'data',         100, 18),
  ('استلام نموذج التوعية للضيوف الرحمن',                 '2025-06-08', 'checklist',    100, 19),
  ('استلام وثيقة الترتيبات الأولية والبرنامج',           '2025-06-08', 'document',     100, 20);
