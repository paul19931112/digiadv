'use strict';
/* =========================================================
   數碼冒險 RPG（第一章試玩）— 畫面、操作、任務、存檔、主迴圈
   ========================================================= */
const SAVE_KEY = 'digimon-rpg-trial-save';

// ---------- 音效（Web Audio 合成，不用音檔） ----------
let AC = null, MUTED = false, sfxLast = {};
try { MUTED = localStorage.getItem('digimon-rpg-mute') === '1'; } catch (e) { }
function setMute(m) { MUTED = m; try { localStorage.setItem('digimon-rpg-mute', m ? '1' : '0'); } catch (e) { } document.querySelectorAll('.muteBtn').forEach(b => b.textContent = m ? '🔇' : '🔊'); }
function tone(f, f2, dur, vol = .08, type = 'square', delay = 0) {
  if (MUTED) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur);
  } catch (e) { }
}
const SFX = {
  shoot: () => tone(600, 300, .06, .02, 'triangle'), hit: () => tone(180, 90, .05, .03),
  exp: () => tone(1100, 1600, .05, .025, 'sine'), coin: () => { tone(1300, 0, .05, .03, 'square'); tone(1900, 0, .08, .03, 'square', .05); },
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0, .15, .06, 'triangle', i * .07)),
  hurt: () => tone(160, 60, .2, .07, 'sawtooth'),
  evolve: () => { tone(150, 1200, .9, .07, 'sawtooth'); tone(1046, 0, .4, .07, 'triangle', .7); },
  boss: () => { tone(110, 70, .5, .08, 'sawtooth'); tone(90, 60, .6, .07, 'sawtooth', .15); },
  win: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0, .22, .06, 'triangle', i * .1)),
  chest: () => [660, 880, 1320].forEach((f, i) => tone(f, 0, .14, .05, 'triangle', i * .08)),
  ring: () => { for (let i = 0; i < 6; i++) tone(1400, 0, .05, .04, 'square', i * .07); },
  rumble: () => tone(70, 40, .8, .1, 'sawtooth'), dash: () => tone(300, 120, .25, .05, 'sawtooth'),
  talk: () => tone(880, 0, .03, .02, 'square'), quest: () => [659, 784, 1046].forEach((f, i) => tone(f, 0, .18, .06, 'sine', i * .09)),
};
function sfx(k) { const n = performance.now(); if (n - (sfxLast[k] || 0) < 55) return; sfxLast[k] = n; SFX[k] && SFX[k](); }

// ---------- 小提示 ----------
function toast(t, ms = 2600) { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = t; $('#toasts').appendChild(d); setTimeout(() => d.remove(), ms); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove(); }
let bannerT;
function banner(t) { const b = $('#banner'); b.textContent = t; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2200); }
const v3 = new THREE.Vector3();
function dmgText(x, y, z, txt, cls) {
  const L = $('#dmgLayer'); if (L.children.length > 45) return;
  v3.set(x, y, z).project(camera); if (v3.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = txt;
  d.style.left = (v3.x * .5 + .5) * innerWidth + 'px'; d.style.top = (-v3.y * .5 + .5) * innerHeight + 'px';
  L.appendChild(d); setTimeout(() => d.remove(), 600);
}
function hurtFlash() { const h = $('#hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 120); }
function bossBar(b) {
  const el = $('#bossBar');
  if (!b || b.dead) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('#bossName').textContent = (b.elite ? '⭐ ' : '😈 ') + b.name + (b.phase > 1 ? '（狂暴）' : '');
  el.querySelector('i').style.width = Math.max(0, b.hp / b.maxhp * 100) + '%';
}

// ---------- 對話 ----------
const UI = { dlg: false, panel: null, lv: false, title: true };
let dlgNext = null;
function portrait(who) {
  const w = WHO[who] || { ic: '💬' };
  return w.img ? `<img src="${SPRITES[w.img]}" alt="">` : w.ic;
}
function showLine(who, txt) {
  $('#dlg').classList.remove('hidden'); UI.dlg = true;
  $('#dlgPic').innerHTML = portrait(who); $('#dlgName').textContent = who === '旁白' ? '' : who; $('#dlgTxt').innerHTML = txt; $('#dlgOpts').innerHTML = '';
  sfx('talk');
}
function say(lines) {
  return new Promise(res => {
    let i = 0;
    const step = () => {
      if (i >= lines.length) { dlgNext = null; $('#dlg').classList.add('hidden'); UI.dlg = false; return res(); }
      const [who, txt] = lines[i++]; showLine(who, txt); $('#dlgMore').classList.remove('hidden');
      dlgNext = step;
    };
    step();
  });
}
function ask(who, txt, opts) {
  return new Promise(res => {
    showLine(who, txt); $('#dlgMore').classList.add('hidden'); dlgNext = null;
    const box = $('#dlgOpts');
    opts.forEach((o, i) => { const b = document.createElement('button'); b.className = 'opt'; b.innerHTML = o; b.onclick = e => { e.stopPropagation(); $('#dlg').classList.add('hidden'); UI.dlg = false; res(i); }; box.appendChild(b); });
  });
}
$('#dlg').onclick = () => dlgNext && dlgNext();

// ---------- 拿到東西 ----------
function give(k, n) {
  if (k === 'coin') { G.coin += n; } else G[k] = (G[k] || 0) + n;
  updateHUD();
}
function giveAcc(id, popup) {
  if (G.acc.includes(id)) { give('coin', 100); return toast(`已經有${ACC[id].name}了，換成 💰 100`); }
  G.acc.push(id);
  let msg = `${ACC[id].ic} 得到飾品：<b>${ACC[id].name}</b>`;
  if (ACC[id].passive) msg += '（放在背包就有效）';
  else if (G.eq.length < 3) { G.eq.push(id); calcStats(); msg += '（已自動裝備）'; } else msg += '（按 B 可以裝備）';
  toast(msg, 3600); sfx('chest'); save();
}
function secret(k) { if (G.secrets[k]) return; G.secrets[k] = 1; toast(`🔍 發現秘密：<b>${SECRETS[k]}</b>（${Object.keys(G.secrets).length}/${Object.keys(SECRETS).length}）`, 3600); sfx('quest'); save(); }
function joinParty(id) { if (!G.party.includes(id)) G.party.push(id); buildParty(); calcStats(); updateHUD(); save(); }

// ---------- 任務 ----------
function qStart(id) { if (G.q[id] !== undefined) return; G.q[id] = 0; toast(`📜 新任務：<b>${QUESTS[id].title}</b>`, 3200); sfx('quest'); updateTrack(); save(); }
function qSet(id, s) { G.q[id] = s; const st = QUESTS[id].steps[s]; if (st) toast(`📜 ${QUESTS[id].title}：${typeof st.text === 'function' ? st.text() : st.text}`, 3200); sfx('quest'); updateTrack(); save(); }
function qDone(id) { if (G.q[id] === 'done') return; G.q[id] = 'done'; toast(`✅ 任務完成：<b>${QUESTS[id].title}</b>`, 3200); sfx('win'); updateTrack(); save(); }
function checkQuests() {
  if (G.q.eggs === 0 && G.eggs.length >= 5) qSet('eggs', 1);
  if (G.q.gears === 0 && G.gears.length >= 5) qSet('gears', 1);
  if (G.q.mush === 0 && G.mush >= 5) qSet('mush', 1);
  updateTrack();
}
const qIsDone = id => G.q[id] === 'done' || (id === 'main' && G.q.main >= QUESTS.main.steps.length);
function checkMain() { if (G.q.main === 5 && G.flags.mono) qSet('main', 6); }
function questAt(c) {
  if (c === 'x') return { x: wx(16), z: wz(3) };
  const e = ent(c); return e ? { x: e.x, z: e.z } : null;
}
// 追蹤中的任務（點一下可以換）
function activeQuests() { return Object.keys(QUESTS).filter(id => G.q[id] !== undefined && G.q[id] !== 'done' && QUESTS[id].steps[G.q[id]]); }
function trackedQuest() { const L = activeQuests(); if (!L.includes(G.track)) G.track = L.includes('main') ? 'main' : L[0]; return G.track; }
function updateTrack() {
  const id = trackedQuest(), el = $('#track');
  if (!id) { el.innerHTML = G.q.main === 7 ? '🏆 第一章完成！<small>島上還有秘密嗎……？</small>' : ''; W.target = null; return; }
  const Q = QUESTS[id], st = Q.steps[G.q[id]];
  const txt = typeof st.text === 'function' ? st.text() : st.text;
  W.target = st.at ? questAt(st.at) : null;
  const d = W.target ? Math.round(Math.hypot(W.target.x - G.pos.x, W.target.z - G.pos.z) / CELL) : null;
  el.innerHTML = `${Q.main ? '⭐' : '📜'} ${txt}<small>${Q.title}${d !== null ? `　·　${d} 步` : ''}${activeQuests().length > 1 ? '　·　點這裡換任務' : ''}</small>`;
}
$('#track').onclick = () => { const L = activeQuests(); if (L.length < 2) return; G.track = L[(L.indexOf(trackedQuest()) + 1) % L.length]; updateTrack(); };

// ---------- HUD ----------
function updateHUD() {
  if (!G || !W.st) return;
  $('#lvTxt').textContent = `Lv.${G.lv}`;
  $('#hpBar i').style.width = (G.hp / W.st.maxhp * 100) + '%'; $('#hpTxt').textContent = `${Math.ceil(G.hp)} / ${W.st.maxhp}`;
  $('#expBar i').style.width = (G.exp / needExp(G.lv) * 100) + '%';
  $('#evoBar').classList.toggle('hidden', !G.evoOn);
  $('#evoBar i').style.width = (W.evoT > 0 ? W.evoT / W.st.evoDur * 100 : G.evo) + '%';
  $('#evoBar').classList.toggle('full', G.evo >= 100 && !W.evoT);
  $('#btnEvo').classList.toggle('hidden', !G.evoOn);
  $('#btnEvo').classList.toggle('ready', G.evo >= 100 && !W.evoT);
  $('#btnEvo').classList.toggle('off', G.evo < 100 && !W.evoT);
  $('#coinTxt').textContent = `💰 ${G.coin}`;
  $('#meatN').textContent = `R ×${G.meat}`;
  $('#btnDash').classList.toggle('off', (W.dashCd || 0) > 0);
  $('#partyTxt').innerHTML = W.party.map(p => W.evoT > 0 ? `<b>${p.P.evoName}</b>` : p.P.name).join('・') + (W.evoT > 0 ? `　✨ ${Math.ceil(W.evoT)} 秒` : '');
}
function clockText() { const h = Math.floor((G.time * 24 + 6) % 24); return `${night() ? '🌙' : h >= 17 && h < 19 ? '🌇' : '☀️'} ${String(h).padStart(2, '0')}:00`; }

// ---------- 升級 ----------
function showLevelUp() {
  UI.lv = true;
  const opts = UPGRADES.filter(u => (G.ups[u.id] || 0) < u.max && (!u.need || u.need())).sort(() => Math.random() - .5).slice(0, 3);
  $('#levelTitle').textContent = `升級！Lv.${G.lv}`;
  const box = $('#choices'); box.innerHTML = '';
  opts.forEach((u, i) => {
    const el = document.createElement('div'); el.className = 'choice';
    el.innerHTML = `<div class="ic">${u.ic}</div><div><b>${u.name}</b><small>${u.desc}</small><span class="lvl">目前 ${G.ups[u.id] || 0}/${u.max}　·　按 ${i + 1}</span></div>`;
    el.onclick = () => chooseUp(u); box.appendChild(el);
  });
  UI.lvOpts = opts;
  $('#levelPanel').classList.remove('hidden'); sfx('level');
}
function chooseUp(u) {
  if (!UI.lv) return;
  G.ups[u.id] = (G.ups[u.id] || 0) + 1;
  calcStats(); heal(W.st.maxhp * .15);
  UI.lv = false; $('#levelPanel').classList.add('hidden');
  W.lvQueue--; updateHUD(); save();
}
function gainExp(v) {
  G.exp += v;
  while (G.exp >= needExp(G.lv)) { G.exp -= needExp(G.lv); G.lv++; W.lvQueue++; calcStats(); heal(12); }
  updateHUD();
}

// ---------- 視窗：任務、背包、地圖、商店 ----------
function openWin(kind, html) {
  UI.panel = kind;
  $('#winBox').innerHTML = `<button class="x" onclick="closeWin()">✕</button>` + html;
  $('#winPanel').classList.remove('hidden');
}
function closeWin() { UI.panel = null; $('#winPanel').classList.add('hidden'); updateHUD(); }
$('#winPanel').onclick = e => { if (e.target.id === 'winPanel') closeWin(); };
function showQuests() {
  const L = Object.keys(QUESTS).filter(id => G.q[id] !== undefined);
  const row = id => {
    const Q = QUESTS[id], s = G.q[id], done = s === 'done' || (id === 'main' && s >= Q.steps.length);
    const st = Q.steps[s]; const txt = done ? '✅ 完成' : typeof st.text === 'function' ? st.text() : st.text;
    return `<div class="q ${done ? 'done' : ''}"><b>${Q.main ? '⭐' : Q.hidden ? '🔮' : '📜'} ${Q.title}</b><br>${txt}</div>`;
  };
  const sec = Object.keys(SECRETS);
  openWin('quest', `<h2>📜 任務</h2>
    <div class="sec">進行中</div>${L.filter(id => !qIsDone(id)).map(row).join('') || '<div class="q">沒有進行中的任務</div>'}
    <div class="sec">已完成</div>${L.filter(qIsDone).map(row).join('') || '<div class="q done">還沒有</div>'}
    <div class="sec">🔍 發現的秘密（${Object.keys(G.secrets).length}/${sec.length}）</div>
    <div class="q">${sec.map(k => G.secrets[k] ? '✔️ ' + SECRETS[k] : '❔ ？？？').join('<br>')}</div>
    <p style="font-size:12px;color:#9aa3d6;text-align:center">小提示：跟村民多聊幾次，會聽到不同的傳聞。</p>`);
}
function showBag() {
  const st = W.st, f = x => Math.round(x * 100);
  const items = ['meat', 'bigMeat', 'mush'].filter(k => G[k] > 0).map(k => `<div class="card" ${k === 'mush' ? '' : `onclick="useItem('${k}')"`}><div class="t">${ITEM[k].ic} ${ITEM[k].name} ×${G[k]}</div><div class="d">${ITEM[k].desc}${k !== 'mush' ? '<br>👉 點一下使用' : ''}</div></div>`).join('') || '<div class="q">空空的</div>';
  const accs = G.acc.map(id => { const a = ACC[id], on = G.eq.includes(id); return `<div class="card ${on ? 'on' : ''}" onclick="toggleEq('${id}')"><div class="t">${a.ic} ${a.name}${on ? '　✔️' : ''}</div><div class="d">${a.desc}</div></div>`; }).join('') || '<div class="q">還沒有飾品。打倒頭目、開寶箱、完成任務、在商店購買都能拿到。</div>';
  const ups = UPGRADES.filter(u => G.ups[u.id]).map(u => `${u.ic} ${u.name} ${G.ups[u.id]}`).join('　') || '還沒有';
  openWin('bag', `<h2>🎒 背包</h2>
    <div class="stats"><span>Lv ${G.lv}</span><span>HP ${Math.ceil(G.hp)}/${st.maxhp}</span><span>傷害 ×${st.dmg.toFixed(2)}</span><span>攻速 ×${st.rate.toFixed(2)}</span>
    <span>爆擊 ${f(st.crit)}%（×${st.critDmg.toFixed(1)}）</span><span>受傷 ×${st.armor.toFixed(2)}</span><span>移動 ${st.move.toFixed(1)}</span><span>回復 ${st.regen.toFixed(1)}/秒</span></div>
    <div class="sec">道具</div><div class="grid">${items}</div>
    <div class="sec">飾品（裝備中 ${G.eq.length}/3，點一下裝上／拿下）</div><div class="grid">${accs}</div>
    <div class="sec">升級強化</div><div class="q">${ups}</div>`);
}
function toggleEq(id) {
  const i = G.eq.indexOf(id);
  if (ACC[id].passive) { toast('這個放在背包就有效，不用裝備'); return; }
  if (i >= 0) G.eq.splice(i, 1);
  else { if (G.eq.length >= 3) { toast('最多只能裝備 3 個飾品，先拿下一個'); return; } G.eq.push(id); }
  calcStats(); save(); showBag();
}
function useItem(k) {
  if (k === 'meat') eatMeat();
  if (k === 'bigMeat' && G.bigMeat > 0) { G.bigMeat--; heal(9999); sfx('exp'); }
  if (UI.panel === 'bag') showBag();
}
function eatMeat() {
  if (G.meat <= 0) return toast('沒有肉了！雜貨店可以買');
  if (G.hp >= W.st.maxhp) return toast('HP 是滿的');
  if (W.meatCd > 0) return;
  G.meat--; W.meatCd = 1; heal(W.st.maxhp * .35); sfx('exp'); updateHUD();
}
function openShop(k) {
  const S = SHOPS[k];
  const html = S.items.filter(it => !it.need || it.need()).map((it, i) => {
    const info = it.acc ? ACC[it.acc] : ITEM[it.k], owned = it.acc && G.acc.includes(it.acc);
    return `<div class="card" onclick="buy('${k}',${i})"><div class="t">${info.ic} ${info.name}</div><div class="d">${info.desc}</div><div class="p">${owned ? '已經有了' : '💰 ' + it.price}${it.k ? `　（有 ${G[it.k] || 0} 個）` : ''}</div></div>`;
  }).join('');
  openWin('shop', `<h2>🛒 ${S.name}</h2><p style="text-align:center">💰 ${G.coin} 數碼幣</p><div class="grid">${html}</div>`);
  UI.shop = k;
}
function buy(k, i) {
  const it = SHOPS[k].items.filter(it => !it.need || it.need())[i];
  if (it.acc && G.acc.includes(it.acc)) return;
  if (G.coin < it.price) { toast('數碼幣不夠……'); return; }
  G.coin -= it.price;
  if (it.acc) giveAcc(it.acc); else { give(it.k, 1); sfx('coin'); }
  save(); openShop(k);
}
// 地圖
const MAPC = { '.': '#5f9f4a', t: '#3d7a35', q: '#3d7a35', p: '#2a5a2c', f: '#6fae58', ',': '#e0cc90', '~': '#2f74b8', s: '#7a8a9a', b: '#9a6a3a', r: '#80887a', '#': '#5a5248',
  '=': '#c4a26a', h: '#e8524a', l: '#ff6a1a', ':': '#5a4a44', c: '#4b4458', x: '#5a5262', g: '#aa3030', w: '#9ad6ff' };
function drawMap(cv, cx0, cy0, n, px) {
  const g = cv.getContext('2d'); g.fillStyle = '#05070f'; g.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) {
    const X = cx0 + x, Y = cy0 + y;
    if (X < 0 || Y < 0 || X >= MW || Y >= MH || !SEEN[Y * MW + X]) continue;
    g.fillStyle = MAPC[T[Y][X]] || '#5f9f4a'; g.fillRect(x * px, y * px, px, px);
  }
  const dot = (wxp, wzp, col, r) => { const x = (wxp / CELL - cx0) * px, y = (wzp / CELL - cy0) * px; if (x < 0 || y < 0 || x > cv.width || y > cv.height) return; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); };
  for (const p of PROPS) {
    if (!SEEN[p.cy * MW + p.cx]) continue;
    if (p.c === '+') dot(p.x, p.z, '#ff9a2e', px * .6 + 1);
    else if (p.kind === 'npc' && !p.night) dot(p.x, p.z, '#ffffff', px * .5 + 1);
  }
  if (G.acc.includes('scope')) for (const p of PROPS) if (p.kind === 'chest' && !G.chests.includes(p.i)) dot(p.x, p.z, '#ffd84d', px * .55 + 1);
  if (W.target) dot(W.target.x, W.target.z, '#ff3b3b', px * .8 + 2);
  dot(G.pos.x, G.pos.z, '#ffe14d', px * .7 + 2);
}
function showMap() {
  openWin('map', `<h2>🗺️ 檔案島</h2><canvas id="bigMap" width="${MW * 8}" height="${MH * 8}"></canvas>
    <p style="font-size:12px;text-align:center;color:#c7cdf5">🟡 你　🔴 任務目標　🟠 營火　⚪ 村民${G.acc.includes('scope') ? '　🟨 寶箱（望遠鏡）' : ''}<br>走過的地方才會畫出來。</p>`);
  drawMap($('#bigMap'), 0, 0, { w: MW, h: MH }, 8);
}
const SEEN = new Uint8Array(MW * MH);
function markSeen() {
  const cx = cellOf(G.pos.x), cy = cellOf(G.pos.z), R = 7;
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (x >= 0 && y >= 0 && x < MW && y < MH && (x - cx) ** 2 + (y - cy) ** 2 <= R * R) SEEN[y * MW + x] = 1;
}

// ---------- 存檔 ----------
function newGame() {
  const s = ent('@');
  return { v: 1, lv: 1, exp: 0, hp: 90, coin: 0, meat: 3, bigMeat: 0, mush: 0, acc: [], eq: [], ups: {}, party: ['agumon'], flags: {}, q: { main: 0 },
    chests: [], eggs: [], gears: [], tabs: [], rest: -1, time: .15, evoOn: false, evo: 0, kills: 0, secrets: {}, play: 0, pos: { x: s.x, z: s.z }, track: 'main' };
}
function save() {
  if (!G || UI.title) return;
  try { G.seen = Array.from(SEEN).join(''); localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { }
}
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 ? s : null; } catch (e) { return null; } }

// ---------- 開始遊戲 ----------
async function startGame(data) {
  G = data;
  SEEN.fill(0); if (G.seen) for (let i = 0; i < SEEN.length; i++) SEEN[i] = G.seen.charCodeAt(i) === 49 ? 1 : 0;
  if (G.flags.bridge) openGate();
  if (G.flags.wall) openWall();
  UI.title = false;
  $('#titlePanel').classList.add('hidden'); $('#hud').classList.remove('hidden');
  calcStats(); buildParty(); buildCamps(); buildProps2();
  markSeen(); updateHUD(); updateTrack();
  if (G.q.main === 0 && !G.flags.opened) { G.flags.opened = 1; await STORY.opening(); save(); }
}
function respawnPoint() { const r = G.rest >= 0 && ENTS['+'][G.rest]; return r ? { x: r.x, z: r.z + CELL * 1.2 } : { x: ent('@').x, z: ent('@').z }; }
function die() {
  W.dead = true; sfx('hurt');
  const lost = Math.floor(G.coin * .2);
  $('#deadTxt').innerHTML = `回到${G.rest >= 0 ? '最後休息的營火' : '海灘'}……<br>掉了 💰 ${lost} 數碼幣。`;
  setTimeout(() => $('#deadPanel').classList.remove('hidden'), 500);
  setTimeout(() => {
    G.coin -= lost; G.pos = respawnPoint(); G.hp = W.st.maxhp;
    if (W.evoT > 0) devolve();
    resetCombat(); buildParty();
    $('#deadPanel').classList.add('hidden'); W.dead = false; W.inv = 2;
    updateHUD(); updateTrack(); save();
  }, 2400);
}
// 全滅後：敵人、頭目全部重來
function resetCombat() {
  for (const e of W.enemies) if (e.kind !== 'gear') { if (e.bb) killBB(e.bb); e.dead = true; }
  W.enemies = W.enemies.filter(e => e.kind === 'gear' && !G.gears.includes(e.gear));
  W.shots.forEach(s => scene.remove(s.mesh, s.glow)); W.shots = [];
  W.eShots.forEach(s => scene.remove(s.glow)); W.eShots = [];
  W.hazards.forEach(h => scene.remove(h.fill, h.edge)); W.hazards = [];
  W.timers = []; W.event = null; W.arena = null; W.trig = null;
  endBossArena();
  buildCamps(); ensureIdle();
}
function ensureIdle() {
  const mk = (key, img, h, c, cond) => { if (cond && !W[key]) { const e = ent(c); W[key] = makeBB(img, h); placeBB(W[key], e.x, e.z); } };
  mk('kuwaSleep', 'Kuwagamon', 4, 'K', G.q.main <= 3);
  mk('monoIdle', 'Monochromon', 4, 'O', !G.flags.mono);
  mk('meraIdle', 'Meramon', 5, 'F', !G.flags.mera);
  mk('leoIdle', 'Leomon', 4.4, 'L', !G.flags.leo);
  mk('gabuWait', 'Gabumon', 2.1, 'G', G.q.main === 2);
  if (!G.flags.orge && (!W.orge || W.orge.dead)) { const e = ent('Y'); W.orge = makeBoss('Orgemon', e.x, e.z, { idle: true, onWin: () => { G.flags.orge = 1; secret('orge'); } }); }
  if (!G.flags.tyrano && (!W.tyr || W.tyr.dead)) { const e = ent('T'); W.tyr = makeBoss('Tyranomon', e.x, e.z, { idle: true, onWin: () => { G.flags.tyrano = 1; secret('tyrano'); } }); }
}
function dropIdle(key) { if (W[key]) { killBB(W[key]); W[key] = null; } }

// ---------- 劇情觸發 ----------
const near = (c, r) => { const e = ent(c); return e && Math.hypot(e.x - G.pos.x, e.z - G.pos.z) < r; };
async function runTrig(fn) { W.trig = true; try { await fn(); } finally { W.trig = false; } }
function triggers() {
  if (W.trig || W.boss || W.event || UI.dlg) return;
  const m = G.q.main, cx = cellOf(G.pos.x), cy = cellOf(G.pos.z);
  if (m === 0 && near('P', 7)) return runTrig(async () => {
    await STORY.shellIntro();
    const s = ent('S');
    startBoss('Shellmon', s, { z: s.z + 2, onHalf: () => runTrig(async () => { await STORY.shellHalf(); G.evoOn = true; G.evo = 100; updateHUD(); }),
      onWin: () => runTrig(async () => { await STORY.shellWin(); qSet('main', 1); }) });
  });
  if (m === 2 && near('G', 8)) return runTrig(async () => { await STORY.gabuIntro(); startWaves(); });
  if (near('K', 9)) {
    if (m === 3) return runTrig(async () => {
      await STORY.kuwaIntro(); dropIdle('kuwaSleep');
      startBoss('Kuwagamon', ent('K'), { onWin: () => runTrig(async () => { joinParty('piyomon'); await STORY.kuwaWin(); qSet('main', 4); }) });
    });
    if (m < 3 && !W.kuwaMsg) { W.kuwaMsg = 1; return runTrig(() => STORY.kuwaSleep()); }
  } else W.kuwaMsg = 0;
  if (!G.flags.mono && near('O', 7)) return runTrig(async () => {
    await STORY.monoIntro(); dropIdle('monoIdle');
    startBoss('Monochromon', ent('O'), { onWin: () => runTrig(async () => { G.flags.mono = 1; openGate(); await STORY.monoWin(); checkMain(); save(); }) });
  });
  if (!G.flags.mera && near('F', 9)) return runTrig(async () => {
    await STORY.meraIntro(); dropIdle('meraIdle');
    startBoss('Meramon', ent('F'), { onHalf: () => runTrig(() => STORY.meraHalf()),
      onWin: () => runTrig(async () => { G.flags.mera = 1; await STORY.meraWin(); qSet('main', 7); chapterClear(); }) });
  });
  if (!G.flags.leo && near('L', 7)) return runTrig(async () => {
    await STORY.leoIntro(); dropIdle('leoIdle');
    startBoss('Leomon', ent('L'), { onHalf: () => runTrig(() => STORY.leoHalf()), onWin: () => runTrig(async () => { G.flags.leo = 1; await STORY.leoWin(); }) });
  });
  if (T[cy] && T[cy][cx] === 'c' && !G.secrets.cave) return runTrig(() => STORY.enterCave());
  if (cx <= 5 && cy >= 16 && cy <= 20 && !G.secrets.grove) secret('grove');
  if (cx >= 11 && cx <= 13 && cy >= 35 && cy <= 37 && !G.secrets.island) secret('island');
}
// 加布獸：撐過 3 波
function startWaves() {
  const g = ent('G');
  clearNear(g.x, g.z, 17);
  W.event = { wave: 0, list: [] }; W.arena = { x: g.x, z: g.z, r: 12 };
  W.arenaRing = new THREE.Mesh(new THREE.RingGeometry(11.75, 12, 64), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .6, side: THREE.DoubleSide }));
  W.arenaRing.rotation.x = -Math.PI / 2; W.arenaRing.position.set(g.x, .06, g.z); scene.add(W.arenaRing);
  nextWave();
}
function nextWave() {
  const g = ent('G'), ev = W.event; ev.wave++;
  banner(`第 ${ev.wave} 波！`);
  const kinds = [['Kunemon', 'Kunemon', 'Goburimon'], ['Mushmon', 'Kunemon', 'Goburimon'], ['Goburimon', 'Goburimon', 'Mushmon']][ev.wave - 1];
  ev.list = [];
  for (let i = 0; i < 5 + ev.wave; i++) {
    const a = rand(0, 6.283); let x = g.x + Math.cos(a) * 9, z = g.z + Math.sin(a) * 9; if (blocked(x, z, .5)) { x = g.x + rand(-2, 2); z = g.z + rand(-2, 2); }
    ev.list.push(makeEnemy(pick(kinds), 3 + ev.wave, x, z, { aggro: true, summon: true }));
  }
}
function updWaves() {
  const ev = W.event; if (!ev || !ev.list.every(e => e.dead)) return;
  if (ev.wave < 3) return nextWave();
  W.event = null; W.arena = null; if (W.arenaRing) { scene.remove(W.arenaRing); W.arenaRing = null; }
  dropIdle('gabuWait'); sfx('win');
  runTrig(async () => { joinParty('gabumon'); await STORY.gabuWin(); qSet('main', 3); });
}
async function chapterClear() {
  const sec = Object.keys(SECRETS), found = sec.filter(k => G.secrets[k]).length;
  const side = ['eggs', 'gears', 'mush', 'tabs', 'phone'], sideDone = side.filter(k => G.q[k] === 'done').length;
  const m = Math.floor(G.play / 60);
  save();
  openWin('clear', `<h2>🏆 第一章　完</h2>
    <p style="text-align:center">火焰獸恢復了原樣。可是，黑色齒輪的源頭——惡魔獸，正在無限山的山頂等著……</p>
    <div class="q">遊玩時間 <b>${m}</b> 分鐘　·　等級 <b>Lv.${G.lv}</b>　·　打倒 <b>${G.kills}</b> 隻<br>
    支線任務 <b>${sideDone}/${side.length}</b>　·　發現的秘密 <b>${found}/${sec.length}</b></div>
    <div class="q">${sec.map(k => G.secrets[k] ? '✔️ ' + SECRETS[k] : '❔ ？？？').join('<br>')}</div>
    <p style="text-align:center">試玩版到這裡結束。你可以繼續在島上探索，把沒找到的秘密找出來！</p>
    <div style="text-align:center"><button class="btn" onclick="closeWin()">繼續探索</button></div>`);
}

// ---------- 輸入：鍵盤＋觸控搖桿 ----------
const keys = new Set();
const KEYMAP = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { keys.add(k); e.preventDefault(); }
  if (e.repeat) return;
  if (UI.lv && /^[1-3]$/.test(k)) return UI.lvOpts[+k - 1] && chooseUp(UI.lvOpts[+k - 1]);
  if (UI.dlg && !dlgNext && /^[1-9]$/.test(k)) { const b = $('#dlgOpts').children[+k - 1]; if (b) b.click(); return; }
  if (UI.dlg) { if ((k === 'e' || k === ' ' || k === 'enter') && dlgNext) { e.preventDefault(); dlgNext(); } return; }
  if (k === 'escape') return closeWin();
  if (UI.title || W.dead) return;
  if (k === 'j') return UI.panel === 'quest' ? closeWin() : showQuests();
  if (k === 'b' || k === 'i') return UI.panel === 'bag' ? closeWin() : showBag();
  if (k === 'm' || k === 'tab') { e.preventDefault(); return UI.panel === 'map' ? closeWin() : showMap(); }
  if (UI.panel) return;
  if (k === 'e') { e.preventDefault(); interact(); }
  if (k === ' ' || k === 'shift' || k === 'k') { e.preventDefault(); dodge(); }
  if (k === 'q') evolve();
  if (k === 'r') eatMeat();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const JOY = { id: null, x: 0, y: 0, dx: 0, dz: 0 };
const joyEl = $('#joy'), joyKnob = $('#joy i');
function joyHome() { if (JOY.id !== null) return; joyEl.style.left = '82px'; joyEl.style.top = (innerHeight - 120) + 'px'; joyKnob.style.transform = 'translate(-50%,-50%)'; }
joyHome(); addEventListener('resize', joyHome);
if (!matchMedia('(pointer:coarse)').matches) joyEl.classList.add('hidden');
renderer.domElement.addEventListener('pointerdown', e => {
  if (UI.dlg && dlgNext) return dlgNext();
  if (JOY.id !== null) return;
  JOY.id = e.pointerId; JOY.x = e.clientX; JOY.y = e.clientY; JOY.dx = JOY.dz = 0;
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on');
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerId !== JOY.id) return;
  let dx = e.clientX - JOY.x, dy = e.clientY - JOY.y; const d = Math.hypot(dx, dy), R = 52;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  if (d < 10) { JOY.dx = JOY.dz = 0; return; }
  JOY.dx = dx / R; JOY.dz = dy / R;
});
const joyEnd = e => { if (e.pointerId !== JOY.id) return; JOY.id = null; JOY.dx = JOY.dz = 0; joyEl.classList.remove('on'); joyHome(); };
renderer.domElement.addEventListener('pointerup', joyEnd);
renderer.domElement.addEventListener('pointercancel', joyEnd);
$('#btnTalk').onclick = () => interact();
$('#btnEvo').onclick = () => evolve();
$('#btnMeat').onclick = () => eatMeat();
$('#btnDash').onclick = () => dodge();
$('#bQuest').onclick = () => showQuests(); $('#bBag').onclick = () => showBag(); $('#bMap').onclick = () => showMap(); $('#mini').onclick = () => showMap();
document.querySelectorAll('.muteBtn').forEach(b => b.onclick = e => { e.stopPropagation(); setMute(!MUTED); });

// ---------- 衝刺閃避（空白鍵／Shift／手機 💨）：短距離衝刺，衝刺中不會受傷 ----------
function dodge() {
  if (paused() || W.dash || (W.dashCd || 0) > 0) return;
  let mx = JOY.dx, mz = JOY.dz; for (const k of keys) { mx += KEYMAP[k][0]; mz += KEYMAP[k][1]; }
  let l = Math.hypot(mx, mz);
  if (l < .1) { mx = leader().bb.flip; mz = 0; l = 1; }
  W.dash = { vx: mx / l * 26, vz: mz / l * 26, t: .18 }; W.dashCd = 1.1; W.inv = Math.max(W.inv, .3);
  burst(G.pos.x, G.pos.z, 6, GLOW.white); sfx('dash');
}

// ---------- 調查／對話 ----------
function nearProp() {
  let best = null, bd = 1e9;
  for (const p of PROPS) {
    if (!p.act || (p.night && !night())) continue;
    const d = Math.hypot(p.x - G.pos.x, p.z - G.pos.z);
    if (d < p.r && d < bd) { bd = d; best = p; }
  }
  return best;
}
function interact() {
  if (UI.dlg || W.trig || UI.panel || W.dead) return;
  const p = nearProp(); if (!p) return;
  keys.clear(); JOY.dx = JOY.dz = 0;
  runTrig(async () => { await p.act(); updateTrack(); });
}

// =========================================================
//   主迴圈
// =========================================================
const paused = () => UI.title || UI.dlg || UI.panel || UI.lv || W.dead;
function update(dt) {
  W.t += dt; G.play += dt;
  G.time = (G.time + dt / DAY_LEN) % 1;
  W.inv = Math.max(0, W.inv - dt); W.meatCd = Math.max(0, (W.meatCd || 0) - dt);
  if (W.st.regen && G.hp < W.st.maxhp) G.hp = Math.min(W.st.maxhp, G.hp + W.st.regen * dt);
  // 計時器
  for (const t of W.timers) { t.t -= dt; if (t.t <= 0 && !t.done) { t.done = true; t.fn(); } }
  W.timers = W.timers.filter(t => !t.done);
  // 進化時間
  if (W.evoT > 0) { W.evoT -= dt; if (W.evoT <= 0) devolve(); }

  // ----- 移動 -----
  const L = leader();
  let mx = JOY.dx, mz = JOY.dz;
  for (const k of keys) { mx += KEYMAP[k][0]; mz += KEYMAP[k][1]; }
  const ml = Math.hypot(mx, mz);
  W.dashCd = Math.max(0, (W.dashCd || 0) - dt);
  if (W.dash) { moveCirc(G.pos, W.dash.vx * dt, W.dash.vz * dt, .5); W.dash.t -= dt; if (W.dash.t <= 0) W.dash = null; }
  else if (W.knock && W.knock.t > 0) { W.knock.t -= dt; moveCirc(G.pos, W.knock.vx * dt, W.knock.vz * dt, .5); }
  else if (ml > 0) {
    const sp = W.st.move * Math.min(1, ml) / ml * dt;
    moveCirc(G.pos, mx * sp, mz * sp, .5);
    if (Math.abs(mx) > .2) faceBB(L.bb, mx < 0 ? -1 : 1);
  }
  if (W.arena) { const A = W.arena, dx = G.pos.x - A.x, dz = G.pos.z - A.z, d = Math.hypot(dx, dz); if (d > A.r - .6) { G.pos.x = A.x + dx / d * (A.r - .6); G.pos.z = A.z + dz / d * (A.r - .6); } }
  L.x = G.pos.x; L.z = G.pos.z;
  const bob = ml > 0 ? Math.abs(Math.sin(W.t * 12)) * .18 : 0;
  placeBB(L.bb, L.x, L.z, bob);
  const blink = W.inv > 0 && Math.floor(W.t * 20) % 2 ? .45 : 1;
  L.bb.sp.material.opacity = blink;
  // 夥伴跟在後面
  const last = W.trail[W.trail.length - 1];
  if (!last || Math.hypot(last.x - L.x, last.z - L.z) > .3) { W.trail.push({ x: L.x, z: L.z }); if (W.trail.length > 40) W.trail.shift(); }
  W.party.forEach((p, i) => {
    if (!i) return;
    const tp = W.trail[Math.max(0, W.trail.length - 1 - i * 6)] || L;
    const k = Math.min(1, dt * 8); p.x += (tp.x - p.x) * k; p.z += (tp.z - p.z) * k;
    placeBB(p.bb, p.x, p.z, p.id === 'piyomon' ? .6 + Math.sin(W.t * 6) * .15 : bob * .8);
    p.bb.sp.material.opacity = blink;
  });

  // ----- 敵人 -----
  for (const e of W.enemies) if (!e.dead) updEnemy(e, dt);
  separate();
  // 敵人的子彈
  for (const s of W.eShots) {
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; s.glow.position.set(s.x, 1.2, s.z);
    if (Math.hypot(s.x - G.pos.x, s.z - G.pos.z) < s.r + .55) { hurt(s.dmg); s.life = 0; }
  }
  W.eShots = W.eShots.filter(s => { if (s.life <= 0) { scene.remove(s.glow); s.glow.material.dispose(); return false; } return true; });
  updHazards(dt);

  // ----- 我方攻擊 -----
  weapons(dt);
  for (const s of W.shots) {
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    s.mesh.position.set(s.x, s.y, s.z); s.glow.position.copy(s.mesh.position);
    for (const e of W.enemies) {
      if (e.dead || s.hit.has(e)) continue;
      if ((e.x - s.x) ** 2 + (e.z - s.z) ** 2 < (e.r + s.r) ** 2) {
        s.hit.add(e); const l = Math.hypot(s.vx, s.vz); hitEnemy(e, s.dmg, s.vx / l, s.vz / l);
        if (s.boom) { boom(s.x, s.z, s.boom, s.dmg * .5); s.life = 0; break; }
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
    }
  }
  W.shots = W.shots.filter(s => { if (s.life <= 0) { scene.remove(s.mesh, s.glow); s.mesh.material.dispose(); s.glow.material.dispose(); return false; } return true; });
  W.orbits.forEach((o, i) => {
    o.a += dt * 3; const R = 2.8, x = G.pos.x + Math.cos(o.a) * R, z = G.pos.z + Math.sin(o.a) * R;
    o.glow.position.set(x, 1, z);
    for (const e of W.enemies) {
      if (e.dead || (e.hitCd['o' + i] || 0) > W.t) continue;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 < (e.r + .8) ** 2) { e.hitCd['o' + i] = W.t + .5; hitEnemy(e, 8 * W.st.dmg * W.st.orbitDmg, (e.x - G.pos.x) * .2, (e.z - G.pos.z) * .2); }
    }
  });
  W.enemies = W.enemies.filter(e => { if (e.dead) { if (e.bb) killBB(e.bb); return false; } return true; });

  // ----- 掉落物 -----
  for (const g of W.drops) {
    g.age += dt;
    const dx = G.pos.x - g.x, dz = G.pos.z - g.z, d = Math.hypot(dx, dz);
    if (d < W.st.pick && g.age > .25) g.pull = true;
    if (g.pull) { const sp = 15 * dt; g.x += dx / (d || 1) * Math.min(d, sp); g.z += dz / (d || 1) * Math.min(d, sp); }
    g.mesh.position.set(g.x, .5 + Math.sin(W.t * 4 + g.x) * .12, g.z); g.mesh.rotation.y += dt * 3;
    if (d < .8) {
      g.got = true;
      if (g.type === 'exp') { sfx('exp'); gainExp(g.v); }
      else if (g.type === 'coin') { sfx('coin'); give('coin', g.v); }
      else { G.mush++; toast(`🍄 野生蘑菇 ×${G.mush}`); checkQuests(); }
    }
  }
  W.drops = W.drops.filter(g => { if (g.got) { scene.remove(g.mesh); return false; } return true; });
  // 數碼蛋
  for (const p of PROPS) if (p.kind === 'egg' && !G.eggs.includes(p.idx) && Math.hypot(p.x - G.pos.x, p.z - G.pos.z) < 1.6) {
    G.eggs.push(p.idx); refreshProps(); sfx('chest');
    toast(`🥚 找到迷路的數碼蛋！（${G.eggs.length}/5）${G.q.eggs === undefined ? '<br>起始之鎮的電擊獸好像在找它們……' : ''}`, 3400);
    checkQuests(); save();
  }

  // ----- 粒子 -----
  for (const f of W.fx) { f.life -= dt; f.vy -= 18 * dt; f.s.position.x += f.vx * dt; f.s.position.y = Math.max(.1, f.s.position.y + f.vy * dt); f.s.position.z += f.vz * dt; f.s.material.opacity = Math.max(0, f.life * 2); }
  W.fx = W.fx.filter(f => { if (f.life <= 0) { scene.remove(f.s); f.s.material.dispose(); return false; } return true; });

  updWaves();
  triggers();
  // 每隔一段時間做的事
  W.slow = (W.slow || 0) - dt;
  if (W.slow <= 0) {
    W.slow = .3; markSeen(); updateTrack(); updateHUD(); drawMini(); updProps();
    W.campT = (W.campT || 0) - .3; if (W.campT <= 0) { W.campT = 10; respawnCamps(false); }
    W.saveT = (W.saveT || 0) - .3; if (W.saveT <= 0) { W.saveT = 15; save(); }
  }
  if (W.lvQueue > 0 && !UI.lv && !UI.dlg) showLevelUp();
}
function updEnemy(e, dt) {
  if (e.kind === 'gear') { e.mesh.rotation.z += dt * 1.5; e.mesh.position.y = 1.6 + Math.sin(W.t * 2) * .15; e.glow.material.opacity = e.flash > 0 ? 1 : .6 + Math.sin(W.t * 3) * .2; e.flash = Math.max(0, e.flash - dt); return; }
  const dx = G.pos.x - e.x, dz = G.pos.z - e.z, d = Math.hypot(dx, dz) || 1;
  const B = e.boss;
  if (e.dash) {
    if (moveCirc(e, e.dash.vx * dt, e.dash.vz * dt, .7)) e.dash.t = 0;
    e.dash.t -= dt; if (e.dash.t <= 0) e.dash = null;
    if (d < e.r + 1.2) hurt(e.atk * 1.4);
  } else if (e.state === 'idle') {
    e.wT -= dt;
    if (e.wT <= 0) { e.wT = rand(1.5, 4); e.tx = e.home.x + rand(-3, 3); e.tz = e.home.z + rand(-3, 3); }
    const tx = e.tx - e.x, tz = e.tz - e.z, td = Math.hypot(tx, tz);
    if (td > .3) { moveCirc(e, tx / td * e.spd * .35 * dt, tz / td * e.spd * .35 * dt, .45); if (Math.abs(tx) > .2) faceBB(e.bb, tx < 0 ? -1 : 1); }
    if (d < (B ? 9 : 7.5) && !W.boss && !W.event) aggro(e);   // 頭目戰時，外面的小怪不會加入
  } else if (e.state === 'return') {
    const tx = e.home.x - e.x, tz = e.home.z - e.z, td = Math.hypot(tx, tz);
    e.hp = Math.min(e.maxhp, e.hp + e.maxhp * dt * .5);
    if (td < 1) e.state = 'idle'; else { e.x += tx / td * e.spd * 1.6 * dt; e.z += tz / td * e.spd * 1.6 * dt; faceBB(e.bb, tx < 0 ? -1 : 1); }
  } else {
    // 追玩家
    const homeD = Math.hypot(e.x - e.home.x, e.z - e.home.z);
    if (!e.summon && e !== W.boss && homeD > (B ? 22 : 18)) { e.state = 'return'; if (e.elite) bossBar(null); }
    if (B) {
      e.busy = Math.max(0, e.busy - dt);
      if (!e.busy && d > 3.2) moveCirc(e, dx / d * e.spd * dt, dz / d * e.spd * dt, .7);
      e.actT -= dt;
      if (e.actT <= 0 && !e.busy) {
        const mv = B.moves[e.mi++ % B.moves.length], dur = BOSS_MOVES[mv](e);
        e.busy = dur * .6; e.actT = B.cd * (e.phase > 1 ? .7 : 1) + dur * .4;
      }
    } else if (d > .8) moveCirc(e, (dx / d * e.spd + e.kx) * dt, (dz / d * e.spd + e.kz) * dt, .45);
    if (e.shot && d < 13) { e.shotT -= dt; if (e.shotT <= 0) { e.shotT = e.shot.cd * rand(.8, 1.2); eShot(e.x, e.z, Math.atan2(dz, dx), e.shot.spd, e.shot.dmg * lvAtk(e.lv), GLOW[e.shot.tex], 1.3); } }
    faceBB(e.bb, dx < 0 ? -1 : 1);
    if (d < e.r + .7) hurt(e.atk);
  }
  if (W.boss === e && e.arena && e.arena.r) { const A = e.arena, ax = e.x - A.x, az = e.z - A.z, ad = Math.hypot(ax, az); if (ad > A.r - 1) { e.x = A.x + ax / ad * (A.r - 1); e.z = A.z + az / ad * (A.r - 1); } }
  e.kx *= Math.pow(.02, dt); e.kz *= Math.pow(.02, dt);
  e.flash = Math.max(0, e.flash - dt);
  placeBB(e.bb, e.x, e.z, B ? 0 : Math.abs(Math.sin(W.t * 8 + e.home.x)) * .12);
  e.bb.sp.material.color.setRGB(1, e.flash > 0 ? .4 : 1, e.flash > 0 ? .4 : 1);
}
function separate() {
  const E = W.enemies;
  for (let i = 0; i < E.length; i++) {
    const a = E[i]; if (a.dead || a.state === 'idle' || a.kind === 'gear') continue;
    for (let j = i + 1; j < E.length; j++) {
      const b = E[j]; if (b.dead || b.kind === 'gear') continue;
      const dx = b.x - a.x, dz = b.z - a.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > .0001) { const dd = Math.sqrt(d2), push = (min - dd) * .5 / dd; if (!a.boss) moveCirc(a, -dx * push, -dz * push, .45); if (!b.boss) moveCirc(b, dx * push, dz * push, .45); }
    }
  }
}
// 村民頭上的「！」、晚上才出現的商人、石碑發光、電話亭的鈴聲
function updProps() {
  const nt = night();
  for (const p of PROPS) {
    if (p.kind === 'npc') {
      const show = !p.night || nt;
      p.bb.sp.visible = p.bb.sh.visible = p.lb.visible = show;
      p.mk.visible = show && !!(p.mark && p.mark());
    }
    if (p.c === 'P') { p.win.material.emissive.set(nt && !G.flags.phone ? 0xffe680 : 0x335566); if (nt && !G.flags.phone && Math.hypot(p.x - G.pos.x, p.z - G.pos.z) < 26 && Math.random() < .12) { dmgText(p.x, 3.6, p.z, '☎️ 鈴鈴鈴', 'info'); sfx('ring'); } }
  }
  $('#clockTxt').textContent = clockText();
  const np = !UI.dlg && !W.trig && nearProp();
  const bt = $('#btnTalk');
  if (np) { bt.classList.remove('hidden'); bt.textContent = `💬 ${np.label}`; } else bt.classList.add('hidden');
}
function drawMini() {
  const cv = $('#mini'), n = 30, px = cv.width / n;
  drawMap(cv, cellOf(G.pos.x) - n / 2, cellOf(G.pos.z) - n / 2, { w: n, h: n }, px);
  // 任務方向
  if (W.target) {
    const a = Math.atan2(W.target.z - G.pos.z, W.target.x - G.pos.x), g = cv.getContext('2d'), c = cv.width / 2;
    const d = Math.hypot(W.target.z - G.pos.z, W.target.x - G.pos.x) / CELL;
    if (d > n / 2 - 1) { const r = c - 7; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 5, 0, 7); g.fill(); }
  }
}
// 地上的任務箭頭
const arrow = (() => {
  const s = new THREE.Shape(); s.moveTo(.9, 0); s.lineTo(-.5, .55); s.lineTo(-.2, 0); s.lineTo(-.5, -.55); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 4; scene.add(m); m.visible = false; return m;
})();
function updArrow() {
  if (!G || !W.target || UI.title) { arrow.visible = false; return; }
  const dx = W.target.x - G.pos.x, dz = W.target.z - G.pos.z, d = Math.hypot(dx, dz);
  arrow.visible = d > 5 && !W.boss;
  const a = Math.atan2(dz, dx);
  arrow.position.set(G.pos.x + Math.cos(a) * 2.6, .12, G.pos.z + Math.sin(a) * 2.6);
  arrow.rotation.z = -a; arrow.material.opacity = .55 + Math.sin(performance.now() / 200) * .3;
}

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (G && !paused()) update(dt);
  if (G) {
    updSky(); updArrow();
    for (const p of PROPS) { if (p.kind === 'egg') { p.mesh.position.y = .7 + Math.sin(now / 300 + p.idx) * .12; p.mesh.rotation.y += dt; } if (p.fl) p.fl.scale.setScalar(2.2 + Math.sin(now / 90 + p.i) * .3); }
    lamp.position.set(G.pos.x, 4, G.pos.z + 1);
  }
  const px = G ? G.pos.x : wx(32), pz = G ? G.pos.z : wz(28);
  W.shake = Math.max(0, W.shake - dt);
  const sh = W.shake > 0 ? W.shake * .6 : 0;
  camera.position.lerp(v3.set(px + CAM_OFF.x + rand(-sh, sh), CAM_OFF.y, pz + CAM_OFF.z + rand(-sh, sh)), Math.min(1, dt * 6));
  camera.lookAt(px, 1, pz);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- 標題畫面 ----------
buildGround(); buildProps();
$('#titlePics').innerHTML = ['Agumon', 'Gabumon', 'Piyomon'].map(k => `<img src="${SPRITES[k]}" alt="">`).join('');
const OLD = loadSave();
if (OLD) { $('#btnCont').classList.remove('hidden'); $('#btnNew').classList.add('gray'); }
$('#btnCont').onclick = () => startGame(OLD);
$('#btnNew').onclick = async () => {
  if (OLD && !confirm('開始新的冒險會覆蓋目前的存檔，確定嗎？')) return;
  startGame(newGame());
};
setMute(MUTED);
requestAnimationFrame(loop);
