// Qamoqxona: sud qarori, kun tartibi, ish, intizom uchun muddatdan oldin ozod qilish.
import { CRIMES } from './police.js';

export const YEAR_SECONDS = 40; // o‘yinda 1 yil = 40 soniya
const SCHEDULE = [
  // [boshlanish soati, nom, joy]
  [6, 'Badantarbiya', 'yard'],
  [7, 'Nonushta', 'canteen'],
  [8, 'Ish', 'work'],
  [13, 'Tushlik', 'canteen'],
  [14, 'Ish', 'work'],
  [18, 'Kechki ovqat', 'canteen'],
  [19, 'Bo‘sh vaqt', 'yard'],
  [22, 'Uyqu', 'barrack'],
];
const PLACE_NAMES = { yard: 'hovlida', canteen: 'oshxonada', work: 'ustaxonada', barrack: 'barakda' };

export function activityAt(hour) {
  let cur = SCHEDULE[SCHEDULE.length - 1];
  for (const s of SCHEDULE) if (hour >= s[0]) cur = s;
  return { name: cur[1], place: cur[2] };
}

export class Prison {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.remaining = 0; this.total = 0; this.years = 0;
    this.work = 0; this.compliance = 0; this.ate = -1;
  }

  sentence(crimes, surrendered) {
    let years = 0;
    for (const t of new Set(crimes)) years += CRIMES[t].years * crimes.filter((x) => x === t).length;
    if (surrendered) years *= 0.5;
    return Math.min(12, Math.max(1, Math.round(years * 2) / 2));
  }

  start(crimes, surrendered) {
    const g = this.game;
    this.years = this.sentence(crimes, surrendered);
    this.total = this.remaining = this.years * YEAR_SECONDS;
    this.active = true; this.work = 0; this.compliance = 0;
    const counts = {};
    for (const t of crimes) counts[t] = (counts[t] || 0) + 1;
    const texts = Object.entries(counts).map(([t, n]) => CRIMES[t].text + (n > 1 ? ` (${n} marta)` : ''));
    g.ui.showCourt(texts, this.years, surrendered);
    g.setPrisonClothes(true);
    g.teleport(g.country.prison.inside);
    g.net?.event(`${g.profile.name} ${this.years} yilga qamaldi`);
  }

  placePos(place) {
    const c = this.game.country;
    if (place === 'yard') return c.prison.inside;
    return this.game.world.zones.find((z) => z.country === c.id && z.type === place);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    this.remaining -= dt;
    const act = activityAt(Math.floor(g.clock / 60));
    const at = this.placePos(act.place);
    const p = g.player.pos;
    const ok = at && Math.hypot(at.x - p.x, at.z - p.z) < 10;
    let note = ok ? 'Siz tartibga rioya qilyapsiz.' : `Jadval bo‘yicha ${PLACE_NAMES[act.place]} bo‘lishingiz kerak.`;
    if (ok) {
      this.compliance += dt;
      if (this.compliance > 10) { this.compliance = 0; this.remaining -= 3; g.ui.toast('Intizom uchun muddat qisqardi.', 'good', 2500); }
    }
    if (act.place === 'work') note += ` Ish: ${this.work}%`;
    g.ui.prisonHud({ remaining: this.remaining, total: this.total, years: this.years, activity: act.name, note });
    if (this.remaining <= 0) this.release();
  }

  interact(type) {
    const g = this.game;
    const act = activityAt(Math.floor(g.clock / 60));
    if (type === 'work') {
      if (act.place !== 'work') { g.ui.toast('Hozir ish vaqti emas. Ish soat 08:00–13:00 va 14:00–18:00 da.'); return; }
      this.work += 20;
      if (this.work >= 100) {
        this.work = 0; this.remaining -= 8; g.money += 20000;
        g.ui.toast('Buyurtma tayyor: muddat qisqardi, 20 000 so‘m ish haqi.', 'good');
      } else g.ui.toast(`Ishlayapsiz… ${this.work}%`, '', 1200);
    } else if (type === 'canteen') {
      if (act.place !== 'canteen') { g.ui.toast('Oshxona hozir yopiq. Ovqat: 07:00, 13:00, 18:00.'); return; }
      const day = Math.floor(g.totalMinutes / 60);
      if (this.ate === day) { g.ui.toast('Siz allaqachon ovqatlandingiz.'); return; }
      this.ate = day; g.health = 100; this.remaining -= 2;
      g.ui.toast('Ovqatlandingiz. Sog‘liq tiklandi.', 'good');
    } else if (type === 'barrack') {
      const h = Math.floor(g.clock / 60);
      if (act.place !== 'barrack') { g.ui.toast(`Uyqu vaqti soat 22:00 da boshlanadi. Hozir soat ${h}:00.`); return; }
      const skip = ((6 * 60 - g.clock) + 1440) % 1440;
      g.advanceClock(skip);
      this.remaining -= 15;
      g.ui.toast('Uxladingiz. Tong otdi — muddat qisqardi.', 'good');
    }
  }

  release() {
    const g = this.game;
    this.active = false;
    g.ui.prisonHud(null);
    g.setPrisonClothes(false);
    g.teleport(g.country.prison.release);
    g.convictions++;
    g.health = 100;
    g.ui.toast('Ozodlikka chiqdingiz. Endi yo‘l harakati qoidalariga rioya qiling!', 'good', 6000);
    g.net?.event(`${g.profile.name} ozodlikka chiqdi`);
  }
}
