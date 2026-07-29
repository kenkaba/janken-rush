/* ============================================================
   GORO — 破壊王
   見た瞬間に「力押し型」と分かる巨体。仮面が3段階で壊れる。
   ロジックは持たない。状態を受け取って見た目を変えるだけ。
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';

/* 仮面のヒビ。段階が進むほど増える */
const CRACKS = [
  'M92 44 L106 62 L96 80 L112 94',
  'M150 40 L138 60 L152 76',
  'M120 32 L116 54 L132 74 L120 98',
  'M84 84 L100 96 L88 112',
  'M158 86 L142 98 L156 114',
];

export const GORO_SVG = `
<svg id="goroSvg" viewBox="0 0 240 232" class="m3" aria-hidden="true">
  <defs>
    <linearGradient id="gBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6b2018"/><stop offset="55%" stop-color="#3d0f0c"/><stop offset="1" stop-color="#1a0605"/>
    </linearGradient>
    <linearGradient id="gArm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7d2a1e"/><stop offset="1" stop-color="#2a0908"/>
    </linearGradient>
    <linearGradient id="gMask" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfd6e2"/><stop offset="45%" stop-color="#8b94a6"/><stop offset="1" stop-color="#3b414f"/>
    </linearGradient>
    <linearGradient id="gSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9614a"/><stop offset="1" stop-color="#6e2118"/>
    </linearGradient>
  </defs>

  <!-- オーラ（覚醒で強くなる） -->
  <ellipse id="goroAura" cx="120" cy="120" rx="112" ry="118" fill="#ff2d1a" opacity="0"/>

  <!-- 腕と拳。力押し型だと一目で分かる太さ -->
  <g id="goroArms">
    <path d="M70 156 Q34 176 32 198" stroke="url(#gArm)" stroke-width="42" stroke-linecap="round" fill="none"/>
    <path d="M170 156 Q206 176 208 198" stroke="url(#gArm)" stroke-width="42" stroke-linecap="round" fill="none"/>
    <g id="fistL"><circle cx="32" cy="200" r="31" fill="url(#gArm)" stroke="#0d0303" stroke-width="4.5"/>
      <path d="M15 191 L49 191 M15 205 L49 205" stroke="#180505" stroke-width="4.5" stroke-linecap="round"/></g>
    <g id="fistR"><circle cx="208" cy="200" r="31" fill="url(#gArm)" stroke="#0d0303" stroke-width="4.5"/>
      <path d="M191 191 L225 191 M191 205 L225 205" stroke="#180505" stroke-width="4.5" stroke-linecap="round"/></g>
  </g>

  <!-- 接地の影。胴が途中で切れて浮いて見えるのを防ぐ -->
  <ellipse cx="120" cy="228" rx="96" ry="16" fill="#000" opacity=".55"/>

  <!-- 胴 -->
  <path d="M74 232 L64 162 Q120 146 176 162 L166 232 Z" fill="url(#gBody)" stroke="#0d0303" stroke-width="4.5"/>
  <path d="M96 170 L120 194 L144 170" fill="none" stroke="#1c0605" stroke-width="6" stroke-linecap="round"/>

  <!-- 肩の鉄板 -->
  <path d="M58 176 Q52 142 88 140 L94 166 Z" fill="#5a626f" stroke="#0d0303" stroke-width="4"/>
  <path d="M182 176 Q188 142 152 140 L146 166 Z" fill="#5a626f" stroke="#0d0303" stroke-width="4"/>

  <!-- 首・頭（顔を大きくして表情を読ませる） -->
  <rect x="102" y="126" width="36" height="26" fill="#4a1410"/>
  <rect x="72" y="20" width="96" height="112" rx="34" fill="url(#gSkin)" stroke="#0d0303" stroke-width="4.5"/>

  <!-- 素顔（仮面が割れると見える） -->
  <g id="goroFace">
    <path d="M86 58 L112 70" stroke="#3a0f0a" stroke-width="8" stroke-linecap="round"/>
    <path d="M154 58 L128 70" stroke="#3a0f0a" stroke-width="8" stroke-linecap="round"/>
    <path d="M92 112 L148 112" stroke="#2a0806" stroke-width="9" stroke-linecap="round"/>
    <path d="M104 105 L104 119 M120 104 L120 120 M136 105 L136 119" stroke="#2a0806" stroke-width="4.5"/>
  </g>

  <!-- 仮面（目より先に描き、目は上に乗せる） -->
  <g id="goroMask">
    <path id="maskL" d="M72 40 L120 30 L120 122 L78 116 Q66 80 72 40 Z" fill="url(#gMask)" stroke="#20242c" stroke-width="3"/>
    <path id="maskR" d="M168 40 L120 30 L120 122 L162 116 Q174 80 168 40 Z" fill="url(#gMask)" stroke="#20242c" stroke-width="3"/>
    <rect x="80" y="62" width="80" height="24" rx="8" fill="#08080e"/>
    <path d="M120 96 L120 122" stroke="#20242c" stroke-width="3"/>
    <path d="M86 100 L154 100" stroke="#20242c" stroke-width="3"/>
    <g id="maskCracks" stroke="#12141a" stroke-width="3.8" fill="none" stroke-linecap="round">
      ${CRACKS.map((d, i) => `<path class="ck ck${i}" d="${d}"/>`).join('')}
    </g>
  </g>

  <!-- 目。宣言中は「出す手」の色に光る。仮面より前面 -->
  <g id="goroEyes">
    <rect id="eyeL" x="90" y="68" width="26" height="12" rx="5" fill="#ff6a3d"/>
    <rect id="eyeR" x="124" y="68" width="26" height="12" rx="5" fill="#ff6a3d"/>
  </g>
</svg>`;

/* ---------------- 制御 ---------------- */
let root = null;

export function mountGoro(container) {
  container.innerHTML = GORO_SVG;
  root = container.querySelector('#goroSvg');
  return root;
}

/** 仮面の残り段階（3=無傷 / 2=ヒビ / 1=覚醒 / 0=撃破） */
export function setMask(n) {
  if (!root) return;
  root.classList.remove('m3', 'm2', 'm1', 'm0');
  root.classList.add('m' + Math.max(0, n));
}

/** 宣言中に目を出す手の色へ光らせる */
export function setEyeColor(col) {
  if (!root) return;
  root.querySelectorAll('#goroEyes rect').forEach((e) => {
    e.setAttribute('fill', col);
    e.style.filter = `drop-shadow(0 0 6px ${col}) drop-shadow(0 0 14px ${col})`;
  });
}

/** ポーズ。CSS側のクラスでアニメーションを切り替える */
export function setPose(p) {
  if (!root) return;
  root.classList.remove('pose-idle', 'pose-charge', 'pose-attack', 'pose-hit', 'pose-roar');
  root.classList.add('pose-' + p);
}

/** 仮面が割れた瞬間、破片の座標を返す（粒子の発生源に使う） */
export function maskCenter() {
  if (!root) return null;
  const r = root.querySelector('#goroMask').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
