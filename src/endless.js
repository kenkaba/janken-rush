/* ============================================================
   JANKEN RUSH — ENDLESS MODE
   通常バトルをタイトルへ戻さず連続させる薄い制御レイヤー。
   既存の battle / presentation を壊さず、撃破ごとに難度を少しずつ上げる。
   ============================================================ */

const JR = window.JR;
if (JR) {
  const $ = (s) => document.querySelector(s);
  const result = $('#resultScreen');
  const enemyName = $('#enemyName');
  const btnFight = $('#btnFight');
  const btnAgain = $('#btnAgain');

  let wave = Number(localStorage.getItem('jr_endless_wave') || 1);
  let clears = Number(localStorage.getItem('jr_endless_clears') || 0);
  let streak = Number(localStorage.getItem('jr_endless_streak') || 0);
  let best = Number(localStorage.getItem('jr_endless_best') || 0);
  let transitioning = false;

  const basePhases = Object.fromEntries(
    Object.entries(JR.C.GORO_PHASES).map(([k, v]) => [k, { ...v }])
  );

  const hud = document.createElement('div');
  hud.id = 'endlessHud';
  hud.innerHTML = '<b>WAVE 1</b><span>撃破 0</span><span>連破 0</span>';
  document.querySelector('#app')?.appendChild(hud);

  const style = document.createElement('style');
  style.textContent = `
    #endlessHud{position:absolute;z-index:34;top:calc(env(safe-area-inset-top,0px) + 54px);left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;pointer-events:none;font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;color:#fff;text-shadow:0 1px 5px #000;white-space:nowrap}
    #endlessHud b{color:#ffd45e;font-size:12px}
    #endlessHud span{opacity:.78}
    body.menu #endlessHud{display:none}
  `;
  document.head.appendChild(style);

  function persist() {
    localStorage.setItem('jr_endless_wave', String(wave));
    localStorage.setItem('jr_endless_clears', String(clears));
    localStorage.setItem('jr_endless_streak', String(streak));
    localStorage.setItem('jr_endless_best', String(best));
  }

  function updateHud() {
    hud.innerHTML = `<b>WAVE ${wave}</b><span>撃破 ${clears}</span><span>連破 ${streak}</span>`;
    if (JR.G.running && JR.G.mode === 'fight') enemyName.textContent = `GORO · ${wave}`;
  }

  // 撃破するほど少しずつ判断時間とヒント時間を短くする。
  // 下限を設け、理不尽な反射神経ゲームにはしない。
  function applyDifficulty() {
    const level = Math.max(0, wave - 1);
    const timeFactor = Math.max(0.66, 1 - level * 0.018);
    const ghostFactor = Math.max(0.58, 1 - level * 0.024);
    for (const k of Object.keys(basePhases)) {
      const b = basePhases[k];
      const p = JR.C.GORO_PHASES[k];
      p.timeMs = Math.max(1500, Math.round(b.timeMs * timeFactor));
      p.ghostDelayMs = Math.min(p.timeMs - 650, Math.round(b.ghostDelayMs * (1 + Math.min(level, 20) * 0.025)));
      p.ghostMs = Math.max(520, Math.round(b.ghostMs * ghostFactor));
      // 覚醒時の嘘だけ段階的に増えるが、最大45%まで。
      p.lieRate = Math.min(0.45, b.lieRate + level * 0.008);
    }
  }

  function startNext() {
    applyDifficulty();
    JR.startFight();
    queueMicrotask(updateHud);
  }

  function onResult() {
    if (transitioning || result.classList.contains('hidden')) return;
    // チュートリアルは従来どおり結果画面で終了させる。
    if (JR.G.mode !== 'fight') return;

    transitioning = true;
    const won = ($('#resTitle')?.textContent || '').includes('撃');
    if (won) {
      clears += 1;
      streak += 1;
      best = Math.max(best, streak);
      wave += 1;
      $('#resBody').innerHTML = `撃破！ <b>WAVE ${wave}</b> へ突入<br>連破 ${streak} ／ BEST ${best}`;
      btnAgain.textContent = 'N E X T  W A V E';
    } else {
      // エンドレスなので敗北しても終了しない。同じWAVEへ即再挑戦。
      streak = 0;
      $('#resBody').innerHTML = `まだ終わらない。<br><b>WAVE ${wave}</b> に再突入`;
      btnAgain.textContent = 'R E V E N G E';
    }
    persist();
    updateHud();

    // 結果は一瞬だけ見せ、操作要求なしで次戦へ。
    setTimeout(() => {
      result.classList.add('hidden');
      startNext();
      transitioning = false;
    }, won ? 720 : 560);
  }

  new MutationObserver(onResult).observe(result, { attributes: true, attributeFilter: ['class'] });

  if (btnFight) {
    btnFight.childNodes[0].textContent = 'エ ン ド レ ス で 戦 う';
    const small = btnFight.querySelector('small');
    if (small) small.textContent = '倒しても終わらない。勝つほど速くなる';
  }

  // 既存の「もう一度」もエンドレス再開として扱う。
  btnAgain?.addEventListener('click', () => {
    if (JR.G.mode === 'fight') setTimeout(updateHud, 0);
  });

  applyDifficulty();
  updateHud();

  window.JREndless = {
    state: () => ({ wave, clears, streak, best }),
    reset: () => {
      wave = 1; clears = 0; streak = 0; best = 0;
      persist(); applyDifficulty(); updateHud();
    },
  };
}
