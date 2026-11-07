// Onlayn: serverga ulanish, boshqa o‘yinchilarni ko‘rsatish, chat va urilish xabarlari.
import * as THREE from 'three';
import { makeCharacter, animateCharacter, makeCar, makeLabel } from './models.js';
import { wrapCharacter } from './npc.js';

const SEND_HZ = 12;

export class Network {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.id = null;
    this.remotes = new Map();
    this.sendTimer = 0;
    this.connected = false;
  }

  connect(profile) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}`;
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
      let ws;
      try { ws = new WebSocket(url); } catch { fail('Serverga ulanib bo‘lmadi'); return; }
      this.ws = ws;
      const timer = setTimeout(() => { fail('Server javob bermadi'); ws.close(); }, 6000);
      ws.onopen = () => this.send({ t: 'join', room: profile.room, name: profile.name, shirt: profile.shirt, hat: profile.hat });
      ws.onerror = () => fail('Server topilmadi. O‘yinni “npm start” orqali ishga tushiring.');
      ws.onclose = () => {
        if (this.connected) this.game.ui.addChat('', 'Server bilan aloqa uzildi.', true);
        this.connected = false;
        fail('Ulanish yopildi');
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'welcome') { clearTimeout(timer); done = true; this.connected = true; resolve(m); }
        if (m.t === 'error' && !done) { clearTimeout(timer); fail(m.text); }
        this.onMessage(m);
      };
    });
  }

  send(obj) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  event(text) { this.send({ t: 'event', text }); }
  chat(text) { this.send({ t: 'chat', text }); }

  onMessage(m) {
    const g = this.game;
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        for (const p of m.players) this.addRemote(p);
        g.ui.addChat('', `“${m.room}” xonasiga ulandingiz. O‘yinchilar: ${m.players.length + 1}`, true);
        for (const p of m.players) g.voice.connectTo(p.id);
        break;
      case 'join':
        this.addRemote(m.player);
        g.ui.addChat('', `${m.player.name} o‘yinga qo‘shildi`, true);
        break;
      case 'leave': {
        const r = this.remotes.get(m.id);
        if (r) { g.ui.addChat('', `${r.name} o‘yindan chiqdi`, true); this.removeRemote(m.id); }
        g.voice.removePeer(m.id);
        break;
      }
      case 'state': {
        const r = this.remotes.get(m.id);
        if (r) this.applyState(r, m.s);
        break;
      }
      case 'chat':
        g.ui.addChat(m.name, m.text);
        break;
      case 'event':
        g.ui.addChat('', m.text, true);
        break;
      case 'hit':
        g.onHitByPlayer(m.name);
        break;
      case 'signal':
        g.voice.onSignal(m.from, m.data);
        break;
      case 'error':
        g.ui.toast(m.text, 'danger');
        break;
    }
  }

  addRemote(info) {
    if (this.remotes.has(info.id)) return;
    const ch = makeCharacter({ shirt: info.shirt, hat: info.hat });
    const root = wrapCharacter(ch);
    const car = makeCar({ color: '#F4F4F2' });
    const carRoot = new THREE.Group();
    carRoot.add(car.group);
    carRoot.visible = false;
    const label = makeLabel(info.name, { height: 0.42 });
    label.position.y = 2.45;
    root.add(label);
    const speakIcon = makeLabel('🔊', { height: 0.4, bg: 'rgba(43,181,176,0.9)' });
    speakIcon.position.y = 2.95; speakIcon.visible = false;
    root.add(speakIcon);
    this.game.scene.add(root, carRoot);
    const r = {
      id: info.id, name: info.name, shirt: info.shirt, ch, root, car, carRoot, label, speakIcon,
      target: new THREE.Vector3(), yaw: 0, carYaw: 0, s: null, phase: 0, jailed: false, carColor: '#F4F4F2',
    };
    this.remotes.set(info.id, r);
    if (info.state) this.applyState(r, info.state, true);
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.game.scene.remove(r.root, r.carRoot);
    this.remotes.delete(id);
  }

  applyState(r, s, snap = false) {
    if (!s || !Array.isArray(s.p)) return;
    r.s = s;
    r.target.set(s.p[0], s.p[1], s.p[2]);
    if (snap || r.root.position.distanceTo(r.target) > 30) { r.root.position.copy(r.target); r.carRoot.position.copy(r.target); }
    if (s.cc && s.cc !== r.carColor) {
      r.carColor = s.cc;
      r.carRoot.remove(r.car.group);
      r.car = makeCar({ color: s.cc });
      r.carRoot.add(r.car.group);
    }
    if (!!s.j !== r.jailed) {
      r.jailed = !!s.j;
      r.ch.setClothes(r.jailed ? '#3B3F46' : r.shirt, r.jailed ? '#3B3F46' : '#2E3A59');
    }
  }

  update(dt) {
    const g = this.game;
    if (!this.connected) return;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 1 / SEND_HZ;
      const p = g.player;
      const pos = p.car ? p.car.root.position : p.pos;
      this.send({
        t: 'state', s: {
          p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)],
          y: +p.yaw.toFixed(2), c: p.car ? 1 : 0, cy: p.car ? +p.car.root.rotation.y.toFixed(2) : 0,
          cc: p.car ? p.car.color : undefined, sp: +p.moveSpeed.toFixed(1), k: g.country.id,
          j: g.jailed ? 1 : 0, w: g.police.wanted, d: p.down > 0 ? 1 : 0, vm: g.voice.mode === 'room' ? 1 : 0,
        },
      });
    }
    const k = 1 - Math.exp(-dt * 12);
    for (const r of this.remotes.values()) {
      const s = r.s;
      if (!s) { r.root.visible = false; continue; }
      const here = s.k === g.country.id;
      r.root.position.lerp(r.target, k);
      r.carRoot.position.copy(r.root.position);
      r.root.visible = here && !s.c;
      r.carRoot.visible = here && !!s.c;
      // ism yozuvi mashinada ham ko‘rinsin
      if (s.c) { r.root.visible = here; r.ch.group.visible = false; } else r.ch.group.visible = true;
      let dy = s.y - r.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.root.rotation.y += dy * k;
      let dc = s.cy - r.carRoot.rotation.y; dc = Math.atan2(Math.sin(dc), Math.cos(dc));
      r.carRoot.rotation.y += dc * k;
      if (s.d) { r.ch.group.rotation.x = -Math.PI / 2; r.ch.group.position.y = 0.25; }
      else { r.ch.group.rotation.x = 0; r.ch.group.position.y = 0; }
      const sp = s.sp || 0;
      r.phase += dt * sp * 1.4;
      animateCharacter(r.ch.parts, r.phase, Math.min(1, sp / 3));
      if (s.c) for (const w of r.car.wheels) w.rotation.x += sp * dt / 0.38;
    }
  }

  // Mashinada ketayotganda boshqa o‘yinchini urib yuborishni tekshirish
  remotesOnFoot() {
    const out = [];
    for (const r of this.remotes.values()) if (r.s && r.s.k === this.game.country.id && !r.s.c && !r.s.d) out.push(r);
    return out;
  }
  sendHit(id) { this.send({ t: 'hit', to: id }); }
}
