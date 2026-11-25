import { fetchEvents, countWeekEvents } from '../features/events.js';
import { fetchMyMemberEventIds } from '../features/members.js';
import { getUser } from '../features/auth.js';
import { CATEGORIES } from '../lib/constants.js';
import { esc, debounce } from '../lib/dom.js';
import { humanizeError } from '../lib/errors.js';
import { pluralRu } from '../lib/format.js';
import { eventCard, skeletonGrid, emptyState, errorState } from '../ui/components.js';
import { icons } from '../ui/icons.js';

/** Фильтры живут между переходами по страницам. */
const filters = { category: 'all', search: '', upcomingOnly: true };
const isFiltered = () => filters.category !== 'all' || filters.search.trim() !== '' || !filters.upcomingOnly;

let requestSeq = 0; // защита от гонки: показываем только ответ на последний запрос

export function renderCatalog(root) {
  root.innerHTML = `
    <section class="hero">
      <div class="hero__text">
        <h1 class="hero__title">Не пропусти то,<br /><span class="accent">что происходит.</span></h1>
        <p class="hero__subtitle">Люди, идеи и события рядом с тобой.</p>
      </div>
      <div class="stat" aria-live="polite">
        <span class="stat__value" id="week-count">—</span>
        <span class="stat__label" id="week-label">событий на неделе</span>
      </div>
    </section>

    <section class="toolbar" aria-label="Поиск и фильтры">
      <label class="search">
        <span class="search__icon">${icons.search(20)}</span>
        <span class="sr-only">Поиск по названию</span>
        <input class="search__input" id="search" type="search" placeholder="Найти мероприятие…"
               value="${esc(filters.search)}" autocomplete="off" maxlength="80" />
      </label>
      <div class="filters" role="group" aria-label="Категории">
        <div class="chips" id="chips">
          ${[{ id: 'all', label: 'Все' }, ...CATEGORIES].map((c) => `
            <button class="chip ${filters.category === c.id ? 'is-active' : ''}" type="button"
                    data-category="${c.id}" aria-pressed="${filters.category === c.id}">${c.label}</button>`).join('')}
        </div>
      </div>
      <div class="toolbar__row">
        <label class="switch">
          <input type="checkbox" id="upcoming" ${filters.upcomingOnly ? 'checked' : ''} />
          <span class="switch__track" aria-hidden="true"></span>
          <span>Только будущие события</span>
        </label>
        <button class="link-btn" type="button" id="reset" ${isFiltered() ? '' : 'hidden'}>Сбросить фильтры</button>
      </div>
    </section>

    <section aria-label="События" id="results" aria-live="polite"></section>`;

  const results = root.querySelector('#results');
  const searchInput = root.querySelector('#search');
  const resetBtn = root.querySelector('#reset');

  async function load() {
    const seq = ++requestSeq;
    resetBtn.hidden = !isFiltered();
    results.innerHTML = skeletonGrid();
    try {
      const user = getUser();
      const [events, joined] = await Promise.all([
        fetchEvents(filters),
        user ? fetchMyMemberEventIds(user.id).catch(() => new Set()) : Promise.resolve(new Set()),
      ]);
      if (seq !== requestSeq || !results.isConnected) return;

      if (!events.length) {
        results.innerHTML = isFiltered()
          ? emptyState({
              title: 'Ничего не нашлось',
              text: 'Нет подходящих событий. Попробуйте другой запрос или сбросьте фильтры.',
              action: '<button class="btn btn--ghost" type="button" data-reset>Сбросить фильтры</button>',
            })
          : emptyState({
              title: 'Афиша пока пустая',
              text: 'Станьте первым — опубликуйте событие, и его увидят все студенты.',
              action: `<a class="btn btn--primary" href="#/new">${icons.plus(18)} Создать событие</a>`,
            });
        return;
      }

      results.innerHTML = `
        <p class="results__count">${events.length} ${pluralRu(events.length, ['событие', 'события', 'событий'])}</p>
        <div class="grid">
          ${events.map((e) => eventCard(e, { isMine: user?.id === e.creator_id, joined: joined.has(e.id) })).join('')}
        </div>`;
    } catch (err) {
      if (seq !== requestSeq || !results.isConnected) return;
      results.innerHTML = errorState({ text: humanizeError(err) });
    }
  }

  async function loadWeekCount() {
    try {
      const n = await countWeekEvents();
      const valueEl = root.querySelector('#week-count');
      if (!valueEl) return;
      valueEl.textContent = n;
      root.querySelector('#week-label').textContent = `${pluralRu(n, ['событие', 'события', 'событий'])} на неделе`;
    } catch {
      /* счётчик — второстепенный, ошибку покажет основной список */
    }
  }

  function reset() {
    filters.category = 'all';
    filters.search = '';
    filters.upcomingOnly = true;
    searchInput.value = '';
    root.querySelector('#upcoming').checked = true;
    syncChips();
    load();
  }

  function syncChips() {
    root.querySelectorAll('.chip').forEach((chip) => {
      const active = chip.dataset.category === filters.category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  root.querySelector('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filters.category = chip.dataset.category;
    syncChips();
    chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    load();
  });

  searchInput.addEventListener('input', debounce(() => {
    filters.search = searchInput.value;
    load();
  }, 350));

  root.querySelector('#upcoming').addEventListener('change', (e) => {
    filters.upcomingOnly = e.target.checked;
    load();
  });

  resetBtn.addEventListener('click', reset);
  results.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) reset();
    if (e.target.closest('[data-retry]')) { load(); loadWeekCount(); }
  });

  load();
  loadWeekCount();
}
