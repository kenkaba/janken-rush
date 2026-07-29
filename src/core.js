/* ============================================================
   JANKEN RUSH — CORE
   純ロジック層。DOM / window / 音 に一切触れない。
   勝敗を決めるコードはこのファイルの judge() だけ。
   ============================================================ */

export const HANDS = ['rock', 'scissors', 'paper'];
export const HAND_JP = { rock: 'グー', scissors: 'チョキ', paper: 'パー' };
export const HAND_COLOR = { rock: '#ff2d3f', scissors: '#00d4ff', paper: '#ffb400' };
export const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
export const LOSES_TO = { rock: 'paper', scissors: 'rock', paper: 'scissors' };

/** 唯一の勝敗判定 */
export function judge(playerHand, enemyHand) {
  if (playerHand === enemyHand) return 'draw';
  return BEATS[playerHand] === enemyHand ? 'win' : 'lose';
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
export const ri = (a, b) => Math.floor(rnd(b + 1, a));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function wpick(list) {
  let t = 0; for (const l of list) t += l[1];
  let r = Math.random() * t;
  for (const l of list) { r -= l[1]; if (r <= 0) return l[0]; }
  return list[list.length - 1][0];
}
function sampleDist(d) {
  let r = Math.random();
  for (const h of HANDS) { r -= d[h]; if (r <= 0) return h; }
  return 'rock';
}

/* ============================================================
   バトル定数
   ============================================================ */
export const BATTLE = {
  maskMax: 3,          // 敵の仮面（3回勝てば撃破）
  shieldMax: 3,        // プレイヤーのシールド（3回負けたら敗北）
  clashMax: 2,         // あいこ2回で CLASH RUSH（3回だと完璧に読める人が一度も到達しない）
  rushRounds: 5,       // RUSH の連戦数
  rushTimeMs: 1000,    // RUSH 中の制限時間
  yakumonoMax: 100,
  yakuGainWin: 30,     // 通常勝利
  yakuGainDraw: 20,    // あいこ
  yakuGainRush: 26,    // RUSH中の勝利
};

/* ============================================================
   GORO — 破壊王
   ルール:
   ・言葉（宣言）は間違えることがある
   ・体（目線と拳の溜め）は絶対に嘘をつかない ← プレイヤーが覚えるべき唯一の技術
   ・仮面が壊れるほど speed が上がり、体のヒントが見える時間が短くなる
   ============================================================ */

/** 仮面の残り段階ごとのパラメータ。3=無傷 / 2=ヒビ / 1=覚醒 */
/* ghostDelayMs = 光る手が出るまでの間。段階が進むほど遅く出て短く消えるので、
   「待って、見て、すぐ押す」という緊張が生まれる。 */
export const GORO_PHASES = {
  3: { timeMs: 3000, ghostDelayMs: 0,   ghostMs: 3000, lieRate: 0.00, rockBias: 0.70, label: '' },
  2: { timeMs: 2600, ghostDelayMs: 300, ghostMs: 1400, lieRate: 0.00, rockBias: 0.55, label: 'ヒビ' },
  1: { timeMs: 2200, ghostDelayMs: 700, ghostMs: 750,  lieRate: 0.30, rockBias: 0.45, label: '覚醒' },
};

const DECL = {
  rock:     '次は グー を出す',
  scissors: '次は チョキ を出す',
  paper:    '次は パー を出す',
  same:     'さっきと 同じ手 だ',
  change:   '今度は 手を変える',
  awaken:   '本気で 叩き潰す',
};

/**
 * GORO の1手を組み立てる。
 * @param {number} mask  残り仮面（3/2/1）
 * @param {string|null} lastHand 前回GOROが出した手
 * @param {boolean} rush RUSH中か
 */
export function goroTurn(mask, lastHand, rush = false) {
  const P = GORO_PHASES[clamp(mask, 1, 3)];

  // 実際に出す手（グー寄り）
  const other = (1 - P.rockBias) / 2;
  const hand = sampleDist({ rock: P.rockBias, scissors: other, paper: other });

  // 宣言の作り方
  let declKey, declMatches;
  const r = Math.random();
  if (mask === 1 && r < 0.25) {
    declKey = 'awaken'; declMatches = null;              // 手を明示しない
  } else if (lastHand && r < 0.42 && mask <= 2) {
    // 履歴を見せる宣言。画面の履歴表示と組み合わせて読ませる
    declKey = hand === lastHand ? 'same' : 'change';
    declMatches = true;
  } else {
    // 手を名指しする宣言。覚醒中だけ言い間違える（＝嘘をつく）
    const lie = Math.random() < P.lieRate;
    const named = lie ? pick(HANDS.filter((h) => h !== hand)) : hand;
    declKey = named; declMatches = !lie;
  }

  return {
    hand,
    declText: DECL[declKey],
    declKey,
    declTruthful: declMatches !== false,
    timeMs: rush ? BATTLE.rushTimeMs : P.timeMs,
    ghostDelayMs: rush ? 100 : P.ghostDelayMs,
    ghostMs: rush ? 500 : P.ghostMs,   // 体のヒントが見えている時間
    phaseLabel: P.label,
  };
}

/**
 * 覚醒直後の「受け止める」ターン。
 * どの手を出しても あいこ になる、宣言どおりの公開ルール。
 * 敵の手がプレイヤーの手に依存する唯一の例外なので、
 * 画面にも「どれを出しても あいこ」と明示して隠さない。
 */
export function guardTurn() {
  return {
    hand: null,
    guard: true,
    forceDraw: true,
    declText: 'その手ごと 受け止める',
    coach: 'どれを出しても あいこ',
    timeMs: 1800,
    ghostMs: 0,
    ghostDelayMs: 0,
    declTruthful: true,
  };
}

/* ============================================================
   初回チュートリアル台本（初見60秒）
   GORO の手と宣言を固定し、必ず主要体験を通す。
   force: 'win' のときだけ敵の手をプレイヤーの手から逆算する（SHOWCASE と同じ扱い）。
   ============================================================ */
/* 教えるのは2つだけ。
   1) 光る手に勝つ手を押す
   2) 言葉は間違うことがある。光る手が本当
   これを終えたら通常の戦闘ロジックへ引き渡す。
   仮面2枚 → 覚醒 → 受け止め2回 → CLASH RUSH → 役物 まで自動で流れる。 */
export const TUTORIAL = [
  { hand: 'rock', declText: '俺は グー しか出さない', ghostDelayMs: 0, ghostMs: 20000, timeMs: 6000,
    coach: 'グーに勝つ手を押せ', hint: 'paper', declTruthful: true },
  { hand: 'scissors', declText: '次も グー だ', ghostDelayMs: 0, ghostMs: 20000, timeMs: 5500,
    coach: '言葉より 光る手 を見ろ', hint: 'rock', declTruthful: false },
];

/* ============================================================
   ステージ背景（既存の Canvas 背景基盤をそのまま使う）
   ============================================================ */
export const STAGES = [
  { n: '闘技場',     sky: ['#03050f', '#0b1738', '#1e3b7d'], acc: '#5b8cff', city: '#01020a', rain: 0.55, pil: 0, heat: 0 },
  { n: '亀裂',       sky: ['#12021f', '#42076b', '#b81ec0'], acc: '#ff4dff', city: '#070113', rain: 0.9,  pil: 2, heat: 0.16 },
  { n: '覚醒',       sky: ['#140500', '#5c1f00', '#e0700f'], acc: '#ffb400', city: '#0d0300', rain: 0.35, pil: 4, heat: 0.32 },
  { n: 'CLASH RUSH', sky: ['#18000a', '#63001f', '#e01f5c'], acc: '#ff2d6f', city: '#0d0004', rain: 1.3,  pil: 8, heat: 0.58 },
];
