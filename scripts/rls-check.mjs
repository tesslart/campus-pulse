/**
 * Проверка безопасности через настоящий API Supabase (T06, T07, T04, T01).
 * Работает от имени двух учебных аккаунтов — так же, как злоумышленник из консоли браузера.
 *
 * Запуск (значения НЕ коммитить!):
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
 *   USER_A_EMAIL=... USER_A_PASSWORD=... USER_B_EMAIL=... USER_B_PASSWORD=... \
 *   npm run test:rls
 * Или положите эти переменные в scripts/.env.test (файл в .gitignore).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

const envFile = new URL('./.env.test', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'USER_A_EMAIL', 'USER_A_PASSWORD', 'USER_B_EMAIL', 'USER_B_PASSWORD'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Не заданы переменные: ${missing.join(', ')}`);
  process.exit(2);
}

const mk = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = 0;
const pass = (id, msg) => console.log(`✅ ${id} PASS — ${msg}`);
const fail = (id, msg) => { failed++; console.log(`❌ ${id} FAIL — ${msg}`); };

const guest = mk();
const a = mk();
const b = mk();

async function login(client, email, password, name) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Не удалось войти как ${name}: ${error.message}`);
  return data.user;
}

const userA = await login(a, process.env.USER_A_EMAIL, process.env.USER_A_PASSWORD, 'A');
const userB = await login(b, process.env.USER_B_EMAIL, process.env.USER_B_PASSWORD, 'B');

// T01: гость читает, но не создаёт
{
  const { error: readErr } = await guest.from('events').select('id').limit(1);
  const { error: insErr } = await guest.from('events').insert({
    title: 'Гость пишет', description: 'Попытка гостя создать событие', category: 'hobby',
    starts_at: new Date(Date.now() + 864e5).toISOString(), location: 'Холл',
  });
  !readErr && insErr ? pass('T01', `гость читает афишу, вставка отклонена (${insErr.code})`) : fail('T01', 'гость смог создать событие или не смог читать');
}

// T02: A создаёт событие, B видит
const { data: ev, error: evErr } = await a.from('events').insert({
  title: 'RLS-тест: событие A', description: 'Временное событие для проверки безопасности',
  category: 'science', starts_at: new Date(Date.now() + 2 * 864e5).toISOString(), location: 'Лаборатория',
}).select().single();
if (evErr) { console.error('A не смог создать событие:', evErr.message); process.exit(1); }
{
  const { data } = await b.from('events').select('id').eq('id', ev.id);
  data?.length === 1 ? pass('T02', 'B видит событие A') : fail('T02', 'B не видит событие A');
}

// T04: повторная запись
{
  await b.from('event_members').insert({ event_id: ev.id });
  const { error } = await b.from('event_members').insert({ event_id: ev.id });
  const { count } = await b.from('event_members').select('*', { count: 'exact', head: true }).eq('event_id', ev.id);
  error?.code === '23505' && count === 1 ? pass('T04', 'повторная запись отклонена (23505), строка одна') : fail('T04', `ошибка=${error?.code}, строк=${count}`);
}

// T06: B не может изменить / удалить / присвоить событие A
{
  const upd = await b.from('events').update({ title: 'Взломано пользователем B' }).eq('id', ev.id).select();
  const del = await b.from('events').delete().eq('id', ev.id).select();
  const steal = await b.from('events').update({ creator_id: userB.id }).eq('id', ev.id).select();
  const { data: still } = await a.from('events').select('title, creator_id').eq('id', ev.id).single();
  const ok = (upd.data?.length ?? 0) === 0 && (del.data?.length ?? 0) === 0 && steal.error && still?.title === ev.title && still?.creator_id === userA.id;
  ok ? pass('T06', 'UPDATE/DELETE затронули 0 строк, смена автора запрещена') : fail('T06', 'B смог изменить событие A!');
}

// T07: B не читает записи A
{
  await a.from('event_members').insert({ event_id: ev.id });
  const { data } = await b.from('event_members').select('user_id').eq('user_id', userA.id);
  const { data: all } = await b.from('event_members').select('user_id');
  const ok = (data?.length ?? 0) === 0 && (all ?? []).every((r) => r.user_id === userB.id);
  ok ? pass('T07', 'B видит только собственные записи') : fail('T07', 'B прочитал чужие записи!');
}

// T05: B не может удалить запись A
{
  await b.from('event_members').delete().eq('event_id', ev.id).eq('user_id', userA.id);
  const { data } = await a.from('event_members').select('user_id').eq('event_id', ev.id);
  data?.length === 1 ? pass('T05', 'запись A не удалена пользователем B') : fail('T05', 'B удалил запись A!');
}

// MEDIA: Storage — только своя папка
{
  const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/png' });
  const ownPath = `${userA.id}/rls-test-${Date.now()}.png`;
  const own = await a.storage.from('event-media').upload(ownPath, png, { contentType: 'image/png' });
  const foreign = await b.storage.from('event-media').upload(`${userA.id}/hack-${Date.now()}.png`, png, { contentType: 'image/png' });
  await b.storage.from('event-media').remove([ownPath]);
  const { data: list } = await a.storage.from('event-media').list(userA.id, { search: ownPath.split('/')[1] });
  const ok = !own.error && foreign.error && list?.length === 1;
  ok ? pass('MEDIA', 'A загружает в свою папку, B не может загрузить к A и удалить файл A')
     : fail('MEDIA', `own=${own.error?.message ?? 'ok'}, foreign=${foreign.error ? 'denied' : 'ALLOWED'}, fileLeft=${list?.length}`);
  await a.storage.from('event-media').remove([ownPath]);
}

// Уборка: A удаляет своё событие (записи удалятся каскадно)
await a.from('events').delete().eq('id', ev.id);
await Promise.all([a.auth.signOut(), b.auth.signOut()]);

console.log(failed ? `\nИтог: ${failed} проверок провалено` : '\nИтог: все проверки пройдены');
process.exit(failed ? 1 : 0);
