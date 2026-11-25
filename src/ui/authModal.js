import { signIn, signUp } from '../features/auth.js';
import { humanizeError } from '../lib/errors.js';
import { LIMITS } from '../lib/constants.js';
import { esc } from '../lib/dom.js';
import { openModal } from './modal.js';
import { icons } from './icons.js';
import { toast } from './toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * F03: окно входа / регистрации.
 * @param {'login'|'register'} mode
 * @param {string} [reason] — подсказка, зачем нужен вход («чтобы участвовать»)
 */
export function openAuthModal(mode = 'login', reason = '') {
  let current = mode;
  const { dialog, close } = openModal(
    `<div class="auth">
       <div class="auth__brand">${icons.logo(18)} CAMPUS</div>
       <h2 class="auth__title" id="auth-title"></h2>
       <p class="auth__subtitle" id="auth-subtitle"></p>
       ${reason ? `<p class="auth__reason">${esc(reason)}</p>` : ''}
       <form class="form auth__form" novalidate>
         <div class="field">
           <label class="field__label" for="auth-email">Email</label>
           <input class="input" id="auth-email" name="email" type="email" autocomplete="email"
                  placeholder="you@university.kz" required />
           <p class="field__error" id="auth-email-error"></p>
         </div>
         <div class="field">
           <label class="field__label" for="auth-password">Пароль</label>
           <div class="input-wrap">
             <input class="input" id="auth-password" name="password" type="password"
                    autocomplete="current-password" placeholder="Минимум 6 символов" required />
             <button class="icon-btn input-wrap__btn" type="button" data-toggle-pass aria-label="Показать пароль">${icons.eye(20)}</button>
           </div>
           <p class="field__error" id="auth-password-error"></p>
         </div>
         <div class="form-alert" role="alert" hidden></div>
         <button class="btn btn--mint btn--block" type="submit"></button>
       </form>
       <p class="auth__switch"><span></span> <button class="link-btn" type="button" data-switch></button></p>
     </div>`,
    { className: 'modal--auth' },
  );

  const form = dialog.querySelector('form');
  const email = form.elements.email;
  const password = form.elements.password;
  const submit = form.querySelector('[type="submit"]');
  const alertBox = form.querySelector('.form-alert');

  function render() {
    const isLogin = current === 'login';
    dialog.querySelector('#auth-title').textContent = isLogin ? 'Войти' : 'Регистрация';
    dialog.querySelector('#auth-subtitle').textContent = isLogin
      ? 'Продолжай открывать новое.'
      : 'Создай аккаунт, чтобы публиковать события и участвовать.';
    submit.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
    password.autocomplete = isLogin ? 'current-password' : 'new-password';
    dialog.querySelector('.auth__switch span').textContent = isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
    dialog.querySelector('[data-switch]').textContent = isLogin ? 'Регистрация' : 'Войти';
    setAlert('');
    setFieldError(email, '');
    setFieldError(password, '');
  }

  function setFieldError(input, msg) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const errEl = dialog.querySelector(`#${input.id}-error`);
    errEl.textContent = msg;
    if (msg) input.setAttribute('aria-describedby', errEl.id);
  }

  function setAlert(msg, type = 'error') {
    alertBox.hidden = !msg;
    alertBox.className = `form-alert form-alert--${type}`;
    alertBox.textContent = msg;
  }

  function validate() {
    let ok = true;
    const e = email.value.trim();
    if (!e) { setFieldError(email, 'Введите email.'); ok = false; }
    else if (!EMAIL_RE.test(e)) { setFieldError(email, 'Похоже, в email опечатка.'); ok = false; }
    else setFieldError(email, '');

    if (!password.value) { setFieldError(password, 'Введите пароль.'); ok = false; }
    else if (password.value.length < LIMITS.password.min) {
      setFieldError(password, `Минимум ${LIMITS.password.min} символов.`); ok = false;
    } else setFieldError(password, '');
    return ok;
  }

  dialog.querySelector('[data-switch]').addEventListener('click', () => {
    current = current === 'login' ? 'register' : 'login';
    render();
  });

  dialog.querySelector('[data-toggle-pass]').addEventListener('click', (e) => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    e.currentTarget.innerHTML = show ? icons.eyeOff(20) : icons.eye(20);
    e.currentTarget.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAlert('');
    if (!validate()) return;

    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      if (current === 'login') {
        await signIn(email.value.trim(), password.value);
        toast('Вы вошли в аккаунт', 'success');
        close();
      } else {
        const { needsConfirmation } = await signUp(email.value.trim(), password.value);
        if (needsConfirmation) {
          setAlert('Мы отправили письмо со ссылкой. Подтвердите email и затем войдите.', 'success');
          current = 'login';
          password.value = '';
          submit.textContent = 'Войти';
          dialog.querySelector('#auth-title').textContent = 'Проверьте почту';
        } else {
          toast('Аккаунт создан, вы вошли', 'success');
          close();
        }
      }
    } catch (err) {
      // Показываем только понятный текст: ни токенов, ни ответа сервера
      setAlert(humanizeError(err, 'Не удалось выполнить вход. Попробуйте ещё раз.'));
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });

  render();
  email.focus();
}
