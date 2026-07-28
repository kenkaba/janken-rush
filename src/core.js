/* ============================================================
   JANKEN RUSH — CORE
   純ロジック層。ここは DOM / window / 音 に一切触れない。
   勝敗を決めるコードはこのファイルにしか存在しない。
   ============================================================ */

/* ---------------- 基本ルール ---------------- */
export const HANDS = ['rock', 'scissors', 'paper'];
export const HAND_JP = { rock: 'グー', scissors: 'チョキ', paper: 'パー' };
export const HAND_COLOR = { rock: '#ff2d3f', scissors: '#00d4ff', paper: '#ffb400' };
/** BEATS[x] = x が打ち勝つ手 */
export const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
/** LOSES_TO[x] = x に打ち勝つ手 */
export const LOSES_TO = { rock: 'paper', scissors: 'rock', paper: 'scissors' };

/** 唯一の勝敗判定。プレイヤーの手と敵の手だけを見る。 */
export function judge(playerHand, enemyHand) {
  if (playerHand === enemyHand) return 'draw';
  return BEATS[playerHand] === enemyHand ? 'win' : 'lose';
}

/* ---------------- 小道具 ---------------- */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
export const ri = (a, b) => Math.floor(rnd(b + 1, a));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function wpick(list) {
  let t = 0;
  for (const l of list) t += l[1];
  let r = Math.random() * t;
  for (const l of list) { r -= l[1]; if (r <= 0) return l[0]; }
  return list[list.length - 1][0];
}
function normalize(d) {
  const s = HANDS.reduce((a, h) => a + Math.max(0, d[h]), 0) || 1;
  const o = {};
  for (const h of HANDS) o[h] = Math.max(0, d[h]) / s;
  return o;
}
function sampleHand(d) {
  let r = Math.random();
  for (const h of HANDS) { r -= d[h]; if (r <= 0) return h; }
  return HANDS[HANDS.length - 1];
}
export function argmax(d) {
  return HANDS.reduce((a, b) => (d[a] >= d[b] ? a : b));
}

/* ============================================================
   敵の内部状態
   ラウンド開始時に決まり、セリフ・目線・オーラの元になる。
   readability = その状態でセリフが本音を漏らす確率。
   ============================================================ */
export const STATES = {
  aggressive: { n: '攻撃的',     eye: '#ff2d3f', readability: 0.80, bias: { rock: 0.22 } },
  wary:       { n: '警戒',       eye: '#00e5ff', readability: 0.72, bias: { paper: 0.22 } },
  confused:   { n: '混乱',       eye: '#9fb0d8', readability: 0.25, flatten: 0.65 },
  feinting:   { n: 'フェイント', eye: '#b060ff', readability: 0.30, feint: true },
  copying:    { n: 'コピー準備', eye: '#c0c8d8', readability: 0.70, copyBoost: 0.35 },
  timid:      { n: '弱気',       eye: '#7cff4d', readability: 0.66, bias: { scissors: 0.20 } },
  awakened:   { n: '覚醒',       eye: '#ffd45e', readability: 0.88, sharpen: 1.7, premium: true },
};
export const STATE_LINE = {
  aggressive: '前のめりに構えている',
  wary: '一歩下がって様子を見ている',
  confused: '構えが定まらない',
  feinting: '口元が笑っている',
  copying: 'こちらの手を目で追っている',
  timid: '肩に力が入っていない',
  awakened: '空気が変わった',
};
export const TELLS = {
  rock: ['グーで押し切る', '拳で決める', '力こそすべてだ'],
  scissors: ['チョキで刻む', '切り裂いてやる', '二本の刃で終わりだ'],
  paper: ['パーで包み込む', '手のひらで受け止める', '広げて封じる'],
};

/* ============================================================
   アーキタイプ（敵の素の方針）
   policy(ctx) は「今回の手の確率分布」を返す。
   ctx にプレイヤーの"今回の手"は含まれない。含めてはいけない。
   ============================================================ */
export const ARCHETYPES = {
  gori: {
    key: 'gori', n: 'ゴリ押し型', c: '#ff3b2f',
    hint: '力押し。追い込まれるほどグーに寄る',
    states: [['aggressive', 46], ['awakened', 8], ['wary', 12], ['confused', 12], ['timid', 10], ['feinting', 12]],
    policy(ctx) {
      // グー60 / チョキ20 / パー20。連敗するほどグーが濃くなる。
      const add = Math.min(0.25, ctx.enemyLoseStreak * 0.08);
      return { dist: { rock: 0.60 + add, scissors: 0.20, paper: 0.20 } };
    },
  },
  feint: {
    key: 'feint', n: 'フェイント型', c: '#8a5cff',
    hint: '宣言した手には勝ちにくる。二段読みが要る',
    states: [['feinting', 46], ['confused', 14], ['wary', 14], ['aggressive', 10], ['awakened', 8], ['timid', 8]],
    policy() {
      // 宣言した手 20% / 宣言に勝つ手 50% / 残り 30%
      const declared = pick(HANDS);
      const counter = LOSES_TO[declared];
      const other = HANDS.find((h) => h !== declared && h !== counter);
      const dist = { rock: 0, scissors: 0, paper: 0 };
      dist[declared] = 0.20;
      dist[counter] = 0.50;
      dist[other] = 0.30;
      return { dist, forcedTell: declared };
    },
  },
  copy: {
    key: 'copy', n: 'コピー型', c: '#c0c8d8',
    hint: '直前のあなたの手をなぞる',
    states: [['copying', 50], ['wary', 14], ['confused', 12], ['aggressive', 10], ['awakened', 8], ['feinting', 6]],
    policy(ctx) {
      const last = ctx.lastPlayerHand;
      if (!last) return { dist: { rock: 1 / 3, scissors: 1 / 3, paper: 1 / 3 } };
      // 直前手コピー45 / 直前手に勝つ手35 / ランダム20
      const dist = { rock: 0.20 / 3, scissors: 0.20 / 3, paper: 0.20 / 3 };
      dist[last] += 0.45;
      dist[LOSES_TO[last]] += 0.35;
      return { dist };
    },
  },
  learn: {
    key: 'learn', n: '学習型AI', c: '#00d4ff',
    hint: '直近10手を集計する。同じ手を続けると狩られる',
    states: [['wary', 30], ['aggressive', 16], ['copying', 16], ['confused', 12], ['awakened', 10], ['feinting', 16]],
    policy(ctx) {
      const h = ctx.playerHistory.slice(-10);
      if (h.length < 2) return { dist: { rock: 1 / 3, scissors: 1 / 3, paper: 1 / 3 } };
      const cnt = { rock: 0, scissors: 0, paper: 0 };
      for (const x of h) cnt[x]++;
      const sorted = [...HANDS].sort((a, b) => cnt[b] - cnt[a]);
      const dist = { rock: 0.25 / 3, scissors: 0.25 / 3, paper: 0.25 / 3 };
      dist[LOSES_TO[sorted[0]]] += 0.55;   // 最頻手に勝つ手
      dist[LOSES_TO[sorted[1]]] += 0.20;   // 次点にも保険
      return { dist };
    },
  },
  chaos: {
    key: 'chaos', n: '狂乱型', c: '#ff2d6f',
    hint: '完全ランダム。読みは通用しない',
    states: [['confused', 46], ['aggressive', 14], ['feinting', 14], ['awakened', 10], ['wary', 8], ['timid', 8]],
    policy() { return { dist: { rock: 1 / 3, scissors: 1 / 3, paper: 1 / 3 } }; },
  },
};
export const ARCHETYPE_LIST = Object.values(ARCHETYPES);

/* ============================================================
   EnemyAI
   beginTurn() で「状態 → 分布 → 手」まで確定させる。
   プレイヤーが手を選ぶ前に敵の手は決まっており、以後変更されない。
   ============================================================ */
export class EnemyAI {
  constructor(archetypeKey) {
    this.arch = ARCHETYPES[archetypeKey] || ARCHETYPES.gori;
    this.loseStreak = 0;
  }

  /** ラウンド（あいこ中の1手も含む）開始時に呼ぶ。返り値の hand は確定値。 */
  beginTurn(playerHistory) {
    const ctx = {
      playerHistory,
      lastPlayerHand: playerHistory[playerHistory.length - 1] || null,
      enemyLoseStreak: this.loseStreak,
    };
    const stateKey = wpick(this.arch.states);
    const state = STATES[stateKey];
    const { dist: base, forcedTell } = this.arch.policy(ctx);

    let dist = { ...base };
    if (state.bias) for (const h in state.bias) dist[h] += state.bias[h];
    if (state.copyBoost && ctx.lastPlayerHand) dist[ctx.lastPlayerHand] += state.copyBoost;
    if (state.flatten) for (const h of HANDS) dist[h] = dist[h] * (1 - state.flatten) + (1 / 3) * state.flatten;
    if (state.sharpen) for (const h of HANDS) dist[h] = Math.pow(dist[h], state.sharpen);
    dist = normalize(dist);

    const hand = sampleHand(dist);

    // セリフ。forcedTell（フェイント型の宣言）が最優先。
    // それ以外は readability の確率で本命を漏らし、外れると別の手を口走る。
    let shown;
    if (forcedTell) shown = forcedTell;
    else if (Math.random() < state.readability) shown = argmax(dist);
    else shown = pick(HANDS.filter((h) => h !== argmax(dist)));

    return {
      hand,
      dist,
      stateKey,
      state,
      premium: !!state.premium,
      tellHand: shown,
      tellLine: pick(TELLS[shown]),
      stateLine: STATE_LINE[stateKey],
      /** セリフどおりの手だったか（結果表示用。事前には使わない） */
      tellWasHonest: shown === hand,
    };
  }

  noteResult(result) {
    // result はプレイヤー視点。プレイヤーの勝ち = 敵の負け。
    if (result === 'win') this.loseStreak++;
    else if (result === 'lose') this.loseStreak = 0;
  }
}

/* ============================================================
   ステージ
   FAIR は公平判定なので連勝が伸びにくい。閾値をモードごとに分ける。
   ============================================================ */
export const STAGES = [
  { n: '通常ステージ',   sky: ['#03050f', '#0b1738', '#1e3b7d'], acc: '#5b8cff', city: '#01020a', rain: 0.55, pil: 0, heat: 0 },
  { n: '兆しステージ',   sky: ['#08031a', '#200d4f', '#6a2a9c'], acc: '#b060ff', city: '#04010f', rain: 0.75, pil: 1, heat: 0.10 },
  { n: '擬似連ステージ', sky: ['#10021f', '#42076b', '#b81ec0'], acc: '#ff4dff', city: '#070113', rain: 1.00, pil: 2, heat: 0.18 },
  { n: 'RUSHステージ',   sky: ['#140500', '#5c1f00', '#e0700f'], acc: '#ffb400', city: '#0d0300', rain: 0.35, pil: 3, heat: 0.30 },
  { n: '神域ステージ',   sky: ['#140d00', '#5c4300', '#f0c33a'], acc: '#ffd700', city: '#0d0800', rain: 0.20, pil: 6, heat: 0.44 },
  { n: '超神域ステージ', sky: ['#18000a', '#63001f', '#e01f5c'], acc: '#ff2d6f', city: '#0d0004', rain: 1.30, pil: 8, heat: 0.62, rb: true },
];
/* FAIR は公平判定のため連勝が伸びにくい（完璧に読んでも決着勝率は約70%が上限）。
   20,000回シミュレーションの実測分布に合わせて閾値を下げてある。
   SHOWCASE は台本で長い連勝が作れるので従来値のまま。 */
export const STAGE_THRESHOLDS = {
  fair:     [0, 1, 2, 3, 5, 7],
  showcase: [0, 3, 4, 5, 10, 15],
};
export function stageIndexFor(streak, mode = 'fair') {
  const th = STAGE_THRESHOLDS[mode] || STAGE_THRESHOLDS.fair;
  let idx = 0;
  for (let i = 0; i < th.length; i++) if (streak >= th[i]) idx = i;
  return idx;
}

/* ============================================================
   あいこ（擬似連）のテンポ
   低段階は高速。高段階だけ特別に長くする。
   ============================================================ */
export const CHAIN_STEPS = [
  { label: '激 突',         ms: 550,  col: '#00e5ff' },
  { label: 'ま だ\n終 わ ら な い', ms: 880,  col: '#c46bff' },
  { label: '限 界 突 破',   ms: 1200, col: '#ff4dff' },
  { label: '世 界 停 止',   ms: 1700, col: '#ffd45e' },
  { label: '神 手 決 戦',   ms: 2200, col: '#ffffff', premium: true },
];
export function chainStep(n) {
  return CHAIN_STEPS[Math.min(n, CHAIN_STEPS.length - 1)];
}

/* ============================================================
   期待度 tier
   ============================================================ */
export const TIERS = [
  { k: 'none',  col: '#5a7fd8', lbl: '' },
  { k: 'cyan',  col: '#00e5ff', lbl: '…なにか来る' },
  { k: 'green', col: '#7cff4d', lbl: 'チャンス！' },
  { k: 'red',   col: '#ff2d3f', lbl: '激アツ！！' },
  { k: 'gold',  col: '#ffd45e', lbl: '超激アツ！！！' },
  { k: 'rb',    col: '#ffffff', lbl: '虹 ─ 確 定' },
];

/* ============================================================
   Director（演出プランナー）
   ★ 勝敗を受け取るだけで、絶対に書き換えない。
     引数 result は既に judge() が確定させた値。
   返り値の revive は「ジャンケンの結果」ではなく
   「連勝記録を継続するか」という独立したゲームルール。
   ============================================================ */
export function planPresentation({ result, chain, premium, streak }) {
  let weights;
  if (result === 'win') weights = [[1, 22], [2, 24], [3, 24], [4, 20], [5, 10]];
  else if (result === 'draw') weights = [[1, 30], [2, 30], [3, 25], [4, 12], [5, 3]];
  else weights = [[0, 26], [1, 40], [2, 20], [3, 10], [4, 3], [5, 1.5]];

  let tier = wpick(weights);
  if (premium) tier = clamp(tier + 1, 0, 5);
  tier = clamp(tier + Math.min(2, Math.floor(chain / 2)), 0, 5);
  if (streak >= 6) tier = clamp(tier + (Math.random() < 0.35 ? 1 : 0), 0, 5);

  // 虹 = プレミア体験確定。金 = 高確率でプレミア。
  const isPremiumRoute = tier === 5 || (tier === 4 && Math.random() < 0.6);

  const route = [];
  if (tier === 5 && Math.random() < 0.55) route.push('freeze');
  if (isPremiumRoute) {
    if (result === 'win') route.push(Math.random() < 0.5 ? 'yakumono' : 'cutin');
    else if (result === 'draw') route.push('cutin');
  }
  if (!route.includes('cutin') && Math.random() < (tier >= 3 ? 0.30 : 0.10)) route.push('cutin');
  if (!route.includes('yakumono') && result === 'win' && Math.random() < (tier >= 3 ? 0.28 : 0.08)) route.push('yakumono');

  // 復活 = 連勝救済。ジャンケンの勝敗は変えない。
  const revive = result === 'lose' && (tier === 5 || (tier === 4 && Math.random() < 0.5));

  return { tier, route, revive, isPremiumRoute };
}

/** 先読み（手を選ぶ前）。結果を知らないので敵の状態だけから決める。 */
export function planForeshadow(turn) {
  if (turn.premium) return { on: true, tier: Math.random() < 0.5 ? 4 : 3 };
  const p = turn.state.readability * 0.35;
  if (Math.random() > p) return { on: false, tier: 0 };
  return { on: true, tier: wpick([[1, 50], [2, 34], [3, 16]]) };
}

/* ============================================================
   SHOWCASE MODE 台本
   ここだけが勝敗を先に決める。FAIR PLAY からは参照されない。
   戦績・BEST・ランキングには一切影響しない。
   ============================================================ */
export const SHOWCASE_SCRIPT = [
  { force: 'win',  tier: 2, route: [] },
  { force: 'draw', tier: 3, route: [] },
  { force: 'win',  tier: 3, route: ['cutin'] },
  { force: 'draw', tier: 4, route: [] },
  { force: 'draw', tier: 4, route: ['cutin'] },
  { force: 'win',  tier: 4, route: ['yakumono'] },
  { force: 'lose', tier: 5, route: ['freeze'], revive: true },
  { force: 'win',  tier: 5, route: ['yakumono', 'cutin'] },
];

/** SHOWCASE 専用。指定の結果になる敵の手を逆算する。 */
export function showcaseEnemyHand(playerHand, force) {
  if (force === 'win') return BEATS[playerHand];
  if (force === 'lose') return LOSES_TO[playerHand];
  return playerHand;
}
