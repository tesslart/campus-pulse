import { icons } from './icons.js';

/**
 * Простое модальное окно на <dialog>: фокус внутри, Esc закрывает.
 * Возвращает { dialog, close }.
 */
export function openModal(innerHtml, { className = '', onClose } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal ${className}`;
  dialog.innerHTML = `
    <div class="modal__box">
      <button class="icon-btn modal__close" type="button" aria-label="Закрыть">${icons.close(20)}</button>
      ${innerHtml}
    </div>`;
  document.body.append(dialog);

  const close = () => {
    if (!dialog.open) return;
    dialog.close();
  };
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  dialog.querySelector('.modal__close').addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // клик по подложке
  });
  dialog.showModal();
  return { dialog, close };
}

/** Окно подтверждения. Возвращает Promise<boolean>. */
export function confirmDialog({ title, text, confirmLabel = 'Подтвердить', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const { dialog, close } = openModal(
      `<h2 class="modal__title">${title}</h2>
       <p class="modal__text">${text}</p>
       <div class="modal__actions">
         <button class="btn btn--ghost" type="button" data-act="cancel">Отмена</button>
         <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-act="ok">${confirmLabel}</button>
       </div>`,
      { className: 'modal--confirm', onClose: () => resolve(result) },
    );
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="ok"]').addEventListener('click', () => {
      result = true;
      close();
    });
    dialog.querySelector('[data-act="cancel"]').focus();
  });
}
