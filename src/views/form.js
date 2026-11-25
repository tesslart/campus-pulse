import { createEvent, updateEvent, fetchEvent } from '../features/events.js';
import { getUser } from '../features/auth.js';
import { CATEGORIES, CATEGORY_LABEL, COVER_STYLES, LIMITS } from '../lib/constants.js';
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
          <legend class="field__label">Цвет обложки</legend>
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

  const values = () => ({
    title: form.elements.title.value,
    category: form.elements.category.value,
    starts_at: form.elements.starts_at.value,
    location: form.elements.location.value,
    description: form.elements.description.value,
    cover_style: form.querySelector('[name="cover_style"]:checked')?.value ?? '',
  });

  function showErrors(errors, onlyTouched = false) {
    for (const name of ['title', 'category', 'starts_at', 'location', 'description', 'cover_style']) {
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
        ${cover({ category: v.category, cover_style: v.cover_style || 'lavender' })}
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
    ['title', 'category', 'starts_at', 'location', 'description', 'cover_style'].forEach((n) => touched.add(n));
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
    };

    const label = submit.textContent;
    submit.disabled = true;
    submit.classList.add('is-loading');
    submit.textContent = id ? 'Сохраняем…' : 'Публикуем…';
    try {
      const saved = id ? await updateEvent(id, payload) : await createEvent(payload);
      toast(id ? 'Изменения сохранены' : 'Событие опубликовано!', 'success');
      navigate(`/event/${saved.id}`);
    } catch (err) {
      // Данные формы НЕ сбрасываются — пользователь может просто повторить отправку
      alertBox.hidden = false;
      alertBox.className = 'form-alert form-alert--error';
      alertBox.textContent = `${humanizeError(err, 'Не удалось сохранить событие.')} Введённые данные сохранены в форме.`;
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submit.textContent = label;
    }
  });

  updatePreview();
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
