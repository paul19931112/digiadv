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
function saveRun() { if (RUN) store.set(RUN_KEY, RUN); }
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
  RUN = { kid: chosenKid, team: [], items: ['potion'], deck: [...STARTER_DECK, KIDS[chosenKid].card], courage: 10, bits: 30, relics: [], flags: {},
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
  showRoute();
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
  $('#hudItems').innerHTML = `<span class="mini2">🎒</span>` + (RUN.items.length ? RUN.items.map(k => `<span class="hr" title="${ITEMS[k].name}：${ITEMS[k].desc}">${ITEMS[k].icon}</span>`).join('') : '<span class="mini2">背包是空的</span>') + `<span class="mini2">（${RUN.items.length}/${bagMax()}）</span>`;
  $('#hudRelics').innerHTML = RUN.relics.length ? RUN.relics.map(k => `<span class="hr" title="${RELICS[k].name}：${RELICS[k].desc}">${RELICS[k].icon}</span>`).join('') : '<span class="mini2">還沒有徽章道具</span>';
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
function closeModal() { sfx('close'); $('#modal').classList.add('hidden'); if (G.mode === 'modal') G.mode = G.modalFrom || 'area'; }
function openTeam() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const m = openModal(`<h2>我的隊伍（${RUN.team.length}/${teamMax()}）</h2>
    <p class="sub">隊長會帶頭出戰。🔥 勇氣值全隊共用：目前 ${Math.floor(RUN.courage)} / ${COURAGE_MAX}</p>
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
      <div class="col2">${i === 0 ? '<b style="color:var(--accent)">★ 隊長</b>' : '<button class="btn lead">設為隊長</button>'}${RUN.team.length > 1 ? '<button class="btn release">讓牠離隊</button>' : ''}</div>`;
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
const FIELD_ITEMS = ['potion', 'juice'];
function openBagField() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const m = openModal(`<h2>🎒 背包（${RUN.items.length}/${bagMax()}）</h2><p class="sub">回復藥、勇氣飲料在戰鬥外也能用；其他道具只能在戰鬥中使用</p><div class="relicList bagList"></div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const list = m.querySelector('.bagList');
  if (!RUN.items.length) list.innerHTML = '<p class="sub">背包是空的。探索地圖撿 ✨、開寶箱、逛商店都能拿到道具。</p>';
  RUN.items.forEach((k, i) => {
    const it = ITEMS[k], field = FIELD_ITEMS.includes(k), el = document.createElement('div');
    el.className = 'relic';
    el.innerHTML = `<div class="ri">${it.icon}</div><div style="flex:1"><b>${it.name}</b><div class="rd">${it.desc}</div></div>
      <div class="col2"><button class="btn primary" ${field ? '' : 'disabled'}>${field ? '使用' : '戰鬥中用'}</button><button class="btn">丟棄</button></div>`;
    const [useB, dropB] = el.querySelectorAll('button');
    useB.onclick = () => useFieldItem(i);
    dropB.onclick = () => { RUN.items.splice(i, 1); toast(`丟掉了 ${it.name}`); updateHUD(); closeModal(); openBagField(); };
    list.appendChild(el);
  });
  m.querySelector('#mClose').onclick = closeModal;
}
async function useFieldItem(i) {
  const k = RUN.items[i];
  if (k === 'potion') {
    closeModal();
    const mem = await pickScreen({ title: '💊 要給哪一隻夥伴用？', sub: '回復 30% HP', skip: '取消', items: RUN.team.slice(),
      render: m => { const s = SPECIES[m.sp], ms = memberStats(m), el = document.createElement('div'); el.className = 'pickMon';
        el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}　HP ${m.hp}/${ms.maxhp}</span>`; return el; } });
    if (mem) { const ms = memberStats(mem); mem.hp = Math.min(ms.maxhp, mem.hp + healAmt(ms.maxhp * .3)); RUN.items.splice(i, 1); toast(`${SPECIES[mem.sp].name} 回復了！`); }
    updateHUD(); openBagField(); return;
  }
  if (k === 'juice') { gainCourage(25); RUN.items.splice(i, 1); toast('🔥 勇氣值 +25'); updateHUD(); closeModal(); openBagField(); }
}

// 戰鬥中隨時可以叫出的規則說明
const HELP = [
  ['⏳ 行動條', '雙方的行動條同時往上漲，集滿就輪到誰行動。速度越快集得越快。輪到你的時候時間會暫停。'],
  ['⚡ 能量', '每回合 3 點，出牌要花能量（卡片左上角的數字）。沒用完的能量最多保留 2 點到下回合。'],
  ['🃏 手牌', '每回合抽 5 張，回合結束時沒用的牌進棄牌堆。牌庫抽完會把棄牌洗回去。'],
  ['⚔️ 敵人預告', '敵人頭上會顯示下一招和大概的傷害。看到大招可以先防禦，或用干擾類卡片拖慢牠。'],
  ['🔥 勇氣值', '全隊共用。出攻擊卡、必殺卡、被攻擊都會增加，勇氣卡增加最多。戰鬥結束後，40 以下完全保留，超過 40 的部分減半。'],
  ['✨ 進化', '按 E 選擇強度：成熟期 30、完全體 60（Lv.4）、究極體 100（Lv.7）。持續 3 回合，送 2 張究極技卡；究極技卡在進化期間會保留在手上，用掉或退化才會消失。'],
  ['⚠️ 強行進化', '勇氣值不夠（但至少 10）也能硬上，勇氣值全部用掉。先判定成功或失敗（失敗會反噬＋麻痺）；成功後，缺越多越容易失控，變成會暴走的黑暗型態。'],
  ['🤝 勸降', '每次可以選擇代價：1 能量＋10 勇氣值／1 能量＋30 數碼幣／2 能量。敵人血越少成功率越高；失敗敵人會被激怒。頭目不能勸降。'],
  ['💞 原作搭檔', '孩子帶著原作的搭檔數碼寶貝（例如太一和亞古獸），那隻夥伴的進化消耗 -10%。'],
  ['🔄 換手', '按 Q 換其他夥伴上場（花 1 能量）。出戰夥伴倒下時可以選下一隻，全隊倒下就輸了。'],
  ['💉 屬性', '疫苗種剋病毒種、病毒種剋資料種、資料種剋疫苗種，剋制時傷害 ×1.5。'],
  ['🌑 領域效果', '頭目和精英怪會帶來對你不利的效果，顯示在戰鬥畫面上方。'],
  ['⌨️ 快捷鍵', '1～8 出牌｜空白鍵 結束回合｜E 進化｜Q 換手｜R 勸降｜B 道具｜H 說明｜M 音效開關'],
];
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
  const m = openModal(`<h2>❓ 遊戲說明</h2><div class="helpGrid">${HELP.map(([t, d]) => `<div class="helpCard"><b>${t}</b><p>${d}</p></div>`).join('')}</div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  m.querySelector('#mClose').onclick = closeModal;
}

function openDeck() {
  if (!RUN || !['area', 'route'].includes(G.mode)) return;
  const counts = {};
  RUN.deck.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const m = openModal(`<h2>牌組（${RUN.deck.length} 張）</h2><p class="sub">「必殺」卡會變成出戰夥伴的必殺技；回復泉可以強化卡片，商店可以刪卡</p><div class="deckCards"></div><button class="btn primary" id="mClose">關閉 (Esc)</button>`);
  const box = m.querySelector('.deckCards');
  Object.entries(counts).forEach(([id, n]) => box.appendChild(cardEl(id, { isStatic: true, count: n })));
  m.querySelector('#mClose').onclick = closeModal;
}

// =========================================================
//   輸入
// =========================================================
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'm' && !e.repeat) { toggleSound(); return; }
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
    if (k === 'escape') { if (B.phase !== 'choose') closePopups(); }
    else if (popupOpen()) {
      const opts = [...document.querySelectorAll('.popup:not(.hidden) .evoOpt, .popup:not(.hidden) .swOpt')];
      if (/^[1-6]$/.test(k)) opts[+k - 1]?.click();
      else if (k === 'e' && !$('#evoPanel').classList.contains('hidden')) closePopups();
      else if (k === 'q' && !$('#switchPanel').classList.contains('hidden') && B.phase !== 'choose') closePopups();
    }
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
$('#btnTutorial').onclick = () => runTutorial();   // 教學不會動到冒險存檔
$('#btnHelp').onclick = openHelp;
document.querySelectorAll('.soundBtn').forEach(b => { b.textContent = SFX.on ? '🔊' : '🔇'; b.onclick = e => { e.stopPropagation(); toggleSound(); }; });
$('#btnAbout').onclick = () => { G.mode = 'title'; openAbout(); };
$('#btnContinue').onclick = continueRun;
$('#btnBackTitle').onclick = showKidSelect;
$('#btnQuit').onclick = () => { if (confirm('回到標題畫面？（進度會保留在最後經過的節點）')) showTitle(); };

cvs.addEventListener('pointerdown', tapArea);   // 點地圖自動走過去

// ---------- 觸控用的虛擬方向鍵 ----------
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
//   主迴圈
// =========================================================
let last = performance.now();
function frame(now) {
  const dt = Math.min(.2, (now - last) / 1000); last = now;
  if (AREA && G.mode === 'area' && !G.dialog) updateArea(dt);
  if (G.mode === 'transition') G.trans.t += dt;
  if (G.mode === 'battle' && B) { updateBattle(dt); if (B) updateGauges(); }
  if (AREA && RUN && G.screen === 'area' && !$('#areaScreen').classList.contains('hidden')) drawArea(now / 1000);
  requestAnimationFrame(frame);
}

loadMeta();
showTitle();
requestAnimationFrame(frame);
