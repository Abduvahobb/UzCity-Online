# UzCity Online

Toshkentdan boshlanadigan blokli ochiq dunyo o‘yini. Do‘stlaringiz bilan bitta shaharda yurasiz, ovozli gaplashasiz, mashina haydaysiz va boshqa davlatlarga uchasiz. Qoidani buzsangiz, politsiya ushlaydi va qamoqxonaga tushasiz.


## O‘yinda nimalar bor

**Shaharlar**
- **Toshkent:**
  - Toshkent teleminorasi, “O‘zbekiston” mehmonxonasi, Amir Temur xiyoboni, Chorsu bozori, Minor masjidi.
  - Markazda zamonaviy minoralar, undan tashqarida 5 va 9 qavatli panel uylar, chetlarda devorli hovlilar.
  - Ko‘cha bo‘ylab daraxtlar. Ekranda tuman nomi chiqadi.
- **Boshqa davlatlar:** aeroportdan Astana (Boyterak, Xon Shatir), Istanbul (Galata minorasi, Sulaymoniya masjidi) va Moskvaga (Spasskaya minorasi) uchish mumkin. Har birida o‘z politsiyasi, aeroporti va qamoqxonasi bor.

**Shahar hayoti**
- Trotuarda yuradigan va ko‘chani kesib o‘tadigan odamlar.
- O‘ng tomonlama harakat qiladigan mashinalar. Ular odam yoki to‘siq oldida to‘xtaydi.
- Kun va tun almashadi: kechasi derazalar va ko‘cha chiroqlari yonadi.
- Har kuni soat 08:00 da maosh tushadi.

**Politsiya va jinoyatlar**
- Mashinada odamni urib yuborsangiz, jinoiy ish ochiladi va qidiruv yulduzlari chiqadi.
- Politsiya mashinalari ko‘chalar bo‘ylab quvadi. Siz piyoda bo‘lsangiz, xodimlar mashinadan tushib yugurib keladi.
- Mashinangizni to‘sib qo‘yishsa yoki xodim sizga yetib olsa, qo‘lga olinasiz.
- Qochib ketsangiz ham, “Xavfsiz shahar” kameralari bir muddatdan keyin sizni topadi.
- Qidiruvda bo‘lsangiz, aeroportdagi chegara nazoratida ushlanasiz.
- Begona mashinani olish o‘g‘irlik hisoblanadi.
- **Y** tugmasi bilan o‘zingiz taslim bo‘lsangiz, sud jazoni yarmiga kamaytiradi.

**Qamoqxona**
- Avval sud qarori chiqadi.
- Qamoqxonada devorlar, kuzatuv minoralari, qo‘riqchilar va boshqa mahkumlar bor.
- Kun tartibi: badantarbiya, ovqat, ish, uyqu. Qamoqda vaqt tezroq o‘tadi.
- Ustaxonada ishlash va tartibga rioya qilish muddatni qisqartiradi.
- Muddat tugagach, darvoza oldida ozod bo‘lasiz.


**Onlayn**
- Do‘stlar bitta xona kodini kiritib, bitta shaharda bir-birini ko‘radi.
- Matnli chat bor.
- Ovozli chat: **B** tugmasini bosib turib gapirasiz. Yaqin atrofdagilar eshitadi, ovoz masofa ortgan sari pasayadi. **G** tugmasi bilan butun xonaga gapirish rejimiga o‘tasiz.
- Do‘stingizni mashinada urib yuborsangiz, u yiqiladi va sizga jinoiy ish ochiladi.

**Telefon**
- Telefonda ekranga joystik va tugmalar chiqadi, grafika esa telefon uchun yengillashtiriladi.
- Android uchun APK ilova GitHub’da avtomatik yig‘iladi (pastda “Telefon ilovasi” bo‘limiga qarang).


## Kompyuterda ishga tushirish

1. [Node.js](https://nodejs.org) o‘rnating (18-versiya yoki undan yangisi).
2. Arxivni oching va papka ichida terminal (buyruqlar oynasi) oching.
3. Quyidagi buyruqlarni yozing:

```bash
npm install
npm start
```

4. Brauzerda `http://localhost:3000` manzilini oching.

## Do‘stlar bilan o‘ynash

**Bitta Wi-Fi tarmog‘ida.** Serverni bitta kompyuterda ishga tushiring. Do‘stlaringiz o‘z brauzerida `http://KOMPYUTER-IP:3000` manzilini ochadi (masalan, `http://192.168.1.15:3000`). Hammangiz bir xil xona kodini kiritasiz.

Bu usulda o‘yin va chat ishlaydi, lekin brauzerlar mikrofonni faqat HTTPS saytlarda (yoki `localhost`da) beradi. Shuning uchun ovozli chat uchun quyidagi internet usuli kerak.

**Internet orqali.** O‘yinni HTTPS beradigan bepul serverga joylang (pastda “Internetga joylash” bo‘limiga qarang). Keyin havolani do‘stlaringizga yuboring.

## GitHub’ga yuklash

**Brauzer orqali.** GitHub’da yangi repository yarating, so‘ng “Add file → Upload files” orqali papka ichidagi hamma narsani tashlang. `node_modules` papkasi kerak emas: kutubxonalarni `npm install` o‘zi o‘rnatadi.

**Terminal orqali:**

```bash
git init
git add .
git commit -m "UzCity Online: birinchi versiya"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI-NOMI/uzcity-online.git
git push -u origin main
```

## Internetga joylash (Render.com)

1. [render.com](https://render.com) saytida GitHub hisobingiz bilan kiring.
2. **New → Web Service** ni tanlang va repository’ingizni ulang.
3. Sozlamalarni kiriting:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Tarif: **Free**
4. Tayyor bo‘lgach, `https://...onrender.com` ko‘rinishidagi havola beriladi. Uni do‘stlaringizga yuboring.

Bepul tarifda server ishlatilmay tursa uxlab qoladi. Shu sababli birinchi ochilishda bir daqiqacha kutish kerak bo‘lishi mumkin.

## Telefon ilovasi (Android APK)

APK’ni GitHub o‘zi yig‘adi: `public` papkasidagi fayllar o‘zgarganda **Actions** bo‘limida “Android APK” jarayoni ishga tushadi. U taxminan 5–10 daqiqa davom etadi.

**Yuklab olish.** Repository sahifasidagi **Releases** bo‘limini oching va eng yangi relizdagi `UzCity.apk` faylini yuklab oling. Shu havolani do‘stlaringizga ham yuborishingiz mumkin.

**O‘rnatish.** Telefonda faylni oching. Telefon “noma’lum manbalardan o‘rnatish”ga ruxsat so‘rasa, ruxsat bering. Ilova yotiq holatda ochiladi.

**Onlayn o‘ynash.** Ilova do‘stlar bilan o‘ynash uchun internetdagi serverga ulanadi. Serverni Render’ga joylagandan keyin uning manzilini `public/config.js` fayliga yozing, masalan:

```js
window.UZCITY_SERVER = 'https://uzcity-online.onrender.com';
```

Faylni saqlaganingizdan keyin GitHub yangi APK yig‘adi. Bu manzil faqat ilova uchun kerak: brauzerda o‘ynaganda o‘yin ochilgan saytning o‘zi server bo‘ladi.

Telefonda APK’siz ham o‘ynash mumkin: Render havolasini telefon brauzerida oching.

## Boshqaruv

Telefonda: chapdagi doira bilan yuriladi (oxirigacha sursangiz, yuguradi), ekranni surib atrofga qaraladi, o‘ngdagi tugmalar klaviaturadagi tugmalar vazifasini bajaradi.

Kompyuterda:

| Tugma | Vazifasi |
|---|---|
| W A S D | Yurish, mashina haydash |
| Shift | Yugurish |
| Probel | Sakrash, mashinada tormoz |
| E | Mashinaga chiqish yoki tushish, aeroport, qamoqdagi ishlar |
| V | Birinchi shaxs / uchinchi shaxs kamerasi |
| B (bosib turing) | Ovozli gapirish |
| G | Ovoz rejimi: yaqin atrof yoki butun xona |
| T | Chat |
| M | Katta xarita |
| Y | Politsiyaga taslim bo‘lish |
| H | Yordam |

## Fayllar tuzilishi

```
server/server.js     — server: fayllarni beradi, xonalar, chat, ovoz signallari
public/index.html    — sahifa, HUD va oynalar
public/style.css     — dizayn
public/js/main.js    — asosiy o‘yin: boshqaruv, mashina, kamera, kun-tun
public/js/world.js   — davlatlar, shahar, binolar, aeroport, qamoqxona
public/js/models.js  — blokli odamlar, mashinalar, bayroqlar, yozuvlar
public/js/npc.js     — piyodalar va ko‘cha harakati
public/js/police.js  — jinoyatlar, qidiruv, politsiya
public/js/prison.js  — sud, kun tartibi, qamoq muddati
public/js/network.js — onlayn o‘yinchilar
public/js/voice.js   — ovozli chat (WebRTC)
public/js/touch.js   — telefon boshqaruvi (joystik va tugmalar)
public/config.js     — telefon ilovasi uchun server manzili
capacitor.config.json            — Android ilova sozlamalari
.github/workflows/android.yml    — APK’ni avtomatik yig‘ish
```

## O‘yinni o‘zgartirish

- **Yangi davlat:** `world.js` faylidagi `COUNTRIES` ro‘yxatiga yangi obyekt qo‘shing. Uning `offset` qiymati boshqa davlatlardan kamida 2400 birlik uzoqda bo‘lsin. Aeroport menyusida u avtomatik paydo bo‘ladi.
- **Yangi mashhur bino:** `world.js` dagi `landmark()` funksiyasiga yangi tur qo‘shing, nomini `LANDMARK_NAMES` ga yozing. Keyin kerakli davlatning `landmarks` ro‘yxatiga kvartal raqami bilan kiriting.
- **Jazo muddatlari:**
  - `police.js` dagi `CRIMES` — har bir jinoyat uchun yillar.
  - `prison.js` dagi `YEAR_SECONDS` — o‘yinda 1 yil necha soniya davom etadi.
- **Narxlar:** `main.js` dagi `FLIGHT_PRICE` (chipta), `SALARY` (maosh), `HOSPITAL_FEE` (kasalxona).
- **Kameralar tezligi:** `police.js` dagi `CAMERA_DELAY`.

## Cheklovlar va keyingi qadamlar

Bu ishlaydigan asos, tayyor tijorat o‘yini emas. Keyingi bosqichda quyidagilarni qo‘shish mumkin:

- **NPC’lar sinxron emas.** Piyodalar, ko‘cha mashinalari va politsiya har bir o‘yinchining kompyuterida alohida hisoblanadi, do‘stlar ularni bir xil ko‘rmaydi. Ularni serverda hisoblash keyingi katta qadam bo‘ladi.
- **Telefonda grafika soddaroq.** Tezlik uchun telefonda soyalar o‘chiriladi, odam va mashinalar soni kamaytiriladi. Juda eski telefonlarda o‘yin sekin ishlashi mumkin.
- **APK sinov (debug) versiyasi.** Google Play’ga chiqarish uchun imzolangan versiya va dasturchi hisobi kerak bo‘ladi.
- **Ovozli chat ba’zi tarmoqlarda ulanmasligi mumkin.** Ovoz o‘yinchilar orasida to‘g‘ridan-to‘g‘ri uzatiladi, ba’zi mobil internet tarmoqlari buni to‘sadi. Bunday holda TURN server kerak bo‘ladi: uning manzilini `voice.js` dagi `ICE` ro‘yxatiga qo‘shasiz.
- **Fizika soddalashtirilgan.** Binolarning ichiga kirib bo‘lmaydi.

## Litsenziya

MIT, `LICENSE` fayliga qarang. O‘yin three.js kutubxonasidan foydalanadi (u ham MIT litsenziyasi ostida, `npm install` orqali o‘rnatiladi).
