/* Grump Sleigh artwork: procedural SVG for Grumbles (an original snow troll),
   his two stubborn goats, the rickety sled and the ever-growing sack.
   Every drawing uses local coordinates with (0,0) on the ground under the figure. */
(function (global) {
  'use strict';

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  const f1 = (n) => Math.round(n * 10) / 10;

  // Ellipse outline with pointed fur tufts.
  function shaggy(cx, cy, rx, ry, tufts, depth, seed) {
    const r = rng(seed);
    const pt = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    const step = (Math.PI * 2) / tufts;
    let [x, y] = pt(0, 1);
    let d = `M${f1(x)},${f1(y)}`;
    for (let i = 0; i < tufts; i++) {
      const a0 = i * step;
      const j = depth * (0.55 + r() * 0.9);
      const kTip = 1 + j / Math.min(rx, ry);
      const tipA = a0 + step * (0.55 + r() * 0.25);
      const [tx, ty] = pt(tipA, kTip);
      const [c1x, c1y] = pt(a0 + step * 0.25, 1 + (kTip - 1) * 0.8);
      const [ex, ey] = pt(a0 + step, 1);
      const [c2x, c2y] = pt(a0 + step * 0.95, 1 + (kTip - 1) * 0.55);
      d += ` Q${f1(c1x)},${f1(c1y)} ${f1(tx)},${f1(ty)} Q${f1(c2x)},${f1(c2y)} ${f1(ex)},${f1(ey)}`;
    }
    return d + 'Z';
  }



  // Smooth closed path through points (Catmull-Rom -> cubic Bezier).
  function smoothClosed(pts) {
    const n = pts.length;
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d + 'Z';
  }


  // ---------- shared <defs> ----------
  function defs() {
    return `
    <defs>
      <radialGradient id="gs-fur" cx="38%" cy="28%" r="80%">
        <stop offset="0" stop-color="#fffdf5"/><stop offset=".6" stop-color="#f1ead6"/><stop offset="1" stop-color="#d2cdb2"/>
      </radialGradient>
      <linearGradient id="gs-stripe" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#6aa978"/><stop offset="1" stop-color="#3f7c55"/>
      </linearGradient>
      <linearGradient id="gs-feet" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#6aa978"/><stop offset="1" stop-color="#3a7350"/>
      </linearGradient>
      <radialGradient id="gs-face" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#fffdf6"/><stop offset=".72" stop-color="#fbf6e8"/><stop offset="1" stop-color="#fbf6e8" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gs-shade" cx="35%" cy="30%" r="75%">
        <stop offset=".6" stop-color="#3a3a20" stop-opacity="0"/><stop offset="1" stop-color="#3a3a20" stop-opacity=".28"/>
      </radialGradient>
      <radialGradient id="gs-iris" cx="40%" cy="35%" r="65%">
        <stop offset="0" stop-color="#d8f3ff"/><stop offset=".55" stop-color="#6cbfe6"/><stop offset="1" stop-color="#2b6f9a"/>
      </radialGradient>
      <pattern id="gs-knit" width="8" height="7" patternUnits="userSpaceOnUse">
        <path d="M0,1 L4,6 L8,1" stroke="#000" stroke-width="1" fill="none" opacity=".16"/>
      </pattern>
      <linearGradient id="gs-band-shade" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/>
      </linearGradient>
      <linearGradient id="gs-red" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#e8424f"/><stop offset=".6" stop-color="#c3202f"/><stop offset="1" stop-color="#8f1322"/>
      </linearGradient>
      <linearGradient id="gs-red-dark" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#b51d2b"/><stop offset="1" stop-color="#6e0f1a"/>
      </linearGradient>
      <linearGradient id="gs-gold" x1="0" x2="0" y1="-230" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#e8b84a"/><stop offset="1" stop-color="#b08423"/>
      </linearGradient>
      <radialGradient id="gs-nose" cx="35%" cy="30%" r="70%">
        <stop offset="0" stop-color="#dba0ad"/><stop offset="1" stop-color="#a5636f"/>
      </radialGradient>
      <linearGradient id="gs-scarf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#8551c2"/><stop offset="1" stop-color="#5a3189"/>
      </linearGradient>
      <radialGradient id="gs-sack" cx="38%" cy="35%" r="75%">
        <stop offset="0" stop-color="#c9a476"/><stop offset=".6" stop-color="#a47b4d"/><stop offset="1" stop-color="#6f4f2e"/>
      </radialGradient>
      <pattern id="gs-burlap" width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0,3.5 H7 M3.5,0 V7" stroke="#5b3f22" stroke-width="1.1" opacity=".35"/>
      </pattern>
      <linearGradient id="gs-wood" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#9a6a3c"/><stop offset="1" stop-color="#6b4424"/>
      </linearGradient>
      <radialGradient id="gs-coal" cx="35%" cy="30%" r="80%">
        <stop offset="0" stop-color="#5a5a62"/><stop offset=".5" stop-color="#232327"/><stop offset="1" stop-color="#0b0b0d"/>
      </radialGradient>
    </defs>`;
  }

  // ---------- the Grumpster (character artwork supplied by the event owner) ----------
  // A PNG cut out to the waist. Origin (0,0) = bottom-centre of his body; the sleigh's side
  // panel hides the waist. Size in sleigh units.
  const CHAR = { src: 'assets/grumpster.png', w: 320, h: 335, anchorX: 0.36 };
  function grumbles(src) {
    const x = -CHAR.w * CHAR.anchorX;
    return `
    <g class="grumbles" data-mood="grumpy">
     <g class="g-lean">
      <g class="g-breathe">
        <image class="g-img" href="${src || CHAR.src}" x="${x}" y="${-CHAR.h}" width="${CHAR.w}" height="${CHAR.h}"/>
        <g class="g-sweat">
          <path d="M-80,-250 q8,12 0,18 q-8,-6 0,-18 Z" fill="#9fd8ff" stroke="#4c95c4" stroke-width="1.5"/>
          <path d="M74,-222 q7,10 0,15 q-7,-5 0,-15 Z" fill="#9fd8ff" stroke="#4c95c4" stroke-width="1.5"/>
        </g>
      </g>
     </g>
    </g>`;
  }

  // ---------- goat (faces left) ----------
  function goat(cls, coat, patch, horn, seed) {
    const r = rng(seed);
    const body = shaggy(5, -70, 58, 30, 16, 4, seed);
    const leg = (x, c, k) => `
      <g class="goat-leg goat-leg-${k}">
        <rect x="${x}" y="-56" width="10" height="50" rx="4" fill="${c}"/>
        <rect x="${x - 1}" y="-9" width="12" height="9" rx="2" fill="#2b2522"/>
      </g>`;
    const shade = '#00000033';
    return `
    <g class="goat ${cls}">
     <g class="goat-lean">
      ${leg(-30, coat, 'fb')}${leg(32, coat, 'bb')}
      <rect x="-30" y="-56" width="10" height="50" rx="4" fill="${shade}"/>
      <rect x="32" y="-56" width="10" height="50" rx="4" fill="${shade}"/>
      <g class="goat-tail"><path d="M58,-86 q14,-14 8,-26 q-8,10 -14,18 Z" fill="${coat}" stroke="#00000055" stroke-width="1.5"/></g>
      <path d="${body}" fill="${coat}" stroke="#00000055" stroke-width="2"/>
      <ellipse cx="${20 + r() * 10}" cy="-76" rx="18" ry="11" fill="${patch}" opacity=".9"/>
      <ellipse cx="-14" cy="-60" rx="12" ry="8" fill="${patch}" opacity=".7"/>
      ${leg(-42, coat, 'ff')}${leg(20, coat, 'bf')}
      <path d="M-44,-92 L-30,-50" stroke="#7a3b22" stroke-width="7" stroke-linecap="round"/>
      <path d="M-36,-72 h70" stroke="#7a3b22" stroke-width="5" opacity=".9"/>
      <circle cx="-38" cy="-72" r="4" fill="#d9b44a"/>
      <g class="goat-head">
        <path d="M-34,-88 L-54,-112 L-66,-100 L-46,-70 Z" fill="${coat}" stroke="#00000044" stroke-width="1.5"/>
        <path d="M-60,-128 C-50,-150 -26,-150 -20,-132 C-28,-142 -44,-140 -52,-124 Z" fill="${horn}" stroke="#00000066" stroke-width="2"/>
        <path d="M-54,-140 l5,4 M-46,-145 l3,5 M-38,-146 l1,6" stroke="#00000044" stroke-width="1.5"/>
        <ellipse cx="-70" cy="-112" rx="25" ry="17" transform="rotate(-18 -70 -112)" fill="${coat}" stroke="#00000055" stroke-width="2"/>
        <g class="goat-jaw">
          <ellipse cx="-92" cy="-100" rx="13" ry="10" fill="${coat}" stroke="#00000055" stroke-width="2"/>
          <path d="M-90,-92 L-84,-70 L-76,-94 Z" fill="#efe9dc" stroke="#00000044" stroke-width="1.5"/>
        </g>
        <ellipse cx="-100" cy="-104" rx="2.5" ry="1.6" fill="#2b2522"/>
        <path d="M-100,-96 q5,3 9,0" stroke="#2b2522" stroke-width="1.8" fill="none"/>
        <g class="goat-ear"><ellipse cx="-52" cy="-114" rx="15" ry="5.5" transform="rotate(24 -52 -114)" fill="${patch}" stroke="#00000055" stroke-width="1.5"/></g>
        <circle cx="-72" cy="-118" r="6" fill="#f6e6a6" stroke="#2b2522" stroke-width="1.5"/>
        <rect x="-77" y="-119.5" width="10" height="3" rx="1.5" fill="#2b2522"/>
        <path d="M-80,-128 l14,4" stroke="#2b2522" stroke-width="2.5" stroke-linecap="round"/>
      </g>
     </g>
    </g>`;
  }

  // ---------- classic red sleigh (a little battered) ----------
  // sled() is drawn behind the sack and Grumbles; sledFront() in front of them,
  // so they look like they are sitting inside the sleigh.
  const SIDE = `M-200,-44 L200,-44 Q222,-46 222,-72 L224,-150 Q190,-110 120,-102 Q20,-94 -100,-104
    Q-170,-110 -196,-140 Q-214,-160 -232,-148 Q-250,-130 -236,-110 Q-224,-96 -210,-108 Q-206,-80 -200,-44 Z`;
  function sled() {
    return `
    <g class="sled">
      <ellipse cx="0" cy="-2" rx="250" ry="10" fill="#000" opacity=".25"/>
      <path d="M150,-60 L150,-176 Q150,-220 192,-222 Q232,-222 230,-184 L226,-60 Z" fill="url(#gs-red-dark)" stroke="#5c0c16" stroke-width="3"/>
      <path d="M160,-180 Q162,-210 192,-212 Q220,-212 220,-186" stroke="url(#gs-gold)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-196,-70 L210,-70" stroke="#5c0c16" stroke-width="10"/>
    </g>`;
  }
  function sledFront() {
    return `
    <g class="sled-front">
      <g stroke="url(#gs-gold)" stroke-width="7" stroke-linecap="round" fill="none">
        <path d="M-150,-44 v-34 M-40,-44 v-34 M70,-44 v-34 M170,-44 v-34" transform="translate(0,34)"/>
      </g>
      <path d="M-205,-8 L190,-8 Q222,-8 226,-30 Q228,-46 212,-46" stroke="#8a6416" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M-205,-8 Q-262,-8 -262,-60 Q-262,-104 -222,-104 Q-196,-104 -198,-80 Q-200,-64 -216,-66" stroke="#8a6416" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M-205,-8 L190,-8 Q222,-8 226,-30 Q228,-46 212,-46" stroke="url(#gs-gold)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M-205,-8 Q-262,-8 -262,-60 Q-262,-104 -222,-104 Q-196,-104 -198,-80 Q-200,-64 -216,-66" stroke="url(#gs-gold)" stroke-width="7" fill="none" stroke-linecap="round"/>

      <path d="${SIDE}" fill="url(#gs-red)" stroke="#5c0c16" stroke-width="3" stroke-linejoin="round"/>
      <path d="M224,-150 Q190,-110 120,-102 Q20,-94 -100,-104 Q-170,-110 -196,-140 Q-214,-160 -232,-148 Q-250,-130 -236,-110 Q-224,-96 -210,-108"
        stroke="url(#gs-gold)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-196,-48 L200,-48" stroke="url(#gs-gold)" stroke-width="6" stroke-linecap="round"/>
      <path d="M-150,-70 q24,-22 48,0 q24,22 48,0 q24,-22 48,0 q24,22 48,0 q24,-22 48,0" stroke="url(#gs-gold)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g fill="#f2cf63"><circle cx="-160" cy="-72" r="5"/><circle cx="102" cy="-72" r="5"/><circle cx="-54" cy="-72" r="3.5"/><circle cx="-6" cy="-72" r="3.5"/><circle cx="42" cy="-72" r="3.5"/></g>
      <path d="M-180,-96 Q-60,-86 120,-92" stroke="#ff8a93" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>
      <g transform="translate(150,-74) rotate(-8)">
        <rect x="-22" y="-12" width="44" height="22" rx="2" fill="#8d5a2f" stroke="#4a2e17" stroke-width="2"/>
        <path d="M-18,-4 h36 M-18,4 h36" stroke="#6b4424" stroke-width="1.5"/>
        <circle cx="-16" cy="0" r="2.4" fill="#d8d8d8"/><circle cx="16" cy="0" r="2.4" fill="#d8d8d8"/>
      </g>
    </g>`;
  }

  // ---------- sack (procedural, grows with fill 0..1) ----------
  function sackShape(fill, tied, seed) {
    const f = Math.max(0, Math.min(1.25, fill));
    const W = 120 + 150 * f;
    const H = 110 + 175 * f;
    const r = rng(seed || 5);
    const bumps = [];
    for (let i = 0; i < 7; i++) bumps.push({ k: 2 + Math.floor(r() * 5), p: r() * Math.PI * 2, a: r() });
    const amp = 2 + 15 * f;
    const neckW = tied ? W * 0.16 : W * 0.38;
    const pts = [];
    const N = 40;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2 - Math.PI / 2; // start at top
      const s = Math.sin(t), c = Math.cos(t);
      let bump = 0;
      for (const b of bumps) bump += Math.sin(t * b.k + b.p) * b.a;
      bump = (bump / bumps.length) * amp * 2.2 * (s < 0.7 ? 1 : 0.3);
      let x = c * (W / 2 + bump);
      let yN = s > 0 ? Math.pow(s, 0.55) : s;           // flatter bottom
      let y = -H / 2 + yN * (H / 2) + (s < 0.5 ? -bump * 0.5 * Math.abs(s) : 0);
      const topness = Math.max(0, -s);                    // 1 at the very top
      const pinch = Math.pow(topness, 3);
      x = x * (1 - pinch) + Math.sign(c) * (neckW / 2) * pinch * Math.abs(c) * 2.2;
      pts.push([x, Math.min(0, y)]);
    }
    const body = smoothClosed(pts);
    const top = -H;
    let neck;
    let mouth = null;
    if (tied) {
      neck = `M${f1(-neckW / 2)},${f1(top + 6)} Q${f1(-neckW * 1.6)},${f1(top - 34)} ${f1(-neckW * 0.6)},${f1(top - 44)}
              Q0,${f1(top - 32)} ${f1(neckW * 0.7)},${f1(top - 46)} Q${f1(neckW * 1.7)},${f1(top - 30)} ${f1(neckW / 2)},${f1(top + 6)} Z`;
    } else {
      const lw = neckW * 0.95;
      neck = `M${f1(-neckW / 2)},${f1(top + 8)} Q${f1(-lw)},${f1(top - 10)} ${f1(-lw * 1.15)},${f1(top - 26)}
              Q${f1(-lw * 0.5)},${f1(top - 18)} 0,${f1(top - 24)} Q${f1(lw * 0.5)},${f1(top - 16)} ${f1(lw * 1.15)},${f1(top - 28)}
              Q${f1(lw)},${f1(top - 10)} ${f1(neckW / 2)},${f1(top + 8)} Z`;
      mouth = { cx: 0, cy: top - 22, rx: lw * 0.95, ry: 8 + f * 4 };
    }
    // Lumps of paper pushing at the sack from inside.
    const lumps = [];
    const lumpCount = Math.round(2 + f * 9);
    for (let i = 0; i < lumpCount; i++) {
      const lx = (r() - 0.5) * W * 0.6;
      const ly = -H * (0.2 + r() * 0.6);
      const lr = 10 + r() * 14 * (0.5 + f);
      lumps.push(`M${f1(lx - lr)},${f1(ly)} Q${f1(lx)},${f1(ly - lr * 1.2)} ${f1(lx + lr)},${f1(ly)}`);
    }
    return { W, H, body, neck, mouth, lumps: lumps.join(' '), top, rope: tied ? { y: top + 4, w: neckW } : null,
      patch: { x: W * 0.12, y: -H * 0.5 } };
  }

  function sackMarkup() {
    return `
    <g class="sack">
      <g class="sack-squash">
        <ellipse class="sack-shadow" cx="0" cy="-2" rx="80" ry="10" fill="#000" opacity=".35"/>
        <path class="sack-body" fill="url(#gs-sack)" stroke="#5b3f22" stroke-width="3"/>
        <path class="sack-texture" fill="url(#gs-burlap)"/>
        <path class="sack-lumps" fill="none" stroke="#6e4f2e" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
        <g class="sack-patch">
          <rect x="-16" y="-14" width="32" height="28" fill="#7f9a5a" stroke="#3d4f28" stroke-width="2" transform="rotate(-7)"/>
          <rect x="-12" y="-10" width="24" height="20" fill="none" stroke="#e9f1d6" stroke-width="1.4" stroke-dasharray="3 2" transform="rotate(-7)"/>
        </g>
        <path class="sack-neck" fill="#b28a5c" stroke="#5b3f22" stroke-width="3" stroke-linejoin="round"/>
        <ellipse class="sack-mouth" fill="#2a1c10" stroke="#5b3f22" stroke-width="2"/>
        <g class="sack-rope">
          <rect class="rope-band" height="10" rx="5" fill="#d8c08a" stroke="#7a6032" stroke-width="2"/>
          <path class="rope-bow" fill="none" stroke="#d8c08a" stroke-width="7" stroke-linecap="round"/>
        </g>
      </g>
    </g>`;
  }

  function applySack(root, shape) {
    const q = (s) => root.querySelector(s);
    q('.sack-body').setAttribute('d', shape.body);
    q('.sack-texture').setAttribute('d', shape.body);
    q('.sack-lumps').setAttribute('d', shape.lumps);
    q('.sack-neck').setAttribute('d', shape.neck);
    q('.sack-shadow').setAttribute('rx', f1(shape.W * 0.58));
    q('.sack-patch').setAttribute('transform', `translate(${f1(shape.patch.x)},${f1(shape.patch.y)})`);
    const m = q('.sack-mouth');
    if (shape.mouth) {
      m.style.display = '';
      m.setAttribute('cx', shape.mouth.cx); m.setAttribute('cy', f1(shape.mouth.cy));
      m.setAttribute('rx', f1(shape.mouth.rx)); m.setAttribute('ry', f1(shape.mouth.ry));
    } else m.style.display = 'none';
    const rope = q('.sack-rope');
    if (shape.rope) {
      rope.style.display = '';
      const band = q('.rope-band');
      const w = shape.rope.w * 1.5;
      band.setAttribute('x', f1(-w / 2)); band.setAttribute('y', f1(shape.rope.y - 5)); band.setAttribute('width', f1(w));
      const y = shape.rope.y;
      q('.rope-bow').setAttribute('d',
        `M0,${y} C-30,${y - 26} -44,${y + 4} -6,${y + 2} M0,${y} C30,${y - 26} 44,${y + 4} 6,${y + 2}
         M-4,${y + 4} q-10,18 -20,26 M4,${y + 4} q12,16 24,22`);
    } else rope.style.display = 'none';
  }

  // ---------- flying objects ----------
  function paperBall(seed, rad) {
    const r = rng(seed);
    const R = rad || 26;
    const pts = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = R * (0.78 + r() * 0.35);
      pts.push(`${f1(Math.cos(a) * k)},${f1(Math.sin(a) * k)}`);
    }
    const creases = [];
    for (let i = 0; i < 4; i++) {
      const a = r() * 6.28, b = a + 1.5 + r() * 2;
      creases.push(`M${f1(Math.cos(a) * R * 0.7)},${f1(Math.sin(a) * R * 0.7)} L${f1((r() - 0.5) * R * 0.5)},${f1((r() - 0.5) * R * 0.5)} L${f1(Math.cos(b) * R * 0.7)},${f1(Math.sin(b) * R * 0.7)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="#f5f1e6" stroke="#aaa291" stroke-width="2" stroke-linejoin="round"/>
      <path d="${creases.join(' ')}" fill="none" stroke="#c4bba8" stroke-width="1.6"/>
      <path d="M${-R * 0.5},${-R * 0.2} h${R * 0.7} M${-R * 0.45},${R * 0.1} h${R * 0.6}" stroke="#7fa6d9" stroke-width="1.2" opacity=".55"/>`;
  }

  function coalLump(seed, rad) {
    const r = rng(seed);
    const R = rad || 22;
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = R * (0.7 + r() * 0.45);
      pts.push(`${f1(Math.cos(a) * k)},${f1(Math.sin(a) * k)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="url(#gs-coal)" stroke="#6d6d76" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M${-R * 0.4},${-R * 0.35} l${R * 0.3},${-R * 0.1} l${R * 0.1},${R * 0.25} Z" fill="#9a9aa6" opacity=".8"/>
      <circle cx="${R * 0.3}" cy="${R * 0.1}" r="1.8" fill="#c9c9d3"/>`;
  }

  global.GrumpArt = { CHAR, defs, grumbles, goat, sled, sledFront, sackMarkup, sackShape, applySack, paperBall, coalLump, rng };
})(window);
