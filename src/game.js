/* ============================================================
   JANKEN RUSH — GAME
   状態機械とモード制御。core(判定) と view(演出) を繋ぐだけ。
   ここでも勝敗は judge() の返り値をそのまま使い、書き換えない。
   ============================================================ */
// boot.js が付けた ?v= を子モジュールへ伝播させ、キャッシュのズレを防ぐ
const Q = new URL(import.meta.url).search;
const {
  ARCHETYPES, ARCHETYPE_LIST, EnemyAI, judge, pick,
  STAGES, STAGE_THRESHOLDS, stageIndexFor, TIERS, chainStep,
  planPresentation, planForeshadow, SHOWCASE_SCRIPT, showcaseEnemyHand,
} = await import('./core.js' + Q);
const V = await import('./view.js' + Q);

const $ = V.$;

/* ============================================================
   ゲーム状態（演出状態は view 側が持つ。ここには混ぜない）
   ============================================================ */
const G = {
  mode: 'fair',          // 'fair' | 'showcase' | 'training'
  running: false,
  busy: false,
  epoch: 0,              // 再スタートで加算。進行中の非同期処理を無効化する
  streak: 0,
  best: +(localStorage.getItem('jr_best') || 0),
  ai: null,
  arch: null,
  enemyHp: 3,
  history: [],           // プレイヤーの手の履歴（敵AIの入力）
  chain: 0,
  scriptIdx: 0,
  stageIdx: 0,
  stats: { rounds: 0, win: 0, lose: 0, draw: 0, revives: 0, defeats: 0 },
};

const alive = (ep) => ep === G.epoch && G.running;

/* ---------------- 入力 ---------------- */
let pickResolver = null;
function awaitPick() {
  return new Promise((r) => { pickResolver = r; });
}
function submitPick(hand) {
  if (!pickResolver) return false;          // 演出中の入力は確実に捨てる
  const r = pickResolver; pickResolver = null;
  r(hand);
  return true;
}
function cancelPick() {
  if (pickResolver) { const r = pickResolver; pickResolver = null; r(null); }
}

/* ============================================================
   ラウンド進行
   ============================================================ */
async function runRound() {
  const ep = G.epoch;
  G.chain = 0;
  V.setChainPips(0);

  for (;;) {
    // --- 1. 敵の手をここで確定する。以後この値は変わらない ---
    const turn = G.ai.beginTurn(G.history);
    V.showTurnTells(turn);

    // --- 2. 先読み（結果は未確定。敵の状態だけから決める） ---
    const fore = planForeshadow(turn);
    V.setEnemyEyes(fore.on ? TIERS[fore.tier].col : '#ffffff', fore.on);
    V.setTension(fore.on ? Math.min(fore.tier, 3) : 0);
    if (fore.on) { V.Snd.tone({ f: 660, f2: 1200, d: 0.5, type: 'sine', v: 0.14 }); V.FX.ring(V.cx(), V.cy() * 0.86, TIERS[fore.tier].col); }

    if (G.mode === 'training') V.showPreview(turn.hand);

    // --- 3. プレイヤーの手を待つ ---
    G.busy = false;
    V.lockControls(false);
    const playerHand = await awaitPick();
    if (!alive(ep) || !playerHand) return;
    G.busy = true;
    V.lockControls(true);
    V.clearPreview();
    V.Snd.lock(); V.buzz(12);
    V.FX.burst(V.cx(), (innerHeight || 812) * 0.88, 26, { col: '#ffffff', smax: 9, smin: 2, szmax: 4 });

    G.history.push(playerHand);
    if (G.history.length > 40) G.history.shift();

    // --- 4. 判定。SHOWCASE のときだけ台本が敵の手を差し替える ---
    const script = G.mode === 'showcase' ? SHOWCASE_SCRIPT[G.scriptIdx] : null;
    const enemyHand = script ? showcaseEnemyHand(playerHand, script.force) : turn.hand;
    const result = judge(playerHand, enemyHand);
    G.stats.rounds++; G.stats[result]++;

    // --- 5. 演出プラン（結果を受け取るだけ。書き換えない） ---
    const plan = script
      ? { tier: script.tier, route: script.route.slice(), revive: !!script.revive, isPremiumRoute: script.tier >= 4 }
      : planPresentation({ result, chain: G.chain, premium: turn.premium, streak: G.streak });
    if (script) G.scriptIdx++;

    V.setTension(plan.tier); V.setAura(plan.tier);

    // --- 6. カウントダウン。あいこ継続中は短く刻む ---
    if (G.chain === 0) { await V.fxCountdown(plan.tier); if (!alive(ep)) return; }
    else { V.Snd.tick(2, plan.tier); await V.wait(220); if (!alive(ep)) return; }

    if (plan.route.includes('yakumono')) { await V.fxYakumono(); if (!alive(ep)) return; }
    if (plan.route.includes('cutin')) {
      await V.fxCutin(result === 'lose' ? '見 切 り' : '神 手', TIERS[plan.tier].col);
      if (!alive(ep)) return;
    }
    if (plan.route.includes('freeze')) { await V.fxFreeze(); if (!alive(ep)) return; }

    // --- 7. 開示 ---
    V.showHand('#handP', playerHand);
    V.showHand('#handE', enemyHand);
    $('#vsMark').classList.add('show');
    V.Snd.impact(); V.FX.hit(18, 320); V.buzz(20);
    V.FX.burst((innerWidth || 375) * 0.24, (innerHeight || 812) * 0.74, 40, { col: '#ffffff', smax: 12, smin: 2 });
    await V.wait(400);
    if (!alive(ep)) return;

    // セリフが本当だったかを、結果が出た後に正直に表示する
    if (G.mode !== 'showcase') {
      V.markTellResult(turn.tellWasHonest);
      if (turn.tellWasHonest) V.Snd.read(); else V.Snd.miss();
    }
    G.ai.noteResult(result);

    // --- 8. あいこなら擬似連へ。テンポは段階で変える ---
    if (result === 'draw') {
      G.chain++;
      V.setChainPips(G.chain);
      await V.fxChain(chainStep(G.chain - 1), G.chain - 1);
      if (!alive(ep)) return;
      V.clearHands(); V.clearAura();
      await V.wait(100);
      if (!alive(ep)) return;
      continue;
    }

    if (result === 'win') { await resolveWin(ep, plan); return; }
    await resolveLose(ep, plan);
    return;
  }
}

async function resolveWin(ep, plan) {
  G.streak++;
  V.setStreak(G.streak, true);
  V.Snd.win(G.streak);
  V.FX.flash(plan.tier >= 4 ? '#fff' : '#ffd45e', 300, plan.tier >= 4 ? 0.9 : 0.55);
  V.FX.hit(14 + plan.tier * 3, 380);
  if (plan.tier >= 5) V.FX.rainbowBurst(V.cx(), V.cy(), 160);
  else V.FX.burst(V.cx(), V.cy(), 80, { col: TIERS[plan.tier].col, smax: 14, smin: 3, szmax: 6 });
  V.buzz([30, 20, 50]);

  const stName = STAGES[stageIndexFor(G.streak, thresholdMode())].n;
  await V.big('YOU\nWIN!', { rb: plan.tier >= 5, col: '#ffd45e', ms: 780, sub: G.streak + ' 連 勝', subCol: '#ffd45e' });
  if (!alive(ep)) return;
  V.bigOut(); V.clearHands(); V.clearAura(); V.setTension(0); V.setChainPips(0);
  await V.wait(180);
  if (!alive(ep)) return;

  await checkStageUp(ep);
  if (!alive(ep)) return;

  G.enemyHp--;
  if (G.enemyHp <= 0) {
    G.stats.defeats++;
    await V.fxDefeat(G.arch.c);
    if (!alive(ep)) return;
    nextEnemy();
  }
  void stName;
  nextTurn(ep);
}

async function resolveLose(ep, plan) {
  V.Snd.lose(); V.FX.hit(20, 460); V.FX.flash('#3a4d80', 420, 0.6); V.buzz([80, 60, 140]);
  await V.big('L O S E', { col: '#b9c8ee', ms: plan.revive ? 620 : 860 });
  if (!alive(ep)) return;
  V.bigOut();
  await V.wait(180);
  if (!alive(ep)) return;

  if (plan.revive) {
    // 復活はジャンケンの結果を覆さない。連勝記録だけを救済する独立ルール。
    G.stats.revives++;
    await V.fxRevive();
    if (!alive(ep)) return;
    V.clearHands(); V.clearAura(); V.setTension(0); V.setChainPips(0);
    await V.wait(120);
    if (!alive(ep)) return;
    nextTurn(ep);
    return;
  }

  V.clearHands(); V.clearAura(); V.setTension(0); V.setChainPips(0);
  await V.wait(200);
  if (!alive(ep)) return;

  // 訓練戦は練習なので、負けても終わらせない
  if (G.mode === 'training') { nextTurn(ep); return; }

  gameOver();
}

function thresholdMode() { return G.mode === 'showcase' ? 'showcase' : 'fair'; }

async function checkStageUp(ep) {
  const idx = stageIndexFor(G.streak, thresholdMode());
  if (idx === G.stageIdx) return;
  G.stageIdx = idx;
  V.applyStageVisual(idx);
  await V.fxStageUp(idx);
  if (!alive(ep)) return;
}

function nextEnemy() {
  const others = ARCHETYPE_LIST.filter((a) => a !== G.arch);
  G.arch = pick(others.length ? others : ARCHETYPE_LIST);
  G.ai = new EnemyAI(G.arch.key);
  G.enemyHp = 3;
  V.showEnemyIdentity(G.arch);
  refreshHp();
}
function refreshHp() {
  document.querySelectorAll('#enemyHp i').forEach((el, i) => el.classList.toggle('on', i < G.enemyHp));
}

/* 次のラウンドへ。訓練戦はここで終了判定する。 */
function nextTurn(ep) {
  if (!alive(ep)) return;
  refreshHp();
  // 訓練は「決着2回」で終わる。あいこは回数に数えない。
  if (G.mode === 'training' && G.stats.win + G.stats.lose >= 2) { finishTraining(); return; }
  if (G.mode === 'showcase' && G.scriptIdx >= SHOWCASE_SCRIPT.length) { finishShowcase(); return; }
  runRound();
}

/* ============================================================
   モード開始 / 終了
   ============================================================ */
function hardReset(mode) {
  G.epoch++;
  cancelPick();
  G.mode = mode;
  G.running = true;
  G.busy = false;
  G.streak = 0;
  G.chain = 0;
  G.scriptIdx = 0;
  G.stageIdx = 0;
  G.history = [];
  G.stats = { rounds: 0, win: 0, lose: 0, draw: 0, revives: 0, defeats: 0 };
  G.arch = mode === 'training' ? ARCHETYPES.gori : pick(ARCHETYPE_LIST);
  G.ai = new EnemyAI(G.arch.key);
  G.enemyHp = 3;

  document.body.classList.remove('menu');
  V.resetPresentation();
  V.setStreak(0, false);
  V.setBest(G.best);
  V.setModeBadge(mode);
  V.showEnemyIdentity(G.arch);
  refreshHp();
  V.applyStageVisual(0);
  $('#titleScreen').classList.add('hidden');
  $('#resultScreen').classList.add('hidden');
  $('#showcaseEnd').classList.add('hidden');
}

export function startFair() { V.Snd.init(); hardReset('fair'); runRound(); }
export function startShowcase() { V.Snd.init(); hardReset('showcase'); runRound(); }
export function startTraining() { V.Snd.init(); hardReset('training'); runRound(); }

function toMenu() {
  G.epoch++;
  G.running = false;
  G.busy = false;
  G.chain = 0;              // あいこカウンタを次戦へ持ち越さない
  cancelPick();
  V.resetPresentation();
  V.lockControls(true);
  document.body.classList.add('menu');
}

function gameOver() {
  const streak = G.streak;
  toMenu();
  if (G.mode === 'fair' && streak > G.best) {
    G.best = streak;
    localStorage.setItem('jr_best', String(G.best));
  }
  $('#rStreak').textContent = streak;
  $('#rBest').textContent = G.best;
  V.setBest(G.best);

  const th = STAGE_THRESHOLDS.fair;
  const next = th.find((t) => t > streak);
  let msg;
  if (next !== undefined) {
    const d = next - streak;
    const nm = STAGES[th.indexOf(next)].n;
    msg = d <= 1 ? `あと ${d} 連勝で「${nm}」だった。` : `次は「${nm}」まで あと ${d} 連勝。`;
  } else msg = '最上位ステージ到達。まだ上を目指せる。';
  if (streak > 0 && streak === G.best) msg = '自己ベスト更新！　' + msg;
  $('#regret').textContent = msg;
  $('#resultDetail').textContent =
    `勝 ${G.stats.win} ／ あいこ ${G.stats.draw} ／ 負 ${G.stats.lose}` +
    (G.stats.revives ? `　復活 ${G.stats.revives}` : '');
  $('#resultScreen').classList.remove('hidden');
}

function finishTraining() {
  toMenu();
  localStorage.setItem('jr_trained', '1');
  $('#showcaseEndTitle').textContent = '訓練終了';
  $('#showcaseEndBody').textContent =
    'ここからは公平な勝負。相手の手は見えないが、セリフと構えに癖が出る。';
  $('#showcaseEnd').classList.remove('hidden');
}
function finishShowcase() {
  toMenu();
  $('#showcaseEndTitle').textContent = 'SHOWCASE 終了';
  $('#showcaseEndBody').textContent =
    'これは演出デモ（勝敗が台本で決まっている）。戦績には残らない。次は公平な本番で。';
  $('#showcaseEnd').classList.remove('hidden');
}

/* ============================================================
   起動
   ============================================================ */
function boot() {
  document.body.classList.add('menu');
  V.Quality.init();
  V.BG.init(); V.FX.init();
  V.applyStageVisual(0);
  V.showEnemyIdentity(pick(ARCHETYPE_LIST));
  V.setBest(G.best);
  V.startLoop();

  // 手ボタン（リスナーは起動時に1度だけ張る）
  document.querySelectorAll('.hbtn').forEach((b) => {
    b.querySelector('.ic').innerHTML = V.handSVG(b.dataset.h);
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (!G.running || G.busy) return;
      submitPick(b.dataset.h);
    });
  });

  $('#btnFair').addEventListener('click', () => { V.Snd.ui(); startFair(); });
  $('#btnShowcase').addEventListener('click', () => { V.Snd.ui(); startShowcase(); });
  $('#btnTraining').addEventListener('click', () => { V.Snd.ui(); startTraining(); });
  $('#retryBtn').addEventListener('click', () => { V.Snd.ui(); startFair(); });
  $('#backTitle').addEventListener('click', () => { V.Snd.ui(); showTitle(); });
  $('#showcaseEndBtn').addEventListener('click', () => { V.Snd.ui(); startFair(); });
  $('#showcaseEndBack').addEventListener('click', () => { V.Snd.ui(); showTitle(); });

  const fxBtn = $('#btnFx');
  const syncFx = () => { fxBtn.textContent = 'EFFECT ' + (V.Quality.low ? 'LOW' : 'HIGH'); };
  fxBtn.addEventListener('click', () => {
    V.Quality.set(V.Quality.low ? 'high' : 'low');
    V.applyStageVisual(G.stageIdx);
    syncFx(); V.Snd.ui();
  });
  syncFx();

  // 初回は訓練戦を勧める
  if (!localStorage.getItem('jr_trained')) $('#btnTraining').classList.add('suggest');

  showTitle();
  exposeDebugApi();
}

function showTitle() {
  toMenu();
  $('#resultScreen').classList.add('hidden');
  $('#showcaseEnd').classList.add('hidden');
  $('#titleScreen').classList.remove('hidden');
}

/* ============================================================
   検証用API（テストとチューニング専用。ゲーム進行には使わない）
   ============================================================ */
function exposeDebugApi() {
  window.JR = {
    build: 'v0.2.1-fair',
    G, V,
    startFair, startShowcase, startTraining, showTitle,
    pick: (h) => submitPick(h),
    canPick: () => !!pickResolver,
    setSpeed: V.setSpeed,
    state: () => ({
      mode: G.mode, running: G.running, busy: G.busy, streak: G.streak,
      best: G.best, chain: G.chain, stageIdx: G.stageIdx, epoch: G.epoch,
      enemy: G.arch && G.arch.key, hp: G.enemyHp, stats: { ...G.stats },
      awaitingPick: !!pickResolver,
    }),
    residue: () => ({
      flashOpacity: +getComputedStyle($('#tintFlash')).opacity,
      scrim: $('#battleScrim').classList.contains('on'),
      battling: document.body.classList.contains('battling'),
      handP: $('#handP').classList.contains('show'),
      handE: $('#handE').classList.contains('show'),
      cutin: $('#cutin').classList.contains('on'),
      freeze: $('#freeze').classList.contains('on'),
      stageUp: $('#stageUp').classList.contains('on'),
      yakumono: $('#yakumono').classList.contains('drop'),
      bigText: $('#bigText').textContent,
      aura: $('#foreAura').classList.contains('on'),
      appTransform: $('#app').style.transform,
      particles: V.FX.ps.length,
      domNodes: document.getElementsByTagName('*').length,
      loop: V.LoopInfo.mode,
    }),
  };
}

boot();
