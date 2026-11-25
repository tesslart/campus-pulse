-- =====================================================================
-- CAMPUS PULSE — автоматическая проверка GRANT + RLS
-- Запуск: Supabase Dashboard → SQL Editor → вставить файл → Run.
--
-- Скрипт создаёт двух ВРЕМЕННЫХ пользователей А и Б, выполняет запросы
-- от их имени (как это делает PostgREST) и в конце делает ROLLBACK —
-- в базе ничего не остаётся. Каждая проверка печатает PASS,
-- при первой ошибке скрипт останавливается с текстом FAIL.
-- =====================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'rls-user-a@example.test'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-user-b@example.test');

-- Вспомогательная функция: "войти" как пользователь (только в этой транзакции)
create or replace function pg_temp.login_as(p_user uuid) returns void
language plpgsql as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create temp table t_ctx (event_id uuid);
grant all on t_ctx to anon, authenticated;

-- T01. Гость видит события, но не может их создавать ---------------
do $$
declare n int;
begin
  perform pg_temp.login_as(null);
  select count(*) into n from public.events;          -- чтение разрешено
  begin
    insert into public.events (title, description, category, starts_at, location)
    values ('Гостевое событие', 'Гость пытается создать событие', 'hobby',
            now() + interval '1 day', 'Холл');
    raise exception 'FAIL T01: гость смог создать событие';
  exception when insufficient_privilege then
    raise notice 'PASS T01: гость читает афишу (% строк), но не создаёт события', n;
  end;
  reset role;
end $$;

-- T02. А создаёт событие, Б его видит -------------------------------
do $$
declare v_id uuid; n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000a');
  insert into public.events (title, description, category, starts_at, location, cover_style)
  values ('Ночь настольных игр', 'Играем в настолки и знакомимся с новыми людьми',
          'hobby', now() + interval '3 days', 'Коворкинг, 3 этаж', 'lavender')
  returning id into v_id;
  insert into t_ctx values (v_id);

  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  select count(*) into n from public.events where id = v_id;
  if n <> 1 then raise exception 'FAIL T02: Б не видит событие А'; end if;
  raise notice 'PASS T02: событие А видно пользователю Б';
  reset role;
end $$;

-- T03 + T04. Б записывается; повторная запись невозможна -----------
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  insert into public.event_members (event_id) values (v_id);
  select count(*) into n from public.event_members where event_id = v_id;
  if n <> 1 then raise exception 'FAIL T03: запись Б не найдена'; end if;
  raise notice 'PASS T03: Б записан, user_id проставлен автоматически';

  begin
    insert into public.event_members (event_id) values (v_id);
    raise exception 'FAIL T04: создана повторная запись';
  exception when unique_violation then
    raise notice 'PASS T04: повторная запись отклонена первичным ключом (23505)';
  end;
  reset role;
end $$;

-- T07. Б не читает чужие записи; А записывается на своё событие -----
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000a');
  insert into public.event_members (event_id) values (v_id);
  select count(*) into n from public.event_members;
  if n <> 1 then raise exception 'FAIL T07: А видит чужие записи (% строк)', n; end if;

  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  select count(*) into n from public.event_members
   where user_id = '00000000-0000-4000-a000-00000000000a';
  if n <> 0 then raise exception 'FAIL T07: Б прочитал записи А'; end if;

  select public.event_members_count(v_id) into n;
  if n <> 2 then raise exception 'FAIL: счётчик участников = %, ожидалось 2', n; end if;
  raise notice 'PASS T07: Б видит только свои записи; счётчик показывает только число (2)';
  reset role;
end $$;

-- T05. Б может отменить только собственное участие -----------------
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  delete from public.event_members
   where event_id = v_id and user_id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL T05: Б удалил запись А'; end if;

  delete from public.event_members where event_id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL T05: Б не смог отменить своё участие'; end if;
  raise notice 'PASS T05: Б отменил своё участие, запись А не затронута';
  reset role;
end $$;

-- T06. Б не может изменить и удалить событие А ---------------------
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  update public.events set title = 'Взломано!' where id = v_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL T06: Б изменил событие А'; end if;

  delete from public.events where id = v_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL T06: Б удалил событие А'; end if;

  begin
    insert into public.events (creator_id, title, description, category, starts_at, location)
    values ('00000000-0000-4000-a000-00000000000a', 'Подделка автора',
            'Б пытается создать событие от имени А', 'sport', now() + interval '1 day', 'Зал');
    raise exception 'FAIL T06: Б подменил creator_id';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.events set creator_id = '00000000-0000-4000-a000-00000000000b' where id = v_id;
    raise exception 'FAIL T06: Б сменил автора события';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS T06: Б не может изменить, удалить или присвоить событие А';
  reset role;
end $$;

-- T10 (БД). Событие в прошлом и короткое название не принимаются ---
do $$
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000a');
  begin
    insert into public.events (title, description, category, starts_at, location)
    values ('Прошлое событие', 'Событие с датой в прошлом', 'music',
            now() - interval '1 day', 'Актовый зал');
    raise exception 'FAIL T10: принято событие в прошлом';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.events (title, description, category, starts_at, location)
    values ('Бал', 'Слишком короткое название', 'music', now() + interval '1 day', 'Зал');
    raise exception 'FAIL T10: принято название короче 5 символов';
  exception when check_violation then null;
  end;
  raise notice 'PASS T10: БД отклоняет прошедшую дату и неверную длину полей';
  reset role;
end $$;

-- MEDIA. Фото и видео: своя папка в Storage, проверка ссылки -----
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  -- А добавляет фото и видео в своё событие
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000a');
  update public.events
     set photos = array['00000000-0000-4000-a000-00000000000a/cover.webp'],
         video_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
   where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MEDIA: автор не смог добавить фото/видео'; end if;

  begin
    update public.events set video_url = 'javascript:alert(1)' where id = v_id;
    raise exception 'FAIL MEDIA: принята небезопасная ссылка на видео';
  exception when check_violation then null;
  end;

  begin
    update public.events set photos = array['1','2','3','4','5','6','7'] where id = v_id;
    raise exception 'FAIL MEDIA: принято больше 6 фото';
  exception when check_violation then null;
  end;

  -- Storage: загрузка в свою папку разрешена
  insert into storage.objects (bucket_id, name)
  values ('event-media', '00000000-0000-4000-a000-00000000000a/test.webp');

  -- Б не может загрузить файл в папку А
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000b');
  begin
    insert into storage.objects (bucket_id, name)
    values ('event-media', '00000000-0000-4000-a000-00000000000a/fake.webp');
    raise exception 'FAIL MEDIA: Б загрузил файл в папку А';
  exception when insufficient_privilege then null;
  end;

  -- Б не видит файлы А через API (только публичные ссылки на картинки)
  select count(*) into n from storage.objects
   where name like '00000000-0000-4000-a000-00000000000a/%';
  if n <> 0 then raise exception 'FAIL MEDIA: Б видит файлы А в storage.objects'; end if;
  raise notice 'PASS MEDIA: фото/видео добавляет только автор, ссылки проверяются, Storage — только своя папка';
  reset role;
end $$;

-- Владелец удаляет своё событие, записи удаляются каскадно ----------
do $$
declare v_id uuid := (select event_id from t_ctx); n int;
begin
  perform pg_temp.login_as('00000000-0000-4000-a000-00000000000a');
  delete from public.events where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: владелец не смог удалить своё событие'; end if;
  reset role;
  select count(*) into n from public.event_members where event_id = v_id;
  if n <> 0 then raise exception 'FAIL: записи не удалились каскадно'; end if;
  raise notice 'PASS: владелец удалил событие, записи удалены ON DELETE CASCADE';
end $$;

rollback;  -- ничего не сохраняем
