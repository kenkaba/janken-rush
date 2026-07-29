/* ============================================================
   JANKEN RUSH — BATTLE
   1体の敵を複数回のジャンケンで倒す。
   3回勝てば仮面を砕いて撃破。3回負ければ敗北。
   あいこは CLASH ゲージを溜め、3回で CLASH RUSH。
   役物は自動で落ちない。プレイヤーが下へ引いて落とす。
   ============================================================ */
const Q = new URL(import.meta.url).search;
const C = await import('./core.js' + Q);
const V = await import('./view.js' + Q);
const GORO = await import('./goro.js' + Q);

const $ = V.$;
const BUILD = { version: '0.3.0', at: '2026-07-29' };

/* ============================================================
   状態
   ============================================================ */
const G = {
  mode: 'fight',          // 'fight' | 'tutorial'
  running: false,
  busy: false,
  epoch: 0,
  mask: C.BATTLE.maskMax,
  shield: C.BATTLE.shieldMax,
  clash: 0,
  yaku: 0,
  rushLeft: 0,
  guardTurns: 0,
  finisherReady: false,
  enemyHistory: [],
  stats: { turns: 0, win: 0, lose: 0, draw: 0, timeout: 0 },
};
const alive = (ep) => ep === G.epoch && G.running;
const inRush = () => G.rushLeft > 0;

/* ============================================================
   入力（制限時間つき）
   ============================================================ */
let pickResolver = null;
function submitPick(hand) {
  if (!pickResolver) return false;
  const r = pickResolver; pickResolver = null; r(hand);
  return true;
}
function cancelPick() { if (pickResolver) { const r = pickResolver; pickResolver = null; r(null); } }

/** 手が押されるか時間切れになるまで待つ。返り値 null = 時間切れ */
function awaitPick(ms) {
  return new Promise((resolve) => {
    let left = ms, lastBeep = 99;
    const finish = (v) => { V.removeTicker(tick); pickResolver = null; V.setTimeBar(v === null ? 0 : left / ms); resolve(v); };
    const tick = (dt) => {
      left -= dt;
      const ratio = left / ms;
      V.setTimeBar(ratio);
      const beep = Math.ceil(left / 1000);
      if (beep < lastBeep && beep <= 2 && beep > 0) { lastBeep = beep; V.Snd.tick(2 - beep); }
      if (left <= 0) finish(null);
    };
    pickResolver = finish;
    V.setTimeBar(1);
    V.addTicker(tick);
  });
}

/* ============================================================
   1ターン
   ============================================================ */
async function turn(script) {
  const ep = G.epoch;
  G.stats.turns++;

  // --- 敵の手を確定（プレイヤーが選ぶ前） ---
  const last = G.enemyHistory[G.enemyHistory.length - 1] || null;
  let t = script;
  if (!t) {
    if (G.guardTurns > 0) { G.guardTurns--; t = C.guardTurn(); }
    else t = C.goroTurn(G.mask, last, inRush());
  }

  // --- 宣言 ---
  GORO.setPose('charge');
  V.Snd.declare();
  V.setDecl(t.declText, t.declTruthful === false);
  V.setCoach(t.coach || '');
  V.teachButton(t.hint || null);

  // --- 体は嘘をつかない：光る手と目の色 ---
  const realHand = t.hand;
  G.curHand = realHand;              // 検証用（画面に出ている情報と同じもの）
  G.curDecl = t.declText;
  if (realHand) {
    const delay = t.ghostDelayMs || 0;
    const reveal = () => {
      if (!alive(ep)) return;
      V.showGhost(realHand);
      GORO.setEyeColor(C.HAND_COLOR[realHand]);
      setTimeout(() => { if (alive(ep)) V.hideGhost(); }, t.ghostMs);
    };
    if (delay > 0) setTimeout(reveal, delay); else reveal();
  }

  // --- 選択 ---
  G.busy = false;
  V.lockControls(false);
  const picked = await awaitPick(t.timeMs);
  G.busy = true;
  V.lockControls(true);
  V.hideGhost(); V.setCoach(''); V.teachButton(null);
  if (!alive(ep)) return 'abort';

  if (picked === null) {
    G.stats.timeout++;
    await resolveTimeout(ep);
    return alive(ep) ? 'timeout' : 'abort';
  }

  V.Snd.pick();
  document.querySelector('.hbtn.' + picked)?.classList.add('picked');
  setTimeout(() => document.querySelector('.hbtn.' + picked)?.classList.remove('picked'), 320);

  // --- 決着 ---
  const enemyHand = t.forceDraw ? picked : realHand;
  G.enemyHistory.push(enemyHand);
  V.setHistory(G.enemyHistory);
  const result = C.judge(picked, enemyHand);
  G.stats[result]++;

  GORO.setPose('attack');
  V.showHands(picked, enemyHand, result === 'draw');
  await V.wait(160);
  if (!alive(ep)) return 'abort';

  if (result === 'win') await resolveWin(ep);
  else if (result === 'lose') await resolveLose(ep);
  else await resolveDraw(ep);

  V.clearHands();
  return alive(ep) ? result : 'abort';
}

/* ---------------- 勝ち ---------------- */
async function resolveWin(ep) {
  GORO.setPose('hit');
  V.Snd.crack();
  const mc = GORO.maskCenter();

  // RUSH中は仮面を割らない。純粋に役物を溜める高速連戦にする。
  if (inRush()) {
    addYaku(C.BATTLE.yakuGainRush);
    V.FX.hit(16, 300); V.FX.flash('#ffd45e', 200, .6);
    if (mc) V.FX.burst(mc.x, mc.y, 46, { col: '#ffd45e', smax: 14, smin: 3, szmax: 5, type: 'shard', g: .4 });
    V.buzz(25);
    await V.big('H I T !', { col: '#ffd45e', ms: 300 });
    if (!alive(ep)) return;
    V.bigOut(); await V.wait(60);
    return;
  }

  const idx = G.mask - 1;
  G.mask--;
  addYaku(C.BATTLE.yakuGainWin);
  V.FX.hit(20, 380);
  V.FX.flash('#fff', 220, .75);
  if (mc) {
    V.FX.burst(mc.x, mc.y, 70, { col: '#dfe6f5', smax: 15, smin: 3, szmax: 6, type: 'shard', g: .5 });
    V.FX.ring(mc.x, mc.y, '#ffd45e');
  }
  V.buzz([30, 20, 50]);
  V.breakPip('#maskPips', idx);
  V.setPips('#maskPips', G.mask);
  GORO.setMask(G.mask);

  await V.big('仮 面 破 壊', { col: '#ffd45e', ms: 430 });
  if (!alive(ep)) return;
  V.bigOut();
  if (G.mask === 2) V.applyStage(1);
  if (G.mask === 1) { V.applyStage(2); await goroAwaken(ep); }
  await V.wait(90);
}

/* ---------------- 負け：シールドが割れる ---------------- */
async function resolveLose(ep) {
  const idx = G.shield - 1;
  G.shield--;
  V.Snd.guardBreak();
  V.FX.hit(24, 420);
  V.FX.flash('#ff2d3f', 380, .6);
  V.FX.burst(V.cx(), V.cy() * 1.35, 60, { col: '#6fd8ff', smax: 13, smin: 3, szmax: 5, type: 'shard', g: .4 });
  V.buzz([80, 50, 120]);
  V.breakPip('#shieldPips', idx);
  V.setPips('#shieldPips', G.shield);
  await V.big('G U A R D\nB R E A K', { col: '#8fd8ff', ms: 480 });
  if (!alive(ep)) return;
  V.bigOut(); await V.wait(90);
}

/* ---------------- 時間切れ ---------------- */
async function resolveTimeout(ep) {
  if (inRush()) {           // RUSH中はこちらが損をしない
    await V.big('ミ ス', { col: '#8fa4d8', ms: 300 }); V.bigOut(); return;
  }
  const idx = G.shield - 1;
  G.shield--;
  V.Snd.guardBreak(); V.FX.hit(18, 340); V.FX.flash('#ff2d3f', 320, .5);
  V.breakPip('#shieldPips', idx); V.setPips('#shieldPips', G.shield);
  await V.big('出 遅 れ', { col: '#ff6b6b', ms: 460 });
  if (!alive(ep)) return;
  V.bigOut(); await V.wait(90);
}

/* ---------------- あいこ：CLASH ---------------- */
async function resolveDraw(ep) {
  G.clash = Math.min(C.BATTLE.clashMax, G.clash + 1);
  addYaku(C.BATTLE.yakuGainDraw);
  V.setGauge('#clashFill', (G.clash / C.BATTLE.clashMax) * 100);

  // 中央で激突 → 一瞬停止 → 火花
  V.Snd.clash();
  V.FX.hit(16, 300);
  V.FX.flash('#7cd4ff', 200, .55);
  V.FX.burst(V.cx(), V.cy() * .92, 90, { col: '#eaf7ff', smax: 18, smin: 4, szmax: 5, type: 'shard', g: 0 });
  V.FX.ring(V.cx(), V.cy() * .92, '#7cd4ff');
  V.buzz(30);
  V.BG.frozen = true;
  await V.wait(130);
  V.BG.frozen = false;
  if (!alive(ep)) return;
  await V.big('C L A S H !', { col: '#7cd4ff', ms: 380 });
  if (!alive(ep)) return;
  V.bigOut(); await V.wait(80);
}

function addYaku(n) {
  G.yaku = Math.min(C.BATTLE.yakumonoMax, G.yaku + n);
  V.setGauge('#yakuFill', G.yaku);
  if (G.yaku >= C.BATTLE.yakumonoMax) G.finisherReady = true;
}

/** 役物で仮面を1枚砕く。落とすのはプレイヤー自身。 */
async function yakumonoStrike(ep) {
  G.finisherReady = false;
  await finisher(ep);
  if (!alive(ep)) return;
  const idx = G.mask - 1;
  G.mask--;
  V.breakPip('#maskPips', idx);
  V.setPips('#maskPips', G.mask);
  GORO.setMask(G.mask);
  G.yaku = 0; V.setGauge('#yakuFill', 0);
}

/* ---------------- GORO 覚醒 ---------------- */
async function goroAwaken(ep) {
  GORO.setPose('roar');
  V.Snd.roar();
  V.FX.hit(28, 620); V.FX.flash('#ff3b1a', 460, .8);
  V.FX.burst(V.cx(), V.cy() * .85, 130, { col: '#ff5a2a', smax: 17, smin: 3, szmax: 7, g: -.1 });
  V.buzz([60, 40, 90]);
  await V.big('覚 醒', { col: '#ff5a2a', ms: 800, sub: '言葉が あてにならなくなる', subCol: '#ffb3a0' });
  if (!alive(ep)) return;
  V.bigOut(); await V.wait(150);
  GORO.setPose('idle');
  // 覚醒直後は必ず2回受け止めてくる → あいこ2回 → 全員が CLASH RUSH を見る
  G.guardTurns = 2;
}

/* ============================================================
   CLASH RUSH
   RUSH中はこちらが負けてもシールドが減らない。純粋なご褒美。
   ============================================================ */
async function enterRush(ep) {
  G.clash = 0;
  V.setGauge('#clashFill', 0);
  G.rushLeft = C.BATTLE.rushRounds;
  V.applyStage(3);
  await V.fxRushBanner();
  if (!alive(ep)) return;
}

/* ============================================================
   役物：自分で落とす
   ============================================================ */
function awaitSwipeDown() {
  return new Promise((resolve) => {
    const el = $('#finisher');
    let y0 = null, done = false;
    const yOf = (e) => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(auto);
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('touchstart', down); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      resolve();
    };
    const down = (e) => { y0 = yOf(e); };
    const move = (e) => {
      if (y0 === null) return;
      if (yOf(e) - y0 > 60) finish();
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { y0 = null; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    // 保険：スワイプが分からない人を詰ませない
    const auto = setTimeout(finish, 4200);
    window.__jrSwipe = finish;                  // 検証用
  });
}

async function finisher(ep) {
  V.lockControls(true);
  V.setDecl('—');
  await V.fxFreezeFlash(700);
  if (!alive(ep)) return;
  $('#finisher').hidden = false;
  V.Snd.confirm();
  await awaitSwipeDown();
  $('#finisher').hidden = true;
  if (!alive(ep)) return;
  await V.fxYakumonoDrop();
  if (!alive(ep)) return;
  GORO.setMask(0);
  GORO.setPose('hit');
  await V.wait(240);
}

/* ============================================================
   バトル進行
   ============================================================ */
async function runBattle() {
  const ep = G.epoch;
  for (;;) {
    if (!alive(ep)) return;

    if (inRush()) {
      // 減算はターンの後。先に減らすと最終ラウンドが「RUSH中ではない」と判定され、
      // 役物を待たずに仮面を割ってしまう。
      V.setCoach(G.mode === 'tutorial' ? '光る手を見ろ' : '');
      const r = await turn();
      if (r === 'abort') return;
      G.rushLeft--;
      if (G.rushLeft <= 0) {
        V.setCoach('');
        V.applyStage(G.mask >= 3 ? 0 : G.mask === 2 ? 1 : 2);
      }
    } else {
      const r = await turn();
      if (r === 'abort') return;
      if (G.clash >= C.BATTLE.clashMax) { await enterRush(ep); if (!alive(ep)) return; }
    }

    // 役物が完成していたら、RUSHが終わってから自分の手で落とさせる
    if (!inRush() && G.finisherReady && G.mask > 0 && G.shield > 0) {
      await yakumonoStrike(ep);
      if (!alive(ep)) return;
    }

    if (G.mask <= 0) { await victory(ep); return; }
    if (G.shield <= 0) { await defeat(ep); return; }
  }
}

async function victory(ep) {
  GORO.setMask(0);
  V.FX.hit(26, 520); V.Snd.impact();
  await V.wait(260);
  if (!alive(ep)) return;
  V.Snd.win();
  V.FX.rainbowBurst(V.cx(), V.cy() * .9, 170);
  V.FX.flash('#fff', 460, .95);
  await V.big('撃 破', { rb: true, ms: 900 });
  if (!alive(ep)) return;
  V.bigOut();
  await V.wait(260);
  endScreen(true);
}

async function defeat(ep) {
  GORO.setPose('roar');
  V.Snd.lose(); V.FX.hit(24, 520); V.FX.flash('#2a0a12', 520, .8);
  await V.big('敗 北', { col: '#8fa4d8', ms: 900 });
  if (!alive(ep)) return;
  V.bigOut(); await V.wait(240);
  endScreen(false);
}

/* ============================================================
   初回チュートリアル（60秒で全部見せる）
   ============================================================ */
async function runTutorial() {
  const ep = G.epoch;
  // 登場
  GORO.setPose('roar'); V.Snd.roar();
  V.FX.hit(20, 500); V.FX.flash('#ff3b1a', 420, .6);
  await V.big('破 壊 王\nG O R O', { col: '#ff6b4a', ms: 1100 });
  if (!alive(ep)) return;
  V.bigOut(); GORO.setPose('idle'); await V.wait(200);
  if (!alive(ep)) return;

  // --- 教える2ターン。仮面が2枚割れ、覚醒まで到達する ---
  for (let i = 0; i < C.TUTORIAL.length; i++) {
    if (!alive(ep)) return;
    const r = await turn(C.TUTORIAL[i]);
    if (r === 'abort') return;
    if (r !== 'win') {
      // 教える場面なのでやり直させる。シールドは減らさない。
      if (G.shield < C.BATTLE.shieldMax) { G.shield++; V.setPips('#shieldPips', G.shield); }
      i--;
      continue;
    }
  }
  if (!alive(ep)) return;

  // --- ここから先は通常の戦闘ロジックへ引き渡す ---
  // 覚醒で guardTurns=2 が入っているので、受け止め2回 → CLASH RUSH → 役物 と自動で流れる
  await runBattle();
}

/* ============================================================
   画面
   ============================================================ */
function hardReset(mode) {
  G.epoch++;
  cancelPick();
  G.mode = mode; G.running = true; G.busy = false;
  G.mask = C.BATTLE.maskMax; G.shield = C.BATTLE.shieldMax;
  G.clash = 0; G.yaku = 0; G.rushLeft = 0; G.guardTurns = 0; G.finisherReady = false;
  G.enemyHistory = [];
  G.stats = { turns: 0, win: 0, lose: 0, draw: 0, timeout: 0 };

  document.body.classList.remove('menu');
  $('#a2hs').hidden = true;
  V.resetPresentation();
  V.setPips('#maskPips', G.mask); V.setPips('#shieldPips', G.shield);
  V.setGauge('#clashFill', 0); V.setGauge('#yakuFill', 0);
  V.applyStage(0);
  GORO.setMask(3); GORO.setPose('idle'); GORO.setEyeColor('#ff6a3d');
  $('#titleScreen').classList.add('hidden');
  $('#resultScreen').classList.add('hidden');
  $('#enemyName').textContent = 'GORO';
}

export function startFight() { V.Snd.init(); hardReset('fight'); runBattle(); }
export function startTutorial() { V.Snd.init(); hardReset('tutorial'); runTutorial(); }

function toMenu() {
  G.epoch++; G.running = false; G.busy = false;
  G.rushLeft = 0; G.clash = 0; G.guardTurns = 0; G.finisherReady = false;
  cancelPick();
  V.resetPresentation();
  V.lockControls(true);
  document.body.classList.add('menu');
}

function endScreen(won) {
  const mode = G.mode;
  toMenu();
  localStorage.setItem('jr_played', '1');
  $('#resTitle').textContent = won ? '撃 破' : '敗 北';
  $('#resTitle').className = 'logo' + (won ? ' rbText' : '');
  if (!won) $('#resTitle').style.color = '#8fa4d8';
  else $('#resTitle').style.color = '';
  const s = G.stats;
  $('#resBody').innerHTML = won
    ? `GORO の仮面を砕いた。<br>勝 ${s.win} ／ あいこ ${s.draw} ／ 被弾 ${s.lose + s.timeout}`
    : `シールドが尽きた。<br><b>光る手</b> を見れば必ず勝てる。`;
  $('#nextEnemy').hidden = !won;
  $('#btnAgain').textContent = won ? 'も う 一 度' : 'も う 一 度 戦 う';
  if (mode === 'tutorial' && won) $('#resBody').innerHTML += '<br>次は 制限時間つきの本番。';
  $('#resultScreen').classList.remove('hidden');
}

function showTitle() {
  toMenu();
  $('#resultScreen').classList.add('hidden');
  $('#titleScreen').classList.remove('hidden');
}

/* ============================================================
   iPhone 周辺
   ============================================================ */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOSSafari = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

function setupAddToHomeHint() {
  const el = $('#a2hs');
  if (isStandalone() || localStorage.getItem('jr_a2hs_done') || !isIOSSafari()) return;
  setTimeout(() => { if (!G.running) el.hidden = false; }, 3000);
  $('#a2hsClose').addEventListener('click', () => {
    el.hidden = true; localStorage.setItem('jr_a2hs_done', '1');
  });
}
function setupDebugPanel() {
  if (new URLSearchParams(location.search).get('debug') !== '1') return;
  const el = $('#debugPanel');
  el.hidden = false; document.body.classList.add('debug');
  const tick = () => {
    el.textContent =
      `JANKEN RUSH v${BUILD.version} (${BUILD.at}) loop=${V.LoopInfo.mode}\n` +
      `${isStandalone() ? 'standalone' : 'browser'} ${innerWidth}x${innerHeight} dpr=${devicePixelRatio}\n` +
      `audio=${V.Snd.ctx ? V.Snd.ctx.state : 'none'} fx=${V.Quality.low ? 'LOW' : 'HIGH'} vib=${navigator.vibrate ? 'y' : 'n'}\n` +
      `mode=${G.mode} mask=${G.mask} shield=${G.shield} clash=${G.clash} yaku=${G.yaku} rush=${G.rushLeft}\n` +
      `turns=${G.stats.turns} W${G.stats.win} L${G.stats.lose} D${G.stats.draw} TO${G.stats.timeout} p=${V.FX.ps.length}`;
  };
  tick(); setInterval(tick, 400);
}

/* ============================================================
   起動
   ============================================================ */
function boot() {
  document.body.classList.add('menu');
  V.Quality.init();
  V.BG.init(); V.FX.init(); V.installViewportHandlers();
  V.applyStage(0);
  GORO.mountGoro($('#goro'));
  GORO.setMask(3); GORO.setPose('idle');

  document.querySelectorAll('.hbtn').forEach((b) => {
    b.querySelector('.ic').innerHTML = V.handSVG(b.dataset.h);
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (!G.running || G.busy) return;
      submitPick(b.dataset.h);
    });
  });

  $('#btnTutorial').addEventListener('click', () => { V.Snd.ui(); startTutorial(); });
  $('#btnFight').addEventListener('click', () => { V.Snd.ui(); startFight(); });
  $('#btnAgain').addEventListener('click', () => { V.Snd.ui(); startFight(); });
  $('#btnTitle').addEventListener('click', () => { V.Snd.ui(); showTitle(); });

  const fxBtn = $('#btnFx');
  const sync = () => { fxBtn.textContent = 'EFFECT ' + (V.Quality.low ? 'LOW' : 'HIGH'); };
  fxBtn.addEventListener('click', () => { V.Quality.set(V.Quality.low ? 'high' : 'low'); V.applyStage(0); sync(); V.Snd.ui(); });
  sync();

  // 初めての人はチュートリアルを勧める
  if (localStorage.getItem('jr_played')) {
    $('#btnTutorial').classList.remove('cta'); $('#btnTutorial').classList.add('btn2');
    $('#btnFight').classList.remove('btn2'); $('#btnFight').classList.add('cta');
  }

  V.startLoop();
  showTitle();
  setupAddToHomeHint();
  setupDebugPanel();

  window.JR = {
    build: BUILD, G, V, C, GORO,
    startFight, startTutorial, showTitle,
    pick: (h) => submitPick(h),
    canPick: () => !!pickResolver,
    swipe: () => { if (window.__jrSwipe) window.__jrSwipe(); },
    setSpeed: V.setSpeed,
    state: () => ({ mode: G.mode, running: G.running, busy: G.busy, mask: G.mask, shield: G.shield,
      clash: G.clash, yaku: G.yaku, rush: G.rushLeft, epoch: G.epoch, awaiting: !!pickResolver,
      curHand: G.curHand, curDecl: G.curDecl, stats: { ...G.stats } }),
    residue: () => ({
      flash: +getComputedStyle($('#tintFlash')).opacity,
      ghost: $('#ghostHand').classList.contains('on'),
      hands: $('#handP').classList.contains('in') || $('#handE').classList.contains('in'),
      big: $('#bigText').textContent,
      finisher: !$('#finisher').hidden,
      yakumono: $('#yakumono').classList.contains('drop'),
      freeze: $('#freeze').classList.contains('on'),
      rush: $('#rushBanner').classList.contains('on'),
      shake: $('#app').style.transform,
      coach: $('#coach').classList.contains('on'),
      particles: V.FX.ps.length,
      dom: document.getElementsByTagName('*').length,
    }),
  };
}

boot();
