// UzCity Online — server
// Vazifasi: o‘yin fayllarini (public/) berish va WebSocket orqali
// o‘yinchilarni xonalarga ulash: holat, chat, ovozli chat signallari.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const THREE_FILE = path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js');
const PORT = process.env.PORT || 3000;
const MAX_PER_ROOM = 16;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- Statik fayllar ----------
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // three.js kutubxonasi node_modules dan beriladi (npm install o‘rnatadi)
  if (urlPath === '/vendor/three.module.js') {
    fs.readFile(THREE_FILE, (err, data) => {
      if (err) { res.writeHead(500); res.end('three.js topilmadi: avval "npm install" buyrug‘ini bajaring'); return; }
      res.writeHead(200, { 'Content-Type': MIME['.js'] });
      res.end(data);
    });
    return;
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Ruxsat yo‘q'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Topilmadi'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- O‘yinchilar va xonalar ----------
const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomName -> Map(id -> client)
let nextId = 1;
const allClients = new Set();

const clean = (s, max) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  const r = rooms.get(room);
  if (!r) return;
  const data = JSON.stringify(msg);
  for (const [id, c] of r) {
    if (id !== exceptId && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }
}

wss.on('connection', (ws) => {
  const client = { id: nextId++, ws, room: null, info: null, alive: true, msgCount: 0 };
  allClients.add(client);
  ws.on('pong', () => { client.alive = true; });

  ws.on('message', (raw) => {
    // Oddiy spam himoyasi: soniyasiga 60 tadan ko‘p xabar bo‘lsa, e’tiborsiz
    if (++client.msgCount > 60) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'join' && !client.room) {
      const room = clean(m.room, 24).toLowerCase() || 'umumiy';
      if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room);
      if (r.size >= MAX_PER_ROOM) { send(ws, { t: 'error', text: 'Xona to‘la. Boshqa xona kodini kiriting.' }); return; }
      client.room = room;
      client.info = {
        id: client.id,
        name: clean(m.name, 16) || `O‘yinchi${client.id}`,
        shirt: clean(m.shirt, 9) || '#2BB5B0',
        hat: clean(m.hat, 8) || 'doppi',
        state: null,
      };
      send(ws, { t: 'welcome', id: client.id, room, players: [...r.values()].map((c) => c.info) });
      r.set(client.id, client);
      broadcast(room, { t: 'join', player: client.info }, client.id);
      return;
    }
    if (!client.room) return;

    switch (m.t) {
      case 'state':
        // Holatni saqlab, boshqalarga uzatamiz
        client.info.state = m.s;
        broadcast(client.room, { t: 'state', id: client.id, s: m.s }, client.id);
        break;
      case 'chat': {
        const text = clean(m.text, 140);
        if (text) broadcast(client.room, { t: 'chat', id: client.id, name: client.info.name, text });
        break;
      }
      case 'hit': // Bir o‘yinchi mashinada boshqasini urib yubordi
        relayTo(client, m.to, { t: 'hit', from: client.id, name: client.info.name });
        break;
      case 'signal': // WebRTC ovozli chat signallari (offer/answer/ice)
        relayTo(client, m.to, { t: 'signal', from: client.id, data: m.data });
        break;
      case 'event': // Masalan: "X qamoqqa tushdi" — hammaga e’lon
        broadcast(client.room, { t: 'event', id: client.id, name: client.info.name, text: clean(m.text, 120) }, client.id);
        break;
    }
  });

  ws.on('close', () => {
    allClients.delete(client);
    if (!client.room) return;
    const r = rooms.get(client.room);
    r?.delete(client.id);
    broadcast(client.room, { t: 'leave', id: client.id });
    if (r && r.size === 0) rooms.delete(client.room);
  });
});

function relayTo(from, toId, msg) {
  const target = rooms.get(from.room)?.get(Number(toId));
  if (target) send(target.ws, msg);
}

// Har soniyada spam hisoblagichini nolga tushirish
setInterval(() => { for (const c of allClients) c.msgCount = 0; }, 1000);
// Uzilib qolgan ulanishlarni tozalash
setInterval(() => {
  for (const c of allClients) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    c.ws.ping();
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`UzCity Online ishga tushdi: http://localhost:${PORT}`);
});
