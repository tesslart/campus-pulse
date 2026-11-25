import './style.css';
import { isConfigured } from './lib/supabaseClient.js';
import { initAuth, getUser, onUserChange, signOut } from './features/auth.js';
import { route, notFound, resolve, currentPath } from './router.js';
import { renderCatalog } from './views/catalog.js';
import { renderDetail } from './views/detail.js';
import { renderForm } from './views/form.js';
import { renderMy } from './views/my.js';
import { renderDeleted, renderNotFound, renderConfigMissing } from './views/misc.js';
import { openAuthModal } from './ui/authModal.js';
import { toast } from './ui/toast.js';
import { icons } from './ui/icons.js';
import { esc } from './lib/dom.js';
import { humanizeError } from './lib/errors.js';

const app = document.getElementById('app');
const view = document.getElementById('view');

route('/', renderCatalog);
route('/event/:id', renderDetail);
route('/new', (root) => renderForm(root));
route('/edit/:id', renderForm);
route('/my', renderMy);
route('/deleted', renderDeleted);
notFound(renderNotFound);

let currentView = null; // { onUserChange? } — то, что вернула текущая страница

async function render() {
  const { handler, params } = resolve();
  const path = currentPath();
  updateNav(path);
  view.innerHTML = '';
  // новый контейнер на каждую страницу: старые обработчики не «протекают»
  const page = document.createElement('div');
  page.className = 'page';
  view.replaceChildren(page);
  window.scrollTo({ top: 0 });
  currentView = (await handler(page, params)) ?? null;
  document.title = `${path === '/' ? 'Афиша' : page.querySelector('h1')?.textContent?.trim() || 'CAMPUS PULSE'} · CAMPUS PULSE`;
}

/* ---------- Шапка и мобильная навигация ---------- */
function renderHeader() {
  const user = getUser();
  const initial = user?.email?.[0]?.toUpperCase() ?? '';
  document.getElementById('header-auth').innerHTML = user
    ? `<a class="btn btn--primary btn--sm hide-mobile" href="#/new">${icons.plus(18)} Создать</a>
       <div class="user-chip" title="${esc(user.email)}">
         <span class="avatar" aria-hidden="true">${esc(initial)}</span>
         <span class="user-chip__email">${esc(user.email)}</span>
       </div>
       <button class="icon-btn" type="button" data-logout aria-label="Выйти">${icons.logout(20)}</button>`
    : `<button class="btn btn--primary btn--sm" type="button" data-open-login>Войти</button>`;

  document.getElementById('tabbar').innerHTML = `
    <a class="tabbar__item" href="#/" data-nav="/">${icons.grid(22)}<span>События</span></a>
    <a class="tabbar__item tabbar__item--create" href="#/new" data-nav="/new">${icons.plus(22)}<span>Создать</span></a>
    <a class="tabbar__item" href="#/my" data-nav="/my">${icons.heart(22)}<span>Мои</span></a>
    ${user
      ? `<button class="tabbar__item" type="button" data-logout>${icons.logout(22)}<span>Выйти</span></button>`
      : `<button class="tabbar__item" type="button" data-open-login>${icons.user(22)}<span>Войти</span></button>`}`;
  updateNav(currentPath());
}

function updateNav(path) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === path;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-open-login]')) openAuthModal('login');
  const logoutBtn = e.target.closest('[data-logout]');
  if (logoutBtn) {
    logoutBtn.disabled = true;
    try {
      await signOut();
      toast('Вы вышли из аккаунта', 'info');
    } catch (err) {
      toast(humanizeError(err), 'error');
    } finally {
      logoutBtn.disabled = false;
    }
  }
});

/* ---------- Сеть ---------- */
function updateOnline() {
  document.getElementById('offline').hidden = navigator.onLine;
}
window.addEventListener('online', () => { updateOnline(); toast('Соединение восстановлено', 'success'); });
window.addEventListener('offline', updateOnline);

/* ---------- Старт ---------- */
async function start() {
  updateOnline();
  if (!isConfigured) {
    renderConfigMissing(view);
    return;
  }

  // Ссылка из письма Supabase приходит с #access_token=… или #error=…
  const rawHash = window.location.hash;
  const authError = rawHash.startsWith('#error') ? new URLSearchParams(rawHash.slice(1)) : null;
  const fromEmailLink = rawHash.includes('access_token=');

  try {
    await initAuth();
  } catch (err) {
    toast(humanizeError(err, 'Не удалось проверить сессию.'), 'error');
  }

  if (authError) {
    toast(authError.get('error_code') === 'otp_expired'
      ? 'Ссылка из письма устарела. Войдите или запросите новое письмо.'
      : 'Не удалось подтвердить email.', 'error', 6000);
  } else if (fromEmailLink && getUser()) {
    toast('Email подтверждён — вы вошли!', 'success');
  }
  if (!rawHash.startsWith('#/')) history.replaceState(null, '', `${location.pathname}${location.search}#/`);

  renderHeader();
  onUserChange((user) => {
    renderHeader();
    if (currentView?.onUserChange) currentView.onUserChange(user);
    else render(); // каталог перерисуется с бейджами «Ваше / Вы участвуете»
  });
  window.addEventListener('hashchange', render);
  app.classList.add('is-ready');
  render();
}

start();
