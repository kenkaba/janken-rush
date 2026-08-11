/* ============================================================
   JANKEN RUSH — ATMOSPHERE v0.6
   ルールは変えず、スコアが上がるほど背景・圧・達成感を強くする。
   ============================================================ */

function bootAtmosphere() {
  const JR = window.JR;
  if (!JR) return setTimeout(bootAtmosphere, 60);

  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  if (!app || $('#atmoLayer')) return;

  const layer = document.createElement('div');
  layer.id = 'atmoLayer';
  layer.innerHTML = `
    <div class="atmoWarp"></div>
    <div class="atmoLines"></div>
    <div class="atmoPulse"></div>
    <div class="atmoDanger"></div>
    <div class="atmoEdge"></div>
    <div class="atmoPop" id="atmoPop"></div>
  `;
  app.appendChild(layer);

  const style = document.createElement('style');
  style.textContent = `
    #atmoLayer{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;--speed:.1;--line:.03;--pulse:0;--danger:0;--edge:.06}
    #atmoLayer>div{position:absolute;inset:0;pointer-events:none}

    .atmoWarp{opacity:var(--speed);background:
      radial-gradient(circle at 50% 48%,transparent 0 23%,rgba(255,255,255,.025) 38%,transparent 62%),
      conic-gradient(from 0deg at 50% 48%,transparent 0 8deg,rgba(255,255,255,.05) 8deg 9deg,transparent 9deg 22deg,rgba(255,255,255,.03) 22deg 23deg,transparent 23deg 360deg);
      transform:scale(1.7);animation:jrWarp 2.4s linear infinite;mix-blend-mode:screen}
    .atmoLines{opacity:var(--line);background:repeating-linear-gradient(115deg,transparent 0 18px,rgba(255,255,255,.22) 18px 19px,transparent 19px 45px);transform:scale(1.45) translateX(-8%);animation:jrLines 1.2s linear infinite;mix-blend-mode:screen}
    .atmoPulse{opacity:var(--pulse);background:radial-gradient(circle at 50% 46%,transparent 0 28%,rgba(255,42,77,.12) 58%,rgba(255,0,54,.28) 100%);animation:jrPulse .9s ease-in-out infinite alternate}
    .atmoDanger{opacity:var(--danger);box-shadow:inset 0 0 70px rgba(255,0,42,.9),inset 0 0 150px rgba(255,0,42,.38);animation:jrDanger .48s ease-in-out infinite alternate}
    .atmoEdge{opacity:var(--edge);background:linear-gradient(90deg,rgba(255,205,82,.22),transparent 8% 92%,rgba(255,205,82,.22));mix-blend-mode:screen}
    .atmoPop{display:grid;place-items:center;opacity:0;font:900 clamp(36px,12vw,72px)/1 system-ui,sans-serif;letter-spacing:-.04em;text-shadow:0 0 18px currentColor,0 4px 18px #000;transform:scale(.82);transition:none}
    .atmoPop.show{animation:jrPop .34s cubic-bezier(.2,.85,.15,1)}

    body.jr-tier-0 #atmoLayer{--speed:.02;--line:.015;--pulse:0;--edge:.025}
    body.jr-tier-1 #atmoLayer{--speed:.05;--line:.03;--pulse:.03;--edge:.04}
    body.jr-tier-2 #atmoLayer{--speed:.08;--line:.055;--pulse:.06;--edge:.055}
    body.jr-tier-3 #atmoLayer{--speed:.12;--line:.095;--pulse:.10;--edge:.07}
    body.jr-tier-4 #atmoLayer{--speed:.17;--line:.14;--pulse:.15;--edge:.10}
    body.jr-tier-5 #atmoLayer{--speed:.23;--line:.19;--pulse:.20;--edge:.14}
    body.jr-tier-6 #atmoLayer{--speed:.30;--line:.25;--pulse:.22;--edge:.19}
    body.jr-last-life #atmoLayer{--danger:.52}
    body.jr-last-life #arcLives{filter:drop-shadow(0 0 8px #ff284c)}
    body.jr-last-life #timeBar{box-shadow:0 0 12px rgba(255,40,70,.65)}
    body.jr-last-life #timeFill{filter:saturate(1.4) brightness(1.2)}

    body.jr-tier-3 #stage,body.jr-tier-4 #stage,body.jr-tier-5 #stage,body.jr-tier-6 #stage{animation:jrStageBreathe .8s ease-in-out infinite alternate}
    body.jr-tier-5 #stage,body.jr-tier-6 #stage{animation-duration:.5s}

    @keyframes jrWarp{to{transform:scale(2.05) rotate(12deg)}}
    @keyframes jrLines{to{transform:scale(1.45) translateX(8%) translateY(7%)}}
    @keyframes jrPulse{to{filter:brightness(1.5)}}
    @keyframes jrDanger{to{opacity:.86}}
    @keyframes jrStageBreathe{from{filter:brightness(1)}to{filter:brightness(1.07)}}
    @keyframes jrPop{0%{opacity:0;transform:scale(.7)}35%{opacity:1;transform:scale(1.08)}72%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.16)}}

    @media (prefers-reduced-motion:reduce){.atmoWarp,.atmoLines,.atmoPulse,.atmoDanger,#stage{animation:none!important}}
  `;
  document.head.appendChild(style);

  const tierFor = (score) => score >= 100 ? 6 : score >= 75 ? 5 : score >= 50 ? 4 : score >= 30 ? 3 : score >= 20 ? 2 : score >= 10 ? 1 : 0;
  const stageForTier = (tier) => tier >= 5 ? 3 : tier >= 4 ? 2 : tier >= 2 ? 1 : 0;

  let prevScore = -1;
  let prevLives = 3;
  let prevTier = -1;
  let popTimer = null;

  function pop(text, color = '#ffffff') {
    const el = $('#atmoPop');
    if (!el) return;
    clearTimeout(popTimer);
    el.classList.remove('show');
    void el.offsetWidth;
    el.textContent = text;
    el.style.color = color;
    el.classList.add('show');
    popTimer = setTimeout(() => el.classList.remove('show'), 380);
  }

  function microHit(score) {
    const strength = score >= 100 ? 18 : score >= 50 ? 14 : score >= 30 ? 11 : 8;
    JR.V.FX.hit(strength, score >= 50 ? 145 : 110);
    if (score >= 20) {
      JR.V.FX.burst(JR.V.cx(), JR.V.cy() * .92, score >= 75 ? 18 : 10, {
        col: score >= 100 ? '#ffd45e' : '#ffffff', smax: 8, smin: 2, szmax: 2.6, g: 0
      });
    }
  }

  function tierTransition(tier, score) {
    JR.V.applyStage(stageForTier(tier));
    document.body.classList.remove('jr-tier-0','jr-tier-1','jr-tier-2','jr-tier-3','jr-tier-4','jr-tier-5','jr-tier-6');
    document.body.classList.add(`jr-tier-${tier}`);
    if (score > 0) {
      const names = ['','HEAT','PRESSURE','30 ZONE','OVERDRIVE','RED ZONE','GOD ZONE'];
      pop(names[tier] || 'LEVEL UP', tier >= 6 ? '#ffd45e' : tier >= 4 ? '#ff697f' : '#ffffff');
      JR.V.FX.flash(tier >= 6 ? '#ffd45e' : '#ffffff', 180, tier >= 6 ? .55 : .32);
      JR.V.buzz(tier >= 6 ? [25,20,45] : 18);
    }
  }

  function sync() {
    const s = JR.state();
    if (!s) return;

    const tier = tierFor(s.score);
    if (tier !== prevTier) {
      tierTransition(tier, s.score);
      prevTier = tier;
    }

    if (s.score > prevScore && prevScore >= 0) microHit(s.score);
    prevScore = s.score;

    if (s.lives < prevLives) {
      pop(s.lives === 1 ? 'LAST LIFE' : `LIFE ${s.lives}`, '#ff536d');
      JR.V.FX.flash('#ff2446', 130, .38);
    }
    prevLives = s.lives;
    document.body.classList.toggle('jr-last-life', s.running && s.lives === 1);

    if (!s.running) document.body.classList.remove('jr-last-life');
    requestAnimationFrame(sync);
  }

  document.body.classList.add('jr-tier-0');
  requestAnimationFrame(sync);
}

bootAtmosphere();
