// Sadece PRIVATE_EDITION=true derlemelerine giren özel karşılama ekranı.
import { h } from '../dom.js';
// Kimlik metinleri: varsa src/private/identities.js, yoksa identities.example.js (bkz. vite.config.js).
import { IDENTITIES } from '@identities';

export { IDENTITIES };

const KEY = 'ish.identity';

export function getIdentity() {
  try {
    const id = localStorage.getItem(KEY);
    return IDENTITIES[id] ? id : null;
  } catch { return null; }
}

function setIdentity(id) {
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch {}
}

export const identityName = (id) => IDENTITIES[id]?.label ?? null;

export function showWelcome(root, onEnter) {
  const id = getIdentity();
  if (!id) return showChoice(root, onEnter);

  const { emoji, message } = IDENTITIES[id];
  root.replaceChildren(
    h('main', { class: 'screen welcome private' },
      h('div', { class: 'hearts', 'aria-hidden': 'true' }, '💗 💞 💗'),
      h('div', { class: 'welcome-emoji' }, emoji),
      h('h1', { class: 'love-message' }, message),
      h('button', { class: 'btn primary big', onclick: () => onEnter(id) }, 'Oyuna Gir'),
      h('button', { class: 'link-btn', onclick: () => { setIdentity(null); showChoice(root, onEnter); } }, 'Ben o değilim')
    )
  );
}

function showChoice(root, onEnter) {
  const pick = (id) => { setIdentity(id); showWelcome(root, onEnter); };
  root.replaceChildren(
    h('main', { class: 'screen welcome' },
      h('h1', { class: 'title' }, 'Ben kimim?'),
      h('div', { class: 'identity-grid' },
        ...Object.entries(IDENTITIES).map(([id, { label, emoji }]) =>
          h('button', { class: 'identity-card', onclick: () => pick(id) },
            h('span', { class: 'identity-emoji' }, emoji),
            h('span', {}, label)
          )
        )
      ),
      h('p', { class: 'muted' }, 'Bu seçim bu cihazda hatırlanır.')
    )
  );
}
