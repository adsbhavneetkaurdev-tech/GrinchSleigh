'use strict';
// Grump Sleigh server: guest form, QR code, big-screen display, host review queue.
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const { getConfig, publicConfig, CONFIG_PATH } = require('./lib/config');
const { createModerator } = require('./lib/moderation');
const { sanitizeGrudge } = require('./lib/sanitize');
const { createStore } = require('./lib/store');

const store = createStore(path.join(__dirname, 'data', 'state.json'));
const startCfg = getConfig();

// Moderator is rebuilt whenever the config object changes (live config edits).
let moderator = null;
let moderatorFor = null;
function getModerator(cfg) {
  if (moderatorFor !== cfg) { moderator = createModerator(cfg.moderation); moderatorFor = cfg; }
  return moderator;
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}
function guestUrl(cfg) {
  if (cfg.publicUrl) return cfg.publicUrl.replace(/\/+$/, '') + '/';
  return `http://${lanAddress()}:${cfg.port}/`;
}

function keyMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---- rate limiting (in memory, salted hash of the IP, never written to disk) ----
const salt = crypto.randomBytes(16);
const hits = new Map();
function rateLimited(ip, perMinute) {
  const k = crypto.createHash('sha256').update(salt).update(String(ip)).digest('base64');
  const now = Date.now();
  const list = (hits.get(k) || []).filter((t) => now - t < 60000);
  if (list.length >= perMinute) { hits.set(k, list); return true; }
  list.push(now);
  hits.set(k, list);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of hits) if (!list.some((t) => now - t < 60000)) hits.delete(k);
}, 60000).unref();

// ---- app ----
const app = express();
if (startCfg.trustProxy) app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '2kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

const pub = path.join(__dirname, 'public');
app.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));
app.get('/display', (req, res) => res.sendFile(path.join(pub, 'display.html')));
app.get(['/host', '/admin'], (req, res) => res.sendFile(path.join(pub, 'host.html')));
app.use(express.static(pub, { index: false, maxAge: '5m' }));

app.get('/api/config', (req, res) => {
  const cfg = getConfig();
  res.set('Cache-Control', 'no-store').json({ ...publicConfig(cfg), guestUrl: guestUrl(cfg) });
});
app.get('/api/state', (req, res) => res.set('Cache-Control', 'no-store').json(store.publicState()));

app.get('/api/qr.svg', async (req, res) => {
  try {
    const svg = await QRCode.toString(guestUrl(getConfig()), {
      type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' }
    });
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
  } catch (err) {
    res.status(500).send('QR error');
  }
});

// ---- guest submission (anonymous: only the grudge text is accepted) ----
app.post('/api/grudge', (req, res) => {
  const cfg = getConfig();
  if (store.get().phase !== 'collecting') {
    return res.status(409).json({ status: 'closed', message: cfg.form.closed });
  }
  if (rateLimited(req.ip, cfg.limits.perMinute)) {
    return res.status(429).json({ status: 'slow', message: 'Easy there! Grumbles can only carry so much. Try again in a minute.' });
  }
  const clean = sanitizeGrudge(req.body && req.body.text, cfg.limits);
  if (!clean.ok) return res.status(400).json({ status: 'invalid', message: clean.error });

  const verdict = getModerator(cfg).check(clean.text, { holdAll: store.get().holdAll });
  if (verdict.flagged) {
    const item = store.enqueue(clean.text, verdict.reasons, verdict.matches);
    io.to('hosts').emit('queue', { added: item, queue: store.get().queue });
    return res.json({ status: 'held', message: cfg.form.held });
  }
  publish(clean.text, cfg);
  res.json({ status: 'accepted', message: cfg.form.thanks });
});

function publish(text, cfg) {
  const coal = Math.random() < (cfg.display.coalChance || 0);
  const g = store.addApproved(text, coal);
  io.emit('grudge', { id: g.id, text: g.text, coal: g.coal, count: store.get().count });
  io.to('hosts').emit('recent', store.get().recent.slice(0, 30));
}

// ---- host API ----
function requireHost(req, res, next) {
  const key = req.get('x-host-key') || req.query.key;
  if (!keyMatches(key, getConfig().hostKey)) return res.status(401).json({ error: 'Wrong host key' });
  next();
}
const host = express.Router();
host.use(requireHost);
host.get('/state', (req, res) => {
  const s = store.get();
  res.json({ ...store.publicState(), holdAll: s.holdAll, queue: s.queue, recent: s.recent.slice(0, 30), guestUrl: guestUrl(getConfig()) });
});
host.post('/queue/:id/approve', (req, res) => {
  const cfg = getConfig();
  const item = store.get().queue.find((q) => q.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Already handled' });
  const text = req.body && typeof req.body.text === 'string' ? req.body.text : item.text;
  const clean = sanitizeGrudge(text, cfg.limits);
  if (!clean.ok) return res.status(400).json({ error: clean.error });
  if (store.get().phase !== 'collecting') return res.status(409).json({ error: 'The sleigh has left. Reset (R) first.' });
  store.take(item.id);
  publish(clean.text, cfg);
  io.to('hosts').emit('queue', { queue: store.get().queue });
  res.json({ ok: true });
});
host.post('/queue/:id/reject', (req, res) => {
  if (!store.take(req.params.id)) return res.status(404).json({ error: 'Already handled' });
  io.to('hosts').emit('queue', { queue: store.get().queue });
  res.json({ ok: true });
});
host.post('/queue/clear', (req, res) => {
  store.clearQueue();
  io.to('hosts').emit('queue', { queue: [] });
  res.json({ ok: true });
});
host.post('/settings', (req, res) => {
  if (req.body && 'holdAll' in req.body) store.setHoldAll(req.body.holdAll);
  io.to('hosts').emit('settings', { holdAll: store.get().holdAll });
  res.json({ ok: true, holdAll: store.get().holdAll });
});
host.post('/control', (req, res) => {
  const action = req.body && req.body.action;
  if (action === 'finale') {
    if (store.get().phase === 'finale') return res.json({ ok: true, already: true });
    store.setPhase('finale');
  } else if (action === 'reset') {
    store.reset();
  } else if (!['toggleQr', 'toggleText'].includes(action)) {
    return res.status(400).json({ error: 'Unknown action' });
  }
  io.emit('control', { action });
  io.emit('state', store.publicState());
  res.json({ ok: true, state: store.publicState() });
});
app.use('/api/host', host);

// ---- sockets ----
const server = http.createServer(app);
const io = new Server(server, { serveClient: true });
io.on('connection', (socket) => {
  socket.emit('state', store.publicState());
  const key = socket.handshake.auth && socket.handshake.auth.key;
  if (key && keyMatches(key, getConfig().hostKey)) socket.join('hosts');
});

server.listen(startCfg.port, () => {
  const url = guestUrl(startCfg);
  const base = url.replace(/\/$/, '');
  console.log('\n  Grump Sleigh is running\n');
  console.log(`  Guest form (QR):  ${url}`);
  console.log(`  Big screen:       ${base}/display?key=${encodeURIComponent(startCfg.hostKey)}`);
  console.log(`  Host / admin:     ${base}/admin  (password = hostKey)`);
  console.log(`  Sales demo:       ${base}/display?demo=true`);
  console.log(`  Config:           ${CONFIG_PATH}\n`);
  if (startCfg.hostKey === 'change-me') console.warn('  ! Set ADMIN_PASSWORD (or "hostKey" in config/event.json) before the event. Default is: change-me\n');
});
