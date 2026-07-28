/* JANKEN RUSH アイコン生成
   三つ巴（グー・チョキ・パーの三すくみ）を、中心へ巻き込む渦として描く。
   完全オリジナル。既存IPの模倣なし。
   重要部分は中心から半径178px以内に収め、iOSの角丸・マスク安全域を確保する。 */
import { writeFileSync } from 'node:fs';

const C = 256, TAU = Math.PI * 2;
const u = (a) => [Math.cos(a), Math.sin(a)];
const f = (n) => Math.round(n * 100) / 100;

// 1本の巴：半径が内側へ縮みながら、太さも先細りする渦
function tomoe(startDeg, { r0 = 116, r1 = 24, w0 = 54, w1 = 1.5, sweepDeg = 292, steps = 72 } = {}) {
  const a0 = (startDeg * Math.PI) / 180;
  const sweep = (sweepDeg * Math.PI) / 180;
  const outer = [], inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + sweep * t;
    const rad = r0 + (r1 - r0) * Math.pow(t, 0.86);      // 内へ巻き込む
    const w = w0 + (w1 - w0) * Math.pow(t, 0.72);        // 先細り
    const [cx, cy] = u(a);
    outer.push([C + (rad + w) * cx, C + (rad + w) * cy]);
    inner.push([C + (rad - w) * cx, C + (rad - w) * cy]);
  }
  // 頭は半円で閉じる
  const [hx, hy] = u(a0);
  const headR = (outer[0][0] - inner[0][0]) / 2 || 54;
  const hr = Math.hypot(outer[0][0] - inner[0][0], outer[0][1] - inner[0][1]) / 2;
  let d = `M ${f(inner[0][0])} ${f(inner[0][1])}`;
  d += ` A ${f(hr)} ${f(hr)} 0 0 0 ${f(outer[0][0])} ${f(outer[0][1])}`;
  for (let i = 1; i < outer.length; i++) d += ` L ${f(outer[i][0])} ${f(outer[i][1])}`;
  for (let i = inner.length - 1; i >= 1; i--) d += ` L ${f(inner[i][0])} ${f(inner[i][1])}`;
  d += ' Z';
  void headR; void hx; void hy;
  return d;
}

const lobes = [
  { deg: -90, fill: 'url(#lr)', name: 'グー' },
  { deg: 30,  fill: 'url(#lp)', name: 'チョキ' },
  { deg: 150, fill: 'url(#lg)', name: 'パー' },
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<!-- JANKEN RUSH アプリアイコン（自動生成 / gen-icon.mjs）
     三つ巴＝グー・チョキ・パーの三すくみ。中心は「神の一手」の拳。
     完全オリジナル。既存パチンコ・スロットIPの模倣なし。 -->
<defs>
  <radialGradient id="bg" cx="50%" cy="40%" r="76%">
    <stop offset="0" stop-color="#1d0a2c"/>
    <stop offset="52%" stop-color="#0b0416"/>
    <stop offset="100%" stop-color="#020109"/>
  </radialGradient>
  <radialGradient id="core" cx="40%" cy="32%" r="76%">
    <stop offset="0" stop-color="#fffbe8"/>
    <stop offset="42%" stop-color="#ffd45e"/>
    <stop offset="100%" stop-color="#e86a00"/>
  </radialGradient>
  <linearGradient id="lr" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff6b5e"/><stop offset="55%" stop-color="#ff1e34"/><stop offset="1" stop-color="#8e0512"/>
  </linearGradient>
  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff0b0"/><stop offset="55%" stop-color="#ffb400"/><stop offset="1" stop-color="#a35a00"/>
  </linearGradient>
  <linearGradient id="lp" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d59cff"/><stop offset="55%" stop-color="#9b3cff"/><stop offset="1" stop-color="#4a0f96"/>
  </linearGradient>
  <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="10" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="halo" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="26"/>
  </filter>
</defs>

<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="256" r="150" fill="#7a1fd0" opacity=".22" filter="url(#halo)"/>
<circle cx="256" cy="256" r="188" fill="none" stroke="#7a3fd0" stroke-width="2" opacity=".30"/>

<g filter="url(#glow)">
${lobes.map((l) => `  <path d="${tomoe(l.deg)}" fill="${l.fill}" stroke="#05020c" stroke-width="5" stroke-linejoin="round"/><!-- ${l.name} -->`).join('\n')}
</g>

<circle cx="256" cy="256" r="70" fill="#05020c"/>
<circle cx="256" cy="256" r="58" fill="url(#core)"/>
<g fill="#4a1a00" opacity=".8" transform="translate(256 258) scale(0.46) translate(-76 -88)">
  <rect x="26" y="54" width="108" height="78" rx="34"/>
  <rect x="34" y="44" width="30" height="34" rx="15"/>
  <rect x="62" y="40" width="32" height="36" rx="16"/>
  <rect x="92" y="44" width="30" height="34" rx="15"/>
  <rect x="112" y="56" width="26" height="30" rx="13"/>
  <rect x="14" y="76" width="40" height="30" rx="15"/>
</g>
<circle cx="256" cy="256" r="58" fill="none" stroke="#fff6d2" stroke-width="3.5" opacity=".9"/>
</svg>
`;
writeFileSync(new URL('./icon.svg', import.meta.url), svg);
console.log('icon.svg written', svg.length, 'bytes');
