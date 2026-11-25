-- =====================================================================
-- CAMPUS PULSE — схема базы данных Supabase (PostgreSQL)
-- Запуск: Supabase Dashboard → SQL Editor → вставить файл целиком → Run.
-- Скрипт идемпотентный: его можно выполнить повторно.
--
-- Две ступени защиты:
--   1) GRANT  — какие операции и колонки вообще доступны ролям anon/authenticated;
--   2) RLS    — какие СТРОКИ доступны конкретному пользователю (auth.uid()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Таблица events — афиша
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id          uuid        primary key default gen_random_uuid(),
  creator_id  uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  title       text        not null check (char_length(btrim(title)) between 5 and 80),
  description text        not null check (char_length(btrim(description)) between 15 and 600),
  category    text        not null check (category in
                ('music', 'sport', 'culture', 'science', 'hobby', 'volunteer')),
  starts_at   timestamptz not null,
  location    text        not null check (char_length(btrim(location)) between 3 and 120),
  cover_style text        not null default 'lavender' check (cover_style in
                ('lavender', 'mint', 'coral', 'sun', 'ocean', 'night')),
  created_at  timestamptz not null default now()
);

create index if not exists events_starts_at_idx  on public.events (starts_at);
create index if not exists events_creator_id_idx on public.events (creator_id);
create index if not exists events_category_idx   on public.events (category);

-- ---------------------------------------------------------------------
-- 2. Таблица event_members — записи на события
--    Составной PK (event_id, user_id) технически запрещает повторную запись.
--    ON DELETE CASCADE: удаление события удаляет связанные записи.
-- ---------------------------------------------------------------------
create table if not exists public.event_members (
  event_id  uuid        not null references public.events (id) on delete cascade,
  user_id   uuid        not null default auth.uid()
                        references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_members_user_id_idx on public.event_members (user_id);

-- ---------------------------------------------------------------------
-- 3. Ступень 1 — GRANT (минимальные права)
--    Supabase по умолчанию выдаёт anon/authenticated ВСЕ права на новые
--    таблицы в public, поэтому сначала всё отзываем, потом выдаём нужное.
-- ---------------------------------------------------------------------
revoke all on table public.events        from anon, authenticated;
revoke all on table public.event_members from anon, authenticated;

-- Гость и пользователь читают афишу
grant select on table public.events to anon, authenticated;

-- Пользователь пишет только "контентные" колонки.
-- id, creator_id, created_at задаёт сама БД — подменить автора нельзя.
grant insert (title, description, category, starts_at, location, cover_style)
  on table public.events to authenticated;
grant update (title, description, category, starts_at, location, cover_style)
  on table public.events to authenticated;
grant delete on table public.events to authenticated;

-- Записи на события: читать/создавать/удалять (без UPDATE).
-- user_id и joined_at проставляются автоматически.
grant select on table public.event_members to authenticated;
grant insert (event_id) on table public.event_members to authenticated;
grant delete on table public.event_members to authenticated;

-- ---------------------------------------------------------------------
-- 4. Ступень 2 — Row Level Security
-- ---------------------------------------------------------------------
alter table public.events        enable row level security;
alter table public.event_members enable row level security;

-- events -------------------------------------------------------------
drop policy if exists "events: everyone can read"          on public.events;
drop policy if exists "events: author can insert"          on public.events;
drop policy if exists "events: author can update own"      on public.events;
drop policy if exists "events: author can delete own"      on public.events;

create policy "events: everyone can read"
  on public.events for select
  to anon, authenticated
  using (true);

create policy "events: author can insert"
  on public.events for insert
  to authenticated
  with check (
    creator_id = (select auth.uid())
    and starts_at > now()                 -- нельзя создать событие в прошлом
  );

create policy "events: author can update own"
  on public.events for update
  to authenticated
  using      (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "events: author can delete own"
  on public.events for delete
  to authenticated
  using (creator_id = (select auth.uid()));

-- event_members ------------------------------------------------------
drop policy if exists "members: read own"   on public.event_members;
drop policy if exists "members: join self"  on public.event_members;
drop policy if exists "members: leave self" on public.event_members;

-- Пользователь видит ТОЛЬКО свои записи (чужие списки участников закрыты)
create policy "members: read own"
  on public.event_members for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Записаться можно только за себя и только на будущее событие
create policy "members: join self"
  on public.event_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.starts_at > now()
    )
  );

-- Отменить можно только собственную запись
create policy "members: leave self"
  on public.event_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Счётчик участников без раскрытия персональных данных
--    SECURITY DEFINER обходит RLS, но возвращает только число.
-- ---------------------------------------------------------------------
create or replace function public.event_members_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.event_members
  where event_id = p_event_id;
$$;

revoke all     on function public.event_members_count(uuid) from public, anon, authenticated;
grant  execute on function public.event_members_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Проверка: в Table Editor должны появиться events и event_members
-- со значком "RLS enabled".
-- ---------------------------------------------------------------------
