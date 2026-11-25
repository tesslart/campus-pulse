import { fetchEvent, deleteEvent } from '../features/events.js';
import { isMember, joinEvent, leaveEvent, countMembers } from '../features/members.js';
import { getUser } from '../features/auth.js';
import { CATEGORY_LABEL } from '../lib/constants.js';
import { esc } from '../lib/dom.js';
import { humanizeError } from '../lib/errors.js';
import { dayMonth, shortDateTime, longDate, isPast, pluralRu } from '../lib/format.js';
import { errorState, loader, emptyState } from '../ui/components.js';
import { icons, categoryIcon } from '../ui/icons.js';
import { openAuthModal } from '../ui/authModal.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { photoUrl, parseVideoUrl, removePhotos } from '../features/media.js';
import { toast } from '../ui/toast.js';
import { navigate, setLastDeleted } from '../router.js';

const CATEGORY_SLUG = { music: 'MUSIC', sport: 'SPORT', culture: 'CULTURE', science: 'SCIENCE', hobby: 'HOBBY', volunteer: 'VOLUNTEER' };

export async function renderDetail(root, { id }) {
  root.innerHTML = loader('Загружаем событие…');

  let event;
  try {
    event = await fetchEvent(id);
  } catch (err) {
    root.innerHTML = backLink() + errorState({ text: humanizeError(err) });
    root.querySelector('[data-retry]').addEventListener('click', () => renderDetail(root, { id }));
    return;
  }
  if (!root.isConnected) return;
  if (!event) {
    root.innerHTML = backLink() + emptyState({
      title: 'Событие не найдено',
      text: 'Возможно, автор удалил его или ссылка устарела.',
      action: '<a class="btn btn--primary" href="#/">К афише</a>',
    });
    return;
  }

  const { day, month } = dayMonth(event.starts_at);
  const past = isPast(event.starts_at);
  const photos = event.photos ?? [];
  const video = event.video_url ? parseVideoUrl(event.video_url) : null;
  const heroPhoto = photos.length ? photoUrl(photos[0]) : '';

  root.innerHTML = `
    ${backLink()}
    <article class="detail">
      <header class="detail__hero ${heroPhoto ? 'detail__hero--photo' : `cover--${esc(event.cover_style)}`}">
        ${heroPhoto
          ? `<img class="detail__hero-img" src="${esc(heroPhoto)}" alt="" />`
          : `<div class="detail__hero-deco" aria-hidden="true">${categoryIcon(event.category, 160)}</div>`}
        <div class="detail__hero-text">
          <span class="eyebrow eyebrow--light">CAMPUS / ${CATEGORY_SLUG[event.category] ?? ''} · ${esc(CATEGORY_LABEL[event.category] ?? '')}</span>
          <h1 class="detail__title">${esc(event.title)}</h1>
        </div>
        <div class="date-badge" aria-label="${esc(longDate(event.starts_at))}">
          <span class="date-badge__day">${esc(day)}</span>
          <span class="date-badge__month">${esc(month)}</span>
        </div>
      </header>

      <div class="detail__layout">
        <section class="detail__about">
          <h2 class="section-title">О событии</h2>
          <p class="detail__description">${esc(event.description)}</p>

          ${video ? `
          <h2 class="section-title section-title--spaced">Видео</h2>
          <div class="video-frame">
            <iframe src="${esc(video.embedUrl)}" title="Видео: ${esc(event.title)}" loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
          <a class="video-link" href="${esc(event.video_url)}" target="_blank" rel="noopener noreferrer">Открыть на ${esc(video.provider)} ↗</a>` : ''}

          ${photos.length ? `
          <h2 class="section-title section-title--spaced">Фото <span class="section-title__count">${photos.length}</span></h2>
          <div class="gallery">
            ${photos.map((p, i) => `
              <button class="gallery__item" type="button" data-photo="${i}" aria-label="Открыть фото ${i + 1} из ${photos.length}">
                <img src="${esc(photoUrl(p))}" alt="" loading="lazy" decoding="async" />
              </button>`).join('')}
          </div>` : ''}
        </section>

        <aside class="panel detail__panel" aria-label="Участие">
          <p class="panel__time">${icons.calendar(18)}<span>${esc(shortDateTime(event.starts_at).toUpperCase())}</span></p>
          <p class="panel__meta">${esc(longDate(event.starts_at))}</p>
          <p class="panel__meta">${icons.pin(18)}<span>${esc(event.location)}</span></p>
          <p class="panel__meta" id="members-count">${icons.users(18)}<span>…</span></p>
          <div id="join-area" class="panel__actions"></div>
          <div id="owner-area"></div>
        </aside>
      </div>
    </article>`;

  const joinArea = root.querySelector('#join-area');
  const ownerArea = root.querySelector('#owner-area');

  async function refreshCount() {
    try {
      const n = await countMembers(event.id);
      root.querySelector('#members-count span').textContent =
        n === 0 ? 'Пока никто не записался' : `${n} ${pluralRu(n, ['участник', 'участника', 'участников'])}`;
    } catch {
      root.querySelector('#members-count span').textContent = 'Участники: нет данных';
    }
  }

  /** Логика главной кнопки — по состоянию, которое пришло ИЗ БД. */
  async function renderJoin() {
    const user = getUser();
    const isOwner = user?.id === event.creator_id;

    ownerArea.innerHTML = isOwner
      ? `<div class="owner-actions">
           <p class="owner-actions__label">Вы автор события</p>
           <div class="owner-actions__row">
             <a class="btn btn--ghost" href="#/edit/${esc(event.id)}">${icons.edit(18)} Редактировать</a>
             <button class="btn btn--danger-ghost" type="button" data-delete>${icons.trash(18)} Удалить</button>
           </div>
         </div>`
      : '';

    if (past) {
      joinArea.innerHTML = '<button class="btn btn--block" type="button" disabled>Событие уже прошло</button>';
      return;
    }
    if (!user) {
      joinArea.innerHTML = '<button class="btn btn--mint btn--block" type="button" data-login>Войти, чтобы участвовать</button>';
      return;
    }

    joinArea.innerHTML = '<button class="btn btn--block is-loading" type="button" disabled>Проверяем…</button>';
    try {
      const joined = await isMember(event.id, user.id);
      joinArea.innerHTML = joined
        ? `<div class="joined" role="status">${icons.check(18)} Вы участвуете</div>
           <button class="btn btn--ghost btn--block" type="button" data-leave>Отменить участие</button>`
        : '<button class="btn btn--mint btn--block" type="button" data-join>Участвовать</button>';
    } catch (err) {
      joinArea.innerHTML = `<p class="field__error">${esc(humanizeError(err))}</p>
        <button class="btn btn--ghost btn--block" type="button" data-recheck>${icons.refresh(18)} Повторить</button>`;
    }
  }

  async function withButton(btn, label, action) {
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = label;
    try {
      await action();
    } catch (err) {
      toast(humanizeError(err), 'error');
    } finally {
      await Promise.all([renderJoin(), refreshCount()]); // актуальное состояние из БД
    }
  }

  root.addEventListener('click', async (e) => {
    const user = getUser();
    if (e.target.closest('[data-photo]')) {
      openLightbox(photos.map(photoUrl), Number(e.target.closest('[data-photo]').dataset.photo), event.title);
    } else if (e.target.closest('[data-login]')) {
      openAuthModal('login', 'Войдите, чтобы записаться на событие.');
    } else if (e.target.closest('[data-recheck]')) {
      renderJoin();
    } else if (e.target.closest('[data-join]')) {
      withButton(e.target.closest('[data-join]'), 'Записываем…', async () => {
        await joinEvent(event.id);
        toast('Вы записаны на событие!', 'success');
      });
    } else if (e.target.closest('[data-leave]')) {
      withButton(e.target.closest('[data-leave]'), 'Отменяем…', async () => {
        await leaveEvent(event.id, user.id);
        toast('Участие отменено', 'info');
      });
    } else if (e.target.closest('[data-delete]')) {
      const btn = e.target.closest('[data-delete]');
      const ok = await confirmDialog({
        title: 'Удалить событие?',
        text: `«${esc(event.title)}» исчезнет из афиши, а все записи участников будут удалены. Это действие нельзя отменить.`,
        confirmLabel: 'Удалить',
        danger: true,
      });
      if (!ok) return;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        await deleteEvent(event.id);
        removePhotos(photos); // файлы события больше не нужны
        setLastDeleted(event.title);
        navigate('/deleted');
      } catch (err) {
        toast(humanizeError(err, 'Не удалось удалить событие.'), 'error');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  });

  renderJoin();
  refreshCount();

  // Перерисовать кнопки, если пользователь вошёл/вышел, не покидая страницу
  return { onUserChange: renderJoin };
}

function backLink() {
  return `<a class="back-link" href="#/">${icons.back(18)} Назад к событиям</a>`;
}

/** Просмотр фото на весь экран: стрелки, свайп, Esc. */
function openLightbox(urls, start, title) {
  let index = start;
  const { dialog } = openModal(
    `<figure class="lightbox">
       <img class="lightbox__img" alt="" />
       <figcaption class="lightbox__caption"></figcaption>
       ${urls.length > 1 ? `
         <button class="lightbox__nav lightbox__nav--prev icon-btn" type="button" data-prev aria-label="Предыдущее фото">${icons.chevronLeft(28)}</button>
         <button class="lightbox__nav lightbox__nav--next icon-btn" type="button" data-next aria-label="Следующее фото">${icons.chevronRight(28)}</button>` : ''}
     </figure>`,
    { className: 'modal--lightbox' },
  );
  const img = dialog.querySelector('.lightbox__img');
  const caption = dialog.querySelector('.lightbox__caption');
  const show = (i) => {
    index = (i + urls.length) % urls.length;
    img.src = urls[index];
    img.alt = `${title} — фото ${index + 1}`;
    caption.textContent = `${index + 1} / ${urls.length}`;
  };
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-prev]')) show(index - 1);
    if (e.target.closest('[data-next]')) show(index + 1);
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  let touchX = null;
  img.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  show(index);
}
