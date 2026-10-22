'use strict';
/* =========================================================
   第三部「黑暗四天王篇」
   - 通關第二部後解鎖，從第二部通關紀錄接續（隊伍、牌組帶過去，道具挑 3 個）
   - 徽章已經完全覺醒：起始刻度 12 格，回復泉「徽章充能」+2、商店「徽章碎片」+1
   - 🌟 試煉：8 個孩子的夥伴學會第二究極技（每章頭目前一層保底）
   - 第七章：鋼鐵海龍獸＋木偶獸 雙頭目（🌊 漲潮、🎭 操線）
   ========================================================= */
const P3 = () => P2() && RUN.part === 3;
const part3Unlocked = () => (META.p2clear || 0) > 0;
const P3_TICKS = 12;
const CREST_SHARD = 300;   // 徽章碎片的價格（不受商店倍率影響）

// ---------- 第二究極技 ----------
// 通用效果＋對某個頭目的額外效果；學會之後，進化成究極體時多拿 1 張
const ULT2 = {
  agumon:   { name: '恐龍剋星',   power: 44, hits: 1, desc: '對龍類（鋼鐵海龍獸、機械邪龍獸…）傷害 ×2', fx: () => {} },
  gabumon:  { name: '加魯魯戰斧', power: 36, hits: 1, desc: '敵人麻痺 2 回合；剪斷手牌所有的 🎭 操線', fx: () => { addStatus(B.e, 'para', 2); cutStrings(); } },
  piyomon:  { name: '深紅火焰',   power: 36, hits: 1, desc: '全隊回復最大 HP 15%', fx: () => B.fighters.forEach(f => { if (f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + healAmt(f.maxhp * .15)); }) },
  patamon:  { name: '七星之擊',   power: 7,  hits: 7, desc: '7 段傷害；救回 1 隻被變成鑰匙圈的夥伴', fx: () => { if (B.fighters.some(f => f.keychain)) keyFree('七星之擊打破了魔術'); } },
  gomamon:  { name: '雷帝之槌',   power: 36, hits: 1, desc: '獲得護盾；🌊 水位 -2', fx: () => { gainBlock(B.p, blockVal(12, .15)); if (B.water) { B.water = Math.max(0, B.water - 2); log('🔨 雷帝之槌敲退了潮水！'); } } },
  palmon:   { name: '荊棘之鞭',   power: 36, hits: 1, desc: '解除敵人的強化和護盾；剪斷手牌所有的 🎭 操線', fx: () => { ['atkUp', 'haste', 'ward'].forEach(k => delete B.e.st[k]); B.e.block = 0; cutStrings(); } },
  tentomon: { name: '大力神衝擊', power: 38, hits: 1, desc: '敵人行動條 -50%；直接打斷無限大砲的集氣', fx: () => { pushGauge(B.e, -50); if (B.e.intent === 'infinitycannon' && !B.cannonBroken) { B.cannonBroken = true; floatText(B.e, '🛑 大砲打斷！', 'super', 40); log('🛑 大力神衝擊直接打斷了無限大砲！'); } } },
  plotmon:  { name: '神聖之光',   power: 36, hits: 1, desc: '淨化手牌上所有的負面標記', fx: () => { B.hand.forEach(clearMarks); floatText(B.p, '✨ 淨化', 'heal'); } },
};
const learned2 = sp => (RUN.learned2 || []).includes(sp);
function ult2Def(spKey) {
  const u = ULT2[spKey] || ULT2.agumon, per = Math.round(u.power * (has('ultboost') ? 1.25 : 1));
  return { name: u.name, cost: 2, type: 'ult',
    desc: () => `造成 ${dmgTxt(per, u.hits)} 傷害<br>${u.desc}`,
    fx: () => { const dragon = spKey === 'agumon' && B.e.sp && B.e.sp.dragon; if (dragon) { CHARGE *= 2; floatText(B.e, '🐉 恐龍剋星！', 'super', 40); }
      hit(per, u.hits); u.fx(); } };
}
function cutStrings() {
  let n = 0; B.hand.forEach(c => { if (c.str) { delete c.str; n++; } });
  if (B.pend) delete B.pend.str;
  if (n) { floatText(B.p, `✂️ 剪斷 ${n} 條操線`, 'info'); log(`✂️ 剪斷了 ${n} 條操線！`); }
}

// ---------- 第三部開場 ----------
async function startPart3() {
  if (store.get(RUN_KEY) && !confirm('開始第三部會放棄目前的冒險進度，確定嗎？')) return;
  const recs = META.records2 || [];
  if (!recs.length) { toast('還沒有第二部的通關紀錄'); return; }
  const rec = await pickScreen({ title: '🌋 第三部・黑暗四天王篇', sub: '選一筆第二部的通關紀錄接續：隊伍、等級、牌組都會帶過去；數碼幣、背包、勇氣值重新開始',
    items: recs, skip: '返回', render: r => recordEl(r) });
  if (!rec) return;
  chosenKid = rec.kid;
  RUN = { kid: rec.kid, team: rec.team.map(m => Object.assign(newMember(m.sp, m.level), { exp: m.exp || 0 })), items: ['potion', 'potion'], deck: [...rec.deck],
          courage: 10, bits: 80, relics: [], flags: {}, rules: 'p2', part: 3, chapter: 7, route: null, pos: null, visited: [], usedEvents: [], seen: [],
          stats: { wins: 0, chapters: 0 }, crest: true, awaken: true, crestTicks: P3_TICKS, learned2: [] };
  RUN.team.forEach(m => m.hp = memberStats(m).maxhp);
  const pool = [...(rec.relics || [])];
  if (pool.length <= 3) RUN.relics = pool;
  else for (let i = 0; i < 3 && pool.length; i++) {
    const k = await pickScreen({ title: `🎒 選要帶去第三部的道具（${i + 1}/3）`, sub: '最多帶 3 個', items: pool, skip: '不帶了', render: k => relicEl(k) });
    if (!k) break; RUN.relics.push(k); pool.splice(pool.indexOf(k), 1);
  }
  startChapter(7);
  META.runs++; saveMeta();
  G.mode = 'story'; showScreen('');
  await cutscene([
    { bg: 'tokyo', music: 'route', amb: 'wind', chars: [['partner', 30, 78, 32, 'in-l']], lines: [[null, '天空的裂縫越來越大——數碼世界正在被扭曲。'], ['me', '我們回去吧。這次要把黑暗徹底打倒！']] },
    { bg: 'void', music: null, amb: 'drone', chars: [['Piemon', 50, 78, 56, 'dark']], lines: [['shadow', '歡迎回來，被選召的孩子們。'], ['shadow', '這座螺旋山上的四位主人，會好好招待你們的……']] },
    { bg: 'sea', music: 'route', amb: 'waves', chars: [['partner', 30, 78, 30, 'in-l']], lines: [[null, '螺旋山的山腳——一邊是翻騰的大海，一邊是陰森的森林。'],
      [null, `🔰 徽章已經完全覺醒：可以究極進化（刻度 ${P3_TICKS} 格，回復泉和商店可以補充）。<br>🌟 路上的<b>試煉</b>可以讓孩子們的夥伴學會<b>第二究極技</b>。`]] },
  ]);
  saveRun();
  await chapterCard(CHAPTERS[7].title, '同時打倒鋼鐵海龍獸和木偶獸！');
  showRoute();
}

// ---------- 地圖：海與森林 ----------
function spiralMap(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = '.';
  const blob = (ch, n, x0, x1, rmin, rmax) => { for (let k = 0; k < n; k++) { const cx = randInt(x0, x1), cy = randInt(2, ROWS - 3), r = rand(rmin, rmax);
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r + rand(-1, 1)) T[y][x] = ch; } };
  blob(',', randInt(3, 5), 2, 11, 1.2, 2.6); blob('T', randInt(8, 11), 2, 11, .8, 1.8);   // 左邊：森林
  blob('~', randInt(3, 4), 13, 21, 1.4, 2.6); blob('R', randInt(2, 3), 13, 21, .6, 1.2);   // 右邊：海岸
}

// ---------- 路線、地圖物件 ----------
NODE_INFO.trial = { icon: '🌟', name: '試煉' };
const trialCands = () => RUN.team.filter(m => ULT2[m.sp] && !learned2(m.sp));
function p3Objs(nd, place, free) {
  if (!P3() || nd.type === 'boss') return;
  const ch = CHAPTERS[RUN.chapter];
  const guarantee = nd.f >= ch.floors - 2 && !F()['l2_' + RUN.chapter] && trialCands().length;   // 頭目前一層：這章還沒學會就保底一次
  if (nd.type === 'trial' || guarantee) place({ kind: 'trial', opt: true, sure: !!guarantee }, free(5));
}
async function trialEvent(o) {
  const cands = trialCands();
  if (!cands.length) {   // 隊伍裡都學會了：一般的強化試煉
    const c = await ask(null, '🌟 試煉之地。這裡的試煉可以讓夥伴變得更強。', [{ text: '接受試煉', note: '和精英戰鬥，贏了強化 1 張卡＋全隊經驗' }, { text: '先不要', note: '' }]);
    if (c !== 0) return false;
    const res = await eventBattle(pick(CHAPTERS[RUN.chapter].elites), curLv(), { elite: true });
    if (res !== 'win') return true;
    const ups = RUN.deck.map((id, i) => ({ id, i })).filter(x => canUpgrade(x.id));
    if (ups.length) { const x = pick(ups); RUN.deck[x.i] = x.id + '+'; }
    teamExp(.3); await say(null, `🌟 試煉通過！${ups.length ? '牌組裡的 1 張卡強化了，' : ''}全隊獲得了經驗值。`);
    return true;
  }
  const m = cands.find(x => x === RUN.team[0]) || pick(cands), sp = SPECIES[m.sp], u = ULT2[m.sp], ult = sp.evo[2];
  loadImg(ult.img);
  await cutscene([{ bg: RUN.chapter === 7 ? 'sea' : 'void', music: 'route', amb: null, sting: true, chars: [[ult.img, 50, 78, 46, 'in-l']], fx: '<div class="cutRays" style="--rx:50%;--ry:35%"></div>',
    lines: [[null, `🌟 試煉之地。${sp.name}的身體發出了光芒……`], [{ img: ult.img, name: ult.name }, `我感覺得到……還有一股沉睡的力量！`],
      [null, `通過試煉，<b>${ult.name}</b>就能學會第二究極技「<b>${u.name}</b>」：${u.desc}`]] }]);
  const c = await ask(null, `接受${sp.name}的試煉嗎？${o.sure ? '<br><small>（頭目前的最後機會）</small>' : ''}`, [{ text: '接受試煉', note: '和精英戰鬥，贏了就學會' }, { text: '先不要', note: '這個試煉會消失' }]);
  if (c !== 0) return true;
  const res = await eventBattle(pick(CHAPTERS[RUN.chapter].elites), curLv(), { elite: true });
  if (res !== 'win') return true;
  RUN.learned2 = [...(RUN.learned2 || []), m.sp]; F()['l2_' + RUN.chapter] = true;
  sfx('levelup');
  await say(null, `🌟 試煉通過！<b>${ult.name}</b>學會了第二究極技「<b>${u.name}</b>」！<br><small>進化成究極體時會多拿 1 張「${u.name}」</small>`);
  return true;
}

// ---------- 第七章：雙頭目（鋼鐵海龍獸＋木偶獸） ----------
const DUO = { hp: .6, atk: .68 };   // 每隻的血量、攻擊（單頭目的比例）；一隻倒下後另一隻攻擊回到 100%
DOMAINS.duo = { name: '螺旋山的雙王', icon: '🌊', desc: '鋼鐵海龍獸和木偶獸同時出現；🌊 漲潮：手牌上限變少，打出防禦／回復卡退潮；🎭 操線：被操控的卡要多花 1 能量剪斷；一隻倒下另一隻會暴怒' };
BOSS_INFO.duo = [['👑 雙頭目', '鋼鐵海龍獸和木偶獸<b>同時</b>出現，各有血量和行動條，<b>兩隻都打倒才算贏</b>。點敵人資訊框下面的按鈕切換攻擊目標。'],
  ['💢 暴怒', '先打倒其中一隻，另一隻會<b>暴怒</b>（攻擊、速度上升）。想清楚先打誰！'],
  ['🌊 漲潮（鋼鐵海龍獸）', '牠每行動 2 次，水位上升 1 格（最多 2 格），你每回合的手牌上限少 1 張。打出<b>防禦／回復類</b>的卡，水位降 1 格。'],
  ['🎭 操線（木偶獸）', '牠每次行動，你下一手牌有 1 張被標上 🎭。這張卡要<b>多花 1 能量</b>剪斷操線才能打出；能量不夠還是可以打，但會<b>被操控打到自己</b>（沒有效果，受到最大 HP 8% 傷害）。']];
function setupDuo(lv, opt) {
  const a = B.e, b = makeEnemy(CHAPTERS[RUN.chapter].boss.partner, lv, opt);
  [[a, 'sea', '🌊'], [b, 'forest', '🎭']].forEach(([e, key, icon]) => {
    e.maxhp = e.hp = Math.round(e.maxhp * DUO.hp); e.atk = Math.round(e.atk * DUO.atk);
    Object.assign(e, { key, partIcon: icon, el: a.el, boss: true });
  });
  b.gauge = (a.gauge + 50) % 100;   // 行動條錯開一半
  B.parts = { sea: a, forest: b }; B.partsAll = true; B.water = 0; B.tideN = 0;
  chooseIntent(b);
  if (!RUN.seen.includes(b.id)) RUN.seen.push(b.id);
  loadImg(b.img);
}
// 一隻倒下：另一隻暴怒；鋼鐵海龍獸倒下潮水退去
function duoBroken(p) {
  if (p.key === 'sea' && B.water) { B.water = 0; log('🌊 鋼鐵海龍獸倒下，潮水退去了'); }
  if (p.key === 'forest') { B.hand.forEach(c => delete c.str); if (B.pend) delete B.pend.str; }
  for (const s of livingParts()) {
    if (s.enraged) continue;
    s.enraged = true; s.atk = Math.round(s.atk / DUO.atk); s.spd = +(s.spd * 1.1).toFixed(1);
    banner(`${s.name} 暴怒了！`); floatText(s, '💢 暴怒！', 'super'); sfx('wrongevo');
    log(`💢 ${s.name} 看到夥伴倒下，暴怒了！（攻擊、速度上升）`);
  }
}
// 敵人行動後：漲潮、操線
function duoAfterAct(e) {
  if (!B.parts || !B.partsAll) return;
  if (e.key === 'sea' && ++B.tideN % 2 === 0 && B.water < 2) { B.water++; floatText(B.p, `🌊 漲潮！水位 ${B.water}`, 'dot', 50); log(`🌊 漲潮了！水位 ${B.water}（手牌上限 -${B.water}）`); }
  if (e.key === 'forest') { (B.pend = B.pend || {}).str = 1; floatText(e, '🎭 操線', 'info', 60); log(`🎭 ${e.name} 伸出了操線！你的下一手牌有 1 張會被操控`); }
}
// 打出防禦／回復卡：退潮
function tideCard(c) {
  if (!B.water || CARD_CAT[baseId(c.id)] !== 'def') return;
  B.water--; floatText(B.p, `🛡️ 築堤！水位 ${B.water}`, 'heal', 50); log(`🛡️ 築起堤防，水位降到 ${B.water}`);
}
// 🎭 被操控：能量不夠剪斷，硬打出去會打到自己
function puppetPlay(i, c, d) {
  const cost = cardCost(c, d);
  B.energy -= Math.max(0, cost - 1);
  B.hand.splice(i, 1); clearMarks(c); B.discard.push(c);
  const dd = Math.max(1, Math.round(B.p.maxhp * .08)); B.p.hp = Math.max(0, B.p.hp - dd);
  floatText(B.p, `-${dd} 🎭 被操控！`, 'dot', 30); shake(B.p); sfx('hit');
  log(`🎭 「${d.name}」被操線拉住，打到了自己！（受到 ${dd} 傷害，卡片沒有效果）`);
  if (checkEnd()) return;
  renderBattle();
}

// ---------- 第九章結束（最終章製作中） ----------
async function part3ChapterDone() {
  G.mode = 'busy';
  await cutscene([
    { bg: 'stage', music: 'route', amb: null, chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '小丑皇被打倒了……！鑰匙圈全部變回來了！'], [null, '螺旋山開始崩塌。四天王都倒下了——但黑暗還沒有消失。']] },
    { bg: 'void', music: null, amb: 'drone', chars: [], fx: '<div class="cutTitle"><b>最終章</b><strong>？？？</strong><small>製作中・敬請期待</small></div>',
      lines: [['shadow', '……為什麼……只有我們……被刪除……'], ['shadow', '我要把這個世界……也一起……']] },
  ]);
  META.p3ch = Math.max(META.p3ch || 0, RUN.chapter); META.clears++;
  recordDex(); saveMeta(); clearRun();
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><div style="font-size:70px">🃏</div><h1>第九章 完成！</h1>
    <p>最終章還在製作中，敬請期待</p>
    <div class="endTeam">${RUN.team.map(m => spPic(m.sp, 's80')).join('')}</div>
    <p>擊敗 ${RUN.stats.wins} 隻敵人　｜　學會第二究極技 ${(RUN.learned2 || []).length} 招</p>
    <button class="btn primary big" id="p3Back">回到標題</button></div>`;
  o.classList.remove('hidden');
  await new Promise(r => o.querySelector('#p3Back').onclick = r);
  o.classList.add('hidden');
  showTitle();
}

// =========================================================
//   第八章：機械邪龍獸（無限大砲）＋ 工廠地圖（輸送帶）
// =========================================================
let CANNON_PCT = .08;     // 集氣時要打出最大 HP 的這個比例才能打斷
let CANNON_POWER = 40;    // 沒打斷：無限大砲的威力
const CANNON_EVERY = 4;   // 每 4 次行動集氣一次
DOMAINS.mugen = { name: '無限大砲', icon: '💥', desc: '每 4 次行動集氣一次「無限大砲」（會先預告），在牠發射前打出最大 HP 8% 的傷害就能打斷；沒打斷會受到超大傷害' };
BOSS_INFO.mugen = [['💥 無限大砲', '機械邪龍獸每 4 次行動會開始<b>集氣</b>，下一次行動發射「無限大砲」（無視護盾的超大傷害）。'],
  ['🛑 打斷', `集氣出現後，在牠發射前打出牠<b>最大 HP ${Math.round(CANNON_PCT * 100)}%</b> 以上的傷害（燒傷、援護、反擊也算）就能打斷。敵人頭上會顯示還差多少。`],
  ['💡 小技巧', '集氣時可以先用防禦卡擋一下，或換一隻血多的夥伴上場；甲蟲獸的第二究極技「大力神衝擊」可以直接打斷。']];
// 集氣：在敵人行動結束時決定下一招
function cannonPrep(e) {
  if (B.dom !== 'mugen') return false;
  e.cn = (e.cn || 0) + 1;
  if (e.cn % CANNON_EVERY !== 0) return false;
  e.intent = 'infinitycannon'; B.cannonBroken = false; B.cannonHp = e.hp; B.cannonNeed = Math.round(e.maxhp * CANNON_PCT);
  floatText(e, '💥 集氣中！', 'super', 40); log(`💥 ${e.name} 開始為「無限大砲」集氣！在牠發射前打出 ${B.cannonNeed} 以上的傷害就能打斷！`);
  return true;
}
// 打出卡片之後：傷害夠了就打斷
function cannonCheck() {
  const e = B.e;
  if (B.dom !== 'mugen' || e.intent !== 'infinitycannon' || B.cannonBroken || e.hp <= 0) return;
  if (B.cannonHp - e.hp >= B.cannonNeed) { B.cannonBroken = true; floatText(e, '🛑 大砲打斷！', 'super', 40); log('🛑 打斷了無限大砲的集氣！'); sfx('crit'); }
}
// 發射
function cannonFire(e, p) {
  if (!B.cannonBroken && B.cannonHp - e.hp >= B.cannonNeed) B.cannonBroken = true;
  if (B.cannonBroken) { floatText(e, '💨 大砲故障…', 'info'); log('💨 無限大砲被打斷，只射出一發普通的砲彈！'); applyHit(e, p, 12); return; }
  log('💥💥 無限大砲發射！'); applyHit(e, p, CANNON_POWER, { pierce: true });
}
const cannonText = () => B.cannonBroken ? '💥 （大砲已經打斷）' : `💥 無限大砲集氣中（再打 ${Math.max(0, B.cannonNeed - (B.cannonHp - B.e.hp))} 傷害打斷！）`;

// ---------- 工廠地圖 ----------
function factoryMap(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = '.';
  // 機器：長方形的區塊
  for (let k = 0; k < randInt(7, 10); k++) {
    const w = randInt(2, 3), h = randInt(1, 2), x0 = randInt(3, COLS - 5), y0 = randInt(1, ROWS - 3);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (y < ROWS - 1 && x < COLS - 1) T[y][x] = 'T';
  }
  // 輸送帶：往右送（往出口的方向），中間留缺口
  for (let k = 0; k < randInt(2, 3); k++) {
    const y = randInt(2, ROWS - 3), x0 = randInt(3, 8), len = randInt(6, 11);
    for (let x = x0; x < Math.min(COLS - 3, x0 + len); x++) T[y][x] = '>';
  }
}
// 走到輸送帶上：被往右送一格（一路送到輸送帶盡頭或被擋住）
function conveyor(A) {
  if (A.T[A.y][A.x] !== '>') return;
  const nx = A.x + 1, ny = A.y;
  if (SOLID.has(A.T[ny][nx]) || objAt(nx, ny) || (nx === A.exit.x && ny === A.exit.y)) return;
  A.path = null;
  Object.assign(A.mv, { fromX: A.x, fromY: A.y, toX: nx, toY: ny, t: 0, moving: true, len: .8 });
}
function drawBelt(g, px, py, t) {
  g.fillStyle = '#2b3140'; g.fillRect(px, py + 4, TS, TS - 8);
  g.fillStyle = '#4b5563'; g.fillRect(px, py + 4, TS, 2); g.fillRect(px, py + TS - 6, TS, 2);
  g.strokeStyle = '#facc15'; g.lineWidth = 2; const off = (t * 24) % 12;
  for (let k = -1; k < 3; k++) { const x = px + k * 12 + off; g.beginPath(); g.moveTo(x, py + 10); g.lineTo(x + 5, py + 16); g.lineTo(x, py + 22); g.stroke(); }
}

// =========================================================
//   第九章：小丑皇（鑰匙圈）＋ 遊樂園地圖（撲克牌迷宮）
// =========================================================
let KEY_PCT = .1;      // 對小丑皇打出最大 HP 的這個比例，救回 1 隻鑰匙圈
const KEY_EVERY = 3;   // 每 3 次行動施放一次鑰匙圈
DOMAINS.clown = { name: '小丑皇的魔術', icon: '🃏', desc: '每 3 次行動把 1 隻後排夥伴變成鑰匙圈（這場戰鬥不能上場）；對小丑皇打出最大 HP 10% 的傷害就救回 1 隻' };
BOSS_INFO.clown = [['🃏 鑰匙圈', '小丑皇每 3 次行動會施放一次魔術（前一次行動就會預告），把 1 隻<b>後排</b>的夥伴變成鑰匙圈，這場戰鬥不能上場。'],
  ['🔑 救回來', `每對小丑皇打出牠<b>最大 HP ${Math.round(KEY_PCT * 100)}%</b> 的傷害，就救回 1 隻變成鑰匙圈的夥伴（先變的先救）。熾天使獸的「七星之擊」可以直接救回 1 隻。`],
  ['💡 小技巧', '後排沒有夥伴可以變的時候，小丑皇會改成直接攻擊。出戰夥伴倒下、又只剩鑰匙圈的話，鑰匙圈的夥伴會掙脫出來上場。']];
const keychains = () => B.fighters.filter(f => f.keychain);
// 敵人行動結束：每 3 次預告一次鑰匙圈
function keyPrep(e) {
  if (B.dom !== 'clown') return false;
  e.kn = (e.kn || 0) + 1;
  if (e.kn % KEY_EVERY !== KEY_EVERY - 1) return false;
  e.intent = 'keychain'; log(`🃏 ${e.name} 拿出了一把鑰匙……下一次行動會把後排的夥伴變成鑰匙圈！`);
  return true;
}
function keyCast(e, p) {
  const cands = B.fighters.filter(f => f !== p && f.hp > 0 && !f.keychain);
  if (!cands.length) { log(`🃏 後排沒有夥伴可以變，${e.name} 改用撲克劍直接攻擊！`); applyHit(e, p, 18); return; }
  applyHit(e, p, 8);   // v16.4：施放魔術的同時用撲克劍攻擊
  const f = pick(cands); f.keychain = true; B.keyDmg = 0;
  floatText(p, `🃏 ${f.name} 變成鑰匙圈了！`, 'super', 50); sfx('wrongevo');
  log(`🃏 小丑皇的魔術！${f.name} 被變成了鑰匙圈（打出 ${Math.round(e.maxhp * KEY_PCT)} 傷害救回來）`);
}
// 打中小丑皇：累積傷害，夠了就救回 1 隻
function keyDamage(tgt, d) {
  if (B.dom !== 'clown' || tgt !== B.e || d <= 0 || !keychains().length) return;
  B.keyDmg = (B.keyDmg || 0) + d;
  const need = Math.round(B.e.maxhp * KEY_PCT);
  if (B.keyDmg >= need) { B.keyDmg -= need; keyFree(); }
}
function keyFree(how) {
  const f = keychains()[0]; if (!f) return;
  delete f.keychain; sfx('heal'); floatText(B.p, `🔑 救回了 ${f.name}！`, 'heal', 50);
  log(`🔑 ${how || '魔術被打破了'}！${f.name} 從鑰匙圈變回來了！`);
}
const keyText = () => '🃏 鑰匙圈魔術（後排夥伴會被變成鑰匙圈）';

// ---------- 遊樂園地圖：撲克牌牆、旋轉木馬 ----------
function parkMap(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = '.';
  for (let k = 0; k < randInt(9, 12); k++) {   // 撲克牌牆：一段一段的直線
    const h = Math.random() < .5, len = randInt(3, 5), x0 = randInt(3, COLS - 5), y0 = randInt(1, ROWS - 3);
    for (let i = 0; i < len; i++) { const x = h ? x0 + i : x0, y = h ? y0 : y0 + i; if (x < COLS - 2 && y < ROWS - 1) T[y][x] = 'T'; }
  }
  const cx = randInt(8, 15), cy = randInt(4, ROWS - 5);   // 旋轉木馬
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) T[y][x] = 'R';
}
function drawPark(g, x, y, c, px, py, h, t) {
  if (c === 'T') {   // 撲克牌
    g.fillStyle = '#f8fafc'; g.fillRect(px + 3, py + 2, TS - 6, TS - 4);
    g.strokeStyle = '#334155'; g.lineWidth = 1; g.strokeRect(px + 3.5, py + 2.5, TS - 7, TS - 5);
    g.font = `16px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = h % 2 ? '#dc2626' : '#111827';
    g.fillText(['♠', '♥', '♣', '♦'][h % 4], px + 16, py + 17);
  } else {   // 旋轉木馬
    g.fillStyle = ['#f472b6', '#facc15', '#60a5fa'][h % 3]; g.fillRect(px, py, TS, TS);
    g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(px + i * 8, py, 4, TS);
  }
}
