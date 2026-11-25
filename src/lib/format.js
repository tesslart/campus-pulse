const tz = undefined; // часовой пояс пользователя

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Пт · 18:30» */
export function shortDateTime(iso) {
  const d = new Date(iso);
  const wd = capitalize(new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: tz }).format(d));
  return `${wd} · ${time(iso)}`;
}

/** «29 нояб. · Пт · 18:30» */
export function cardDate(iso) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: tz }).format(d);
  return `${day.replace('.', '')} · ${shortDateTime(iso)}`;
}

export function time(iso) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));
}

/** { day: '29', month: 'ноября' } */
export function dayMonth(iso) {
  const parts = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: tz }).formatToParts(new Date(iso));
  return {
    day: parts.find((p) => p.type === 'day')?.value ?? '',
    month: parts.find((p) => p.type === 'month')?.value ?? '',
  };
}

/** «воскресенье, 29 ноября 2026, 19:00» */
export function longDate(iso) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(iso));
}

/** Значение для <input type="datetime-local"> в локальном времени: 2026-11-30T18:30 */
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const isPast = (iso) => new Date(iso).getTime() <= Date.now();

export function pluralRu(n, [one, few, many]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
