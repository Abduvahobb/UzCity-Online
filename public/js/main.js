// UzCity Online — asosiy o‘yin fayli
import * as THREE from 'three';
import { World, SIDEWALK_H } from './world.js';
import { makeCharacter, animateCharacter, makeCar, makeFlagTexture, CAR_COLORS, makeLabel } from './models.js';
import { Pedestrians, Traffic, wrapCharacter } from './npc.js';
import { Police } from './police.js';
import { Prison } from './prison.js';
import { Network } from './network.js';
import { Voice } from './voice.js';
import { UI } from './ui.js';

const SHIRT_COLORS = ['#2BB5B0', '#C8323C', '#F2B632', '#2D6CB5', '#3F8F5A', '#6B4FA0', '#F3F6F9', '#22262B'];
const FLIGHT_PRICE = 400000;
const SALARY = 300000;
const HOSPITAL_FEE = 100000;
const WALK = 4.2, RUN = 8.2;
const PLATE = '01 A 777 UZ';

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

class Game {
  constructor() {
    // ----- Render -----
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#8CC8EE', 90, 430);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
    this.hemi = new THREE.HemisphereLight('#DDEEFF', '#6B7A4A', 0.9);
    this.sun = new THREE.DirectionalLight('#FFF1D6', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });

    // ----- Dunyo va aholi -----
    this.ui = new UI();
    this.world = new World(this.scene);
    this.peds = new Pedestrians(this.world);
    this.peds.populate(36);
    this.traffic = new Traffic(this.world);
    this.traffic.populate(16);
    this.setupPrisonPeople();
    this.cars = [];
    this.setupCars();

    // ----- O‘yinchi -----
    this.profile = this.loadProfile();
    const ch = makeCharacter({ shirt: this.profile.shirt, hat: this.profile.hat });
    this.player = {
      ch, root: wrapCharacter(ch), pos: new THREE.Vector3(), vy: 0, yaw: 0, moveSpeed: 0, onGround: true,
      car: null, down: 0, phase: 0,
    };
    this.scene.add(this.player.root);

    this.police = new Police(this);
    this.prison = new Prison(this);
    this.net = new Network(this);
    this.voice = new Voice(this);

    this.country = this.world.countries.get('uz');
    this.world.setActiveCountry('uz');
    this.player.pos.copy(this.country.spawn);
    this.money = this.profile.money ?? 1500000;
    this.convictions = this.profile.convictions ?? 0;
    this.health = 100;
    this.clock = 8 * 60;
    this.totalMinutes = this.clock;
    this.volume = 1;
    this.cam = { yaw: Math.PI, pitch: -0.18, fps: false, carOffset: 0, carIdle: 0 };
    this.keys = new Set();
    this.started = false;
    this.hitCooldown = new Map();
    this.lastSave = 0;

    this.setupLobby();
    this.setupInput();
    this.clockObj = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ======================= Boshlang‘ich sozlash =======================
  setupPrisonPeople() {
    for (const c of this.world.countries.values()) {
      const { cx, cz } = c.prison;
      const P = (x, z) => new THREE.Vector3(cx + x, SIDEWALK_H, cz + z);
      const guard = { shirt: '#3E4F3A', pants: '#2C3628', hat: 'police', role: 'guard', badge: true };
      this.peds.spawn(c, { ...guard, path: [P(-45, -45), P(45, -45), P(45, 45), P(-45, 45)] });
      this.peds.spawn(c, { ...guard, path: [P(-12, -10), P(12, -10), P(12, 20), P(-12, 20)] });
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * 20 - 10, b = Math.random() * 16;
        this.peds.spawn(c, { shirt: '#3B3F46', pants: '#3B3F46', hat: 'yoq', role: 'inmate', badge: true, path: [P(a - 8, b - 6), P(a + 8, b - 6), P(a + 8, b + 4), P(a - 8, b + 4)] });
      }
    }
  }

  setupCars() {
    for (const c of this.world.countries.values()) {
      const spots = this.world.parkedSpots.filter((s) => s.country === c.id).sort(() => Math.random() - 0.5).slice(0, 22);
      for (const s of spots) this.addCar(c, s.x, s.z, s.yaw, CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], false);
      const own = this.addCar(c, c.ownCarSpot.x, c.ownCarSpot.z, c.ownCarSpot.yaw, c.id === 'uz' ? '#F4F4F2' : '#2C4F7C', true);
      const tag = makeLabel(c.id === 'uz' ? `Sizning mashinangiz  ${PLATE}` : 'Ijara mashinangiz', { height: 0.5, bg: 'rgba(242,182,50,0.92)', fg: '#0F2347' });
      tag.position.y = 2.6;
      own.root.add(tag);
      own.tag = tag;
    }
  }

  addCar(c, x, z, yaw, color, owned) {
    const model = makeCar({ color });
    const root = new THREE.Group();
    root.add(model.group);
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    c.group.add(root);
    const car = { root, model, color, owned, country: c.id, speed: 0, stolen: false };
    this.cars.push(car);
    return car;
  }

  loadProfile() {
    const def = { name: '', shirt: SHIRT_COLORS[0], hat: 'doppi', room: '' };
    try { return { ...def, ...JSON.parse(localStorage.getItem('uzcity-profile') || '{}') }; } catch { return def; }
  }
  saveProfile() {
    try {
      localStorage.setItem('uzcity-profile', JSON.stringify({ ...this.profile, money: Math.round(this.money), convictions: this.convictions }));
    } catch { /* saqlab bo‘lmadi — muhim emas */ }
  }

  setupLobby() {
    const $ = (id) => document.getElementById(id);
    $('in-name').value = this.profile.name;
    $('in-room').value = this.profile.room;
    const sw = $('swatches');
    for (const col of SHIRT_COLORS) {
      const b = document.createElement('button');
      b.type = 'button'; b.style.background = col;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-label', col);
      b.setAttribute('aria-checked', String(col === this.profile.shirt));
      b.addEventListener('click', () => {
        this.profile.shirt = col;
        for (const x of sw.children) x.setAttribute('aria-checked', String(x === b));
        this.player.ch.setClothes(col);
      });
      sw.appendChild(b);
    }
    for (const b of $('hat-seg').children) {
      b.classList.toggle('on', b.dataset.hat === this.profile.hat);
      b.addEventListener('click', () => {
        this.profile.hat = b.dataset.hat;
        for (const x of $('hat-seg').children) x.classList.toggle('on', x === b);
        this.player.ch.setHat(b.dataset.hat);
      });
    }
    const readForm = () => {
      this.profile.name = $('in-name').value.trim() || `Mehmon${Math.floor(Math.random() * 900 + 100)}`;
      this.profile.room = $('in-room').value.trim().toLowerCase() || 'umumiy';
      this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      this.audioCtx.resume();
    };
    $('btn-offline').addEventListener('click', () => { readForm(); this.begin(false); });
    $('btn-online').addEventListener('click', async () => {
      readForm();
      const btn = $('btn-online');
      btn.disabled = true;
      $('lobby-status').textContent = 'Serverga ulanmoqda…';
      try {
        await this.net.connect(this.profile);
        this.begin(true);
      } catch (e) {
        $('lobby-status').textContent = `${e.message} Hozircha “Yolg‘iz o‘ynash”ni tanlashingiz mumkin.`;
      }
      btn.disabled = false;
    });
  }

  begin(online) {
    this.saveProfile();
    document.getElementById('lobby').hidden = true;
    document.getElementById('hud').hidden = false;
    this.started = true;
    this.cam.yaw = Math.PI; this.cam.pitch = -0.15;
    this.player.yaw = Math.PI;
    this.ui.toast(`Xush kelibsiz, ${this.profile.name}! Oq mashinangiz (${PLATE}) shu yerda turibdi.`, 'good', 6000);
    if (online) this.ui.addChat('', 'Chat uchun T, ovoz uchun B ni bosib turing.', true);
    else this.ui.addChat('', 'Yolg‘iz rejim. Do‘stlar bilan o‘ynash uchun serverni ishga tushiring (README).', true);
    document.getElementById('game').requestPointerLock?.();
  }

  // ======================= Boshqaruv =======================
  setupInput() {
    const canvas = document.getElementById('game');
    const hint = document.getElementById('click-to-play');
    canvas.addEventListener('click', () => {
      if (this.started && !this.ui.overlayOpen() && !this.ui.chatOpen) canvas.requestPointerLock?.();
    });
    this.hintEl = hint;
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      const s = 0.0024;
      if (this.player.car && !this.cam.fps) { this.cam.carOffset -= e.movementX * s; this.cam.carIdle = 0; }
      else this.cam.yaw -= e.movementX * s;
      this.cam.pitch = Math.max(-1.2, Math.min(0.7, this.cam.pitch - e.movementY * s));
    });
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const t = chatInput.value.trim();
        if (t) { this.net.chat(t); this.ui.addChat(this.profile.name, t); }
        this.ui.closeChat(); canvas.requestPointerLock?.();
      } else if (e.key === 'Escape') { this.ui.closeChat(); }
    });
    addEventListener('keydown', (e) => {
      if (!this.started || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyE': this.interact(); break;
        case 'KeyV': this.cam.fps = !this.cam.fps; break;
        case 'KeyT': if (this.net.connected) { e.preventDefault(); this.ui.openChat(); } else this.ui.toast('Chat faqat onlayn rejimda ishlaydi.'); break;
        case 'KeyM': this.ui.toggleOverlay('overlay-map'); break;
        case 'KeyH': this.ui.toggleOverlay('overlay-help'); break;
        case 'KeyY': if (!this.jailed) this.police.surrender(); break;
        case 'KeyG': this.voice.toggleMode(); break;
        case 'KeyB': this.voice.setTalking(true); break;
        case 'Escape': for (const id of ['overlay-map', 'overlay-help', 'overlay-airport']) if (!document.getElementById(id).hidden) this.ui.closeOverlay(id); break;
      }
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyB') this.voice.setTalking(false);
    });
    addEventListener('blur', () => this.keys.clear());
  }

  key(c) { return this.keys.has(c) && !this.ui.chatOpen && !this.ui.overlayOpen(); }

  get jailed() { return this.prison.active; }

  // E tugmasi
  interact() {
    if (this.ui.overlayOpen()) return;
    const p = this.player;
    if (p.car) {
      if (Math.abs(p.car.speed) > 3) { this.ui.toast('Avval to‘xtang (Probel — tormoz).'); return; }
      this.exitCar();
      return;
    }
    if (p.down > 0) return;
    const zone = this.nearestZone();
    if (zone) {
      if (zone.type === 'airport') this.openAirport();
      else if (this.jailed) this.prison.interact(zone.type);
      else this.ui.toast('Bu yerga faqat mahkumlar kiradi.');
      return;
    }
    const car = this.nearestCar();
    if (car && !this.jailed) this.enterCar(car);
  }

  nearestZone() {
    const p = this.player.pos;
    return this.world.zones.find((z) => z.country === this.country.id && Math.hypot(z.x - p.x, z.z - p.z) < z.r) || null;
  }
  nearestCar() {
    const p = this.player.pos;
    let best = null, bd = 3.6;
    for (const c of this.cars) {
      if (c.country !== this.country.id) continue;
      const d = Math.hypot(c.root.position.x - p.x, c.root.position.z - p.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    if (!car.owned && !car.stolen) { car.stolen = true; this.police.report('car_theft'); }
    this.player.car = car;
    car.speed = 0;
    this.player.root.visible = false;
    if (car.tag) car.tag.visible = false;
    this.cam.carOffset = 0;
  }
  exitCar() {
    const p = this.player, car = p.car;
    if (!car) return;
    const y = car.root.rotation.y;
    p.pos.set(car.root.position.x + Math.cos(y) * 2.1, car.root.position.y, car.root.position.z - Math.sin(y) * 2.1);
    this.world.collide(p.pos, 0.45);
    p.car = null;
    car.speed = 0;
    p.root.visible = true;
    p.yaw = y;
    this.cam.yaw = y;
    if (car.tag) car.tag.visible = true;
  }

  teleport(pos) {
    if (this.player.car) this.exitCar();
    this.player.pos.copy(pos);
    this.player.vy = 0;
  }

  setPrisonClothes(on) {
    const ch = this.player.ch;
    ch.setClothes(on ? '#3B3F46' : this.profile.shirt, on ? '#3B3F46' : '#2E3A59');
    ch.setHat(on ? 'yoq' : this.profile.hat);
  }

  goToJail(crimes, surrendered) {
    if (this.player.car) this.exitCar();
    this.prison.start(crimes, surrendered);
  }

  onHitByPlayer(name) {
    const p = this.player;
    if (p.car || this.jailed) return;
    p.down = 4;
    this.health -= 35;
    this.ui.toast(`${name} sizni mashinada urib ketdi! Unga nisbatan jinoiy ish ochildi.`, 'danger');
    if (this.health <= 0) {
      this.health = 100;
      this.money = Math.max(0, this.money - HOSPITAL_FEE);
      setTimeout(() => {
        this.teleport(this.country.spawn);
        this.ui.toast('Kasalxonada davolandingiz. Davolanish xarajati: 100 000 so‘m.');
      }, 2500);
    }
  }

  // ----- Aeroport -----
  openAirport() {
    if (this.jailed) return;
    if (this.police.pendingCase || this.police.wanted > 0) {
      this.ui.toast('Chegara nazorati: siz qidiruvdasiz. Pasport nazoratida qo‘lga olindingiz!', 'danger', 6000);
      this.police.report('border');
      this.police.arrest(false);
      return;
    }
    const flag = (id) => makeFlagTexture(id).image.toDataURL();
    this.ui.showAirport([...this.world.countries.values()], this.country.id, flag, FLIGHT_PRICE, this.money, (dest) => this.fly(dest));
  }

  async fly(dest) {
    this.money -= FLIGHT_PRICE;
    const from = this.country.city;
    await this.ui.flight(from, dest.city, 4);
    this.country = dest;
    this.world.setActiveCountry(dest.id);
    this.teleport(dest.airportPos);
    this.player.yaw = this.cam.yaw = 0;
    this.advanceClock(150);
    this.ui.toast(`${dest.city}ga xush kelibsiz! Ijara mashinangiz shahar markazida (xaritada sariq nuqta).`, 'good', 6000);
    this.net.event(`${this.profile.name} ${dest.city}ga uchib ketdi`);
  }

  advanceClock(min) {
    this.clock = (this.clock + min) % 1440;
    this.totalMinutes += min;
  }

  // ======================= Har kadr =======================
  frame() {
    const dt = Math.min(this.clockObj.getDelta(), 0.05);
    if (!this.started) { this.lobbyCamera(dt); this.updateSky(); this.renderer.render(this.scene, this.camera); return; }

    this.updateClock(dt);
    if (this.player.car) this.updateDriving(dt); else this.updateOnFoot(dt);
    const ppos = this.player.car ? this.player.car.root.position : this.player.pos;

    const obstacles = [{ pos: ppos, r: this.player.car ? 1 : 0.5, country: this.country.id }];
    for (const c of this.cars) if (c !== this.player.car && c.country === this.country.id) obstacles.push({ pos: c.root.position, r: 0.6, country: c.country });
    for (const u of this.police.units) obstacles.push({ pos: u.root.position, r: 1, country: this.country.id });
    for (const r of this.net.remotes.values()) if (r.s) obstacles.push({ pos: r.root.position, r: r.s.c ? 1 : 0.5, country: r.s.k });
    this.traffic.update(dt, this.country.id, obstacles, this.peds);
    this.peds.update(dt, this.country.id, ppos);
    this.police.update(dt);
    this.prison.update(dt);
    this.net.update(dt);
    this.voice.update();
    for (const m of this.world.markers) m.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.08);

    this.updateCamera(dt);
    this.updateSky();
    this.updateHud();
    this.lastSave += dt;
    if (this.lastSave > 20) { this.lastSave = 0; this.saveProfile(); }
    this.renderer.render(this.scene, this.camera);
  }

  updateClock(dt) {
    const before = this.clock;
    this.advanceClock(dt * (this.jailed ? 6 : 1));
    if (before < 480 && this.clock >= 480 && !this.jailed) {
      this.money += SALARY;
      this.ui.toast('Maosh tushdi: +300 000 so‘m', 'good');
    }
  }

  updateOnFoot(dt) {
    const p = this.player;
    p.root.visible = true;
    let mx = 0, mz = 0;
    if (p.down > 0) {
      p.down -= dt;
      p.ch.group.rotation.x = -Math.PI / 2; p.ch.group.position.y = 0.25;
      if (p.down <= 0) { p.ch.group.rotation.x = 0; p.ch.group.position.y = 0; }
    } else {
      const f = (this.key('KeyW') ? 1 : 0) - (this.key('KeyS') ? 1 : 0);
      const s = (this.key('KeyD') ? 1 : 0) - (this.key('KeyA') ? 1 : 0);
      const cy = this.cam.yaw;
      mx = Math.sin(cy) * f - Math.cos(cy) * s;
      mz = Math.cos(cy) * f + Math.sin(cy) * s;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }
      if (this.key('Space') && p.onGround) { p.vy = 7.2; p.onGround = false; }
    }
    const speed = (this.key('ShiftLeft') || this.key('ShiftRight')) ? RUN : WALK;
    const moving = mx !== 0 || mz !== 0;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    p.moveSpeed = moving ? speed : 0;
    this.world.collide(p.pos, 0.42);
    // odamlar va mashinalar bilan to‘qnashuv
    for (const n of this.peds.list) {
      if (n.country !== this.country.id || n.state === 'down') continue;
      const dx = p.pos.x - n.root.position.x, dz = p.pos.z - n.root.position.z, d = Math.hypot(dx, dz);
      if (d < 0.75 && d > 0.001) { p.pos.x += (dx / d) * (0.75 - d); p.pos.z += (dz / d) * (0.75 - d); }
    }
    for (const t of [...this.traffic.list, ...this.cars]) {
      if (t.country !== this.country.id) continue;
      const cp = t.root.position, dx = p.pos.x - cp.x, dz = p.pos.z - cp.z, d = Math.hypot(dx, dz);
      if (d < 2.2 && d > 0.001) { p.pos.x += (dx / d) * (2.2 - d); p.pos.z += (dz / d) * (2.2 - d); }
    }
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    const ground = this.world.groundHeight(p.pos.x, p.pos.z);
    if (p.pos.y <= ground) { p.pos.y = ground; p.vy = 0; p.onGround = true; }

    if (this.cam.fps) p.yaw = this.cam.yaw;
    else if (moving) {
      const target = Math.atan2(mx, mz);
      let d = target - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += d * Math.min(1, dt * 12);
    }
    p.root.position.copy(p.pos);
    p.root.rotation.y = p.yaw;
    if (p.down <= 0) {
      p.phase += dt * p.moveSpeed * 1.4;
      animateCharacter(p.ch.parts, p.phase, moving ? Math.min(1, speed / 5) : 0);
    }
    p.ch.parts.head.visible = !this.cam.fps;
  }

  updateDriving(dt) {
    const car = this.player.car, p = this.player;
    const thr = (this.key('KeyW') ? 1 : 0) - (this.key('KeyS') ? 1 : 0);
    const steer = (this.key('KeyA') ? 1 : 0) - (this.key('KeyD') ? 1 : 0);
    if (thr > 0) car.speed += (car.speed < 0 ? 24 : 13) * dt;
    else if (thr < 0) car.speed -= (car.speed > 0 ? 24 : 8) * dt;
    else car.speed *= 1 - 0.45 * dt;
    if (this.key('Space')) car.speed *= 1 - 3.5 * dt;
    car.speed = Math.max(-9, Math.min(33, car.speed));
    const turn = 1.9 * Math.min(1, Math.abs(car.speed) / 6) * Math.sign(car.speed);
    car.root.rotation.y += steer * turn * dt;
    const y = car.root.rotation.y, fx = Math.sin(y), fz = Math.cos(y);
    const pos = car.root.position;
    pos.x += fx * car.speed * dt;
    pos.z += fz * car.speed * dt;
    const push = this._push || (this._push = new THREE.Vector3());
    if (this.world.collideCar(pos, y, push)) {
      const len = Math.hypot(push.x, push.z);
      const along = len > 1e-4 ? (push.x * fx + push.z * fz) / len * Math.sign(car.speed || 1) : 0;
      if (along < -0.7 && Math.abs(car.speed) > 6) { car.speed *= -0.25; this.ui.toast('To‘qnashuv!', '', 1200); }
      else car.speed *= 1 - 2.5 * dt;
    }
    for (const t of this.traffic.list) {
      if (t.country !== this.country.id) continue;
      const cp = t.root.position, dx = pos.x - cp.x, dz = pos.z - cp.z, d = Math.hypot(dx, dz);
      if (d < 3.7 && d > 0.001) { pos.x += (dx / d) * (3.7 - d); pos.z += (dz / d) * (3.7 - d); car.speed *= 0.3; }
    }
    for (const c of this.cars) {
      if (c === car || c.country !== this.country.id) continue;
      const cp = c.root.position, dx = pos.x - cp.x, dz = pos.z - cp.z, d = Math.hypot(dx, dz);
      if (d < 3.7 && d > 0.001) { pos.x += (dx / d) * (3.7 - d); pos.z += (dz / d) * (3.7 - d); car.speed *= 0.3; }
    }
    pos.y = this.world.groundHeight(pos.x, pos.z);
    for (const w of car.model.wheels) w.rotation.x += car.speed * dt / 0.38;
    p.pos.copy(pos);
    p.yaw = y;
    p.moveSpeed = Math.abs(car.speed);
    if (Math.abs(car.speed) > 4) this.checkHits(car, fx, fz);
  }

  // Mashina odamni urib yubordimi?
  checkHits(car, fx, fz) {
    const pos = car.root.position, sp = car.speed;
    const inside = (x, z) => {
      const dx = x - pos.x, dz = z - pos.z;
      const lz = dx * fx + dz * fz, lx = -dx * fz + dz * fx;
      return Math.abs(lx) < 1.35 && Math.abs(lz) < 2.7;
    };
    const impulse = new THREE.Vector3(fx * sp * 0.7, 0, fz * sp * 0.7);
    for (const n of this.peds.list) {
      if (n.country !== this.country.id || n.state === 'down') continue;
      if (!inside(n.root.position.x, n.root.position.z)) continue;
      if (this.peds.knockdown(n, impulse)) {
        car.speed *= 0.7;
        this.police.report('hit_ped');
        this.ui.toast('Tez yordam chaqirildi.', '', 2500);
      }
    }
    for (const o of this.police.officers) {
      if (inside(o.root.position.x, o.root.position.z) && this.police.knockOfficer(o)) { car.speed *= 0.7; this.police.report('hit_officer'); }
    }
    const now = performance.now();
    for (const r of this.net.remotesOnFoot()) {
      if (!inside(r.root.position.x, r.root.position.z)) continue;
      if (now - (this.hitCooldown.get(r.id) || 0) < 3000) continue;
      this.hitCooldown.set(r.id, now);
      this.net.sendHit(r.id);
      this.police.report('hit_player');
      car.speed *= 0.7;
    }
  }

  // ======================= Kamera, osmon, HUD =======================
  lobbyCamera() {
    const t = performance.now() / 1000 * 0.05;
    const c = this.world.countries.get('uz');
    const tower = new THREE.Vector3(c.ox - 105, 0, c.oz - 175);
    this.camera.position.set(tower.x + Math.cos(t) * 230, 95, tower.z + Math.sin(t) * 230);
    this.camera.lookAt(tower.x, 70, tower.z);
    this.sun.target.position.copy(tower);
    this.sun.position.copy(tower).add(new THREE.Vector3(60, 120, 40));
  }

  updateCamera(dt) {
    const p = this.player, cam = this.camera, c = this.cam;
    if (p.car) {
      const pos = p.car.root.position;
      c.carIdle += dt;
      if (c.carIdle > 1.5) c.carOffset *= 1 - Math.min(1, dt * 2);
      const yaw = p.car.root.rotation.y + c.carOffset;
      c.yaw = yaw;
      if (c.fps) {
        cam.position.set(pos.x + Math.sin(yaw) * 0.2, pos.y + 1.55, pos.z + Math.cos(yaw) * 0.2);
        cam.lookAt(pos.x + Math.sin(yaw) * 10, pos.y + 1.2 + Math.sin(c.pitch) * 10, pos.z + Math.cos(yaw) * 10);
      } else {
        const want = new THREE.Vector3(pos.x - Math.sin(yaw) * 9.5, pos.y + 3.6 - c.pitch * 3, pos.z - Math.cos(yaw) * 9.5);
        cam.position.lerp(want, 1 - Math.exp(-dt * 7));
        cam.lookAt(pos.x, pos.y + 1.4, pos.z);
      }
    } else {
      const head = new THREE.Vector3(p.pos.x, p.pos.y + 1.62, p.pos.z);
      const fwd = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
      if (c.fps) {
        cam.position.copy(head).addScaledVector(fwd, 0.2);
        cam.lookAt(head.clone().addScaledVector(fwd, 10));
      } else {
        cam.position.copy(head).addScaledVector(fwd, -5.2);
        cam.position.y = Math.max(cam.position.y, p.pos.y + 0.4);
        cam.lookAt(head);
      }
    }
    const target = p.car ? p.car.root.position : p.pos;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(this.sunDir || new THREE.Vector3(0.5, 1, 0.3), 160);
  }

  updateSky() {
    const h = this.clock / 60;
    const ang = ((h - 6) / 12) * Math.PI;
    const height = Math.sin(ang);
    const night = Math.min(1, Math.max(0, (0.12 - height) / 0.3));
    const dusk = Math.max(0, 1 - Math.abs(height - 0.08) / 0.25) * (1 - night * 0.6);
    this.sunDir = new THREE.Vector3(Math.cos(ang) * 0.7, Math.max(0.15, height), 0.45).normalize();
    let sky = lerpColor('#8CC8EE', '#0E1A33', night);
    sky = sky.lerp(new THREE.Color('#F0A065'), dusk * 0.55);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.sun.intensity = Math.max(0, height) * 2.1 + 0.05;
    this.sun.color.set(dusk > 0.3 ? '#FFC58A' : '#FFF1D6');
    this.hemi.intensity = 0.3 + 0.75 * (1 - night);
    this.world.setNight(night);
  }

  updateHud() {
    const p = this.player, pos = p.car ? p.car.root.position : p.pos;
    let prompt = '';
    if (p.car) prompt = Math.abs(p.car.speed) < 3 ? 'E — mashinadan tushish' : '';
    else {
      const z = this.nearestZone();
      if (z) prompt = z.type === 'airport' ? 'E — aviachipta olish' : `E — ${z.label.replace('  [E]', '').toLowerCase()}`;
      else if (!this.jailed) {
        const car = this.nearestCar();
        if (car) prompt = car.owned ? 'E — mashinangizga o‘tirish' : 'E — begona mashinani olish (bu o‘g‘irlik — jinoyat!)';
      }
    }
    const hh = Math.floor(this.clock / 60), mm = Math.floor(this.clock % 60);
    const c = this.country;
    this.ui.setHud({
      location: this.jailed ? c.prisonName : c.id === 'uz' ? this.world.district(pos.x, pos.z) : `${c.city}, ${c.name}`,
      clock: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      money: this.money, health: this.health, wanted: this.police.wanted, unseen: this.police.unseen,
      inCar: !!p.car, speed: p.car ? p.car.speed : 0, prompt, fps: this.cam.fps,
    });
    const dots = [];
    for (const u of this.police.units) dots.push({ x: u.root.position.x, z: u.root.position.z, color: '#FF3B47' });
    for (const r of this.net.remotes.values()) if (r.s && r.s.k === c.id) dots.push({ x: r.root.position.x, z: r.root.position.z, color: '#5DADEC' });
    for (const car of this.cars) if (car.owned && car.country === c.id && car !== p.car) dots.push({ x: car.root.position.x, z: car.root.position.z, color: '#F2B632' });
    const me = { x: pos.x, z: pos.z, yaw: p.car ? p.car.root.rotation.y : p.yaw };
    this.ui.drawMinimap(this.world, c, me, dots);
    this.hintEl.hidden = document.pointerLockElement === this.renderer.domElement || this.ui.overlayOpen() || this.ui.chatOpen || this.keys.size > 0;
    if (!document.getElementById('overlay-map').hidden) this.ui.drawMinimap(this.world, c, me, dots, true);
  }
}

window.game = new Game();
