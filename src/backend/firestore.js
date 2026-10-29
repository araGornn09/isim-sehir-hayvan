import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import {
  initializeFirestore, doc, collection, onSnapshot, runTransaction, updateDoc,
  addDoc, query, orderBy, limitToLast, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig } from '../config.js';

let db;

export async function init() {
  const app = initializeApp(firebaseConfig);
  // initializeAuth + indexedDB kalıcılığı Capacitor iOS WebView'da da sorunsuz çalışır.
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  const user = await new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) { off(); resolve(u); }
    }, reject);
    signInAnonymously(auth).catch(reject);
  });
  return user.uid;
}

const ref = (path) => doc(db, path);

export function subscribeDoc(path, cb, onError) {
  return onSnapshot(ref(path), (snap) => cb(snap.exists() ? snap.data() : null), onError);
}

export function runTx(fn) {
  return runTransaction(db, (t) => fn({
    get: async (path) => {
      const snap = await t.get(ref(path));
      return snap.exists() ? snap.data() : null;
    },
    set: (path, data) => t.set(ref(path), data),
    update: (path, patch) => t.update(ref(path), patch)
  }));
}

export function update(path, patch) {
  return updateDoc(ref(path), patch);
}

export function addMessage(code, msg) {
  return addDoc(collection(db, `rooms/${code}/messages`), { ...msg, at: serverTimestamp() });
}

export function subscribeMessages(code, cb) {
  const q = query(collection(db, `rooms/${code}/messages`), orderBy('at'), limitToLast(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const m = d.data();
      return { id: d.id, ...m, at: m.at ? m.at.toMillis() : Date.now() };
    }));
  });
}

export const label = 'firebase';
