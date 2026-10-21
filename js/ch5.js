'use strict';
/* =========================================================
   第五章「金字塔」＋第二部的地圖玩法
   - 金字塔迷宮：走道地圖、視野 -1、傳送點（捷徑）和傳送陷阱（送回入口／關在房間裡打怪）
   - 駭客終端：密碼配對小遊戲，成功就關掉機械猴子獸的一項能力
   - 徽章探索（第四、五章）：數碼裝置的冷熱反應，找到其他孩子的徽章
   - 演唱會小遊戲（第四章）：青蛙獸樂團，跟著節拍按
   ========================================================= */

// ---------- 機械猴子獸的能力（駭入終端可以一項一項關掉） ----------
const METAL_ABIL = {
  armor: { icon: '🛡️', name: '鋼鐵裝甲', desc: '受到的傷害 -25%' },
  net:   { icon: '📡', name: '黑暗網路', desc: '每次行動後回復最大 HP 1.5%' },
  over:  { icon: '⚡', name: '數據超載', desc: '每 4 次行動超載一次，下一次行動只要等一半的時間（頭上會先顯示 ⚡）' },
};
const hacked = () => (RUN && RUN.flags && RUN.flags.hacked) || [];
const metalOn = k => !hacked().includes(k);
let METAL_HEAL = .015;   // 黑暗網路：每次行動回復比例
let OVER_GAUGE = 50;     // 數據超載：觸發後行動條直接從一半開始
let METAL_ARMOR = .75;   // 鋼鐵裝甲：受到傷害倍率
let NOISE_PCT = .03;     // 金屬噪音：每張沒打出去的卡給他的護盾（最大 HP 比例）
Object.defineProperty(DOMAINS, 'metal', { enumerable: true, get() {
  const on = Object.keys(METAL_ABIL).filter(metalOn).map(k => METAL_ABIL[k].icon + METAL_ABIL[k].name);
  return { name: '鋼鐵演唱會', icon: '⚙️', desc: `${on.length ? on.join('、') : '能力全被駭入關掉了'}；⚙️ 金屬噪音：沒打出去的標記卡會給他護盾` };
} });
Object.defineProperty(BOSS_INFO, 'metal', { enumerable: true, get() {
  const rows = Object.keys(METAL_ABIL).map(k => { const a = METAL_ABIL[k];
    return metalOn(k) ? [`${a.icon} ${a.name}`, a.desc] : [`<s>${a.icon} ${a.name}</s>`, '💻 已經被你駭入關掉了！']; });
  rows.push(['⚙️ 金屬噪音', `每次行動後，你下一手牌會有 1 張（血量一半以下 2 張）被標上 ⚙️。<b>這回合沒打出去</b>的話，每張給他最大 HP ${Math.round(NOISE_PCT * 100)}% 的護盾。`]);
  return rows;
} });
// 金字塔的地圖節點：駭客終端
NODE_INFO.hack = { icon: '💻', name: '駭客終端' };

// ---------- 迷宮 ----------
function pyramidMaze(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = 'T';
  const cw = Math.floor((COLS - 2) / 2), chh = Math.floor((ROWS - 2) / 2);   // 迷宮格：x = 1,3,…,21；y = 1,3,…,13
  const seen = new Set(), st = [[0, 0]];
  const open = (cx, cy) => { T[cy * 2 + 1][cx * 2 + 1] = '.'; };
  open(0, 0); seen.add('0,0');
  while (st.length) {
    const [cx, cy] = st[st.length - 1];
    const nb = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < chh && !seen.has(`${nx},${ny}`));
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = nb[0];
    T[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = '.'; open(nx, ny); seen.add(`${nx},${ny}`); st.push([nx, ny]);
  }
  // 打掉一些牆，讓迷宮有環路（不然只有一條路太悶）
  for (let y = 1; y < ROWS - 2; y++) for (let x = 1; x < COLS - 2; x++) {
    if (T[y][x] !== 'T' || (x % 2) === (y % 2)) continue;
    const h = T[y][x - 1] === '.' && T[y][x + 1] === '.', v = T[y - 1][x] === '.' && T[y + 1][x] === '.';
    if ((h || v) && Math.random() < .12) T[y][x] = '.';
  }
  // 幾個小房間（放商店、泉水、NPC）
  for (let k = 0; k < randInt(2, 3); k++) {
    const cx = randInt(2, 10) * 2, cy = randInt(1, 6) * 2;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x > 0 && y > 0 && x < COLS - 2 && y < ROWS - 2) T[y][x] = '.';
  }
}
const oddRow = () => 2 * randInt(1, 6) + 1;   // 迷宮走道在奇數列

// genArea 結束前呼叫：第二部的額外物件
function extraObjs(nd, place, free, T, dist) {
  if (!P2() || nd.type === 'boss' || nd.type === 'tutorial') return;
  const openN = p => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !SOLID.has(T[p.y + dy][p.x + dx])).length;
  const deadEnds = (min = 5) => free(min).filter(p => openN(p) === 1);
  if (RUN.chapter === 5) {
    // 駭客終端：放在死路盡頭（不會擋路）
    if (nd.type === 'hack') { const d = deadEnds(6); place({ kind: 'hack' }, d.length ? d : free(6)); }
    // 傳送點：兩個死路盡頭互相連通（捷徑）
    const de = deadEnds(3);
    if (de.length >= 2) {
      const a = pick(de), far = de.filter(p => Math.abs(p.x - a.x) + Math.abs(p.y - a.y) >= 10);
      if (far.length) { const b = pick(far); const id = 'tp' + Math.random().toString(36).slice(2, 6);
        place({ kind: 'tp', link: id, side: 0 }, [a]); place({ kind: 'tp', link: id, side: 1 }, [b]); }
    }
    // 傳送陷阱：藏在走道上（數據掃描器可以照出來）
    for (let k = 0; k < randInt(2, 3); k++) place({ kind: 'trap', v: Math.random() < .5 ? 'back' : 'lock' }, free(5).filter(p => openN(p) === 2));
  }
  // 徽章探索：拿到自己的徽章之後，第四、五章大約 1/4 的地圖埋著別人的徽章
  if ((RUN.chapter === 4 || RUN.chapter === 5) && RUN.crest && crestLeft().length && nd.type !== 'shop' && Math.random() < .25)
    place({ kind: 'crest' }, free(10).length ? free(10) : free(6));
  // 演唱會：第四章的青蛙獸樂團
  if (RUN.chapter === 4 && ['battle', 'event', 'treasure'].includes(nd.type) && !F().bandN && Math.random() < .3)
    place({ kind: 'band', sp: 'gekomon', opt: true }, free(5));
  else if (RUN.chapter === 4 && ['battle', 'event', 'treasure'].includes(nd.type) && (F().bandN || 0) < 2 && Math.random() < .15)
    place({ kind: 'band', sp: 'gekomon', opt: true }, free(5));
}
// 物件種類：不會一直擋路的（不用檢查會不會堵住出口）
const PASS_KINDS = ['tp', 'trap', 'crest', 'hack', 'band'];

// ---------- 每格移動前：被關在陷阱房間裡就出不去 ----------
const sealBlocks = (A, x, y) => A.seal && Math.max(Math.abs(x - A.seal.x), Math.abs(y - A.seal.y)) > A.seal.r;
function ch5Tick(A) {
  if (A.seal && !A.objs.some(o => o.amb && !o.done)) { delete A.seal; sfx('portal'); toast('🔓 光牆消失了！可以離開了', 2500); saveRun(); }
}

// ---------- 畫物件 ----------
function drawCh5Obj(o, cx, cy, t) {
  const A = AREA;
  if (o.kind === 'tp') {
    const k = (t * .9 + o.side * .5) % 1;
    ctx.strokeStyle = `rgba(34,211,238,${.9 - k * .7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 6 + k * 9, 3 + k * 4, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 11, 5, 0, 0, 7); ctx.fill();
    emojiAt('🌀', cx, cy - 2 + Math.sin(t * 3) * 1.5, 16);
  } else if (o.kind === 'hack') {
    ctx.fillStyle = `rgba(74,222,128,${.25 + Math.sin(t * 4) * .1})`; ctx.beginPath(); ctx.arc(cx, cy + 2, 17, 0, 7); ctx.fill();
    emojiAt('💻', cx, cy + 2, 24);
  } else if (o.kind === 'band') {
    const sp = SPECIES[o.sp];
    ctx.fillStyle = 'rgba(253,224,71,.3)'; ctx.beginPath(); ctx.arc(cx, cy + 2, 18, 0, 7); ctx.fill();
    drawSprite(sp.img, sp.emoji, cx, cy + Math.abs(Math.sin(t * 6)) * -3, 34, false);
    emojiAt('🎵', cx + 13, cy - 16 + Math.sin(t * 5) * 3, 13);
  } else if (o.kind === 'crest') {   // 很靠近才看得到一點閃光
    if (Math.hypot(o.x - A.x, o.y - A.y) <= 1.6) { ctx.globalAlpha = .5 + Math.sin(t * 6) * .4; emojiAt('✨', cx, cy + 2, 18); ctx.globalAlpha = 1; }
  }
}
// 迷霧之上：陷阱房的光牆、掃描器照出的陷阱、徽章雷達
function drawCh5Overlay(A, rx, ry, t) {
  if (A.seal) {
    const s = A.seal, x0 = (s.x - s.r) * TS, y0 = (s.y - s.r) * TS, w = (s.r * 2 + 1) * TS;
    ctx.strokeStyle = `rgba(192,132,252,${.7 + Math.sin(t * 6) * .25})`; ctx.lineWidth = 4; ctx.strokeRect(x0 + 2, y0 + 2, w - 4, w - 4);
    ctx.strokeStyle = 'rgba(232,121,249,.35)'; ctx.lineWidth = 10; ctx.strokeRect(x0 + 2, y0 + 2, w - 4, w - 4);
  }
  if (A.scanned) for (const o of A.objs) {
    if (o.kind !== 'trap' || o.done) continue;
    const px = o.x * TS + 16, py = o.y * TS + 16;
    ctx.strokeStyle = `rgba(248,113,113,${.6 + Math.sin(t * 5) * .3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.stroke();
    emojiAt('⚠️', px, py, 12);
  }
}
// 畫面固定位置（不跟著鏡頭）：徽章雷達
function drawCrestRadar(A, rx, ry, t) {
  const c = A.objs.find(o => o.kind === 'crest' && !o.done);
  if (!c) return;
  const d = Math.abs(c.x - rx) + Math.abs(c.y - ry);
  const lv = d <= 3 ? 4 : d <= 6 ? 3 : d <= 10 ? 2 : d <= 15 ? 1 : 0;
  const txt = ['冷冰冰', '有一點反應', '溫溫的', '熱熱的！', '很燙！就在附近！'][lv], col = ['#60a5fa', '#a3e635', '#facc15', '#fb923c', '#ef4444'][lv];
  ctx.fillStyle = 'rgba(10,12,30,.72)'; ctx.fillRect(6, 6, 172, 26);
  ctx.font = '14px ' + EMOJI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('📟', 10, 19);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i <= lv ? col : 'rgba(255,255,255,.18)'; ctx.fillRect(32 + i * 9, 12 + (lv === 4 && i <= lv ? Math.sin(t * 20 + i) : 0), 6, 14); }
  ctx.fillStyle = col; ctx.font = 'bold 12px sans-serif'; ctx.fillText(txt, 82, 19);
}

// ---------- 互動 ----------
async function ch5Interact(o) {
  const A = AREA;
  if (o.kind === 'tp') {
    const to = A.objs.find(x => x.kind === 'tp' && x.link === o.link && x !== o);
    if (!to) return;
    sfx('portal'); G.trans = { t: 0 }; G.mode = 'transition'; await sleep(350);
    A.x = to.x; A.y = to.y; A.path = null; reveal();
    toast('🌀 傳送點！一下子跑到迷宮的另一邊', 2200);
  } else if (o.kind === 'trap') {
    o.done = true; sfx('wrongevo');
    G.trans = { t: 0 }; G.mode = 'transition'; await sleep(450);
    if (o.v === 'back') {
      A.x = A.start.x; A.y = A.start.y; A.path = null; reveal();
      await say(null, '⚠️ 踩到<b>傳送陷阱</b>了！地板一亮——被送回了入口！<br><small>（數據掃描器可以照出陷阱的位置）</small>');
    } else {
      A.x = o.x; A.y = o.y; A.path = null; reveal();
      A.seal = { x: o.x, y: o.y, r: 2 };
      const ch = CHAPTERS[RUN.chapter], lv = nodeLevel(A.nd.f);
      // 光牆裡面走得到的格子（不然敵人可能卡在牆的另一邊打不到）
      const cells = [], seen = new Set([`${o.x},${o.y}`]), q = [{ x: o.x, y: o.y }];
      while (q.length) { const c = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c.x + dx, y = c.y + dy, k = `${x},${y}`;
          if (seen.has(k) || sealBlocks(A, x, y) || SOLID.has(A.T[y][x]) || (x === A.exit.x && y === A.exit.y)) continue;
          seen.add(k); if (objAt(x, y)) continue; cells.push({ x, y }); q.push({ x, y }); } }
      cells.sort((a, b) => (Math.abs(b.x - o.x) + Math.abs(b.y - o.y)) - (Math.abs(a.x - o.x) + Math.abs(a.y - o.y)));
      const n = Math.min(2, cells.length) || 0;
      for (let k = 0; k < n; k++) { const sp = pick(ch.zone); loadImg(SPECIES[sp].img); A.objs.push({ kind: 'enemy', role: 'roam', amb: true, sp, lv, cd: 1.5, x: cells[k].x, y: cells[k].y }); }
      if (!n) delete A.seal;
      await say(null, '⚠️ 踩到<b>封鎖陷阱</b>！四周升起了紫色的光牆，敵人冒了出來——<b>打倒牠們</b>才能離開！');
    }
  } else if (o.kind === 'hack') {
    const c = await ask(null, '💻 一台還在運作的古代終端機，螢幕上閃著機械猴子獸的程式碼……<br>駭進去的話，可以關掉牠的一項能力。', [
      { text: '開始駭入', note: '密碼配對：記住數碼寶貝出現的順序' }, { text: '先不要', note: '待會再來' }]);
    if (c !== 0) return;
    o.done = true;
    const len = Math.min(6, 4 + hacked().length);
    const ok = await hackGame(len);
    if (ok) await hackReward(); else { teamDamage(.08); updateHUD(); await say(null, '💥 防火牆反擊！全隊受到 8% 的傷害，終端機也當機了……'); }
  } else if (o.kind === 'crest') {
    o.done = true; await crestFound();
  } else if (o.kind === 'band') {
    const c = await ask('gekomon', '呱～！我們是沙漠樂團！要不要一起來場演奏？<br>跟著節拍按，按得準就有獎品喔！', [
      { text: '🎺 一起演奏！', note: '跟著節拍點畫面（或按空白鍵）' }, { text: '不用了', note: '' }]);
    if (c !== 0) return;
    o.done = true; F().bandN = (F().bandN || 0) + 1;
    await concertGame();
  }
}

// ---------- 駭客小遊戲：密碼配對 ----------
const HACK_POOL = ['agumon', 'gabumon', 'piyomon', 'tentomon', 'palmon', 'gomamon', 'patamon', 'numemon', 'gekomon', 'gazimon', 'guardromon', 'kunemon'];
function hackGame(len) {
  return new Promise(resolve => {
    const pool = shuffle(HACK_POOL.filter(s => SPECIES[s])).slice(0, 8), seq = [];
    while (seq.length < len) { const k = pick(pool); if (k !== seq[seq.length - 1]) seq.push(k); }   // 不會連續出現同一隻
    let lives = 3, pos = 0, busy = true;
    const o = $('#overlay');
    o.innerHTML = `<div class="hackBox"><h2>💻 密碼配對</h2><p class="hackTip">記住數碼寶貝出現的<b>順序</b>（共 ${len} 個）</p>
      <div class="hackShow"></div><div class="hackSlots">${seq.map(() => '<i></i>').join('')}</div>
      <div class="hackLives"></div><div class="hackGrid">${pool.map(s => `<button class="hackBtn" data-s="${s}">${spPic(s, 's64')}</button>`).join('')}</div></div>`;
    o.classList.remove('hidden');
    const show = o.querySelector('.hackShow'), tip = o.querySelector('.hackTip'), slots = [...o.querySelectorAll('.hackSlots i')];
    const lifeUI = () => o.querySelector('.hackLives').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
    lifeUI();
    const done = ok => { busy = true; setTimeout(() => { o.classList.add('hidden'); o.innerHTML = ''; resolve(ok); }, 900); };
    const play = async () => {
      busy = true; o.querySelector('.hackGrid').classList.add('dim'); slots.forEach(s => s.className = '');
      tip.innerHTML = `記住數碼寶貝出現的<b>順序</b>（共 ${len} 個）`;
      await sleep(500);
      for (let i = 0; i < seq.length; i++) {
        show.innerHTML = spPic(seq[i], 's80'); show.classList.remove('pop'); void show.offsetWidth; show.classList.add('pop'); slots[i].className = 'on'; sfx('click');
        await sleep(750); show.innerHTML = ''; await sleep(160);
      }
      slots.forEach(s => s.className = ''); show.innerHTML = '<span>❓</span>';
      tip.innerHTML = '照順序點出來！'; o.querySelector('.hackGrid').classList.remove('dim'); busy = false; pos = 0;
    };
    o.querySelectorAll('.hackBtn').forEach(b => b.onclick = () => {
      if (busy) return;
      if (b.dataset.s === seq[pos]) {
        slots[pos].className = 'ok'; pos++; sfx('pickup');
        if (pos >= seq.length) { tip.innerHTML = '✅ <b>駭入成功！</b>'; sfx('levelup'); done(true); }
      } else {
        lives--; lifeUI(); sfx('error'); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 400);
        if (lives <= 0) { tip.innerHTML = '❌ <b>駭入失敗……</b>'; done(false); }
        else { tip.innerHTML = `❌ 錯了！還剩 ${lives} 次機會，再看一次`; busy = true; setTimeout(play, 800); }
      }
    });
    play();
  });
}
async function hackReward() {
  const left = Object.keys(METAL_ABIL).filter(metalOn);
  if (!left.length) { const b = gainBits(80); await say(null, `駭入成功！機械猴子獸的能力已經全部關掉了，終端機吐出了 💰 ${b} 數碼幣。`); return; }
  const k = await pickScreen({ title: '💻 駭入成功！', sub: '選一項機械猴子獸的能力關掉（頭目戰時就不會發動）', items: left, allowSkip: false, render: k => {
    const a = METAL_ABIL[k], el = document.createElement('div'); el.className = 'relic clickable';
    el.innerHTML = `<div class="ri">${a.icon}</div><div><b>${a.name}</b><div class="rd">${a.desc}</div></div>`; return el; } });
  F().hacked = [...hacked(), k];
  await say(null, `💻 ${METAL_ABIL[k].icon} <b>${METAL_ABIL[k].name}</b>已經關掉了！（還剩 ${Object.keys(METAL_ABIL).filter(metalOn).length} 項）`);
}

// ---------- 徽章探索 ----------
const crestLeft = () => Object.keys(KIDS).filter(k => k !== RUN.kid && !(RUN.crests || []).includes(k));
const crestPartner = f => P2() && !!f && !!f.m && ((RUN.crests || []).some(k => KIDS[k] && KIDS[k].partner === f.m.sp) || (RUN.crestBinds || []).includes(f.m.uid));   // 徽章的主人（那個孩子的搭檔，或認主的夥伴）：不是隊長也能超進化
async function crestFound() {
  const left = crestLeft(); if (!left.length) return;
  const k = pick(left), kid = KIDS[k];
  const rk = Object.keys(RELICS).find(r => RELICS[r].name === kid.crest + '徽章');
  RUN.crests = [...(RUN.crests || []), k];
  if (rk && !has(rk)) RUN.relics.push(rk);
  RUN.crestTicks = (RUN.crestTicks || 0) + 1;
  const partner = SPECIES[kid.partner], inTeam = RUN.team.some(m => m.sp === kid.partner);
  const bg = RUN.chapter === 5 ? 'pyramid' : 'desert';
  await cutscene([{ bg, music: 'route', amb: 'wind', chars: [['partner', 22, 76, 28, 'in-l']], fx: `<div class="cutCrest" data-from="1">${kid.icon}</div>`,
    lines: [[null, '數碼裝置的反應強到發燙——沙子底下埋著一枚發光的徽章！'], [null, `是<b>${kid.name}</b>的<b>${kid.crest}徽章</b>！`],
      [null, `${rk ? `🔰 獲得 <b>${RELICS[rk].icon} ${RELICS[rk].name}</b>：${RELICS[rk].desc}<br>` : ''}🔰 徽章刻度 +1（現在 ${RUN.crestTicks} 格）` +
        (inTeam ? `<br>🔰 隊伍裡的<b>${partner.name}</b>就算不是隊長，也能超進化了！` : '')]] }]);
  if (!inTeam) await crestCall(kid, partner);
  saveRun(); updateHUD();
}
// 隊伍裡沒有那個孩子的搭檔：搭檔循著徽章的光跑來；拒絕的話，徽章改成「認主」
async function crestCall(kid, partner) {
  loadImg(partner.img);
  await cutscene([{ bg: RUN.chapter === 5 ? 'pyramid' : 'desert', music: 'route', amb: 'wind', chars: [[partner.img, 70, 76, 30, 'in-r'], ['partner', 22, 78, 26, 'in-l']],
    lines: [[null, '徽章的光芒射向遠方——有誰朝這裡跑過來了！'], [{ img: partner.img, name: partner.name }, `這是${kid.nick}的徽章……！我感覺得到它在呼喚我！`]] }]);
  const avg = Math.max(1, Math.round(RUN.team.reduce((a, m) => a + m.level, 0) / RUN.team.length));
  const c = await ask(null, `<b>${partner.name}</b>想跟著${kid.crest}徽章一起戰鬥。<br>要讓牠加入隊伍嗎？（Lv.${avg}，不是隊長也能超進化）`, [
    { text: `🤝 讓${partner.name}加入`, note: RUN.team.length >= teamMax() ? '隊伍滿了，要選一隻夥伴離開' : `Lv.${avg} 加入隊伍` },
    { text: '🔰 不用了，讓徽章認主', note: '從隊伍裡選一隻夥伴綁定這枚徽章，牠不是隊長也能超進化' }]);
  if (c === 0) {
    let ok = true;
    if (RUN.team.length >= teamMax()) {
      const m = await pickScreen({ title: '隊伍已經滿了！', sub: `要讓哪一隻夥伴離開，換 ${partner.name} 加入？（隊長不能離開）`, skip: '還是不要了（改成讓徽章認主）',
        items: RUN.team.slice(1), render: m => { const s = SPECIES[m.sp], el = document.createElement('div'); el.className = 'pickMon';
          el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}</span>`; return el; } });
      if (!m) ok = false;
      else { RUN.team.splice(RUN.team.indexOf(m), 1); toast(`${SPECIES[m.sp].name} 離開了隊伍`); }
    }
    if (ok) { joinTeam(kid.partner, avg); await say(null, `✨ <b>${partner.name}</b> 加入了隊伍！牠和${kid.crest}徽章心意相通，不是隊長也能超進化。`); return; }
  }
  const pickable = RUN.team.filter(m => !crestPartner({ m }) && m !== RUN.team[0]);
  if (!pickable.length) { await say(null, '隊伍裡的夥伴都已經能超進化了，徽章的力量收進了數碼裝置裡。'); return; }
  const m = await pickScreen({ title: `🔰 ${kid.crest}徽章要認誰當主人？`, sub: '被選中的夥伴不是隊長也能超進化（隊長本來就可以）', items: pickable, allowSkip: false,
    render: m => { const s = SPECIES[m.sp], el = document.createElement('div'); el.className = 'pickMon';
      el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}</span>`; return el; } });
  RUN.crestBinds = [...(RUN.crestBinds || []), m.uid];
  await say(null, `🔰 ${kid.crest}徽章認 <b>${SPECIES[m.sp].name}</b> 當主人了！牠不是隊長也能超進化。`);
}

// ---------- 演唱會小遊戲（青蛙獸樂團） ----------
function concertGame() {
  return new Promise(resolve => {
    const BPM = 108, beat = 60 / BPM, TRAVEL = 1.7, N = 16;
    // 拍子：前半規律、後半有反拍
    const pat = [0, 1, 2, 3, 4, 5, 6, 6.5, 8, 9, 10, 10.5, 11, 12, 13, 14];
    const notes = pat.slice(0, N).map(b => ({ t: 2 + b * beat, hit: null }));
    const o = $('#overlay');
    o.innerHTML = `<div class="bandBox"><h2>🎺 沙漠樂團</h2><p class="bandTip">音符碰到圓圈時點一下（或按空白鍵）</p>
      <div class="bandLane"><div class="bandRing"></div></div><div class="bandJudge"></div><div class="bandScore">0</div>
      <button class="btn primary big bandTap">🎵 按！</button></div>`;
    o.classList.remove('hidden');
    const lane = o.querySelector('.bandLane'), judge = o.querySelector('.bandJudge'), scoreEl = o.querySelector('.bandScore');
    notes.forEach(n => { n.el = document.createElement('i'); n.el.className = 'bandNote'; lane.appendChild(n.el); });
    G.cut = { music: null };   // 背景音樂先停
    const ac = SFX.on ? audioCtx() : null, t0 = performance.now() / 1000, a0 = ac ? ac.currentTime : 0;
    if (ac) {   // 伴奏：每拍的鼓和每半拍的鈸，音符位置有喇叭聲
      for (let b = 0; b < 16; b++) { tone({ f: 120, f2: 50, type: 'sine', dur: .14, vol: .35, delay: 2 + b * beat }); noise({ dur: .04, vol: .06, freq: 7000, type: 'highpass', delay: 2 + (b + .5) * beat }); }
      notes.forEach((n, i) => tone({ f: [523, 659, 784, 659][i % 4], type: 'triangle', dur: .12, vol: .1, delay: n.t }));
      void a0;
    }
    let score = 0, ended = false;
    const now = () => performance.now() / 1000 - t0;
    const flash = (txt, cls) => { judge.textContent = txt; judge.className = 'bandJudge ' + cls; void judge.offsetWidth; judge.classList.add('pop'); };
    const tap = () => {
      if (ended) return;
      const t = now(); let best = null;
      for (const n of notes) if (!n.hit && Math.abs(n.t - t) < .26 && (!best || Math.abs(n.t - t) < Math.abs(best.t - t))) best = n;
      if (!best) { flash('…', 'miss'); return; }
      const d = Math.abs(best.t - t);
      if (d < .09) { best.hit = 'p'; score += 2; flash('完美！', 'perfect'); if (ac) tone({ f: 1046, type: 'square', dur: .06, vol: .08 }); }
      else if (d < .18) { best.hit = 'g'; score += 1; flash('不錯！', 'good'); }
      else { best.hit = 'm'; flash('MISS', 'miss'); }
      best.el.classList.add(best.hit === 'm' ? 'gone' : 'hitOk');
      scoreEl.textContent = score;
    };
    const key = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); tap(); } };
    document.addEventListener('keydown', key);
    o.querySelector('.bandTap').onpointerdown = e => { e.preventDefault(); tap(); };
    lane.onpointerdown = e => { e.preventDefault(); tap(); };
    const frame = () => {
      if (ended) return;
      const t = now();
      for (const n of notes) {
        const k = (n.t - t) / TRAVEL;   // 1 → 右邊，0 → 圓圈
        if (!n.hit && t > n.t + .26) { n.hit = 'm'; n.el.classList.add('gone'); flash('MISS', 'miss'); }
        n.el.style.left = `calc(${12 + k * 85}% - 14px)`;
        n.el.style.opacity = k > 1.05 ? 0 : 1;
      }
      if (t > notes[notes.length - 1].t + .8) return finish();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const finish = async () => {
      ended = true; document.removeEventListener('keydown', key);
      o.classList.add('hidden'); o.innerHTML = ''; G.cut = null;
      const max = N * 2;
      if (score >= max * .75) {
        const b = gainBits(70);
        await say('gekomon', `呱呱！太棒了！${score}/${max} 分！這是演出費 💰 ${b}，還有我們的珍藏樂譜！`);
        const id = await pickScreen({ title: '🎼 樂團的珍藏樂譜', sub: '選一張加入牌組', items: shuffle([...rewardPool()]).slice(0, 3), render: id => cardEl(id) });
        if (id) await acquireCard(id);
      } else if (score >= max * .4) {
        const b = gainBits(35); teamHeal(.15);
        await say('gekomon', `呱～還不錯喔！${score}/${max} 分。拿去吧，💰 ${b} 數碼幣！（聽完音樂，全隊回復了 15% HP）`);
      } else {
        teamDamage(.06);
        await say('gekomon', `呱！？${score}/${max} 分……完全跟不上節拍啦！大家氣得拿喇叭敲你們！（全隊受到 6% 傷害）`);
      }
      updateHUD();
      resolve();
    };
  });
}
