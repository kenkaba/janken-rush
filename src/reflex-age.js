/* ============================================================
   JANKEN RUSH — REFLEX AGE RESULT v0.7
   SCOREを「反射神経年齢」に変換してリザルトへ表示する。
   医学的診断ではなくゲーム内のエンタメ指標。
   ============================================================ */

function bootReflexAge() {
  const JR = window.JR;
  if (!JR) return setTimeout(bootReflexAge, 60);

  const result = document.querySelector('#resultScreen');
  const resBody = document.querySelector('#resBody');
  if (!result || !resBody) return;

  const style = document.createElement('style');
  style.textContent = `
    .reflexAgeWrap{margin:14px auto 2px;display:flex;flex-direction:column;align-items:center;gap:2px}
    .reflexAgeLabel{font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.18em;color:#ffffffb8}
    .reflexAgeValue{font:950 clamp(46px,14vw,72px)/.95 system-ui,sans-serif;letter-spacing:-.06em;color:#ffd45e;text-shadow:0 0 18px rgba(255,194,54,.35),0 3px 10px #000}
    .reflexAgeValue small{font-size:.34em;letter-spacing:.04em;margin-left:4px;color:#fff}
    .reflexAgeComment{margin-top:5px;font:800 12px/1.4 system-ui,sans-serif;letter-spacing:.08em;color:#fff}
    .reflexAgeNote{margin-top:4px;font:600 9px/1.4 system-ui,sans-serif;letter-spacing:.04em;color:#ffffff66}
    .reflexAgeRank{margin-top:7px;padding:5px 10px;border:1px solid rgba(255,212,94,.35);border-radius:999px;background:rgba(255,212,94,.08);font:800 10px/1 system-ui,sans-serif;letter-spacing:.13em;color:#ffd45e}
  `;
  document.head.appendChild(style);

  function reflexAge(score) {
    // 30前後を一般層の壁、50で30歳前後、100で18歳級になるよう調整。
    const points = [
      [0, 72],
      [10, 62],
      [20, 52],
      [30, 43],
      [40, 35],
      [50, 29],
      [60, 26],
      [75, 22],
      [100, 18],
      [150, 18],
    ];
    for (let i = 0; i < points.length - 1; i++) {
      const [s0, a0] = points[i];
      const [s1, a1] = points[i + 1];
      if (score <= s1) {
        const t = Math.max(0, Math.min(1, (score - s0) / (s1 - s0)));
        return Math.round(a0 + (a1 - a0) * t);
      }
    }
    return 18;
  }

  function comment(age, score) {
    if (score >= 100) return '反射神経、完全に若返っています。';
    if (score >= 75) return 'かなり鋭い。100が見える領域。';
    if (score >= 50) return 'かなり若い反応速度です。';
    if (score >= 30) return '平均の壁を突破。まだ伸びます。';
    if (score >= 20) return 'ここからが反射神経勝負。';
    if (score >= 10) return 'ウォームアップ完了。';
    return 'まずは10連続を目指そう。';
  }

  function ageRank(age) {
    if (age <= 18) return 'GOD REFLEX';
    if (age <= 22) return 'ULTRA FAST';
    if (age <= 29) return 'YOUNG REFLEX';
    if (age <= 39) return 'SHARP';
    if (age <= 49) return 'GOOD';
    if (age <= 59) return 'NORMAL';
    return 'WARM UP';
  }

  function render() {
    if (result.classList.contains('hidden')) return;
    const state = JR.state?.();
    if (!state) return;
    const score = Number(state.score || 0);
    const age = reflexAge(score);
    const existing = resBody.querySelector('.reflexAgeWrap');
    existing?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'reflexAgeWrap';
    wrap.innerHTML = `
      <div class="reflexAgeLabel">あなたの反射神経適正年齢</div>
      <div class="reflexAgeValue">${age}<small>歳</small></div>
      <div class="reflexAgeRank">${ageRank(age)}</div>
      <div class="reflexAgeComment">${comment(age, score)}</div>
      <div class="reflexAgeNote">※ゲーム内スコアから算出するエンタメ判定です</div>
    `;
    resBody.appendChild(wrap);
  }

  new MutationObserver(render).observe(result, { attributes: true, attributeFilter: ['class'] });
  render();

  window.JRReflexAge = { reflexAge };
}

bootReflexAge();
