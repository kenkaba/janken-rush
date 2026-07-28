/* ============================================================
   JANKEN RUSH — VIEW
   描画・音・DOM演出のみ。勝敗を決めるコードはここには無い。
   core.js が確定させた結果を「最高に見せる」ことだけを担当する。
   ============================================================ */
const { HAND_COLOR, STAGES, TIERS, clamp, rnd } =
  await import('./core.js' + new URL(import.meta.url).search);

export const $ = (s) => document.querySelector(s);

let SPEED = 1;                                   // 演出の時間倍率（チューニング / 検証用）
export const setSpeed = (x) => { SPEED = x; };
export const getSpeed = () => SPEED;
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
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* noop */ } }
}

/* ============================================================
   音（WebAudio 完全合成。音源ファイル無し）
   AudioContext はアプリ全体で1つ。init は冪等。
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
  ui() { this.tone({ f: 900, d: 0.05, type: 'square', v: 0.12 }); this.tone({ f: 1400, t: 0.03, d: 0.06, type: 'square', v: 0.08 }); },
  lock() { this.tone({ f: 180, f2: 60, d: 0.22, type: 'sawtooth', v: 0.28 }); this.noise({ d: 0.12, v: 0.2, hp: 900 }); },
  tick(i, tier) {
    const f = [520, 660, 880][i] || 880, m = 1 + tier * 0.06;
    this.tone({ f: f * m, d: 0.14, type: 'square', v: 0.22 });
    this.tone({ f: f * 2 * m, d: 0.1, type: 'sine', v: 0.1 });
  },
  impact() { this.tone({ f: 150, f2: 38, d: 0.42, type: 'sine', v: 0.5 }); this.noise({ d: 0.3, v: 0.34, hp: 120, lp: 3500 }); },
  win(n) {
    const base = 440 * Math.pow(1.0595, Math.min(n, 14));
    [0, 4, 7, 12].forEach((s, i) => this.tone({ f: base * Math.pow(1.0595, s), t: i * 0.055, d: 0.4, type: 'triangle', v: 0.26 }));
    this.noise({ d: 0.5, v: 0.16, hp: 2200 });
  },
  lose() { this.tone({ f: 300, f2: 70, d: 0.7, type: 'sawtooth', v: 0.26 }); this.tone({ f: 150, f2: 40, d: 0.9, type: 'sine', v: 0.2 }); },
  charge(d = 0.7) { this.tone({ f: 120, f2: 1500, d, type: 'sawtooth', v: 0.2 }); this.noise({ d, v: 0.1, hp: 400 }); },
  confirm() {
    for (let i = 0; i < 10; i++) this.tone({ f: 520 * Math.pow(1.16, i), t: i * 0.045, d: 0.3, type: 'square', v: 0.2 });
    this.tone({ f: 80, f2: 40, d: 0.9, type: 'sine', v: 0.4 });
  },
  chain(i) { this.tone({ f: 300 + i * 90, f2: 900 + i * 120, d: 0.28, type: 'sawtooth', v: 0.3 }); this.noise({ d: 0.2, v: 0.24, hp: 500 }); },
  freeze() { this.tone({ f: 900, f2: 30, d: 1.1, type: 'sine', v: 0.4 }); this.noise({ d: 0.14, v: 0.4, hp: 3000 }); },
  stageUp() { [0, 5, 7, 12, 17].forEach((s, i) => this.tone({ f: 330 * Math.pow(1.0595, s), t: i * 0.07, d: 0.55, type: 'triangle', v: 0.24 })); this.impact(); },
  read() { this.tone({ f: 1200, d: 0.14, type: 'square', v: 0.16 }); this.tone({ f: 1800, t: 0.08, d: 0.16, type: 'square', v: 0.12 }); },
  miss() { this.tone({ f: 420, f2: 220, d: 0.22, type: 'square', v: 0.14 }); },
  defeat() { [0, 3, 7, 10, 12].forEach((s, i) => this.tone({ f: 262 * Math.pow(1.0595, s), t: i * 0.06, d: 0.6, type: 'sawtooth', v: 0.2 })); this.impact(); },
};

/* ============================================================
   手アイコン（オリジナル）
   図形ごとに縁取ると肉球に見えるため
   「太い縁取り → 塗り → 上面ハイライト → しわ線」の4パスで描く。
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
   背景（手続き生成シティ）
   ============================================================ */
export const BG = {
  cv: null, c: null, w: 0, h: 0, dpr: 1, t: 0,
  layers: [], stage: null, rain: [], embers: [], pillars: [], frozen: false, speed: 1,
  bound: false,
  init() {
    this.cv = $('#bg'); this.c = this.cv.getContext('2d');
    this.resize();
    if (!this.bound) { addEventListener('resize', () => this.resize()); this.bound = true; }
  },
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, Quality.low ? 1 : 2);
    this.w = innerWidth || 375; this.h = innerHeight || 812;
    this.cv.width = Math.max(1, this.w * this.dpr); this.cv.height = Math.max(1, this.h * this.dpr);
    this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.stage) this.buildCity(this.stage);
    const n = Quality.scale(170), m = Quality.scale(56);
    this.rain = []; for (let i = 0; i < n; i++) this.rain.push({ x: rnd(this.w), y: rnd(this.h), v: rnd(16, 7), l: rnd(28, 12) });
    this.embers = []; for (let i = 0; i < m; i++) this.embers.push({ x: rnd(this.w), y: rnd(this.h), v: rnd(0.8, 0.15), s: rnd(2.6, 0.7), p: rnd(6.28) });
  },
  setStage(st) {
    this.stage = st; this.buildCity(st);
    this.pillars = [];
    for (let i = 0; i < st.pil; i++) this.pillars.push({ x: rnd(this.w), w: rnd(80, 26), p: rnd(6.28), s: rnd(1.7, 0.5) });
  },
  buildCity(st) {
    this.layers = [];
    const cfg = [
      { h: 0.40, a: 0.60, sc: 0.06, bw: [40, 96], lit: 0.24 },
      { h: 0.31, a: 0.82, sc: 0.14, bw: [28, 66], lit: 0.30 },
      { h: 0.21, a: 1.00, sc: 0.28, bw: [20, 46], lit: 0.36 },
    ];
    cfg.forEach((L) => {
      const w = Math.ceil(Math.max(2, this.w) * 2), hh = Math.ceil(Math.max(2, this.h) * L.h) + 40;
      const o = document.createElement('canvas');
      o.width = Math.max(1, w * this.dpr); o.height = Math.max(1, hh * this.dpr);
      const g = o.getContext('2d'); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      let x = -20;
      while (x < w + 40) {
        const bw = rnd(L.bw[1], L.bw[0]), bh = rnd(hh * 0.95, hh * 0.32);
        g.globalAlpha = L.a; g.fillStyle = st.city; g.fillRect(x, hh - bh, bw, bh);
        g.fillStyle = st.acc; g.globalAlpha = L.a * 0.5; g.fillRect(x, hh - bh, bw, 1.6);
        g.globalAlpha = L.a;
        const cols = Math.max(1, Math.floor(bw / 9)), rows = Math.max(1, Math.floor(bh / 12));
        for (let cx2 = 0; cx2 < cols; cx2++) for (let cy2 = 0; cy2 < rows; cy2++) {
          if (Math.random() > L.lit) continue;
          g.fillStyle = Math.random() < 0.24 ? st.acc : 'rgba(200,222,255,.9)';
          g.fillRect(x + 4 + cx2 * 9, hh - bh + 6 + cy2 * 12, 3.2, 4.6);
        }
        if (Math.random() < 0.3) { g.fillStyle = st.acc; g.fillRect(x + bw / 2 - 1, hh - bh - 8, 2, 8); }
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
    const drift = Math.sin(t * 0.00022) * 0.06;
    g.addColorStop(0, st.sky[0]);
    g.addColorStop(clamp(0.5 + drift, 0.3, 0.7), st.sky[1]);
    g.addColorStop(1, st.sky[2]);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    c.globalCompositeOperation = 'screen';
    const gg = c.createRadialGradient(w * 0.5, h * 0.74, 0, w * 0.5, h * 0.74, w * 0.95);
    gg.addColorStop(0, st.acc + '66'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, 0, w, h);
    for (const p of this.pillars) {
      const a = 0.14 + Math.sin(t * 0.0016 * p.s + p.p) * 0.11;
      const lg = c.createLinearGradient(0, h, 0, h * 0.10);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.42, st.acc); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = clamp(a, 0, 1); c.fillStyle = lg; c.fillRect(p.x - p.w / 2, h * 0.08, p.w, h * 0.92);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

    this.layers.forEach((L) => {
      if (!this.frozen) L.off = (L.off + dt * L.sc * 0.06 * sp) % w;
      c.drawImage(L.cv, -L.off, h - L.h, w * 2, L.h);
      c.drawImage(L.cv, -L.off + w * 2, h - L.h, w * 2, L.h);
    });

    const rg = c.createLinearGradient(0, h * 0.84, 0, h);
    rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(1, st.acc + '3d');
    c.fillStyle = rg; c.fillRect(0, h * 0.84, w, h * 0.16);

    if (st.rain > 0 && this.rain.length) {
      c.strokeStyle = 'rgba(198,224,255,' + (0.20 * st.rain) + ')';
      c.lineWidth = 1.1; c.beginPath();
      for (const r of this.rain) {
        if (!this.frozen) { r.y += r.v * st.rain * dt * 0.06 * sp; if (r.y > h) { r.y = -20; r.x = rnd(w); } }
        c.moveTo(r.x, r.y); c.lineTo(r.x - 2.5, r.y + r.l);
      }
      c.stroke();
    }
    c.globalCompositeOperation = 'screen';
    for (const e of this.embers) {
      if (!this.frozen) { e.y -= e.v * dt * 0.05 * sp; e.p += dt * 0.002; if (e.y < -10) { e.y = h + 10; e.x = rnd(w); } }
      c.fillStyle = st.acc; c.globalAlpha = clamp(0.3 + Math.sin(e.p) * 0.26, 0, 1);
      c.beginPath(); c.arc(e.x + Math.sin(e.p) * 10, e.y, e.s, 0, 6.284); c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
};

/* ============================================================
   粒子・シェイク・フラッシュ
   ============================================================ */
export const FX = {
  cv: null, c: null, w: 0, h: 0, dpr: 1, ps: [], shake: 0, shakeT: 0, shakeMax: 260, bound: false,
  init() {
    this.cv = $('#fx'); this.c = this.cv.getContext('2d'); this.resize();
    if (!this.bound) { addEventListener('resize', () => this.resize()); this.bound = true; }
  },
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
      this.ps.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        decay: rnd(o.dmax || 0.028, o.dmin || 0.010), s: rnd(o.szmax || 5, o.szmin || 1.4),
        col: o.col || '#fff', g: o.g === undefined ? 0.16 : o.g, type: o.type || 'dot',
      });
    }
  },
  ring(x, y, col) {
    if (this.ps.length < this.cap()) this.ps.push({ x, y, vx: 0, vy: 0, life: 1, decay: 0.035, s: 12, col, type: 'ring', g: 0 });
  },
  rainbowBurst(x, y, n = 140) {
    const cols = ['#ff2d6f', '#ffb400', '#7cff4d', '#00d4ff', '#a45cff', '#fff'];
    for (let i = 0; i < n; i++) this.burst(x, y, 1, { col: cols[i % cols.length], smax: 17, smin: 3, szmax: 7, szmin: 2, dmax: 0.016, dmin: 0.007 });
  },
  hit(mag = 10, ms = 260) {
    if (Quality.low) mag *= 0.5;
    this.shake = Math.max(this.shake, mag);
    this.shakeT = Math.max(this.shakeT, ms); this.shakeMax = this.shakeT;
  },
  flash(col = '#fff', ms = 180, op = 0.85) {
    // rAF に依存すると省電力環境でフラッシュが消え残る。同期リフローで確定させる。
    const el = $('#tintFlash');
    el.style.transition = 'none'; el.style.background = col;
    el.style.opacity = Quality.low ? op * 0.6 : op;
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
      p.life -= p.decay * dt * 0.06;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
      if (p.type === 'ring') {
        p.s += dt * 0.55; c.globalAlpha = p.life * 0.8; c.strokeStyle = p.col; c.lineWidth = 2.5 * p.life + 0.5;
        c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.284); c.stroke(); continue;
      }
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += p.g * dt * 0.06; p.vx *= 0.992; p.vy *= 0.992;
      c.globalAlpha = clamp(p.life, 0, 1); c.fillStyle = p.col;
      if (p.type === 'shard') {
        c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
        c.fillRect(-p.s * 2.4, -p.s * 0.35, p.s * 4.8, p.s * 0.7); c.restore();
      } else {
        c.beginPath(); c.arc(p.x, p.y, p.s * clamp(p.life + 0.25, 0, 1), 0, 6.284); c.fill();
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = clamp(this.shakeT / (this.shakeMax || 260), 0, 1) * this.shake;
      $('#app').style.transform = `translate(${rnd(k, -k)}px,${rnd(k, -k)}px) rotate(${rnd(k, -k) * 0.08}deg)`;
      if (this.shakeT <= 0) { this.shake = 0; $('#app').style.transform = ''; }
    }
  },
};

export const cx = () => (innerWidth || 375) / 2;
export const cy = () => (innerHeight || 812) / 2;

/* ============================================================
   HUD / 盤面
   ============================================================ */
export function applyStageVisual(idx) {
  const st = STAGES[idx];
  const r = document.documentElement.style;
  r.setProperty('--acc', st.acc); r.setProperty('--accGlow', st.acc + 'aa');
  $('#stageName').textContent = st.n;
  $('#stageName').style.borderColor = st.acc;
  $('#heat').style.opacity = Quality.low ? st.heat * 0.5 : st.heat;
  BG.setStage(st);
  BG.speed = 1 + idx * 0.55;
  return st;
}
export function setStreak(n, pop) {
  const el = $('#streakNum');
  el.textContent = n;
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
export function setBest(n) { $('#bestNum').textContent = n; }
export function setModeBadge(mode) {
  const el = $('#modeBadge');
  el.textContent = mode === 'showcase' ? 'SHOWCASE  演出デモ' : mode === 'training' ? '訓練戦  戦績に残りません' : '';
  el.classList.toggle('on', mode !== 'fair');
}
export function showEnemyIdentity(arch) {
  document.documentElement.style.setProperty('--ec', arch.c);
  $('#enemyName').textContent = arch.n;
}
export function showTurnTells(turn) {
  $('#enemyState').textContent = turn ? turn.stateLine : '';
  $('#enemyTell').textContent = turn ? turn.tellLine : '—';
  $('#enemyTell').classList.remove('hit', 'missed');
}
export function markTellResult(honest) {
  const el = $('#enemyTell');
  el.classList.remove('hit', 'missed');
  el.classList.add(honest ? 'hit' : 'missed');
  // 決着中は左上の狭い空きに置くため、文言を短く保つ（手や期待度ラベルと衝突させない）
  el.textContent = honest ? '読み的中！' : '読み外し！';
}
export function setEnemyEyes(col, hot) {
  document.documentElement.style.setProperty('--eyeC', col);
  document.querySelectorAll('.eye').forEach((e) => { e.style.background = col; });
  $('#enemy').classList.toggle('hot', !!hot);
}
export function setTension(tier) {
  const T = TIERS[tier], f = $('#tensionFill'), l = $('#tensionLbl');
  f.style.setProperty('--tc', T.col); l.style.setProperty('--tc', T.col);
  f.style.right = (100 - tier * 20) + '%';
  f.style.background = tier === 5
    ? 'linear-gradient(90deg,#ff2d6f,#ffb400,#7cff4d,#00d4ff,#a45cff)' : T.col;
  l.textContent = T.lbl; l.classList.toggle('on', !!T.lbl);
}
export function setAura(tier) {
  const a = $('#foreAura'), T = TIERS[tier];
  if (tier <= 0) { a.classList.remove('on'); return; }
  a.style.setProperty('--fc', T.col);
  if (tier === 5) {
    a.style.borderColor = 'transparent';
    a.style.background = 'conic-gradient(#ff2d6f,#ffb400,#7cff4d,#00d4ff,#a45cff,#ff2d6f)';
    a.style.mixBlendMode = 'screen';
  } else { a.style.background = 'none'; a.style.mixBlendMode = ''; a.style.borderColor = T.col; }
  a.classList.add('on');
}
export function clearAura() { const a = $('#foreAura'); a.classList.remove('on'); a.style.background = 'none'; }
export function lockControls(v) { $('#controls').classList.toggle('locked', v); }
export function setChainPips(n) {
  const el = $('#chainPips');
  el.innerHTML = '';
  for (let i = 0; i < n; i++) { const i2 = document.createElement('i'); el.appendChild(i2); }
  el.classList.toggle('on', n > 0);
}

/* ---------------- 中央テキスト ---------------- */
export function big(txt, { col = '#fff', rb = false, ms = 700, sub = null, subCol = '#fff' } = {}) {
  const b = $('#bigText'), s = $('#subText');
  b.className = ''; void b.offsetWidth;
  b.textContent = txt; b.style.color = rb ? '' : col;
  if (rb) b.classList.add('rbText');
  b.classList.add('in');
  if (sub) { s.className = ''; void s.offsetWidth; s.textContent = sub; s.style.color = subCol; s.classList.add('in'); }
  else { s.className = ''; s.textContent = ''; }
  return wait(ms);
}
export function bigOut() {
  const b = $('#bigText');
  b.classList.remove('in'); b.classList.add('out');
  $('#subText').className = '';
}

/* ---------------- 手の提示 ---------------- */
export function showHand(sel, hand) {
  const el = $(sel);
  el.innerHTML = handSVG(hand); el.style.color = HAND_COLOR[hand];
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  $('#battleScrim').classList.add('on');
  document.body.classList.add('battling');
}
export function clearHands(purge) {
  $('#handP').classList.remove('show'); $('#handE').classList.remove('show');
  $('#vsMark').classList.remove('show'); $('#battleScrim').classList.remove('on');
  document.body.classList.remove('battling');
  if (purge) { $('#handP').innerHTML = ''; $('#handE').innerHTML = ''; }
}
/** 訓練戦：手を選ぶ前に敵の手を見せる */
export function showPreview(hand) {
  const el = $('#preview');
  el.innerHTML = `${handSVG(hand)}<div class="previewLbl">相手の手が見えている</div>`;
  el.style.color = HAND_COLOR[hand];
  el.classList.add('on');
}
export function clearPreview() { const el = $('#preview'); el.classList.remove('on'); el.innerHTML = ''; }

/* ============================================================
   演出モジュール
   ============================================================ */
export async function fxCountdown(tier) {
  const c = $('#count');
  for (let i = 0; i < 3; i++) {
    c.className = ''; void c.offsetWidth;
    c.textContent = String(3 - i);
    c.style.textShadow = `0 0 30px ${TIERS[tier].col},0 0 74px ${TIERS[tier].col}`;
    c.classList.add('tick'); Snd.tick(i, tier);
    FX.ring(cx(), cy(), TIERS[tier].col);
    await wait(tier >= 3 ? 300 : 360);
  }
  c.className = '';
}
export async function fxCutin(text, col) {
  const el = $('#cutin');
  el.style.setProperty('--cc', col);
  el.querySelector('.cutText').textContent = text;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  Snd.impact(); FX.hit(16, 300); FX.flash(col, 220, 0.5);
  FX.burst(cx(), cy(), 60, { col, smax: 18, smin: 4, szmax: 6, type: 'shard', g: 0 });
  buzz(30);
  await wait(720); el.classList.remove('on'); await wait(110);
}
export async function fxYakumono() {
  const y = $('#yakumono');
  y.innerHTML = handSVG('rock');
  y.classList.remove('drop'); void y.offsetWidth; y.classList.add('drop');
  Snd.charge(0.6);
  await wait(700);
  Snd.impact(); FX.hit(26, 420); FX.flash('#ffb400', 260, 0.7);
  FX.burst(cx(), cy() * 0.9, 90, { col: '#ffd45e', smax: 16, smin: 3, szmax: 7, g: 0.4 });
  FX.ring(cx(), cy() * 0.9, '#ffd45e'); buzz([40, 30, 60]);
  await wait(520);
  y.classList.remove('drop'); y.innerHTML = '';
}
export async function fxFreeze() {
  BG.frozen = true;
  const f = $('#freeze'), g = $('#cracks');
  let d = '';
  for (let i = 0; i < 14; i++) {
    let x = 200, y = 400, p = `M${x} ${y}`;
    const a0 = rnd(6.284);
    for (let k = 0; k < 5; k++) {
      x += Math.cos(a0 + rnd(0.7, -0.7)) * rnd(120, 50);
      y += Math.sin(a0 + rnd(0.7, -0.7)) * rnd(160, 60);
      p += ` L${x} ${y}`;
    }
    d += `<path class="crk" style="animation-delay:${i * 0.02}s" d="${p}"/>`;
  }
  g.innerHTML = d;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  Snd.freeze(); buzz([10, 40, 10, 40, 120]); FX.flash('#dff4ff', 90, 1);
  await wait(1450);
  f.classList.remove('on'); BG.frozen = false; g.innerHTML = '';
  Snd.confirm(); FX.flash('#fff', 420, 1); FX.hit(30, 520);
  FX.rainbowBurst(cx(), cy(), 180);
  await big('プレミア\n確 定', { rb: true, ms: 800 }); bigOut(); await wait(150);
}
export async function fxRevive() {
  Snd.charge(0.55); FX.hit(12, 300);
  await wait(340);
  FX.flash('#ffd45e', 420, 1); FX.hit(30, 520); Snd.confirm();
  FX.rainbowBurst(cx(), cy(), 160); buzz([60, 40, 120]);
  await big('復 活 !!', { rb: true, ms: 900, sub: '連勝は途切れない', subCol: '#ffd45e' });
  bigOut(); await wait(160);
}
export async function fxStageUp(idx) {
  const st = STAGES[idx], el = $('#stageUp'), nm = $('#stageUpName');
  nm.textContent = st.n; nm.className = 't2' + (st.rb ? ' rbText' : '');
  nm.style.color = st.rb ? '' : st.acc;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  Snd.stageUp(); FX.hit(24, 600); FX.flash(st.acc, 420, 0.8);
  FX.burst(cx(), cy(), 120, { col: st.acc, smax: 15, smin: 2, szmax: 6, g: 0 });
  buzz([50, 30, 50, 30, 90]);
  await wait(1420); el.classList.remove('on');
}
export async function fxDefeat(archColor) {
  Snd.defeat(); FX.hit(22, 520); FX.flash('#fff', 300, 0.7);
  FX.burst(cx(), cy() * 0.92, 110, { col: archColor, smax: 16, smin: 3, szmax: 7, type: 'shard', g: 0.3 });
  buzz([40, 40, 90]);
  await big('撃 破 !', { col: '#ffd45e', ms: 700, sub: '次の相手が来る', subCol: '#cfdcff' });
  bigOut(); await wait(200);
}
export async function fxChain(step, n) {
  Snd.chain(n); FX.hit(12 + n * 4, 300); FX.flash(step.col, 200, 0.5);
  FX.burst(cx(), cy(), 50 + n * 14, { col: step.col, smax: 14, smin: 3, type: 'shard', g: 0 });
  if (step.premium) { FX.rainbowBurst(cx(), cy(), 120); Snd.confirm(); }
  buzz(20 + n * 8);
  await big(step.label, { col: step.premium ? '' : step.col, rb: !!step.premium, ms: step.ms });
  bigOut(); await wait(110);
}

/* ============================================================
   全演出のリセット（再スタート時に残骸を残さない）
   ============================================================ */
export function resetPresentation() {
  clearHands(true); clearAura(); clearPreview(); setTension(0); setChainPips(0);
  document.body.classList.remove('battling');
  for (const sel of ['#cutin', '#freeze', '#stageUp']) $(sel).classList.remove('on');
  $('#yakumono').classList.remove('drop'); $('#yakumono').innerHTML = '';
  $('#cracks').innerHTML = '';
  $('#bigText').className = ''; $('#bigText').textContent = '';
  $('#subText').className = ''; $('#subText').textContent = '';
  $('#count').className = ''; $('#count').textContent = '';
  $('#enemyTell').classList.remove('hit', 'missed');
  BG.frozen = false;
  FX.clear();
}

/* ============================================================
   描画ループ（アプリ全体で1本だけ）
   ============================================================ */
let loopStarted = false;
export const LoopInfo = { mode: 'raf', frames: 0, intervalId: null };
export function startLoop() {
  if (loopStarted) return step;
  loopStarted = true;
  let last = performance.now();
  function step(dt) { BG.draw(dt); FX.draw(dt); }
  (function loop(now) {
    if (LoopInfo.mode !== 'raf') return;
    const dt = Math.min(now - last, 50); last = now; LoopInfo.frames++;
    step(dt); requestAnimationFrame(loop);
  })(last);
  // 一部WebView/省電力環境では rAF が発火しない。止まっていたらタイマー描画へ退避する。
  setTimeout(() => {
    if (LoopInfo.frames > 2 || LoopInfo.intervalId) return;
    LoopInfo.mode = 'interval';
    let t0 = performance.now();
    LoopInfo.intervalId = setInterval(() => {
      const n = performance.now(); const dt = Math.min(n - t0, 50); t0 = n; step(dt);
    }, 16);
  }, 500);
  return step;
}
function step(dt) { BG.draw(dt); FX.draw(dt); }
export { step as renderStep };
