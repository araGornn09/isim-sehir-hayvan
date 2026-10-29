// Firebase yapılandırılmamışken kullanılan yerel deneme altyapısı.
// Aynı tarayıcıdaki iki sekme localStorage üzerinden birbirini görür;
// her sekme ayrı bir oyuncudur (uid sessionStorage'da).
const PREFIX = 'ish-local:';
const listeners = new Map(); // path -> Set<cb>

function read(path) {
  try { return JSON.parse(localStorage.getItem(PREFIX + path)); } catch { return null; }
}
function write(path, data) {
  localStorage.setItem(PREFIX + path, JSON.stringify(data));
  emit(path);
}
function emit(path) {
  const data = read(path);
  (listeners.get(path) || []).forEach((cb) => cb(data));
}
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith(PREFIX)) emit(e.key.slice(PREFIX.length));
});

function applyPatch(obj, patch) {
  const out = structuredClone(obj);
  for (const [key, value] of Object.entries(patch)) {
    const parts = key.split('.');
    let cur = out;
    for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
    cur[parts.at(-1)] = value;
  }
  return out;
}

export async function init() {
  let uid = sessionStorage.getItem('ish-local-uid');
  if (!uid) {
    uid = 'local-' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('ish-local-uid', uid);
  }
  return uid;
}

export function subscribeDoc(path, cb) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(cb);
  queueMicrotask(() => cb(read(path)));
  return () => listeners.get(path).delete(cb);
}

export async function runTx(fn) {
  const writes = [];
  const result = await fn({
    get: async (path) => read(path),
    set: (path, data) => writes.push(() => write(path, data)),
    update: (path, patch) => writes.push(() => write(path, applyPatch(read(path) || {}, patch)))
  });
  writes.forEach((w) => w());
  return result;
}

export async function update(path, patch) {
  write(path, applyPatch(read(path) || {}, patch));
}

export async function addMessage(code, msg) {
  const path = `rooms/${code}/messages`;
  const list = read(path) || [];
  list.push({ id: Math.random().toString(36).slice(2), ...msg, at: Date.now() });
  write(path, list.slice(-200));
}

export function subscribeMessages(code, cb) {
  return subscribeDoc(`rooms/${code}/messages`, (list) => cb(list || []));
}

export const label = 'local';
