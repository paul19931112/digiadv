'use strict';
/* =========================================================
   主程式：狀態、存檔、局外解鎖、標題、HUD、輸入、主迴圈
   ========================================================= */

const G = { mode: 'title', screen: 'title', dialog: false, trans: { t: 0 } };
let RUN = null;   // 這一局的狀態（全滅就清掉）
let META = null;  // 永久紀錄（解鎖、結局、圖鑑）

// ---------- 存檔 ----------
const RUN_KEY = 'digimon-rogue-v8-run', META_KEY = 'digimon-rogue-v8-meta';   // 每個版本用自己的存檔，避免互相讀到
const store = {
  get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
function saveRun() {
  if (!RUN || G.tutorial) return;   // 教學不存檔
  RUN.area = (AREA && G.screen === 'area') ? serializeArea(AREA) : null;
  store.set(RUN_KEY, RUN);
}
// 自動存檔：每 5 秒，以及切到別的 App／關閉網頁的時候
setInterval(() => { if (RUN && !G.tutorial && ['area', 'route'].includes(G.mode)) saveRun(); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden && RUN && !G.tutorial && G.mode !== 'battle') saveRun(); });
addEventListener('pagehide', () => { if (RUN && !G.tutorial && G.mode !== 'battle') saveRun(); });
function clearRun() { store.del(RUN_KEY); }
function saveMeta() { store.set(META_KEY, META); }
function loadMeta() {
  META = Object.assign({ unlocked: ['agumon', 'gabumon', 'piyomon', 'tentomon'], kids: ['taichi', 'yamato', 'sora', 'koushiro'], endings: [], clears: 0, runs: 0, dex: [] }, store.get(META_KEY) || {});
}
function unlockStarter(id) {
  if (META.unlocked.includes(id)) return;
  META.unlocked.push(id); saveMeta();
  toast(`🔓 解鎖新夥伴：${SPECIES[id].name}！`, 4000);
}
function unlockKid(id) {
  if (META.kids.includes(id)) return;
  META.kids.push(id); saveMeta();
  toast(`🔓 解鎖新角色：${KIDS[id].name}（${KIDS[id].crest}）！`, 4000);
}
function recordDex() {
  const s = new Set([...META.dex, ...RUN.seen, ...RUN.team.map(m => m.sp)]);
  META.dex = [...s]; saveMeta();
}

// =========================================================
//   標題 / 選夥伴
// =========================================================
function showTitle() {
  G.mode = 'title'; G.screen = 'title';
  RUN = null; AREA = null; B = null; G.tutorial = false;
  ['#coachRing', '#coachTip', '#dialog'].forEach(s => $(s).classList.add('hidden')); G.dialog = false;
  $('#hud').classList.add('hidden');
  showScreen('#title');
  $('#btnPart2').classList.toggle('hidden', !part2Unlocked());
  $('#btnPart3').classList.toggle('hidden', !part3Unlocked());
  $('#titleArt').innerHTML = ['Metal_Garurumon', 'War_Greymon', 'Seraphimon', 'Devimon'].map(k => dpic(k, '✨', 's110')).join('');
  const sv = store.get(RUN_KEY);
  const cont = $('#btnContinue');
  cont.classList.toggle('hidden', !sv);
  if (sv) cont.textContent = `繼續冒險（${CHAPTERS[sv.chapter].title.split('　')[1]}・${SPECIES[sv.team[0].sp].name} Lv.${sv.team[0].level}）`;
  const dexTotal = Object.keys(SPECIES).filter(k => SPECIES[k].hp).length;
  $('#titleMeta').innerHTML = `
    <div>🏆 結局 ${META.endings.length} / 3　${Object.entries(ENDINGS).map(([k, e]) => META.endings.includes(k) ? `<span title="${e.name}">${e.icon}</span>` : '<span>❔</span>').join(' ')}</div>
    <div>📖 圖鑑 ${META.dex.length} / ${dexTotal}　｜　🎮 冒險次數 ${META.runs}　｜　通關 ${META.clears} 次</div>
    <div>🔓 角色 ${META.kids.length} / 8　｜　夥伴 ${Object.keys(SPECIES).filter(k => SPECIES[k].starter && (META.unlocked.includes(k) || (k === 'plotmon' && META.kids.includes('hikari')))).length} / ${Object.keys(SPECIES).filter(k => SPECIES[k].starter).length}</div>`;
}

let chosenKid = null;
function showKidSelect() {
  G.mode = 'select'; showScreen('#kidSelect');
  const list = $('#kidList');
  list.innerHTML = '';
  chosenKid = null;
  $('#btnKidOk').disabled = true; $('#btnKidOk').textContent = '就是我了！';
  Object.entries(KIDS).forEach(([id, k]) => {
    const locked = !META.kids.includes(id);
    const el = document.createElement('div');
    el.className = 'kid' + (locked ? ' locked' : '');
    el.innerHTML = `<div class="top"><div class="crest" style="background:${k.color};--kc:${k.color}">${k.icon}</div>
      <div><div class="n">${k.name}</div><div class="c">${k.crest}的徽章</div></div></div>
      ${locked ? `<div class="minus">🔒 ${k.unlock}</div>` : `<div class="plus">▲ ${k.plus}</div><div class="minus">▼ ${k.minus}</div>
      <div class="kc">💞 原作搭檔：${SPECIES[k.partner].name}（進化消耗 -10%）</div><div class="miniCard"></div>`}`;
    if (!locked) el.querySelector('.miniCard').appendChild(cardEl(k.card, { isStatic: true }));
    if (!locked) {
      el.onclick = () => { chosenKid = id; list.querySelectorAll('.kid').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); $('#btnKidOk').disabled = false; $('#btnKidOk').textContent = `${k.name}，出發！`; };
      el.ondblclick = () => { chosenKid = id; showSelect(); };
    }
    list.appendChild(el);
  });
}

function showSelect() {
  G.mode = 'select'; showScreen('#select');
  const list = $('#starterList');
  list.innerHTML = '';
  const statRow = (label, v, max) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><span>${v}</span></div>`;
  let chosen = null;
  Object.entries(SPECIES).filter(([, s]) => s.starter).forEach(([id, s]) => {
    const locked = !META.unlocked.includes(id) && !(id === 'plotmon' && META.kids.includes('hikari'));
    const isPartner = chosenKid && KIDS[chosenKid].partner === id;
    preloadLine(id);
    const el = document.createElement('div');
    el.className = 'starter' + (locked ? ' locked' : '');
    el.innerHTML = `<div class="top">${dpic(s.img, s.emoji, 's64')}<div><div class="n">${s.name}</div><div class="a">${ATTR_ICON[s.attr]} ${ATTR_NAME[s.attr]}</div></div></div>
      <div class="d">${locked ? `🔒 ${s.unlock}` : s.desc}</div>
      ${statRow('HP', s.hp, 70)}${statRow('攻擊', s.atk, 15)}${statRow('防禦', s.def, 12)}${statRow('速度', s.spd, 14)}
      <div class="path">${s.evo.map(e => `<span class="arrow">▶</span>${dpic(e.img, s.emoji, 's44')}`).join('')}</div>${isPartner && !locked ? `<div class="partnerTag">💞 ${KIDS[chosenKid].nick}的原作搭檔：進化消耗 -10%</div>` : ''}`;
    if (!locked) {
      el.onclick = () => { chosen = id; list.querySelectorAll('.starter').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); $('#btnChoose').disabled = false; $('#btnChoose').textContent = `${s.name}，就決定是你了！`; };
      el.ondblclick = () => newRun(id);
    }
    list.appendChild(el);
  });
  $('#btnChoose').disabled = true;
  $('#btnChoose').textContent = '就決定是你了！';
  $('#btnChoose').onclick = () => chosen && newRun(chosen);
}

async function newRun(id) {
  RUN = { kid: chosenKid, team: [], items: ['potion'], deck: [...STARTER_DECK, KIDS[chosenKid].card], courage: 10, bits: 30, relics: [], flags: {}, rules: 'p1',
          chapter: 1, route: null, pos: null, visited: [], usedEvents: [], seen: [], stats: { wins: 0, chapters: 0 } };
  RUN.team.push(newMember(id, 1));
  if (META.tutBonus) { RUN.items.push('potion'); META.tutBonus = false; saveMeta(); }
  startChapter(1);
  META.runs++; saveMeta();
  G.mode = 'story';
  showScreen('');
  await prologue();
  saveRun();
  await chapterCard(CHAPTERS[1].title, '打倒被黑色齒輪控制的數碼寶貝，前往無限山！');
  showRoute();
}
function continueRun() {
  RUN = store.get(RUN_KEY);
  if (!RUN) return;
  RUN.items = RUN.items || [];
  RUN.team.forEach(m => preloadLine(m.sp));
  if (RUN.area) resumeArea(RUN.area);   // 上次在節點裡面關掉 → 回到同一個節點
  else showRoute();
}

function gameOver() {
  recordDex();
  const reached = CHAPTERS[RUN.chapter].title;
  clearRun();
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><div style="font-size:70px">💫</div><h1>冒險結束</h1>
    <p>到達：${reached}${RUN.pos ? `　第 ${RUN.pos.f + 1} 層` : ''}</p>
    <div class="endTeam">${RUN.team.map(m => spPic(m.sp, 's80')).join('')}</div>
    <p>擊敗 ${RUN.stats.wins} 隻敵人　｜　隊伍 ${RUN.team.length} 隻　｜　牌組 ${RUN.deck.length} 張</p>
    <p class="sub">夥伴們會變得更堅強…再挑戰一次吧！</p>
    <button class="btn primary big" id="goBack">回到標題</button></div>`;
  showScreen('#overlay');
  o.querySelector('#goBack').onclick = () => { o.classList.add('hidden'); showTitle(); };
}

// =========================================================
//   HUD / 隊伍 / 牌組
// =========================================================
function updateHUD() {
  if (!RUN) return;
  const L = RUN.team[0], sp = SPECIES[L.sp], s = memberStats(L), kd = KIDS[RUN.kid];
  $('#hudKid').innerHTML = `<div class="crest" style="background:${kd.color};--kc:${kd.color}">${kd.icon}</div><b>${kd.name}</b><span class="mini2" title="▲ ${kd.plus}　▼ ${kd.minus}">${kd.crest}的徽章 ⓘ</span>`;
  $('#hudPic').innerHTML = dpic(sp.img, sp.emoji, 's44');
  $('#hudName').textContent = `${sp.name}　Lv.${L.level}`;
  $('#hudSub').textContent = CHAPTERS[RUN.chapter].title.replace('　', ' ');
  $('#hudHp').textContent = `${L.hp} / ${s.maxhp}`;
  $('#hudHpBar').style.width = L.hp / s.maxhp * 100 + '%';
  $('#hudExp').textContent = `${L.exp} / ${expNeed(L.level)}`;
  $('#hudExpBar').style.width = L.exp / expNeed(L.level) * 100 + '%';
  $('#hudBits').textContent = RUN.bits;
  $('#hudQuick').textContent = `HP ${L.hp}/${s.maxhp}　🔥${Math.floor(RUN.courage)}　💰${RUN.bits}`;
  $('#hudTeam').innerHTML = RUN.team.map((m, i) => {
    const t = SPECIES[m.sp], ms = memberStats(m);
    return `<div class="tm ${i === 0 ? 'lead' : ''}" title="${t.name} Lv.${m.level}">${dpic(t.img, t.emoji, 's32')}<div class="hpb"><i style="width:${m.hp / ms.maxhp * 100}%"></i></div></div>`;
  }).join('');
  $('#hudItems').innerHTML = `<span class="mini2">🎒</span>` + (RUN.items.length ? itemGroups().map(({ k, n }) => `<span class="hr" title="${ITEMS[k].name}：${ITEMS[k].desc}">${ITEMS[k].icon}${n > 1 ? `<small>×${n}</small>` : ''}</span>`).join('') : '<span class="mini2">背包是空的</span>') + `<span class="mini2">（${RUN.items.length}/${bagMax()}）</span>`;
  $('#hudRelics').innerHTML = RUN.relics.length ? RUN.relics.map(k => relicIcon(k)).join('') : '<span class="mini2">還沒有徽章道具</span>';
  // 第一次拿到神聖計畫：跳出究極之證的謎語
  if (has('digivice') && !RUN.flags.riddle && !G.tutorial) { RUN.flags.riddle = true; setTimeout(showRiddle, 500); }
  $('#btnDeck').textContent = `🃏 牌組 ${RUN.deck.length} (C)`;
  $('#btnTeam').textContent = `👥 隊伍 ${RUN.team.length}/${teamMax()} (T)`;
  updateCourageUI();
}

function evoPathHTML(sp, level) {
  const steps = [{ name: sp.name, img: sp.img, tier: 0 }, ...sp.evo.map((e, i) => ({ ...e, tier: i + 1 }))];
  return steps.map((s, i) => {
    const locked = s.tier && level < TIERS[s.tier].lv;
    return `${i ? '<span class="arrow">▶</span>' : ''}<div class="step" style="${locked ? 'opacity:.4' : ''}">${dpic(s.img, sp.emoji, 's44')}
      <span>${s.name}</span><span>${TIERS[s.tier].name}${s.tier ? `・🔥${TIERS[s.tier].cost}` : ''}${locked ? `・Lv.${TIERS[s.tier].lv}` : ''}</span></div>`;
  }).join('');
}
function openModal(html) { sfx('open'); const m = $('#modal'); m.innerHTML = html; m.classList.remove('hidden'); G.modalFrom = G.mode; G.mode = 'modal'; return m; }
function closeModal() {
  if (RUN && !G.tutorial && ['area', 'route'].includes(G.modalFrom)) setTimeout(saveRun, 0); sfx('close'); $('#modal').classList.add('hidden'); if (G.mode === 'modal') G.mode = G.modalFrom || 'area'; }
function openTeam() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const m = openModal(`<h2>我的隊伍（${RUN.team.length}/${teamMax()}）</h2>
    <p class="sub">${P2() ? (RUN.crest ? `隊長 👑 可以花徽章刻度超進化（剩 ${RUN.crestTicks} 格）` : '隊長會帶頭出戰。在第四章找到徽章之後，隊長 👑 就能超進化') : P1() ? '隊長會帶頭出戰。第一部的夥伴最多進化到成熟期（第二部拿到徽章後，隊長 👑 才能超進化）' : '隊長會帶頭出戰，而且只有隊長 👑 能超進化到完全體、究極體（其他夥伴最多進化到成熟期）'}。🔥 勇氣值全隊共用：目前 ${Math.floor(RUN.courage)} / ${courageMax()}</p>
    <div class="teamList"></div>
    <div class="relicList"></div>
    <button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const list = m.querySelector('.teamList');
  RUN.team.forEach((mem, i) => {
    const sp = SPECIES[mem.sp], s = memberStats(mem);
    const el = document.createElement('div');
    el.className = 'member' + (i === 0 ? ' lead' : '');
    el.innerHTML = `${dpic(sp.img, sp.emoji, 's80')}
      <div><div class="nm">${sp.name}　<span class="sub2">Lv.${mem.level}　${ATTR_ICON[sp.attr]} ${ATTR_NAME[sp.attr]}　HP ${mem.hp}/${s.maxhp}　攻 ${s.atk}　防 ${s.def}　速 ${s.spd}</span></div>
      <div class="sub2">${sp.desc}　｜　必殺技：${sp.sig.name}　｜　EXP ${mem.exp}/${expNeed(mem.level)}</div>
      <div class="evoPath">${evoPathHTML(sp, mem.level)}</div></div>
      <div class="col2">${i === 0 ? '<b style="color:var(--accent)">👑 隊長</b>' : '<button class="btn lead">設為隊長</button>'}${RUN.team.length > 1 ? '<button class="btn release">讓牠離隊</button>' : ''}</div>`;
    if (i > 0) el.querySelector('.lead').onclick = () => { RUN.team.unshift(RUN.team.splice(i, 1)[0]); updateHUD(); closeModal(); openTeam(); };
    const rb = el.querySelector('.release');
    if (rb) rb.onclick = async () => {
      closeModal();
      const c = await ask(mem.sp, `要讓 ${sp.name}（Lv.${mem.level}）離開隊伍嗎？<br><small>離開後就不會回來了</small>`, [{ text: '讓牠回到森林' }, { text: '還是留下來吧' }]);
      if (c === 0) { RUN.team.splice(RUN.team.indexOf(mem), 1); toast(`${sp.name} 回到了森林。謝謝你一路的陪伴！`); updateHUD(); }
      G.mode = G.screen; openTeam();
    };
    list.appendChild(el);
  });
  const rl = m.querySelector('.relicList');
  RUN.relics.forEach(k => rl.appendChild(relicEl(k)));
  m.querySelector('#mClose').onclick = closeModal;
}
// 戰鬥外的背包：可以使用回復藥、勇氣飲料，也可以丟棄道具
const FIELD_ITEMS = ['potion', 'juice', 'scanner', 'expdata'];
function openBagField() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const m = openModal(`<h2>🎒 背包（${RUN.items.length}/${bagMax()}）</h2><p class="sub">回復藥、勇氣飲料、數據掃描器、經驗資料在戰鬥外也能用；其他道具只能在戰鬥中使用（同一種道具會疊在一起）</p><div class="relicList bagList"></div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const list = m.querySelector('.bagList');
  if (!RUN.items.length) list.innerHTML = '<p class="sub">背包是空的。探索地圖撿數據碎片、開寶箱、逛商店都能拿到道具。</p>';
  itemGroups().forEach(({ k, n, i }) => {
    const it = ITEMS[k], field = FIELD_ITEMS.includes(k), el = document.createElement('div');
    el.className = 'relic';
    el.innerHTML = `<div class="ri">${it.icon}</div><div style="flex:1"><b>${it.name}${n > 1 ? ` ×${n}` : ''}</b><div class="rd">${it.desc}</div></div>
      <div class="col2"><button class="btn primary" ${field ? '' : 'disabled'}>${field ? '使用' : '戰鬥中用'}</button><button class="btn">丟棄</button></div>`;
    const [useB, dropB] = el.querySelectorAll('button');
    useB.onclick = () => useFieldItem(i);
    dropB.onclick = () => { RUN.items.splice(i, 1); toast(`丟掉了 ${it.name}`); updateHUD(); saveRun(); closeModal(); openBagField(); };
    list.appendChild(el);
  });
  if (assistOn() && assistList().length) list.insertAdjacentHTML('beforeend', '<p class="sub" style="margin:10px 0 4px">🤝 援護（不佔背包，戰鬥中從「道具」叫出來）</p>' +
    assistList().map(x => { const a = ASSISTS[x.k]; return `<div class="relic"><div class="ri">${dpic(a.img, '🤝', 's44')}</div><div style="flex:1"><b>${a.name}・${a.move}</b><div class="rd">${a.desc}　剩 ${x.n} 次</div></div></div>`; }).join(''));
  m.querySelector('#mClose').onclick = closeModal;
}
// 戰鬥外使用道具（背包、撿到道具但背包滿了的時候）：用掉了回傳 true
async function applyFieldItem(k) {
  if (k === 'potion') {
    const mem = await pickScreen({ title: '💊 要給哪一隻夥伴用？', sub: '回復 30% HP', skip: '取消', items: RUN.team.slice(),
      render: m => { const s = SPECIES[m.sp], ms = memberStats(m), el = document.createElement('div'); el.className = 'pickMon';
        el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}　HP ${m.hp}/${ms.maxhp}</span>`; return el; } });
    if (!mem) return false;
    const ms = memberStats(mem); mem.hp = Math.min(ms.maxhp, mem.hp + healAmt(ms.maxhp * .3)); toast(`${SPECIES[mem.sp].name} 回復了！`); sfx('heal');
    return true;
  }
  if (k === 'juice') { gainCourage(25); toast('🔥 勇氣值 +25'); return true; }
  if (k === 'expdata') { teamExp(.3); toast('📀 全隊獲得了經驗值！'); sfx('levelup'); return true; }
  if (k === 'scanner') {   // 數據掃描器：標出這張地圖所有還沒撿的數據碎片
    if (!AREA || G.screen !== 'area') { toast('🔍 要在探索地圖時才能用'); return false; }
    const n = AREA.objs.filter(o => o.kind === 'pickup' && !o.done).length, maze = AREA.theme === 'pyramid';
    if (!n && !maze) { toast('🔍 這張地圖已經沒有數據碎片了，先留著吧'); return false; }
    if (AREA.scanned) { toast('🔍 這張地圖已經掃描過了'); return false; }
    AREA.scanned = true; AREA._fogDirty = true; sfx('pickup');
    toast(maze ? `🔍 掃描完成！迷宮的路線都照出來了${n ? `，還有 ${n} 個數據碎片` : ''}（陷阱也標出來了）` : `🔍 掃描完成！這張地圖還有 ${n} 個數據碎片，已經標在地圖上`, 3500);
    return true;
  }
  return false;
}
async function useFieldItem(i) {
  const k = RUN.items[i];
  closeModal();
  const used = await applyFieldItem(k);
  if (used) RUN.items.splice(i, 1);
  updateHUD(); saveRun();
  if (!(used && k === 'scanner')) openBagField();   // 用完掃描器直接回到地圖看標記
}

// 戰鬥中隨時可以叫出的規則說明
const HELP = [
  ['⏳ 行動條', '雙方的行動條同時往上漲，集滿就輪到誰行動。速度越快集得越快。輪到你的時候時間會暫停。'],
  ['⚡ 能量', '每回合 3 點，出牌要花能量（卡片左上角的數字）。沒用完的能量最多保留 2 點到下回合。'],
  ['🃏 手牌', '每回合開始把手牌補到 5 張。回合結束時沒用的牌進棄牌堆，但按卡片左下角的 📌（或 Shift＋數字鍵）可以把牌留到下回合，最多 2 張（究極技卡不算）。留越多，新抽的就越少。牌庫抽完會把棄牌洗回去。'],
  ['😈 頭目的干擾', '頭目會在你的手牌上留下標記：🔥 燃燒（打出時受到 6% 傷害）、🌫️ 霧化（看不到效果）、☠️ 汙染（效果減半）、🔍 看破（能量 +1）。卡片離開手牌後標記就會消失（📌 保留的牌會留著）。商店的「✨ 淨化」可以清除。點敵人面板右下角的標籤可以看頭目的能力。'],
  ['🗂️ 牌組上限', '牌組最多 20 張（嘉兒 18 張），每一類也有上限：⚔️ 攻擊 8、🛡️ 防禦回復 6、🔥 勇氣 3、💨 強化干擾 4、✴️ 必殺 3。滿了之後拿新卡要換掉一張同類的卡。卡片右上角的圖示就是它的類型。'],
  ['🧸 商店', '商店的 4 張卡裡有 2 張是只能在這裡買到的「限定卡」。牌組超過「上限 − 2」張時可以賣卡（每間店 2 張）。強化一張卡可以一直買，第一次 30，之後每次 ×1.5。第二章以後還會賣「💠 究極強化」。'],
  ['⚔️ 敵人預告', '敵人頭上會顯示下一招和大概的傷害。看到大招可以先防禦，或用干擾類卡片拖慢牠。'],
  ['🔥 勇氣值', () => P1() ? '全隊共用，最多存 40。出攻擊卡、必殺卡、被攻擊都會增加，勇氣卡增加最多；勇氣飲料、回復泉、事件也能補充。戰鬥結束後會全部保留。' : '全隊共用。出攻擊卡、必殺卡、被攻擊都會增加，勇氣卡增加最多。戰鬥結束後，40 以下完全保留，超過 40 的部分減半。'],
  ['✨ 進化', () => P2() ? '成熟期要 30 勇氣值。第二部在第四章拿到徽章後，隊長 👑 進化成成熟期之後，可以花 1 格「徽章刻度」超進化成完全體（整個第二部共 10 格）；第六章覺醒後，完全體再花 2 格可以究極進化。進化一樣持續 3 回合，結束後強制退場 2 回合。' : P1() ? '按 E 進化到成熟期，需要 30 勇氣值。持續 3 回合，送 2 張究極技卡；究極技卡在進化期間會保留在手上，用掉或退化才會消失。進化結束後，夥伴會力氣用盡、強制退場 2 回合（沒有夥伴可以換的話會留下來，但疲勞：傷害 -20%、速度 -10%）。第一部最多只能進化到成熟期；完全體以上要等第二部拿到徽章。' : '按 E 選擇強度：成熟期 30、完全體 60（Lv.4）、究極體 100（Lv.7）。持續 3 回合，送 2 張究極技卡；究極技卡在進化期間會保留在手上，用掉或退化才會消失。進化結束後，夥伴會力氣用盡、強制退場 2 回合（沒有夥伴可以換的話會留下來，但疲勞：傷害 -20%、速度 -10%）。只有隊長 👑（隊伍第一隻）能進化到完全體、究極體，其他夥伴最多到成熟期。'],
  ['⚠️ 強行進化', '勇氣值不夠（但至少 10）也能硬上，勇氣值全部用掉。先判定成功或失敗（失敗會反噬＋麻痺）；成功後，缺越多越容易失控，變成會暴走的黑暗型態。'],
  ['🤝 勸降', '每次可以選擇代價：1 能量＋10 勇氣值／1 能量＋30 數碼幣／2 能量。敵人血越少成功率越高；失敗敵人會被激怒。頭目不能勸降。'],
  ['🤝 援護', () => P1() ? '冒險途中救出其他孩子的夥伴，牠們就會在戰鬥中來幫你一招。從「道具」叫出來，花 1 能量，每場戰鬥 1 次；每種援護整趟可以用 3 次，同時最多帶 2 種，不佔隊伍位置。' : '新開的冒險才有這個系統。'],
  ['💞 原作搭檔', '孩子帶著原作的搭檔數碼寶貝（例如太一和亞古獸），那隻夥伴的進化消耗 -10%。'],
  ['🔄 換手', '按 Q 換其他夥伴上場（花 1 能量）。出戰夥伴倒下時可以選下一隻，全隊倒下就輸了。'],
  ['💉 屬性', '疫苗種剋病毒種、病毒種剋資料種、資料種剋疫苗種，剋制時傷害 ×1.5，反過來 ×0.75。戰鬥中點資訊框上的屬性標籤可以看相剋表。'],
  ['🌑 領域效果', '頭目和精英怪會帶來對你不利的效果，顯示在戰鬥畫面上方。'],
  ['⌨️ 快捷鍵', '1～8 出牌｜空白鍵 結束回合｜E 進化｜Q 換手｜R 勸降｜B 道具｜H 說明｜M 全部靜音（🔊 按鈕：音樂、音效、進化語音設定）'],
];
// ---------- 存檔備份：把存檔變成一串代碼，換裝置或換 App 時貼上就能帶過去 ----------
// 代碼只用英文字母、數字、- 和 _（手機輸入法不會亂改），開頭是 DG2，後面帶檢查碼，能壓縮就壓縮
const b64url = bytes => { let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return Uint8Array.from(atob(str), c => c.charCodeAt(0)); };
const saveHash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).padStart(7, '0').slice(-7); };
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encodeSave(obj) {
  let bytes = new TextEncoder().encode(JSON.stringify(obj)), flag = 'p';
  if (typeof CompressionStream !== 'undefined') { try { bytes = await pipeBytes(bytes, new CompressionStream('deflate-raw')); flag = 'z'; } catch (e) { } }
  const data = b64url(bytes);
  return 'DG2' + flag + saveHash(data) + data;
}
async function decodeSave(code) {
  code = code || '';
  const i = code.toUpperCase().indexOf('DG2');
  if (i < 0) {   // 舊格式（v10.9）
    const j = code.indexOf('DGADV1');
    if (j < 0) throw new Error('找不到存檔代碼（開頭應該是 DG2）');
    const body = code.slice(j + 6).replace(/^[:：\s]+/, '').replace(/\s/g, '+').replace(/[^A-Za-z0-9+/=]/g, '');
    return checkSave(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body), c => c.charCodeAt(0)))));
  }
  const rest = code.slice(i + 3).replace(/[^A-Za-z0-9_-]/g, '');   // 空白、換行、全形符號都略過
  const flag = rest[0], hash = rest.slice(1, 8), data = rest.slice(8);
  if (saveHash(data) !== hash) throw new Error(`代碼不完整或被改動了（收到 ${data.length} 字），請重新完整複製一次`);
  let bytes = unb64url(data);
  if (flag === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('這個瀏覽器太舊，無法讀取這份代碼');
    bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  }
  return checkSave(JSON.parse(new TextDecoder().decode(bytes)));
}
function checkSave(data) { if (!data || !data.meta) throw new Error('代碼裡沒有存檔資料'); return data; }
function saveSummary(run, meta) {
  const kid = run && KIDS[run.kid], ch = run && CHAPTERS[run.chapter];
  return `${run ? `進行中的冒險：${kid ? kid.name : ''}・${ch ? ch.title.replace('　', ' ') : ''}` : '沒有進行中的冒險'}<br>` +
    `永久紀錄：結局 ${(meta && meta.endings || []).length} / 3、孩子 ${(meta && meta.kids || []).length} 位、夥伴 ${(meta && meta.unlocked || []).length} 隻`;
}
// 📜 我的紀錄：這台裝置上存了哪些進度（只看不改）
function openRecords() {
  const M = META, run = store.get(RUN_KEY);
  const kid = run && KIDS[run.kid], ch = run && CHAPTERS[run.chapter];
  const starters = Object.keys(SPECIES).filter(k => SPECIES[k].starter);
  const part = (name, ok, info) => `<div class="recRow"><b>${name}</b><span>${ok ? info : '🔒 還沒解鎖'}</span></div>`;
  const recList = (list, empty) => list && list.length ? `<div class="relicList">${list.map(r => recordEl(r).outerHTML).join('')}</div>` : `<p class="sub">${empty}</p>`;
  openModal(`<h2>📜 我的紀錄</h2><p class="sub">存在這台裝置、這個瀏覽器裡的進度。更新遊戲不會影響這些紀錄。</p>
    <div class="saveBox"><h3>🎮 進行中的冒險</h3><div class="mini2">${run ? `${kid ? kid.name : ''}・${ch ? ch.title.replace('　', ' ') : ''}（隊伍 ${run.team.length} 隻、牌組 ${run.deck.length} 張）` : '沒有進行中的冒險'}</div></div>
    <div class="saveBox"><h3>🏆 結局（${(M.endings || []).length} / ${Object.keys(ENDINGS).length}）</h3>
      ${Object.keys(ENDINGS).map(k => `<div class="recRow"><b>${ENDINGS[k].icon} ${ENDINGS[k].name}</b><span>${(M.endings || []).includes(k) ? '✅ 已達成' : '❔ 還沒看過'}</span></div>`).join('')}
      <div class="mini2">通關次數 ${M.clears || 0}　｜　冒險次數 ${M.runs || 0}</div></div>
    <div class="saveBox"><h3>📖 進度</h3>
      ${part('🌍 第二部・伺服大陸篇', part2Unlocked(), M.p2clear ? '✅ 已通關' : M.p2ch ? `打到第 ${M.p2ch} 章` : '已解鎖，還沒開始')}
      ${part('🌋 第三部・黑暗四天王篇', part3Unlocked(), M.p3ch ? `打到第 ${M.p3ch} 章` : '已解鎖，還沒開始')}
      <div class="recRow"><b>🧒 孩子</b><span>${(M.kids || []).filter(k => KIDS[k]).length} / ${Object.keys(KIDS).length}　${(M.kids || []).filter(k => KIDS[k]).map(k => KIDS[k].icon).join('')}</span></div>
      <div class="recRow"><b>🐾 夥伴</b><span>${starters.filter(k => (M.unlocked || []).includes(k)).length} / ${starters.length}</span></div>
      <div class="recRow"><b>📕 圖鑑</b><span>${(M.dex || []).length} 種</span></div></div>
    <div class="saveBox"><h3>💾 第一部通關紀錄（第二部用，最多 ${RECORD_MAX} 筆）</h3>${recList(M.records, '還沒有紀錄。v14.0 以後通關第一部會自動存一筆。')}</div>
    <div class="saveBox"><h3>💾 第二部通關紀錄（第三部用，最多 3 筆）</h3>${recList(M.records2, '還沒有紀錄。通關第二部會自動存一筆。')}</div>
    <button class="btn primary" id="mClose">關閉 (Esc)</button>`).querySelector('#mClose').onclick = closeModal;
}
async function openSaveTransfer() {
  const run = store.get(RUN_KEY), meta = store.get(META_KEY) || META;
  const code = await encodeSave({ v: GAME_VERSION, t: Date.now(), run, meta });
  const m = openModal(`<h2>💾 備份／匯入存檔</h2>
    <p class="sub">iPhone 的 Safari、Chrome、加到主畫面的 App 存檔是分開的。在舊的地方複製代碼，到新的地方貼上就能把進度帶過去。</p>
    <div class="saveBox"><h3>📤 備份（這台裝置目前的存檔）</h3>
      <div class="mini2">${saveSummary(run, meta)}</div>
      <textarea id="saveCode" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${code}</textarea>
      <button class="btn primary" id="btnCopySave">📋 複製代碼（${code.length} 字）</button></div>
    <div class="saveBox"><h3>📥 匯入（會覆蓋這裡現在的存檔）</h3>
      <textarea id="loadCode" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="把備份的代碼貼在這裡（開頭是 DG2）"></textarea>
      <div class="col2"><button class="btn" id="btnPasteSave">📋 從剪貼簿貼上</button><button class="btn evo" id="btnLoadSave">匯入存檔</button></div></div>
    <button class="btn" id="mClose">關閉</button>`);
  m.querySelector('#mClose').onclick = closeModal;
  const ta = m.querySelector('#saveCode'), la = m.querySelector('#loadCode');
  ta.addEventListener('input', () => { ta.value = code; });   // 不讓備份的代碼被改到
  m.querySelector('#btnCopySave').onclick = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { }
    if (!ok) { ta.focus(); ta.select(); ta.setSelectionRange(0, code.length); try { ok = document.execCommand('copy'); } catch (e) { } }
    toast(ok ? '📋 已複製！到新的地方按「匯入存檔」貼上' : '請長按上面的代碼，全選後複製', 3500);
  };
  m.querySelector('#btnPasteSave').onclick = async () => {
    try { la.value = await navigator.clipboard.readText(); toast(`已貼上 ${la.value.length} 字`); }
    catch (e) { toast('瀏覽器不允許讀取剪貼簿，請長按下面的框貼上', 3000); la.focus(); }
  };
  m.querySelector('#btnLoadSave').onclick = async () => {
    let data;
    try { data = await decodeSave(la.value); }
    catch (e) { toast(`❌ ${e.message || '代碼不正確'}`, 4000); sfx('error'); return; }
    if (!confirm(`要匯入這份存檔嗎？\n這裡現在的存檔會被覆蓋。\n\n${saveSummary(data.run, data.meta).replace('<br>', '\n')}`)) return;
    store.set(META_KEY, data.meta);
    if (data.run) store.set(RUN_KEY, data.run); else store.del(RUN_KEY);
    loadMeta();
    closeModal();
    toast('✅ 匯入完成！', 3000);
    showTitle();
  };
}
function openAbout() {
  const m = openModal(`<h2>ⓘ 關於本作／版權聲明</h2>
    <div class="about">
      <p><b>本作是粉絲自製的非官方、非營利同人遊戲</b>，與萬代南夢宮（BANDAI NAMCO）、東映動畫及《數碼寶貝》官方沒有任何關係，也未經官方授權。</p>
      <p>《數碼寶貝》（Digimon）及其角色、名稱、圖像與相關設定之著作權與商標權，均屬於原作者本鄉明善（本郷あきよし）、東映動畫、萬代（BANDAI）等原權利方所有。</p>
      <p>遊戲中的數碼寶貝圖片為官方插畫，取自 <b>Digimon API（digi-api.com）</b>，僅為了呈現粉絲作品而使用。</p>
      <p>本遊戲<b>不收費、不含廣告</b>，也不提供任何付費內容。若權利方認為有不妥之處，將立即修改或下架。</p>
      <p class="mini2">遊戲系統、劇情文字與程式為粉絲原創；遊戲在 Claude（Anthropic）的協助下製作。</p>
      <p class="mini2">目前版本：v${GAME_VERSION}　｜　更新內容請看「更新紀錄.md」</p>
    </div>
    <button class="btn primary" id="mClose">關閉</button>`);
  m.querySelector('#mClose').onclick = closeModal;
}
function openHelp() {
  const m = openModal(`<h2>❓ 遊戲說明</h2><div class="helpGrid">${HELP.map(([t, d]) => `<div class="helpCard"><b>${t}</b><p>${typeof d === 'function' ? d() : d}</p></div>`).join('')}</div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  m.querySelector('#mClose').onclick = closeModal;
}

function openDeck() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const counts = {};
  RUN.deck.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const m = openModal(`<h2>牌組（${RUN.deck.length} 張）</h2><p class="sub">${deckSummary()}<br>「必殺」卡會變成出戰夥伴的必殺技；回復泉、商店可以強化卡片，商店可以賣卡</p><div class="deckCards"></div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const box = m.querySelector('.deckCards');
  Object.entries(counts).forEach(([id, n]) => box.appendChild(cardEl(id, { isStatic: true, count: n })));
  m.querySelector('#mClose').onclick = closeModal;
}

// =========================================================
//   輸入
// =========================================================
document.addEventListener('keydown', e => {
  if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;   // 在輸入框打字時不觸發快捷鍵
  const k = e.key.toLowerCase();
  if (k === 'm' && !e.repeat) { toggleAllSound(); return; }
  if (G.dialog) {
    if (DLG.choices) { if (/^[1-9]$/.test(k)) { const i = +k - 1, c = DLG.choices[i]; if (c && !c.disabled) DLG.resolve(i); } }
    else if (k === ' ' || k === 'enter') { e.preventDefault(); DLG.resolve && DLG.resolve(0); }
    return;
  }
  if (G.mode === 'area') {
    if (DIRS[k]) { keys.add(k); e.preventDefault(); }
    if (k === 'c') openDeck();
    if (k === 't') openTeam();
    if (k === 'i') openBagField();
  } else if (G.mode === 'route') {
    if (k === 'c') openDeck();
    if (k === 't') openTeam();
    if (k === 'i') openBagField();
  } else if (G.mode === 'modal') {
    if (k === 'escape' || k === 'c' || k === 't' || k === 'i' || k === 'h') closeModal();
  } else if (G.mode === 'battle' && B) {
    if (noticeOpen()) { if (k === ' ' || k === 'enter' || k === 'escape') { e.preventDefault(); closeNotice(); } return; }
    if (k === 'escape') { if (B.phase !== 'choose') closePopups(); }
    else if (popupOpen()) {
      const opts = [...document.querySelectorAll('.popup:not(.hidden) .evoOpt, .popup:not(.hidden) .swOpt')];
      if (/^[1-6]$/.test(k)) opts[+k - 1]?.click();
      else if (k === 'e' && !$('#evoPanel').classList.contains('hidden')) closePopups();
      else if (k === 'q' && !$('#switchPanel').classList.contains('hidden') && B.phase !== 'choose') closePopups();
    }
    else if (e.shiftKey && /^Digit[1-8]$/.test(e.code)) togglePin(+e.code.slice(5) - 1);   // Shift＋數字：📌 保留那張牌
    else if (/^[1-8]$/.test(k)) playCard(+k - 1);
    else if (k === ' ' || k === 'enter') { e.preventDefault(); endTurn(); }
    else if (k === 'e') openEvo();
    else if (k === 'q') openSwitch(false);
    else if (k === 'r') persuade();
    else if (k === 'b') openBag();
    else if (k === 'h') openHelp();
  }
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
$('#btnEnd').onclick = endTurn;
$('#btnEvo').onclick = openEvo;
$('#btnFlee').onclick = flee;
$('#btnSwitch').onclick = () => openSwitch(false);
$('#btnPersuade').onclick = persuade;
$('#btnBag').onclick = openBag;
$('#btnKidBack').onclick = showTitle;
$('#btnKidOk').onclick = () => chosenKid && showSelect();
$('#btnTeam').onclick = openTeam;
$('#btnDeck').onclick = openDeck;
$('#btnBagField').onclick = openBagField;
$('#btnNew').onclick = async () => {
  if (store.get(RUN_KEY) && !confirm('開始新的冒險會放棄目前的進度，確定嗎？')) return;
  clearRun();
  if (!META.tutorialAsked) {
    META.tutorialAsked = true; saveMeta();
    if (await askTutorial() === 'new') { runTutorial(); return; }
  }
  showKidSelect();
};
$('#btnPart2').onclick = () => startPart2();
$('#btnPart3').onclick = () => startPart3();
$('#btnTutorial').onclick = () => runTutorial();   // 教學不會動到冒險存檔
$('#btnHelp').onclick = openHelp;
document.querySelectorAll('.soundBtn').forEach(b => { b.textContent = SFX.on || VOICE.music ? '🔊' : '🔇'; b.onclick = e => { e.stopPropagation(); openAudioSettings(); }; });
['#pPanel', '#ePanel'].forEach(s => $(s + ' .fattr').addEventListener('click', e => { e.stopPropagation(); sfx('click'); showAttrChart(); }));
$('#btnAbout').onclick = () => { G.mode = 'title'; openAbout(); };
$('#btnSave').onclick = () => { G.mode = 'title'; openSaveTransfer(); };
$('#btnRecords').onclick = () => { G.mode = 'title'; openRecords(); };
$('#btnContinue').onclick = continueRun;
$('#btnBackTitle').onclick = showKidSelect;
$('#btnQuit').onclick = () => { if (confirm('回到標題畫面？（進度會保留在最後經過的節點）')) showTitle(); };

cvs.addEventListener('pointerdown', tapArea);   // 點地圖自動走過去

// ---------- 觸控：浮動搖桿（按在左半邊哪裡就出現在哪裡） ----------
const JOY = { id: null, x: 0, y: 0, t: 0, moved: false, dir: null };
const JOY_R = 52, JOY_DEAD = 14;
function joySetDir(d) {   // d：一個或兩個方向鍵（用空白隔開），斜著推就同時按兩個
  if (JOY.dir === d) return;
  if (JOY.dir) JOY.dir.split(' ').forEach(k => keys.delete(k));
  JOY.dir = d;
  if (d) d.split(' ').forEach(k => keys.add(k));
}
(() => {
  const zone = $('#joyZone'), base = $('#joyBase'), knob = $('#joyKnob');
  // 平常半透明地待在左下角（像傳說對決）；按下時移到手指的位置，放開後滑回來
  const home = () => {
    if (JOY.id !== null) return;
    base.style.left = '82px';
    base.style.top = (window.innerHeight - (window.innerHeight > window.innerWidth ? 112 : 92)) + 'px';
    knob.style.transform = 'translate(-50%,-50%)';
  };
  home();
  addEventListener('resize', home);
  const end = e => {
    if (e.pointerId !== JOY.id) return;
    joySetDir(null);
    base.classList.remove('on');
    base.classList.add('glide'); setTimeout(() => base.classList.remove('glide'), 250);
    // 很快放開又沒拖動 → 當成「點地圖自動走過去」
    if (!JOY.moved && performance.now() - JOY.t < 300) tapArea(e);
    JOY.id = null;
    home();
  };
  zone.addEventListener('pointerdown', e => {
    if (G.mode !== 'area' || JOY.id !== null) return;
    e.preventDefault();
    JOY.id = e.pointerId; JOY.x = e.clientX; JOY.y = e.clientY; JOY.t = performance.now(); JOY.moved = false;
    try { zone.setPointerCapture(e.pointerId); } catch (err) { }
    base.classList.remove('glide');
    base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
    knob.style.transform = 'translate(-50%,-50%)';
    base.classList.add('on');
    $('#joyHint').classList.add('hidden');
    if (AREA) AREA.path = null;
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== JOY.id) return;
    let dx = e.clientX - JOY.x, dy = e.clientY - JOY.y;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    if (d < JOY_DEAD) { joySetDir(null); return; }
    JOY.moved = true;
    // 8 個方向：每 45 度一格
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, sx = Math.round(Math.cos(a)), sy = Math.round(Math.sin(a));
    joySetDir([sx > 0 ? 'arrowright' : sx < 0 ? 'arrowleft' : '', sy > 0 ? 'arrowdown' : sy < 0 ? 'arrowup' : ''].filter(Boolean).join(' '));
  });
  ['pointerup', 'pointercancel'].forEach(t => zone.addEventListener(t, end));
  // 擋掉瀏覽器自己的捲動／回彈／放大鏡：不然拖搖桿時整個網頁會跟著晃
  const stop = e => { if (G.mode === 'area' && e.cancelable) e.preventDefault(); };
  zone.addEventListener('touchstart', stop, { passive: false });
  zone.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('touchmove', e => { if (JOY.id !== null && e.cancelable) e.preventDefault(); }, { passive: false });
})();

// ---------- 觸控用的虛擬方向鍵（舊版，保留但預設隱藏） ----------
document.querySelectorAll('#dpad [data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); keys.add(k); b.classList.add('on'); };
  const off = e => { e.preventDefault(); keys.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, off));
});
// 小螢幕：點 HUD 展開／收合完整資訊
$('#hud').addEventListener('click', e => { if (e.target.closest('button')) return; $('#hud').classList.toggle('expanded'); });

// =========================================================
//   背景音樂：依目前的畫面換曲子
// =========================================================
function wantMusic() {
  if (!VOICE.music) return null;
  if (G.cut) return G.cut.music || null;   // 劇情插畫播放中
  if (B && G.mode === 'battle') return B.opt.boss ? 'boss' : 'battle';
  if (G.screen === 'area') return 'field';
  return 'route';   // 路線圖、標題、選角
}
function updateMusic() {
  const w = wantMusic();
  if (w !== (BGM.playing || null)) { if (w) BGM.play(w); else BGM.stop(); }
}
// 瀏覽器要等玩家第一次點擊才能出聲；切到背景時暫停
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (VOICE.music) BGM.audio(); }, { capture: true }));
document.addEventListener('visibilitychange', () => { [BGM.ctxRaw && BGM.ctxRaw(), SFX.ctx].forEach(A => { if (A) document.hidden ? A.suspend() : A.resume(); }); });   // 切到背景：音樂、音效都暫停
// 聲音設定（🔊 按鈕）
const VOICE_LANGS = [['ja', '日文'], ['zh', '國語'], ['robot', '機械音'], ['off', '關閉']];
function openAudioSettings() {
  const m = openModal(`<h2>🔊 聲音與省電</h2><div class="audioSet">
    <div class="aRow"><span>🎵 背景音樂</span><button class="btn" id="aMusic"></button></div>
    <div class="aRow"><span>🔔 音效</span><button class="btn" id="aSfx"></button></div>
    <div class="aRow col"><span>🗣️ 進化語音</span><div class="aLangs">${VOICE_LANGS.map(([k, t]) => `<button class="btn" data-lang="${k}">${t}</button>`).join('')}</div></div>
    <p class="sub" id="aNote"></p>
    <div class="aRow"><span>🔋 省電模式</span><button class="btn" id="aPower"></button></div>
    <p class="sub">開啟後畫面每秒重畫比較少次、戰鬥背景沒有粒子、解析度降低、地圖的水面和迷霧不會動，比較不耗電。</p></div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const paint = () => {
    m.querySelector('#aMusic').textContent = VOICE.music ? '開' : '關'; m.querySelector('#aMusic').classList.toggle('primary', VOICE.music);
    m.querySelector('#aSfx').textContent = SFX.on ? '開' : '關'; m.querySelector('#aSfx').classList.toggle('primary', SFX.on);
    m.querySelector('#aPower').textContent = POWER.save ? '開' : '關'; m.querySelector('#aPower').classList.toggle('primary', POWER.save);
    m.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('primary', b.dataset.lang === VOICE.lang));
    const L = VOICE.lang;
    m.querySelector('#aNote').innerHTML = L === 'off' ? '進化時不念台詞。' : L === 'robot' ? '合成的機械音「Evolution」，每台裝置聽起來都一樣。'
      : VOICE.available(L) ? `用這台裝置內建的${L === 'ja' ? '日文' : '國語'}語音念台詞（例如「${VOICE.lines({ img: 'Agumon', name: '亞古獸' }, { img: 'Greymon', name: '暴龍獸' }, 'evo')[L]}」）。iPhone 要關掉靜音模式才聽得到。`
      : `⚠️ 這台裝置好像沒有${L === 'ja' ? '日文' : '國語'}語音。iPhone 可以到「設定 → 輔助使用 → 朗讀內容 → 聲音」下載。`;
    document.querySelectorAll('.soundBtn').forEach(b => b.textContent = SFX.on || VOICE.music ? '🔊' : '🔇');
  };
  m.querySelector('#aMusic').onclick = () => { VOICE.music = !VOICE.music; VOICE.save(); if (!VOICE.music) BGM.stop(); paint(); };
  m.querySelector('#aSfx').onclick = () => { toggleSound(); paint(); };
  m.querySelector('#aPower').onclick = () => { POWER.toggle(); toast(POWER.save ? '🔋 省電模式開啟' : '🔋 省電模式關閉'); paint(); };
  m.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { VOICE.lang = b.dataset.lang; VOICE.save(); paint(); VOICE.evoLine({ img: 'Agumon', name: '亞古獸' }, { img: 'Greymon', name: '暴龍獸' }, 'evo'); });
  m.querySelector('#mClose').onclick = closeModal;
  paint();
}
// M 鍵：音樂和音效一起開關
function toggleAllSound() {
  const on = !(SFX.on || VOICE.music);
  if (SFX.on !== on) toggleSound();
  VOICE.music = on; VOICE.save(); if (!on) BGM.stop();
  document.querySelectorAll('.soundBtn').forEach(b => b.textContent = on ? '🔊' : '🔇');
  toast(on ? '🔊 音樂、音效開啟' : '🔇 全部靜音');
}

// =========================================================
//   主迴圈
// =========================================================
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // 地圖上沒在走、沒有按鍵、1.5 秒沒操作 → 降到每秒 10 次
  const idle = G.mode === 'area' && AREA && !AREA.mv.moving && !(AREA.path && AREA.path.length) && !keys.size && now - POWER.act > 1500;
  if (!POWER.gate('main', now, idle ? 10 : POWER.fps())) return;
  const dt = Math.min(.2, (now - last) / 1000); last = now;
  if (AREA && G.mode === 'area' && !G.dialog) updateArea(dt);
  if (G.mode === 'transition') G.trans.t += dt;
  if (G.mode === 'battle' && B) { updateBattle(dt); if (B) updateGauges(); }
  updateMusic();
  if (AREA && RUN && G.screen === 'area' && !$('#areaScreen').classList.contains('hidden')) drawArea(POWER.save ? 0 : now / 1000);   // 省電模式：水面、迷霧不動
}

loadMeta();
showTitle();
requestAnimationFrame(frame);
