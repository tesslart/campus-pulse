import { supabase } from '../lib/supabaseClient.js';

/** Состояние участия текущего пользователя (RLS отдаёт только собственные строки). */
export async function isMember(eventId, userId) {
  const { data, error } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** id всех событий, на которые записан пользователь — для бейджей в каталоге. */
export async function fetchMyMemberEventIds(userId) {
  const { data, error } = await supabase.from('event_members').select('event_id').eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.event_id));
}

/** «Мои записи»: события, на которые записан пользователь. */
export async function fetchMyJoinedEvents(userId) {
  const { data, error } = await supabase
    .from('event_members')
    .select('joined_at, events (id, creator_id, title, description, category, starts_at, location, cover_style, photos, video_url)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data
    .filter((r) => r.events)
    .map((r) => ({ ...r.events, joined_at: r.joined_at }))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

/** Количество участников (функция БД возвращает только число, без персональных данных). */
export async function countMembers(eventId) {
  const { data, error } = await supabase.rpc('event_members_count', { p_event_id: eventId });
  if (error) throw error;
  return data ?? 0;
}

/** F06: запись. user_id проставляется в БД через default auth.uid(). */
export async function joinEvent(eventId) {
  const { error } = await supabase.from('event_members').insert({ event_id: eventId });
  // 23505 — повторная запись: состояние уже «участвую», это не ошибка для пользователя
  if (error && error.code !== '23505') throw error;
}

/** F06: отмена — удаляется только собственная строка. */
export async function leaveEvent(eventId, userId) {
  const { error } = await supabase
    .from('event_members')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}
