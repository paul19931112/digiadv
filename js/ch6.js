'use strict';
/* =========================================================
   第六章「東京」：吸血魔獸篇（第二部最終章）
   - 東京的街道地圖（大樓、小巷、公園），吸血魔獸的紫色迷霧
   - 第 8 個孩子的線索：集滿 3 條 → 巫師獸與迪路獸的回憶，得到天女獸援護
   - 頭目前一層：徽章覺醒（可以究極進化）
   - 頭目吸血魔獸：🦇 吸血、🌙 夜之帳；半血 → 吸血魔王獸（左翼／本體／右臂 3 個部位，點選要打哪一個）
   ========================================================= */
let VAMP_DRAIN = .4;     // 吸血：吸血魔獸造成傷害的這個比例會回到自己身上
let MOON_PCT = .03;      // 夜之帳：每張沒打出去的標記卡回復最大 HP 的比例
const VENOM = { core: .62, side: .24 };   // 吸血魔王獸各部位的血量（吸血魔獸最大 HP 的比例）

DOMAINS.vamp = { name: '夜之帝王', icon: '🦇', desc: '🦇 吸血：攻擊會回血；🌙 夜之帳：沒打出去的標記卡讓他回血；血量一半時變成吸血魔王獸（3 個部位）' };
BOSS_INFO.vamp = [['🦇 吸血', '吸血魔獸造成傷害時，會把其中 40% 吸回自己身上。'],
  ['🌙 夜之帳', '每次行動後，你下一手牌會有 1 張（血量一半以下 2 張）被標上 🌙。<b>這回合沒打出去</b>的話，每張讓他回復最大 HP 3%。'],
  ['💀 第二形態', '血量剩一半時會變成<b>吸血魔王獸</b>，分成 3 個部位，各有血量和行動條：<br>🦇 <b>左翼</b>幫本體加護盾、攻擊↑；💀 <b>本體</b>是主要攻擊手，<b>打倒本體就贏</b>；🦴 <b>右臂</b>會讓夥伴中毒、汙染你的手牌。<br>點敵人資訊框下面的部位按鈕切換攻擊目標；打掉的部位不會長回來。「擴散」卡可以一次打全部部位。']];

// ---------- 東京的街道地圖 ----------
function tokyoCity(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = '.';
  // 街區：寬 3～4、高 2～3 的大樓，中間是馬路；有些街區是公園或停車場
  for (let by = 2; by < ROWS - 2; by += 4) for (let bx = 2; bx < COLS - 3; bx += 5) {
    const w = randInt(3, 4), h = randInt(2, 3), r = Math.random();
    for (let y = by; y < Math.min(ROWS - 1, by + h); y++) for (let x = bx; x < Math.min(COLS - 2, bx + w); x++)
      T[y][x] = r < .18 ? ',' : r < .24 ? '.' : 'T';
    if (r >= .24 && Math.random() < .35) T[by + randInt(0, h - 1)][bx + randInt(0, w - 1)] = '.';   // 大樓之間的小巷
  }
  // 路邊停的車（擋路的小障礙）
  for (let k = 0; k < randInt(3, 5); k++) { const x = randInt(2, COLS - 3), y = randInt(1, ROWS - 2); if (T[y][x] === '.') T[y][x] = 'R'; }
}

// ---------- 第 8 個孩子的線索 ----------
const CLUES = [
  { icon: '🎩', name: '破掉的巫師帽', text: '路邊掉著一頂破破爛爛的巫師帽……上面還留著溫暖的氣息。' },
  { icon: '💍', name: '發光的指環碎片', text: '一小片發著光的指環碎片——好像是某隻數碼寶貝很重要的東西。' },
  { icon: '📯', name: '嘉兒的哨子', text: '一個小小的哨子。吹起來的聲音，好像能把重要的夥伴叫回來。' },
];
// 第六章的地圖：還沒集滿就有機會放一條線索；剩下的地圖不夠時一定會放
function placeClue(nd, place, free) {
  if (RUN.chapter !== 6 || nd.type === 'boss') return;
  const need = 3 - (F().clues || 0), left = (CHAPTERS[6].floors - 1) - nd.f;
  if (need > 0 && (Math.random() < .55 || need >= left)) place({ kind: 'clue' }, free(6).length ? free(6) : free(3));
}
async function clueFound() {
  const n = F().clues = (F().clues || 0) + 1, c = CLUES[Math.min(n, 3) - 1];
  sfx('pickup');
  await say(null, `${c.icon} ${c.text}<br>🔎 <b>第 8 個孩子的線索 ${n} / 3</b>：${c.name}`);
  if (n === 3) await eighthChild();
  saveRun(); updateHUD();
}
async function eighthChild() {
  await cutscene([
    { bg: 'tokyo', music: 'route', amb: 'wind', chars: [['Wizarmon', 34, 76, 32, 'in-l'], ['Tailmon', 68, 78, 26, 'in-r']],
      lines: [[null, '三條線索同時發出光芒——眼前浮現出一段回憶。'], [{ img: 'Wizarmon', name: '巫師獸' }, '迪路獸……妳要找的孩子，一定就在這座城市裡。'],
        [{ img: 'Tailmon', name: '迪路獸' }, '嗯。我一直在等她……等那個屬於我的孩子。']] },
    { bg: 'light', music: null, amb: null, sting: true, chars: [['Angewomon', 50, 78, 50, 'in-l']], fx: '<div class="cutRays" style="--rx:50%;--ry:30%"></div>',
      lines: [[null, '📯 哨聲響起，一道光從天而降——'], [{ img: 'Angewomon', name: '天女獸' }, '被選召的孩子們，謝謝你們找到了我的線索。和吸血魔獸決戰的時候，我會助你們一臂之力！']] },
  ]);
  await giveAssist('angewomon');
}
// 天女獸援護：只能從線索得到
ASSISTS.angewomon = { sp: 'plotmon', name: '天女獸', img: 'Angewomon', move: '神聖之箭', special: true,
  desc: '造成大傷害；打吸血魔王獸的左翼或右臂時直接擊破該部位',
  fx: a => { if (B.parts && B.e !== B.parts.core && B.e.hp > 0) { const d = B.e.hp; B.e.hp = 0; floatText(B.e, `-${d} ✨ 擊破！`, 'crit'); shake(B.e); sfx('crit'); log(`🏹 神聖之箭貫穿了${B.e.name}！`); }
             else assistHit(a, 46); } };

// ---------- 頭目前一層：徽章覺醒 ----------
async function awakenEvent() {
  const k = KIDS[RUN.kid];
  await cutscene([{ bg: 'light', music: 'route', amb: null, sting: true, chars: [['partner', 50, 78, 40, 'in-l']], fx: `<div class="cutCrest" data-from="1">${k.icon}</div><div class="cutRays" style="--rx:50%;--ry:35%"></div>`,
    lines: [[null, '東京鐵塔的方向傳來吸血魔獸壓倒性的氣息……'], ['me', '不管對手多強，我們都要保護這座城市！'], [null, `${k.crest}的徽章回應了這份心意，發出前所未有的光芒——`],
      ['partner', '力量……源源不絕地湧上來了！'], [null, `🔰 <b>徽章完全覺醒</b>：隊長（和徽章的主人）超進化之後，可以花 2 格徽章刻度<b>究極進化</b>！<br>🔰 徽章刻度 +2`]] }]);
  RUN.awaken = true; RUN.crestTicks = (RUN.crestTicks || 0) + 2;
  saveRun(); updateHUD();
}

// ---------- 吸血魔王獸：多部位戰鬥 ----------
const livingParts = () => B.parts ? ['wing', 'core', 'arm'].map(k => B.parts[k]).filter(p => p.hp > 0) : [B.e];
function enterVenom() {
  const v = B.e, M = v.maxhp, sp = SPECIES.venomvamdemon;
  const mk = (key, name, icon, hpm, atkm, spdm, moves, g) => ({ id: 'venomvamdemon', key, sp, name: '吸血魔王獸・' + name, partIcon: icon, img: sp.img, emoji: sp.emoji, attr: sp.attr, lvl: v.lvl + 2,
    maxhp: Math.round(M * hpm), hp: Math.round(M * hpm), atk: Math.round(v.atk * atkm), def: v.def, spd: +(v.spd * spdm).toFixed(1), block: 0, st: {}, gauge: g, moves, boss: true, elite: false, tier: 0, el: v.el });
  B.parts = { wing: mk('wing', '左翼', '🦇', VENOM.side, .55, .85, ['venomwing'], 35),
              core: mk('core', '本體', '💀', VENOM.core, 1.1, 1, ['venominfuse', 'venomclaw', 'roar'], 0),
              arm:  mk('arm', '右臂', '🦴', VENOM.side, .7, .9, ['venomarm', 'venomarm', 'venompush'], 20) };
  Object.values(B.parts).forEach(p => chooseIntent(p));
  B.e = B.parts.core;
  if (B.pend) delete B.pend.moon;
  B.hand.forEach(c => delete c.moon);
  if (!RUN.seen.includes('venomvamdemon')) RUN.seen.push('venomvamdemon');
  $('#eUnit .emo').dataset.k = '';
  banner('吸血魔獸 變身了！'); sfx('wrongevo'); floatText(B.e, '💀 吸血魔王獸！', 'super');
  log('💀 吸血魔獸露出了真面目——吸血魔王獸！身體分成左翼、本體、右臂 3 個部位！');
  battleNotice('💀 吸血魔獸變成了吸血魔王獸！', [
    ['🦇 左翼', '幫本體加護盾、攻擊↑。'], ['💀 本體', '主要攻擊手，<b>打倒本體就贏</b>。'], ['🦴 右臂', '讓夥伴中毒、汙染你的手牌、推慢你的行動條。'],
    ['🎯 選擇目標', '點敵人資訊框下面的<b>部位按鈕</b>切換攻擊目標（預設打本體）。打掉的部位不會長回來；「擴散」卡可以一次打全部部位。'],
    ...(assistList().some(x => x.k === 'angewomon') ? [['🏹 天女獸', '對左翼或右臂用天女獸援護，可以直接擊破那個部位！']] : [])]);
}
// 部位被打倒：換目標；本體倒下才算贏
function partsCheck() {
  if (!B.parts) return;
  for (const p of Object.values(B.parts)) if (p.hp <= 0 && !p.broken) {
    p.broken = true; p.gauge = 0; p.block = 0; p.st = {};
    if (p.key !== 'core') { floatText(p, `💥 ${p.partIcon} 擊破！`, 'super', 40); log(`💥 擊破了${p.name}！`); }
  }
  if (B.e.hp <= 0 && B.parts.core.hp > 0) B.e = livingParts().find(p => p.key === 'core') || B.parts.core;
}
function renderParts() {
  const el = $('#ePanel');
  let row = el.querySelector('.partRow');
  if (!B.parts) { if (row) row.remove(); return; }
  if (!row) { row = document.createElement('div'); row.className = 'partRow'; el.appendChild(row); }
  row.innerHTML = ['wing', 'core', 'arm'].map(k => { const p = B.parts[k], dead = p.hp <= 0;
    const m = MOVES[p.intent], ico = dead ? '✖' : m.kind === 'support' ? '🛡️' : m.kind === 'atk' ? '⚔️' : '💢';
    return `<button class="partBtn${p === B.e ? ' on' : ''}${dead ? ' dead' : ''}" data-k="${k}"><span>${p.partIcon}</span><i style="width:${p.hp / p.maxhp * 100}%"></i><small>${dead ? '擊破' : `${ico}${Math.ceil(p.hp / p.maxhp * 100)}%`}</small></button>`; }).join('');
  row.querySelectorAll('.partBtn').forEach(b => b.onclick = ev => { ev.stopPropagation(); const p = B.parts[b.dataset.k]; if (!p || p.hp <= 0) return; B.e = p; sfx('click'); renderBattle(); });
}
// 敵人行動：部位的特殊招式
function venomAct(e, m) {
  if (m.kind !== 'support') return false;
  const core = B.parts && B.parts.core;
  if (core && core.hp > 0) { gainBlock(core, Math.round(core.maxhp * .05)); addStatus(core, 'atkUp', 2); floatText(core, '🦇 黑暗之翼的加持', 'info', 40); log(`🦇 左翼包覆住本體：本體獲得護盾、攻擊↑`); }
  return true;
}
