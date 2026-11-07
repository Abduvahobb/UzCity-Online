// Dunyo: davlatlar, shahar ko‘chalari, uylar, mashhur binolar, aeroport va qamoqxona.
// Barcha statik qutilar materiali bo‘yicha birlashtiriladi (draw call kam bo‘lsin).
import * as THREE from 'three';
import { mat, canvasTexture, makeLabel, makeFlagTexture, textTexture } from './models.js';

export const CELL = 70;          // bitta kvartal + ko‘cha
export const ROAD = 14;          // ko‘cha kengligi
export const N = 5;              // kvartallar: -N .. N-1
export const SIDEWALK_H = 0.12;  // trotuar balandligi
export const LANE = 3.5;         // harakat bo‘lagi (o‘ng tomonlama harakat)
const HALF = ROAD / 2;
const CITY = N * CELL + HALF;
const BOUND = CITY + 40;

// ---------- Davlatlar ----------
// Yangi davlat qo‘shish uchun shu ro‘yxatga yana bitta obyekt qo‘shing.
export const COUNTRIES = [
  {
    id: 'uz', name: 'O‘zbekiston', city: 'Toshkent', offset: [0, 0], ground: '#93A866',
    police: 'POLITSIYA', airportName: 'Toshkent xalqaro aeroporti', prisonName: 'Jazoni ijro etish koloniyasi',
    downtown: [0, 0], airport: [2, -5, 2, 2], prison: [-5, 3, 2, 2],
    styles: ['glass', 'panel', 'house'],
    landmarks: [['tvTower', -2, -3], ['hotelUz', 0, -1], ['temur', -1, -1], ['chorsu', -3, 0], ['minor', 1, 1]],
  },
  {
    id: 'kz', name: 'Qozog‘iston', city: 'Astana', offset: [2400, 0], ground: '#A9AE78',
    police: 'POLISIYA', airportName: 'Astana xalqaro aeroporti', prisonName: 'Axloq tuzatish koloniyasi',
    downtown: [0, 0], airport: [2, -5, 2, 2], prison: [-5, 3, 2, 2],
    styles: ['glass', 'panel', 'house'],
    landmarks: [['bayterek', 0, -1], ['khanShatyr', -2, -2]],
  },
  {
    id: 'tr', name: 'Turkiya', city: 'Istanbul', offset: [0, 2400], ground: '#8FA866',
    police: 'POLİS', airportName: 'Istanbul aeroporti', prisonName: 'Qamoqxona',
    downtown: [0, 0], airport: [2, -5, 2, 2], prison: [-5, 3, 2, 2],
    styles: ['stone', 'stone', 'house'],
    landmarks: [['galata', 0, -1], ['mosqueBig', -2, 0]],
  },
  {
    id: 'ru', name: 'Rossiya', city: 'Moskva', offset: [2400, 2400], ground: '#86A060',
    police: 'ПОЛИЦИЯ', airportName: 'Moskva aeroporti', prisonName: 'Axloq tuzatish koloniyasi',
    downtown: [0, 0], airport: [2, -5, 2, 2], prison: [-5, 3, 2, 2],
    styles: ['brick', 'panel', 'panel'],
    landmarks: [['spasskaya', 0, -1]],
  },
];

const LANDMARK_NAMES = {
  tvTower: 'Toshkent teleminorasi', hotelUz: '“O‘zbekiston” mehmonxonasi', temur: 'Amir Temur xiyoboni',
  chorsu: 'Chorsu bozori', minor: 'Minor masjidi', bayterek: 'Boyterak', khanShatyr: 'Xon Shatir',
  galata: 'Galata minorasi', mosqueBig: 'Sulaymoniya masjidi', spasskaya: 'Spasskaya minorasi',
};

// ---------- Bino teksturalari ----------
function windowStyle(wall, win, tileW, tileH, cols, rows, drawCell, litChance) {
  const S = 256;
  const cw = S / cols, ch = S / rows;
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(Math.random() < litChance);
  const map = canvasTexture(S, S, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawCell(g, c * cw, r * ch, cw, ch, win, false);
  });
  const emis = canvasTexture(S, S, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (lit[r * cols + c]) drawCell(g, c * cw, r * ch, cw, ch, '#FFD27A', true);
    }
  });
  for (const t of [map, emis]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const material = new THREE.MeshLambertMaterial({ map, emissiveMap: emis, emissive: '#ffffff', emissiveIntensity: 0 });
  return { material, tileW, tileH };
}

function makeStyles() {
  const rectWin = (mx, my, mw, mh, extra) => (g, x, y, w, h, color, lit) => {
    g.fillStyle = color;
    g.fillRect(x + w * mx, y + h * my, w * mw, h * mh);
    if (extra && !lit) extra(g, x, y, w, h);
  };
  return {
    panel: windowStyle('#D6CCB8', '#3C4B5E', 12, 12, 4, 4,
      rectWin(0.22, 0.2, 0.56, 0.48, (g, x, y, w, h) => { g.fillStyle = '#B5AA94'; g.fillRect(x + w * 0.12, y + h * 0.72, w * 0.76, h * 0.1); }), 0.32),
    glass: windowStyle('#A9C0CF', '#3D7CAD', 12, 12, 4, 4, rectWin(0.06, 0.08, 0.88, 0.8), 0.45),
    house: windowStyle('#E2C7A0', '#4A5868', 6, 4, 1, 1,
      rectWin(0.32, 0.25, 0.36, 0.42, (g, x, y, w, h) => { g.strokeStyle = '#F7F3EA'; g.lineWidth = 6; g.strokeRect(x + w * 0.32, y + h * 0.25, w * 0.36, h * 0.42); }), 0.5),
    grille: windowStyle('#EEEEE8', '#5B6670', 6, 6, 2, 2, (g, x, y, w, h, color, lit) => {
      g.fillStyle = color; g.fillRect(x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.7);
      if (!lit) {
        g.strokeStyle = '#EEEEE8'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(x + w / 2, y + h * 0.15); g.lineTo(x + w * 0.85, y + h / 2); g.lineTo(x + w / 2, y + h * 0.85); g.lineTo(x + w * 0.15, y + h / 2); g.closePath(); g.stroke();
      }
    }, 0.4),
    stone: windowStyle('#D8CDB8', '#4A5560', 8, 8, 2, 2, (g, x, y, w, h, color) => {
      g.fillStyle = color;
      g.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.42);
      g.beginPath(); g.arc(x + w / 2, y + h * 0.35, w * 0.2, Math.PI, 0); g.fill();
    }, 0.4),
    brick: windowStyle('#A9483A', '#3F4A55', 8, 8, 2, 2, rectWin(0.3, 0.25, 0.4, 0.5, (g, x, y, w, h) => {
      g.strokeStyle = '#F0E6DA'; g.lineWidth = 5; g.strokeRect(x + w * 0.3, y + h * 0.25, w * 0.4, h * 0.5);
    }), 0.4),
  };
}

// ---------- Geometriyalarni birlashtirish ----------
function mergeGeometries(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[io + k] = a[k] + vo; io += a.length; }
    else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
    vo += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

class Batch {
  constructor() { this.groups = new Map(); }
  add(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = typeof material === 'string' ? mat(material) : material;
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z);
    geo.applyMatrix4(_m.compose(_v, _q, _s));
    if (!this.groups.has(m.uuid)) this.groups.set(m.uuid, { m, list: [] });
    this.groups.get(m.uuid).list.push(geo);
  }
  box(w, h, d, material, x, y, z, ry = 0) { this.add(new THREE.BoxGeometry(w, h, d), material, x, y, z, 0, ry, 0); }
  cyl(rt, rb, h, material, x, y, z, seg = 12) { this.add(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z); }
  // Tayoqni A nuqtadan B nuqtagacha (masalan, minora oyoqlari)
  beam(ax, ay, az, bx, by, bz, size, material) {
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = dir.length();
    const geo = new THREE.BoxGeometry(size, len, size);
    _q.setFromUnitVectors(UP, dir.normalize());
    _v.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    geo.applyMatrix4(_m.compose(_v, _q, _s));
    const m = typeof material === 'string' ? mat(material) : material;
    if (!this.groups.has(m.uuid)) this.groups.set(m.uuid, { m, list: [] });
    this.groups.get(m.uuid).list.push(geo);
  }
  build(parent) {
    for (const { m, list } of this.groups.values()) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list), m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

// Bino qutisi: teksturasi o‘lchamiga qarab takrorlanadi, tomi devor rangida
function buildingGeo(w, h, d, style) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, 0.005, 0.005); continue; }
      const fw = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * (fw / style.tileW), uv.getY(i) * (h / style.tileH));
    }
  }
  return geo;
}

// ---------- Dunyo ----------
export class World {
  constructor(scene) {
    this.scene = scene;
    this.styles = makeStyles();
    this.lampMat = new THREE.MeshLambertMaterial({ color: '#FFF1C9', emissive: '#FFD27A', emissiveIntensity: 0 });
    this.hash = new Map();
    this.stamp = 0;
    this.zones = [];        // E tugmasi bilan ishlaydigan joylar
    this.markers = [];      // yerdagi yorqin halqalar
    this.parkedSpots = [];  // mashina qo‘yish joylari
    this.countries = new Map();
    for (const def of COUNTRIES) {
      const c = { ...def, ox: def.offset[0], oz: def.offset[1], group: new THREE.Group(), reserved: [], landmarkCells: new Map() };
      c.reserved.push({ kind: 'airport', i: def.airport[0], j: def.airport[1], w: def.airport[2], h: def.airport[3] });
      c.reserved.push({ kind: 'prison', i: def.prison[0], j: def.prison[1], w: def.prison[2], h: def.prison[3] });
      for (const [type, i, j] of def.landmarks) c.landmarkCells.set(`${i},${j}`, type);
      this.countries.set(def.id, c);
      scene.add(c.group);
      this.buildCountry(c);
    }
  }

  // ----- Koordinata yordamchilari -----
  countryAt(x, z) {
    for (const c of this.countries.values()) if (Math.abs(x - c.ox) < 1200 && Math.abs(z - c.oz) < 1200) return c;
    return this.countries.get('uz');
  }
  reservedAt(c, i, j) {
    return c.reserved.find((r) => i >= r.i && i < r.i + r.w && j >= r.j && j < r.j + r.h) || null;
  }
  cellWalkable(c, i, j) { return i >= -N && i < N && j >= -N && j < N && !this.reservedAt(c, i, j); }
  nodeValid(c, k, l) {
    if (Math.abs(k) > N || Math.abs(l) > N) return false;
    return !c.reserved.some((r) => k > r.i && k < r.i + r.w && l > r.j && l < r.j + r.h);
  }
  edgeOpen(c, k1, l1, k2, l2) {
    if (!this.nodeValid(c, k1, l1) || !this.nodeValid(c, k2, l2)) return false;
    for (const r of c.reserved) {
      if (k1 === k2 && k1 > r.i && k1 < r.i + r.w && Math.min(l1, l2) >= r.j && Math.max(l1, l2) <= r.j + r.h) return false;
      if (l1 === l2 && l1 > r.j && l1 < r.j + r.h && Math.min(k1, k2) >= r.i && Math.max(k1, k2) <= r.i + r.w) return false;
    }
    return true;
  }
  neighbors(c, k, l) {
    return [[k + 1, l], [k - 1, l], [k, l + 1], [k, l - 1]].filter(([a, b]) => this.edgeOpen(c, k, l, a, b));
  }
  nodePos(c, k, l, out = new THREE.Vector3()) { return out.set(c.ox + k * CELL, 0, c.oz + l * CELL); }
  nearestNode(c, x, z) {
    const k0 = Math.round((x - c.ox) / CELL), l0 = Math.round((z - c.oz) / CELL);
    let best = null, bd = Infinity;
    for (let dk = -1; dk <= 1; dk++) for (let dl = -1; dl <= 1; dl++) {
      const k = Math.max(-N, Math.min(N, k0 + dk)), l = Math.max(-N, Math.min(N, l0 + dl));
      if (!this.nodeValid(c, k, l)) continue;
      const d = (c.ox + k * CELL - x) ** 2 + (c.oz + l * CELL - z) ** 2;
      if (d < bd) { bd = d; best = [k, l]; }
    }
    return best || [0, 0];
  }
  // Trotuar ustidami yoki ko‘chadami — balandlik
  groundHeight(x, z) {
    const c = this.countryAt(x, z);
    const lx = x - c.ox, lz = z - c.oz;
    if (Math.abs(lx) > CITY || Math.abs(lz) > CITY) return 0;
    const mx = ((lx % CELL) + CELL) % CELL, mz = ((lz % CELL) + CELL) % CELL;
    const inCell = (m) => m > HALF && m < CELL - HALF;
    if (inCell(mx) && inCell(mz)) return SIDEWALK_H;
    for (const r of c.reserved) {
      const x0 = r.i * CELL + HALF, x1 = (r.i + r.w) * CELL - HALF, z0 = r.j * CELL + HALF, z1 = (r.j + r.h) * CELL - HALF;
      if (lx > x0 && lx < x1 && lz > z0 && lz < z1) return SIDEWALK_H;
    }
    return 0;
  }
  isOnRoad(x, z) { return this.groundHeight(x, z) === 0; }
  district(x, z) {
    const c = this.countryAt(x, z);
    if (c.id !== 'uz') return c.city;
    const lx = x - c.ox, lz = z - c.oz;
    if (Math.hypot(lx, lz) < 110) return 'Toshkent, markaz';
    const a = Math.atan2(lx, -lz) * 180 / Math.PI; // 0 = shimol
    const names = ['Yunusobod', 'Mirzo Ulug‘bek', 'Yashnobod', 'Bektemir', 'Sergeli', 'Chilonzor', 'Shayxontohur', 'Olmazor'];
    return 'Toshkent, ' + names[Math.round(((a + 360) % 360) / 45) % 8];
  }

  // ----- To‘qnashuvlar (oddiy to‘g‘ri to‘rtburchaklar) -----
  addCollider(x0, x1, z0, z1) {
    const col = { x0, x1, z0, z1, s: 0 };
    const H = 24;
    for (let gx = Math.floor(x0 / H); gx <= Math.floor(x1 / H); gx++)
      for (let gz = Math.floor(z0 / H); gz <= Math.floor(z1 / H); gz++) {
        const k = gx * 100003 + gz;
        if (!this.hash.has(k)) this.hash.set(k, []);
        this.hash.get(k).push(col);
      }
  }
  addBoxCollider(x, z, w, d) { this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2); }
  // pos (Vector3) ni to‘siqlardan itarib chiqaradi. To‘qnashgan bo‘lsa true qaytaradi.
  collide(pos, r) {
    const H = 24;
    this.stamp++;
    let hit = false;
    for (let gx = Math.floor((pos.x - r) / H); gx <= Math.floor((pos.x + r) / H); gx++)
      for (let gz = Math.floor((pos.z - r) / H); gz <= Math.floor((pos.z + r) / H); gz++) {
        const list = this.hash.get(gx * 100003 + gz);
        if (!list) continue;
        for (const b of list) {
          if (b.s === this.stamp) continue;
          b.s = this.stamp;
          const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
          const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = r - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
          } else {
            const l = pos.x - b.x0, rr = b.x1 - pos.x, t = pos.z - b.z0, bb = b.z1 - pos.z;
            const m = Math.min(l, rr, t, bb);
            if (m === l) pos.x = b.x0 - r; else if (m === rr) pos.x = b.x1 + r;
            else if (m === t) pos.z = b.z0 - r; else pos.z = b.z1 + r;
          }
        }
      }
    return hit;
  }

  // Mashina uchun: oldi va orqasida ikkita doira (kapsula). Itarilish vektorini qaytaradi.
  collideCar(pos, yaw, out) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    out.set(0, 0, 0);
    let hit = false;
    for (const s of [1.25, -1.25]) {
      const p = this._cp || (this._cp = new THREE.Vector3());
      p.set(pos.x + fx * s, 0, pos.z + fz * s);
      const bx = p.x, bz = p.z;
      if (this.collide(p, 1.0)) {
        hit = true;
        pos.x += p.x - bx; pos.z += p.z - bz;
        out.x += p.x - bx; out.z += p.z - bz;
      }
    }
    return hit;
  }

  setActiveCountry(id) { for (const c of this.countries.values()) c.group.visible = c.id === id; }

  setNight(f) {
    for (const s of Object.values(this.styles)) s.material.emissiveIntensity = f * 0.95;
    this.lampMat.emissiveIntensity = f * 1.2;
  }

  addZone(c, type, x, z, label, extra = {}) {
    const zone = { country: c.id, type, x, z, r: 3.2, label, ...extra };
    this.zones.push(zone);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32),
      new THREE.MeshBasicMaterial({ color: '#F2B632', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, SIDEWALK_H + 0.05, z);
    c.group.add(ring);
    this.markers.push(ring);
    const lab = makeLabel(label, { height: 0.9 });
    lab.position.set(x, 3.2, z);
    c.group.add(lab);
    return zone;
  }

  // ======================= Davlatni qurish =======================
  buildCountry(c) {
    const B = new Batch();
    const { ox, oz } = c;
    // Yer: o‘t va asfalt
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(BOUND * 2 + 400, BOUND * 2 + 400), mat(c.ground));
    grass.rotation.x = -Math.PI / 2; grass.position.set(ox, -0.02, oz); grass.receiveShadow = true;
    c.group.add(grass);
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, CITY * 2), mat('#3E4247'));
    asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(ox, 0.005, oz); asphalt.receiveShadow = true;
    c.group.add(asphalt);

    // Chegara: daraxtlar qatori va ko‘rinmas devor
    for (const s of [-1, 1]) {
      this.addCollider(ox - BOUND, ox + BOUND, oz + s * BOUND - 2, oz + s * BOUND + 2);
      this.addCollider(ox + s * BOUND - 2, ox + s * BOUND + 2, oz - BOUND, oz + BOUND);
      for (let t = -CITY - 20; t <= CITY + 20; t += 9) {
        this.tree(B, ox + t, oz + s * (CITY + 18), 1.2);
        this.tree(B, ox + s * (CITY + 18), oz + t, 1.2);
      }
    }

    // Kvartallar
    const [dx, dz] = c.downtown;
    for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
      if (this.reservedAt(c, i, j)) continue;
      const x0 = ox + i * CELL + HALF, z0 = oz + j * CELL + HALF, x1 = x0 + CELL - ROAD, z1 = z0 + CELL - ROAD;
      B.box(x1 - x0, SIDEWALK_H, z1 - z0, '#B9B7AE', (x0 + x1) / 2, SIDEWALK_H / 2, (z0 + z1) / 2);
      // ko‘cha bo‘yidagi daraxtlar (Toshkent — yashil shahar)
      for (let t = 6; t < CELL - ROAD - 4; t += 11) {
        if (Math.random() < 0.8) this.tree(B, x0 + t, z0 + 0.7, 1);
        if (Math.random() < 0.8) this.tree(B, x0 + t, z1 - 0.7, 1);
        if (Math.random() < 0.8) this.tree(B, x0 + 0.7, z0 + t, 1);
        if (Math.random() < 0.8) this.tree(B, x1 - 0.7, z0 + t, 1);
      }
      const lm = c.landmarkCells.get(`${i},${j}`);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (lm) { this.landmark(B, c, lm, cx, cz); continue; }
      const d = Math.max(Math.abs(i - dx), Math.abs(j - dz));
      const styleName = d <= 1 ? c.styles[0] : d <= 3 ? c.styles[1] : c.styles[2];
      if (styleName === 'house') this.houses(B, x0, z0, x1, z1);
      else if (styleName === 'panel') this.panelBlocks(B, x0, z0, x1, z1, this.styles.panel);
      else this.towers(B, x0, z0, x1, z1, this.styles[styleName], d);
    }

    // Ko‘chalar: chiziqlar, piyoda o‘tish joylari, chiroqlar, mashina joylari
    for (let k = -N; k <= N; k++) for (let l = -N; l <= N; l++) {
      if (!this.nodeValid(c, k, l)) continue;
      const px = ox + k * CELL, pz = oz + l * CELL;
      for (const [nk, nl] of [[k + 1, l], [k, l + 1]]) {
        if (!this.edgeOpen(c, k, l, nk, nl)) continue;
        const horiz = nl === l;
        for (let t = HALF + 6; t < CELL - HALF - 3; t += 6) {
          if (horiz) B.box(3, 0.02, 0.22, '#E9E6DA', px + t, 0.02, pz);
          else B.box(0.22, 0.02, 3, '#E9E6DA', px, 0.02, pz + t);
        }
        // zebra
        for (const end of [HALF + 1.6, CELL - HALF - 1.6]) for (let b = -5; b <= 5; b += 2.2) {
          if (horiz) B.box(2.6, 0.02, 0.8, '#ECEBE4', px + end, 0.021, pz + b);
          else B.box(0.8, 0.02, 2.6, '#ECEBE4', px + b, 0.021, pz + end);
        }
        // mashina to‘xtash joylari (yo‘l chetida)
        if (Math.random() < 0.35) {
          const t = HALF + 12 + Math.random() * (CELL - ROAD - 24);
          if (horiz) this.parkedSpots.push({ country: c.id, x: px + t, z: pz + 5.7, yaw: Math.PI / 2 });
          else this.parkedSpots.push({ country: c.id, x: px - 5.7, z: pz + t, yaw: 0 });
        }
      }
      // ko‘cha chiroqlari
      for (const [sx, sz] of [[1, 1], [-1, -1]]) {
        const lx = px + sx * (HALF + 0.6), lz = pz + sz * (HALF + 0.6);
        if (this.groundHeight(lx, lz) === 0) continue;
        B.box(0.16, 6.5, 0.16, '#5A5F66', lx, 3.25, lz);
        B.box(0.4, 0.18, 0.4, this.lampMat, lx, 6.5, lz);
      }
    }

    for (const r of c.reserved) {
      const x0 = ox + r.i * CELL + HALF, z0 = oz + r.j * CELL + HALF;
      const x1 = ox + (r.i + r.w) * CELL - HALF, z1 = oz + (r.j + r.h) * CELL - HALF;
      B.box(x1 - x0, SIDEWALK_H, z1 - z0, r.kind === 'prison' ? '#8F8B82' : '#B9B7AE', (x0 + x1) / 2, SIDEWALK_H / 2, (z0 + z1) / 2);
      if (r.kind === 'airport') this.airport(B, c, (x0 + x1) / 2, (z0 + z1) / 2);
      else this.prison(B, c, (x0 + x1) / 2, (z0 + z1) / 2);
    }

    B.build(c.group);
    // Spawn nuqtasi: markaziy chorrahaga yaqin trotuar
    c.spawn = new THREE.Vector3(ox + HALF + 2, SIDEWALK_H, oz + HALF + 6);
    c.ownCarSpot = { x: ox + 5.7, z: oz + 24, yaw: Math.PI };
  }

  tree(B, x, z, s) {
    const g = ['#4E7D3A', '#5A8C3F', '#3F6E33', '#6A9A45'][Math.floor(Math.random() * 4)];
    const h = (2.2 + Math.random() * 1.2) * s;
    B.box(0.32 * s, h, 0.32 * s, '#6B4A2E', x, h / 2, z);
    const w = (2.4 + Math.random() * 1.2) * s;
    B.box(w, 2.2 * s, w, g, x, h + 0.9 * s, z);
    B.box(w * 0.6, 1 * s, w * 0.6, g, x, h + 2.4 * s, z);
    this.addBoxCollider(x, z, 0.5, 0.5);
  }

  bld(B, w, h, d, style, x, z, ry = 0, y0 = SIDEWALK_H) {
    B.add(buildingGeo(w, h, d, style), style.material, x, y0 + h / 2, z, 0, ry, 0);
    B.box(w + 0.4, 0.5, d + 0.4, '#8A8D91', x, y0 + h + 0.25, z, ry);
    if (Math.abs(Math.sin(ry)) > 0.01) {
      const ext = Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * d / 2;
      const ext2 = Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * d / 2;
      this.addCollider(x - ext, x + ext, z - ext2, z + ext2);
    } else this.addBoxCollider(x, z, w, d);
  }

  towers(B, x0, z0, x1, z1, style, d) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (Math.random() < 0.5) {
      const w = 22 + Math.random() * 10, dd = 22 + Math.random() * 10;
      const h = (d === 0 ? 55 : 32) + Math.random() * 40;
      this.bld(B, w, h, dd, style, cx, cz);
      if (Math.random() < 0.5) this.bld(B, w * 0.6, 14, dd * 0.6, style, cx, cz, 0, SIDEWALK_H + h + 0.5);
    } else {
      for (const s of [-1, 1]) {
        const w = 15 + Math.random() * 5, h = 20 + Math.random() * (d === 0 ? 60 : 30);
        this.bld(B, w, h, w, style, cx + s * 11, cz + s * 11);
      }
      this.tree(B, cx - 12, cz + 12, 1.1);
      this.tree(B, cx + 12, cz - 12, 1.1);
    }
  }

  panelBlocks(B, x0, z0, x1, z1, style) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const alongX = Math.random() < 0.5;
    const h = Math.random() < 0.6 ? 27 : 15; // 9 yoki 5 qavatli
    for (const s of [-1, 1]) {
      if (alongX) this.bld(B, 40, h, 11, style, cx, cz + s * 14);
      else this.bld(B, 11, h, 40, style, cx + s * 14, cz);
    }
    // hovlidagi bolalar maydonchasi
    B.box(1.6, 1.2, 1.6, '#D9452B', cx - 3, SIDEWALK_H + 0.6, cz);
    B.box(0.2, 2.4, 0.2, '#2D6CB5', cx + 3, SIDEWALK_H + 1.2, cz - 1);
    B.box(0.2, 2.4, 0.2, '#2D6CB5', cx + 3, SIDEWALK_H + 1.2, cz + 1);
    B.box(0.2, 0.2, 2.2, '#2D6CB5', cx + 3, SIDEWALK_H + 2.4, cz);
    this.tree(B, cx - 9, cz + (alongX ? 0 : 9), 1);
    this.tree(B, cx + 9, cz - (alongX ? 0 : 9), 1);
  }

  houses(B, x0, z0, x1, z1) {
    const lot = (x1 - x0 - 6.8) / 2;
    const style = this.styles.house;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const lx0 = x0 + 3.4 + a * lot, lz0 = z0 + 3.4 + b * lot;
      const cx = lx0 + lot / 2, cz = lz0 + lot / 2;
      const w = 9 + Math.random() * 4, d = 8 + Math.random() * 3, h = 3.6 + Math.random() * 2.4;
      const hx = cx + (a ? 2 : -2), hz = cz + (b ? 2 : -2);
      this.bld(B, w, h, d, style, hx, hz);
      B.box(w + 1.2, 0.35, d + 1.2, ['#3F7D5C', '#9B3B2F', '#5F6F80'][Math.floor(Math.random() * 3)], hx, SIDEWALK_H + h + 0.6, hz);
      // hovli devori (darvoza tomonida ochiq joy)
      const wc = '#CDB48E', wh = 2.2, y = SIDEWALK_H + wh / 2, e = 0.2;
      const gateSideZ = b ? lz0 + lot - e : lz0 + e;
      const backZ = b ? lz0 + e : lz0 + lot - e;
      B.box(lot, wh, 0.3, wc, cx, y, backZ); this.addBoxCollider(cx, backZ, lot, 0.3);
      B.box(0.3, wh, lot, wc, lx0 + e, y, cz); this.addBoxCollider(lx0 + e, cz, 0.3, lot);
      B.box(0.3, wh, lot, wc, lx0 + lot - e, y, cz); this.addBoxCollider(lx0 + lot - e, cz, 0.3, lot);
      const seg = (lot - 4) / 2;
      B.box(seg, wh, 0.3, wc, lx0 + seg / 2, y, gateSideZ); this.addBoxCollider(lx0 + seg / 2, gateSideZ, seg, 0.3);
      B.box(seg, wh, 0.3, wc, lx0 + lot - seg / 2, y, gateSideZ); this.addBoxCollider(lx0 + lot - seg / 2, gateSideZ, seg, 0.3);
      if (Math.random() < 0.7) this.tree(B, cx + (a ? -6 : 6), cz + (b ? -6 : 6), 0.9);
    }
  }

  label(c, text, x, y, z, h = 4) {
    const l = makeLabel(text, { height: h });
    l.position.set(x, y, z);
    c.group.add(l);
  }

  // ======================= Mashhur binolar =======================
  landmark(B, c, type, x, z) {
    const y0 = SIDEWALK_H;
    const name = LANDMARK_NAMES[type];
    if (type === 'tvTower') {
      // Toshkent teleminorasi: uchta qiya oyoq, panjarali ustun, kuzatuv maydonchasi, antenna
      const steel = '#8E9BA8';
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 + 0.3;
        B.beam(x + Math.cos(a) * 19, y0, z + Math.sin(a) * 19, x + Math.cos(a) * 3, 62, z + Math.sin(a) * 3, 2.6, steel);
        this.addBoxCollider(x + Math.cos(a) * 18, z + Math.sin(a) * 18, 4, 4);
      }
      B.cyl(5, 9, 6, '#3D7CAD', x, y0 + 3, z, 16); this.addBoxCollider(x, z, 14, 14);
      B.cyl(2.4, 4, 120, steel, x, 62 + 60, z, 6);
      for (let t = 70; t < 180; t += 8) B.cyl(4.2 - (t - 62) / 60, 4.2 - (t - 62) / 60, 0.8, '#6C7884', x, t, z, 6);
      B.cyl(11, 7, 4, '#C9D1D8', x, 108, z, 20);
      B.cyl(11.5, 11.5, 4, '#3D5E7D', x, 112, z, 20);
      B.cyl(9, 11.5, 3, '#C9D1D8', x, 115.5, z, 20);
      B.cyl(6, 6, 3, '#3D5E7D', x, 128, z, 16);
      for (let s = 0; s < 8; s++) B.cyl(1.1, 1.3, 5, s % 2 ? '#F2F2F2' : '#C8323C', x, 184 + s * 5, z, 8);
      this.label(c, name, x, 232, z, 10);
    } else if (type === 'hotelUz') {
      // "O‘zbekiston" mehmonxonasi: oq, panjarali, biroz egilgan fasad
      const st = this.styles.grille, R = 40;
      for (let s = -2; s <= 2; s++) {
        const a = s * 0.235;
        this.bld(B, 9.8, 60, 14, st, x + Math.sin(a) * R, z - 4 + (R - Math.cos(a) * R), -a);
      }
      B.box(30, 4.5, 8, '#D7D7CF', x, y0 + 2.25, z + 8);
      this.addBoxCollider(x, z + 8, 30, 8);
      this.label(c, name, x, 72, z, 6);
    } else if (type === 'temur') {
      // Amir Temur xiyoboni: dumaloq bog‘ va markazda otliq haykal
      B.cyl(22, 22, 0.25, '#6E9C4A', x, y0 + 0.12, z, 32);
      B.cyl(8, 8, 0.3, '#C8BFA8', x, y0 + 0.15, z, 24);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        this.tree(B, x + Math.cos(a) * 18, z + Math.sin(a) * 18, 1.3);
      }
      const br = '#7D5A34';
      B.box(4.4, 3.2, 7, '#5E6066', x, y0 + 1.6, z);
      this.addBoxCollider(x, z, 4.6, 7.2);
      const hy = y0 + 3.2;
      B.box(1.7, 1.7, 4.4, br, x, hy + 2.3, z);           // ot tanasi
      for (const [lx, lz] of [[-0.6, 1.6], [0.6, 1.6], [-0.6, -1.6], [0.6, -1.6]]) B.box(0.45, 1.6, 0.45, br, x + lx, hy + 0.8, z + lz);
      B.beam(x, hy + 2.6, z + 1.8, x, hy + 4.2, z + 3.1, 0.9, br);  // bo‘yin
      B.box(0.8, 0.8, 1.6, br, x, hy + 4.3, z + 3.6);       // bosh
      B.box(1.2, 1.6, 0.8, br, x, hy + 4, z - 0.2);          // chavandoz
      B.box(0.75, 0.75, 0.75, br, x, hy + 5.2, z - 0.2);
      B.beam(x + 0.7, hy + 4.4, z - 0.2, x + 1.0, hy + 5.4, z + 1.4, 0.32, br);
      this.label(c, name, x, 16, z, 4);
    } else if (type === 'chorsu') {
      // Chorsu bozori: katta firuza gumbaz
      B.cyl(20, 20, 7, '#E7E2D6', x, y0 + 3.5, z, 28);
      this.addBoxCollider(x, z, 38, 38);
      B.add(new THREE.SphereGeometry(19, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#2BA7A9', x, y0 + 7, z);
      for (const r of [17.5, 13, 7.5]) {
        const t = Math.acos(r / 19);
        B.cyl(r + 0.25, r + 0.25, 0.5, '#1D6F8C', x, y0 + 7 + Math.sin(t) * 19, z, 28);
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        B.add(new THREE.SphereGeometry(4, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), '#2BA7A9', x + Math.cos(a) * 22, y0 + 5, z + Math.sin(a) * 22);
        B.cyl(4, 4, 5, '#E7E2D6', x + Math.cos(a) * 22, y0 + 2.5, z + Math.sin(a) * 22, 14);
      }
      this.label(c, name, x, 34, z, 5);
    } else if (type === 'minor') {
      // Minor masjidi: oq bino, havorang gumbaz, ikki minora
      B.box(30, 11, 20, '#F1F1EC', x, y0 + 5.5, z); this.addBoxCollider(x, z, 30, 20);
      B.box(12, 17, 3, '#F1F1EC', x, y0 + 8.5, z + 11); this.addBoxCollider(x, z + 11, 12, 3);
      B.box(7, 11, 0.4, '#1B5E9E', x, y0 + 6, z + 12.6);
      B.cyl(7, 7, 4, '#F1F1EC', x, y0 + 13, z - 1, 20);
      B.add(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#3BA3D9', x, y0 + 15, z - 1);
      for (const s of [-1, 1]) {
        B.cyl(1.3, 1.6, 30, '#F1F1EC', x + s * 18, y0 + 15, z + 10, 10);
        B.cyl(1.9, 1.9, 1.4, '#F1F1EC', x + s * 18, y0 + 26, z + 10, 10);
        B.add(new THREE.ConeGeometry(1.6, 3.2, 10), '#3BA3D9', x + s * 18, y0 + 31.6, z + 10);
        this.addBoxCollider(x + s * 18, z + 10, 3.2, 3.2);
      }
      this.label(c, name, x, 40, z, 5);
    } else if (type === 'bayterek') {
      B.cyl(16, 16, 0.3, '#D9D5CC', x, y0 + 0.15, z, 24);
      B.cyl(2.2, 4.5, 62, '#F4F4F2', x, y0 + 31, z, 10); this.addBoxCollider(x, z, 9, 9);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        B.beam(x, 50, z, x + Math.cos(a) * 9, 70, z + Math.sin(a) * 9, 0.8, '#F4F4F2');
      }
      B.add(new THREE.SphereGeometry(10, 20, 14), mat('#E8B33C', { emissive: '#3a2a05' }), x, 72, z);
      this.label(c, name, x, 90, z, 6);
    } else if (type === 'khanShatyr') {
      B.add(new THREE.ConeGeometry(22, 60, 3), mat('#EDE3B8'), x, y0 + 30, z, 0.1, 0.3, 0);
      this.addBoxCollider(x, z, 34, 34);
      this.label(c, name, x, 70, z, 5);
    } else if (type === 'galata') {
      B.cyl(7, 8, 42, '#C9B79C', x, y0 + 21, z, 16); this.addBoxCollider(x, z, 15, 15);
      B.cyl(8.6, 8.6, 1.4, '#B0A088', x, y0 + 34, z, 16);
      B.cyl(7, 7, 4, '#3F4A55', x, y0 + 37, z, 16);
      B.add(new THREE.ConeGeometry(8.2, 14, 16), '#56677A', x, y0 + 46, z);
      this.label(c, name, x, 62, z, 5);
    } else if (type === 'mosqueBig') {
      B.box(42, 14, 42, '#D8D1C4', x, y0 + 7, z); this.addBoxCollider(x, z, 42, 42);
      B.cyl(11, 11, 6, '#D8D1C4', x, y0 + 17, z, 20);
      B.add(new THREE.SphereGeometry(13, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#7E8890', x, y0 + 20, z);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) B.add(new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#7E8890', x + a * 13, y0 + 14, z + b * 13);
      for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        B.cyl(1.1, 1.3, 46, '#E4DED2', x + a * 22, y0 + 23, z + b * 22, 10);
        B.add(new THREE.ConeGeometry(1.4, 6, 10), '#7E8890', x + a * 22, y0 + 49, z + b * 22);
        this.addBoxCollider(x + a * 22, z + b * 22, 2.6, 2.6);
      }
      this.label(c, name, x, 60, z, 5);
    } else if (type === 'spasskaya') {
      const red = '#A3382D';
      B.box(12, 26, 12, red, x, y0 + 13, z); this.addBoxCollider(x, z, 12, 12);
      B.box(9, 10, 9, red, x, y0 + 31, z);
      B.box(9.4, 1, 9.4, '#F0E6DA', x, y0 + 26.5, z);
      const clock = new THREE.MeshLambertMaterial({ map: canvasTexture(64, 64, (g) => {
        g.fillStyle = '#16233A'; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = '#E8C66A'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 12); g.moveTo(32, 32); g.lineTo(46, 36); g.stroke();
      }) });
      B.box(7, 7, 9.2, clock, x, y0 + 31, z);
      B.add(new THREE.ConeGeometry(5, 18, 8), '#3E6B4E', x, y0 + 45, z);
      B.add(new THREE.OctahedronGeometry(1.6), mat('#E02B2B', { emissive: '#600' }), x, y0 + 56, z);
      for (const s of [-1, 1]) {
        B.box(18, 10, 3, red, x + s * 15, y0 + 5, z); this.addBoxCollider(x + s * 15, z, 18, 3);
        for (let t = -8; t <= 8; t += 2.4) B.box(1.2, 1.6, 3, red, x + s * 15 + t, y0 + 10.8, z);
      }
      this.label(c, name, x, 66, z, 5);
    }
  }

  // ======================= Aeroport =======================
  airport(B, c, cx, cz) {
    const y0 = SIDEWALK_H;
    B.box(118, 0.05, 18, '#2E3136', cx, y0 + 0.03, cz - 26);
    for (let t = -52; t <= 52; t += 9) B.box(5, 0.02, 0.6, '#ECEBE4', cx + t, y0 + 0.07, cz - 26);
    const glassStyle = this.styles.glass;
    this.bld(B, 60, 13, 16, glassStyle, cx, cz + 22);
    B.box(64, 1, 22, '#D7D9DC', cx, y0 + 13.6, cz + 22);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 3), new THREE.MeshBasicMaterial({ map: textTexture(c.airportName, { bg: '#16233A', fg: '#F2B632', w: 1024, h: 96, font: 58 }) }));
    sign.position.set(cx, y0 + 10, cz + 30.2);
    c.group.add(sign);
    // boshqaruv minorasi
    B.cyl(2.2, 2.6, 26, '#E6E6E1', cx + 47, y0 + 13, cz + 20, 12);
    B.cyl(4.2, 3.4, 4, '#3D7CAD', cx + 47, y0 + 28, cz + 20, 12);
    this.addBoxCollider(cx + 47, cz + 20, 5, 5);
    // samolyot (umumiy, belgisiz)
    const px = cx - 18, pz = cz - 2;
    const fus = new THREE.CylinderGeometry(2, 2, 30, 14); fus.rotateZ(Math.PI / 2);
    B.add(fus, '#F4F5F7', px, y0 + 3.6, pz);
    const nose = new THREE.ConeGeometry(2, 4, 14); nose.rotateZ(-Math.PI / 2);
    B.add(nose, '#F4F5F7', px + 17, y0 + 3.6, pz);
    B.box(30, 0.4, 0.5, '#1B5E9E', px, y0 + 3.6, pz + 2.02);
    B.box(30, 0.4, 0.5, '#1B5E9E', px, y0 + 3.6, pz - 2.02);
    B.box(6, 0.5, 30, '#DCDFE3', px + 1, y0 + 3, pz);
    B.box(3.5, 6, 0.5, '#1B5E9E', px - 13.5, y0 + 7, pz);
    B.box(3, 0.4, 10, '#DCDFE3', px - 13.5, y0 + 4.2, pz);
    for (const s of [-1, 1]) B.cyl(1, 1, 3.4, '#9AA3AD', px + 2.5, y0 + 2, pz + s * 7, 10);
    this.addBoxCollider(px, pz, 34, 6);
    this.addBoxCollider(px + 1, pz, 6, 30);
    // bayroq
    B.cyl(0.14, 0.18, 12, '#C9CDD2', cx - 24, y0 + 6, cz + 37, 8);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3), new THREE.MeshLambertMaterial({ map: makeFlagTexture(c.id), side: THREE.DoubleSide }));
    flag.position.set(cx - 21.7, y0 + 10.4, cz + 37);
    c.group.add(flag);
    c.airportPos = new THREE.Vector3(cx, y0, cz + 40);
    this.addZone(c, 'airport', cx, cz + 36, 'Aeroport  [E]');
  }

  // ======================= Qamoqxona =======================
  prison(B, c, cx, cz) {
    const y0 = SIDEWALK_H, W = 58, wh = 7, wc = '#A8A49A';
    // devorlar (darvoza shimol tomonda, yopiq)
    B.box(2 * W, wh, 1.5, wc, cx, y0 + wh / 2, cz + W); this.addBoxCollider(cx, cz + W, 2 * W, 1.5);
    for (const s of [-1, 1]) { B.box(1.5, wh, 2 * W, wc, cx + s * W, y0 + wh / 2, cz); this.addBoxCollider(cx + s * W, cz, 1.5, 2 * W); }
    const seg = W - 5;
    for (const s of [-1, 1]) { B.box(seg, wh, 1.5, wc, cx + s * (5 + seg / 2), y0 + wh / 2, cz - W); this.addBoxCollider(cx + s * (5 + seg / 2), cz - W, seg, 1.5); }
    B.box(10, wh - 0.5, 0.8, '#4C5560', cx, y0 + (wh - 0.5) / 2, cz - W); this.addBoxCollider(cx, cz - W, 10, 1.2);
    // tikanli sim
    for (const [w, d, x, z] of [[2 * W, 0.5, cx, cz + W], [2 * W, 0.5, cx, cz - W], [0.5, 2 * W, cx - W, cz], [0.5, 2 * W, cx + W, cz]]) B.box(w, 0.5, d, '#3A3D42', x, y0 + wh + 0.3, z);
    // kuzatuv minoralari
    for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const tx = cx + a * (W - 3), tz = cz + b * (W - 3);
      for (const [ex, ez] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) B.box(0.4, 10, 0.4, '#5A5F66', tx + ex * 1.6, y0 + 5, tz + ez * 1.6);
      B.box(4.4, 3, 4.4, '#6C727A', tx, y0 + 11.5, tz);
      B.box(5, 0.5, 5, '#3A3D42', tx, y0 + 13.2, tz);
      this.addBoxCollider(tx, tz, 4, 4);
    }
    const ps = this.styles.panel;
    // baraklar, ustaxona, oshxona
    this.bld(B, 36, 7, 12, ps, cx - 22, cz + 34); this.bld(B, 36, 7, 12, ps, cx + 22, cz + 34);
    this.bld(B, 24, 8, 14, ps, cx + 30, cz - 26);
    this.bld(B, 22, 7, 14, ps, cx - 30, cz - 26);
    for (const [t, x, z, ry] of [['Barak', cx - 22, cz + 27.9, Math.PI], ['Ustaxona', cx + 30, cz - 18.9, 0], ['Oshxona', cx - 30, cz - 18.9, 0]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: textTexture(t, { w: 256, h: 52, font: 34 }) }));
      s.position.set(x, y0 + 5.5, z); s.rotation.y = ry; c.group.add(s);
    }
    // sport maydoni (turnik)
    for (const s of [-1, 1]) B.box(0.2, 2.6, 0.2, '#3A3D42', cx + s * 1.4, y0 + 1.3, cz + 6);
    B.box(3, 0.12, 0.12, '#3A3D42', cx, y0 + 2.6, cz + 6);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.4), new THREE.MeshBasicMaterial({ map: textTexture(c.prisonName, { w: 1024, h: 110, font: 60 }) }));
    sign.position.set(cx, y0 + 8.6, cz - W - 0.8); sign.rotation.y = Math.PI;
    c.group.add(sign);
    c.prison = {
      cx, cz, W,
      inside: new THREE.Vector3(cx, y0, cz + 12),
      release: new THREE.Vector3(cx, y0, cz - W - 4),
    };
    this.addZone(c, 'work', cx + 30, cz - 15, 'Ish  [E]');
    this.addZone(c, 'canteen', cx - 30, cz - 15, 'Ovqat  [E]');
    this.addZone(c, 'barrack', cx - 22, cz + 24, 'Uyqu  [E]');
  }

  // Minimap uchun davlat xaritasi (bir marta chiziladi)
  renderMap(c, size = 512) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const span = BOUND * 2, s = size / span;
    const tx = (x) => (x - c.ox + BOUND) * s, tz = (z) => (z - c.oz + BOUND) * s;
    g.fillStyle = '#5E7A47'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#3B4048'; g.fillRect(tx(c.ox - CITY), tz(c.oz - CITY), CITY * 2 * s, CITY * 2 * s);
    for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
      if (this.reservedAt(c, i, j)) continue;
      const lm = c.landmarkCells.get(`${i},${j}`);
      g.fillStyle = lm ? '#2BB5B0' : '#9C9888';
      g.fillRect(tx(c.ox + i * CELL + HALF), tz(c.oz + j * CELL + HALF), (CELL - ROAD) * s, (CELL - ROAD) * s);
    }
    for (const r of c.reserved) {
      g.fillStyle = r.kind === 'airport' ? '#5B8FC7' : '#7A4A4A';
      g.fillRect(tx(c.ox + r.i * CELL + HALF), tz(c.oz + r.j * CELL + HALF), (r.w * CELL - ROAD) * s, (r.h * CELL - ROAD) * s);
      g.fillStyle = '#FFFFFF'; g.font = '700 13px "Rubik", sans-serif'; g.textAlign = 'center';
      g.fillText(r.kind === 'airport' ? '✈' : '⛓', tx(c.ox + (r.i + r.w / 2) * CELL), tz(c.oz + (r.j + r.h / 2) * CELL) + 5);
    }
    return { canvas: cv, scale: s, bound: BOUND };
  }
}
