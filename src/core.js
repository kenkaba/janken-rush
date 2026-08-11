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
  maskMax: 3,
  shieldMax: 3,
  clashMax: 2,
  rushRounds: 5,
  rushTimeMs: 1000,
  yakumonoMax: 100,
  yakuGainWin: 30,
  yakuGainDraw: 20,
  yakuGainRush: 26,
};

/* ============================================================
   GORO — 破壊王
   ルール:
   ・言葉（宣言）は間違えることがある
   ・体（目線と拳の溜め）は絶対に嘘をつかない
   ・仮面が壊れるほど speed が上がり、体のヒントが見える時間が短くなる
   ============================================================ */

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

export function goroTurn(mask, lastHand, rush = false) {
  const P = GORO_PHASES[clamp(mask, 1, 3)];
  const other = (1 - P.rockBias) / 2;
  const hand = sampleDist({ rock: P.rockBias, scissors: other, paper: other });

  let declKey, declMatches;
  const r = Math.random();
  if (mask === 1 && r < 0.25) {
    declKey = 'awaken'; declMatches = null;
  } else if (lastHand && r < 0.42 && mask <= 2) {
    declKey = hand === lastHand ? 'same' : 'change';
    declMatches = true;
  } else {
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
    ghostMs: rush ? 500 : P.ghostMs,
    phaseLabel: P.label,
  };
}

/**
 * 旧「受け止める」特殊ターンは廃止。
 * プレイヤーが困らないよう、どのターンでも必ず実在する手を出し、
 * その手を画面上で見せる。覚醒直後も通常のジャンケンとして成立させる。
 */
export function guardTurn() {
  const hand = pick(HANDS);
  return {
    hand,
    guard: false,
    forceDraw: false,
    declText: `次は ${HAND_JP[hand]} を出す`,
    coach: '',
    timeMs: 2000,
    ghostMs: 2000,
    ghostDelayMs: 0,
    declTruthful: true,
  };
}

export const TUTORIAL = [
  { hand: 'rock', declText: '俺は グー しか出さない', ghostDelayMs: 0, ghostMs: 20000, timeMs: 6000,
    coach: 'グーに勝つ手を押せ', hint: 'paper', declTruthful: true },
  { hand: 'scissors', declText: '次も グー だ', ghostDelayMs: 0, ghostMs: 20000, timeMs: 5500,
    coach: '言葉より 光る手 を見ろ', hint: 'rock', declTruthful: false },
];

export const STAGES = [
  { n: '闘技場',     sky: ['#03050f', '#0b1738', '#1e3b7d'], acc: '#5b8cff', city: '#01020a', rain: 0.55, pil: 0, heat: 0 },
  { n: '亀裂',       sky: ['#12021f', '#42076b', '#b81ec0'], acc: '#ff4dff', city: '#070113', rain: 0.9,  pil: 2, heat: 0.16 },
  { n: '覚醒',       sky: ['#140500', '#5c1f00', '#e0700f'], acc: '#ffb400', city: '#0d0300', rain: 0.35, pil: 4, heat: 0.32 },
  { n: 'CLASH RUSH', sky: ['#18000a', '#63001f', '#e01f5c'], acc: '#ff2d6f', city: '#0d0004', rain: 1.3,  pil: 8, heat: 0.58 },
];
