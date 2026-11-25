import { supabase } from '../lib/supabaseClient.js';

/** Текущий пользователь (null — гость). Обновляется через onAuthStateChange. */
let currentUser = null;
const listeners = new Set();

export const getUser = () => currentUser;

export function onUserChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setUser(user) {
  const changed = (user?.id ?? null) !== (currentUser?.id ?? null);
  currentUser = user;
  if (changed) listeners.forEach((fn) => fn(user));
}

/** Вызывается один раз при старте: восстанавливает сессию (в т.ч. из ссылки подтверждения email). */
export async function initAuth() {
  const { data, error } = await supabase.auth.getSession();
  currentUser = error ? null : data.session?.user ?? null;
  supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
  return currentUser;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Регистрация. Если в проекте включено подтверждение email, сессии ещё нет —
 * возвращаем { needsConfirmation: true }.
 */
export async function signUp(email, password) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  // Supabase не раскрывает, что email уже занят: возвращает пользователя без identities
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('User already registered');
  }
  return { user: data.user, needsConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
