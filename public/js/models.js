// Blokli (past poligonli) modellar: odamlar, mashinalar, yozuvlar, bayroqlar.
// Hamma narsa oddiy qutilardan yig‘iladi — tashqi 3D fayl kerak emas.
import * as THREE from 'three';

// ---------- Materiallar va geometriya keshi (tezlik uchun) ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function cyl(rt, rb, h, material, seg = 12, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Canvas teksturalar ----------
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; // blokli uslub uchun piksel ko‘rinishi
  return t;
}

// Chust do‘ppisi: qora fon, oq "qalampir" naqshlari
let doppiTex = null;
function getDoppiTexture() {
  if (doppiTex) return doppiTex;
  // har bir yon tomonda bitta egilgan "qalampir" naqshi
  doppiTex = canvasTexture(64, 32, (g, w, h) => {
    g.fillStyle = '#121212'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#F5F5F0';
    g.beginPath();
    g.moveTo(22, 26);
    g.bezierCurveTo(14, 18, 22, 4, 36, 6);
    g.bezierCurveTo(46, 8, 46, 18, 40, 20);
    g.bezierCurveTo(36, 12, 30, 16, 32, 22);
    g.closePath();
    g.fill();
    g.fillRect(4, 28, 56, 2);
  });
  return doppiTex;
}

// ---------- Odam (blokli personaj) ----------
export const SKINS = ['#E8B48A', '#D9A074', '#C68B5E', '#F0C9A0', '#B97A50'];
export const HAIRS = ['#1E1A17', '#2F241C', '#4A3626', '#111111', '#6B5B4B'];

export function makeCharacter(opt = {}) {
  const shirt = opt.shirt || '#2BB5B0';
  const pants = opt.pants || '#2E3A59';
  const skin = opt.skin || SKINS[0];
  const hair = opt.hair || HAIRS[0];
  const g = new THREE.Group();
  const parts = {};
  const limb = (w, h, d, color, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const m = box(w, h, d, color, 0, -h / 2, 0);
    pivot.add(m);
    g.add(pivot);
    return { pivot, mesh: m };
  };
  const legL = limb(0.26, 0.85, 0.28, pants, -0.15, 0.85);
  const legR = limb(0.26, 0.85, 0.28, pants, 0.15, 0.85);
  legL.pivot.add(box(0.28, 0.12, 0.36, '#2A2420', 0, -0.82, 0.04));
  legR.pivot.add(box(0.28, 0.12, 0.36, '#2A2420', 0, -0.82, 0.04));
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.21, 0);
  g.add(torso);
  const armL = limb(0.2, 0.66, 0.22, shirt, -0.42, 1.53);
  const armR = limb(0.2, 0.66, 0.22, shirt, 0.42, 1.53);
  armL.pivot.add(box(0.17, 0.16, 0.19, skin, 0, -0.74, 0));
  armR.pivot.add(box(0.17, 0.16, 0.19, skin, 0, -0.74, 0));

  const head = new THREE.Group();
  head.position.set(0, 1.58, 0);
  head.add(box(0.46, 0.46, 0.46, skin, 0, 0.24, 0));
  head.add(box(0.07, 0.09, 0.02, '#1A1A1A', -0.1, 0.29, 0.235));
  head.add(box(0.07, 0.09, 0.02, '#1A1A1A', 0.1, 0.29, 0.235));
  head.add(box(0.14, 0.03, 0.02, '#7A3B2E', 0, 0.13, 0.235));
  head.add(box(0.48, 0.1, 0.48, hair, 0, 0.5, 0));
  head.add(box(0.48, 0.28, 0.06, hair, 0, 0.36, -0.22));
  g.add(head);

  const hatGroup = new THREE.Group();
  head.add(hatGroup);
  setHat(hatGroup, opt.hat || 'yoq');

  if (opt.badge) torso.add(box(0.16, 0.1, 0.02, '#F3F6F9', 0.15, 0.15, 0.18));

  parts.legL = legL.pivot; parts.legR = legR.pivot;
  parts.armL = armL.pivot; parts.armR = armR.pivot;
  parts.head = head; parts.torso = torso; parts.hat = hatGroup;

  return {
    group: g,
    parts,
    setClothes(shirtColor, pantsColor) {
      torso.material = mat(shirtColor);
      armL.mesh.material = mat(shirtColor);
      armR.mesh.material = mat(shirtColor);
      if (pantsColor) { legL.mesh.material = mat(pantsColor); legR.mesh.material = mat(pantsColor); }
    },
    setHat(type) { setHat(hatGroup, type); },
  };
}

function setHat(group, type) {
  while (group.children.length) group.remove(group.children[0]);
  if (type === 'doppi') {
    const tex = getDoppiTexture();
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const top = mat('#121212');
    const m = new THREE.Mesh(boxGeo(0.5, 0.14, 0.5), [side, side, top, top, side, side]);
    m.position.y = 0.57; m.castShadow = true;
    group.add(m);
  } else if (type === 'kepka') {
    group.add(box(0.5, 0.14, 0.5, '#C8323C', 0, 0.57, 0));
    group.add(box(0.44, 0.04, 0.26, '#C8323C', 0, 0.52, 0.34));
  } else if (type === 'police') {
    group.add(cyl(0.32, 0.27, 0.16, '#1B2E52', 14, 0, 0.6, 0));
    group.add(cyl(0.28, 0.28, 0.06, '#C8323C', 14, 0, 0.55, 0));
    group.add(box(0.4, 0.03, 0.2, '#111111', 0, 0.52, 0.3));
  }
}

// Yurish animatsiyasi: phase — qadam fazasi, amount — 0..1 kuch
export function animateCharacter(parts, phase, amount) {
  const s = Math.sin(phase) * amount;
  parts.legL.rotation.x = s * 0.8;
  parts.legR.rotation.x = -s * 0.8;
  parts.armL.rotation.x = -s * 0.7;
  parts.armR.rotation.x = s * 0.7;
}

// ---------- Mashina ----------
// O‘zbekiston ko‘chalarida oq mashinalar ko‘p — ranglar ham shunga mos
export const CAR_COLORS = ['#F4F4F2', '#F4F4F2', '#F4F4F2', '#F4F4F2', '#C9CDD2', '#C9CDD2', '#22262B', '#7A8794', '#8C1C24', '#2C4F7C'];
const glass = () => mat('#2B3E52', { emissive: '#0a1420' });

export function makeCar(opt = {}) {
  const color = opt.color || '#F4F4F2';
  const g = new THREE.Group();
  g.add(box(1.84, 0.62, 4.3, color, 0, 0.66, 0));
  g.add(box(1.62, 0.62, 2.2, color, 0, 1.28, -0.25));
  g.add(box(1.66, 0.4, 1.86, glass(), 0, 1.32, -0.25));
  g.add(box(1.44, 0.44, 0.06, glass(), 0, 1.3, 0.86));
  g.add(box(1.44, 0.4, 0.06, glass(), 0, 1.3, -1.36));
  g.add(box(1.5, 0.2, 0.05, '#1C1C1C', 0, 0.62, 2.16));
  const head = mat('#FFF4C2', { emissive: '#8a7a40' });
  g.add(box(0.4, 0.16, 0.05, head, -0.6, 0.78, 2.16));
  g.add(box(0.4, 0.16, 0.05, head, 0.6, 0.78, 2.16));
  const tail = mat('#B3121B', { emissive: '#4a0508' });
  g.add(box(0.4, 0.16, 0.05, tail, -0.6, 0.8, -2.16));
  g.add(box(0.4, 0.16, 0.05, tail, 0.6, 0.8, -2.16));
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.86, 1.35], [0.86, 1.35], [-0.86, -1.35], [0.86, -1.35]]) {
    const w = new THREE.Mesh(wGeo, mat('#1A1A1A'));
    w.position.set(x, 0.38, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  const car = { group: g, wheels, lightRed: null, lightBlue: null };
  if (opt.police) {
    g.add(box(1.86, 0.2, 4.32, '#1E4FA8', 0, 0.74, 0));
    car.lightRed = new THREE.MeshLambertMaterial({ color: '#E02B2B', emissive: '#000000' });
    car.lightBlue = new THREE.MeshLambertMaterial({ color: '#2B5CE0', emissive: '#000000' });
    g.add(box(0.55, 0.16, 0.34, car.lightRed, -0.3, 1.67, -0.2));
    g.add(box(0.55, 0.16, 0.34, car.lightBlue, 0.3, 1.67, -0.2));
    const tex = textTexture(opt.police, { bg: '#1E4FA8', fg: '#FFFFFF', w: 256, h: 48, font: 30 });
    const plateMat = new THREE.MeshLambertMaterial({ map: tex });
    const geo = new THREE.PlaneGeometry(2.2, 0.42);
    const left = new THREE.Mesh(geo, plateMat);
    left.position.set(-0.94, 0.86, 0); left.rotation.y = -Math.PI / 2;
    const right = new THREE.Mesh(geo, plateMat);
    right.position.set(0.94, 0.86, 0); right.rotation.y = Math.PI / 2;
    g.add(left, right);
  }
  return car;
}

// ---------- Yozuvlar ----------
export function textTexture(text, { bg = '#14203C', fg = '#FFFFFF', w = 512, h = 96, font = 54 } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `700 ${font}px "Baloo 2", "Trebuchet MS", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 16);
  });
}

// Havoda turadigan nom (ism yoki joy nomi)
export function makeLabel(text, { height = 1, fg = '#FFFFFF', bg = 'rgba(16,32,60,0.78)', depthTest = true } = {}) {
  const font = 44;
  const pad = 22;
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = `700 ${font}px "Baloo 2", "Trebuchet MS", sans-serif`;
  const tw = Math.ceil(tmp.measureText(text).width);
  const w = tw + pad * 2, h = font + 26;
  const tex = canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    const r = 18;
    g.beginPath();
    g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r);
    g.fill();
    g.fillStyle = fg;
    g.font = `700 ${font}px "Baloo 2", "Trebuchet MS", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });
  tex.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest, transparent: true }));
  sprite.scale.set((w / h) * height, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// ---------- Bayroqlar ----------
export function makeFlagTexture(id) {
  return canvasTexture(150, 100, (g, w, h) => {
    const moon = (x, y, r, color, bg, dx) => {
      g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = bg; g.beginPath(); g.arc(x + dx, y, r * 0.82, 0, Math.PI * 2); g.fill();
    };
    if (id === 'uz') {
      g.fillStyle = '#0099B5'; g.fillRect(0, 0, w, h / 3);
      g.fillStyle = '#FFFFFF'; g.fillRect(0, h / 3, w, h / 3);
      g.fillStyle = '#1EB53A'; g.fillRect(0, (2 * h) / 3, w, h / 3);
      g.fillStyle = '#CE1126'; g.fillRect(0, h / 3 - 2, w, 2); g.fillRect(0, (2 * h) / 3, w, 2);
      moon(18, 16, 10, '#FFFFFF', '#0099B5', 4);
      // 12 yulduz: 3 + 4 + 5, o‘ngga tekislangan
      g.fillStyle = '#FFFFFF';
      for (let r = 0; r < 3; r++) {
        const count = r + 3;
        for (let c = 5 - count; c < 5; c++) g.fillRect(34 + c * 8, 5 + r * 8, 3, 3);
      }
    } else if (id === 'kz') {
      g.fillStyle = '#00AFCA'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FEC50C';
      g.beginPath(); g.arc(w / 2, h / 2 - 6, 15, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.fillRect(w / 2 + Math.cos(a) * 20 - 1.5, h / 2 - 6 + Math.sin(a) * 20 - 1.5, 3, 3);
      }
      g.fillRect(w / 2 - 22, h / 2 + 22, 44, 5);
      g.fillRect(8, 6, 6, h - 12);
    } else if (id === 'tr') {
      g.fillStyle = '#E30A17'; g.fillRect(0, 0, w, h);
      moon(55, 50, 25, '#FFFFFF', '#E30A17', 7);
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 5 : 12, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(88 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
      g.fill();
    } else if (id === 'ru') {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h / 3);
      g.fillStyle = '#0039A6'; g.fillRect(0, h / 3, w, h / 3);
      g.fillStyle = '#D52B1E'; g.fillRect(0, (2 * h) / 3, w, h / 3);
    }
  });
}
