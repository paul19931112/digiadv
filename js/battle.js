'use strict';
/* =========================================================
   戰鬥：ATB 行動條 + 卡牌（沿用原本的玩法）
   runBattle(...) 回傳 Promise：'win' / 'flee'（全滅會直接結束這一局）
   ========================================================= */
let B = null;
// 頭目／精英的領域效果說明：開場顯示幾秒後自動收起（不然會擋住敵人），點敵人面板上的小標籤可以再叫出來
let domainT = null;
function showDomain(ms = 6000) { $('#domainBar').classList.remove('hidden'); clearTimeout(domainT); domainT = setTimeout(hideDomain, ms); }
function hideDomain() { clearTimeout(domainT); $('#domainBar').classList.add('hidden'); }
$('#domBadge').addEventListener('click', e => { e.stopPropagation(); sfx('click'); if (B && B.opt.boss && BOSS_INFO[B.dom]) { showBossInfo(); return; } $('#domainBar').classList.contains('hidden') ? showDomain() : hideDomain(); });
$('#domainBar').addEventListener('click', hideDomain);

// 被汙染的卡：效果減半（數值、回合數都減半，小數進位）。只在出牌結算的瞬間為 true
let HALF = false;
const hv = n => HALF ? Math.ceil(n / 2) : n;

// 戰鬥中的說明視窗（頭目能力、惡魔獸第二階段）：打開時戰鬥暫停，手動按關閉
const noticeOpen = () => !$('#bNotice').classList.contains('hidden');
function battleNotice(title, rows, foot = '') {
  const n = $('#bNotice');
  n.innerHTML = `<div class="nBox"><h3>${title}</h3>${rows.map(([h, t]) => `<div class="nRow"><b>${h}</b><div>${t}</div></div>`).join('')}` +
    `${foot ? `<div class="nFoot">${foot}</div>` : ''}<button class="btn primary" id="bNoticeOk">我知道了</button></div>`;
  n.classList.remove('hidden');
  sfx('open');
  if (B) B.hold = true;
  return new Promise(res => { n.querySelector('#bNoticeOk').onclick = () => closeNotice(res); n._res = res; });
}
function closeNotice(res) {
  const n = $('#bNotice'); if (n.classList.contains('hidden')) return;
  n.classList.add('hidden'); sfx('close');
  if (B) B.hold = false;
  (res || n._res || (() => {}))();
}
function showBossInfo() {
  if (!B || !BOSS_INFO[B.dom]) return;
  battleNotice(`😈 頭目 ${B.e.name} 的能力`, BOSS_INFO[B.dom], '💡 商店的「✨ 淨化」卡可以清除手牌和夥伴身上的負面效果。之後點敵人面板右下角的標籤可以再看一次。');
}

function gainCourage(n, show) {
  n = hv(n);
  const before = Math.floor(RUN.courage);
  if (n > 0) n *= K().courage * (B && B.dom === 'fog' ? .5 : 1);
  RUN.courage = Math.min(COURAGE_MAX, RUN.courage + n);
  if (show && B && Math.floor(RUN.courage) > before) sfx('courage');
  if (show && B && Math.floor(RUN.courage) > before) floatText(B.p, `🔥+${Math.floor(RUN.courage) - before}`, 'courage', -40);
  updateCourageUI();
}
function coolDownCourage() {   // 40 以下完全保留，超過的部分減半
  const c = RUN.courage;
  RUN.courage = Math.floor(c <= COURAGE_SAFE ? c : COURAGE_SAFE + (c - COURAGE_SAFE) / 2);
  updateCourageUI();
}
function updateCourageUI() {
  const v = Math.floor(RUN.courage), pct = v / COURAGE_MAX * 100 + '%';
  document.querySelectorAll('.courageVal').forEach(e => e.textContent = `${v} / ${COURAGE_MAX}`);
  document.querySelectorAll('.courageBar>i').forEach(e => e.style.width = pct);
}

// ---------- 核心計算 ----------
function atkMult(f) {
  let m = f.st.atkUp ? 1.3 : 1;
  if (f.isPlayer && K().teamAtk) { const n = RUN.team.length; m *= n < 3 ? .85 : 1 + Math.min(.05, Math.max(0, n - 3) * .02); }
  if (f.isPlayer) { m *= K().atk; if (has('darkgear')) m *= 1.25; if (has('darkpower')) m *= 1.2; }
  return m;
}
function calcRaw(att, tgt, power) { return power * att.atk * atkMult(att) / (tgt.def + 10) * 1.6 * attrMult(att.attr, tgt.attr); }
function applyHit(att, tgt, power, opts = {}) {
  if (tgt.st.ward) {   // 光之守護：這一下完全無效
    delete tgt.st.ward;
    lunge(att); floatText(tgt, '✨ 守護！', 'heal'); sfx('block');
    return 0;
  }
  let d = calcRaw(att, tgt, power) * rand(.9, 1.1);
  if (tgt.st.expose) d *= 1.3;
  if (tgt.isPlayer) d *= K().taken;
  if (tgt.isPlayer && B.dom === 'jam' && tgt.tier > 0) d *= 1.4;   // 機械人獸：鎖定分析
  if (att.isPlayer && K().lowHpPenalty && tgt.hp < tgt.maxhp * .2) d *= .9;
  if (!tgt.isPlayer && B.dom === 'armor') d *= .85;
  const crit = Math.random() < .08;
  if (crit) d *= 1.5;
  d = Math.max(1, Math.round(d));
  let blocked = 0;
  if (!opts.pierce && tgt.block > 0) { blocked = Math.min(tgt.block, d); tgt.block -= blocked; d -= blocked; }
  tgt.hp = Math.max(0, tgt.hp - d);
  if (tgt === B.e && (B.opt.tutorial === 3 || (B.opt.tutorial === 2 && !B.p.tier))) tgt.hp = Math.max(1, tgt.hp);   // 教學：要照步驟學會進化、勸降
  if (tgt === B.e) checkPhase2();
  lunge(att);
  floatText(tgt, d > 0 ? `-${d}` : '🛡 擋下', crit ? 'crit' : 'dmg');
  sfx(d === 0 ? 'block' : crit ? 'crit' : 'hit');
  if (crit) floatText(tgt, '會心一擊！', 'super', 26);
  if (attrMult(att.attr, tgt.attr) > 1) floatText(tgt, '效果拔群！', 'super', 52);
  shake(tgt);
  if (tgt === B.p) gainCourage((d + blocked) / 8);
  return d;
}
function hit(power, hits = 1, opts = {}) {
  let total = 0;
  if (HALF) power /= 2;
  for (let i = 0; i < hits; i++) { if (B.e.hp <= 0) break; total += applyHit(B.p, B.e, power, opts); }
  return total;
}
function gainBlock(f, n) { n = hv(n); sfx('block'); f.block += n; floatText(f, `+${n} 🛡`, 'info'); }
function healF(f, n, raw) { if (!raw) n = hv(n); if (f.isPlayer) n = healAmt(n); const b = f.hp; f.hp = Math.min(f.maxhp, f.hp + n); const d = f.hp - b; if (d > 0) { floatText(f, `+${d}`, 'heal'); sfx('heal'); } }
function pushGauge(f, n) { if (HALF) n /= 2; f.gauge = clamp(f.gauge + n, 0, 99); floatText(f, n < 0 ? '行動延遲！' : '行動加快！', 'info', 60); }
function addStatus(f, k, n) { n = hv(n); f.st[k] = Math.max(f.st[k] || 0, n); log(`${f.name} ${STATUS[k].icon}${STATUS[k].name}了！`); }
function chanceStatus(f, k, n, c) { if (Math.random() < c) addStatus(f, k, n); }
function tickStatus(f) {
  for (const k of ['burn', 'poison']) {
    if (f.st[k]) {
      const d = Math.max(2, Math.round(f.maxhp * .06 * (f.boss || f.elite ? .5 : 1)));
      f.hp = Math.max(f === B.e && (B.opt.tutorial === 3 || (B.opt.tutorial === 2 && !B.p.tier)) ? 1 : 0, f.hp - d);
      floatText(f, `-${d} ${STATUS[k].icon}`, 'dot');
      log(`${f.name} 受到${STATUS[k].name}傷害 ${d}`);
    }
  }
  for (const k in f.st) { f.st[k]--; if (f.st[k] <= 0) delete f.st[k]; }
  if (B && f === B.e) checkPhase2();
}
function gaugeRate(f) { return f.spd * ATB_K * (f.st.haste ? 1.5 : 1) * (f.st.para ? 0.5 : 1); }
function drawCards(n) {
  n = hv(n);
  for (let i = 0; i < n; i++) {
    if (B.hand.length >= 8) break;
    if (!B.draw.length) { if (!B.discard.length) break; B.draw = shuffle(B.discard); B.discard = []; }
    const c = B.draw.pop(); c.pin = false; clearMarks(c);
    B.hand.push(c);
  }
}
// 📌 釘住的牌回合結束時會留在手上（最多 PIN_MAX 張，究極技卡本來就會保留、不算在內）
function togglePin(i) {
  if (!B || B.phase !== 'player' || B.anim) return;
  const c = B.hand[i]; if (!c || c.temp) return;
  const max = PIN_MAX + (B.pinBonus || 0);
  if (!c.pin && B.hand.filter(x => x.pin).length >= max) { floatText(B.p, `最多保留 ${max} 張`, 'info'); sfx('error'); return; }
  c.pin = !c.pin; sfx('click');
  renderBattle();
}
// ---------- 手牌上的標記：🔥 燃燒、🌫️ 霧化、☠️ 汙染、🔍 看破（卡片離開手牌就消失） ----------
function clearMarks(c) { delete c.burn; delete c.fog; delete c.pol; delete c.seen; }
const baseId = id => id.replace('+', '');
const cardCost = (c, d = cardDef(c.id)) => d.cost + (c.seen ? 1 : 0);
const isHalf = (c, d = cardDef(c.id)) => !d.noHalf && !!(c.pol || (B.spread && B.spread[baseId(c.id)] >= B.turnNo));
// 頭目行動時先預告，等玩家下一回合抽完牌才套用到手牌上（不然只會打到保留的牌）
function bossHandAct(e) {
  if (!B.opt.boss) return;
  const low = e.hp <= e.maxhp / 2, P = B.pend = B.pend || {};
  if (B.dom === 'heat') {
    P.burn = low ? 2 : 1;
    floatText(e, '🔥 點燃手牌', 'info', 60); log(`🔥 ${e.name} 點燃了你的下一手牌（${P.burn} 張）！`);
  } else if (B.dom === 'jam') {
    P.seen = 1;
    if ((e.gears || 0) < (low ? 2 : 1)) { e.gears = (e.gears || 0) + 1; floatText(e, '⚙️ 召喚小齒輪', 'info', 60); log(`⚙️ ${e.name} 召喚了小齒輪！（會擋下一張攻擊卡）`); }
    else log(`🔍 ${e.name} 看破了你的下一手牌！`);
  } else if (B.dom === 'fog') {
    P.fog = 1;
    if (!e.plant) { e.plant = 2; floatText(e, '🌱 種下種子', 'info', 60); log(`🌱 ${e.name} 種下了種子（2 次行動後回復 HP）`); }
    else if (--e.plant <= 0) { delete e.plant; healF(e, Math.round(e.maxhp * .05)); log(`🌳 種子長大了！${e.name} 回復了 HP`); }
  } else if (B.dom === 'dark') {
    P.pol = e.phase2 ? 2 : 1;
    floatText(e, '☠️ 汙染手牌', 'info', 60); log(`☠️ ${e.name} 汙染了你的下一手牌（${P.pol} 張）！`);
  }
}
function applyBossHand() {
  const P = B.pend; B.pend = null;
  if (!P) return;
  const pickN = (n, ok) => shuffle(B.hand.filter(ok)).slice(0, n);
  const got = [];
  if (P.burn) pickN(P.burn, c => !c.burn).forEach(c => { c.burn = true; got.push('🔥'); });
  if (P.seen) pickN(1, c => !c.seen).forEach(c => { c.seen = true; got.push('🔍'); });
  if (P.fog) pickN(1, c => !c.fog && !c.pin && !c.temp).forEach(c => { c.fog = true; got.push('🌫️'); });
  if (P.pol) pickN(P.pol, c => !c.pol && !cardDef(c.id).noTarget).forEach(c => { c.pol = true; got.push('☠️'); });
  if (got.length) floatText(B.p, got.join(' ') + ' 手牌被干擾了', 'dot', 60);
}
// ✨ 淨化（商店限定卡）
function purifyAll() {
  B.hand.forEach(clearMarks); B.spread = {};
  ['burn', 'poison', 'para', 'root'].forEach(k => delete B.p.st[k]); B.p.stay = 0;
  floatText(B.p, '✨ 淨化！', 'heal'); sfx('heal');
  log('✨ 淨化！手牌和夥伴身上的負面效果都清除了');
}
// 🧸 愛心大放送（商店限定卡）：有夥伴倒下時可以選擇復活
function loveBox(u) {
  const half = HALF, k = half ? .5 : 1, dead = B.fighters.filter(f => f.hp <= 0);
  const healMode = () => {
    B.fighters.forEach(f => { if (f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + healAmt(f.maxhp * (u ? .15 : .1) * k)); });
    HALF = half; gainBlock(B.p, blockVal(6, .4)); HALF = false;
    floatText(B.p, '💗 全隊回復', 'heal', 30); sfx('heal'); log('🧸 愛心大放送！全隊回復了');
  };
  if (!dead.length) return healMode();
  B.anim = true;
  const myB = B;
  pickScreen({ title: '🧸 愛心大放送', sub: '選一個效果', allowSkip: false, items: [...dead, null], render: f => {
    const el = document.createElement('div'); el.className = 'relic clickable';
    el.innerHTML = f ? `<div class="ri">${dpic(f.sp.img, f.emoji, 's44')}</div><div><b>復活 ${f.sp.name}</b><div class="rd">以 ${Math.round((u ? 45 : 30) * k)}% HP 重新站起來</div></div>`
                     : `<div class="ri">💗</div><div><b>全隊回復</b><div class="rd">活著的夥伴回復 ${Math.round((u ? 15 : 10) * k)}% HP，出戰夥伴獲得護盾</div></div>`;
    return el; } }).then(f => {
    if (B !== myB) return;
    if (f) { f.hp = Math.max(1, Math.round(f.maxhp * (u ? .45 : .3) * k)); sfx('heal'); log(`🧸 愛心大放送！${f.sp.name} 重新站起來了！`); }
    else healMode();
    B.anim = false; renderBattle();
  });
}
const removeTemp = () => { const keep = c => !c.temp; B.hand = B.hand.filter(keep); B.draw = B.draw.filter(keep); B.discard = B.discard.filter(keep); B.exhaust = B.exhaust.filter(keep); };

// ---------- 流程 ----------
function makeFighter(m) {
  const sp = SPECIES[m.sp], s = memberStats(m);
  return { m, sp, isPlayer: true, name: sp.name, img: sp.img, emoji: sp.emoji, attr: sp.attr, lvl: m.level, ...s, base: { ...s },
           hp: m.hp, block: 0, st: {}, gauge: rand(15, 40) + (has('boots') ? 35 : 0), spd: +(s.spd * K().spd).toFixed(1), tier: 0, evoTurns: 0, nextGauge: 0, el: $('#pPanel') };
}

function runBattle(enemyId, lv, opt = {}) {
  return new Promise(resolve => {
    const fighters = RUN.team.map(makeFighter);
    const ai = Math.max(0, fighters.findIndex(f => f.hp > 0));
    const e = makeEnemy(enemyId, lv, opt);
    e.el = $('#ePanel');
    if (opt.tutorial) e.atk = Math.max(1, Math.round(e.atk * .35));   // 教學用的敵人很弱
    if (opt.preDamage) e.hp = Math.round(e.hp * (1 - opt.preDamage));
    const dom = opt.domain || (opt.boss ? CHAPTERS[RUN.chapter].boss.domain : opt.elite ? 'armor' : null);
    B = { fighters, p: fighters[ai], e, phase: 'run', energy: 0, carry: 0, anim: false, dom, participants: new Set([ai]), opt, resolve, firstTurn: true,
          draw: shuffle(RUN.deck.map(id => ({ uid: ++uidSeq, id }))), hand: [], discard: [], exhaust: [], log: [], spread: {} };
    if (!RUN.seen.includes(enemyId)) RUN.seen.push(enemyId);
    chooseIntent(e);
    G.mode = 'battle';
    sfx('encounter');
    G.prevScreen = G.screen;
    showScreen('#battle');
    $('#result').classList.add('hidden');
    closePopups();
    $('#log').innerHTML = '';
    $('#pPanel .emo').dataset.k = ''; $('#ePanel .emo').dataset.k = '';
    log(opt.boss ? `😈 頭目 ${e.name}（Lv.${lv}）出現了！` : opt.elite ? `💀 被黑色齒輪控制的 ${e.name}（Lv.${lv}）！` : `野生的 ${e.name}（Lv.${lv}）出現了！`);
    if (opt.preDamage) log(`${e.name} 已經受了重傷！`);
    if (RUN.stats.wins === 0) log('提示：把敵人的血量壓低，再按「🤝 勸降」就有機會讓牠加入隊伍！');
    if (has('courage')) { gainCourage(10); log('🔥 勇氣徽章發光了！勇氣值 +10'); }
    const db = $('#domainBar');
    hideDomain();
    $('#domBadge').classList.toggle('hidden', !dom);
    closeNotice();
    if (dom) {
      db.innerHTML = `${DOMAINS[dom].icon} <b>${DOMAINS[dom].name}</b>：${DOMAINS[dom].desc}`;
      $('#domBadge').innerHTML = `${DOMAINS[dom].icon} ${DOMAINS[dom].name} <small>ⓘ</small>`;
      log(`⚠️ 領域效果「${DOMAINS[dom].name}」：${DOMAINS[dom].desc}`);
      if (opt.boss && BOSS_INFO[dom]) showBossInfo();   // 頭目：先跳出能力說明，玩家按關閉才開始
      else showDomain(4500);
    }
    renderBattle();
  });
}

function chooseIntent(e) {
  let pool = e.moves.flatMap(m => Array(MOVES[m].w).fill(m));
  if (e.intent === 'guard' || e.intent === 'regen') pool = pool.filter(m => m !== e.intent);
  if (e.hp > e.maxhp * .6) pool = pool.filter(m => m !== 'regen');
  e.intent = pick(pool);
}
function intentText(e) {
  if (B.dom === 'fog') return '❓ ？？？';
  const m = MOVES[e.intent];
  if (m.kind === 'doom') return '☠️ 死亡宣告（出戰夥伴會被打到 1 血並強制換下）';
  if (m.kind === 'atk') {
    const est = Math.max(1, Math.round(calcRaw(e, B.p, m.power)));
    const st = m.status ? ` ${STATUS[m.status[0]].icon}` : '';
    return `⚔️ ${m.name} ${est}${m.hits ? ' ×' + m.hits : ''}${st}`;
  }
  if (m.kind === 'guard') return `🛡️ ${m.name}`;
  if (m.kind === 'heal') return `💚 ${m.name}`;
  return `💢 ${m.name}`;
}

function updateBattle(dt) {
  if (B.phase !== 'run' || B.hold) return;
  B.p.gauge += gaugeRate(B.p) * dt;
  B.e.gauge += gaugeRate(B.e) * dt;
  if (B.p.gauge >= 100) startPlayerTurn();
  else if (B.e.gauge >= 100) enemyTurn();
}

function startPlayerTurn() {
  const p = B.p;
  p.gauge = 100;
  B.phase = 'player';
  B.turnNo = (B.turnNo || 0) + 1;
  p.stay = (p.stay || 0) + 1;
  tickStatus(p);
  // 樹人獸：寄生之根（同一隻夥伴連續在場 3 回合以上，越纏越緊）
  if (B.dom === 'fog' && p.stay >= 3) {
    const lv = p.stay - 2, d = Math.max(2, Math.round(p.maxhp * .04 * lv));
    p.hp = Math.max(0, p.hp - d); p.st.root = lv;
    floatText(p, `-${d} 🌱`, 'dot', 40); log(`🌱 寄生之根越纏越緊（第 ${lv} 層），${p.name} 受到 ${d} 傷害！換手可以甩開它`);
  }
  if (has('darkgear')) { const d = Math.max(1, Math.round(p.maxhp * .03)); p.hp = Math.max(0, p.hp - d); floatText(p, `-${d} ⚙️`, 'dot'); }
  if (checkEnd()) return;
  p.block = 0;
  if (has('sincerity')) gainBlock(p, 4);
  if (K().blockDef) gainBlock(p, Math.round(3 + p.def * .3));
  B.switchedThisTurn = false; B.relayFree = false; B.pinBonus = 0;
  if (B.dom === 'heat') { p.st.burn = Math.max(p.st.burn || 0, 1); floatText(p, '🔥 灼熱！', 'dot', 40); }
  if (p.tier > 0) { p.evoTurns--; if (p.evoTurns <= 0) devolve(); }
  const carry = Math.min(CARRY_MAX, B.carry || 0);
  B.carry = 0;
  B.energy = ENERGY + carry + (B.firstTurn && has('light') ? 1 : 0);
  if (carry) log(`⚡ 上回合保留的 ${carry} 點能量帶過來了！`);
  B.firstTurn = false;
  const target = HAND_SIZE + (has('knowledge') ? 1 : 0) + K().draw - (B.dom === 'jam' ? 1 : 0);   // 干擾電波：少補 1 張
  drawCards(target - B.hand.filter(c => !c.temp).length);
  applyBossHand();
  banner('你的回合！');
  renderBattle();
  if (p.dark && Math.random() < .25) setTimeout(rampage, 500);
}

async function playCard(i, forced) {
  if (!B || B.phase !== 'player' || (!forced && popupOpen()) || B.anim) return;
  const c = B.hand[i]; if (!c) return;
  const d = cardDef(c.id), cost = cardCost(c, d);
  if (B.p.dark && !['atk', 'sig', 'ult'].includes(d.type)) { floatText(B.p, '暴走中！只能攻擊', 'info'); return; }
  if (d.canPlay && !d.canPlay()) { floatText(B.p, '現在無法使用', 'info'); return; }
  if (cost > B.energy) { floatText(B.p, '能量不足', 'info'); sfx('error'); return; }
  sfx('card');
  const node = $('#hand').children[i], from = node ? node.getBoundingClientRect() : null;
  B.energy -= cost;
  B.hand.splice(i, 1);
  log(`${B.p.name} 使用了「${d.name}」`);
  B.anim = true;
  renderBattle();
  const myB = B;
  await Promise.race([cardVfx(c.id, d, from), sleep(1500)]);   // 特效打中之後才結算傷害（最多等 1.5 秒，切到別的分頁也不會卡住）
  if (B !== myB || B.phase !== 'player') return;
  B.anim = false;
  const half = isHalf(c, d);
  if (c.pol && !d.noHalf) { B.spread[baseId(c.id)] = B.turnNo + 2; log(`☠️ 汙染擴散！所有「${cardDef(baseId(c.id)).name}」2 回合內效果減半`); }
  if (['atk', 'sig', 'ult'].includes(d.type) && B.e.gears > 0) {   // 機械人獸的小齒輪擋下這張攻擊卡
    B.e.gears--; lunge(B.p); floatText(B.e, '⚙️ 小齒輪擋下了！', 'info'); sfx('block');
    log(`⚙️ 小齒輪擋下了「${d.name}」！（還剩 ${B.e.gears} 隻）`);
  } else {
    if (half) floatText(B.p, '☠️ 效果減半', 'dot', 60);
    HALF = half;
    try { d.fx(); } finally { HALF = false; }
  }
  if (c.burn && B.e.hp > 0) {   // 火焰獸的卡片燒傷
    const dd = Math.max(1, Math.round(B.p.maxhp * .06)); B.p.hp = Math.max(0, B.p.hp - dd);
    floatText(B.p, `-${dd} 🔥`, 'dot', 30); log(`🔥 燃燒中的卡燙傷了 ${B.p.name}（${dd}）`);
  }
  clearMarks(c);
  if (c.temp && !B.p.tier) { /* 已經退化，臨時的究極技卡直接消失 */ }
  else if (d.exhaust) B.exhaust.push(c); else B.discard.push(c);
  if (d.permanent) { const k = RUN.deck.indexOf(c.id); if (k >= 0) RUN.deck.splice(k, 1); toast(`「${d.name}」已經用掉了（整局只能用一次）`); }
  if (d.type === 'atk') gainCourage(1); else if (d.type === 'sig') gainCourage(3);
  if (checkEnd()) return;
  renderBattle();
}

function endTurn() {
  if (!B || B.phase !== 'player' || B.anim || noticeOpen()) return;
  closePopups();
  B.carry = Math.min(CARRY_MAX, B.energy);
  if (B.carry) log(`⚡ 保留 ${B.carry} 點能量到下回合`);
  // 究極技卡（進化時拿到的）和 📌 釘住的牌會保留在手上，其他的進棄牌堆
  const kept = c => c.temp || c.pin;
  const nPin = B.hand.filter(c => c.pin && !c.temp).length;
  if (nPin) log(`📌 保留 ${nPin} 張牌到下回合`);
  B.hand.filter(c => !kept(c)).forEach(clearMarks);
  B.discard.push(...B.hand.filter(c => !kept(c)));
  B.hand = B.hand.filter(kept);
  B.p.gauge = B.p.nextGauge || 0;
  B.p.nextGauge = 0;
  B.phase = 'run';
  renderBattle();
}

function enemyTurn() {
  const myB = B, e = B.e;
  B.phase = 'enemy';
  e.gauge = 100;
  tickStatus(e);
  if (checkEnd()) return;
  e.block = 0;
  renderBattle();
  setTimeout(async () => {
    if (B !== myB || B.phase !== 'enemy') return;
    const m = MOVES[e.intent];
    log(`${e.name} 使用了「${m.name}」！`);
    await Promise.race([enemyVfx(e.intent, m), sleep(1500)]);
    while (noticeOpen()) await sleep(200);   // 說明視窗打開時先暫停
    if (B !== myB || B.phase !== 'enemy') return;
    const p = B.p;
    bossHandAct(e);
    if (m.kind === 'atk') {
      for (let i = 0; i < (m.hits || 1); i++) applyHit(e, p, m.power);
      if (m.status && p.hp > 0 && Math.random() < (m.chance ?? 1)) addStatus(p, m.status[0], m.status[1]);
    } else if (m.kind === 'guard') {
      gainBlock(e, Math.round(m.block * (1 + .1 * (e.lvl - 1))));
    } else if (m.kind === 'buff') {
      addStatus(e, m.status[0], m.status[1]);
    } else if (m.kind === 'heal') {
      healF(e, Math.round(e.maxhp * m.heal));
    } else if (m.kind === 'doom') {
      if (p.st.ward) { delete p.st.ward; floatText(p, '✨ 守護！', 'heal'); log('✨ 光之守護擋下了死亡宣告！'); }
      else if (B.fighters.some(f => f !== p && f.hp > 0 && !isLocked(f))) {
        p.hp = 1; devolve(true, p); p.lockUntil = B.turnNo + 2;
        floatText(p, '☠️ 死亡宣告', 'super'); shake(p);
        log(`☠️ ${p.name} 被死亡宣告擊中，只剩 1 HP，被強制換下場（2 回合內不能上場）！`);
        e.gauge = 0; e.p2n = (e.p2n || 0) + 1; chooseIntent(e);
        B.hand.forEach(clearMarks); B.discard.push(...B.hand.filter(c => !c.temp)); B.hand = []; B.carry = 0;
        B.phase = 'choose'; renderBattle(); openSwitch(true);
        return;
      } else {
        const d = Math.round(p.maxhp * .4); p.hp = Math.max(0, p.hp - d);
        floatText(p, `-${d} ☠️`, 'crit'); shake(p); log(`☠️ 死亡宣告！沒有夥伴可以替換，${p.name} 受到 ${d} 點傷害！`);
      }
    }
    e.gauge = 0;
    if (e.phase2) e.p2n = (e.p2n || 0) + 1;
    // 第二階段：每 3 次行動發動一次死亡宣告（前一次行動時就會預告）
    if (e.phase2 && e.p2n % 3 === 2) { e.intent = 'deathmark'; log(`⚠️ ${e.name} 正在準備「死亡宣告」！`); }
    else chooseIntent(e);
    if (checkEnd()) return;
    renderBattle();
    setTimeout(() => { if (B === myB && B.phase === 'enemy') { B.phase = 'run'; renderBattle(); } }, 450);
  }, 300);
}

// ---------- 惡魔獸第二階段 ----------
function enterPhase2() {
  const e = B.e;
  e.phase2 = true;
  e.atk = Math.round(e.atk * 1.25);
  e.spd = +(e.spd * 1.15).toFixed(1);
  e.st = {};
  if (!e.moves.includes('groundzero')) e.moves = [...e.moves, 'groundzero'];
  banner(`${e.name} 進入第二階段！`);
  floatText(e, '💢 黑暗爆發！', 'super');
  log(`🌑 ${e.name} 發出震天咆哮，黑暗的力量爆發了！（攻擊、速度提升，異常狀態解除）`);
  // 黑暗衝擊：進化中 → 強制退化；沒進化 → 受到 30% HP 傷害、行動條歸零；接下來 1 回合不能進化
  const p = B.p;
  let shock;
  if (p.tier > 0) { const was = p.name; log(`💥 黑暗衝擊！${p.name} 被強制退化了！`); devolve(true, p); floatText(p, '強制退化！', 'super'); shake(p);
    shock = `黑暗的衝擊波打中了 <b>${was}</b>，牠被<b>強制退化</b>回 ${p.name}！（究極技卡也一起消失了）`; }
  else { const d = Math.round(p.maxhp * .3); p.hp = Math.max(1, p.hp - d); p.gauge = 0; floatText(p, `-${d} 黑暗衝擊`, 'dot'); shake(p); log(`💥 黑暗衝擊！${p.name} 受到 ${d} 點傷害，行動條歸零！`);
    shock = `黑暗的衝擊波打中了 <b>${p.name}</b>，受到 ${d} 點傷害，行動條歸零！`; }
  B.sealTurn = B.turnNo + 1;
  e.p2n = 0;
  sfx('wrongevo');
  battleNotice(`🌑 ${e.name} 進入第二階段！`, [
    ['💥 黑暗衝擊', shock],
    ['🔒 黑暗封印', '接下來 1 回合<b>無法進化</b>。'],
    ['☠️ 死亡宣告', '之後每 3 次行動發動一次（前一次行動時頭上會預告）。出戰夥伴會被打到 1 HP 並強制換下，2 回合內不能上場；沒有夥伴可以換的話改成受到 40% 傷害。'],
    ['☠️ 汙染加強', '卡片汙染變成每次 2 張。'],
    ['💢 黑暗爆發', '惡魔獸的攻擊、速度提升，身上的異常狀態全部解除。'],
  ]);
}
// 被死亡宣告換下的夥伴，幾回合內不能上場
const isLocked = f => f.lockUntil && f.lockUntil >= B.turnNo;
function checkPhase2() { const e = B.e; if (B.dom === 'dark' && !e.phase2 && e.hp > 0 && e.hp <= e.maxhp / 2) enterPhase2(); }

// ---------- 進化 ----------
const evoTurnsNow = () => Math.max(1, EVO_TURNS + (has('digivice') ? 1 : 0) - (B && B.dom === 'dark' ? 1 : 0));
const FORCE_MIN = 10;   // 強行進化至少要有的勇氣值
function evoCost(f, tier) {
  const c = TIERS[tier].cost - (f.tier ? TIERS[f.tier].cost : 0);
  const partner = RUN && KIDS[RUN.kid] && f.m && f.m.sp === KIDS[RUN.kid].partner;
  return Math.round(c * (has('darkpower') ? .7 : 1) * K().evo * (B && B.dom === 'dark' ? 1.3 : 1) * (partner ? .9 : 1));
}
function evoBlock(f, tier) {
  if (f.noEvo) return '這場戰鬥無法再進化';
  if (B && B.sealTurn && B.turnNo <= B.sealTurn) return '被黑暗封印，暫時無法進化';
  if (f.dark) return '暴走中，無法控制';
  if (tier <= f.tier) return f.tier === tier ? '目前型態' : '已經超越';
  if (f.m.level < TIERS[tier].lv) return `需要 Lv.${TIERS[tier].lv}`;
  if (RUN.courage < evoCost(f, tier) && RUN.courage < FORCE_MIN) return `勇氣值不足（強行進化至少要 ${FORCE_MIN}）`;
  return null;
}
// 勇氣值不夠時的強行進化機率：缺越多越危險
function forceOdds(f, tier) {
  if (B.charm) return { success: 1, wrong: 0, fail: 0, total: 1, charm: true };
  const cost = evoCost(f, tier), sh = clamp((cost - RUN.courage) / cost, 0, 1);   // sh = 缺少比例
  let total = Math.min(.95, Math.max(.1, 1 - sh) + (has('digivice') ? .1 : 0) + K().forceSuccess);
  let fail = 1 - total;
  if (has('will')) { fail /= 2; total = 1 - fail; }
  let share = Math.min(1, sh + K().forceWrong);   // 成功之後失控的比例
  if (has('pureheart')) share /= 2;
  if (K().noWrong) share = 0;
  const wrong = total * share;
  return { success: total - wrong, wrong, fail, total };
}
const pct = x => Math.round(x * 100);

function darkForm(f, tier) {
  if (f.sp.dark) return { name: f.sp.dark.name, img: f.sp.dark.img, tint: false };
  const ev = f.sp.evo[tier - 1];
  return { name: '暗黑' + ev.name, img: ev.img, tint: true };
}
function doEvolve(f, tier, dark) {
  const T = TIERS[tier], ev = f.sp.evo[tier - 1], old = f.name, ratio = f.hp / f.maxhp;
  f.maxhp = Math.round(f.base.maxhp * T.m.hp);
  f.atk = Math.round(f.base.atk * T.m.atk * (dark ? 1.3 : 1));
  f.def = Math.round(f.base.def * T.m.def * (dark ? .8 : 1));
  f.spd = +(f.base.spd * T.m.spd).toFixed(1);
  f.hp = Math.min(f.maxhp, Math.round(f.maxhp * ratio + f.maxhp * .2));
  const form = dark ? darkForm(f, tier) : { name: ev.name, img: ev.img, tint: false };
  Object.assign(f, { name: form.name, img: form.img, darkTint: form.tint, dark, tier, evoTurns: evoTurnsNow() });
  removeTemp();
  B.hand.push({ uid: ++uidSeq, id: 'ult', temp: true }, { uid: ++uidSeq, id: 'ult', temp: true });
  if (has('ultproof')) B.hand.push({ uid: ++uidSeq, id: 'ult', temp: true });   // 🏅 究極之證
  B.energy += T.energy;
  closePopups();
  sfx(dark ? 'wrongevo' : 'evolve');
  if (dark) {
    showEvoFlash(old, '錯誤進化', form.name, form.img, f.emoji, true, form.tint);
    log(`💀 ${old} 錯誤進化——${form.name}！力量失控了！（攻擊大增，但只能出攻擊卡，還會暴走）`);
  } else {
    showEvoFlash(old, T.verb, ev.name, ev.img, f.emoji);
    log(`✨ ${old} ${T.verb}——${ev.name}！（${T.name}，能量 +${T.energy}）`);
  }
  renderBattle();
}
function evolveTo(tier) {
  const f = B?.p;
  if (!f || B.phase !== 'player' || B.anim || evoBlock(f, tier)) return;
  const cost = evoCost(f, tier);
  if (RUN.courage >= cost) { RUN.courage -= cost; doEvolve(f, tier, false); updateCourageUI(); return; }
  // ---- 強行進化：勇氣值全部用掉，結果看運氣 ----
  const o = forceOdds(f, tier);
  RUN.courage = 0;
  if (o.charm) { B.charm = false; log('🧿 數碼護符發出光芒！'); }
  log(`⚠️ ${KIDS[RUN.kid].nick}：「拜託了…${f.name}，進化吧——！」（成功 ${pct(o.success)}%）`);
  const r = Math.random();
  if (r < o.success) doEvolve(f, tier, false);
  else if (r < o.success + o.wrong) {
    RUN.flags.wrongEvo = (RUN.flags.wrongEvo || 0) + 1;
    addFlag('dark');
    doEvolve(f, tier, true);
  } else {
    closePopups();
    if (!K().noRecoil) { const d = Math.max(1, Math.round(f.maxhp * .15)); f.hp = Math.max(1, f.hp - d); floatText(f, `-${d} 反噬`, 'dot'); }
    addStatus(f, 'para', 2);
    showEvoFlash('', '', '進化失敗…', null, '💔', true);
    sfx('fail');
    log(`💔 進化失敗了！${f.name} 承受不住力量的反噬…`);
    renderBattle();
  }
  updateCourageUI();
}
function devolve(silent, f = B.p) {
  if (!f.tier) return;
  const ratio = f.hp / f.maxhp, evName = f.name, wasDark = f.dark;
  Object.assign(f, f.base, { name: f.sp.name, img: f.sp.img, tier: 0, evoTurns: 0, dark: false, darkTint: false });
  f.hp = ratio <= 0 ? 0 : Math.max(1, Math.round(f.maxhp * ratio));
  removeTemp();
  if (wasDark) {
    f.noEvo = true;
    if (!silent && f.hp > 0) { const d = Math.max(1, Math.round(f.maxhp * .2)); f.hp = Math.max(1, f.hp - d); floatText(f, `-${d}`, 'dot'); }
    if (!silent) log(`${evName} 的黑暗力量消散了…${f.name} 筋疲力盡，這場戰鬥無法再進化`);
    return;
  }
  if (!silent) log(`${evName} 退化回 ${f.name} 了`);
}
// 錯誤進化的暴走：回合開始時有機會自己亂出攻擊卡
async function rampage() {
  if (!B || B.phase !== 'player' || !B.p.dark || B.anim) return;
  const idx = B.hand.map((c, i) => ({ c, i })).filter(x => { const d = cardDef(x.c.id); return ['atk', 'sig', 'ult'].includes(d.type) && d.cost <= B.energy; });
  if (!idx.length) return;
  log(`💢 ${B.p.name} 暴走了！不聽指揮自己攻擊！`);
  floatText(B.p, '暴走！', 'super');
  await playCard(pick(idx).i, true);
}

// ---------- 背包道具 ----------
function itemBlock(k) {
  if (k === 'smoke' && (B.opt.boss || B.opt.elite || B.opt.noFlee)) return '這場戰鬥逃不掉';
  if (k === 'charm' && B.charm) return '已經在生效中';
  return null;
}
function openBag() {
  if (!B || B.phase !== 'player' || B.anim) return;
  if (!$('#bagPanel').classList.contains('hidden')) { closePopups(); return; }
  closePopups();
  const panel = $('#bagPanel');
  panel.innerHTML = `<h3><span>🎒 背包（${RUN.items.length}/${bagMax()}）　使用不花能量</span><button class="btn" id="bagClose">關閉</button></h3>` +
    (RUN.items.length ? '' : '<div class="why" style="padding:8px">背包是空的。探索地圖、開寶箱、逛商店都能拿到道具。</div>');
  RUN.items.forEach((k, i) => {
    const it = ITEMS[k], why = itemBlock(k), el = document.createElement('div');
    el.className = 'swOpt' + (why ? ' off' : '');
    el.innerHTML = `<span style="font-size:30px">${it.icon}</span><div class="grow"><b>${it.name}</b><div class="mini2">${it.desc}</div></div>${why ? `<span class="why">${why}</span>` : '<span>使用</span>'}`;
    if (!why) el.onclick = () => useItem(i);
    panel.appendChild(el);
  });
  panel.querySelector('#bagClose').onclick = closePopups;
  panel.classList.remove('hidden');
}
function useItem(i) {
  const k = RUN.items[i];
  if (!B || B.phase !== 'player' || !k || itemBlock(k)) return;
  RUN.items.splice(i, 1);
  closePopups();
  log(`使用了 ${ITEMS[k].icon} ${ITEMS[k].name}`);
  if (k === 'potion') healF(B.p, Math.round(B.p.maxhp * .3));
  else if (k === 'juice') gainCourage(25, true);
  else if (k === 'charm') { B.charm = true; floatText(B.p, '🧿 護符生效', 'info'); }
  else if (k === 'chip') { B.energy += 2; floatText(B.p, '⚡+2', 'info'); }
  else if (k === 'smoke') {
    B.phase = 'end'; syncTeamHp(); coolDownCourage(); log('💨 趁著煙霧逃走了！'); renderBattle();
    const res = B.resolve; setTimeout(() => { B = null; res('flee'); }, 700); return;
  }
  renderBattle();
}

// ---------- 換手 / 逃跑 ----------
function switchCost() {
  if (B && B.relayFree) return 0;   // 交棒連擊
  let c = 1;
  if (K().freeSwitch) c = B && B.switchedThisTurn ? 1 : 0;   // 大和：每回合第一次免費
  else if (has('friendship')) c = 0;
  return c + (B && B.dom === 'jam' ? 1 : 0);
}
function switchTo(i, forced) {
  const nf = B.fighters[i];
  if (!nf || nf === B.p || nf.hp <= 0 || (isLocked(nf) && !B.ignoreLock)) return;
  B.ignoreLock = false;
  if (!forced) {
    if (B.phase !== 'player' || B.energy < switchCost()) return;
    B.energy -= switchCost();
    B.relayFree = false;
    if (K().freeSwitch && !B.switchedThisTurn && has('friendship')) { drawCards(1); log('🤝 友情徽章：抽 1 張牌'); }
    B.switchedThisTurn = true;
  }
  const old = B.p;
  devolve(true, old);
  old.stay = 0; nf.stay = 0; delete old.st.root;
  nf.gauge = forced ? 50 : old.gauge;
  B.p = nf;
  B.participants.add(i);
  closePopups();
  $('#pPanel .emo').dataset.k = '';
  log(forced ? `去吧，${nf.name}！` : `${old.name} 退下，換 ${nf.name} 上場！`);
  if (forced) B.phase = 'run';
  renderBattle();
}
function flee() {
  if (!B || B.phase !== 'player' || B.anim || B.opt.boss || B.opt.elite || B.opt.noFlee) return;
  const ch = clamp(.5 + (B.p.spd - B.e.spd) * .04, .2, .9);
  if (Math.random() < ch) {
    B.phase = 'end';
    syncTeamHp();
    coolDownCourage();
    log('成功逃跑了！');
    renderBattle();
    const res = B.resolve;
    setTimeout(() => { B = null; res('flee'); }, 700);
  } else {
    log('逃跑失敗！');
    endTurn();
  }
}

function checkEnd() {
  if (B.e.hp <= 0) { win(); return true; }
  if (B.p.hp <= 0) {
    if (B.fighters.some(f => f.hp > 0)) faint(); else lose();
    return true;
  }
  return false;
}
function faint() {
  const p = B.p;
  devolve(true, p);
  log(`${p.name} 倒下了！選擇下一隻夥伴`);
  B.hand.forEach(clearMarks); B.discard.push(...B.hand); B.hand = [];
  B.carry = 0;
  p.gauge = 0;
  B.phase = 'choose';
  renderBattle();
  openSwitch(true);
}
function syncTeamHp() { B.fighters.forEach(f => { devolve(true, f); f.m.hp = Math.max(1, f.hp); }); }

// ---------- 勸降 ----------
// 成功率 = (1 − 剩餘血量%) × 80%，再依狀態、等級差、孩子、失敗次數加減，最高 90%
function persuadeChance(e = B.e) {
  if (e.boss || !e.sp.evo) return 0;
  if (B.opt.tutorial === 3) return 1;
  let c = (1 - e.hp / e.maxhp) * .8;
  if (e.st.para || e.st.poison || e.st.burn) c += .1;
  c -= Math.max(0, e.lvl - B.p.lvl) * .05;
  c += K().persuade;
  if (e.elite) c *= .5;
  c += e.signal || 0;   // 友好訊號
  c -= (e.pfail || 0) * .15;
  return clamp(c, 0, .9);
}
const PERSUADE_OPTS = [
  { label: '⚡1 能量 ＋ 🔥10 勇氣值', ok: () => B.energy >= 1 && RUN.courage >= 10, pay: () => { B.energy -= 1; RUN.courage -= 10; updateCourageUI(); } },
  { label: '⚡1 能量 ＋ 💰30 數碼幣', ok: () => B.energy >= 1 && RUN.bits >= 30, pay: () => { B.energy -= 1; RUN.bits -= 30; } },
  { label: '⚡2 能量', ok: () => B.energy >= 2, pay: () => { B.energy -= 2; } },
];
function persuadeHard() {   // 不管付什麼都不能勸降的情況
  const e = B.e;
  if (e.boss) return '頭目不聽勸';
  if (!e.sp.evo) return '無法勸降';
  if ((e.pfail || 0) >= 3) return '不肯再聽了';
  return null;
}
function persuadeBlock() { return persuadeHard() || (PERSUADE_OPTS.some(o => o.ok()) ? null : '能量不足'); }
function persuade() {
  if (!B || B.phase !== 'player' || B.anim || persuadeBlock()) return;
  if (!$('#persuadePanel').classList.contains('hidden')) { closePopups(); return; }
  closePopups();
  const panel = $('#persuadePanel');
  panel.innerHTML = `<h3><span>🤝 勸降 ${B.e.sp.name}　成功率 ${Math.round(persuadeChance() * 100)}%</span><button class="btn" id="psClose">取消</button></h3>
    <div class="mini2" style="margin-bottom:8px">選擇要付出的代價（失敗的話敵人會被激怒）</div>`;
  PERSUADE_OPTS.forEach(o => {
    const el = document.createElement('div');
    el.className = 'swOpt' + (o.ok() ? '' : ' off');
    el.innerHTML = `<div class="grow"><b>${o.label}</b></div><span>${o.ok() ? '選這個' : '不夠'}</span>`;
    if (o.ok()) el.onclick = () => doPersuade(o);
    panel.appendChild(el);
  });
  panel.querySelector('#psClose').onclick = closePopups;
  panel.classList.remove('hidden');
}
function doPersuade(opt) {
  if (!B || B.phase !== 'player' || !opt.ok()) return;
  closePopups();
  const e = B.e, ch = persuadeChance();
  opt.pay();
  delete e.signal;
  log(`${KIDS[RUN.kid].name}：「${e.sp.name}，別再被黑暗控制了！跟我們一起走吧！」（成功率 ${Math.round(ch * 100)}%）`);
  if (Math.random() < ch) {
    floatText(e, '💗 被說服了！', 'heal');
    B.persuaded = true;
    win();
    return;
  }
  e.pfail = (e.pfail || 0) + 1;
  addStatus(e, 'atkUp', 2);
  e.gauge = clamp(e.gauge + 50, 0, 99);
  floatText(e, '💢 生氣了！', 'super');
  sfx('angry');
  log(e.pfail >= 3 ? `${e.name} 完全不肯聽你說話了！` : `勸降失敗！${e.name} 被激怒了，攻擊提升、馬上就要行動！`);
  renderBattle();
}

function win() {
  B.phase = 'end';
  const e = B.e, opt = B.opt, persuaded = !!B.persuaded;
  // 🏅 究極之證：原作搭檔的究極體、帶著自己的徽章、HP 80% 以上，擊倒精英或頭目
  const p = B.p, proof = (opt.boss || opt.elite) && !persuaded && !has('ultproof') && p.tier === 3 && !p.dark &&
    p.hp >= p.maxhp * .8 && p.m.sp === KIDS[RUN.kid].partner && has(kidCrest());
  if (proof) RUN.relics.push('ultproof');
  syncTeamHp();
  if (has('love')) teamHeal(.1);
  if (K().winHeal) teamHeal(K().winHeal);
  const mult = (opt.boss ? 4 : opt.elite ? 2 : 1) * (persuaded ? .5 : 1);   // 勸降只拿一半經驗
  const exp = Math.round(e.lvl * 5 * mult);
  const msgs = [];
  B.fighters.forEach((f, i) => {
    // 打比自己弱的敵人經驗變少，比自己強的變多，讓等級自然跟上關卡
    const m = f.m, diff = clamp(1 + (e.lvl - m.level) * .2, .1, 1.5);
    const share = B.participants.has(i) || K().benchFull ? 1 : 1 / 4;
    const got = Math.max(1, Math.round(exp * share * diff));
    m.exp += got;
    let lvUp = false;
    while (m.exp >= expNeed(m.level)) {
      const before = memberStats(m);
      m.exp -= expNeed(m.level); m.level++;
      const a = memberStats(m);
      m.hp = Math.min(a.maxhp, m.hp + (a.maxhp - before.maxhp) + Math.round(a.maxhp * .3));
      lvUp = true;
    }
    msgs.push(`${SPECIES[m.sp].name} 經驗 +${got}${lvUp ? `　🎉 Lv.${m.level}！` : ''}` +
      (lvUp && [4, 7].includes(m.level) ? `　<b style="color:#f9a8d4">解鎖${TIERS[m.level === 4 ? 2 : 3].verb}！</b>` : ''));
  });
  const bits = gainBits((e.lvl * 4 + randInt(5, 12)) * (opt.boss ? 4 : opt.elite ? 2 : 1) * (has('coin') ? 1.5 : 1));
  const cg = 1 + (opt.boss ? 15 : opt.elite ? 5 : 0);
  gainCourage(cg);
  const cBefore = Math.floor(RUN.courage);
  coolDownCourage();
  msgs.push(`💰 數碼幣 +${bits}　　🔥 勇氣值 +${Math.round(cg * K().courage)}`);
  if (Math.floor(RUN.courage) < cBefore) msgs.push(`<span style="color:#fdba74">🔥 勇氣值冷靜下來：${cBefore} → ${Math.floor(RUN.courage)}（${COURAGE_SAFE} 以下完全保留，超過的部分減半）</span>`);
  RUN.stats.wins++;
  if (persuaded) RUN.stats.persuaded = (RUN.stats.persuaded || 0) + 1;
  renderBattle();
  showResult(persuaded ? `${e.sp.name} 被說服了！` : `擊敗了 ${e.name}！`, persuaded ? '牠決定成為你的夥伴' : '');
  sfx(persuaded ? 'persuade' : 'victory');
  if (msgs.some(m => m.includes('🎉'))) setTimeout(() => sfx('levelup'), 900);
  const res = B.resolve;
  setTimeout(async () => {
    B = null;
    await battleReward(msgs, persuaded ? e : null, opt);
    if (proof) {
      showEvoFlash('', '', '究極之證覺醒！', null, '🏅');
      await sleep(1200);
      await say(null, `✨ <b>究極之證覺醒！</b><br>${KIDS[RUN.kid].nick}的徽章和夥伴的心完全共鳴了！<br>獲得 <b>🏅 究極之證</b>：之後每次進化都會多拿 1 張究極技卡。`);
    }
    res('win');
  }, 1200);
}

function revive(text, title, pct) {
  B.fighters.forEach(f => f.hp = Math.round(f.maxhp * pct));
  B.p.gauge = 50;
  B.phase = 'run';
  showEvoFlash('', '', title, null, '🕊️');
  log(text);
  renderBattle();
}
function lose() {
  if (K().revive && !RUN.flags.kidRevive) {
    RUN.flags.kidRevive = true;
    revive('🕊️ 「只要不放棄，就一定有希望！」全隊重新站了起來！', '希望不滅！', .4);
    return;
  }
  if (has('hope') && !RUN.flags.hopeUsed) {
    RUN.flags.hopeUsed = true;
    RUN.relics = RUN.relics.filter(k => k !== 'hope');
    revive('🕊️ 希望徽章發出光芒，全隊復活了！', '希望之光！', .3);
    return;
  }
  B.phase = 'end';
  renderBattle();
  showResult('全隊都倒下了…', '這次的冒險結束了');
  sfx('defeat');
  setTimeout(() => { B = null; gameOver(); }, 2200);
}

// ---------- 勝利獎勵 ----------
function joinTeam(id, lv) { RUN.team.push(newMember(id, lv)); preloadLine(id); if (!RUN.seen.includes(id)) RUN.seen.push(id); }
async function battleReward(msgs, recruit, opt) {
  const o = $('#reward');
  showScreen('#reward');
  const pool = shuffle([...REWARD_POOL]).slice(0, 3);
  const full = recruit && RUN.team.length >= teamMax();
  if (recruit && !full) joinTeam(recruit.id, recruit.lvl);
  await new Promise(res => {
    o.innerHTML = `<h2>${opt.boss ? '🏆 頭目擊破！' : recruit ? '🤝 勸降成功！' : '勝利！'}</h2>
      <div class="msgs">${msgs.join('<br>')}</div>
      <div id="recruitBox"></div>
      <p class="sub">選一張卡片加入牌組（目前 ${RUN.deck.length}${K().deckMax < 99 ? ' / ' + K().deckMax : ''} 張）</p>
      <div class="rewardCards"></div>
      <button class="btn" id="btnSkip">跳過</button>`;
    if (recruit) {
      const box = o.querySelector('#recruitBox');
      box.innerHTML = `<div class="recruit">${dpic(recruit.sp.img, recruit.emoji, 's80')}
        <div><div class="txt">${recruit.sp.name}（Lv.${recruit.lvl}）${full ? '想加入，但隊伍已經滿了！' : '加入了隊伍！'}</div>
        <div class="mini2">${ATTR_ICON[recruit.attr]} ${ATTR_NAME[recruit.attr]}　${recruit.sp.desc}<br>會進化成 ${recruit.sp.evo.map(e => e.name).join(' → ')}</div></div>
        ${full ? `<div class="col2"><button class="btn evo" id="btnSwap">放走一隻夥伴換牠</button><button class="btn" id="btnBits">讓牠離開（💰 +40）</button></div>` : ''}</div>`;
      if (full) {
        box.querySelector('#btnSwap').onclick = async () => {
          const m = await pickScreen({ title: `要讓哪一隻夥伴離開？`, sub: `${recruit.sp.name} 會取代牠的位置`, skip: '取消',
            items: RUN.team.slice(), render: m => { const s = SPECIES[m.sp], el = document.createElement('div'); el.className = 'pickMon';
              el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}</span>`; return el; } });
          if (!m) return;
          RUN.team.splice(RUN.team.indexOf(m), 1);
          joinTeam(recruit.id, recruit.lvl);
          box.innerHTML = `<div class="recruit"><div class="txt">${SPECIES[m.sp].name} 回到了森林。${recruit.sp.name} 加入了隊伍！</div></div>`;
        };
        box.querySelector('#btnBits').onclick = () => { const b = gainBits(40); box.innerHTML = `<div class="recruit"><div class="txt">${recruit.sp.name} 留下 💰 ${b} 數碼幣後離開了。</div></div>`; };
      }
    }
    const box = o.querySelector('.rewardCards');
    let picked = false;   // 只能選一次（避免連點多拿卡）
    pool.forEach(id => box.appendChild(cardEl(id, { onClick: async () => {
      if (picked) return;
      if (RUN.deck.length >= K().deckMax) {   // 牌組滿了：選一張舊卡換掉
        const x = await chooseCardFromDeck(`牌組已滿（${K().deckMax} 張），選一張要換掉的卡`);
        if (!x) return;
        if (picked) return; picked = true;
        RUN.deck[x.i] = id; toast(`「${cardDef(x.id).name}」換成了「${cardDef(id).name}」`); res(); return;
      }
      if (addCard(id)) { picked = true; toast(`「${cardDef(id).name}」加入了牌組`); res(); }
    } })));
    o.querySelector('#btnSkip').onclick = () => { picked = true; res(); };
  });
  o.classList.add('hidden');
  if (opt.elite || opt.boss) {
    const items = shuffle(relicPool()).slice(0, 3);
    if (items.length) {
      const k = await pickScreen({ title: '獲得徽章道具', sub: '選一個帶在身上（整局有效）', items, render: k => relicEl(k) });
      if (k) { RUN.relics.push(k); toast(`獲得「${RELICS[k].name}」`); }
    }
  }
}

// =========================================================
//   戰鬥畫面
// =========================================================
function renderFighter(f) {
  const el = f.el;
  el.querySelector('.fname').innerHTML = f.name + (f.dark ? '<span class="tierTag dark">錯誤進化</span>' : f.tier ? `<span class="tierTag">${TIERS[f.tier].name}</span>` : '') + (f.boss ? '<span class="tierTag boss">頭目</span>' : f.elite ? '<span class="tierTag boss">精英</span>' : '');
  el.querySelector('.flv').textContent = `Lv.${f.lvl}`;
  el.querySelector('.fattr').textContent = `${ATTR_ICON[f.attr]} ${ATTR_NAME[f.attr]}`;
  const emo = el.querySelector('.emo');
  if (emo.dataset.k !== f.img) { emo.innerHTML = dpic(f.img, f.emoji, 'big'); emo.dataset.k = f.img; }
  const spr = el.querySelector('.sprite');
  spr.classList.toggle('evolved', f.tier > 0);
  spr.classList.toggle('t3', f.tier === 3 && !f.dark);
  spr.classList.toggle('darkevo', !!f.dark);
  spr.classList.toggle('darktint', !!f.darkTint);
  spr.classList.toggle('elite', !!f.elite);
  const r = f.hp / f.maxhp;
  const hb = el.querySelector('.bar.hp>i');
  hb.style.width = (r * 100) + '%';
  hb.style.background = r > .5 ? '#4ade80' : r > .25 ? '#facc15' : '#ef4444';
  el.querySelector('.hptxt').textContent = `${f.hp} / ${f.maxhp}`;
  // 顯示實際速度（加速 ×1.5、麻痺 ×0.5 都算進去），有變化時標顏色
  const effSpd = +(f.spd * (f.st.haste ? 1.5 : 1) * (f.st.para ? .5 : 1)).toFixed(1);
  el.querySelector('.spdtxt').innerHTML = effSpd === f.spd ? `速度 ${f.spd}` :
    `速度 <b class="${effSpd > f.spd ? 'spdUp' : 'spdDown'}">${effSpd}</b>${f.st.haste ? ' 💨' : ''}${f.st.para ? ' ⚡' : ''}`;
  const blk = el.querySelector('.block');
  blk.classList.toggle('hidden', f.block <= 0);
  blk.textContent = `🛡${f.block}`;
  el.querySelector('.statuses').innerHTML =
    (f.tier ? `<span class="st">✨ ${TIERS[f.tier].name} 剩 ${f.evoTurns} 回合</span>` : '') +
    (f.gears ? `<span class="st">⚙️ 小齒輪 ×${f.gears}</span>` : '') + (f.plant ? `<span class="st">🌱 種子 ${f.plant}</span>` : '') +
    Object.entries(f.st).map(([k, n]) => `<span class="st">${STATUS[k].icon} ${STATUS[k].name} ${n}</span>`).join('');
}

function renderBattle() {
  if (!B) return;
  const { p, e } = B, my = B.phase === 'player';
  renderFighter(p); renderFighter(e);
  p.el.classList.toggle('active', my);
  e.el.classList.toggle('active', B.phase === 'enemy');
  const intent = e.el.querySelector('.intent');
  intent.classList.toggle('hidden', B.phase === 'end');
  intent.textContent = intentText(e);
  p.el.querySelector('.bench').innerHTML = B.fighters.length > 1 ? B.fighters.map(f =>
    `<div class="tm ${f === p ? 'lead' : ''} ${f.hp <= 0 || isLocked(f) ? 'dead' : ''}" title="${f.sp.name}${isLocked(f) ? '（封印中）' : ''}">${dpic(f.sp.img, f.emoji, 's32')}
     <div class="hpb"><i style="width:${f.hp / f.maxhp * 100}%"></i></div></div>`).join('') : '';
  $('#battleRelics').innerHTML = RUN.relics.map(k => relicIcon(k)).join('');
  updateCourageUI();
  const orb = $('#orb');
  orb.textContent = my ? B.energy : '–';
  orb.classList.toggle('off', !my);
  $('#piles').innerHTML = `牌庫 ${B.draw.length}　棄牌 ${B.discard.length}${B.exhaust.length ? `<br>移除 ${B.exhaust.length}` : ''}` +
    (my ? `<br><small>沒用完的能量最多保留 ${CARRY_MAX} 點</small>` : B.carry ? `<br><b class="carry">⚡ 下回合 +${B.carry} 能量</b>` : '');
  const hand = $('#hand');
  hand.innerHTML = '';
  if (my) {
    B.hand.forEach((c, i) => {
      const d = cardDef(c.id);
      const marks = (c.burn ? '🔥' : '') + (isHalf(c, d) ? '☠️' : '') + (c.seen ? '🔍' : '') + (c.fog ? '🌫️' : '');
      hand.appendChild(cardEl(c.id, { cost: cardCost(c, d), marks, fog: c.fog, playable: cardCost(c, d) <= B.energy && !(p.dark && !['atk', 'sig', 'ult'].includes(d.type)) && (!d.canPlay || d.canPlay()), key: i + 1, keep: c.temp, pin: c.temp ? undefined : !!c.pin, onPin: () => togglePin(i), onClick: () => playCard(i) }));
    });
    if (!B.hand.length) hand.innerHTML = '<div class="waiting">沒有手牌了，按「結束回合」</div>';
  } else if (B.phase === 'choose') {
    hand.innerHTML = '<div class="waiting">選擇下一隻上場的夥伴</div>';
  } else if (B.phase !== 'end') {
    hand.innerHTML = `<div class="waiting">${B.phase === 'enemy' ? `${e.name} 行動中…` : '⏳ 等待行動條集滿…（速度越快，越常輪到你）'}</div>`;
  }
  const noFlee = B.opt.boss || B.opt.elite || B.opt.noFlee;
  $('#btnEnd').disabled = !my;
  $('#btnFlee').disabled = !my || noFlee;
  $('#btnFlee').textContent = noFlee ? '無法逃跑' : '逃跑';
  $('#btnSwitch').disabled = !my || B.energy < switchCost() || !B.fighters.some(f => f !== p && f.hp > 0 && !isLocked(f));
  $('#btnBag').disabled = !my;
  $('#btnBag').textContent = `🎒 道具 ${RUN.items.length}`;
  const pb = $('#btnPersuade'), why = persuadeBlock(), hard = persuadeHard();
  pb.disabled = !my || !!why;
  pb.innerHTML = hard ? `🤝 ${hard}` : `🤝 勸降 ${Math.round(persuadeChance() * 100)}%<small>${why ? why : '可選擇代價'}</small>`;
  const be = $('#btnEvo');
  be.disabled = !my || ![1, 2, 3].some(t => !evoBlock(p, t));
  be.textContent = p.tier === 3 ? '✨ 究極體！' : p.tier ? '✨ 再進化 (E)' : '✨ 進化 (E)';
  updateGauges();
}
function updateGauges() {
  for (const f of [B.p, B.e]) {
    const bar = f.el.querySelector('.bar.atb');
    bar.querySelector('i').style.width = clamp(f.gauge, 0, 100) + '%';
    bar.classList.toggle('full', f.gauge >= 100);
  }
}

// ---------- 彈出面板 ----------
const POPUPS = ['#evoPanel', '#switchPanel', '#bagPanel', '#persuadePanel'];
const popupOpen = () => POPUPS.some(k => !$(k).classList.contains('hidden')) || noticeOpen() || !$('#overlay').classList.contains('hidden');
function closePopups() { POPUPS.forEach(k => $(k).classList.add('hidden')); }
function openEvo() {
  if (!B || B.phase !== 'player' || B.anim) return;
  if (!$('#evoPanel').classList.contains('hidden')) { closePopups(); return; }
  closePopups(); sfx('open');
  const f = B.p, panel = $('#evoPanel');
  panel.innerHTML = `<h3><span>選擇進化的強度　🔥 勇氣值 ${Math.floor(RUN.courage)}</span><button class="btn" id="evoClose">關閉</button></h3>`;
  [1, 2, 3].forEach(t => {
    const T = TIERS[t], ev = f.sp.evo[t - 1], why = evoBlock(f, t), cost = Math.max(0, evoCost(f, t));
    const force = !why && RUN.courage < cost, o = force ? forceOdds(f, t) : null;
    const el = document.createElement('div');
    el.className = 'evoOpt' + (why ? ' off' : '') + (force ? ' force' : '');
    el.innerHTML = `${dpic(ev.img, f.emoji, 's64')}
      <div><div class="nm">${force ? '⚠️ 強行' : ''}${T.verb} → ${ev.name}<span class="tierTag">${T.name}</span></div>
      <div class="info">能力 ×${T.m.atk}　｜　能量 +${T.energy}　｜　究極技「${ev.ult}」×${has('ultproof') ? 3 : 2}　｜　持續 ${evoTurnsNow()} 回合</div>
      ${force ? `<div class="odds"><span class="ok">成功 ${pct(o.total)}%</span>${o.wrong > 0 ? `<span class="bad">（其中失控 ${pct(o.wrong)}%）</span>` : ''}<span class="fail">失敗 ${pct(o.fail)}%</span>${o.charm ? '<span>🧿 護符生效</span>' : ''}</div>` : ''}
      ${why ? `<div class="why">${why}</div>` : ''}</div>
      <div class="cost">🔥 ${force ? `${Math.floor(RUN.courage)}/${cost}<br><small>全部用掉</small>` : cost}</div>`;
    if (!why) el.onclick = () => evolveTo(t);
    panel.appendChild(el);
  });
  panel.querySelector('#evoClose').onclick = closePopups;
  panel.classList.remove('hidden');
}
function openSwitch(forced) {
  if (!B) return;
  B.ignoreLock = forced && !B.fighters.some(f => f !== B.p && f.hp > 0 && !isLocked(f));
  if (!forced && (B.phase !== 'player' || B.anim || B.energy < switchCost())) return;
  if (!forced && !$('#switchPanel').classList.contains('hidden')) { closePopups(); return; }
  closePopups();
  const panel = $('#switchPanel');
  panel.innerHTML = `<h3><span>${forced ? '派出下一隻夥伴' : `換手（消耗 ${switchCost()} 能量）`}</span>${forced ? '' : '<button class="btn" id="swClose">取消</button>'}</h3>`;
  B.fighters.forEach((f, i) => {
    const locked = isLocked(f) && !B.ignoreLock;
    const off = f === B.p || f.hp <= 0 || locked;
    const el = document.createElement('div');
    el.className = 'swOpt' + (off ? ' off' : '');
    el.innerHTML = `${dpic(f.sp.img, f.emoji, 's44')}<div class="grow"><b>${f.sp.name}</b>　Lv.${f.lvl}　${ATTR_ICON[f.attr]}
      <div class="bar hp" style="width:200px"><i style="width:${f.hp / f.maxhp * 100}%"></i></div></div>
      <span>${f.hp <= 0 ? '倒下' : f === B.p ? '出戰中' : locked ? `☠️ 封印中（${f.lockUntil - B.turnNo + 1} 回合）` : `${f.hp}/${f.maxhp}`}</span>`;
    if (!off) el.onclick = () => switchTo(i, forced);
    panel.appendChild(el);
  });
  if (!forced) panel.querySelector('#swClose').onclick = closePopups;
  panel.classList.remove('hidden');
}

function log(msg) {
  if (!B) return;
  B.log.push(msg);
  B.log = B.log.slice(-3);
  $('#log').innerHTML = B.log.map(m => `<div>${m}</div>`).join('');
}
function floatText(f, text, cls, offsetY = 0) {
  const host = f.el.querySelector('.sprite');
  const d = document.createElement('div');
  d.className = `float ${cls}`;
  d.textContent = text;
  d.style.marginLeft = rand(-30, 30) + 'px';
  d.style.marginTop = offsetY + 'px';
  host.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
function shake(f) { restartAnim(f.el.querySelector('.emo'), 'shake'); }
function lunge(f) { restartAnim(f.el.querySelector('.emo'), f.el.id === 'pPanel' ? 'lunge-r' : 'lunge-l'); }
function showResult(title, sub) {
  const r = $('#result');
  r.querySelector('h2').textContent = title;
  r.querySelector('p').textContent = sub;
  r.classList.remove('hidden');
}
function showEvoFlash(from, verb, to, img, emoji, dark, tint) {
  const f = $('#evoFlash');
  f.classList.toggle('dark', !!dark);
  f.classList.toggle('tint', !!tint);
  f.innerHTML = `${img ? dpic(img, emoji, 'huge') : `<div style="font-size:140px">${emoji}</div>`}<div class="txt">${from ? `${from} ${verb}——` : ''}${to}${from ? '！' : ''}</div>`;
  f.classList.remove('hidden');
  restartAnim(f, 'x');
  restartAnim(f.querySelector('.dpic'), 'pop');
  clearTimeout(showEvoFlash.t);
  showEvoFlash.t = setTimeout(() => f.classList.add('hidden'), 1700);
}
