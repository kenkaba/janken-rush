/* ============================================================
   JANKEN RUSH — VIEW
   描画・音・DOM演出のみ。勝敗を決めるコードはここには無い。
   ============================================================ */
const { HAND_COLOR, STAGES, clamp, rnd } =
  await import('./core.js' + new URL(import.meta.url).search);

export const $ = (s) => document.querySelector(s);

let SPEED = 1;
export const setSpeed = (x) => { SPEED = x; };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));

/* ---------------- 演出品質 ---------------- */
export const Quality = {
  level: localStorage.getItem('jr_fx') || 'high',
  get low() { return this.level === 'low'; },
  set(level) {
    this.level = level;
    localStorage.setItem('jr_fx', level);
    document.body.classList.toggle('fx-low', level === 'low');
    BG.resize(); FX.resize();
  },
  init() { document.body.classList.toggle('fx-low', this.low); },
  scale(n) { return this.low ? Math.max(1, Math.round(n * 0.35)) : n; },
};

export function buzz(p) {
  if (Quality.low) return;
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* iOSは非対応。画面揺れで代替 */ } }
}

/* ============================================================
   音（WebAudio 完全合成）
   ============================================================ */
export const Snd = {
  ctx: null, master: null, ok: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.ok = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  now() { return this.ctx.currentTime; },
  tone({ f = 440, t = 0, d = 0.18, type = 'sine', v = 0.3, f2 = null }) {
    if (!this.ok) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), T = this.now() + t;
    o.type = type; o.frequency.setValueAtTime(f, T);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), T + d);
    g.gain.setValueAtTime(0, T);
    g.gain.linearRampToValueAtTime(v, T + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, T + d);
    o.connect(g); g.connect(this.master); o.start(T); o.stop(T + d + 0.03);
  },
  noise({ t = 0, d = 0.2, v = 0.3, hp = 200, lp = 6000 }) {
    if (!this.ok) return;
    const c = this.ctx, len = Math.max(1, Math.floor(c.sampleRate * d));
    const b = c.createBuffer(1, len, c.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = b;
    const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const g = c.createGain(), T = this.now() + t;
    g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
    s.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(this.master); s.start(T);
  },
  ui() { this.tone({ f: 900, d: .05, type: 'square', v: .12 }); this.tone({ f: 1400, t: .03, d: .06, type: 'square', v: .08 }); },
  /** 宣言。低く重い一撃 */
  declare() { this.tone({ f: 90, f2: 62, d: .34, type: 'sawtooth', v: .34 }); this.noise({ d: .16, v: .16, hp: 120, lp: 900 }); },
  /** 残り時間の刻み */
  tick(pitch) { this.tone({ f: 700 + pitch * 260, d: .05, type: 'square', v: .12 }); },
  pick() { this.tone({ f: 520, f2: 900, d: .09, type: 'square', v: .2 }); },
  /** 仮面にヒットした金属音 */
  crack() {
    this.noise({ d: .28, v: .4, hp: 1800, lp: 9000 });
    this.tone({ f: 1400, f2: 300, d: .22, type: 'square', v: .2 });
    this.tone({ f: 120, f2: 44, d: .4, type: 'sine', v: .45 });
  },
  /** シールドが割れる */
  guardBreak() { this.tone({ f: 260, f2: 60, d: .5, type: 'sawtooth', v: .3 }); this.noise({ d: .3, v: .26, hp: 300, lp: 2600 }); },
  /** あいこの激突 */
  clash() {
    this.noise({ d: .2, v: .42, hp: 2600 });
    this.tone({ f: 1800, f2: 700, d: .16, type: 'square', v: .22 });
    this.tone({ f: 150, f2: 50, d: .34, type: 'sine', v: .4 });
  },
  roar() {
    this.tone({ f: 74, f2: 150, d: .8, type: 'sawtooth', v: .42 });
    this.tone({ f: 150, f2: 70, d: .9, type: 'square', v: .18 });
    this.noise({ d: .7, v: .2, hp: 80, lp: 1400 });
  },
  rush() { [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone({ f: 330 * Math.pow(1.0595, s), t: i * .06, d: .5, type: 'square', v: .2 })); },
  confirm() {
    for (let i = 0; i < 10; i++) this.tone({ f: 520 * Math.pow(1.16, i), t: i * .04, d: .28, type: 'square', v: .2 });
    this.tone({ f: 80, f2: 40, d: .9, type: 'sine', v: .4 });
  },
  impact() { this.tone({ f: 150, f2: 34, d: .5, type: 'sine', v: .55 }); this.noise({ d: .34, v: .38, hp: 100, lp: 3200 }); },
  win() { [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 523 * Math.pow(1.0595, s), t: i * .06, d: .45, type: 'triangle', v: .26 })); },
  lose() { this.tone({ f: 300, f2: 66, d: .8, type: 'sawtooth', v: .28 }); this.tone({ f: 140, f2: 40, d: 1, type: 'sine', v: .22 }); },
  freeze() { this.tone({ f: 900, f2: 30, d: 1, type: 'sine', v: .4 }); this.noise({ d: .14, v: .4, hp: 3000 }); },
};

/* ============================================================
   手アイコン（オリジナル）
   ============================================================ */
const HAND_SHAPES = {
  rock: `<rect x="26" y="54" width="108" height="78" rx="34"/>
         <rect x="34" y="44" width="30" height="34" rx="15"/>
         <rect x="62" y="40" width="32" height="36" rx="16"/>
         <rect x="92" y="44" width="30" height="34" rx="15"/>
         <rect x="112" y="56" width="26" height="30" rx="13"/>
         <rect x="14" y="76" width="40" height="30" rx="15"/>`,
  scissors: `<rect x="36" y="78" width="94" height="56" rx="27"/>
         <rect x="42" y="16" width="27" height="80" rx="13.5" transform="rotate(-17 55.5 56)"/>
         <rect x="84" y="14" width="27" height="82" rx="13.5" transform="rotate(15 97.5 55)"/>
         <rect x="104" y="76" width="28" height="30" rx="14"/>
         <rect x="20" y="92" width="38" height="28" rx="14"/>`,
  paper: `<rect x="40" y="66" width="88" height="66" rx="30"/>
         <rect x="44" y="18" width="24" height="70" rx="12" transform="rotate(-13 56 53)"/>
         <rect x="68" y="10" width="24" height="78" rx="12" transform="rotate(-4 80 49)"/>
         <rect x="92" y="14" width="24" height="74" rx="12" transform="rotate(6 104 51)"/>
         <rect x="112" y="26" width="23" height="62" rx="11.5" transform="rotate(16 123.5 57)"/>
         <rect x="16" y="80" width="42" height="27" rx="13.5" transform="rotate(-22 37 93.5)"/>`,
};
const HAND_DETAIL = {
  rock: `<path d="M60 60 L60 82"/><path d="M88 57 L88 81"/><path d="M114 63 L114 84"/><path d="M54 82 L54 106"/>`,
  scissors: `<path d="M74 76 L80 98"/>`,
  paper: `<path d="M60 46 L62 82"/><path d="M82 38 L82 80"/><path d="M103 44 L101 82"/><path d="M58 88 L54 106"/>`,
};
export function handSVG(t) {
  const s = HAND_SHAPES[t] || HAND_SHAPES.rock;
  return `<svg class="handSVG" viewBox="0 0 160 160" aria-hidden="true">
    <g class="ho">${s}</g><g class="hf">${s}</g>
    <g class="hl" clip-path="url(#topClip)">${s}</g>
    <g class="hd">${HAND_DETAIL[t] || ''}</g></svg>`;
}

/* ============================================================
   背景
   ============================================================ */
export const BG = {
  cv: null, c: null, w: 0, h: 0, dpr: 1, t: 0,
  layers: [], stage: null, rain: [], embers: [], pillars: [], frozen: false, speed: 1,
  init() { this.cv = $('#bg'); this.c = this.cv.getContext('2d'); this.resize(); },
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, Quality.low ? 1 : 2);
    this.w = innerWidth || 375; this.h = innerHeight || 812;
    this.cv.width = Math.max(1, this.w * this.dpr); this.cv.height = Math.max(1, this.h * this.dpr);
    this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.stage) this.buildCity(this.stage);
    const n = Quality.scale(150), m = Quality.scale(48);
    this.rain = []; for (let i = 0; i < n; i++) this.rain.push({ x: rnd(this.w), y: rnd(this.h), v: rnd(16, 7), l: rnd(28, 12) });
    this.embers = []; for (let i = 0; i < m; i++) this.embers.push({ x: rnd(this.w), y: rnd(this.h), v: rnd(.8, .15), s: rnd(2.6, .7), p: rnd(6.28) });
  },
  setStage(st) {
    this.stage = st; this.buildCity(st);
    this.pillars = [];
    for (let i = 0; i < st.pil; i++) this.pillars.push({ x: rnd(this.w), w: rnd(80, 26), p: rnd(6.28), s: rnd(1.7, .5) });
  },
  buildCity(st) {
    this.layers = [];
    const cfg = [
      { h: .40, a: .60, sc: .06, bw: [40, 96], lit: .24 },
      { h: .31, a: .82, sc: .14, bw: [28, 66], lit: .30 },
      { h: .21, a: 1.0, sc: .28, bw: [20, 46], lit: .36 },
    ];
    cfg.forEach((L) => {
      const w = Math.ceil(Math.max(2, this.w) * 2), hh = Math.ceil(Math.max(2, this.h) * L.h) + 40;
      const o = document.createElement('canvas');
      o.width = Math.max(1, w * this.dpr); o.height = Math.max(1, hh * this.dpr);
      const g = o.getContext('2d'); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      let x = -20;
      while (x < w + 40) {
        const bw = rnd(L.bw[1], L.bw[0]), bh = rnd(hh * .95, hh * .32);
        g.globalAlpha = L.a; g.fillStyle = st.city; g.fillRect(x, hh - bh, bw, bh);
        g.fillStyle = st.acc; g.globalAlpha = L.a * .5; g.fillRect(x, hh - bh, bw, 1.6);
        g.globalAlpha = L.a;
        const cols = Math.max(1, Math.floor(bw / 9)), rows = Math.max(1, Math.floor(bh / 12));
        for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
          if (Math.random() > L.lit) continue;
          g.fillStyle = Math.random() < .24 ? st.acc : 'rgba(200,222,255,.9)';
          g.fillRect(x + 4 + a * 9, hh - bh + 6 + b * 12, 3.2, 4.6);
        }
        x += bw + rnd(16, 3);
      }
      this.layers.push({ cv: o, h: hh, sc: L.sc, off: 0 });
    });
  },
  draw(dt) {
    const c = this.c, w = this.w, h = this.h, st = this.stage;
    if (!st || !c) return;
    const sp = this.frozen ? 0 : this.speed;
    if (!this.frozen) this.t += dt;
    const t = this.t;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, st.sky[0]);
    g.addColorStop(clamp(.5 + Math.sin(t * .00022) * .06, .3, .7), st.sky[1]);
    g.addColorStop(1, st.sky[2]);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'screen';
    const gg = c.createRadialGradient(w * .5, h * .74, 0, w * .5, h * .74, w * .95);
    gg.addColorStop(0, st.acc + '55'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, 0, w, h);
    for (const p of this.pillars) {
      const a = .14 + Math.sin(t * .0016 * p.s + p.p) * .11;
      const lg = c.createLinearGradient(0, h, 0, h * .10);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(.42, st.acc); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = clamp(a, 0, 1); c.fillStyle = lg; c.fillRect(p.x - p.w / 2, h * .08, p.w, h * .92);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    this.layers.forEach((L) => {
      if (!this.frozen) L.off = (L.off + dt * L.sc * .06 * sp) % w;
      c.drawImage(L.cv, -L.off, h - L.h, w * 2, L.h);
      c.drawImage(L.cv, -L.off + w * 2, h - L.h, w * 2, L.h);
    });
    if (st.rain > 0 && this.rain.length) {
      c.strokeStyle = 'rgba(198,224,255,' + (.18 * st.rain) + ')'; c.lineWidth = 1.1; c.beginPath();
      for (const r of this.rain) {
        if (!this.frozen) { r.y += r.v * st.rain * dt * .06 * sp; if (r.y > h) { r.y = -20; r.x = rnd(w); } }
        c.moveTo(r.x, r.y); c.lineTo(r.x - 2.5, r.y + r.l);
      }
      c.stroke();
    }
    c.globalCompositeOperation = 'screen';
    for (const e of this.embers) {
      if (!this.frozen) { e.y -= e.v * dt * .05 * sp; e.p += dt * .002; if (e.y < -10) { e.y = h + 10; e.x = rnd(w); } }
      c.fillStyle = st.acc; c.globalAlpha = clamp(.3 + Math.sin(e.p) * .26, 0, 1);
      c.beginPath(); c.arc(e.x + Math.sin(e.p) * 10, e.y, e.s, 0, 6.284); c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
};

/* ============================================================
   粒子・シェイク・フラッシュ
   ============================================================ */
export const FX = {
  cv: null, c: null, w: 0, h: 0, dpr: 1, ps: [], shake: 0, shakeT: 0, shakeMax: 260,
  init() { this.cv = $('#fx'); this.c = this.cv.getContext('2d'); this.resize(); },
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, Quality.low ? 1 : 2);
    this.w = innerWidth || 375; this.h = innerHeight || 812;
    this.cv.width = Math.max(1, this.w * this.dpr); this.cv.height = Math.max(1, this.h * this.dpr);
    this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  cap() { return Quality.low ? 180 : 560; },
  burst(x, y, n, o = {}) {
    n = Quality.scale(n);
    for (let i = 0; i < n; i++) {
      if (this.ps.length > this.cap()) break;
      const a = o.dir !== undefined ? o.dir + rnd(o.spread || 6.284) - (o.spread || 6.284) / 2 : rnd(6.284);
      const sp = rnd(o.smax || 9, o.smin || 1.5);
      this.ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        decay: rnd(o.dmax || .028, o.dmin || .010), s: rnd(o.szmax || 5, o.szmin || 1.4),
        col: o.col || '#fff', g: o.g === undefined ? .16 : o.g, type: o.type || 'dot' });
    }
  },
  ring(x, y, col) { if (this.ps.length < this.cap()) this.ps.push({ x, y, vx: 0, vy: 0, life: 1, decay: .035, s: 12, col, type: 'ring', g: 0 }); },
  rainbowBurst(x, y, n = 140) {
    const cols = ['#ff2d6f', '#ffb400', '#7cff4d', '#00d4ff', '#a45cff', '#fff'];
    for (let i = 0; i < n; i++) this.burst(x, y, 1, { col: cols[i % cols.length], smax: 17, smin: 3, szmax: 7, szmin: 2, dmax: .016, dmin: .007 });
  },
  hit(mag = 10, ms = 260) {
    if (Quality.low) mag *= .5;
    this.shake = Math.max(this.shake, mag);
    this.shakeT = Math.max(this.shakeT, ms); this.shakeMax = this.shakeT;
  },
  flash(col = '#fff', ms = 180, op = .85) {
    const el = $('#tintFlash');
    el.style.transition = 'none'; el.style.background = col; el.style.opacity = Quality.low ? op * .6 : op;
    void el.offsetWidth;
    el.style.transition = 'opacity ' + ms + 'ms ease-out'; el.style.opacity = 0;
  },
  clear() {
    this.ps.length = 0; this.shake = 0; this.shakeT = 0;
    $('#app').style.transform = '';
    const el = $('#tintFlash'); el.style.transition = 'none'; el.style.opacity = 0;
    if (this.c) this.c.clearRect(0, 0, this.w, this.h);
  },
  draw(dt) {
    const c = this.c; if (!c) return;
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= p.decay * dt * .06;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
      if (p.type === 'ring') {
        p.s += dt * .55; c.globalAlpha = p.life * .8; c.strokeStyle = p.col; c.lineWidth = 2.5 * p.life + .5;
        c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.284); c.stroke(); continue;
      }
      p.x += p.vx * dt * .06; p.y += p.vy * dt * .06; p.vy += p.g * dt * .06; p.vx *= .992; p.vy *= .992;
      c.globalAlpha = clamp(p.life, 0, 1); c.fillStyle = p.col;
      if (p.type === 'shard') {
        c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
        c.fillRect(-p.s * 2.4, -p.s * .35, p.s * 4.8, p.s * .7); c.restore();
      } else { c.beginPath(); c.arc(p.x, p.y, p.s * clamp(p.life + .25, 0, 1), 0, 6.284); c.fill(); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = clamp(this.shakeT / (this.shakeMax || 260), 0, 1) * this.shake;
      $('#app').style.transform = `translate(${rnd(k, -k)}px,${rnd(k, -k)}px) rotate(${rnd(k, -k) * .08}deg)`;
      if (this.shakeT <= 0) { this.shake = 0; $('#app').style.transform = ''; }
    }
  },
};

export const cx = () => (innerWidth || 375) / 2;
export const cy = () => (innerHeight || 812) / 2;

/* ============================================================
   HUD
   ============================================================ */
export function applyStage(idx) {
  const st = STAGES[clamp(idx, 0, STAGES.length - 1)];
  const r = document.documentElement.style;
  r.setProperty('--acc', st.acc);
  $('#heat').style.opacity = Quality.low ? st.heat * .5 : st.heat;
  BG.setStage(st); BG.speed = 1 + idx * .5;
}
export function setPips(sel, remain, max) {
  const pips = document.querySelectorAll(sel + ' i');
  pips.forEach((el, i) => el.classList.toggle('gone', i >= remain));
  void max;
}
export function breakPip(sel, index) {
  const el = document.querySelectorAll(sel + ' i')[index];
  if (!el) return;
  el.classList.remove('breaking'); void el.offsetWidth; el.classList.add('breaking');
}
export function setGauge(sel, pct) {
  const fill = $(sel);
  fill.style.width = clamp(pct, 0, 100) + '%';
  fill.parentElement.parentElement.classList.toggle('full', pct >= 100);
}
export function setDecl(text, lie) {
  const el = $('#declText');
  el.textContent = text;
  el.classList.toggle('lie', !!lie);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
export function setTimeBar(ratio) {
  const el = $('#timeFill');
  el.style.width = clamp(ratio * 100, 0, 100) + '%';
  el.classList.toggle('warn', ratio < 0.34);
}
export function showGhost(hand) {
  const el = $('#ghostHand');
  el.innerHTML = handSVG(hand);
  el.style.color = HAND_COLOR[hand];
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
export function hideGhost() { $('#ghostHand').classList.remove('on'); }
export function setHistory(hands) {
  const el = $('#history');
  if (!hands.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="hlbl">相手</div>' +
    hands.slice(-3).reverse().map((h) =>
      `<div class="hcell" style="color:${HAND_COLOR[h]}">${handSVG(h)}</div>`).join('');
}
export function setCoach(text) {
  const el = $('#coach');
  el.textContent = text || '';
  el.classList.toggle('on', !!text);
}
export function teachButton(hand) {
  document.querySelectorAll('.hbtn').forEach((b) => b.classList.remove('teach'));
  if (hand) document.querySelector('.hbtn.' + hand)?.classList.add('teach');
}
export function lockControls(v) { $('#controls').classList.toggle('locked', v); }

/* ---------------- 中央テキスト ---------------- */
export function big(txt, { col = '#fff', rb = false, ms = 500, sub = null, subCol = '#fff' } = {}) {
  const b = $('#bigText'), s = $('#subText');
  b.className = ''; void b.offsetWidth;
  b.textContent = txt; b.style.color = rb ? '' : col;
  if (rb) b.classList.add('rbText');
  b.classList.add('in');
  if (sub) { s.className = ''; void s.offsetWidth; s.textContent = sub; s.style.color = subCol; s.classList.add('in'); }
  else { s.className = ''; s.textContent = ''; }
  return wait(ms);
}
export function bigOut() { const b = $('#bigText'); b.classList.remove('in'); b.classList.add('out'); $('#subText').className = ''; }

/* ---------------- 決着の手 ---------------- */
export function showHands(playerHand, enemyHand, collide) {
  const p = $('#handP'), e = $('#handE'), layer = $('#clashLayer');
  p.innerHTML = handSVG(playerHand); p.style.color = HAND_COLOR[playerHand];
  e.innerHTML = handSVG(enemyHand); e.style.color = HAND_COLOR[enemyHand];
  layer.classList.toggle('collide', !!collide);
  [p, e].forEach((el) => { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); });
}
export function clearHands() {
  $('#handP').classList.remove('in'); $('#handE').classList.remove('in');
  $('#handP').innerHTML = ''; $('#handE').innerHTML = '';
  $('#clashLayer').classList.remove('collide');
}

/* ---------------- 大きな演出 ---------------- */
export async function fxRushBanner() {
  const el = $('#rushBanner');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  Snd.rush(); FX.hit(22, 500); FX.flash('#ff4dff', 380, .7);
  FX.burst(cx(), cy(), 120, { col: '#ff4dff', smax: 16, smin: 3, szmax: 6, g: 0 });
  buzz([40, 30, 60]);
  await wait(1500); el.classList.remove('on');
}
export async function fxFreezeFlash(ms = 900) {
  BG.frozen = true;
  const f = $('#freeze'), g = $('#cracks');
  let d = '';
  for (let i = 0; i < 12; i++) {
    let x = 200, y = 400, p = `M${x} ${y}`; const a0 = rnd(6.284);
    for (let k = 0; k < 4; k++) {
      x += Math.cos(a0 + rnd(.7, -.7)) * rnd(130, 60);
      y += Math.sin(a0 + rnd(.7, -.7)) * rnd(170, 70); p += ` L${x} ${y}`;
    }
    d += `<path class="crk" style="animation-delay:${i * .02}s" d="${p}"/>`;
  }
  g.innerHTML = d;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  Snd.freeze(); FX.flash('#dff4ff', 90, 1); buzz([10, 40, 10, 60]);
  await wait(ms);
  f.classList.remove('on'); g.innerHTML = ''; BG.frozen = false;
}
export async function fxYakumonoDrop() {
  const y = $('#yakumono');
  y.innerHTML = handSVG('rock');
  y.classList.remove('drop'); void y.offsetWidth; y.classList.add('drop');
  Snd.tone({ f: 120, f2: 1400, d: .5, type: 'sawtooth', v: .24 });
  await wait(560);
  Snd.impact(); Snd.crack();
  FX.hit(34, 620); FX.flash('#fff', 340, 1);
  FX.burst(cx(), cy() * .95, 160, { col: '#ffd45e', smax: 20, smin: 4, szmax: 8, g: .35 });
  FX.rainbowBurst(cx(), cy() * .95, 120);
  buzz([60, 40, 120]);
  await wait(700);
  y.classList.remove('drop'); y.innerHTML = '';
}

/* ---------------- リセット ---------------- */
export function resetPresentation() {
  clearHands(); hideGhost(); setCoach(''); teachButton(null);
  $('#rushBanner').classList.remove('on');
  $('#freeze').classList.remove('on'); $('#cracks').innerHTML = '';
  $('#yakumono').classList.remove('drop'); $('#yakumono').innerHTML = '';
  $('#finisher').hidden = true;
  $('#bigText').className = ''; $('#bigText').textContent = '';
  $('#subText').className = ''; $('#subText').textContent = '';
  $('#declText').textContent = '—'; $('#declText').classList.remove('lie');
  $('#history').innerHTML = '';
  setTimeBar(1);
  BG.frozen = false;
  FX.clear();
}

/* ============================================================
   フレーム購読（制限時間の駆動に使う）
   rAF が止まる環境でもタイマー描画へ退避するので、
   ここに登録した処理は必ず動く。
   ============================================================ */
const tickers = new Set();
export function addTicker(fn) { tickers.add(fn); }
export function removeTicker(fn) { tickers.delete(fn); }

/* ============================================================
   ビューポート追従とiOS復帰
   ============================================================ */
let viewportBound = false, resizeTimer = null;
export function installViewportHandlers() {
  if (viewportBound) return;
  viewportBound = true;
  const onChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { BG.resize(); FX.resize(); }, 140);
  };
  addEventListener('resize', onChange);
  addEventListener('orientationchange', onChange);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onChange);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume().catch(() => {});
  });
  addEventListener('pageshow', () => {
    if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume().catch(() => {});
  });
}

/* ============================================================
   描画ループ（アプリ全体で1本だけ）
   ============================================================ */
let loopStarted = false;
export const LoopInfo = { mode: 'raf', frames: 0, intervalId: null };
function step(dt) {
  BG.draw(dt); FX.draw(dt);
  for (const fn of tickers) { try { fn(dt); } catch (e) { /* 1つ壊れても描画は止めない */ } }
}
export function startLoop() {
  if (loopStarted) return;
  loopStarted = true;
  let last = performance.now();
  (function loop(now) {
    if (LoopInfo.mode !== 'raf') return;
    const dt = Math.min(now - last, 50); last = now; LoopInfo.frames++;
    step(dt); requestAnimationFrame(loop);
  })(last);
  setTimeout(() => {
    if (LoopInfo.frames > 2 || LoopInfo.intervalId) return;
    LoopInfo.mode = 'interval';
    let t0 = performance.now();
    LoopInfo.intervalId = setInterval(() => {
      const n = performance.now(); const dt = Math.min(n - t0, 50); t0 = n; step(dt);
    }, 16);
  }, 500);
}
export { step as renderStep };
