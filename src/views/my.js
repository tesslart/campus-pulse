import { fetchMyEvents } from '../features/events.js';
import { fetchMyJoinedEvents } from '../features/members.js';
import { getUser } from '../features/auth.js';
import { humanizeError } from '../lib/errors.js';
import { eventCard, skeletonGrid, emptyState, errorState } from '../ui/components.js';
import { icons } from '../ui/icons.js';
import { openAuthModal } from '../ui/authModal.js';

/** «Мои записи»: вкладки «Я участвую» и «Мои события». */
let activeTab = 'joined';

export function renderMy(root) {
  const user = getUser();
  if (!user) {
    root.innerHTML = emptyState({
      title: 'Личный раздел',
      text: 'Войдите, чтобы видеть события, на которые вы записались, и управлять своими публикациями.',
      action: '<button class="btn btn--primary" type="button" data-login>Войти</button>',
    });
    root.querySelector('[data-login]').addEventListener('click', () => openAuthModal('login'));
    return { onUserChange: () => renderMy(root) };
  }

  root.innerHTML = `
    <header class="page-head">
      <h1 class="page-title">Мои записи</h1>
      <a class="btn btn--primary" href="#/new">${icons.plus(18)} Создать событие</a>
    </header>
    <div class="tabs" role="tablist" aria-label="Разделы">
      <button class="tab" role="tab" type="button" id="tab-joined" data-tab="joined">Я участвую</button>
      <button class="tab" role="tab" type="button" id="tab-created" data-tab="created">Мои события</button>
    </div>
    <section id="tab-panel" role="tabpanel" aria-live="polite"></section>`;

  const panel = root.querySelector('#tab-panel');

  async function load() {
    root.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === activeTab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    panel.setAttribute('aria-labelledby', `tab-${activeTab}`);
    panel.innerHTML = skeletonGrid(3);
    const tab = activeTab;
    try {
      const events = tab === 'joined' ? await fetchMyJoinedEvents(user.id) : await fetchMyEvents(user.id);
      if (tab !== activeTab || !panel.isConnected) return;
      if (!events.length) {
        panel.innerHTML = tab === 'joined'
          ? emptyState({ title: 'Вы пока никуда не записаны', text: 'Загляните в афишу — там точно найдётся что-то интересное.', action: '<a class="btn btn--primary" href="#/">Открыть афишу</a>' })
          : emptyState({ title: 'У вас нет событий', text: 'Опубликуйте первое событие — его увидят все студенты.', action: `<a class="btn btn--primary" href="#/new">${icons.plus(18)} Создать событие</a>` });
        return;
      }
      panel.innerHTML = `<div class="grid">${events
        .map((e) => eventCard(e, { isMine: e.creator_id === user.id, joined: tab === 'joined' }))
        .join('')}</div>`;
    } catch (err) {
      if (tab !== activeTab) return;
      panel.innerHTML = errorState({ text: humanizeError(err) });
    }
  }

  root.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    load();
  });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) load();
  });

  load();
  return { onUserChange: () => renderMy(root) };
}
