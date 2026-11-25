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

-- ---------------------------------------------------------------------
-- 1.1 Медиа события (миграция 002): фото и видео
--     photos    — пути файлов в Storage (bucket event-media), до 6 шт.,
--                 первый файл — обложка карточки;
--     video_url — ссылка на YouTube / Rutube / VK Видео.
--     ADD COLUMN IF NOT EXISTS — можно выполнить на уже созданной базе.
-- ---------------------------------------------------------------------
alter table public.events add column if not exists photos    text[] not null default '{}';
alter table public.events add column if not exists video_url text;

alter table public.events drop constraint if exists events_photos_check;
alter table public.events add  constraint events_photos_check
  check (cardinality(photos) <= 6);

alter table public.events drop constraint if exists events_video_url_check;
alter table public.events add  constraint events_video_url_check
  check (video_url is null or (char_length(video_url) <= 300 and video_url ~ '^https://'));

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
grant insert (title, description, category, starts_at, location, cover_style, photos, video_url)
  on table public.events to authenticated;
grant update (title, description, category, starts_at, location, cover_style, photos, video_url)
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
-- 6. Supabase Storage: фото событий
--    Публичный bucket: картинки афиши видны всем по ссылке.
--    Загружать / удалять можно только в СВОЮ папку: <user_id>/<файл>.
--    Лимит 5 МБ, только изображения — проверяется самим Storage.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event-media: read own files"         on storage.objects;
drop policy if exists "event-media: upload to own folder"   on storage.objects;
drop policy if exists "event-media: update own files"       on storage.objects;
drop policy if exists "event-media: delete own files"       on storage.objects;

-- SELECT нужен API Storage для удаления/перезаписи своих файлов.
-- Публичные ссылки на картинки работают и без этой политики.
create policy "event-media: read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "event-media: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "event-media: update own files"
  on storage.objects for update
  to authenticated
  using      (bucket_id = 'event-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'event-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "event-media: delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Проверка: в Table Editor должны появиться events и event_members
-- со значком "RLS enabled", в Storage — bucket event-media.
-- ---------------------------------------------------------------------
