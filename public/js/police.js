// Politsiya: jinoyatlar, qidiruv darajasi, "Xavfsiz shahar" kameralari, ta’qib va qo‘lga olish.
import * as THREE from 'three';
import { makeCar, makeCharacter, animateCharacter } from './models.js';
import { wrapCharacter } from './npc.js';
import { CELL, N } from './world.js';

export const CRIMES = {
  hit_ped: { years: 2, wanted: 3, text: 'Piyodani mashina bilan urib yuborish' },
  hit_player: { years: 2, wanted: 3, text: 'Odamni mashina bilan urib yuborish' },
  hit_officer: { years: 3, wanted: 4, text: 'Politsiya xodimini mashina bilan urib yuborish' },
  car_theft: { years: 1, wanted: 2, text: 'Avtomobilni o‘g‘irlash' },
  flee: { years: 1, wanted: 0, text: 'Hodisa joyidan qochib ketish' },
  border: { years: 1, wanted: 0, text: 'Qidiruvda bo‘la turib chegaradan o‘tishga urinish' },
};

const CAMERA_DELAY = 70;   // kameralar qochgan odamni necha soniyada topadi
const LOSE_TIME = 32;      // politsiya ko‘rmasa, necha soniyada bir yulduz kamayadi

export class Police {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.wanted = 0;
    this.crimes = [];
    this.units = [];
    this.officers = [];
    this.unseen = 0;
    this.caseTimer = 0;
    this.blockTimer = 0;
    this.siren = null;
    this.flash = 0;
  }

  get pendingCase() { return this.crimes.length > 0; }

  report(type) {
    const cr = CRIMES[type];
    this.crimes.push(type);
    if (cr.wanted) this.wanted = Math.min(5, Math.max(this.wanted + 1, cr.wanted));
    this.unseen = 0;
    this.caseTimer = 0;
    this.game.ui.toast(`Jinoyat qayd etildi: ${cr.text}`, 'danger');
  }

  surrender() {
    if (!this.pendingCase) { this.game.ui.toast('Sizda ochiq jinoiy ish yo‘q.'); return; }
    this.game.ui.toast('Siz o‘z ixtiyoringiz bilan taslim bo‘ldingiz. Sud buni inobatga oladi.');
    this.arrest(true);
  }

  arrest(surrendered = false) {
    const crimes = [...this.crimes];
    this.crimes = [];
    this.wanted = 0;
    this.blockTimer = 0;
    this.clearUnits();
    this.game.goToJail(crimes, surrendered);
  }

  clearUnits() {
    for (const u of this.units) u.root.parent?.remove(u.root);
    for (const o of this.officers) o.root.parent?.remove(o.root);
    this.units = []; this.officers = [];
    if (this.siren) this.siren.gain.gain.value = 0;
  }

  update(dt) {
    const g = this.game;
    if (g.jailed) return;
    // "Xavfsiz shahar" kameralari: qochib ketsangiz ham, ish yopilmaydi
    if (this.wanted === 0 && this.pendingCase) {
      this.caseTimer += dt;
      if (this.caseTimer > CAMERA_DELAY) {
        this.caseTimer = 0;
        this.wanted = 2;
        this.unseen = 0;
        g.ui.toast('“Xavfsiz shahar” kameralari sizni aniqladi. Politsiya yo‘lda!', 'danger');
      }
    }
    if (this.wanted === 0) { if (this.units.length || this.officers.length) this.clearUnits(); return; }

    const want = Math.min(1 + this.wanted, 5);
    if (this.units.length < want) this.spawnUnit();

    const target = g.player.pos;
    let seen = false, nearest = Infinity;
    this.flash += dt * 8;
    for (const u of [...this.units]) {
      if (g.jailed) return;
      const d = this.updateUnit(u, dt, target);
      nearest = Math.min(nearest, d);
      if (d < 75) seen = true;
    }
    for (const o of [...this.officers]) {
      if (g.jailed) return;
      const d = this.updateOfficer(o, dt, target);
      if (d < 50) seen = true;
    }

    if (seen) this.unseen = 0;
    else {
      this.unseen += dt;
      if (this.unseen > LOSE_TIME) {
        this.unseen = 0;
        this.wanted--;
        if (this.wanted === 0) {
          if (!this.crimes.includes('flee')) this.crimes.push('flee');
          this.clearUnits();
          g.ui.toast('Politsiya izingizni yo‘qotdi. Ammo jinoiy ish ochiq — kameralar qidirmoqda. [Y] — taslim bo‘lish');
        }
      }
    }
    this.updateSiren(nearest);
  }

  spawnUnit() {
    const g = this.game, c = g.country, p = g.player.pos;
    let node = null;
    for (let i = 0; i < 40; i++) {
      const k = -N + Math.floor(Math.random() * (2 * N + 1)), l = -N + Math.floor(Math.random() * (2 * N + 1));
      if (!this.world.nodeValid(c, k, l)) continue;
      const d = Math.hypot(c.ox + k * CELL - p.x, c.oz + l * CELL - p.z);
      if (d > 85 && d < 200) { node = [k, l]; break; }
      if (!node && d > 60) node = [k, l];
    }
    if (!node) return;
    const car = makeCar({ police: c.police, color: '#F4F4F2' });
    const root = new THREE.Group();
    root.add(car.group);
    root.position.copy(this.world.nodePos(c, node[0], node[1]));
    c.group.add(root);
    this.units.push({ root, car, speed: 0, path: [], pathTimer: 0, stuck: 0, out: false, country: c.id });
  }

  bfs(c, from, to) {
    const key = (k, l) => (k + 20) * 100 + (l + 20);
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur[0] === to[0] && cur[1] === to[1]) break;
      for (const nb of this.world.neighbors(c, cur[0], cur[1])) {
        const kk = key(...nb);
        if (!prev.has(kk)) { prev.set(kk, cur); q.push(nb); }
      }
    }
    const path = [];
    let cur = to;
    if (!prev.has(key(...to))) return path;
    while (cur && !(cur[0] === from[0] && cur[1] === from[1])) { path.unshift(cur); cur = prev.get(key(...cur)); }
    return path;
  }

  updateUnit(u, dt, target) {
    const g = this.game, c = g.country, pos = u.root.position;
    const dist = Math.hypot(target.x - pos.x, target.z - pos.z);
    let aim = target, maxSp = 27;
    if (dist > 38) {
      u.pathTimer -= dt;
      if (u.pathTimer <= 0 || !u.path.length) {
        u.path = this.bfs(c, this.world.nearestNode(c, pos.x, pos.z), this.world.nearestNode(c, target.x, target.z));
        u.pathTimer = 1.0;
      }
      if (u.path.length) {
        aim = this.world.nodePos(c, u.path[0][0], u.path[0][1]);
        if (Math.hypot(aim.x - pos.x, aim.z - pos.z) < 5) u.path.shift();
      }
    } else if (!g.player.car) {
      maxSp = dist < 9 ? 0 : 10;
      if (dist < 10 && !u.out) this.dropOfficers(u);
    }
    const desired = Math.atan2(aim.x - pos.x, aim.z - pos.z);
    let dy = desired - u.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const turn = Math.sign(dy) * Math.min(Math.abs(dy), 2.8 * dt);
    u.root.rotation.y += turn;
    const want = Math.abs(dy) > 1.1 ? Math.min(maxSp, 8) : maxSp;
    u.speed += Math.sign(want - u.speed) * Math.min(Math.abs(want - u.speed), 14 * dt);
    pos.x += Math.sin(u.root.rotation.y) * u.speed * dt;
    pos.z += Math.cos(u.root.rotation.y) * u.speed * dt;
    if (this.world.collideCar(pos, u.root.rotation.y, this._push || (this._push = new THREE.Vector3()))) u.speed *= 0.8;
    pos.y = this.world.groundHeight(pos.x, pos.z);
    for (const w of u.car.wheels) w.rotation.x += u.speed * dt / 0.38;

    // o‘yinchi mashinasi bilan to‘qnashuv
    const pc = g.player.car;
    if (pc) {
      const cp = pc.root.position;
      const dx = cp.x - pos.x, dz = cp.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 3.8 && d > 0.01) {
        const push = (3.8 - d) / 2;
        cp.x += (dx / d) * push; cp.z += (dz / d) * push;
        pos.x -= (dx / d) * push; pos.z -= (dz / d) * push;
        pc.speed *= 0.5; u.speed *= 0.5;
      }
      // mashinani to‘sib qo‘yish
      if (d < 7 && Math.abs(pc.speed) < 3) {
        this.blockTimer += dt;
        if (this.blockTimer > 1.6) { g.ui.toast('Mashinangiz to‘sib qo‘yildi. Qo‘lga olindingiz!', 'danger'); this.arrest(false); return 0; }
      }
    }
    // tiqilib qolsa — boshqa joydan chiqadi
    if (u.speed < 1 && dist > 20) { u.stuck += dt; if (u.stuck > 3) { u.root.parent?.remove(u.root); this.units.splice(this.units.indexOf(u), 1); } }
    else u.stuck = 0;
    const on = Math.floor(this.flash) % 2 === 0;
    u.car.lightRed.emissive.set(on ? '#FF2020' : '#000000');
    u.car.lightBlue.emissive.set(on ? '#000000' : '#2050FF');
    return dist;
  }

  dropOfficers(u) {
    u.out = true;
    const c = this.game.country;
    for (const s of [-1, 1]) {
      const ch = makeCharacter({ shirt: '#1F3A68', pants: '#1B2433', hat: 'police', badge: true });
      const root = wrapCharacter(ch);
      root.position.copy(u.root.position);
      root.position.x += Math.cos(u.root.rotation.y) * 1.6 * s;
      root.position.z -= Math.sin(u.root.rotation.y) * 1.6 * s;
      c.group.add(root);
      this.officers.push({ ch, root, phase: 0, down: 0, unit: u });
    }
  }

  updateOfficer(o, dt, target) {
    const g = this.game, pos = o.root.position;
    if (o.down > 0) {
      o.down -= dt;
      if (o.down <= 0) { o.ch.group.rotation.x = 0; o.ch.group.position.y = 0; }
      return 999;
    }
    const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 90) { o.root.parent?.remove(o.root); this.officers.splice(this.officers.indexOf(o), 1); return d; }
    if (d > 1.2) {
      const sp = 7.3;
      pos.x += (dx / d) * sp * dt; pos.z += (dz / d) * sp * dt;
      this.world.collide(pos, 0.4);
      pos.y = this.world.groundHeight(pos.x, pos.z);
      o.root.rotation.y = Math.atan2(dx, dz);
      o.phase += dt * 11;
      animateCharacter(o.ch.parts, o.phase, 1);
    }
    if (d < 1.4 && !g.player.car) {
      g.ui.toast('Politsiya sizni qo‘lga oldi!', 'danger');
      this.arrest(false);
    }
    return d;
  }

  knockOfficer(o) {
    if (o.down > 0) return false;
    o.down = 10;
    o.ch.group.rotation.x = -Math.PI / 2;
    o.ch.group.position.y = 0.25;
    return true;
  }

  // Sirena tovushi (WebAudio)
  updateSiren(dist) {
    const ctx = this.game.audioCtx;
    if (!ctx) return;
    if (!this.siren) {
      const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), gain = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 760;
      lfo.frequency.value = 0.9; lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(osc.frequency);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(); lfo.start();
      this.siren = { gain };
    }
    const v = this.units.length ? Math.max(0, 1 - dist / 140) * 0.05 * this.game.volume : 0;
    this.siren.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
  }
}

