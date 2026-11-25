import { esc } from '../lib/dom.js';
import { icons } from '../ui/icons.js';
import { getLastDeleted } from '../router.js';

/** Вариант Г: понятный экран подтверждения после удаления. */
export function renderDeleted(root) {
  const title = getLastDeleted();
  root.innerHTML = `
    <div class="state state--success">
      <div class="state__icon state__icon--success">${icons.check(36)}</div>
      <h1 class="state__title">Событие удалено</h1>
      <p class="state__text">${title ? `«${esc(title)}» больше не отображается в афише. ` : ''}Записи участников удалены автоматически.</p>
      <div class="state__actions">
        <a class="btn btn--primary" href="#/">К афише</a>
        <a class="btn btn--ghost" href="#/my">Мои события</a>
      </div>
    </div>`;
}

export function renderNotFound(root) {
  root.innerHTML = `
    <div class="state state--empty">
      <h1 class="state__title">Страница не найдена</h1>
      <p class="state__text">Похоже, ссылка устарела.</p>
      <a class="btn btn--primary" href="#/">К афише</a>
    </div>`;
}

export function renderConfigMissing(root) {
  root.innerHTML = `
    <div class="state state--error">
      <div class="state__icon">${icons.alert(32)}</div>
      <h1 class="state__title">Supabase не подключён</h1>
      <p class="state__text">Создайте файл <code>.env.local</code> по образцу <code>.env.example</code>
        и укажите <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        Для GitHub Pages добавьте их в Settings → Secrets and variables → Actions → Variables.</p>
    </div>`;
}
