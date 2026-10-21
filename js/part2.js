'use strict';
/* =========================================================
   第二部「伺服大陸篇」：通關紀錄、第二部開場、徽章與覺醒、章節流程
   - 第一部通關時存一筆通關紀錄（最多 3 筆），第二部從其中一筆接續
   - 隊伍和等級、牌組全部帶過去；道具挑最多 3 個；新卡挑 3 張；數碼幣、背包、勇氣值重來
   - 第四章劇情拿到自己的徽章 → 孩子覺醒、隊長可以花「徽章刻度」超進化
   ========================================================= */
const RECORD_MAX = 3;
const P2_START_CARDS = ['spread', 'sandstorm', 'datasteal', 'counter', 'charge'];   // 開場挑 3 張（標籤共鳴只在商店賣）
const CREST_TICKS = 10;
// 徽章覺醒：孩子的特性升級成完整版
const AWAKEN = {
  taichi:   { mods: { startCourage: 10 }, text: '每場戰鬥勇氣值 +10' },
  yamato:   { mods: { allSwitchFree: true }, text: '換手都不花能量' },
  sora:     { mods: { loveGuardN: 2 }, text: '愛的守護每場可以撐住 2 次' },
  koushiro: { mods: { firstTurnDraw: 1 }, text: '每場戰鬥第一回合再多抽 1 張' },
  mimi:     { mods: { courage: 1.68 }, text: '勇氣值累積再 +20%' },
  jou:      { mods: { bigBlock: true }, text: '每回合護盾變成 5＋最大 HP×8%' },
  takeru:   { mods: { revivePct: .6 }, text: '復活時回復 60% HP' },
  hikari:   { mods: { discEvery: true }, text: '每回合第一張牌少 1 能量' },
};
const part2Unlocked = () => META.endings.length >= 2;

// ---------- 通關紀錄 ----------
function recordEl(r) {
  const el = document.createElement('div'); el.className = 'relic clickable recordCard';
  const e = ENDINGS[r.ending];
  el.innerHTML = `<div class="ri">${e ? e.icon : '🏁'}</div><div style="flex:1"><b>${KIDS[r.kid].name}${e ? '・' + e.name : ''}</b>
    <div class="rd">${r.team.map(m => `${SPECIES[m.sp].name} Lv.${m.level}`).join('、')}<br>牌組 ${r.deck.length} 張｜道具 ${r.relics.length} 個｜${r.date}</div></div>`;
  return el;
}
async function saveClearRecord(kind) {
  const keep = k => RELICS[k] && !RELICS[k].dark && !RELICS[k].special && !CREST_KEYS.includes(k);
  const rec = { id: Date.now(), kid: RUN.kid, ending: kind, date: new Date().toLocaleDateString('zh-TW'),
    team: RUN.team.map(m => ({ sp: m.sp, level: m.level, exp: m.exp || 0 })), deck: [...RUN.deck], relics: RUN.relics.filter(keep) };
  META.records = META.records || [];
  if (META.records.length >= RECORD_MAX) {
    const old = await pickScreen({ title: '💾 通關紀錄已經有 3 筆', sub: '選一筆讓這次的紀錄覆蓋（第二部會從通關紀錄接續）', items: META.records, skip: '這次不存', render: recordEl });
    if (!old) return false;
    META.records = META.records.filter(r => r !== old);
  }
  META.records.push(rec); saveMeta();
  toast('💾 通關紀錄已儲存，可以從標題畫面開始第二部', 4000);
  return true;
}

// ---------- 第二部開場 ----------
function kidPickEl(id) {
  const k = KIDS[id], el = document.createElement('div'); el.className = 'relic clickable';
  el.innerHTML = `<div class="ri" style="background:${k.color}">${k.icon}</div><div style="flex:1"><b>${k.name}</b><div class="rd">搭檔：${SPECIES[k.partner].name}</div></div>`;
  return el;
}
// 第一部在 v14 以前就通關、沒有通關紀錄的人用預設隊伍
async function defaultRecord() {
  const kid = await pickScreen({ title: '用預設隊伍開始', sub: '選一個孩子（隊伍是搭檔 Lv.13 加兩隻 Lv.12 的夥伴）', items: META.kids.filter(k => KIDS[k]), skip: '返回', render: kidPickEl });
  if (!kid) return null;
  const p = KIDS[kid].partner, others = shuffle(META.unlocked.filter(s => s !== p && SPECIES[s] && SPECIES[s].starter)).slice(0, 2);
  return { kid, ending: META.endings[0] || 'light', team: [{ sp: p, level: 13 }, ...others.map(s => ({ sp: s, level: 12 }))],
           deck: [...STARTER_DECK, KIDS[kid].card, 'double', 'heavy', 'wall', 'heal', 'pierce', 'drain', 'focus'], relics: [], date: '預設隊伍' };
}
async function startPart2() {
  if (store.get(RUN_KEY) && !confirm('開始第二部會放棄目前的冒險進度，確定嗎？')) return;
  const recs = META.records || [];
  const pickRec = await pickScreen({ title: '🌍 第二部・伺服大陸篇', sub: '選一筆通關紀錄接續：隊伍、等級、牌組都會帶過去；數碼幣、背包、勇氣值重新開始',
    items: [...recs, 'default'], skip: '返回',
    render: r => { if (r !== 'default') return recordEl(r); const el = document.createElement('div'); el.className = 'relic clickable';
      el.innerHTML = '<div class="ri">🎒</div><div style="flex:1"><b>用預設隊伍開始</b><div class="rd">沒有通關紀錄時用這個（第一部在 v14 以前通關的話）</div></div>'; return el; } });
  if (!pickRec) return;
  const rec = pickRec === 'default' ? await defaultRecord() : pickRec;
  if (!rec) return;
  chosenKid = rec.kid;
  RUN = { kid: rec.kid, team: rec.team.map(m => Object.assign(newMember(m.sp, m.level), { exp: m.exp || 0 })), items: ['potion'], deck: [...rec.deck],
          courage: 10, bits: 60, relics: [], flags: {}, rules: 'p2', chapter: 4, route: null, pos: null, visited: [], usedEvents: [], seen: [],
          stats: { wins: 0, chapters: 0 }, crest: false, crestTicks: 0, from: rec.ending };
  RUN.team.forEach(m => m.hp = memberStats(m).maxhp);
  // 道具：最多帶 3 個
  const pool = [...rec.relics];
  if (pool.length <= 3) RUN.relics = pool;
  else for (let i = 0; i < 3 && pool.length; i++) {
    const k = await pickScreen({ title: `🎒 選要帶去第二部的道具（${i + 1}/3）`, sub: '最多帶 3 個', items: pool, skip: '不帶了', render: k => relicEl(k) });
    if (!k) break; RUN.relics.push(k); pool.splice(pool.indexOf(k), 1);
  }
  // 新卡：挑 3 張
  const cards = [...P2_START_CARDS];
  for (let i = 0; i < 3; i++) {
    const id = await pickScreen({ title: `🃏 第二部的新卡片：選 3 張（${i + 1}/3）`, sub: `牌組上限變成 ${K().deckMax} 張`, items: cards, allowSkip: false, render: id => cardEl(id) });
    cards.splice(cards.indexOf(id), 1);
    await acquireCard(id);
  }
  startChapter(4);
  META.runs++; saveMeta();
  G.mode = 'story'; showScreen('');
  await part2Prologue(rec.ending);
  saveRun();
  await chapterCard(CHAPTERS[4].title, '在伺服大陸上找到自己的徽章，打倒猴子獸！');
  showRoute();
}
async function part2Prologue(ending) {
  const first = { light: [[null, '檔案島恢復了和平。'], [null, '大家搭上鯨魚獸，前往大海另一邊的「伺服大陸」。']],
                  hidden: [[null, '被拯救的數碼寶貝們在岸邊揮手送行——'], [null, '大家搭上鯨魚獸，前往大海另一邊的「伺服大陸」。']],
                  dark: [[null, '數碼裝置上的黑色裂痕，還在隱隱作痛……'], [null, '為了找回真正的力量，大家搭上鯨魚獸，前往「伺服大陸」。']] }[ending] || [[null, '大家搭上鯨魚獸，前往「伺服大陸」。']];
  await cutscene([
    { bg: 'sea', music: 'route', amb: 'waves', chars: [['Whamon', 56, 74, 46, 'in-r']], fx: '<div class="cutRays" style="--rx:72%;--ry:42%"></div>', lines: [...first, [{ img: 'Whamon', name: '鯨魚獸' }, '抓緊囉～要潛下去了！']] },
    { bg: 'burst', amb: null, sting: true, chars: [['partner', 50, 76, 46, 'in-l']], fx: '<div class="cutSpeed"></div>', lines: [['me', '出發吧！新的冒險！'], ['partner', `嗯！${KIDS[RUN.kid].nick}，我們走！`]] },
    { bg: 'desert', music: 'field', amb: 'wind', chars: [['partner', 30, 76, 30, 'in-l']], lines: [[null, '伺服大陸——一望無際的沙漠。'], ['partner', '好熱……這裡的數碼寶貝好像也被誰控制著。']] },
    { bg: 'stage', music: null, amb: null, chars: [['Etemon', 50, 78, 58, 'dark']], lines: [['shadow', '嘿嘿嘿……新的觀眾自己送上門啦～']] },
  ]);
}

// ---------- 第四章：拿到自己的徽章 ----------
async function crestEvent() {
  const k = KIDS[RUN.kid], aw = AWAKEN[RUN.kid];
  await cutscene([{ bg: 'desert', music: 'route', amb: 'wind', chars: [['partner', 22, 76, 28, 'in-l']], fx: `<div class="cutCrest" data-from="1">${k.icon}</div>`,
    lines: [[null, '沙漠深處，數碼裝置突然發出強光——'], ['me', '這是……「標籤」？'], [null, `標籤裡嵌進了一枚發光的徽章——<b>${k.crest}的徽章</b>！`],
      ['partner', '感覺……有股力量湧上來了！'],
      [null, `🔰 <b>徽章覺醒</b>：${aw ? aw.text : '孩子的特性變強了'}。<br>隊長 👑 進化成成熟期之後，可以花「徽章刻度」超進化成完全體（整個第二部共 ${CREST_TICKS} 格）。`]] }]);
  RUN.crest = true; RUN.crestTicks = CREST_TICKS + (RUN.crestTicks || 0);
  saveRun(); updateHUD();
}

// ---------- 第二部結局（第三部製作中） ----------
async function part2ChapterDone() {
  G.mode = 'busy';
  await cutscene([
    { bg: 'light', music: 'route', amb: null, chars: [['partner', 30, 76, 32, 'in-l']], lines: [[null, '紫色的霧散去，東京迎來了早晨。'], ['partner', '我們贏了……！吸血魔獸被打倒了！'], ['me', '大家，謝謝你們。']] },
    { bg: 'tokyo', music: null, amb: 'drone', chars: [], lines: [[null, '可是——天空裂開了一道縫，裡面映出數碼世界扭曲的樣子。'], [null, '一座倒過來的山，從雲裡垂了下來……']] },
    { bg: 'void', music: null, amb: 'drone', chars: [['Piemon', 50, 78, 56, 'dark']], fx: '<div class="cutTitle"><b>第三部</b><strong>黑暗四天王</strong><small>製作中・敬請期待</small></div>',
      lines: [['shadow', '吸血魔獸只不過是開場的小丑而已。'], ['shadow', '來吧，被選召的孩子們——數碼世界的真正黑暗，在等著你們。']] },
  ]);
  META.p2ch = Math.max(META.p2ch || 0, RUN.chapter); META.p2clear = (META.p2clear || 0) + 1; META.clears++;
  // 第二部通關紀錄（第三部接續用，最多 3 筆，太多就丟掉最舊的）
  META.records2 = [...(META.records2 || []), { id: Date.now(), kid: RUN.kid, date: new Date().toLocaleDateString('zh-TW'),
    team: RUN.team.map(m => ({ sp: m.sp, level: m.level, exp: m.exp || 0 })), deck: [...RUN.deck], relics: RUN.relics.filter(k => RELICS[k] && !RELICS[k].dark) }].slice(-3);
  recordDex(); saveMeta(); clearRun();
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><div style="font-size:70px">🌅</div><h1>第二部 完成！</h1>
    <p>第三部「黑暗四天王」還在製作中，敬請期待（這次的隊伍已經存成第二部通關紀錄）</p>
    <div class="endTeam">${RUN.team.map(m => spPic(m.sp, 's80')).join('')}</div>
    <p>擊敗 ${RUN.stats.wins} 隻敵人　｜　隊伍 ${RUN.team.length} 隻　｜　牌組 ${RUN.deck.length} 張</p>
    <button class="btn primary big" id="p2Back">回到標題</button></div>`;
  o.classList.remove('hidden');
  await new Promise(r => o.querySelector('#p2Back').onclick = r);
  o.classList.add('hidden');
  showTitle();
}
