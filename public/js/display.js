/* Grump Sleigh big-screen display.
   Grudges arrive as notes, crumple into paper balls (or coal) and arc into the Grumpster's sack.
   Keys: Q QR · T text · F fullscreen · L finale · R reset · H help.  ?demo=true for sample grudges. */
(() => {
  'use strict';
  const A = window.GrumpArt;
  const params = new URLSearchParams(location.search);
  const truthy = (v) => /^(1|true|yes|on)$/i.test(v || '');
  const DEMO = truthy(params.get('demo'));
  const AUTOLOOP = truthy(params.get('autoloop'));
  const SPEED = Math.max(0.25, Math.min(6, parseFloat(params.get('speed')) || 1));
  const HOST_KEY = params.get('key') || '';

  const W = 1920, H = 1080;
  const ORIGIN = { x: 1430, y: 930 };   // ground point under the sled
  const SACK_AT = { x: 100, y: -62 };   // sack base on the sled deck
  const G_SCALE = 1.0;                  // Grumbles' size on the sled
  const SEAT_AT = { x: -100, y: -56 };   // the Grumpster's waist, hidden behind the sleigh's side panel
  const S = 1.25;                       // overall size of the sleigh group on screen
  const LEAD_GOAT_X = -470, BACK_GOAT_X = -300;

  // Fallback config so the display also works opened straight from disk (sales demos).
  let cfg = {
    display: {
      title: 'The Grump Sleigh', subtitle: 'Scan, have a grumble, and let the Grumpster haul it all away!',
      qrCaption: 'Scan to toss a grudge in the sack', counterLabel: 'Grudges collected',
      finaleCounterLabel: 'Grudges hauled away', finaleMessage: 'All grudges gone. Merry Christmas!',
      finaleSubMessage: 'The Grumpster has taken the lot. Enjoy the party!',
      showQrOnStart: true, showTextOnStart: true, showControlsHint: true,
      noteDisplayMs: 3200, coalChance: 0.18, sackFullAt: 60,
      moodThresholds: { delighted: 6, straining: 25, sitting: 45 }
    },
    speech: {
      grumpy: ['Hmph!', 'Is that all?', 'More!'], delighted: ['Ooh, a juicy one!', 'More! MORE!'],
      straining: ['Oof!', "It's getting heavy..."], sitting: ['Stay DOWN, you sack!', 'Hmph. Comfy.'],
      arrival: ['Hmph!', 'Mine!', 'More!'], finaleTie: "Right. That's the lot!",
      finaleGo: 'Hyah! Giddy up, you lumps!', reset: 'Hmph. Back again?', goats: ['Meh.']
    },
    demo: { minGapMs: 1800, maxGapMs: 3600, autoFinaleAt: 50, autoResetAfterMs: 14000 }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  const stage = $('#stage');
  const body = document.body;

  // ---------------- state ----------------
  let phase = 'collecting';   // collecting | finale-run | finale
  let shown = 0;              // grudges that have landed in the sack on this screen
  let tied = false;
  let mood = 'grumpy';
  let sack = null;            // current sack shape
  let gx = 0, gy = 0, gScale = 1;         // Grumbles position (sleigh-local)
  const queue = [];
  let active = 0, inFlight = 0, lastNoteAt = 0;
  let timers = [];
  let flightRaf = 0;
  let socket = null;
  let firstState = true;

  const T = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------------- layout ----------------
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit);
  fit();

  // ---------------- scene ----------------
  // A little snowy village of rooftops with warm windows along the far hill.
  function village() {
    const r = A.rng(7);
    const hillY = (x) => { // rough height of the far hill at x
      const pts = [[0, 820], [320, 760], [640, 800], [960, 790], [1300, 770], [1600, 768], [1920, 760]];
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
      return 760;
    };
    const walls = ['#2a1f2b', '#1d2a24', '#2b2320', '#1f2433'];
    let out = '';
    let x = 380;
    while (x < 1880) {
      const w = 60 + r() * 50, h = 40 + r() * 34, roof = 26 + r() * 18;
      const base = hillY(x + w / 2) + 4;
      const top = base - h;
      const glow = r() < 0.75;
      out += `<g>
        <circle cx="${x + w / 2}" cy="${top + h / 2}" r="${w * 0.9}" fill="url(#windowGlow)" opacity="${glow ? 0.55 : 0}"/>
        <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${walls[Math.floor(r() * walls.length)]}"/>
        <rect x="${x + w * 0.62}" y="${top - roof - 4}" width="10" height="${roof}" fill="#2a1f2b"/>
        <path d="M${x - 8},${top + 2} L${x + w / 2},${top - roof} L${x + w + 8},${top + 2} Z" fill="#141018"/>
        <path d="M${x - 10},${top + 2} L${x + w / 2},${top - roof} L${x + w + 10},${top + 2}" stroke="#eef3fb" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        ${glow ? `<rect x="${x + w * 0.2}" y="${top + h * 0.3}" width="${w * 0.2}" height="${h * 0.32}" fill="#ffc46b"/>
                  <rect x="${x + w * 0.58}" y="${top + h * 0.3}" width="${w * 0.2}" height="${h * 0.32}" fill="${r() < 0.5 ? '#ffc46b' : '#ff8f6b'}"/>` : ''}
        ${r() < 0.6 ? `<g class="chimney-smoke" transform="translate(${x + w * 0.62 + 5},${top - roof - 8})">
            <circle r="7" fill="#9aa6bb" style="animation-delay:${(-r() * 4).toFixed(1)}s"/>
            <circle r="7" fill="#9aa6bb" style="animation-delay:${(-r() * 4).toFixed(1)}s"/></g>` : ''}
      </g>`;
      x += w + 40 + r() * 140;
    }
    return out;
  }

  function buildSky() {
    const r = A.rng(42);
    let stars = '';
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = r() * 620, rr = r() * 1.6 + 0.4;
      stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.6).toFixed(2)}">
        ${i % 4 === 0 ? `<animate attributeName="opacity" values="1;.2;1" dur="${(2 + r() * 4).toFixed(1)}s" repeatCount="indefinite"/>` : ''}</circle>`;
    }
    $('#sky').innerHTML = `
      <defs>
        <radialGradient id="moonGlow"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".35"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
        <radialGradient id="moonFace" cx="40%" cy="35%"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#d9dccb"/></radialGradient>
        <linearGradient id="farHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c4a66"/><stop offset="1" stop-color="#151b28"/></linearGradient>
        <radialGradient id="windowGlow"><stop offset="0" stop-color="#ffc46b" stop-opacity=".7"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="#000"/>
      ${stars}
      <circle cx="280" cy="190" r="300" fill="url(#moonGlow)"/>
      <circle cx="280" cy="190" r="72" fill="url(#moonFace)"/>
      <circle cx="255" cy="170" r="12" fill="#c9ccbb" opacity=".6"/><circle cx="305" cy="215" r="8" fill="#c9ccbb" opacity=".55"/>
      <circle cx="300" cy="160" r="6" fill="#c9ccbb" opacity=".5"/>
      ${village()}
      <path d="M0,820 C220,740 420,760 640,800 C860,840 1040,760 1300,770 C1560,780 1760,730 1920,760 L1920,1080 L0,1080 Z" fill="url(#farHill)" opacity=".75"/>
      <path d="M0,820 C220,740 420,760 640,800 C860,840 1040,760 1300,770 C1560,780 1760,730 1920,760" fill="none" stroke="#c8d6f0" stroke-width="3" opacity=".35"/>
`;
  }

  function buildScene() {
    $('#scene').innerHTML = `
      ${A.defs()}
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e9f0fb"/><stop offset=".35" stop-color="#bccbe3"/><stop offset="1" stop-color="#5f6f8c"/>
        </linearGradient>
      </defs>
      <path d="M0,905 C350,860 700,935 1000,928 C1300,921 1600,938 1920,905 L1920,1080 L0,1080 Z" fill="url(#ground)"/>
      <path d="M0,905 C350,860 700,935 1000,928 C1300,921 1600,938 1920,905" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>
      <g id="sleigh-outer" style="transform: translate(${ORIGIN.x}px, ${ORIGIN.y}px) scale(${S})">
        <g id="sleigh-inner">
          <ellipse cx="-120" cy="0" rx="470" ry="16" fill="#000" opacity=".22"/>
          <g transform="translate(${LEAD_GOAT_X},0)">${A.goat('goat-a', '#e9dfc9', '#9b6b43', '#cdbb94', 31)}</g>
          <path d="M${LEAD_GOAT_X + 38},-72 L${BACK_GOAT_X - 38},-72 M${BACK_GOAT_X + 38},-72 L-200,-60" stroke="#7a3b22" stroke-width="4" fill="none"/>
          <g transform="translate(${BACK_GOAT_X},0)">${A.goat('goat-b', '#7f848c', '#e9e6df', '#b9ab8c', 57)}</g>
          ${A.sled()}
          <g id="sack-pos" transform="translate(${SACK_AT.x},${SACK_AT.y})">${A.sackMarkup()}</g>
          <g id="grumbles-pos">${A.grumbles()}</g>
          ${A.sledFront()}
        </g>
      </g>
      <path d="M700,1080 C900,985 1200,968 1500,975 C1700,980 1820,965 1920,960 L1920,1080 Z" fill="#e6edf8" opacity=".55"/>
      <g id="balls"></g>`;
  }

  function buildLights() {
    const colors = ['#ffcf6b', '#ff9e5e', '#fff1c9', '#ff7a6b', '#ffe08a', '#ffb88c'];
    let wires = '', bulbs = '';
    const swags = [[-40, 520], [480, 1000], [960, 1460], [1440, 1960]];
    swags.forEach(([x1, x2], si) => {
      const sag = 120 + (si % 2) * 30;
      wires += `<path d="M${x1},20 Q${(x1 + x2) / 2},${20 + sag * 2} ${x2},20" stroke="#3b2c1f" stroke-width="3" fill="none"/>`;
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * x2;
        const y = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * (20 + sag * 2) + t * t * 20;
        const c = colors[(i + si) % colors.length];
        bulbs += `<g class="bulb" style="animation-delay:${(-Math.random() * 2.2).toFixed(2)}s">
          <circle cx="${x.toFixed(0)}" cy="${(y + 14).toFixed(0)}" r="26" fill="${c}" opacity=".22"/>
          <ellipse cx="${x.toFixed(0)}" cy="${(y + 14).toFixed(0)}" rx="8" ry="12" fill="${c}"/>
          <rect x="${(x - 5).toFixed(0)}" y="${(y - 2).toFixed(0)}" width="10" height="7" fill="#5c4a35"/></g>`;
      }
    });
    $('#lights').innerHTML = wires + bulbs;
  }

  buildSky();
  buildScene();
  buildLights();

  const sleighOuter = $('#sleigh-outer');
  const sleighInner = $('#sleigh-inner');
  const sackEl = $('#sack-pos .sack');
  const squash = $('.sack-squash');
  const gPos = $('#grumbles-pos');
  const gEl = $('.grumbles');
  const goats = [...document.querySelectorAll('.goat')];
  const balls = $('#balls');
  const notesEl = $('#notes');
  const bubblesEl = $('#bubbles');
  const counterNum = $('#counter-num');

  // ---------------- config / text ----------------
  function applyText() {
    document.querySelectorAll('[data-cfg]').forEach((el) => {
      const val = el.dataset.cfg.split('.').reduce((o, k) => (o ? o[k] : undefined), cfg);
      if (typeof val === 'string') { el.textContent = val; el.style.display = val ? '' : 'none'; }
    });
    $('#counter-label').textContent = phase === 'finale' ? cfg.display.finaleCounterLabel : cfg.display.counterLabel;
    if (cfg.eventName) document.title = `Grump Sleigh · ${cfg.eventName}`;
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const c = await res.json();
      cfg = { ...cfg, ...c, display: { ...cfg.display, ...c.display }, speech: { ...cfg.speech, ...c.speech }, demo: { ...cfg.demo, ...c.demo } };
      if (c.guestUrl) $('#qr-url').textContent = c.guestUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } catch (_) { /* offline / file:// demo: keep fallback */ }
    applyText();
  }

  const qrImg = $('#qr-img');
  qrImg.addEventListener('error', () => $('#qr').classList.add('missing'));
  function refreshQr() { $('#qr').classList.remove('missing'); qrImg.src = '/api/qr.svg?t=' + Date.now(); }

  // ---------------- toasts & bubbles ----------------
  let toastTimer = 0;
  function toast(msg, ms = 3500) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  const bubbles = { grumbles: null, goat: null };
  let lastSay = 0;
  function say(text, who = 'grumbles', ms = 2300) {
    if (!text) return;
    const old = bubbles[who];
    if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'bubble' + (who === 'goat' ? ' goat' : '');
    b.textContent = text;
    let x, y;
    if (who === 'goat') {
      x = ORIGIN.x + (LEAD_GOAT_X - 80) * S; y = ORIGIN.y - 175 * S;
    } else {
      x = ORIGIN.x + (gx + 20) * S; y = ORIGIN.y + (gy - A.CHAR.h * gScale) * S - 6;
    }
    b.style.left = clamp(x, 200, W - 220) + 'px';
    b.style.top = y + 'px';
    bubblesEl.appendChild(b);
    bubbles[who] = b;
    if (who === 'grumbles') lastSay = now();
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 260); if (bubbles[who] === b) bubbles[who] = null; }, ms);
  }
  function clearBubbles() { bubblesEl.innerHTML = ''; bubbles.grumbles = bubbles.goat = null; }

  // ---------------- Grumbles & sack ----------------
  function act(el, cls, ms) {
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  function moodFor(n) {
    const t = cfg.display.moodThresholds;
    if (n >= t.sitting) return 'sitting';
    if (n >= t.straining) return 'straining';
    if (n >= t.delighted) return 'delighted';
    return 'grumpy';
  }

  function placeGrumbles(override) {
    if (override) { gx = override.x; gy = override.y; }
    else if (gEl.dataset.mood === 'sitting') { gx = SACK_AT.x - 6; gy = SACK_AT.y - sack.H + 84; }
    else { gx = SEAT_AT.x; gy = SEAT_AT.y; }
    gScale = gEl.dataset.mood === 'sitting' && !override ? G_SCALE * 0.85 : G_SCALE;
    gPos.style.transform = `translate(${gx}px, ${gy}px) scale(${gScale})`;
    // Perched on the sack he goes behind it, so the sack hides his waist.
    const sitting = gEl.dataset.mood === 'sitting' && !override;
    const sackPos = sackEl.parentNode;
    if (sitting && gPos.nextSibling !== sackPos) sackPos.parentNode.insertBefore(gPos, sackPos);
    if (!sitting && sackPos.nextSibling !== gPos) sackPos.parentNode.insertBefore(gPos, sackPos.nextSibling);
  }

  function updateSack() {
    const f = clamp(shown / cfg.display.sackFullAt, 0, 1.25);
    sack = A.sackShape(f, tied, 5 + Math.floor(shown / 3));
    A.applySack(sackEl, sack);
  }

  function setMood(m, announce) {
    if (m === mood && gEl.dataset.mood === m) return;
    mood = m;
    gEl.dataset.mood = m;
    placeGrumbles();
    if (announce) say(pick(cfg.speech[m]));
  }

  function mouthStage() {
    const m = sack.mouth || { cx: 0, cy: sack.top - 20 };
    const sitShift = gEl.dataset.mood === 'sitting' ? -sack.W * 0.08 : 0;
    return { x: ORIGIN.x + (SACK_AT.x + m.cx + sitShift) * S, y: ORIGIN.y + (SACK_AT.y + m.cy) * S };
  }

  function setCounter(n, bump) {
    counterNum.textContent = n;
    if (bump) act(counterNum, 'bump', 460);
  }

  // ---------------- idle life ----------------
  let nextIdle = now() + 2500, nextBlink = now() + 1500, nextGoat = now() + 5000;
  setInterval(() => {
    const t = now();
    if (t > nextBlink) { act(gEl, 'a-blink', 220); nextBlink = t + rand(2600, 5600); }
    if (phase !== 'collecting') return;
    if (t > nextIdle) {
      nextIdle = t + rand(2600, 6000);
      const options = {
        grumpy: ['tap', 'tap', 'roll', 'grumble', 'grumble'],
        delighted: ['grumble', 'hop', 'roll', 'grumble'],
        straining: ['grumble', 'roll', 'grumble'],
        sitting: ['grumble', 'roll', 'tap']
      }[mood] || ['grumble'];
      const choice = pick(options);
      if (choice === 'tap') act(gEl, 'a-tap', 1900);
      else if (choice === 'roll') act(gEl, 'a-roll', 1350);
      else if (choice === 'hop') act(gEl, 'a-hop', 520);
      else if (t - lastSay > 2500) { say(pick(cfg.speech[mood])); act(gEl, 'a-mutter', 1150); }
    }
    if (t > nextGoat) {
      nextGoat = t + rand(4000, 8000);
      const g = pick(goats);
      act(g, Math.random() < 0.5 ? 'a-ear' : 'a-stomp', 900);
      if (Math.random() < 0.18) say(pick(cfg.speech.goats), 'goat', 1500);
    }
  }, 250);

  // ---------------- grudge flow ----------------
  const SLOTS = [[400, 320], [820, 290], [1160, 330], [480, 510], [870, 530]].map(([x, y]) => ({ x, y, busy: false }));

  function enqueue(g) {
    if (phase !== 'collecting') return;
    queue.push(g);
    pump();
  }

  let pumpTimer = 0;
  function pump() {
    clearTimeout(pumpTimer);
    if (!queue.length || phase !== 'collecting') return;
    const free = SLOTS.filter((s) => !s.busy);
    if (active >= 3 || !free.length) { pumpTimer = setTimeout(pump, 300); return; }
    const wait = 900 - (now() - lastNoteAt);
    if (wait > 0) { pumpTimer = setTimeout(pump, wait + 10); return; }
    lastNoteAt = now();
    showNote(queue.shift(), pick(free));
    if (queue.length) pumpTimer = setTimeout(pump, 950);
  }

  function showNote(g, slot) {
    active++;
    slot.busy = true;
    const el = document.createElement('div');
    el.className = 'note';
    el.textContent = g.text;
    const x = slot.x + rand(-30, 30), y = slot.y + rand(-20, 20);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--rot', rand(-6, 6).toFixed(1) + 'deg');
    notesEl.appendChild(el);
    const hold = cfg.display.noteDisplayMs + Math.min(1500, g.text.length * 8);
    T(() => {
      el.classList.add('crumple');
      T(() => fly(g, { x, y }), 380);
      T(() => { el.remove(); slot.busy = false; active--; pump(); }, 600);
    }, hold);
  }

  function fly(g, from) {
    inFlight++;
    const seed = Math.floor(Math.random() * 1e6);
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.innerHTML = g.coal ? A.coalLump(seed, 26) : A.paperBall(seed, 30);
    wrap.appendChild(inner);
    balls.appendChild(wrap);
    if (g.coal) fx.burst(from.x, from.y, 'soot', 14);
    const dur = 1150;
    const t0 = now();
    const spin = rand(400, 800) * (Math.random() < 0.5 ? -1 : 1);
    const step = () => {
      if (!wrap.isConnected) { inFlight = Math.max(0, inFlight - 1); return; }
      const u = clamp((now() - t0) / dur, 0, 1);
      const to = mouthStage();
      const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 280 };
      const e = u;
      const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * c.x + e * e * to.x;
      const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * c.y + e * e * to.y;
      const s = u < 0.12 ? 0.4 + (u / 0.12) * 0.6 : u > 0.86 ? Math.max(0, 1 - (u - 0.86) / 0.14) * 0.8 : 1 - 0.2 * u;
      wrap.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(3)})`);
      inner.setAttribute('transform', `rotate(${(spin * u).toFixed(1)})`);
      if (u < 1) requestAnimationFrame(step);
      else { wrap.remove(); inFlight = Math.max(0, inFlight - 1); arrive(g, to); }
    };
    requestAnimationFrame(step);
  }

  function arrive(g, at) {
    if (phase !== 'collecting') return;
    shown++;
    setCounter(shown, true);
    updateSack();
    const m = moodFor(shown);
    const changed = m !== mood;
    setMood(m, changed);
    if (!changed) placeGrumbles();
    act(squash, 'boing', 460);
    fx.burst(at.x, at.y - 6, g.coal ? 'soot' : 'paper', 10);
    if (!changed && now() - lastSay > 3200 && Math.random() < 0.35) say(pick(cfg.speech.arrival), 'grumbles', 1400);
    if (mood === 'delighted' && Math.random() < 0.4) act(gEl, 'a-hop', 520);
  }

  // ---------------- finale ----------------
  function runFinale() {
    if (phase !== 'collecting') return;
    phase = 'finale-run';
    queue.length = 0;
    hideHint();
    const start = now();
    const waitForBalls = () => {
      if ((active || inFlight) && now() - start < 4500) { T(waitForBalls, 200); return; }
      notesEl.innerHTML = '';
      balls.innerHTML = '';
      active = inFlight = 0;
      SLOTS.forEach((s) => (s.busy = false));
      finaleSequence();
    };
    waitForBalls();
  }

  function finaleSequence() {
    clearBubbles();
    const sitting = gEl.dataset.mood === 'sitting';
    gEl.dataset.mood = 'tying';
    if (!sitting) placeGrumbles({ x: SEAT_AT.x, y: SEAT_AT.y });
    say(cfg.speech.finaleTie, 'grumbles', 1700);
    T(() => {
      tied = true;
      updateSack();
      act(squash, 'boing', 460);
      const m = mouthStage();
      fx.burst(m.x, m.y + 10, 'paper', 16);
    }, 900);
    T(() => {
      gEl.dataset.mood = 'driving';
      placeGrumbles({ x: SEAT_AT.x, y: SEAT_AT.y });
      act(gEl, 'a-hop', 520);
      sleighInner.classList.add('strain');
      say(cfg.speech.finaleGo, 'grumbles', 1800);
      T(() => say(pick(cfg.speech.goats), 'goat', 1200), 700);
    }, 1900);
    const kick = setInterval(() => {
      for (const gxOff of [LEAD_GOAT_X, BACK_GOAT_X]) fx.burst(ORIGIN.x + (gxOff + rand(-40, 40)) * S, ORIGIN.y - 4, 'snow', 3);
    }, 120);
    T(() => clearInterval(kick), 4400);
    timers.push(kick);
    T(() => { sleighInner.classList.add('lurch'); }, 3700);
    T(() => {
      sleighInner.classList.remove('strain', 'lurch');
      sleighInner.classList.add('flying');
      clearBubbles();
      startFlight();
    }, 4500);
  }

  function startFlight() {
    const dur = 5600;
    const t0 = now();
    const P = [[0, 0], [-160, -30], [-520, -640], [-2350, -1150]];
    const bez = (t, i) => {
      const mt = 1 - t;
      return mt * mt * mt * P[0][i] + 3 * mt * mt * t * P[1][i] + 3 * mt * t * t * P[2][i] + t * t * t * P[3][i];
    };
    const frame = () => {
      const u = clamp((now() - t0) / dur, 0, 1);
      const e = u * u * (1.7 - 0.7 * u);
      const px = bez(e, 0), py = bez(e, 1);
      const sc = (1 - 0.62 * e) * S;
      const rot = 3 + 12 * Math.min(1, e * 1.6);
      sleighOuter.style.transform = `translate(${ORIGIN.x + px}px, ${ORIGIN.y + py}px) rotate(${rot}deg) scale(${sc})`;
      // Trail of crumpled paper from the sack.
      const lx = SACK_AT.x + (Math.random() - 0.3) * sack.W * 0.5, ly = SACK_AT.y - sack.H * 0.55;
      const rr = (rot * Math.PI) / 180;
      const wx = ORIGIN.x + px + (lx * Math.cos(rr) - ly * Math.sin(rr)) * sc;
      const wy = ORIGIN.y + py + (lx * Math.sin(rr) + ly * Math.cos(rr)) * sc;
      if (u < 0.97) fx.trail(wx, wy, sc / S);
      if (u < 1) flightRaf = requestAnimationFrame(frame);
      else { sleighOuter.style.visibility = 'hidden'; T(showWarm, 200); }
    };
    flightRaf = requestAnimationFrame(frame);
  }

  function showWarm() {
    phase = 'finale';
    body.classList.add('finale');
    applyText();
    snow.setMode('warm');
    fx.setMode('bokeh');
  }

  function finaleInstant() {
    phase = 'finale';
    tied = true;
    updateSack();
    sleighOuter.style.visibility = 'hidden';
    showWarm();
  }

  // ---------------- reset ----------------
  function doReset(count = 0) {
    clearTimers();
    cancelAnimationFrame(flightRaf);
    clearTimeout(pumpTimer);
    phase = 'collecting';
    tied = false;
    shown = count;
    queue.length = 0;
    active = inFlight = 0;
    SLOTS.forEach((s) => (s.busy = false));
    notesEl.innerHTML = '';
    balls.innerHTML = '';
    clearBubbles();
    body.classList.remove('finale');
    snow.setMode('normal');
    fx.setMode('normal');
    fx.clear();
    applyText();
    setCounter(shown);
    updateSack();
    mood = '';
    setMood(moodFor(shown), false);
    sleighInner.classList.remove('strain', 'lurch', 'flying');
    sleighInner.classList.add('walking');
    sleighOuter.style.visibility = '';
    // Trundle back in from the right.
    const t0 = now(), dur = 2400, startX = ORIGIN.x + 1150;
    const frame = () => {
      const u = clamp((now() - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      sleighOuter.style.transform = `translate(${startX + (ORIGIN.x - startX) * e}px, ${ORIGIN.y}px) scale(${S})`;
      if (u < 1) flightRaf = requestAnimationFrame(frame);
      else {
        sleighInner.classList.remove('walking');
        say(cfg.speech.reset, 'grumbles', 2200);
        act(gEl, 'a-tap', 1900);
        if (DEMO) startDemo();
      }
    };
    flightRaf = requestAnimationFrame(frame);
  }

  // ---------------- snow ----------------
  const snow = (() => {
    const ctx = $('#snow').getContext('2d');
    let mode = 'normal';
    const flakes = Array.from({ length: 230 }, () => newFlake(true));
    function newFlake(anywhere) {
      const z = Math.random();
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -10, r: 0.8 + z * 3, vy: 25 + z * 55, sway: 10 + Math.random() * 30, ph: Math.random() * 6.28, a: 0.35 + z * 0.6 };
    }
    let last = now();
    function tick() {
      const t = now(), dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, W, H);
      const warm = mode === 'warm';
      const speed = warm ? 0.55 : 1;
      for (const f of flakes) {
        f.y += f.vy * dt * speed;
        f.ph += dt * 0.8;
        const x = f.x + Math.sin(f.ph) * f.sway;
        if (f.y > H + 10) Object.assign(f, newFlake(false));
        ctx.globalAlpha = f.a;
        ctx.fillStyle = warm ? '#fff1dc' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    return { tick, setMode: (m) => (mode = m) };
  })();

  // ---------------- fx: puffs, trail, bokeh ----------------
  const fx = (() => {
    const ctx = $('#fx').getContext('2d');
    let parts = [];
    let mode = 'normal';
    let bokeh = [];
    const warmCols = ['255,207,107', '255,158,94', '255,241,201', '255,122,107', '255,224,138'];
    function add(p) { if (parts.length < 900) parts.push(p); }
    function burst(x, y, kind, n) {
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI, 0), sp = rand(60, 240);
        add({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: kind === 'snow' ? 260 : 420, life: 0, max: rand(0.5, 1.0),
          r: kind === 'paper' ? rand(4, 8) : rand(2, 5), rot: rand(0, 6), vr: rand(-8, 8) });
      }
    }
    function trail(x, y, sc) {
      const n = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        add({ kind: Math.random() < 0.12 ? 'coalbit' : 'scrap', x: x + rand(-10, 10), y: y + rand(-6, 6), vx: rand(20, 120), vy: rand(-30, 30),
          g: 70, life: 0, max: rand(2.0, 3.4), r: rand(7, 13) * (0.5 + sc * 0.5), rot: rand(0, 6), vr: rand(-4, 4), seed: Math.random() });
      }
    }
    function drawScrap(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      const k = p.kind === 'coalbit' ? 7 : 9;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * 6.283, rr = p.r * (0.7 + ((Math.sin(p.seed * 99 + i * 7.3) + 1) / 2) * 0.45);
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = p.kind === 'coalbit' ? '#26262b' : '#f4efe2';
      ctx.strokeStyle = p.kind === 'coalbit' ? '#77777f' : '#a59d8b';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      if (p.kind === 'scrap') {
        ctx.beginPath(); ctx.moveTo(-p.r * 0.5, 0); ctx.lineTo(p.r * 0.2, p.r * 0.3); ctx.lineTo(p.r * 0.5, -p.r * 0.2);
        ctx.strokeStyle = '#c7bea9'; ctx.stroke();
      }
      ctx.restore();
    }
    function setMode(m) {
      mode = m;
      if (m === 'bokeh' && !bokeh.length) {
        bokeh = Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(80, H), r: rand(18, 70), c: pick(warmCols), ph: rand(0, 6.28), sp: rand(0.4, 1.2), vy: rand(-10, -3), a: 0 }));
      }
    }
    let last = now();
    function tick() {
      const t = now(), dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, W, H);
      if (mode === 'bokeh' || bokeh.some((b) => b.a > 0.01)) {
        for (const b of bokeh) {
          b.a = mode === 'bokeh' ? Math.min(1, b.a + dt * 0.35) : Math.max(0, b.a - dt * 1.5);
          b.ph += dt * b.sp;
          b.y += b.vy * dt;
          if (b.y < -80) { b.y = H + 60; b.x = rand(0, W); }
          const alpha = b.a * (0.18 + 0.14 * Math.sin(b.ph));
          const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          gr.addColorStop(0, `rgba(${b.c},${alpha})`);
          gr.addColorStop(0.7, `rgba(${b.c},${alpha * 0.5})`);
          gr.addColorStop(1, `rgba(${b.c},0)`);
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
        }
        if (mode !== 'bokeh' && bokeh.every((b) => b.a <= 0.01)) bokeh = [];
      }
      parts = parts.filter((p) => (p.life += dt) < p.max);
      for (const p of parts) {
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const fade = 1 - p.life / p.max;
        if (p.kind === 'scrap' || p.kind === 'coalbit') {
          ctx.globalAlpha = Math.min(1, fade * 1.5);
          drawScrap(p);
        } else {
          ctx.globalAlpha = fade;
          ctx.fillStyle = p.kind === 'soot' ? '#55555c' : p.kind === 'snow' ? '#eef4ff' : '#f6f1e4';
          ctx.beginPath();
          if (p.kind === 'paper') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); ctx.restore(); }
          else { ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
    }
    return { burst, trail, tick, setMode, clear: () => (parts = []) };
  })();

  (function loop() { snow.tick(); fx.tick(); requestAnimationFrame(loop); })();

  // ---------------- controls ----------------
  function toggleQr(force) { body.classList.toggle('no-qr', force === undefined ? undefined : !force); if (!body.classList.contains('no-qr')) refreshQr(); }
  function toggleText(force) { body.classList.toggle('no-text', force === undefined ? undefined : !force); }
  function toggleFullscreen() {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
    else document.exitFullscreen();
  }
  let hintTimer = 0;
  function showHint(ms = 8000) { const h = $('#hint'); h.classList.remove('hidden'); clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, ms); }
  function hideHint() { $('#hint').classList.add('hidden'); }

  function runLocal(action) {
    if (action === 'finale') runFinale();
    else if (action === 'reset') doReset(0);
    else if (action === 'toggleQr') toggleQr();
    else if (action === 'toggleText') toggleText();
  }

  async function requestControl(action) {
    if (DEMO || !socket || !socket.connected) { runLocal(action); return; }
    if (!HOST_KEY) {
      toast('Running on this screen only. Add ?key=YOUR_HOST_KEY to the display URL so the guest form follows along.', 5000);
      runLocal(action);
      return;
    }
    try {
      const res = await fetch('/api/host/control', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-host-key': HOST_KEY }, body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'Wrong host key in the display URL' : 'Server error ' + res.status);
      // The server broadcasts the action back to every screen, including this one.
    } catch (err) {
      toast(err.message + '. Running on this screen only.', 4500);
      runLocal(action);
    }
  }

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'q') toggleQr();
    else if (k === 't') toggleText();
    else if (k === 'f') toggleFullscreen();
    else if (k === 'l') requestControl('finale');
    else if (k === 'r') requestControl('reset');
    else if (k === 'h' || k === '?') showHint(6000);
  });

  // ---------------- server ----------------
  function connect() {
    if (DEMO || window.__noSocket || typeof io !== 'function') return;
    socket = io({ auth: HOST_KEY ? { key: HOST_KEY } : {} });
    socket.on('grudge', (g) => enqueue({ text: String(g.text || '').slice(0, 200), coal: !!g.coal }));
    socket.on('control', ({ action }) => {
      if (action === 'finale') runFinale();
      else if (action === 'reset') doReset(0);
      else if (action === 'toggleQr') toggleQr();
      else if (action === 'toggleText') toggleText();
    });
    socket.on('state', (s) => {
      if (firstState) {
        firstState = false;
        shown = s.count || 0;
        setCounter(shown);
        updateSack();
        mood = '';
        setMood(moodFor(shown), false);
        if (s.phase === 'finale') finaleInstant();
        return;
      }
      if (s.phase === 'finale' && phase === 'collecting') runFinale();
      else if (s.phase === 'collecting' && phase !== 'collecting') doReset(s.count || 0);
      else if (s.phase === 'collecting' && phase === 'collecting') {
        const pending = queue.length + active + inFlight;
        if ((s.count || 0) < shown) doReset(s.count || 0);           // reset happened elsewhere
        else if (shown + pending < s.count) { shown = s.count - pending; setCounter(shown); updateSack(); setMood(moodFor(shown), false); }
      }
    });
    socket.on('connect', () => { if (!firstState) loadConfig(); });
  }

  // ---------------- demo mode ----------------
  let demoTimer = 0;
  let demoBag = [];
  function startDemo() {
    clearTimeout(demoTimer);
    const next = () => {
      if (phase !== 'collecting') return;
      if (AUTOLOOP && shown + queue.length + active + inFlight >= cfg.demo.autoFinaleAt) {
        runFinale();
        T(() => doReset(0), 4500 + 6000 + cfg.demo.autoResetAfterMs);
        return;
      }
      if (!demoBag.length) demoBag = [...(window.DEMO_GRUDGES || ['The printer jams every Monday'])].sort(() => Math.random() - 0.5);
      enqueue({ text: demoBag.pop(), coal: Math.random() < cfg.display.coalChance });
      if (Math.random() < 0.15 && demoBag.length) setTimeout(() => enqueue({ text: demoBag.pop(), coal: false }), 500);
      demoTimer = setTimeout(next, rand(cfg.demo.minGapMs, cfg.demo.maxGapMs) / SPEED);
    };
    demoTimer = setTimeout(next, 1200 / SPEED);
  }

  // ---------------- boot ----------------
  updateSack();
  setMood('grumpy', false);
  placeGrumbles();
  setCounter(0);
  if (cfg.display.showControlsHint) showHint(9000); else hideHint();
  loadConfig().then(() => {
    toggleQr(cfg.display.showQrOnStart !== false);
    toggleText(cfg.display.showTextOnStart !== false);
    if (!cfg.display.showControlsHint) hideHint();
    connect();
    if (DEMO) { setTimeout(() => say(pick(cfg.speech.grumpy)), 900); startDemo(); }
  });

  // Small hook for automated checks.
  window.__grudge = { enqueue, runFinale, doReset, jump: (n) => { shown = n; setCounter(n); updateSack(); setMood(moodFor(n), true); placeGrumbles(); }, state: () => ({ phase, shown, mood, queue: queue.length, active, inFlight }) };
})();
