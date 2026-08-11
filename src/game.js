/* ============================================================
   JANKEN RUSH — REFLEX SCORE ATTACK v0.5

   ルールは1つだけ。
   「相手が出した手に勝てる手を、時間内に押す」

   - 正解 = SCORE +1
   - 間違い / 時間切れ = LIFE -1
   - 3ミスで終了
   - SCOREが上がるほど判断時間が短くなる
   - 相手の手は毎ターン必ず表示し、選択まで消さない
   ============================================================ */
const Q = new URL(import.meta.url).search;
const C = await import('./core.js' + Q);
const V = await import('./view.js' + Q);
const GORO = await import('./goro.js' + Q);

const $ = V.$;
const BUILD = { version: '0.5.0', at: '2026-08-11' };

const G = {
  mode: 'reflex',
  running: false,
  busy: false,
  epoch: 0,
  score: 0,
  lives: 3,
  best: Number(localStorage.getItem('jr_reflex_best') || 0),
  enemyHistory: [],
  curHand: null,
  stats: { correct: 0, miss: 0, timeout: 0 },
};

const alive = (ep) => ep === G.epoch && G.running;
let pickResolver = null;
let lastEnemy = null;
let sameEnemyCount = 0;

/* ============================================================
   難易度
   普通の人は30前後から厳しくなり、反射神経が良い人は100超え可能。
   ============================================================ */
const SPEED_POINTS = [
  [0, 1700],
  [10, 1400],
  [20, 1100],
  [30, 850],
  [40, 700],
  [50, 600],
  [75, 480],
  [100, 400],
  [150, 330],
  [220, 290],
];

function reactionMs(score) {
  for (let i = 0; i < SPEED_POINTS.length - 1; i++) {
    const [s0, m0] = SPEED_POINTS[i];
    const [s1, m1] = SPEED_POINTS[i + 1];
    if (score <= s1) {
      const t = (score - s0) / (s1 - s0);
      return Math.round(m0 + (m1 - m0) * Math.max(0, Math.min(1, t)));
    }
  }
  return 270;
}

const MILESTONES = [
  { score: 10, label: '10 BREAK', sub: 'まだウォームアップ' },
  { score: 20, label: '20 BREAK', sub: 'ここから速くなる' },
  { score: 30, label: '30 突破', sub: '最初の壁を越えた' },
  { score: 50, label: '50 突破', sub: 'REFLEX MODE' },
  { score: 75, label: '75 突破', sub: 'OVERDRIVE' },
  { score: 100, label: '100 到達', sub: 'GOD HAND' },
  { score: 150, label: '150 到達', sub: 'LIMIT BREAK' },
  { score: 200, label: '200 到達', sub: 'MONSTER' },
];

function nextMilestone(score) {
  return MILESTONES.find((m) => m.score > score) || { score: score + 50, label: '', sub: '' };
}

/* ============================================================
   UI追加
   ============================================================ */
const arcadeHud = document.createElement('div');
arcadeHud.id = 'arcadeHud';
arcadeHud.innerHTML = `
  <div class="arcBest">BEST <b id="arcBest">0</b></div>
  <div class="arcScore"><span>SCORE</span><b id="arcScore">0</b></div>
  <div class="arcLives" id="arcLives" aria-label="残りライフ">♥ ♥ ♥</div>
  <div class="arcNext" id="arcNext"></div>
`;
$('#app')?.appendChild(arcadeHud);

const arcadeStyle = document.createElement('style');
arcadeStyle.textContent = `
  #topbar,#gauges,#history,#coach,#finisher,#yakumono,#rushBanner{display:none!important}
  #arcadeHud{position:absolute;z-index:36;top:calc(env(safe-area-inset-top,0px) + 12px);left:0;right:0;pointer-events:none;text-align:center;color:#fff;text-shadow:0 2px 10px #000}
  #arcadeHud .arcBest{position:absolute;left:16px;top:5px;font:800 11px/1 system-ui;letter-spacing:.12em;opacity:.72}
  #arcadeHud .arcBest b{font-size:15px;color:#ffd45e}
  #arcadeHud .arcScore span{display:block;font:800 10px/1 system-ui;letter-spacing:.22em;opacity:.62}
  #arcadeHud .arcScore b{display:block;margin-top:2px;font:900 clamp(42px,12vw,62px)/.88 system-ui;letter-spacing:-.05em;color:#fff}
  #arcadeHud .arcLives{position:absolute;right:15px;top:3px;font:900 19px/1 system-ui;letter-spacing:3px;color:#ff4058}
  #arcadeHud .arcLives.danger{animation:lifePulse .48s infinite alternate}
  #arcadeHud .arcNext{margin:7px auto 0;width:min(190px,48vw);height:3px;border-radius:4px;background:#ffffff24;overflow:hidden;font-size:0}
  #arcadeHud .arcNext:before{content:'';display:block;width:var(--p,0%);height:100%;background:#ffd45e;transition:width .14s linear}
  @keyframes lifePulse{to{transform:scale(1.15);filter:brightness(1.6)}}
  body.menu #arcadeHud{display:none}
  body:not(.menu) #declare{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 168px)}
  body:not(.menu) #declText{font-weight:900;letter-spacing:.08em}
  body:not(.menu) #stage{transform:translateY(18px)}
  #resultScreen #resTitle{font-size:clamp(34px,10vw,54px)}
  .scoreResult{font:900 clamp(54px,17vw,86px)/1 system-ui;color:#fff;margin:.15em 0 .08em;letter-spacing:-.06em}
  .scoreCaption{font:800 12px/1.4 system-ui;letter-spacing:.14em;opacity:.68}
`;
document.head.appendChild(arcadeStyle);

function updateHud() {
  $('#arcScore').textContent = G.score;
  $('#arcBest').textContent = Math.max(G.best, G.score);
  const hearts = Array.from({ length: 3 }, (_, i) => i < G.lives ? '♥' : '·').join(' ');
  const lifeEl = $('#arcLives');
  lifeEl.textContent = hearts;
  lifeEl.classList.toggle('danger', G.lives === 1);
  const n = nextMilestone(G.score);
  const prev = [...MILESTONES].reverse().find((m) => m.score <= G.score)?.score || 0;
  const p = Math.max(0, Math.min(100, ((G.score - prev) / Math.max(1, n.score - prev)) * 100));
  $('#arcNext').style.setProperty('--p', `${p}%`);
}

/* ============================================================
   入力
   ============================================================ */
function submitPick(hand) {
  if (!pickResolver) return false;
  const r = pickResolver;
  pickResolver = null;
  r(hand);
  return true;
}

function cancelPick() {
  if (!pickResolver) return;
  const r = pickResolver;
  pickResolver = null;
  r(null);
}

function awaitPick(ms) {
  return new Promise((resolve) => {
    let left = ms;
    let finished = false;
    const finish = (v) => {
      if (finished) return;
      finished = true;
      V.removeTicker(tick);
      pickResolver = null;
      V.setTimeBar(v === null ? 0 : Math.max(0, left / ms));
      resolve(v);
    };
    const tick = (dt) => {
      left -= dt;
      V.setTimeBar(Math.max(0, left / ms));
      if (left <= 0) finish(null);
    };
    pickResolver = finish;
    V.setTimeBar(1);
    V.addTicker(tick);
  });
}

function enemyHand() {
  let h = C.pick(C.HANDS);
  if (h === lastEnemy) sameEnemyCount += 1;
  else sameEnemyCount = 1;
  if (sameEnemyCount >= 3) {
    h = C.pick(C.HANDS.filter((x) => x !== lastEnemy));
    sameEnemyCount = 1;
  }
  lastEnemy = h;
  return h;
}

function winningHand(enemy) {
  return C.LOSES_TO[enemy];
}

/* ============================================================
   1問
   ============================================================ */
async function round() {
  const ep = G.epoch;
  const enemy = enemyHand();
  const ms = reactionMs(G.score);
  G.curHand = enemy;
  G.enemyHistory.push(enemy);
  if (G.enemyHistory.length > 3) G.enemyHistory.shift();

  GORO.setPose('charge');
  GORO.setEyeColor(C.HAND_COLOR[enemy]);
  V.setDecl(C.HAND_JP[enemy]);
  V.showGhost(enemy); // ★ 選ぶまで絶対に消さない

  G.busy = false;
  V.lockControls(false);
  const picked = await awaitPick(ms);
  G.busy = true;
  V.lockControls(true);
  V.hideGhost();
  if (!alive(ep)) return 'abort';

  if (picked === null) {
    G.stats.timeout++;
    await miss(ep, enemy, null, 'TIME OUT');
    return 'miss';
  }

  V.Snd.pick();
  document.querySelector('.hbtn.' + picked)?.classList.add('picked');
  setTimeout(() => document.querySelector('.hbtn.' + picked)?.classList.remove('picked'), 160);

  const correct = picked === winningHand(enemy);
  V.showHands(picked, enemy, false);
  await V.wait(65);
  if (!alive(ep)) return 'abort';

  if (correct) {
    G.stats.correct++;
    G.score++;
    G.best = Math.max(G.best, G.score);
    localStorage.setItem('jr_reflex_best', String(G.best));
    updateHud();
    await success(ep);
    V.clearHands();
    const milestone = MILESTONES.find((m) => m.score === G.score);
    if (milestone) await milestoneFx(ep, milestone);
    return 'correct';
  }

  G.stats.miss++;
  await miss(ep, enemy, picked, 'MISS');
  V.clearHands();
  return 'miss';
}

async function success(ep) {
  GORO.setPose('hit');
  V.Snd.crack();
  V.FX.hit(8, 120);
  V.FX.flash('#ffffff', 90, .34);
  V.buzz(10);
  await V.wait(G.score < 30 ? 85 : G.score < 75 ? 65 : 45);
  if (!alive(ep)) return;
  GORO.setPose('idle');
}

async function miss(ep, enemy, picked, label) {
  G.lives--;
  updateHud();
  GORO.setPose('attack');
  V.Snd.guardBreak();
  V.FX.hit(18, 260);
  V.FX.flash('#ff2446', 240, .62);
  V.buzz([45, 20, 55]);
  await V.big(label, { col: '#ff6578', ms: 260, sub: `残り ${G.lives}`, subCol: '#ffffff' });
  if (!alive(ep)) return;
  V.bigOut();
  await V.wait(70);
  GORO.setPose('idle');
}

async function milestoneFx(ep, m) {
  V.lockControls(true);
  const stage = m.score >= 100 ? 3 : m.score >= 50 ? 2 : m.score >= 20 ? 1 : 0;
  V.applyStage(stage);
  V.Snd.win();
  V.FX.hit(m.score >= 100 ? 30 : 18, 430);
  V.FX.flash(m.score >= 100 ? '#ffd45e' : '#ffffff', 360, .8);
  V.FX.rainbowBurst(V.cx(), V.cy() * .85, m.score >= 100 ? 150 : 80);
  V.buzz([35, 20, 60]);
  await V.big(m.label, { col: '#ffd45e', ms: m.score >= 100 ? 700 : 460, sub: m.sub, subCol: '#fff' });
  if (!alive(ep)) return;
  V.bigOut();
  await V.wait(80);
}

/* ============================================================
   メインループ
   ============================================================ */
async function run() {
  const ep = G.epoch;
  while (alive(ep) && G.lives > 0) {
    const r = await round();
    if (r === 'abort') return;
    // 高得点ほど次問への間も短くする
    const gap = G.score < 10 ? 125 : G.score < 30 ? 90 : G.score < 75 ? 60 : 38;
    await V.wait(gap);
  }
  if (alive(ep)) await gameOver(ep);
}

async function gameOver(ep) {
  V.lockControls(true);
  V.hideGhost();
  V.Snd.lose();
  V.FX.hit(22, 420);
  V.FX.flash('#16020a', 420, .78);
  await V.big('GAME OVER', { col: '#ff6578', ms: 600 });
  if (!alive(ep)) return;
  V.bigOut();
  await V.wait(120);
  showResult();
}

function resetGame() {
  G.epoch++;
  cancelPick();
  G.running = true;
  G.busy = false;
  G.score = 0;
  G.lives = 3;
  G.enemyHistory = [];
  G.curHand = null;
  G.stats = { correct: 0, miss: 0, timeout: 0 };
  lastEnemy = null;
  sameEnemyCount = 0;

  document.body.classList.remove('menu');
  $('#a2hs').hidden = true;
  $('#titleScreen').classList.add('hidden');
  $('#resultScreen').classList.add('hidden');
  V.resetPresentation();
  V.setGauge('#clashFill', 0);
  V.setGauge('#yakuFill', 0);
  V.applyStage(0);
  GORO.setMask(3);
  GORO.setPose('idle');
  GORO.setEyeColor('#ffffff');
  V.setDecl('READY');
  updateHud();
}

export function startFight() {
  V.Snd.init();
  resetGame();
  setTimeout(() => run(), 180);
}

export function startTutorial() {
  // ルールが一文で分かるため、別ルールのチュートリアルは作らない。
  // 初回だけ速度を落とすのではなく本番をそのまま体験させる。
  startFight();
}

function toMenu() {
  G.epoch++;
  G.running = false;
  G.busy = false;
  cancelPick();
  V.hideGhost();
  V.clearHands();
  V.resetPresentation();
  V.lockControls(true);
  document.body.classList.add('menu');
}

function showResult() {
  const finalScore = G.score;
  const best = G.best;
  G.running = false;
  V.lockControls(true);
  localStorage.setItem('jr_played', '1');
  $('#resTitle').textContent = 'SCORE';
  $('#resTitle').className = 'logo';
  $('#resTitle').style.color = '#fff';
  const rank = finalScore >= 100 ? 'GOD HAND' : finalScore >= 75 ? 'OVERDRIVE' : finalScore >= 50 ? 'REFLEX' : finalScore >= 30 ? '30 WALL BREAK' : finalScore >= 20 ? 'FOCUS' : 'TRY AGAIN';
  $('#resBody').innerHTML = `<div class="scoreResult">${finalScore}</div><div class="scoreCaption">${rank}<br>BEST ${best}</div>`;
  $('#nextEnemy').hidden = true;
  $('#btnAgain').textContent = 'も う 一 度';
  $('#resultScreen').classList.remove('hidden');
  document.body.classList.add('menu');
}

function showTitle() {
  toMenu();
  $('#resultScreen').classList.add('hidden');
  $('#titleScreen').classList.remove('hidden');
}

/* ============================================================
   iPhone / PWA
   ============================================================ */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOSSafari = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

function setupAddToHomeHint() {
  const el = $('#a2hs');
  if (isStandalone() || localStorage.getItem('jr_a2hs_done') || !isIOSSafari()) return;
  setTimeout(() => { if (!G.running) el.hidden = false; }, 3000);
  $('#a2hsClose').addEventListener('click', () => {
    el.hidden = true;
    localStorage.setItem('jr_a2hs_done', '1');
  });
}

function setupDebugPanel() {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const el = $('#debugPanel');
  el.hidden = false;
  document.body.classList.add('debug');
  const tick = () => {
    el.textContent = `JANKEN RUSH v${BUILD.version} ${isStandalone() ? 'standalone' : 'browser'} ${innerWidth}x${innerHeight}\nscore=${G.score} lives=${G.lives} best=${G.best} limit=${reactionMs(G.score)}ms hand=${G.curHand || '-'} audio=${V.Snd.ctx ? V.Snd.ctx.state : 'none'}`;
  };
  tick();
  setInterval(tick, 400);
}

/* ============================================================
   起動
   ============================================================ */
function boot() {
  document.body.classList.add('menu');
  V.Quality.init();
  V.BG.init();
  V.FX.init();
  V.installViewportHandlers();
  V.applyStage(0);
  GORO.mountGoro($('#goro'));
  GORO.setMask(3);
  GORO.setPose('idle');

  document.querySelectorAll('.hbtn').forEach((b) => {
    b.querySelector('.ic').innerHTML = V.handSVG(b.dataset.h);
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (!G.running || G.busy) return;
      submitPick(b.dataset.h);
    });
  });

  $('#btnTutorial').addEventListener('click', () => { V.Snd.ui(); startFight(); });
  $('#btnFight').addEventListener('click', () => { V.Snd.ui(); startFight(); });
  $('#btnAgain').addEventListener('click', () => { V.Snd.ui(); startFight(); });
  $('#btnTitle').addEventListener('click', () => { V.Snd.ui(); showTitle(); });

  const fxBtn = $('#btnFx');
  const sync = () => { fxBtn.textContent = 'EFFECT ' + (V.Quality.low ? 'LOW' : 'HIGH'); };
  fxBtn.addEventListener('click', () => {
    V.Quality.set(V.Quality.low ? 'high' : 'low');
    V.applyStage(0);
    sync();
    V.Snd.ui();
  });
  sync();

  V.startLoop();
  updateHud();
  showTitle();
  setupAddToHomeHint();
  setupDebugPanel();

  window.JR = {
    build: BUILD,
    G, V, C, GORO,
    startFight, startTutorial, showTitle,
    pick: (h) => submitPick(h),
    canPick: () => !!pickResolver,
    reactionMs,
    state: () => ({ score: G.score, lives: G.lives, best: G.best, running: G.running, busy: G.busy, curHand: G.curHand, limitMs: reactionMs(G.score), stats: { ...G.stats } }),
  };
}

boot();
