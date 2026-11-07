// Shahar aholisi: piyodalar (trotuarda yuradi, ko‘chani kesib o‘tadi) va ko‘cha harakati.
import * as THREE from 'three';
import { makeCharacter, animateCharacter, makeCar, SKINS, HAIRS, CAR_COLORS } from './models.js';
import { CELL, ROAD, N, LANE, SIDEWALK_H } from './world.js';

const HALF = ROAD / 2;
const INSET = 2.0;
const SHIRTS = ['#C8323C', '#2D6CB5', '#F2B632', '#3F8F5A', '#E8E4DA', '#6B4FA0', '#D9822B', '#2BB5B0', '#444B55', '#8C1C24'];
const PANTS = ['#2E3A59', '#3B3B3B', '#5A4632', '#22262B', '#4D5B6B'];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cornerIdx = (sx, sz) => (sx < 0 ? (sz < 0 ? 0 : 3) : (sz < 0 ? 1 : 2));

// Odamni ildiz guruhga o‘rash: tashqi guruh — burilish, ichki — yiqilish
export function wrapCharacter(ch) {
  const root = new THREE.Group();
  root.add(ch.group);
  return root;
}

export class Pedestrians {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  populate(perCountry = 40) {
    for (const c of this.world.countries.values()) for (let n = 0; n < perCountry; n++) this.spawn(c);
  }

  spawn(c, opts = {}) {
    const ch = makeCharacter({
      shirt: opts.shirt || pick(SHIRTS), pants: opts.pants || pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS),
      hat: opts.hat ?? (Math.random() < 0.25 ? 'doppi' : Math.random() < 0.15 ? 'kepka' : 'yoq'),
      badge: opts.badge,
    });
    const root = wrapCharacter(ch);
    c.group.add(root);
    const p = {
      ch, root, c, country: c.id, role: opts.role || 'civil',
      state: 'walk', speed: 1.1 + Math.random() * 0.6, phase: Math.random() * 6,
      vel: new THREE.Vector3(), downTimer: 0, target: new THREE.Vector3(),
      i: 0, j: 0, k: 0, ti: 0, tj: 0, tk: 0, crossing: false, path: opts.path || null, pathIdx: 0,
    };
    if (p.path) { root.position.copy(p.path[0]); p.target.copy(p.path[1]); p.pathIdx = 1; }
    else this.place(p);
    this.list.push(p);
    return p;
  }

  cornerPos(c, i, j, k, out) {
    const [sx, sz] = CORNERS[k];
    out.x = c.ox + (sx < 0 ? i * CELL + HALF + INSET : (i + 1) * CELL - HALF - INSET);
    out.z = c.oz + (sz < 0 ? j * CELL + HALF + INSET : (j + 1) * CELL - HALF - INSET);
    out.y = SIDEWALK_H;
    return out;
  }

  place(p, avoid) {
    for (let tries = 0; tries < 30; tries++) {
      const i = -N + Math.floor(Math.random() * 2 * N), j = -N + Math.floor(Math.random() * 2 * N);
      if (!this.world.cellWalkable(p.c, i, j)) continue;
      p.i = i; p.j = j; p.k = Math.floor(Math.random() * 4);
      this.cornerPos(p.c, i, j, p.k, p.root.position);
      if (avoid && p.root.position.distanceTo(avoid) < 70) continue;
      break;
    }
    p.tk = (p.k + 1) % 4; p.crossing = false;
    this.cornerPos(p.c, p.i, p.j, p.tk, p.target);
  }

  arrive(p) {
    if (p.path) {
      p.pathIdx = (p.pathIdx + 1) % p.path.length;
      p.target.copy(p.path[p.pathIdx]);
      return;
    }
    if (p.crossing) { p.crossing = false; p.i = p.ti; p.j = p.tj; }
    p.k = p.tk;
    if (Math.random() < 0.22) {
      const [sx, sz] = CORNERS[p.k];
      const opts = [[p.i + sx, p.j, cornerIdx(-sx, sz)], [p.i, p.j + sz, cornerIdx(sx, -sz)]];
      const [ni, nj, nk] = pick(opts);
      if (this.world.cellWalkable(p.c, ni, nj)) {
        p.crossing = true; p.ti = ni; p.tj = nj; p.tk = nk;
        this.cornerPos(p.c, ni, nj, nk, p.target);
        return;
      }
    }
    p.tk = (p.k + 1) % 4;
    this.cornerPos(p.c, p.i, p.j, p.tk, p.target);
  }

  knockdown(p, impulse) {
    if (p.state === 'down') return false;
    p.state = 'down';
    p.downTimer = 16;
    p.vel.copy(impulse);
    p.ch.group.rotation.x = -Math.PI / 2;
    p.ch.group.position.y = 0.25;
    animateCharacter(p.ch.parts, 0, 0);
    return true;
  }

  update(dt, countryId, playerPos) {
    const tmp = this._tmp || (this._tmp = new THREE.Vector3());
    for (const p of this.list) {
      if (p.country !== countryId) continue;
      const pos = p.root.position;
      if (p.state === 'down') {
        p.downTimer -= dt;
        pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
        this.world.collide(pos, 0.4);
        if (p.downTimer <= 0) {
          // Tez yordam olib ketdi — boshqa joyda yana paydo bo‘ladi
          p.state = 'walk';
          p.ch.group.rotation.x = 0; p.ch.group.position.y = 0;
          if (p.path) { pos.copy(p.path[0]); p.pathIdx = 0; p.target.copy(p.path[1]); }
          else this.place(p, playerPos);
        }
        continue;
      }
      tmp.subVectors(p.target, pos); tmp.y = 0;
      const d = tmp.length();
      if (d < 0.2) { this.arrive(p); continue; }
      tmp.multiplyScalar(1 / d);
      const sp = p.role === 'guard' ? 1.3 : p.speed;
      pos.x += tmp.x * sp * dt;
      pos.z += tmp.z * sp * dt;
      pos.y = p.crossing ? this.world.groundHeight(pos.x, pos.z) : (p.path ? p.path[0].y : SIDEWALK_H);
      p.root.rotation.y = Math.atan2(tmp.x, tmp.z);
      if (Math.abs(pos.x - playerPos.x) < 110 && Math.abs(pos.z - playerPos.z) < 110) {
        p.phase += dt * sp * 4.6;
        animateCharacter(p.ch.parts, p.phase, 1);
      }
    }
  }
}

// ---------- Ko‘cha harakati ----------
export class Traffic {
  constructor(world) {
    this.world = world;
    this.list = [];
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }

  populate(perCountry = 16) {
    for (const c of this.world.countries.values()) for (let n = 0; n < perCountry; n++) this.spawn(c);
  }

  spawn(c) {
    const car = makeCar({ color: pick(CAR_COLORS) });
    const root = new THREE.Group();
    root.add(car.group);
    c.group.add(root);
    const t = { car, root, c, country: c.id, speed: 0, maxSpeed: 9 + Math.random() * 5, k: 0, l: 0, nk: 1, nl: 0, t: 0, dir: new THREE.Vector3(1, 0, 0) };
    for (let tries = 0; tries < 50; tries++) {
      const k = -N + Math.floor(Math.random() * (2 * N + 1)), l = -N + Math.floor(Math.random() * (2 * N + 1));
      const nb = this.world.neighbors(c, k, l);
      if (!nb.length) continue;
      [t.nk, t.nl] = pick(nb); t.k = k; t.l = l; t.t = Math.random() * CELL;
      break;
    }
    this.place(t);
    this.list.push(t);
    return t;
  }

  place(t) {
    const a = this.world.nodePos(t.c, t.k, t.l, this._a), b = this.world.nodePos(t.c, t.nk, t.nl, this._b);
    t.dir.subVectors(b, a).normalize();
    const pos = t.root.position;
    pos.copy(a).addScaledVector(t.dir, t.t);
    pos.x += -t.dir.z * LANE; pos.z += t.dir.x * LANE;
    pos.y = 0;
    t.root.rotation.y = Math.atan2(t.dir.x, t.dir.z);
  }

  // obstacles: [{pos, r}] — o‘yinchi, politsiya va boshqalar
  update(dt, countryId, obstacles, peds) {
    for (const t of this.list) {
      if (t.country !== countryId) continue;
      const pos = t.root.position;
      let blocked = false;
      const check = (ox, oz, r) => {
        const dx = ox - pos.x, dz = oz - pos.z;
        const ahead = dx * t.dir.x + dz * t.dir.z;
        if (ahead < 0 || ahead > 11) return false;
        const lat = Math.abs(-dx * t.dir.z + dz * t.dir.x);
        return lat < 1.6 + r;
      };
      for (const o of obstacles) if (o.country === countryId && check(o.pos.x, o.pos.z, o.r)) { blocked = true; break; }
      if (!blocked) for (const o of this.list) {
        if (o === t || o.country !== countryId) continue;
        const op = o.root.position;
        if (Math.abs(op.x - pos.x) > 12 || Math.abs(op.z - pos.z) > 12) continue;
        if (check(op.x, op.z, 0.8)) { blocked = true; break; }
      }
      if (!blocked) for (const p of peds.list) {
        if (p.country !== countryId || p.state === 'down') continue;
        const pp = p.root.position;
        if (Math.abs(pp.x - pos.x) > 12 || Math.abs(pp.z - pos.z) > 12) continue;
        if (check(pp.x, pp.z, 0.4)) { blocked = true; break; }
      }
      const target = blocked ? 0 : t.maxSpeed;
      t.speed += Math.sign(target - t.speed) * Math.min(Math.abs(target - t.speed), (blocked ? 16 : 5) * dt);
      t.t += t.speed * dt;
      if (t.t >= CELL) {
        t.t -= CELL;
        const nb = this.world.neighbors(t.c, t.nk, t.nl).filter(([a, b]) => !(a === t.k && b === t.l));
        const next = nb.length ? pick(nb) : [t.k, t.l];
        t.k = t.nk; t.l = t.nl; [t.nk, t.nl] = next;
      }
      this.place(t);
      for (const w of t.car.wheels) w.rotation.x += t.speed * dt / 0.38;
    }
  }
}
