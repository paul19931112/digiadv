'use strict';
/* =========================================================
   最終章「黑暗之海・阿波卡利獸」（第三部的最後一章）
   - 5 層，敵人都是「殘影」：之前出現過的數碼寶貝；精英是前任頭目的殘影（不能勸降）
   - 💠 被刪除者的記憶：地圖上收集 3 片（隱藏結局條件之一）
   - 阿波卡利獸三階段（每個階段只用自己的能力，上一階段的效果會消失）
     ① 怨念之手：每次行動借用一個前任頭目的能力（會先預告）
     ② 死亡進化（血量 60%）：戰場時鐘每 3 次預告一次，打出傷害打斷或用護盾擋下
     ③ 大爆炸（血量 30%）：戰場時鐘倒數 3 次 → 回血、出戰夥伴扣 30% 最大 HP、沒有護盾就退化
   ========================================================= */
SPECIES.apocalymon = { name: '阿波卡利獸', img: 'Apocalymon', emoji: '🌑', attr: 'virus', hp: 90, atk: 22, def: 16, spd: 12, moves: ['darknesszone', 'grudgeclaw', 'roar'] };
Object.assign(MOVES, {
  darknesszone: { name: '黑暗地帶', kind: 'atk', power: 7, hits: 3, w: 3 },
  grudgeclaw:   { name: '怨念之爪', kind: 'atk', power: 17, w: 2 },
  deathevo:     { name: '死亡進化', kind: 'deathevo', w: 0 },
  bigbang:      { name: '大爆炸', kind: 'bigbang', w: 0 },
});
CHAPTERS[10] = { title: '最終章　黑暗之海・阿波卡利獸', theme: 'void', floors: 5, lv: [38, 42],
  zone: ['devidramon', 'seadramon', 'mechanorimon', 'bakemon', 'kuwagamon', 'gesomon', 'vademon', 'tyranomon'],
  elites: ['meramon', 'andromon', 'jyureimon', 'devimon', 'etemon', 'metaletemon', 'vamdemon', 'metalseadramon', 'pinochimon', 'mugendramon', 'piemon'],
  boss: { id: 'apocalymon', lv: 45, domain: 'apoca' }, next: 'p3final' };
const APOCA = { p2: .6, p3: .3, devoPct: .06, bang: .3, bangHeal: .1 };

// ---------- 殘影：最終章的敵人（頭目以外） ----------
const _mkShade = makeEnemy;
makeEnemy = (id, lv, opt = {}) => {
  const e = _mkShade(id, lv, opt);
  if (typeof RUN !== 'undefined' && RUN && RUN.chapter === 10 && !opt.boss) { e.shade = true; e.name = '殘影・' + e.sp.name; }
  return e;
};

// ---------- 地圖：碎裂的黑色數據島 ----------
PALETTE.void = { floor: '#2b2140', dot: '#3a2d57', grass: '#3b2a5e', tuft: '#6d4fa8', treeBg: '#1a1028', tree: '#5b21b6', treeHi: '#c084fc', water: '#05010c', wave: '#7c3aed', void: true };
ISL_THEME.void = { top: 0x2e2347, dirt: 0x2a1f3d, rock: 0x1a1028, sky: ['#05010c', '#3b1d5c'], deco: 'void', leaf: 0xa855f7, cloud: 0x3a2a58 };
WALL_PARTS.dcube = () => [new THREE.BoxGeometry(.78, .78, .78).translate(0, .62, 0), 0x6d28d9];
WALL_PARTS.dshard = () => [new THREE.OctahedronGeometry(.42, 0).scale(.8, 1.5, .8).translate(0, .62, 0), 0xc084fc];
function voidMap(T) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) T[y][x] = '.';
  const blob = (ch, n, rmin, rmax) => { for (let k = 0; k < n; k++) { const cx = randInt(2, COLS - 3), cy = randInt(2, ROWS - 3), r = rand(rmin, rmax);
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r + rand(-1, 1)) T[y][x] = ch; } };
  blob(',', randInt(4, 6), 1.4, 3);   // 發紫光的數據地面
  blob('~', randInt(2, 4), 1.2, 2.4);   // 黑色虛空的裂縫
  blob('T', randInt(7, 10), .7, 1.5);   // 碎掉的數據方塊
  blob('R', randInt(3, 5), .5, 1);   // 紫色結晶
}
// 數據方塊（2D）
function drawVoidWall(g, c, px, py, h, t) {
  if (c === 'R') {
    g.fillStyle = PALETTE.void.treeHi; g.beginPath(); g.moveTo(px + 16, py + 3); g.lineTo(px + 25, py + 16); g.lineTo(px + 16, py + 29); g.lineTo(px + 7, py + 16); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(px + 16, py + 3); g.lineTo(px + 19, py + 16); g.lineTo(px + 16, py + 29); g.fill();
    return;
  }
  g.fillStyle = PALETTE.void.tree; g.fillRect(px + 3, py + 3, 26, 26);
  g.strokeStyle = `rgba(192,132,252,${.5 + Math.sin(t * 2 + h) * .25})`; g.lineWidth = 2; g.strokeRect(px + 4, py + 4, 24, 24);
  g.fillStyle = 'rgba(233,213,255,.75)'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(h % 2 ? '01' : '10', px + 16, py + 17);
}

// ---------- 💠 被刪除者的記憶 ----------
const MEMS = [
  { name: '沉睡的數碼蛋', text: '黑暗的海底，有一顆沒能孵化的數碼蛋。蛋殼上有一道被刪除時留下的裂痕。' },
  { name: '斷斷續續的聲音', text: '「為什麼……只有我們被選上刪除？我們也想活下去啊……」' },
  { name: '模糊的影像', text: '很久以前，牠們也曾經在起始之城裡，和其他數碼寶貝一起笑著。' },
];
function placeMemory(nd, place, free) {
  if (RUN.chapter !== 10 || nd.type === 'boss') return;
  const need = 3 - (F().mems || 0), left = (CHAPTERS[10].floors - 1) - nd.f;
  if (need > 0 && (Math.random() < .6 || need >= left)) place({ kind: 'clue', mem: true }, free(6).length ? free(6) : free(3));
}
async function memoryFound() {
  const n = F().mems = (F().mems || 0) + 1, m = MEMS[Math.min(n, 3) - 1];
  sfx('pickup');
  await say(null, `💠 ${m.text}<br><b>被刪除者的記憶 ${n} / 3</b>：${m.name}`);
  if (n === 3) await cutscene([{ bg: 'void', music: null, amb: 'drone', chars: [['partner', 30, 78, 30, 'in-l']], fx: '<div class="cutRays" style="--rx:50%;--ry:30%"></div>',
    lines: [[null, '三片記憶同時亮了起來，在黑暗中拼成一個小小的光點。'], ['partner', '這些數碼寶貝……原本不是壞孩子。'],
      ['me', '如果能用最強的力量打倒牠，也許……可以讓牠們想起來。'],
      [null, '🌈 集滿了 3 片記憶。對阿波卡利獸的<b>最後一擊</b>如果是<b>第二究極技</b>，或是<b>維持進化中的究極體</b>，結局會不一樣。']] }]);
  saveRun(); updateHUD();
}

// ---------- 頭目：阿波卡利獸 ----------
DOMAINS.apoca = { name: '被刪除者的怨念', icon: '🌑', desc: '① 怨念之手：每次行動借用一個前任頭目的能力（會先預告）② 血量 60%：死亡進化 ③ 血量 30%：大爆炸倒數' };
BOSS_INFO.apoca = [
  ['🖐️ 第一階段・怨念之手', '阿波卡利獸每次行動都會借用一個<b>前任頭目的能力</b>（點燃手牌、汙染、安可、夜之帳、操線、漲潮、無限大砲、鑰匙圈……）。下一次要借用哪個，牠的狀態列會先預告。'],
  ['💀 第二階段・死亡進化（血量 60%）', `上一階段的效果全部消失。戰場時鐘每 3 次行動預告一次「死亡進化」：出戰夥伴會被<b>強制退化</b>（沒進化的受到 15% 傷害）。預告後打出最大 HP ${Math.round(APOCA.devoPct * 100)}% 的傷害可以打斷，或是在發動時有<b>護盾</b>就能擋下。`],
  ['💥 第三階段・大爆炸（血量 30%）', `死亡進化停止。戰場時鐘倒數 <b>3 次行動</b>就爆炸一次（一直重複）：阿波卡利獸回復目前血量的 10%（最多回到 30%），出戰夥伴扣<b>最大 HP 30%</b>（會倒下）；沒有護盾的話還會<b>被強制退化</b>。在倒數結束前打倒牠！`],
  ['💡 小技巧', '倒數快結束時先打一張防禦卡，就不會被退化。']];
const APOCA_ARMS = {
  burn:   { icon: '🔥', who: '火焰獸', name: '點燃手牌', fx: (e, P, low) => { P.burn = low ? 2 : 1; } },
  pol:    { icon: '☠️', who: '惡魔獸', name: '汙染手牌', fx: (e, P, low) => { P.pol = low ? 2 : 1; } },
  seed:   { icon: '🌱', who: '樹人獸', name: '種子', fx: e => { if (!e.plant) { e.plant = 2; e.plantClk = (B.clk || 0) + 1; } } },
  gear:   { icon: '⚙️', who: '機械人獸', name: '小齒輪', fx: e => { e.gears = Math.min(2, (e.gears || 0) + 1); } },
  encore: { icon: '🎵', who: '猴子獸', name: '安可', fx: (e, P, low) => { P.encore = low ? 2 : 1; } },
  noise:  { icon: '🔩', who: '機械猴子獸', name: '金屬噪音', fx: (e, P, low) => { P.noise = low ? 2 : 1; } },
  moon:   { icon: '🌙', who: '吸血魔獸', name: '夜之帳', fx: (e, P, low) => { P.moon = low ? 2 : 1; } },
  tide:   { icon: '🌊', who: '鋼鐵海龍獸', name: '漲潮', fx: () => { B.water = Math.min(2, (B.water || 0) + 1); } },
  str:    { icon: '🎭', who: '木偶獸', name: '操線', fx: (e, P) => { P.str = 1; } },
  cannon: { icon: '💥', who: '機械邪龍獸', name: '無限大砲', prep: true },
  key:    { icon: '🃏', who: '小丑皇', name: '鑰匙圈', prep: true, ok: () => B.fighters.some(f => f !== B.p && f.hp > 0 && !f.keychain) },
};
function nextArm(prev) {
  return pick(Object.keys(APOCA_ARMS).filter(k => k !== prev && (!APOCA_ARMS[k].ok || APOCA_ARMS[k].ok())));
}
function setupApoca() {
  const e = B.e;
  e.apPhase = 1; e.apc = 0; e.arm = nextArm();
}
// 每次行動（bossHandAct）：用掉預告的能力，再預告下一個
function apocaArm(e) {
  if (e.apPhase !== 1 || ['cannon', 'keychain', 'deathevo', 'bigbang'].includes(MOVES[e.intent].kind)) return;
  let k = e.arm, a = APOCA_ARMS[k];
  if (a.ok && !a.ok()) { k = 'pol'; a = APOCA_ARMS[k]; }
  floatText(e, `🖐️ ${a.icon} ${a.name}`, 'info', 60);
  log(`🖐️ 怨念之手借用了${a.who}的能力——${a.icon} ${a.name}！`);
  if (a.prep) e.armPrep = k; else a.fx(e, B.pend = B.pend || {}, e.hp <= e.maxhp * .8);
  e.arm = nextArm(k);
}
const apocaArmChip = e => e.apPhase === 1 && e.arm ? `<span class="st">🖐️ 下次借用：${APOCA_ARMS[e.arm].icon} ${APOCA_ARMS[e.arm].who}・${APOCA_ARMS[e.arm].name}</span>` : '';
BOSS_CLOCK.push(
  { on: e => !!e.armPrep, every: 1, at: 0, hide: true,   // 怨念之手借來的大砲／鑰匙圈：預告後下一次行動發動
    prep: e => { if (e.armPrep === 'cannon') cannonPrep(e); else { e.intent = 'keychain'; log(`🃏 怨念之手拿出了一把鑰匙……下一次行動會把後排的夥伴變成鑰匙圈！`); } delete e.armPrep; } },
  { on: e => e.apPhase === 2, n: e => e.apc, every: 3, at: 2, icon: '💀', name: '死亡進化', prep: e => devoPrep(e) },
  { on: e => e.apPhase === 3, n: e => e.apc, every: 3, at: 0, lag: 0, icon: '💥', name: '大爆炸', prep: e => { e.intent = 'bigbang'; } });

// 血量到門檻：換階段（上一階段的效果全部消失）
function apocaPhase() {
  const e = B.e;
  if (B.dom !== 'apoca' || !e.apPhase || e.hp <= 0) return;
  const r = e.hp / e.maxhp, to = r <= APOCA.p3 ? 3 : r <= APOCA.p2 ? 2 : 1;
  if (to <= e.apPhase) return;
  e.apPhase = to; e.apc = 0;
  delete e.spAt; delete e.armPrep; delete e.plant; delete e.arm; e.gears = 0; B.water = 0; B.noiseBlk = 0;
  B.pend = null; B.hand.forEach(clearMarks);
  while (keychains().length) keyFree('怨念之手消失了');
  if (['infinitycannon', 'keychain', 'deathevo'].includes(e.intent)) chooseIntent(e);
  sfx('wrongevo'); shake(e);
  if (to === 2) {
    banner('阿波卡利獸 第二階段！'); floatText(e, '💀 死亡進化！', 'super');
    log('💀 阿波卡利獸的怨念之手消失了……取而代之的是吞噬一切進化的黑暗！');
    battleNotice('💀 阿波卡利獸進入第二階段！', [BOSS_INFO.apoca[1], ['🧹 效果消失', '怨念之手留下的標記、漲潮、小齒輪、鑰匙圈全部消失了。']]);
  } else {
    banner('阿波卡利獸 最終階段！'); floatText(e, '💥 大爆炸倒數！', 'super');
    log('💥 阿波卡利獸開始膨脹……牠要把整個世界一起炸掉！');
    battleNotice('💥 阿波卡利獸進入最終階段！', [BOSS_INFO.apoca[2], BOSS_INFO.apoca[3]]);
  }
  renderBattle();
}

// 死亡進化：預告 → 下一次行動發動
function devoPrep(e) {
  e.intent = 'deathevo'; B.devoBroken = false; B.devoHp = e.hp; B.devoNeed = Math.round(e.maxhp * APOCA.devoPct);
  floatText(e, '💀 死亡進化準備中！', 'super', 40);
  log(`💀 ${e.name} 準備發動「死亡進化」！在牠發動前打出 ${B.devoNeed} 以上的傷害就能打斷，或是用護盾擋下！`);
}
function devoCheck() {
  const e = B.e;
  if (B.dom !== 'apoca' || e.intent !== 'deathevo' || B.devoBroken || e.hp <= 0) return;
  if (B.devoHp - e.hp >= B.devoNeed) { B.devoBroken = true; floatText(e, '🛑 死亡進化打斷！', 'super', 40); log('🛑 打斷了死亡進化！'); sfx('crit'); }
}
const devoText = () => B.devoBroken ? '💀 （死亡進化已經打斷）' : `💀 死亡進化（再打 ${Math.max(0, B.devoNeed - (B.devoHp - B.e.hp))} 傷害打斷，或用護盾擋下）`;
function devoFire(e, p) {
  if (!B.devoBroken && B.devoHp - e.hp >= B.devoNeed) B.devoBroken = true;
  if (B.devoBroken) { floatText(e, '💨 黑暗散開了…', 'info'); log('💨 死亡進化被打斷，只剩下一陣黑色的風！'); applyHit(e, p, 10); return; }
  const shield = p.block > 0;
  applyHit(e, p, 14);
  if (shield) { floatText(p, '🛡️ 擋下了死亡進化！', 'heal', 40); log(`🛡️ 護盾擋住了死亡進化！${p.name} 沒有退化`); return; }
  if (p.hp <= 0) return;
  if (p.tier > 0) { const was = p.name; devolve(true, p); floatText(p, '💀 強制退化！', 'super'); shake(p); sfx('wrongevo'); log(`💀 死亡進化！${was} 被強制退化成 ${p.name}！`); }
  else { const d = Math.round(p.maxhp * .15); p.hp = Math.max(0, p.hp - d); floatText(p, `-${d} 💀`, 'crit'); shake(p); log(`💀 死亡進化的黑暗吞噬了 ${p.name}（${d} 傷害）！`); }
}
// 大爆炸：回血、出戰夥伴扣 30% 最大 HP、沒有護盾就退化
function bangFire(e, p) {
  const cap = Math.round(e.maxhp * APOCA.p3), heal = Math.min(Math.round(e.hp * APOCA.bangHeal), Math.max(0, cap - e.hp));
  if (heal > 0) healF(e, heal, true);
  const d = Math.round(p.maxhp * APOCA.bang), shield = p.block > 0;
  p.hp = Math.max(0, p.hp - d); p.block = 0;
  floatText(p, `-${d} 💥`, 'crit'); shake(p); shake(e); sfx('crit');
  log(`💥💥 大爆炸！${e.name} 回復了 ${heal} HP，${p.name} 受到 ${d} 點傷害！`);
  if (p.hp > 0 && p.tier > 0) {
    if (shield) { floatText(p, '🛡️ 護盾撐住了進化！', 'heal', 40); log('🛡️ 護盾被炸碎了，但進化撐住了！'); }
    else { const was = p.name; devolve(true, p); floatText(p, '💥 強制退化！', 'super', 40); log(`💥 ${was} 被炸到退化成 ${p.name}！`); }
  }
}

// ---------- 第九章 → 最終章 ----------
async function part3ChapterDone() {
  G.mode = 'busy';
  await cutscene([
    { bg: 'stage', music: 'route', amb: null, chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '小丑皇被打倒了……！鑰匙圈全部變回來了！'], [null, '螺旋山開始崩塌。四天王都倒下了——但黑暗還沒有消失。']] },
    { bg: 'void', music: null, amb: 'drone', chars: [['Apocalymon', 50, 78, 56, 'dark']], lines: [['shadow', '……為什麼……只有我們……被刪除……'], ['shadow', '沒能進化的……沒能活下去的……我們的怨念……'], ['shadow', '我要把這個世界……也一起刪除！']] },
    { bg: 'void', music: 'route', amb: 'drone', chars: [['partner', 30, 78, 30, 'in-l']], lines: [[null, '崩塌的螺旋山底下，是一片無邊無際的黑色海洋。碎掉的數據像島嶼一樣浮在上面。'],
      ['partner', '那些敵人……是我們以前打倒過的數碼寶貝的殘影！'],
      [null, '💠 黑暗之海裡散落著<b>被刪除者的記憶</b>。收集 3 片，也許能看到不一樣的結局。']] },
  ]);
  startChapter(10);
  saveRun();
  await chapterCard(CHAPTERS[10].title, '全隊回復了 50% HP｜穿越黑暗之海，打倒阿波卡利獸！');
  showRoute();
}
BOSS_LINES[10] = () => cutscene([bossScene('void', 'drone', 'Apocalymon', [['apocalymon', '被選召的孩子……你們有被選上的幸運。'], ['apocalymon', '我們卻連進化的機會都沒有，就被刪除了！'],
  ['apocalymon', '我會用四天王、用所有被你們打倒的傢伙的力量——把你們也一起刪除！'], ['partner', '不管你借了誰的力量，我們都不會輸！'],
  [null, '🖐️ 第一階段會借用前任頭目的能力；💀 血量 60% 開始死亡進化；💥 血量 30% 開始大爆炸倒數。']])]);

// ---------- 結局 ----------
const ENDINGS3 = {
  light3:  { name: '最終結局「再會了，數碼世界」', icon: '🌅' },
  hidden3: { name: '隱藏結局「重生的起始之城」', icon: '🌈' },
};
const part3EndingKind = () => (F().mems || 0) >= 3 && RUN.flags.p3finish === 'holy' ? 'hidden3' : 'light3';
async function finalChapterDone() {
  G.mode = 'busy';
  const kind = part3EndingKind(), E = ENDINGS3[kind];
  const last = kind === 'hidden3' ? [
    { bg: 'void', music: null, amb: 'drone', chars: [['Apocalymon', 50, 78, 54, 'dark']], fx: '<div class="cutRays" style="--rx:50%;--ry:30%"></div>',
      lines: [[null, '最後一擊的光芒，照亮了三片記憶。'], ['apocalymon', '這是……我們……以前的樣子……？'], ['partner', '你們不是被丟掉的數據。你們也是數碼世界的一部分！']] },
    { bg: 'light', music: 'route', amb: null, sting: true, chars: [['partner', 30, 78, 30, 'in-l']], fx: '<div class="cutRays" style="--rx:50%;--ry:30%"></div>',
      lines: [[null, '阿波卡利獸的身體化成無數的光點，飄向遠方的起始之城。'], [null, '那一天，起始之城多了好多好多新的數碼蛋。'],
        ['apocalymon', '……原來……我們也能……重新開始……'], [null, `🌈 <b>${E.name}</b>`]] },
  ] : [
    { bg: 'void', music: null, amb: 'drone', chars: [['Apocalymon', 50, 78, 54, 'dark']],
      lines: [['apocalymon', '不……我不會一個人消失……！大家……一起……'], [null, '阿波卡利獸的身體開始膨脹——孩子們的數碼裝置同時發出了光芒，把爆炸緊緊包了起來。'],
        [null, '光芒散去，黑暗之海也跟著消失了。']] },
  ];
  await cutscene([
    ...last,
    { bg: 'light', music: 'route', amb: null, chars: [['partner', 30, 78, 32, 'in-l']], lines: [[null, '數碼世界恢復了原本的樣子。天空是藍的，海是清的。'],
      ['partner', '我們……真的做到了！'], [null, '可是，光之門已經打開了。孩子們必須回到自己的世界。']] },
    { bg: 'sea', music: 'route', amb: 'waves', chars: [['partner', 30, 78, 32, 'in-l']], lines: [['partner', '……要回去了嗎？'], ['me', '嗯。不過我們一定會再見面的！'],
      ['partner', '一定喔！我會一直在這裡等你！'], [null, kind === 'hidden3' ? '🌈 冒險完結。謝謝你一路玩到最後！' : `🌅 <b>${E.name}</b>　冒險完結。謝謝你一路玩到最後！`]] },
  ]);
  META.p3ch = Math.max(META.p3ch || 0, 10); META.p3clear = (META.p3clear || 0) + 1; META.clears++;
  META.endings3 = [...new Set([...(META.endings3 || []), kind])];
  recordDex(); saveMeta(); clearRun();
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><div style="font-size:70px">${E.icon}</div><h1>冒險完結！</h1><p>${E.name}</p>
    <div class="endTeam">${RUN.team.map(m => spPic(m.sp, 's80')).join('')}</div>
    <p>擊敗 ${RUN.stats.wins} 隻敵人　｜　學會第二究極技 ${(RUN.learned2 || []).length} 招　｜　被刪除者的記憶 ${Math.min(3, F().mems || 0)} / 3</p>
    ${kind === 'hidden3' ? '' : '<p><small>💡 集滿 3 片記憶，再用第二究極技或維持進化中的究極體打出最後一擊，結局會不一樣喔</small></p>'}
    <button class="btn primary big" id="p3Back">回到標題</button></div>`;
  o.classList.remove('hidden');
  await new Promise(r => o.querySelector('#p3Back').onclick = r);
  o.classList.add('hidden');
  showTitle();
}
