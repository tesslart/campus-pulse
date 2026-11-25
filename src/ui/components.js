import { esc } from '../lib/dom.js';
import { CATEGORY_LABEL } from '../lib/constants.js';
import { cardDate, isPast } from '../lib/format.js';
import { categoryIcon, icons } from './icons.js';

/** Обложка карточки: цвет cover_style + пиктограмма категории + декоративное кольцо. */
export function cover(event, size = 'card') {
  return `<div class="cover cover--${esc(event.cover_style)} cover--${size}" aria-hidden="true">
      <span class="cover__icon">${categoryIcon(event.category, size === 'card' ? 36 : 48)}</span>
      <span class="cover__ring"></span>
    </div>`;
}

/**
 * Карточка события для сетки.
 * @param {object} event
 * @param {{ isMine?: boolean, joined?: boolean }} flags
 */
export function eventCard(event, { isMine = false, joined = false } = {}) {
  const past = isPast(event.starts_at);
  const badges = [
    isMine ? '<span class="badge badge--lavender">Ваше</span>' : '',
    joined ? '<span class="badge badge--mint">Вы участвуете</span>' : '',
    past ? '<span class="badge">Прошло</span>' : '',
  ].join('');
  return `
    <a class="card ${past ? 'card--past' : ''}" href="#/event/${esc(event.id)}" data-category="${esc(event.category)}">
      ${cover(event)}
      ${badges ? `<div class="card__badges">${badges}</div>` : ''}
      <div class="card__body">
        <span class="eyebrow">${esc(CATEGORY_LABEL[event.category] ?? event.category)}</span>
        <h3 class="card__title">${esc(event.title)}</h3>
        <p class="card__meta">${icons.calendar(16)}<span>${esc(cardDate(event.starts_at))}</span></p>
        <p class="card__meta">${icons.pin(16)}<span>${esc(event.location)}</span></p>
      </div>
    </a>`;
}

export function skeletonGrid(n = 6) {
  return `<div class="grid" aria-busy="true" aria-label="Загрузка событий">
    ${Array.from({ length: n }, () => `
      <div class="card card--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--cover"></div>
        <div class="card__body">
          <div class="skeleton skeleton--line" style="width:30%"></div>
          <div class="skeleton skeleton--line skeleton--lg" style="width:80%"></div>
          <div class="skeleton skeleton--line" style="width:55%"></div>
        </div>
      </div>`).join('')}
  </div>`;
}

export function emptyState({ title, text, action = '' }) {
  return `<div class="state state--empty">
      <div class="state__art" aria-hidden="true"><span></span><span></span><span></span></div>
      <h3 class="state__title">${title}</h3>
      <p class="state__text">${text}</p>
      ${action}
    </div>`;
}

export function errorState({ title = 'Не удалось загрузить данные', text, retry = true }) {
  return `<div class="state state--error" role="alert">
      <div class="state__icon">${navigator.onLine ? icons.alert(32) : icons.wifiOff(32)}</div>
      <h3 class="state__title">${title}</h3>
      <p class="state__text">${esc(text)}</p>
      ${retry ? `<button class="btn btn--ghost" type="button" data-retry>${icons.refresh(18)} Повторить</button>` : ''}
    </div>`;
}

export function loader(label = 'Загрузка…') {
  return `<div class="page-loader" role="status" aria-live="polite"><span class="spinner"></span><span>${label}</span></div>`;
}
