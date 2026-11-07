// Interfeys: HUD, xabarlar, chat, xarita, aeroport, sud va qamoqxona panellari.
const $ = (id) => document.getElementById(id);
const STAR = '<svg viewBox="-10 -10 20 20"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></svg>';

export const fmtMoney = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' so‘m';
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class UI {
  constructor() {
    $('stars').innerHTML = STAR.repeat(5);
    this.stars = [...$('stars').children];
    this.mini = $('minimap').getContext('2d');
    this.big = $('bigmap').getContext('2d');
    this.mapCache = new Map();
    for (const el of document.querySelectorAll('.overlay [data-close]')) {
      el.addEventListener('click', () => this.closeOverlay(el.closest('.overlay').id));
    }
    this.onOverlayClose = {};
  }

  // ----- Umumiy -----
  toast(text, kind = '', ms = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }
  overlayOpen() { return [...document.querySelectorAll('.overlay')].some((o) => !o.hidden); }
  openOverlay(id) { $(id).hidden = false; document.exitPointerLock?.(); }
  closeOverlay(id) {
    $(id).hidden = true;
    const cb = this.onOverlayClose[id];
    if (cb) { delete this.onOverlayClose[id]; cb(); }
  }
  toggleOverlay(id) { if ($(id).hidden) this.openOverlay(id); else this.closeOverlay(id); }

  // ----- HUD -----
  setHud(s) {
    $('loc').textContent = s.location;
    $('clock').textContent = s.clock;
    $('money').textContent = fmtMoney(s.money);
    $('health').style.width = `${Math.max(0, s.health)}%`;
    this.stars.forEach((el, i) => el.classList.toggle('on', i < s.wanted));
    $('stars').classList.toggle('blink', s.wanted > 0 && s.unseen > 4);
    $('speedo').hidden = !s.inCar;
    if (s.inCar) $('speed').textContent = Math.round(Math.abs(s.speed) * 3.6);
    $('prompt').hidden = !s.prompt;
    if (s.prompt) $('prompt').textContent = s.prompt;
    $('crosshair').hidden = !s.fps;
  }
  setVoice(state) {
    const el = $('voice-ind');
    if (!state.online) { el.innerHTML = ''; return; }
    const mode = state.mode === 'near' ? 'yaqin atrof' : 'butun xona';
    el.innerHTML = state.talking
      ? `<span class="live">● Gapiryapsiz</span> — ${mode}`
      : `${state.mic ? 'Gapirish uchun B ni bosib turing' : 'Mikrofon: B ni bosing'} · ${mode} (G)`;
  }

  // ----- Chat -----
  addChat(name, text, sys = false) {
    const log = $('chat-log');
    const line = document.createElement('div');
    if (sys) { line.className = 'sys'; line.textContent = text; }
    else { const b = document.createElement('b'); b.textContent = name + ': '; line.append(b, document.createTextNode(text)); }
    log.appendChild(line);
    while (log.children.length > 9) log.firstChild.remove();
  }
  openChat() { const i = $('chat-input'); i.hidden = false; i.value = ''; i.focus(); document.exitPointerLock?.(); }
  closeChat() { const i = $('chat-input'); i.hidden = true; i.blur(); }
  get chatOpen() { return !$('chat-input').hidden; }

  // ----- Xarita -----
  drawMinimap(world, country, player, dots, big = false) {
    if (!this.mapCache.has(country.id)) this.mapCache.set(country.id, world.renderMap(country, 640));
    const m = this.mapCache.get(country.id);
    const g = big ? this.big : this.mini, W = g.canvas.width;
    const toMap = (x, z) => [(x - country.ox + m.bound) * m.scale, (z - country.oz + m.bound) * m.scale];
    g.save();
    g.clearRect(0, 0, W, W);
    if (big) {
      g.drawImage(m.canvas, 0, 0, W, W);
      g.scale(W / m.canvas.width, W / m.canvas.width);
    } else {
      g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); g.clip();
      const zoom = 1.9;
      const [px, pz] = toMap(player.x, player.z);
      g.translate(W / 2, W / 2); g.scale(zoom, zoom); g.translate(-px, -pz);
      g.drawImage(m.canvas, 0, 0);
    }
    for (const d of dots) {
      const [x, z] = toMap(d.x, d.z);
      g.fillStyle = d.color; g.beginPath(); g.arc(x, z, big ? 5 : 3, 0, Math.PI * 2); g.fill();
    }
    const [px, pz] = toMap(player.x, player.z);
    g.translate(px, pz); g.rotate(-player.yaw + Math.PI);
    g.fillStyle = '#F2B632'; g.strokeStyle = '#0F2347'; g.lineWidth = 1.5;
    const s = big ? 9 : 5;
    g.beginPath(); g.moveTo(0, -s * 1.3); g.lineTo(s, s); g.lineTo(0, s * 0.4); g.lineTo(-s, s); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  // ----- Aeroport -----
  showAirport(countries, current, flagUrl, price, money, onPick) {
    $('airport-title').textContent = 'Qayerga uchasiz?';
    const box = $('flights');
    box.innerHTML = '';
    for (const c of countries) {
      if (c.id === current) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'flight-opt';
      b.innerHTML = `<img alt="" src="${flagUrl(c.id)}"><span><b>${c.city}</b>${c.name}</span><span class="price">${fmtMoney(price)}</span>`;
      b.disabled = money < price;
      b.addEventListener('click', () => { this.closeOverlay('overlay-airport'); onPick(c); });
      box.appendChild(b);
    }
    if (money < price) {
      const p = document.createElement('p'); p.className = 'muted';
      p.textContent = 'Chipta uchun pul yetmaydi. Har kuni soat 08:00 da maosh tushadi.';
      box.appendChild(p);
    }
    this.openOverlay('overlay-airport');
  }
  flight(fromCity, toCity, seconds) {
    $('flight-route').textContent = `${fromCity} — ${toCity}`;
    this.openOverlay('overlay-flight');
    const bar = $('flight-progress');
    const t0 = performance.now();
    return new Promise((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        bar.style.width = `${k * 100}%`;
        if (k < 1) requestAnimationFrame(step);
        else { $('overlay-flight').hidden = true; res(); }
      };
      step();
    });
  }

  // ----- Sud va qamoqxona -----
  showCourt(crimeTexts, years, surrendered) {
    $('court-intro').textContent = surrendered
      ? 'Ayblanuvchi o‘z ixtiyori bilan taslim bo‘ldi — bu jazoni yengillashtiruvchi holat.'
      : 'Ayblanuvchi politsiya tomonidan qo‘lga olindi.';
    $('court-crimes').innerHTML = '';
    for (const t of crimeTexts) { const li = document.createElement('li'); li.textContent = t; $('court-crimes').appendChild(li); }
    $('court-verdict').textContent = `${years} yil ozodlikdan mahrum qilish`;
    this.openOverlay('overlay-court');
  }
  prisonHud(d) {
    $('prison-hud').hidden = !d;
    if (!d) return;
    $('ph-time').textContent = `${fmtTime(d.remaining)}  (${d.years} yil)`;
    $('ph-progress').style.width = `${(1 - d.remaining / d.total) * 100}%`;
    $('ph-activity').textContent = `Hozir: ${d.activity}`;
    $('ph-note').textContent = d.note;
  }
}
