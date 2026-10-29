import './style.css';
import { PRIVATE_EDITION, CATEGORIES, FINISH_COUNTDOWN_SEC, FINISH_GRACE_SEC } from './config.js';
import { h } from './dom.js';
import { startsWithLetter } from './scoring.js';
import * as game from './game.js';

const app = document.getElementById('app');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

let identity = null;
let backendReady = null;

// ---------- Açılış ----------

async function boot() {
  backendReady = game.initBackend();
  backendReady.catch((err) => showFatal(err));

  if (PRIVATE_EDITION) {
    const priv = await import('@edition');
    priv.showWelcome(app, (id) => {
      identity = id;
      if (!store.get('ish.name')) store.set('ish.name', priv.identityName(id));
      showHome();
    });
  } else {
    showStoreWelcome();
  }
  registerServiceWorker();
}

function showStoreWelcome() {
  app.replaceChildren(
    h('main', { class: 'screen welcome' },
      h('div', { class: 'logo-letters', 'aria-hidden': 'true' }, ...['İ', 'Ş', 'H'].map((l) => h('span', {}, l))),
      h('h1', { class: 'title' }, 'İsim Şehir Hayvan'),
      h('p', { class: 'muted' }, 'Arkadaşınla oda kodu üzerinden gerçek zamanlı oyna.'),
      h('button', { class: 'btn primary big', onclick: showHome }, 'Başla')
    )
  );
}

function showFatal(err) {
  console.error(err);
  app.replaceChildren(
    h('main', { class: 'screen welcome' },
      h('h1', { class: 'title' }, 'Bağlantı kurulamadı'),
      h('p', { class: 'muted' }, String(err?.message || err)),
      h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Tekrar dene')
    )
  );
}

// ---------- Ana menü ----------

function showHome(errorText = '') {
  leaveRoomView();
  const nameInput = h('input', { class: 'input', maxlength: 20, placeholder: 'Adın', value: store.get('ish.name') || '', autocomplete: 'nickname' });
  const codeInput = h('input', { class: 'input code-input', maxlength: 4, placeholder: 'KOD', autocapitalize: 'characters', autocomplete: 'off' });
  const error = h('p', { class: 'error' }, errorText);
  const lastRoom = store.get('ish.room');

  const getName = () => {
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Önce adını yaz.'; nameInput.focus(); return null; }
    store.set('ish.name', name);
    return name;
  };
  const run = async (btn, fn) => {
    error.textContent = '';
    btn.disabled = true;
    try { await backendReady; await fn(); } catch (e) { error.textContent = e.message || String(e); } finally { btn.disabled = false; }
  };

  const createBtn = h('button', { class: 'btn primary big', onclick: () => {
    const name = getName(); if (!name) return;
    run(createBtn, async () => enterRoom(await game.createRoom(name, identity)));
  } }, 'Oda Kur');

  const joinBtn = h('button', { class: 'btn', onclick: () => {
    const name = getName(); if (!name) return;
    if (codeInput.value.trim().length !== 4) { error.textContent = '4 haneli oda kodunu yaz.'; return; }
    run(joinBtn, async () => enterRoom(await game.joinRoom(codeInput.value, name, identity)));
  } }, 'Katıl');

  const rejoinBtn = lastRoom && h('button', { class: 'btn ghost', onclick: () => {
    const name = getName(); if (!name) return;
    run(rejoinBtn, async () => enterRoom(await game.joinRoom(lastRoom, name, identity)));
  } }, `Kaldığın odaya dön (${lastRoom})`);

  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });

  app.replaceChildren(
    h('main', { class: 'screen home' },
      h('h1', { class: 'title small' }, 'İsim Şehir Hayvan'),
      h('label', { class: 'field' }, h('span', {}, 'Adın'), nameInput),
      createBtn,
      h('div', { class: 'divider' }, h('span', {}, 'ya da')),
      h('div', { class: 'join-row' }, codeInput, joinBtn),
      rejoinBtn,
      error
    )
  );
}

// ---------- Oda ----------

let S = null; // aktif oda durumu

function leaveRoomView() {
  if (!S) return;
  S.unsubs.forEach((u) => u && u());
  clearInterval(S.timer);
  clearTimeout(S.graceTimer);
  clearTimeout(S.draftTimer);
  S = null;
}

function enterRoom(code) {
  leaveRoomView();
  store.set('ish.room', code);
  S = {
    code, room: null, round: null, roundN: 0, messages: [], unsubs: [], viewKey: null,
    chatOpen: false, seenMessages: 0, messagesLoaded: false, answers: {}, answersLoaded: 0, verdicts: null, verdictsRound: 0,
    countdownEnd: null, timer: null, graceTimer: null, draftTimer: null, roundUnsub: null
  };

  const shell = buildShell();
  app.replaceChildren(shell.root);
  S.shell = shell;

  S.unsubs.push(game.subscribeRoom(code, onRoom, (e) => showHome(e.message)));
  S.unsubs.push(game.subscribeMessages(code, onMessages));
  S.unsubs.push(() => S?.roundUnsub?.());
}

function buildShell() {
  const scoreboard = h('div', { class: 'scoreboard' });
  const body = h('section', { class: 'room-body' });
  const badge = h('span', { class: 'badge hidden' });
  const toast = h('div', { class: 'toast hidden' });
  const chat = buildChat();
  const root = h('div', { class: 'room' },
    h('header', { class: 'room-header' },
      h('button', { class: 'icon-btn', 'aria-label': 'Odadan çık', onclick: () => {
        if (confirm('Odadan çıkmak istiyor musun?')) { store.set('ish.room', null); showHome(); }
      } }, '←'),
      h('div', { class: 'room-code' }, 'Oda ', h('b', {}, S.code)),
      h('button', { class: 'icon-btn chat-btn', 'aria-label': 'Sohbet', onclick: () => toggleChat(true) }, '💬', badge)
    ),
    scoreboard,
    body,
    toast,
    chat.root
  );
  return { root, scoreboard, body, badge, toast, chat };
}

function onRoom(room) {
  if (!S) return;
  if (!room) { store.set('ish.room', null); showHome('Oda bulunamadı.'); return; }
  if (!room.players[game.uid]) { store.set('ish.room', null); showHome('Bu odada değilsin.'); return; }
  S.room = room;

  if (room.round && room.round !== S.roundN) {
    S.roundUnsub?.();
    S.roundN = room.round;
    S.round = null;
    S.roundUnsub = game.subscribeRound(S.code, room.round, onRound);
  }
  renderScoreboard();
  render();
}

function onRound(round) {
  if (!S || !round) return;
  S.round = round;
  const { room } = S;
  // Her iki taraf da gönderdiyse değerlendirmeye geç / değerlendirmeler tamamsa puanla.
  if (room.phase === 'playing' && room.playerOrder.every((p) => round.submitted?.[p])) game.closeRound(S.code, S.roundN);
  if (room.phase === 'review' && room.playerOrder.every((p) => round.verdicts?.[p])) game.tryScore(S.code, S.roundN);
  render();
}

function renderScoreboard() {
  const { room } = S;
  S.shell.scoreboard.replaceChildren(
    ...room.playerOrder.map((p) => h('div', { class: 'score-cell' + (p === game.uid ? ' me' : '') },
      h('span', { class: 'score-name' }, room.players[p].name + (p === game.uid ? ' (sen)' : '')),
      h('span', { class: 'score-value' }, room.scores?.[p] ?? 0)
    )),
    room.playerOrder.length < 2 ? h('div', { class: 'score-cell waiting' }, h('span', { class: 'score-name' }, 'Rakip bekleniyor…'), h('span', { class: 'score-value' }, '–')) : ''
  );
}

function render() {
  const { room } = S;
  const key = `${room.phase}:${room.round}`;
  const fresh = key !== S.viewKey;
  S.viewKey = key;
  const views = { lobby: renderLobby, playing: renderPlaying, review: renderReview, roundEnd: renderRoundEnd };
  views[room.phase]?.(fresh);
}

// ----- Lobi -----

function renderLobby() {
  const { room } = S;
  const ready = room.playerOrder.length === 2;
  const share = () => {
    const text = `İsim Şehir Hayvan oynayalım! Oda kodu: ${S.code}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(S.code).then(() => showToast('Kod kopyalandı'));
  };
  S.shell.body.replaceChildren(
    h('div', { class: 'card center' },
      h('p', { class: 'muted' }, 'Oda kodu'),
      h('div', { class: 'big-code' }, S.code),
      h('button', { class: 'btn ghost', onclick: share }, 'Kodu paylaş'),
      ready
        ? h('button', { class: 'btn primary big', onclick: (e) => { e.target.disabled = true; game.startRound(S.code); } }, 'Oyunu Başlat')
        : h('p', { class: 'pulse' }, 'Rakibinin bu kodla katılması bekleniyor…')
    ),
    rulesCard()
  );
}

function rulesCard() {
  return h('details', { class: 'card rules' },
    h('summary', {}, 'Kurallar ve puanlama'),
    h('ul', {},
      h('li', {}, 'Her turda rastgele bir harf gelir; tüm kategorileri o harfle doldur.'),
      h('li', {}, `Biri "Bitirdim" deyince diğerine ${FINISH_COUNTDOWN_SEC} saniye kalır.`),
      h('li', {}, 'Tur sonunda birbirinizin cevaplarını onaylar ya da reddedersiniz. Reddedilen cevap boş sayılır.'),
      h('li', {}, 'Aynı cevap 5, farklı cevap 10, sadece sen yazdıysan 20, boş 0 puan.')
    )
  );
}

// ----- Oyun -----

function renderPlaying(fresh) {
  const { room, round } = S;
  const mine = round?.answers?.[game.uid];

  if (fresh) {
    S.answers = Object.fromEntries(CATEGORIES.map((c) => [c.key, '']));
    S.answersLoaded = 0;
    S.countdownEnd = null;
    clearInterval(S.timer); clearTimeout(S.graceTimer);
    buildPlaying();
  }
  // Sayfa yenilendiyse taslak cevapları sunucudan geri yükle.
  if (round && S.answersLoaded !== room.round) {
    S.answersLoaded = room.round;
    if (mine) {
      Object.assign(S.answers, mine);
      S.shell.body.querySelectorAll('input[data-cat]').forEach((i) => { i.value = S.answers[i.dataset.cat] || ''; });
    }
  }
  updatePlaying();
}

function buildPlaying() {
  const { room } = S;
  const inputs = CATEGORIES.map(({ key, label }) => {
    const input = h('input', {
      class: 'input answer', 'data-cat': key, maxlength: 40, autocomplete: 'off', autocorrect: 'off',
      spellcheck: 'false', placeholder: `${room.letter} ile ${label.toLocaleLowerCase('tr-TR')}`
    });
    input.addEventListener('input', () => {
      S.answers[key] = input.value;
      updatePlaying();
      clearTimeout(S.draftTimer);
      S.draftTimer = setTimeout(() => game.saveDraft(S.code, S.roundN, S.answers), 400);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const all = [...S.shell.body.querySelectorAll('input[data-cat]')];
      const next = all[all.indexOf(input) + 1];
      next ? next.focus() : input.blur();
    });
    return h('label', { class: 'answer-row' }, h('span', { class: 'answer-label' }, label), input);
  });

  const finishBtn = h('button', { class: 'btn primary big finish-btn', onclick: async () => {
    finishBtn.disabled = true;
    clearTimeout(S.draftTimer);
    await game.finish(S.code, S.roundN, trimmed());
    // Rakip bağlantıyı kaybetmişse tur takılı kalmasın.
    S.graceTimer = setTimeout(() => S && game.closeRound(S.code, S.roundN, true), (FINISH_COUNTDOWN_SEC + FINISH_GRACE_SEC) * 1000);
  } }, 'Bitirdim');

  S.shell.body.replaceChildren(
    h('div', { class: 'letter-wrap' },
      h('span', { class: 'round-no' }, `${room.round}. tur`),
      h('div', { class: 'letter' }, room.letter)
    ),
    h('div', { class: 'status-banner hidden' }),
    h('div', { class: 'answers' }, ...inputs),
    finishBtn
  );
}

const trimmed = () => Object.fromEntries(Object.entries(S.answers).map(([k, v]) => [k, (v || '').trim()]));

function updatePlaying() {
  const { room, round } = S;
  const body = S.shell.body;
  const banner = body.querySelector('.status-banner');
  const finishBtn = body.querySelector('.finish-btn');
  if (!banner) return;
  const submitted = Boolean(round?.submitted?.[game.uid]);
  const opponentFinished = room.finishedBy && room.finishedBy !== game.uid;
  const allFilled = CATEGORIES.every((c) => (S.answers[c.key] || '').trim());

  body.querySelectorAll('input[data-cat]').forEach((i) => { i.disabled = submitted; });
  finishBtn.disabled = submitted || !allFilled;
  finishBtn.textContent = submitted ? 'Gönderildi' : allFilled ? 'Bitirdim' : 'Bitirmek için hepsini doldur';

  if (opponentFinished && !submitted && !S.countdownEnd) startCountdown();

  banner.classList.remove('hidden', 'danger', 'info');
  if (submitted && room.finishedBy === game.uid) {
    banner.classList.add('info');
    banner.textContent = `Bitirdin! Rakibinin ${FINISH_COUNTDOWN_SEC} saniyesi var…`;
  } else if (submitted) {
    banner.classList.add('info');
    banner.textContent = 'Cevapların gönderildi, tur kapanıyor…';
  } else if (opponentFinished) {
    banner.classList.add('danger');
    const left = Math.max(0, Math.ceil((S.countdownEnd - Date.now()) / 1000));
    banner.replaceChildren(h('span', {}, 'Rakibin bitirdi! '), h('b', { class: 'countdown' }, left), h('span', {}, ' sn'));
  } else {
    banner.classList.add('hidden');
  }
}

function startCountdown() {
  S.countdownEnd = Date.now() + FINISH_COUNTDOWN_SEC * 1000;
  navigator.vibrate?.(200);
  clearInterval(S.timer);
  S.timer = setInterval(async () => {
    if (!S) return;
    if (Date.now() >= S.countdownEnd) {
      clearInterval(S.timer);
      clearTimeout(S.draftTimer);
      document.activeElement?.blur();
      await game.submitAnswers(S.code, S.roundN, trimmed());
      game.closeRound(S.code, S.roundN);
    }
    updatePlaying();
  }, 250);
}

// ----- Değerlendirme -----

function renderReview() {
  const { room, round } = S;
  if (!round) return;
  const opp = game.otherPlayer(room);
  const oppAnswers = round.answers?.[opp] || {};
  const myAnswers = round.answers?.[game.uid] || {};
  const done = Boolean(round.verdicts?.[game.uid]);

  if (S.verdictsRound !== room.round) {
    S.verdictsRound = room.round;
    clearInterval(S.timer); clearTimeout(S.graceTimer);
    S.verdicts = Object.fromEntries(CATEGORIES.map(({ key }) =>
      [key, Boolean(oppAnswers[key]) && startsWithLetter(oppAnswers[key], room.letter)]));
  }

  const rows = CATEGORIES.map(({ key, label }) => {
    const ans = oppAnswers[key];
    const ok = S.verdicts[key];
    const wrongLetter = ans && !startsWithLetter(ans, room.letter);
    const toggle = ans
      ? h('div', { class: 'verdict' },
          h('button', { class: 'v-btn yes' + (ok ? ' on' : ''), disabled: done, 'aria-label': 'Onayla',
            onclick: () => { S.verdicts[key] = true; renderReview(); } }, '✓'),
          h('button', { class: 'v-btn no' + (!ok ? ' on' : ''), disabled: done, 'aria-label': 'Reddet',
            onclick: () => { S.verdicts[key] = false; renderReview(); } }, '✗'))
      : h('span', { class: 'muted' }, 'boş');
    return h('div', { class: 'review-row' + (ans && !ok ? ' rejected' : '') },
      h('div', { class: 'review-cat' }, label),
      h('div', { class: 'review-answers' },
        h('div', { class: 'opp-answer' }, ans || '—', wrongLetter ? h('small', { class: 'hint' }, ` (${room.letter} ile başlamıyor)`) : null),
        h('div', { class: 'my-answer muted' }, 'Sen: ', myAnswers[key] || '—')
      ),
      toggle
    );
  });

  S.shell.body.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, `${room.players[opp].name} adlı rakibinin cevapları`),
      h('p', { class: 'muted' }, `Harf: ${room.letter} — Uygun olmayanları reddet.`),
      ...rows
    ),
    done
      ? h('p', { class: 'pulse center' }, 'Rakibin senin cevaplarını değerlendiriyor…')
      : h('button', { class: 'btn primary big', onclick: (e) => {
          e.target.disabled = true;
          game.submitVerdicts(S.code, S.roundN, { ...S.verdicts });
        } }, 'Değerlendirmeyi Gönder')
  );
}

// ----- Tur sonu -----

function renderRoundEnd() {
  const { room, round } = S;
  if (!round?.points) return;
  const order = [game.uid, game.otherPlayer(room)];
  const rejected = (p, key) => round.verdicts?.[order.find((x) => x !== p)]?.[key] === false && round.answers?.[p]?.[key];

  const cell = (p, key) => h('td', { class: rejected(p, key) ? 'rejected' : '' },
    h('span', { class: 'ans' }, round.answers?.[p]?.[key] || '—'),
    h('span', { class: 'pts' }, `+${round.points[p][key]}`));

  S.shell.body.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, `${room.round}. tur bitti — Harf ${room.letter}`),
      h('table', { class: 'result-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), ...order.map((p) => h('th', {}, room.players[p].name)))),
        h('tbody', {},
          ...CATEGORIES.map(({ key, label }) => h('tr', {}, h('th', {}, label), ...order.map((p) => cell(p, key)))),
          h('tr', { class: 'total' }, h('th', {}, 'Tur'), ...order.map((p) => h('td', {}, `+${round.totals[p]}`))),
          h('tr', { class: 'total grand' }, h('th', {}, 'Toplam'), ...order.map((p) => h('td', {}, room.scores[p])))
        )
      )
    ),
    h('button', { class: 'btn primary big', onclick: (e) => { e.target.disabled = true; game.startRound(S.code); } }, 'Sonraki Tur'),
    rulesCard()
  );
}

// ---------- Sohbet ----------

function buildChat() {
  const list = h('div', { class: 'chat-list' });
  const input = h('input', { class: 'input', maxlength: 500, placeholder: 'Mesaj yaz…', enterkeyhint: 'send' });
  const send = () => {
    const text = input.value;
    input.value = '';
    if (text.trim()) game.sendMessage(S.code, S.room?.players[game.uid]?.name || store.get('ish.name'), text);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  const root = h('div', { class: 'chat-sheet', 'aria-hidden': 'true' },
    h('div', { class: 'chat-backdrop', onclick: () => toggleChat(false) }),
    h('div', { class: 'chat-panel' },
      h('div', { class: 'chat-head' }, h('b', {}, 'Sohbet'), h('button', { class: 'icon-btn', 'aria-label': 'Kapat', onclick: () => toggleChat(false) }, '✕')),
      list,
      h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); send(); } },
        input, h('button', { class: 'btn primary', type: 'submit' }, 'Gönder'))
    )
  );
  return { root, list, input };
}

function toggleChat(open) {
  S.chatOpen = open;
  S.shell.chat.root.classList.toggle('open', open);
  S.shell.chat.root.setAttribute('aria-hidden', String(!open));
  if (open) {
    S.seenMessages = S.messages.length;
    updateBadge();
    S.shell.chat.list.scrollTop = S.shell.chat.list.scrollHeight;
    setTimeout(() => S?.shell.chat.input.focus(), 150);
  }
}

function onMessages(messages) {
  if (!S) return;
  const prev = S.messages.length;
  S.messages = messages;
  const { list } = S.shell.chat;
  list.replaceChildren(
    ...(messages.length ? messages.map((m) => h('div', { class: 'msg' + (m.uid === game.uid ? ' mine' : '') },
      m.uid === game.uid ? null : h('span', { class: 'msg-name' }, m.name),
      h('span', { class: 'msg-text' }, m.text),
      h('span', { class: 'msg-time' }, new Date(m.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    )) : [h('p', { class: 'muted center' }, 'Henüz mesaj yok. İlk sen yaz!')])
  );
  list.scrollTop = list.scrollHeight;

  // İlk yüklemede eski mesajlar okunmuş sayılır.
  if (S.chatOpen || !S.messagesLoaded) S.seenMessages = messages.length;
  else if (messages.length > prev) {
    const last = messages.at(-1);
    if (last.uid !== game.uid) showToast(`${last.name}: ${last.text}`, () => toggleChat(true));
  }
  S.messagesLoaded = true;
  updateBadge();
}

function updateBadge() {
  const unread = S.messages.slice(S.seenMessages).filter((m) => m.uid !== game.uid).length;
  S.shell.badge.textContent = unread > 9 ? '9+' : unread;
  S.shell.badge.classList.toggle('hidden', unread <= 0);
}

function showToast(text, onclick) {
  const t = S?.shell.toast;
  if (!t) return;
  t.textContent = text;
  t.onclick = onclick ? () => { t.classList.add('hidden'); onclick(); } : null;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ---------- PWA ----------

function registerServiceWorker() {
  // Capacitor içinde dosyalar zaten yerelde; service worker'a gerek yok.
  if (window.Capacitor?.isNativePlatform?.() || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

boot();
