# İsim Şehir Hayvan (2 kişilik, PWA)

Vite + vanilla JS + Firebase (Firestore + anonim giriş). Telefonda ana ekrana eklenebilir;
ileride Capacitor ile Play Store / App Store'a paketlenebilir.

**Canlı adres:** https://isim-sehir-hayvan-fb.web.app (Firebase projesi: `isim-sehir-hayvan-fb`, özel sürüm)

Güncelleme yayınlamak için: `npm run build && npx firebase-tools deploy --only hosting`

## Hızlı başlangıç

```bash
npm install
npm run dev
```

`.env` içinde Firebase ayarları boşsa uygulama **yerel deneme modunda** açılır: aynı
tarayıcıda iki sekme açıp birinde oda kurup diğerinde katılarak oyunu deneyebilirsin
(her sekme ayrı oyuncu). Gerçek iki telefon için Firebase gerekir.

## Firebase kurulumu

1. [Firebase Console](https://console.firebase.google.com)'da proje oluştur.
2. **Build > Authentication > Sign-in method** → **Anonymous**'u etkinleştir.
3. **Build > Firestore Database** → veritabanı oluştur (konum: `eur3` önerilir).
4. **Proje ayarları > Uygulamalarınız > Web uygulaması ekle** → çıkan `firebaseConfig`
   değerlerini `.env` dosyasındaki `VITE_FIREBASE_*` alanlarına yaz.
5. Güvenlik kurallarını yükle (`firestore.rules`):
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```
   (Ya da dosyanın içeriğini Console > Firestore > Rules'a yapıştır.)

## Sürümler: özel / mağaza

Ayar tek bir yerde: `PRIVATE_EDITION`.

| Komut | PRIVATE_EDITION | Ne olur |
|---|---|---|
| `npm run build` | `.env` → `true` | "Ben kimim?" seçimi + kişiye özel karşılama mesajı |
| `npm run build:store` | `.env.store` → `false` | Normal karşılama ekranı |

`false` iken `src/private/` klasöründeki kod pakete **hiç girmez** (mesajlar `dist/`
içinde bulunmaz). Seçim cihazın `localStorage`'ında saklanır; bir daha sorulmaz.
Karşılama ekranındaki küçük "Ben o değilim" bağlantısı seçimi sıfırlar.

Kişilerin adları ve karşılama mesajları `src/private/identities.js` dosyasında durur; bu dosya
git'e gönderilmez. Yoksa `identities.example.js` içindeki örnek metinler kullanılır. Kendi
metinlerin için örneği `identities.js` adıyla kopyalayıp düzenle.

## Yayınlama (PWA)

`dist/` klasörü statik; HTTPS veren herhangi bir yere konabilir. Firebase Hosting için:

```bash
npm run build
npx firebase-tools deploy --only hosting
```

- **iPhone:** Safari'de aç → Paylaş → *Ana Ekrana Ekle*
- **Android:** Chrome'da aç → menü → *Uygulamayı yükle / Ana ekrana ekle*

## Capacitor ile mağaza paketleri

`capacitor.config.json` hazır (`webDir: dist`). `appId`'yi kendi alan adına göre değiştir
(ör. `com.seninadin.isimsehirhayvan`), sonra:

```bash
npm i @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios          # macOS + Xcode gerekir
npm run cap:sync         # mağaza sürümünü derleyip native projelere kopyalar
npx cap open android     # Android Studio
npx cap open ios         # Xcode
```

Özel sürümü kendi telefonuna native kurmak istersen `npm run cap:sync:private`.
Native uygulamada service worker kaydedilmez (dosyalar zaten cihazda).
İkonları değiştirmek için `public/icons/icon.svg`'yi düzenleyip `npm run icons` çalıştır;
native ikonlar için `@capacitor/assets` kullanılabilir.

## Oyun kuralları

- Kategoriler: İsim, Şehir, Hayvan, Bitki, Eşya, Ünlü (`src/config.js`)
- Harf havuzu Türk alfabesi; Ğ, I, J, Ö, Ü çıkarıldı. Harfler oda içinde tükenene kadar tekrar etmez.
- Tüm kategorileri dolduran "Bitirdim" der → rakibe 10 sn geri sayım → tur kapanır.
- Tur sonunda herkes rakibinin cevaplarını onaylar/reddeder (seçilen harfle başlamayanlar
  otomatik "red" olarak işaretli gelir). Reddedilen cevap boş sayılır.
- Puan: aynı cevap 5, farklı 10, sadece biri yazdıysa 20, boş 0.
- Sohbet her aşamada sağ üstteki 💬 ile açılır.

## Dosyalar

```
src/config.js          ayarlar, kategoriler, harfler, puanlar
src/game.js            oda / tur / puanlama akışı (transaction'larla)
src/scoring.js         puan hesabı
src/backend/           firestore.js (gerçek) ve local.js (deneme modu)
src/private/edition.js özel karşılama (yalnızca PRIVATE_EDITION=true)
src/main.js            ekranlar ve sohbet
firestore.rules        güvenlik kuralları
```
