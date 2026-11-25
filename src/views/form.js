import { createEvent, updateEvent, fetchEvent } from '../features/events.js';
import { getUser } from '../features/auth.js';
import { CATEGORIES, CATEGORY_LABEL, COVER_STYLES, LIMITS, MEDIA } from '../lib/constants.js';
import { parseVideoUrl, photoUrl, uploadPhoto, removePhotos, checkImageFile } from '../features/media.js';
import { esc } from '../lib/dom.js';
import { humanizeError } from '../lib/errors.js';
import { toLocalInput, cardDate } from '../lib/format.js';
import { cover, errorState, loader, emptyState } from '../ui/components.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openAuthModal } from '../ui/authModal.js';
import { navigate } from '../router.js';

/** Правила валидации — те же, что CHECK-ограничения в supabase/schema.sql. */
export function validateEvent(values) {
  const errors = {};
  const len = (s) => s.trim().length;
  const { title: t, description: d, location: l } = LIMITS;

  if (!len(values.title)) errors.title = 'Введите название.';
  else if (len(values.title) < t.min || len(values.title) > t.max) errors.title = `Название: от ${t.min} до ${t.max} символов.`;

  if (!CATEGORIES.some((c) => c.id === values.category)) errors.category = 'Выберите категорию из списка.';

  if (!values.starts_at) errors.starts_at = 'Укажите дату и время.';
  else {
    const date = new Date(values.starts_at);
    if (Number.isNaN(date.getTime())) errors.starts_at = 'Некорректная дата.';
    else if (date.getTime() <= Date.now()) errors.starts_at = 'Нельзя выбрать время в прошлом.';
    else if (date.getFullYear() > new Date().getFullYear() + 2) errors.starts_at = 'Слишком далёкая дата.';
  }

  if (!len(values.location)) errors.location = 'Укажите место.';
  else if (len(values.location) < l.min || len(values.location) > l.max) errors.location = `Место: от ${l.min} до ${l.max} символов.`;

  if (!len(values.description)) errors.description = 'Добавьте описание.';
  else if (len(values.description) < d.min || len(values.description) > d.max) errors.description = `Описание: от ${d.min} до ${d.max} символов.`;

  if (!COVER_STYLES.some((c) => c.id === values.cover_style)) errors.cover_style = 'Выберите стиль обложки.';

  if (values.video_url?.trim()) {
    if (values.video_url.trim().length > 300) errors.video_url = 'Слишком длинная ссылка.';
    else if (!parseVideoUrl(values.video_url)) errors.video_url = 'Вставьте ссылку на видео YouTube, Rutube или VK Видео.';
  }
  if ((values.photosCount ?? 0) > MEDIA.maxPhotos) errors.photos = `Не больше ${MEDIA.maxPhotos} фото.`;
  return errors;
}

/**
 * Экран 03: создание (id отсутствует) и редактирование (id задан).
 */
export async function renderForm(root, { id } = {}) {
  const user = getUser();
  if (!user) {
    root.innerHTML = emptyState({
      title: 'Нужно войти',
      text: 'Создавать события могут только авторизованные пользователи.',
      action: '<button class="btn btn--primary" type="button" data-login>Войти или зарегистрироваться</button>',
    });
    root.querySelector('[data-login]').addEventListener('click', () => openAuthModal('login', 'Войдите, чтобы опубликовать событие.'));
    return { onUserChange: () => renderForm(root, { id }) };
  }

  let initial = {
    title: '', category: 'hobby', starts_at: '', location: '', description: '', cover_style: 'lavender',
    photos: [], video_url: '',
  };

  if (id) {
    root.innerHTML = loader('Загружаем событие…');
    try {
      const event = await fetchEvent(id);
      if (!root.isConnected) return;
      if (!event) {
        root.innerHTML = emptyState({ title: 'Событие не найдено', text: 'Возможно, оно уже удалено.', action: '<a class="btn btn--primary" href="#/">К афише</a>' });
        return;
      }
      if (event.creator_id !== user.id) {
        root.innerHTML = emptyState({ title: 'Нет доступа', text: 'Редактировать событие может только его автор.', action: `<a class="btn btn--primary" href="#/event/${esc(id)}">К событию</a>` });
        return;
      }
      initial = { ...event, starts_at: toLocalInput(event.starts_at) };
    } catch (err) {
      root.innerHTML = errorState({ text: humanizeError(err) });
      root.querySelector('[data-retry]').addEventListener('click', () => renderForm(root, { id }));
      return;
    }
  }

  const minDate = toLocalInput(new Date(Date.now() + 5 * 60 * 1000));

  root.innerHTML = `
    <a class="back-link" href="${id ? `#/event/${esc(id)}` : '#/'}">${icons.back(18)} ${id ? 'Назад к событию' : 'Назад к событиям'}</a>
    <div class="form-layout">
      <form class="panel form event-form" novalidate>
        <h1 class="form__title">${id ? 'Редактировать событие' : 'Расскажи о своём событии'}</h1>
        <p class="form__subtitle">${id ? 'Изменения сразу появятся в афише.' : 'Заполни детали — и оно появится в общей афише.'}</p>

        ${field('title', 'Название', `<input class="input" id="f-title" name="title" maxlength="${LIMITS.title.max}"
             placeholder="Например, Вечер настольных игр" value="${esc(initial.title)}" required />`,
             counter('title', initial.title, LIMITS.title.max))}

        <div class="form__row">
          ${field('category', 'Категория', `<select class="input select" id="f-category" name="category" required>
              ${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === initial.category ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>`)}
          ${field('starts_at', 'Дата и время', `<input class="input" id="f-starts_at" name="starts_at" type="datetime-local"
               min="${minDate}" value="${esc(initial.starts_at)}" required />`)}
        </div>

        ${field('location', 'Место', `<input class="input" id="f-location" name="location" maxlength="${LIMITS.location.max}"
             placeholder="Коворкинг, 3 этаж" value="${esc(initial.location)}" required />`)}

        ${field('description', 'Описание', `<textarea class="input textarea" id="f-description" name="description" rows="5"
             maxlength="${LIMITS.description.max}" placeholder="Что будет, для кого, что взять с собой…" required>${esc(initial.description)}</textarea>`,
             counter('description', initial.description, LIMITS.description.max))}

        <fieldset class="field">
          <legend class="field__label">Фото <span class="field__hint">до ${MEDIA.maxPhotos} шт. · первое станет обложкой</span></legend>
          <div class="media-grid" id="media-grid"></div>
          <input class="sr-only" type="file" id="f-photos" accept="${MEDIA.allowedTypes.join(',')}" multiple tabindex="-1" />
          <p class="field__error" id="f-photos-error"></p>
        </fieldset>

        ${field('video_url', 'Видео', `<input class="input" id="f-video_url" name="video_url" type="url" inputmode="url" maxlength="300"
             placeholder="Ссылка на YouTube, Rutube или VK Видео" value="${esc(initial.video_url ?? '')}" />`,
             '<span class="field__counter">необязательно</span>')}
        <p class="video-status" id="video-status" aria-live="polite"></p>

        <fieldset class="field">
          <legend class="field__label">Цвет обложки <span class="field__hint">если нет фото</span></legend>
          <div class="swatches">
            ${COVER_STYLES.map((c) => `
              <label class="swatch">
                <input type="radio" name="cover_style" value="${c.id}" ${c.id === initial.cover_style ? 'checked' : ''} />
                <span class="swatch__color cover--${c.id}"></span>
                <span class="swatch__label">${c.label}</span>
              </label>`).join('')}
          </div>
          <p class="field__error" id="f-cover_style-error"></p>
        </fieldset>

        <div class="form-alert" role="alert" hidden></div>

        <div class="form__actions">
          <button class="btn btn--mint" type="submit">${id ? 'Сохранить изменения' : 'Опубликовать событие'}</button>
          <a class="btn btn--ghost" href="${id ? `#/event/${esc(id)}` : '#/'}">Отмена</a>
        </div>
      </form>

      <aside class="form-preview" aria-label="Предпросмотр карточки">
        <p class="eyebrow">Предпросмотр</p>
        <div id="preview"></div>
      </aside>
    </div>`;

  const form = root.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  const alertBox = form.querySelector('.form-alert');
  const touched = new Set();
  const FIELDS = ['title', 'category', 'starts_at', 'location', 'description', 'photos', 'video_url', 'cover_style'];

  /** Фото в форме: уже загруженные (path) и новые (file + локальный предпросмотр). */
  const originalPaths = [...(initial.photos ?? [])];
  let photos = originalPaths.map((path) => ({ path, src: photoUrl(path) }));
  const grid = root.querySelector('#media-grid');
  const fileInput = root.querySelector('#f-photos');

  function renderPhotos() {
    grid.innerHTML = photos.map((p, i) => `
      <div class="media-thumb">
        <img src="${esc(p.src)}" alt="Фото ${i + 1}" />
        ${i === 0 ? '<span class="media-thumb__badge">Обложка</span>' : ''}
        <div class="media-thumb__actions">
          ${i > 0 ? `<button class="media-thumb__btn" type="button" data-cover="${i}" aria-label="Сделать фото ${i + 1} обложкой" title="Сделать обложкой">${icons.star(16)}</button>` : ''}
          <button class="media-thumb__btn" type="button" data-remove="${i}" aria-label="Удалить фото ${i + 1}" title="Удалить">${icons.close(16)}</button>
        </div>
      </div>`).join('') + (photos.length < MEDIA.maxPhotos ? `
      <button class="media-add" type="button" data-add>
        ${icons.upload(24)}
        <span>Добавить фото</span>
        <small>или перетащите сюда</small>
      </button>` : '');
    updatePreview();
  }

  function addFiles(files) {
    const errorsList = [];
    for (const file of files) {
      if (photos.length >= MEDIA.maxPhotos) { errorsList.push(`Можно добавить не больше ${MEDIA.maxPhotos} фото.`); break; }
      const err = checkImageFile(file);
      if (err) { errorsList.push(err); continue; }
      photos.push({ file, src: URL.createObjectURL(file) });
    }
    root.querySelector('#f-photos-error').textContent = errorsList.join(' ');
    renderPhotos();
  }

  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) return fileInput.click();
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const [removed] = photos.splice(Number(rm.dataset.remove), 1);
      if (removed.file) URL.revokeObjectURL(removed.src);
      root.querySelector('#f-photos-error').textContent = '';
      renderPhotos();
      grid.querySelector('[data-add], [data-remove]')?.focus();
    }
    const cv = e.target.closest('[data-cover]');
    if (cv) {
      const [item] = photos.splice(Number(cv.dataset.cover), 1);
      photos.unshift(item);
      renderPhotos();
    }
  });
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
  grid.addEventListener('dragover', (e) => { e.preventDefault(); grid.classList.add('is-dragover'); });
  grid.addEventListener('dragleave', () => grid.classList.remove('is-dragover'));
  grid.addEventListener('drop', (e) => {
    e.preventDefault();
    grid.classList.remove('is-dragover');
    addFiles([...e.dataTransfer.files]);
  });

  function updateVideoStatus() {
    const raw = form.elements.video_url.value.trim();
    const info = raw ? parseVideoUrl(raw) : null;
    const el = root.querySelector('#video-status');
    el.innerHTML = info ? `${icons.check(16)} Видео ${esc(info.provider)} будет показано на странице события` : '';
  }

  const values = () => ({
    title: form.elements.title.value,
    category: form.elements.category.value,
    starts_at: form.elements.starts_at.value,
    location: form.elements.location.value,
    description: form.elements.description.value,
    cover_style: form.querySelector('[name="cover_style"]:checked')?.value ?? '',
    video_url: form.elements.video_url.value,
    photosCount: photos.length,
  });

  function showErrors(errors, onlyTouched = false) {
    for (const name of FIELDS) {
      const msg = onlyTouched && !touched.has(name) ? '' : errors[name] ?? '';
      const errEl = root.querySelector(`#f-${name}-error`);
      errEl.textContent = msg;
      const input = root.querySelector(`#f-${name}`);
      if (input) {
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        input.setAttribute('aria-describedby', errEl.id);
      }
    }
  }

  function updatePreview() {
    const v = values();
    root.querySelector('#preview').innerHTML = `
      <div class="card card--preview">
        ${cover({ category: v.category, cover_style: v.cover_style || 'lavender' }, 'card', photos[0]?.src)}
        <div class="card__body">
          <span class="eyebrow">${esc(CATEGORY_LABEL[v.category] ?? '')}</span>
          <h3 class="card__title">${esc(v.title.trim() || 'Название события')}</h3>
          <p class="card__meta">${icons.calendar(16)}<span>${v.starts_at ? esc(cardDate(new Date(v.starts_at).toISOString())) : 'Дата и время'}</span></p>
          <p class="card__meta">${icons.pin(16)}<span>${esc(v.location.trim() || 'Место')}</span></p>
        </div>
      </div>`;
    for (const name of ['title', 'description']) {
      const c = root.querySelector(`#f-${name}-counter`);
      if (c) c.textContent = `${v[name].trim().length} / ${LIMITS[name].max}`;
    }
  }

  form.addEventListener('input', () => {
    updatePreview();
    updateVideoStatus();
    showErrors(validateEvent(values()), true);
  });
  form.addEventListener('focusout', (e) => {
    // пустое поле не «ругаем» при простом уходе фокуса — только после ввода или отправки
    if (e.target.name && e.target.value.trim()) touched.add(e.target.name);
    showErrors(validateEvent(values()), true);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.disabled) return; // защита от двойного клика
    alertBox.hidden = true;

    const v = values();
    const errors = validateEvent(v);
    FIELDS.forEach((n) => touched.add(n));
    showErrors(errors);
    if (Object.keys(errors).length) {
      root.querySelector(`#f-${Object.keys(errors)[0]}`)?.focus();
      return;
    }

    const payload = {
      title: v.title.trim(),
      category: v.category,
      starts_at: new Date(v.starts_at).toISOString(), // timestamptz
      location: v.location.trim(),
      description: v.description.trim(),
      cover_style: v.cover_style,
      video_url: v.video_url.trim() || null,
    };

    const label = submit.textContent;
    submit.disabled = true;
    submit.classList.add('is-loading');
    const uploaded = []; // новые файлы этой попытки — удалим, если сохранить событие не получится
    try {
      const fresh = photos.filter((p) => !p.path);
      for (const [i, item] of fresh.entries()) {
        submit.textContent = `Загружаем фото ${i + 1} из ${fresh.length}…`;
        item.path = await uploadPhoto(user.id, item.file);
        uploaded.push(item);
      }
      payload.photos = photos.map((p) => p.path);

      submit.textContent = id ? 'Сохраняем…' : 'Публикуем…';
      const saved = id ? await updateEvent(id, payload) : await createEvent(payload);
      // удалённые при редактировании фото больше не нужны в Storage
      removePhotos(originalPaths.filter((p) => !payload.photos.includes(p)));
      toast(id ? 'Изменения сохранены' : 'Событие опубликовано!', 'success');
      navigate(`/event/${saved.id}`);
    } catch (err) {
      // Данные формы НЕ сбрасываются — пользователь может просто повторить отправку
      alertBox.hidden = false;
      alertBox.className = 'form-alert form-alert--error';
      await removePhotos(uploaded.map((p) => p.path));
      uploaded.forEach((p) => delete p.path);
      const reason = err.code === 'file_too_large'
        ? `Фото «${err.fileName}» больше ${MEDIA.maxFileMb} МБ даже после сжатия.`
        : humanizeError(err, 'Не удалось сохранить событие.');
      alertBox.textContent = `${reason} Введённые данные и фото сохранены в форме.`;
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submit.textContent = label;
    }
  });

  renderPhotos();
  updateVideoStatus();
  form.elements.title.focus();
  return { onUserChange: (u) => { if (!u) navigate('/'); } };
}

function field(name, label, control, extra = '') {
  return `<div class="field">
      <div class="field__head">
        <label class="field__label" for="f-${name}">${label}</label>${extra}
      </div>
      ${control}
      <p class="field__error" id="f-${name}-error"></p>
    </div>`;
}

function counter(name, value, max) {
  return `<span class="field__counter" id="f-${name}-counter" aria-hidden="true">${String(value ?? '').trim().length} / ${max}</span>`;
}
