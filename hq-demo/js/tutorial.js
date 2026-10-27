'use strict';
/* =========================================================
   新手教學：序章「長老獸的試煉」
   coach(選擇器, 說明) 會用光圈標出介面；{ wait: 條件 } 會等玩家照做才繼續
   ========================================================= */
const TUT = {};
const waitFor = cond => new Promise(r => { const t = setInterval(() => { if (cond()) { clearInterval(t); r(); } }, 100); });

function coach(sel, html, opt = {}) {
  return new Promise(async res => {
    const ring = $('#coachRing'), tip = $('#coachTip');
    const el = sel ? document.querySelector(sel) : null;
    tip.className = '';
    if (el) {
      const r = el.getBoundingClientRect();
      tip.style.right = 'auto';
      Object.assign(ring.style, { left: r.left - 8 + 'px', top: r.top - 8 + 'px', width: r.width + 16 + 'px', height: r.height + 16 + 'px' });
      ring.classList.remove('hidden');
      const below = r.top < window.innerHeight / 2;
      tip.style.left = clamp(r.left + r.width / 2 - 190, 16, window.innerWidth - 396) + 'px';
      tip.style.top = below ? (r.bottom + 18) + 'px' : 'auto';
      tip.style.bottom = below ? 'auto' : (window.innerHeight - r.top + 18) + 'px';
    } else {   // 沒有目標：放在畫面中間的上方；手機直向探索地圖時，地圖在上半部，改放到下面的空白處
      ring.classList.add('hidden');
      tip.classList.add('top');
      const low = G.mode === 'area' && window.innerHeight > window.innerWidth;
      if (low) {   // 左下角是搖桿，說明框放在它的右邊
        tip.classList.remove('top'); tip.classList.add('low');
        Object.assign(tip.style, { left: 'auto', right: '10px', top: 'auto', bottom: 'max(14px, env(safe-area-inset-bottom))' });
      } else Object.assign(tip.style, { left: '50%', right: 'auto', top: '14px', bottom: 'auto' });
    }
    // 「照著做」的說明不會擋住手指：可以直接在說明框上拖曳搖桿、點地圖
    tip.classList.toggle('passthru', !!opt.wait);
    tip.innerHTML = `<div class="ctitle">👴 長老獸的教學</div><div class="ct">${html}</div>` +
      (opt.wait ? '<div class="cw">👉 照著做就會繼續</div>' : opt.auto ? '' : '<button class="btn primary">知道了</button>');
    tip.classList.remove('hidden');
    if (opt.wait) await waitFor(opt.wait);
    else if (opt.auto) await sleep(opt.auto);
    else await new Promise(r => tip.querySelector('button').onclick = r);
    ring.classList.add('hidden'); tip.classList.add('hidden');
    res();
  });
}
const isPlayerTurn = () => !B || (B.phase === 'player' && !B.anim);   // 戰鬥結束了也不要卡住

// ---------- 新手 / 老手 ----------
function askTutorial() {
  return new Promise(res => {
    const o = $('#overlay');
    o.innerHTML = `<h2>你玩過這類遊戲嗎？</h2><p class="sub">這個遊戲結合了「行動條」「卡牌」「進化」，第一次玩建議先跑一次教學（約 5 分鐘）</p>
      <div class="pickList">
        <div class="pickMon" id="tutNew"><div style="font-size:60px">🔰</div><b>A　新手</b><small>進入教學關卡，長老獸會一步一步教你行動條、能量、勇氣值、進化和勸降</small><small style="color:#86efac">完成教學：第一次冒險多送一瓶回復藥</small></div>
        <div class="pickMon" id="tutVet"><div style="font-size:60px">⚔️</div><b>B　老手</b><small>跳過教學，直接選角色出發</small><small>之後也可以從標題畫面的「新手教學」重玩</small></div>
      </div>`;
    o.classList.remove('hidden');
    o.querySelector('#tutNew').onclick = () => { o.classList.add('hidden'); res('new'); };
    o.querySelector('#tutVet').onclick = () => { o.classList.add('hidden'); res('vet'); };
  });
}

// ---------- 教學關卡 ----------
async function runTutorial() {
  G.tutorial = true;
  Object.keys(TUT).forEach(k => delete TUT[k]);
  RUN = { kid: 'taichi', team: [newMember('agumon', 3)], items: ['potion'], deck: [...STARTER_DECK], courage: 0, bits: 0, relics: [], flags: {}, rules: 'p1',
          chapter: 1, route: null, pos: null, visited: [], usedEvents: [], seen: [], stats: { wins: 0, chapters: 0 } };
  preloadLine('agumon'); ['Numemon', 'Goburimon', 'Kunemon', 'Jijimon'].forEach(loadImg);
  G.mode = 'story'; showScreen('');
  await say('jijimon', '喔喔，你就是新來的被選召的孩子吧？老夫是長老獸。');
  await say('jijimon', '數碼世界很危險，出發之前，先讓老夫教你冒險的基本功！這次就借你亞古獸當夥伴。');

  // ===== 1. 探索 =====
  await enterArea({ type: 'tutorial', f: 0, i: 0 });
  G.mode = 'area';
  await coach(null, '電腦用 <b>方向鍵</b> 或 <b>WASD</b> 移動；手機<b>按住畫面左半邊拖曳</b>就會出現搖桿。<br>四周被<b>迷霧</b>籠罩，只看得到身邊幾格，敵人和寶物要走近才會出現。');
  G.mode = 'area';
  const pk = AREA.objs.find(o => o.kind === 'pickup');
  if (pk) await coach(null, '附近掉了一塊<b>數據碎片</b>（藍色的 01 方塊），走過去碰一下就能撿起來！<br>可能是數碼幣、道具或卡片。碎片要走進視野內才看得到喔。', { wait: () => pk.done && G.mode === 'area' });
  await coach(null, '右邊那道<b>光柱</b>就是出口。不過出口被打著 <b>❗</b> 的數碼寶貝守住了。<br>走過去碰到牠，就會開始戰鬥！', { wait: () => TUT.b1done && G.mode === 'area' });
  await coach(null, '打贏了！出口的鎖解開了，往<b>光柱</b>走過去離開這張地圖吧。', { wait: () => TUT.exited });

  // ===== 2. 進化 =====
  G.mode = 'story'; showScreen('');
  await say('jijimon', '做得好！接下來是最重要的——<b>進化</b>！');
  RUN.courage = 35;
  const p2 = runBattle('goblimon', 2, { tutorial: 2, noFlee: true });
  B.hold = true; await sleep(500);
  await coach('#pPanel .courageBar', '這是<b>勇氣值</b>（全隊共用）。出牌、被攻擊都會慢慢增加，最多存 <b>40</b>。<br>集到 <b>30</b> 就能讓夥伴進化成<b>成熟期</b>！');
  B.hold = false;
  await waitFor(isPlayerTurn);
  if (B) await coach('#btnEvo', '老夫先幫你存了 35 點勇氣值。按<b>「進化」</b>（E 鍵）試試看！', { wait: () => !B || !$('#evoPanel').classList.contains('hidden') || B.p.tier > 0 });
  if (B && !B.p.tier) await coach('#evoPanel', '進化成<b>成熟期</b>要 30 點勇氣值。（完全體、究極體要等到第二部拿到徽章才會開放）<br>點<b>「進化 → 暴龍獸」</b>！', { wait: () => !B || B.p.tier > 0 });
  await sleep(1900);
  if (B) await coach('#hand', '進化後能力大增，這回合還多 1 點能量，並拿到 2 張<b>究極技</b>卡（金色的）！<br>究極技卡會<b>保留在手上</b>，能量不夠可以下回合再用。進化持續 3 回合後會退化。用究極技打倒哥布林獸吧！');
  await coach(null, '💡 <b>強行進化</b>：勇氣值不夠也能硬上（至少要 10 點），勇氣值會全部用掉。<br>先判定<b>成功</b>或<b>失敗</b>（失敗會受到反噬）；成功之後，缺越多越容易<b>失控</b>，變成會暴走的黑暗型態。<br>進化面板會顯示機率，自己判斷要不要賭！', {});
  await p2;

  // ===== 3. 勸降 =====
  G.mode = 'story'; showScreen('');
  await say('jijimon', '最後一課：被黑色齒輪控制的數碼寶貝，也可以<b>說服</b>牠成為夥伴。');
  const p3 = runBattle('kunemon', 2, { tutorial: 3, noFlee: true });
  B.hold = true; await sleep(400);
  B.e.hp = Math.round(B.e.maxhp * .2); RUN.courage = Math.max(RUN.courage, 20); renderBattle();
  await coach('#ePanel .bar.hp', '老夫先幫你把甲蟲獸打到只剩一點血了。<br>敵人的<b>血越少</b>，勸降的成功率就越高。');
  B.hold = false;
  await waitFor(isPlayerTurn);
  // 按勸降 → 跳出選代價的面板時，光圈要改成圈住面板（不然面板會被調暗、看起來像卡住）
  const panelOpen = () => !$('#persuadePanel').classList.contains('hidden');
  while (B && !B.persuaded) {
    await coach('#btnPersuade', '按<b>「勸降」</b>（R 鍵）。<br>按鈕上會顯示成功率；失敗的話敵人會被激怒喔！', { wait: () => !B || B.persuaded || panelOpen() });
    if (B && !B.persuaded && panelOpen())
      await coach('#persuadePanel', '選一個要付出的<b>代價</b>：勇氣值、數碼幣或能量都可以。<br>（這次一定會成功！）', { wait: () => !B || B.persuaded || !panelOpen() });
  }
  await p3;
  G.mode = 'story'; showScreen('');
  await say('jijimon', '甲蟲獸加入了隊伍！戰鬥中按<b>「換手」</b>（Q 鍵）可以換夥伴上場；出戰的夥伴倒下時，也會讓你選下一隻。全隊都倒下就輸了。');
  await say('jijimon', '正式的冒險裡，每一章是一張<b>路線圖</b>，從發光的節點往上走：⚔️戰鬥、💀精英、❓事件、💗回復泉、🛒商店、🥚數碼蛋、🎁寶藏、🧩古代遺跡，最後是😈頭目。');
  await say('jijimon', '撿到的道具放在<b>背包</b>（I 鍵），戰鬥中按「🎒 道具」（B 鍵）使用。<b>徽章道具</b>則是整局都有效的被動效果。');
  await say('jijimon', '戰鬥中忘記規則的話，按右上角的<b>「❓ 說明」</b>（H 鍵）就能隨時查看。');
  await say('jijimon', '冒險失敗就要從頭開始，但解鎖的角色、夥伴和結局都會保留。去吧，被選召的孩子！');

  // ===== 結束 =====
  const first = !META.tutorialDone;
  META.tutorialDone = true; META.tutorialAsked = true;
  if (first) META.tutBonus = true;
  saveMeta();
  G.tutorial = false; RUN = null; AREA = null; B = null;
  $('#hud').classList.add('hidden');
  if (first) toast('🎁 完成教學！第一次冒險會多送一瓶回復藥', 4000);
  showKidSelect();
}

// 教學的第一場戰鬥：行動條、能量、出牌、預告
async function tutBattle1() {
  const p = runBattle('numemon', 1, { tutorial: 1, noFlee: true });
  // 說明跳出來的時候卡片還是能點：玩家可能在說明講完前就把敵人打倒，所以每一步都要先確認戰鬥還在
  const watch = setInterval(() => { if (!B) { const b = document.querySelector('#coachTip:not(.hidden) button'); if (b) b.click(); } }, 200);   // 戰鬥結束了，剩下的說明自動關掉
  try {
    B.hold = true; await sleep(500);
    await coach('#pPanel .bar.atb', '這是你的<b>行動條</b>。時間會一直流動，<b>集滿就輪到你行動</b>！<br>夥伴的速度越快，集得越快。');
    await coach('#ePanel .bar.atb', '敵人也有行動條，集滿就會攻擊你。<br>所以這是一場「比快」的戰鬥！');
    await coach('#ePanel .intent', '敵人頭上會<b>預告</b>下一招和大概的傷害。<br>看到大招就先防禦，沒威脅就全力攻擊！');
    if (B) B.hold = false;
    await waitFor(isPlayerTurn);
    if (B) await coach('#orb', '輪到你了！你的回合<b>時間會暫停</b>，慢慢想沒關係。<br>這顆是<b>能量</b>，每回合有 3 點。');
    if (B) await coach('#hand', '這些是<b>手牌</b>，卡片左上角的數字是要花的能量。<br>點卡片（或按數字鍵 1～8）就能使用。');
    const n0 = B ? B.discard.length + B.exhaust.length : 0;
    if (B) await coach('#hand', '試試看：點一張<b>「撞擊」</b>攻擊蛞蝓獸！', { wait: () => !B || (B.discard.length + B.exhaust.length > n0 && !B.anim) });
    if (B && B.phase === 'player') await coach('#btnEnd', '想留著能量、或沒有能出的牌時，按<b>「結束回合」</b>（空白鍵）。<br>沒用完的能量最多可以<b>保留 2 點</b>到下回合！<br>卡片左下角的 <b>📌</b> 可以把牌<b>留到下回合</b>（最多 2 張），下回合會補滿到 5 張。', { wait: () => !B || B.phase !== 'player' });
    if (B) await coach(null, '接下來自己打打看，把蛞蝓獸打倒吧！打贏後可以從 3 張卡裡挑 1 張加入牌組。', { auto: 3500 });
  } catch (err) {   // 萬一還是出錯，也不要讓教學卡住
    console.error(err);
    $('#coachRing').classList.add('hidden'); $('#coachTip').classList.add('hidden');
  }
  clearInterval(watch);
  await p;
}
