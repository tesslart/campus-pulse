/**
 * Hash-роутер: #/, #/event/:id, #/new, #/edit/:id, #/my, #/deleted.
 * Hash-маршруты работают на GitHub Pages без настройки сервера.
 */
const routes = [];
let notFoundHandler = null;
let lastDeleted = '';

export const setLastDeleted = (t) => { lastDeleted = t; };
export const getLastDeleted = () => lastDeleted;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  routes.push({ re, keys, handler });
}

export const notFound = (handler) => { notFoundHandler = handler; };

export function currentPath() {
  const hash = window.location.hash;
  return hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '/';
}

export function navigate(path) {
  if (currentPath() === path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = path;
}

export function resolve(path = currentPath()) {
  for (const { re, keys, handler } of routes) {
    const m = path.match(re);
    if (m) {
      const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { handler, params };
    }
  }
  return { handler: notFoundHandler, params: {} };
}
