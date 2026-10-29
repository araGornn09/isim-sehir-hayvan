// Özel sürüm bayrağı. Build sırasında sabit olarak gömülür; false iken
// src/private/ altındaki kod pakete hiç girmez.
export const PRIVATE_EDITION = import.meta.env.PRIVATE_EDITION === 'true';

export const CATEGORIES = [
  { key: 'isim', label: 'İsim' },
  { key: 'sehir', label: 'Şehir' },
  { key: 'hayvan', label: 'Hayvan' },
  { key: 'bitki', label: 'Bitki' },
  { key: 'esya', label: 'Eşya' },
  { key: 'unlu', label: 'Ünlü' }
];

// Türk alfabesi; zor harfler (Ğ, I, J, Ö, Ü) çıkarıldı.
export const LETTERS = 'A B C Ç D E F G H İ K L M N O P R S Ş T U V Y Z'.split(' ');

export const FINISH_COUNTDOWN_SEC = 10;
// Rakip bağlantıyı kaybederse, bitiren oyuncu bu süreden sonra turu kendisi kapatır.
export const FINISH_GRACE_SEC = 8;

export const POINTS = { same: 5, different: 10, alone: 20, empty: 0 };

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const HAS_FIREBASE = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
