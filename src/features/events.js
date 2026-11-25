import { supabase } from '../lib/supabaseClient.js';

const EVENT_FIELDS =
  'id, creator_id, title, description, category, starts_at, location, cover_style, photos, video_url, created_at';

/** Экранирование спецсимволов шаблона ILIKE, чтобы поиск «50%» работал буквально. */
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * F01 + F02: каталог с фильтрами. Фильтрация выполняется в БД.
 * @param {{ category?: string, search?: string, upcomingOnly?: boolean }} filters
 */
export async function fetchEvents({ category = 'all', search = '', upcomingOnly = true } = {}) {
  let query = supabase.from('events').select(EVENT_FIELDS).order('starts_at', { ascending: true });

  if (category !== 'all') query = query.eq('category', category);
  const q = search.trim();
  if (q) query = query.ilike('title', `%${escapeLike(q)}%`);
  if (upcomingOnly) query = query.gte('starts_at', new Date().toISOString());

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data;
}

export async function fetchEvent(id) {
  const { data, error } = await supabase.from('events').select(EVENT_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data; // null — не найдено
}

/** Количество событий на ближайшие 7 дней (только число, без загрузки строк). */
export async function countWeekEvents() {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('starts_at', now.toISOString())
    .lt('starts_at', weekLater.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** F05: события, созданные текущим пользователем. */
export async function fetchMyEvents(userId) {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('creator_id', userId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** F04: creator_id не передаём — БД проставит auth.uid() сама. */
export async function createEvent(payload) {
  const { data, error } = await supabase.from('events').insert(payload).select(EVENT_FIELDS).single();
  if (error) throw error;
  return data;
}

/** F05: если строка чужая, RLS вернёт 0 строк — считаем это ошибкой прав. */
export async function updateEvent(id, payload) {
  const { data, error } = await supabase.from('events').update(payload).eq('id', id).select(EVENT_FIELDS);
  if (error) throw error;
  if (!data.length) throw Object.assign(new Error('permission denied'), { code: '42501' });
  return data[0];
}

export async function deleteEvent(id) {
  const { data, error } = await supabase.from('events').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw Object.assign(new Error('permission denied'), { code: '42501' });
}
