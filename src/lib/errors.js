/**
 * Превращает ошибки сети / Supabase / Auth в понятный русский текст.
 * Технические детали (токены, ответы сервера) пользователю не показываются.
 */
export function isNetworkError(error) {
  if (!navigator.onLine) return true;
  const msg = String(error?.message ?? error ?? '');
  return (
    error?.name === 'AbortError' ||
    error?.name === 'AuthRetryableFetchError' ||
    /Failed to fetch|NetworkError|Load failed|network|aborted|timeout/i.test(msg)
  );
}

export function humanizeError(error, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  if (!error) return fallback;
  if (isNetworkError(error)) return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';

  const code = error.code ?? '';
  const msg = String(error.message ?? '');

  // PostgreSQL / PostgREST
  if (code === '23505') return 'Такая запись уже существует — вы уже участвуете.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'Недостаточно прав для этого действия.';
  if (code === '23514') return 'Данные не прошли проверку базы данных. Проверьте поля формы.';
  if (code === 'PGRST116') return 'Запись не найдена.';
  if (code === 'PGRST301' || /JWT expired/i.test(msg)) return 'Сессия истекла. Войдите заново.';

  // Supabase Auth
  if (/Invalid login credentials/i.test(msg)) return 'Неверный email или пароль.';
  if (/Email not confirmed/i.test(msg)) return 'Email не подтверждён. Откройте письмо и перейдите по ссылке.';
  if (/already registered|already been registered/i.test(msg)) return 'Пользователь с таким email уже зарегистрирован.';
  if (/Password should be at least/i.test(msg)) return 'Пароль слишком короткий — минимум 6 символов.';
  if (/weak password|Password is known/i.test(msg)) return 'Пароль слишком простой. Придумайте надёжнее.';
  if (/rate limit|too many/i.test(msg)) return 'Слишком много попыток. Подождите немного и повторите.';
  if (/invalid.*email|Unable to validate email/i.test(msg)) return 'Некорректный email.';
  if (/Signups not allowed/i.test(msg)) return 'Регистрация временно отключена.';

  return fallback;
}
