import { esc } from '../lib/dom.js';
import { icons } from './icons.js';

/** Всплывающие уведомления: success / error / info. Озвучиваются скринридерами (aria-live). */
export function toast(message, type = 'info', timeout = 4000) {
  const root = document.getElementById('toasts');
  // не больше трёх уведомлений одновременно
  while (root.children.length >= 3) root.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${type === 'error' ? icons.alert(20) : icons.check(20)}<span>${esc(message)}</span>`;
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}
