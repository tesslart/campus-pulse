import { esc } from '../lib/dom.js';
import { CATEGORY_LABEL } from '../lib/constants.js';
import { cardDate, isPast } from '../lib/format.js';
import { categoryIcon, icons } from './icons.js';
import { photoUrl } from '../features/media.js';

/**
 * Обложка карточки: первое фото события или цвет cover_style + пиктограмма категории.
 * @param {object} event
 * @param {'card'|'hero'} size
 * @param {string} [previewSrc] — локальный blob: для предпросмотра в форме
 */
export function cover(event, size = 'card', previewSrc = '') {
  const src = previewSrc || (event.photos?.length ? photoUrl(event.photos[0]) : '');
  if (src) {
    return `<div class="cover cover--photo cover--${size}" aria-hidden="true">
        <img src="${esc(src)}" alt="" loading="lazy" decoding="async" />
      </div>`;
  }
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
  const media = [
    event.video_url ? `<span class="media-pill">${icons.play(14)} Видео</span>` : '',
    event.photos?.length > 1 ? `<span class="media-pill">${icons.image(14)} ${event.photos.length}</span>` : '',
  ].join('');
  return `
    <a class="card ${past ? 'card--past' : ''}" href="#/event/${esc(event.id)}" data-category="${esc(event.category)}">
      <div class="card__cover">
        ${cover(event)}
        ${media ? `<div class="card__media">${media}</div>` : ''}
      </div>
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
