import { CATEGORIES, LETTERS, HAS_FIREBASE } from './config.js';
import { scoreRound } from './scoring.js';

let api;
export let uid = null;

export async function initBackend() {
  api = HAS_FIREBASE ? await import('./backend/firestore.js') : await import('./backend/local.js');
  uid = await api.init();
  return api.label;
}

const roomPath = (code) => `rooms/${code}`;
const roundPath = (code, n) => `rooms/${code}/rounds/${n}`;
const CODE_CHARS = 'ABCDEFGHJKLMNPRSTUVYZ23456789';

export const otherPlayer = (room) => room.playerOrder.find((p) => p !== uid);

function randomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

function pickLetter(used = []) {
  let pool = LETTERS.filter((l) => !used.includes(l));
  if (!pool.length) { pool = LETTERS; used = []; }
  const letter = pool[Math.floor(Math.random() * pool.length)];
  return { letter, usedLetters: [...used, letter] };
}

const emptyAnswers = () => Object.fromEntries(CATEGORIES.map((c) => [c.key, '']));

export async function createRoom(name, identity = null) {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const ok = await api.runTx(async (t) => {
      if (await t.get(roomPath(code))) return false;
      t.set(roomPath(code), {
        code,
        hostId: uid,
        players: { [uid]: { name, identity } },
        playerOrder: [uid],
        phase: 'lobby',
        round: 0,
        letter: null,
        usedLetters: [],
        finishedBy: null,
        scores: { [uid]: 0 },
        createdAt: Date.now()
      });
      return true;
    });
    if (ok) return code;
  }
  throw new Error('Oda kodu üretilemedi, tekrar dene.');
}

export async function joinRoom(code, name, identity = null) {
  code = code.trim().toUpperCase();
  await api.runTx(async (t) => {
    const room = await t.get(roomPath(code));
    if (!room) throw new Error('Bu kodla bir oda bulunamadı.');
    if (room.players[uid]) {
      t.update(roomPath(code), { [`players.${uid}.name`]: name });
      return;
    }
    if (room.playerOrder.length >= 2) throw new Error('Oda dolu.');
    t.update(roomPath(code), {
      [`players.${uid}`]: { name, identity },
      playerOrder: [...room.playerOrder, uid],
      [`scores.${uid}`]: 0
    });
  });
  return code;
}

export const subscribeRoom = (code, cb, onError) => api.subscribeDoc(roomPath(code), cb, onError);
export const subscribeRound = (code, n, cb) => api.subscribeDoc(roundPath(code, n), cb);
export const subscribeMessages = (code, cb) => api.subscribeMessages(code, cb);

export function sendMessage(code, name, text) {
  text = text.trim().slice(0, 500);
  if (!text) return;
  return api.addMessage(code, { uid, name, text });
}

// Lobi ya da tur sonundan yeni tura geçer. İki oyuncu aynı anda basarsa tek tur açılır.
export function startRound(code) {
  return api.runTx(async (t) => {
    const room = await t.get(roomPath(code));
    if (!room || room.playerOrder.length < 2) return;
    if (room.phase !== 'lobby' && room.phase !== 'roundEnd') return;
    const n = room.round + 1;
    const { letter, usedLetters } = pickLetter(room.usedLetters);
    const answers = Object.fromEntries(room.playerOrder.map((p) => [p, emptyAnswers()]));
    t.set(roundPath(code, n), { letter, answers, submitted: {}, verdicts: {}, points: null, totals: null });
    t.update(roomPath(code), { phase: 'playing', round: n, letter, usedLetters, finishedBy: null });
  });
}

// Yazarken taslak kaydı; süre dolup tur kapanınca son hali sunucuda olsun.
export function saveDraft(code, n, answers) {
  return api.update(roundPath(code, n), { [`answers.${uid}`]: answers });
}

export function submitAnswers(code, n, answers) {
  return api.update(roundPath(code, n), { [`answers.${uid}`]: answers, [`submitted.${uid}`]: true });
}

// "Bitirdim": rakibin 10 sn geri sayımını başlatır.
export async function finish(code, n, answers) {
  await submitAnswers(code, n, answers);
  await api.runTx(async (t) => {
    const room = await t.get(roomPath(code));
    if (room.phase !== 'playing' || room.round !== n || room.finishedBy) return;
    t.update(roomPath(code), { finishedBy: uid, finishedAt: Date.now() });
  });
}

// İki taraf da gönderdiyse (ya da force ile) değerlendirmeye geçer.
export function closeRound(code, n, force = false) {
  return api.runTx(async (t) => {
    const room = await t.get(roomPath(code));
    const round = await t.get(roundPath(code, n));
    if (room.phase !== 'playing' || room.round !== n) return;
    const all = room.playerOrder.every((p) => round.submitted?.[p]);
    if (!all && !force) return;
    t.update(roomPath(code), { phase: 'review' });
  });
}

// verdicts: { kategori: true(onay) | false(red) } — rakibin cevapları için.
export async function submitVerdicts(code, n, verdicts) {
  await api.update(roundPath(code, n), { [`verdicts.${uid}`]: verdicts });
  return tryScore(code, n);
}

export function tryScore(code, n) {
  return api.runTx(async (t) => {
    const room = await t.get(roomPath(code));
    const round = await t.get(roundPath(code, n));
    if (room.phase !== 'review' || room.round !== n) return;
    if (!room.playerOrder.every((p) => round.verdicts?.[p])) return;
    const { points, totals } = scoreRound(round, room.playerOrder);
    const scores = { ...room.scores };
    for (const p of room.playerOrder) scores[p] = (scores[p] || 0) + totals[p];
    t.update(roundPath(code, n), { points, totals });
    t.update(roomPath(code), { phase: 'roundEnd', scores });
  });
}
