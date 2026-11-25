import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** true, если переменные окружения заданы (локально — .env.local, в CI — GitHub Variables). */
export const isConfigured = Boolean(url && key);

const REQUEST_TIMEOUT_MS = 15000;

/**
 * fetch с тайм-аутом: при плохой сети приложение показывает ошибку,
 * а не «висит» бесконечно.
 */
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (init.signal) init.signal.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: fetchWithTimeout },
    })
  : null;
