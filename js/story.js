'use strict';
/* =========================================================
   劇情：開場、事件、頭目、章節轉換、結局
   想新增事件：在 EVENTS 加一筆 { ch: [出現的章節], npc: 頭像, run: async () => {...} }
   ========================================================= */

SPECIES.angemon_npc = { name: '天使獸', img: 'Angemon', emoji: '👼' };
SPECIES.devimon_voice = { name: '？？？', img: 'Devimon', emoji: '😈' };

// ---------- 事件小工具 ----------
const F = () => RUN.flags;
function teamDamage(p) { RUN.team.forEach(m => m.hp = Math.max(1, m.hp - Math.round(memberStats(m).maxhp * p))); }
function teamHeal(p) { RUN.team.forEach(m => m.hp = Math.min(memberStats(m).maxhp, m.hp + healAmt(memberStats(m).maxhp * p))); }
function addFlag(k, n = 1) { F()[k] = (F()[k] || 0) + n; }
async function giveCard(id, text) { if (!(await acquireCard(id))) return; await say(null, `${text || '獲得卡片'}：<b>「${cardDef(id).name}」</b>`); }
async function giveRelic(k) { if (!k || has(k)) return; RUN.relics.push(k); await say(null, `獲得 <b>${RELICS[k].icon} ${RELICS[k].name}</b>：${RELICS[k].desc}`); }
async function upgradeCards(n) {
  for (let i = 0; i < n; i++) {
    const x = await chooseCardFromDeck(`選一張卡片強化（${i + 1}/${n}）`, canUpgrade);
    if (!x) break; RUN.deck[x.i] = x.id + '+';
  }
}
async function eventBattle(id, lv, opt = {}) {
  const res = await runBattle(id, lv, { noFlee: true, ...opt });
  backToArea();
  return res;
}
const curLv = () => nodeLevel(RUN.pos ? RUN.pos.f : 0);

function pickEvent() {
  const pool = Object.keys(EVENTS).filter(id => EVENTS[id].ch.includes(RUN.chapter) && !RUN.usedEvents.includes(id) && (!EVENTS[id].cond || EVENTS[id].cond()));
  if (!pool.length) return null;
  const id = pick(pool);
  RUN.usedEvents.push(id);
  return { id, npc: EVENTS[id].npc };
}
async function runEvent(id) { await EVENTS[id].run(); }

// =========================================================
//   事件
// =========================================================
const EVENTS = {
  // ----- 第一章 -----
  leomon: { ch: [1], npc: 'leomon', run: async () => {
    await say(null, '草叢裡傳來痛苦的低吼聲…一隻獅子獸倒在地上，身上冒著黑色的煙。');
    await say('leomon', '唔…是黑色齒輪…我被惡魔獸的手下偷襲了…');
    await say('partner', '牠傷得好重！我們幫幫牠吧！');
    const c = await ask(null, '要怎麼做？', [
      { text: '分一些力量給牠', note: '全隊失去 20% HP' },
      { text: '鼓起勇氣，把黑色齒輪拔出來', note: '消耗勇氣值 25', disabled: RUN.courage < 25 },
      { text: '對不起，我們得趕路', note: '勇氣值 +10' },
    ]);
    if (c === 2) { gainCourage(10); await say('leomon', '…去吧，孩子們。別在意我。'); return; }
    if (c === 0) teamDamage(.2); else { RUN.courage -= 25; addFlag('light'); }
    F().leomon = true; addFlag('saved');
    await say('leomon', '力量…回來了！謝謝你們，被選召的孩子。');
    await say('leomon', '這份恩情，我獅子獸一定會報答。在你們最需要的時候，我會趕到！');
    await giveCard(c === 1 ? 'beastking+' : 'beastking', '獅子獸傳授了拳法');
  } },

  gear: { ch: [1, 'city', 'forest'], npc: 'gottsumon', run: async () => {
    await say('gottsumon', '嘿嘿…你們看，我撿到一個黑漆漆的齒輪。拿著它，全身都充滿了力量…');
    await say('partner', '那是黑色齒輪！再拿下去會被控制的！');
    const c = await ask('gottsumon', '可、可是…這力量好舒服喔…你們想要嗎？', [
      { text: '把齒輪砸碎！', note: '勇氣值 +20' },
      { text: '收下黑色齒輪', note: '全隊攻擊 ×1.25，但每回合扣血、進化容易失控；帶著它到最後會走向黑暗結局' },
      { text: '勸牠丟掉就離開', note: '' },
    ]);
    if (c === 0) { gainCourage(20); addFlag('light'); await say('gottsumon', '啊…頭腦突然變清醒了。謝謝你們！'); }
    else if (c === 1) { addFlag('dark'); await giveRelic('darkgear'); await say('partner', '……你確定要帶著那個東西嗎？'); }
    else await say('gottsumon', '好啦好啦，我會丟掉的…大概吧。');
  } },

  numemon: { ch: [1, 'forest'], npc: 'numemon', run: async () => {
    await say('numemon', '肚子好餓～～有沒有好吃的～～給我們一點數碼幣嘛～～');
    const c = await ask(null, '一群蛞蝓獸圍了過來…', [
      { text: '分給牠們 30 數碼幣', disabled: RUN.bits < 30 },
      { text: '才不要！', note: '牠們可能會生氣…' },
      { text: '趁牠們不注意溜走' },
    ]);
    if (c === 0) {
      RUN.bits -= 30;
      await say('numemon', '哇～你是好人！這個送你，是我們撿到的寶物！');
      if (Math.random() < .5 && relicPool().length) await giveRelic(pick(relicPool()));
      else await giveCard(pick(['scan+', 'haste+', 'drain+', 'rush+']), '蛞蝓獸送了一張卡');
    } else if (c === 1) {
      await say('numemon', '小氣鬼～～看我們的便便攻擊！');
      await eventBattle('numemon', curLv() + 1);
    } else await say(null, '你們躡手躡腳地離開了。身後傳來「好餓喔～」的聲音。');
  } },

  jijimon: { ch: [1], npc: 'jijimon', run: async () => {
    await say('jijimon', '喔喔，是你們啊。冒險還順利嗎？');
    await say('jijimon', '惡魔獸躲在島中央的無限山上，用黑色齒輪操控著大家。要打倒牠，你們得變得更強才行。');
    const c = await ask('jijimon', '老夫這裡有三樣東西，挑一樣帶走吧。', [
      { text: '數碼蛋', note: '孵出一隻新夥伴' },
      { text: '古老的徽章', note: '隨機獲得一個徽章道具' },
      { text: '長老的特訓', note: '強化 2 張卡片' },
    ]);
    if (c === 0) await hatchEgg();
    else if (c === 1) await giveRelic(pick(relicPool()));
    else await upgradeCards(2);
    await say('jijimon', '去吧！相信你的夥伴，也相信你自己的勇氣！');
  } },

  unimon: { ch: [1, 3], npc: 'unimon', run: async () => {
    await say('unimon', '站住！想通過這裡，先讓我看看你們的實力！');
    const c = await ask(null, '獨角獸擺出了戰鬥姿態。', [
      { text: '接受挑戰！', note: '打贏可以選一個徽章道具' },
      { text: '我們不想打架', note: '' },
    ]);
    if (c === 1) { await say('unimon', '哼，膽小鬼。'); return; }
    await eventBattle('unimon', curLv() + 1, { noRecruit: true });
    await say('unimon', '了不起！你們的勇氣是真的。帶上這個吧！');
    const items = shuffle(relicPool()).slice(0, 2);
    const k = await pickScreen({ title: '獨角獸的謝禮', sub: '選一個徽章道具', items, render: k => relicEl(k) });
    if (k) RUN.relics.push(k);
  } },

  gekomon: { ch: [1, 'city'], npc: 'gekomon', run: async () => {
    await say('gekomon', '呱～今天是青蛙獸的音樂會！要一起來嗎？');
    const c = await ask(null, '悠揚的號角聲響起…', [
      { text: '坐下來好好聽', note: '全隊回復 35% HP' },
      { text: '一起大聲唱！', note: '勇氣值 +25' },
    ]);
    if (c === 0) { teamHeal(.35); await say(null, '溫柔的音樂讓大家的傷都好了。'); }
    else { gainCourage(25); await say('partner', '♪～啦啦啦！唱完覺得渾身是勁！'); }
  } },

  // ----- 第二章：齒輪城市 -----
  guardromon: { ch: ['city'], npc: 'guardromon', run: async () => {
    await say('guardromon', '救…救命…我被暴走的齒輪獸們困住了…');
    await say('partner', '那邊有好多被黑色齒輪控制的齒輪獸！');
    const c = await ask(null, '要怎麼辦？', [
      { text: '衝進去救牠！', note: '戰鬥' },
      { text: '我們打不過，先離開', note: '' },
    ]);
    if (c === 1) { await say('guardromon', '嗚嗚…'); return; }
    await eventBattle('hagurumon', curLv() + 1, { elite: true, noRecruit: true });
    addFlag('saved');
    await say('guardromon', '得救了！謝謝你們！這是守衛獸的防禦秘訣！');
    await giveCard('wall+', '守衛獸教你');
  } },

  factory: { ch: ['city'], npc: 'hagurumon', run: async () => {
    await say(null, '巨大的工廠正在不停地製造黑色齒輪，轟隆隆的聲音震耳欲聾。');
    const c = await ask('partner', '怎麼辦？', [
      { text: '冒險關掉電源', note: '全隊失去 15% HP，數碼幣 +70' },
      { text: '拆走一些零件', note: '數碼幣 +40' },
      { text: '悄悄地穿過去' },
    ]);
    if (c === 0) { teamDamage(.15); gainBits(70); addFlag('light'); await say(null, '電源被切斷了！工廠停止運轉，地上散落著數碼幣。'); }
    else if (c === 1) { gainBits(40); await say(null, '你們撿了一些零件拿去換錢。'); }
    else await say(null, '你們屏住呼吸，從輸送帶旁邊溜了過去。');
  } },

  etemon: { ch: ['city', 3], npc: 'etemon', run: async () => {
    await say('etemon', '耶～我是天下無敵的超級巨星猴子獸！今天開個人演唱會，所有人都要聽！');
    const c = await ask(null, '猴子獸拿著麥克風擋住了路…', [
      { text: '付 50 數碼幣請牠讓開', disabled: RUN.bits < 50 },
      { text: '把演唱會砸了！', note: '和猴子獸戰鬥' },
      { text: '忍耐聽完', note: '全隊失去 10% HP，勇氣值 +15' },
    ]);
    if (c === 0) { RUN.bits -= 50; await say('etemon', '算你識相～下次記得買門票！'); }
    else if (c === 1) { await eventBattle('etemon', curLv(), { elite: true }); gainBits(60); await say(null, '猴子獸逃跑時掉了 💰 60 數碼幣！'); }
    else { teamDamage(.1); gainCourage(15); await say('partner', '耳朵好痛…不過撐過來了，覺得什麼都不怕了！'); }
  } },

  // ----- 第二章：迷霧森林 -----
  woodmon: { ch: ['forest'], npc: 'woodmon', run: async () => {
    await say(null, '濃霧裡傳來奇怪的聲音：「過來…過來…」');
    const c = await ask('partner', '要跟著聲音走嗎？', [
      { text: '跟過去看看', note: '…' },
      { text: '摀住耳朵', note: '勇氣值 +15' },
      { text: '大聲回應：「是誰？」' },
    ]);
    if (c === 0) {
      await say('woodmon', '嘿嘿嘿…上當了吧！');
      await eventBattle('woodmon', curLv() + 1, { elite: true, noRecruit: true });
      gainBits(50); await say(null, '打倒了樹木獸！樹洞裡藏著 💰 50 數碼幣。');
    } else if (c === 1) { gainCourage(15); await say(null, '聲音漸漸遠去了。'); }
    else {
      await say('mushmon', '嗚嗚…終於有人回應了…我迷路好久了…');
      if (RUN.team.length < teamMax()) { RUN.team.push(newMember('mushmon', curLv())); preloadLine('mushmon'); await say(null, '迷路的蘑菇獸加入了隊伍！'); }
      else { gainBits(40); await say(null, '蘑菇獸送你 💰 40 數碼幣當謝禮。'); }
      addFlag('saved');
    }
  } },

  mushroom: { ch: ['forest'], npc: 'mushmon', run: async () => {
    await say(null, '路邊長著一圈發出七彩光芒的蘑菇…');
    const c = await ask('partner', '看起來好好吃…', [
      { text: '吃吃看！', note: '可能是好事，也可能是壞事' },
      { text: '採下來拿去賣', note: '數碼幣 +45' },
    ]);
    if (c === 1) { gainBits(45); return; }
    if (Math.random() < .55) { teamHeal(.5); gainCourage(10); await say('partner', '好好吃！全身都暖起來了！（全隊回復 50% HP）'); }
    else { teamDamage(.15); gainCourage(20); await say('partner', '嗚哇…肚子好痛…可是，好像變得更有膽量了？（全隊失去 15% HP，勇氣值 +20）'); }
  } },

  shellmon: { ch: ['forest', 3], npc: 'shellmon', run: async () => {
    await say('shellmon', '這個泉水是我的！誰都不准靠近！');
    const c = await ask(null, '貝殼獸霸佔了回復泉。', [
      { text: '把泉水搶回來！', note: '戰鬥，贏了全隊回復 50% HP' },
      { text: '算了，繞路吧' },
    ]);
    if (c === 1) return;
    await eventBattle('shellmon', curLv());
    teamHeal(.5);
    await say(null, '貝殼獸逃走了。你們在泉水邊好好休息了一下。（全隊回復 50% HP）');
  } },

  // ----- 第三章 -----
  // ----- 拯救事件（v11.1）：第二章兩條路各一個 -----
  elecmonTrap: { ch: ['city'], npc: 'elecmon', run: async () => {
    await say(null, '巷子深處劈哩啪啦地閃著火花——一隻電擊獸被暴走的電網困住了！');
    await say('elecmon', '好、好痛…！電網一直在放電，我出不去…！');
    await say('partner', '那個電網是被黑色齒輪控制的！我們得想辦法！');
    const c = await ask(null, '要怎麼做？', [
      { text: '衝過去把牠拉出來！', note: '全隊受到 15% 傷害' },
      { text: '鼓起勇氣，打斷電網', note: '消耗勇氣值 20', disabled: RUN.courage < 20 },
      { text: '太危險了，先離開', note: '勇氣值 +10' },
    ]);
    if (c === 2) { gainCourage(10); await say('elecmon', '…嗚嗚，好吧…'); return; }
    if (c === 0) teamDamage(.15); else { RUN.courage -= 20; addFlag('light'); }
    addFlag('saved');
    await say('elecmon', '得救了！電網終於停下來了…謝謝你們！這個送給你們！');
    await addItem(pick(RANDOM_ITEMS));
  } },
  vineCry: { ch: ['forest'], npc: 'gekomon', run: async () => {
    await say(null, '濃霧裡傳來斷斷續續的哭聲…這次不是「過來…過來…」，而是真的在求救。');
    await say('gekomon', '救命呀～！藤蔓越纏越緊了…！有沒有人…！');
    await say('partner', '是被黑暗藤蔓纏住的數碼寶貝！旁邊還有被控制的蘑菇獸守著！');
    const c = await ask(null, '要怎麼救牠？', [
      { text: '打倒守衛，砍斷藤蔓！', note: '戰鬥' },
      { text: '用勇氣的火焰燒斷藤蔓', note: '消耗勇氣值 20', disabled: RUN.courage < 20 },
      { text: '霧太濃了，先離開', note: '' },
    ]);
    if (c === 2) { await say(null, '哭聲漸漸被霧吞沒了…'); return; }
    if (c === 0) await eventBattle('mushmon', curLv() + 1, { elite: true, noRecruit: true });
    else { RUN.courage -= 20; addFlag('light'); }
    addFlag('saved');
    await say('gekomon', '呱呱！得救了！森林裡的數碼寶貝教我的招式，送給你們！');
    await giveCard(pick(['tender', 'prepare', 'heal']), '青蛙獸教你');
  } },
  darkness: { ch: [3], npc: 'devimon_voice', cond: () => (F().dark || 0) >= 1, run: async () => {
    await say(null, '四周突然暗了下來。一個低沉的聲音在腦中響起…');
    await say('devimon_voice', '你身上…有黑色齒輪的味道。你也渴望力量吧？');
    await say('devimon_voice', '接受黑暗吧。我可以讓你的夥伴，輕易得到究極的力量…');
    const c = await ask('partner', '不要聽牠的！我們靠自己的力量就夠了！', [
      { text: '接受黑暗之力', note: '進化消耗 -30%、攻擊 ×1.2……但進化容易失控；帶著它到最後會走向黑暗結局' },
      { text: '拒絕！我相信夥伴！', note: '勇氣值 +30' },
    ]);
    if (c === 0) { F().darkAccepted = true; addFlag('dark', 2); await giveRelic('darkpower'); await say('partner', '…你的眼神，好像變得有點可怕…'); }
    else { gainCourage(30); addFlag('light'); await say('devimon_voice', '哼…愚蠢。那就在山頂等著你們吧。'); await say('partner', '這才是我認識的你！'); }
  } },

  angel: { ch: [3], npc: 'angemon_npc', cond: () => !(F().dark >= 1), run: async () => {
    await say(null, '一道溫暖的光從天而降。');
    await say('angemon_npc', '被選召的孩子，你一路上守護了光明，沒有被黑暗動搖。');
    await say('angemon_npc', '這是給你的祝福。最後的戰鬥，就拜託你了。');
    if (P1()) {   // 第一部沒有徽章：天使獸答應來援護
      teamHeal(1); await say(null, '全隊 HP 全滿了！');
      if (assistPool().includes('angemon')) { await say('angemon_npc', '最後的戰鬥，我也會助你一臂之力。'); await giveAssist('angemon'); }
    } else if (!has('hope') && !F().hopeUsed) await giveRelic('hope'); else { teamHeal(1); await say(null, '全隊 HP 全滿了！'); }
  } },

  friends: { ch: [3], npc: 'jijimon', run: async () => {
    await say(null, '夜晚，大家圍著營火休息。明天就要攻上山頂了。');
    await say('partner', '欸…謝謝你一直陪著我。不管惡魔獸有多強，只要和你在一起，我就不怕！');
    const c = await ask(null, '要怎麼度過這個夜晚？', [
      { text: '好好睡一覺', note: '全隊 HP 全滿' },
      { text: '一起特訓到天亮', note: '強化 2 張卡片' },
      { text: '聊聊一路上的回憶', note: '獲得「夥伴的羈絆」卡' },
    ]);
    if (c === 0) teamHeal(1);
    else if (c === 1) await upgradeCards(2);
    else await giveCard('friend', '大家的心連在一起了');
  } },
};

// =========================================================
//   開場 / 頭目 / 章節轉換
// =========================================================
async function prologue() {
  const name = SPECIES[RUN.team[0].sp].name;
  await cutscene([
    { bg: 'aurora', music: 'route', lines: [[null, '某個夏天，天空突然出現了極光…'], [null, '一台奇怪的裝置從天而降。回過神來，你已經站在一座陌生的島嶼上。']] },
    { bg: 'island', music: 'field', amb: 'waves', chars: [['Jijimon', 40, 74, 32, 'in-l']],
      lines: [['jijimon', '歡迎來到數碼世界，被選召的孩子。老夫是長老獸。'], ['jijimon', '邪惡的惡魔獸用「黑色齒輪」控制了島上的數碼寶貝，整個檔案島正被黑暗吞噬…']] },
    { bg: 'burst', amb: null, sting: true, chars: [['partner', 50, 76, 46, 'in-l']], fx: '<div class="cutSpeed"></div>',
      lines: [['me', KIDS[RUN.kid].line], ['partner', `${KIDS[RUN.kid].nick}！我是${name}！我一直在等你！我們一起去打倒惡魔獸吧！`]] },
    { bg: 'island', amb: 'waves', chars: [['Jijimon', 26, 74, 30], ['partner', 72, 76, 32, 'flip']],
      lines: [['jijimon', '記住，數碼寶貝的進化，來自你的「勇氣」。不斷前進、勇敢戰鬥，夥伴就會變得更強！']] },
  ]);
}

async function chapterCard(title, sub) {
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><h1>${title}</h1><p>${sub}</p><button class="btn primary big" id="ccGo">出發！</button></div>`;
  o.classList.remove('hidden');
  await new Promise(r => o.querySelector('#ccGo').onclick = r);
  o.classList.add('hidden');
}

// 頭目登場：插畫（頭目在右、夥伴在左）
const bossScene = (bg, amb, img, lines) => ({ bg, music: 'boss', amb, chars: [[img, 64, 76, 50, 'in-r'], ['partner', 20, 78, 26, 'in-l']], lines });
const BOSS_LINES = {
  1: () => cutscene([bossScene('volcano', 'fire', 'Meramon', [['meramon', '好燙…好痛苦…！全部燒光！燒光！'], ['partner', '是火焰獸！牠背上插著黑色齒輪！打倒牠就能把齒輪弄掉！']])]),
  city: () => cutscene([bossScene('city', null, 'Andromon', [['andromon', '偵測到入侵者。執行排除程序。'], ['partner', '機械人獸的身體裡有黑色齒輪在轉動！我們要救牠！']])]),
  forest: () => cutscene([bossScene('forest', 'wind', 'Jyureimon', [['jyureimon', '呵呵呵…踏進這座森林的人，誰都別想出去…'], ['partner', '就是牠製造了迷霧！大家一起上！']])]),
  4: () => cutscene([bossScene('stage', 'crowd', 'Etemon', [['etemon', 'Yeah～！歡迎來到本大爺的黑暗演唱會！'], ['etemon', '聽完我的「愛之小夜曲」，你們就會乖乖變成我的歌迷啦～'], ['partner', '別被歌聲迷住了！要在他唱之前打斷他！']])]),
  5: () => cutscene([bossScene('pyramid', 'drone', 'Metal_Etemon', [['metaletemon', 'Yeah～～！本大爺用黑色齒輪改造了身體——現在是無敵的「機械猴子獸」啦！'],
    ...(hacked().length ? [['partner', `終端機駭進去了 ${hacked().length} 台！他的${hacked().map(k => METAL_ABIL[k].name).join('、')}已經不能用了！`]] : [['partner', '他的能力全都還在……要小心！']]),
    ['partner', '還有那個金屬噪音……被標記的卡要記得打出去！']])]),
  6: () => cutscene([bossScene('tokyo', 'drone', 'Vamdemon', [['vamdemon', '呵呵呵……被選召的孩子們，你們終於來了。'], ['vamdemon', '第 8 個孩子？無所謂——這座城市的光，今晚就由我來熄滅！'],
    ['partner', '吸血魔獸……我們絕對不會讓你得逞！'], ...(RUN.awaken ? [['partner', '徽章完全覺醒了——這次可以究極進化！']] : [])])]),
  7: () => cutscene([{ bg: 'sea', music: 'boss', amb: 'waves', chars: [['Metal_Seadramon', 70, 76, 48, 'in-r'], ['Pinochimon', 36, 78, 36, 'in-l']],
    lines: [['metalseadramon', '哼，被選召的孩子們。這片海就是你們的墳墓！'], ['pinochimon', '嘻嘻嘻～一起來玩吧！你們全部都是我的玩具！'],
      ['partner', '兩個一起來嗎……！要想清楚先打哪一隻！'], [null, '🌊 打出防禦／回復卡可以讓潮水退去；🎭 被操控的卡要多花 1 能量剪斷操線。']] }]),
  8: () => cutscene([bossScene('city', 'drone', 'Mugendramon', [['mugendramon', '偵測到被選召的孩子。威脅等級：最高。'], ['mugendramon', '啟動……無限大砲。'],
    ['partner', '那門大砲集氣的時候，一定要打斷它！']])]),
  9: () => cutscene([bossScene('stage', 'crowd', 'Piemon', [['piemon', '歡迎光臨，被選召的孩子們。今晚的表演由我——小丑皇來主持。'], ['piemon', '最後一個節目：把你們全部變成可愛的鑰匙圈。'],
    ['partner', '後排的夥伴會被變成鑰匙圈……打出足夠的傷害就能救回來！']])]),
  3: async () => {
    const scenes = [bossScene('castle', 'drone', 'Devimon', [['devimon', '哼哼哼…被選召的孩子，竟然能走到這裡。不過，你們的冒險就到此為止了！'], ['partner', '惡魔獸！我們絕對不會輸給你！']])];
    if (F().leomon) scenes.push({ bg: 'burst', amb: null, sting: true, chars: [['Leomon', 50, 76, 48, 'in-l']], fx: '<div class="cutSpeed"></div>',
      lines: [['leomon', '等等！我來報恩了！——獸王拳！！'], [null, '獅子獸的拳頭重重打在惡魔獸身上！（惡魔獸的 HP 減少 25%）']] });
    await cutscene(scenes);
    if (F().leomon) { const b = AREA.objs.find(o => o.role === 'boss'); if (b) b.opt = { preDamage: .25 }; }
  },
};
async function bossIntro() { G.mode = 'busy'; await BOSS_LINES[RUN.chapter](); backToArea(); }

async function bossDefeated() {
  if (RUN.chapter === 1) { addFlag('saved'); await say('meramon', '我…我怎麼了？…是你們救了我嗎？謝謝你們！'); }
  else if (RUN.chapter === 'city') { addFlag('saved'); await say('andromon', '系統…恢復正常。被選召的孩子，感謝你。這份資料給你。'); await giveRelic(pick(relicPool())); }
  else if (RUN.chapter === 'forest') { addFlag('saved'); await say('jyureimon', '迷霧…散去了…原來森林的陽光這麼溫暖…'); teamHeal(.5); }
  else if (RUN.chapter === 5) await say('metaletemon', '不、不可能……本大爺的鋼鐵身體……！');
  else if (RUN.chapter === 10) await say(null, '阿波卡利獸的身體裂開了，無數的數據碎片從裂縫裡湧了出來——');
  else if (RUN.chapter === 9) await say(null, '小丑皇的面具裂開了——所有的鑰匙圈都變回了數碼寶貝！');
  else if (RUN.chapter === 8) await say(null, '機械邪龍獸的眼睛閃了幾下，轟的一聲倒下——工廠安靜了下來。');
  else if (RUN.chapter === 6) await say(null, '吸血魔王獸發出最後的咆哮，化成無數的蝙蝠，消散在晨光裡——');
}

async function chapterComplete() {
  G.mode = 'busy';
  teamHeal(.5);
  if (RUN.chapter === 1) {
    unlockStarter('patamon');
    unlockKid('mimi');
    await cutscene([{ bg: 'island', music: 'field', amb: 'waves', chars: [['Jijimon', 30, 74, 32, 'in-l'], ['partner', 72, 76, 30, 'flip']],
      lines: [['jijimon', '你們打倒了火焰獸！太了不起了！'], ['jijimon', '前面有兩條路通往無限山。一條是到處都是機械的「齒輪城市」，一條是被迷霧籠罩的「迷霧森林」。']] }]);
    const c = await ask('partner', '要走哪一條路？', [
      { text: '⚙️ 齒輪城市', note: '機械系的敵人，頭目：機械人獸' },
      { text: '🌲 迷霧森林', note: '植物和毒系的敵人，頭目：樹人獸' },
    ]);
    startChapter(c === 0 ? 'city' : 'forest');
  } else if (RUN.chapter === 'city' || RUN.chapter === 'forest') {
    unlockStarter('gomamon');
    unlockKid('jou');
    await cutscene([{ bg: 'castle', music: 'route', amb: 'wind', chars: [['partner', 28, 78, 32, 'in-l']], lines: [['partner', '看！山頂就在前面了！那裡就是惡魔獸的城堡！']] }]);
    startChapter(3);
  } else if (RUN.chapter === 4) {
    await cutscene([
      { bg: 'desert', music: 'route', amb: 'wind', chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '猴子獸逃走了……牠往沙漠另一邊的金字塔去了！'], [null, '黃沙的盡頭，一座巨大的金字塔閃著詭異的藍光。']] },
      { bg: 'pyramid', music: null, amb: 'drone', chars: [['Metal_Etemon', 50, 78, 56, 'dark']], lines: [['shadow', '嘿嘿嘿……來吧，到本大爺的金字塔裡來……'], ['shadow', '這次的演唱會，可是用「鋼鐵」打造的喔～']] },
      { bg: 'pyramid', music: 'route', amb: 'drone', chars: [['partner', 30, 78, 30, 'in-l']], lines: [['partner', '裡面是迷宮……地板上好像有奇怪的傳送陣。'], [null, '💻 迷宮裡的<b>駭客終端</b>可以關掉頭目的能力；🌀 傳送點是捷徑，但也有<b>看不見的傳送陷阱</b>。']] },
    ]);
    startChapter(5);
  } else if (RUN.chapter === 5) {
    await cutscene([
      { bg: 'pyramid', music: 'route', amb: 'drone', chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '機械猴子獸被打倒了！金字塔的藍光也熄滅了……'], [null, '就在這時，數碼裝置收到一段訊息——']] },
      { bg: 'void', music: null, amb: 'drone', chars: [['Vamdemon', 50, 78, 56, 'dark']], lines: [['shadow', '呵呵呵……第 8 個孩子，就在「那個世界」裡。'], ['shadow', '我會比你們先找到她。']] },
      { bg: 'tokyo', music: 'route', amb: 'wind', chars: [['partner', 30, 78, 30, 'in-l']], lines: [[null, '穿過光之門——眼前是熟悉的東京街頭。'], ['me', '這裡是……我們的世界！'], ['partner', '城市被紫色的霧籠罩著……吸血魔獸已經來了！'],
        [null, '🔎 找到 3 條<b>第 8 個孩子的線索</b>會發生什麼事呢？頭目前一層，徽章會<b>完全覺醒</b>。']] },
    ]);
    startChapter(6);
  } else if (RUN.chapter === 7) {
    await cutscene([
      { bg: 'sea', music: 'route', amb: 'waves', chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '鋼鐵海龍獸和木偶獸都被打倒了！'], [null, '海浪平靜下來，森林裡的操線一根根斷掉了。']] },
      { bg: 'city', music: 'route', amb: 'drone', chars: [['Mugendramon', 60, 78, 54, 'dark']], lines: [[null, '螺旋山的上一層——到處都是轟隆作響的機器和輸送帶。'], ['shadow', '偵測到入侵者……全部，消滅。'],
        [null, '🛤️ 工廠裡的<b>輸送帶</b>會把你往前送；💥 機械邪龍獸的<b>無限大砲</b>集氣時，要打出足夠的傷害才能打斷。']] },
    ]);
    startChapter(8);
  } else if (RUN.chapter === 8) {
    await cutscene([
      { bg: 'city', music: 'route', amb: 'drone', chars: [['partner', 30, 76, 32, 'in-l']], lines: [['partner', '機械邪龍獸停止運轉了……！'], [null, '工廠的齒輪一個接一個停了下來。螺旋山只剩下最後一層。']] },
      { bg: 'stage', music: null, amb: 'crowd', chars: [['Piemon', 60, 78, 54, 'dark']], lines: [[null, '山頂傳來詭異的音樂——是一座遊樂園。'], ['shadow', '呵呵呵……表演終於要進入高潮了。'],
        [null, '🃏 小丑皇會把<b>後排的夥伴</b>變成鑰匙圈；對牠打出足夠的傷害就能救回來。']] },
    ]);
    startChapter(9);
  } else if (CHAPTERS[RUN.chapter].next === 'p3final') {
    await finalChapterDone();
    return;
  } else if (CHAPTERS[RUN.chapter].next === 'p3done') {
    await part3ChapterDone();
    return;
  } else if (CHAPTERS[RUN.chapter].next === 'p2done') {
    await part2ChapterDone();
    return;
  } else {
    await ending();
    return;
  }
  saveRun();
  await chapterCard(CHAPTERS[RUN.chapter].title, RUN.chapter === 5 ? '全隊回復了 50% HP｜在金字塔迷宮裡駭入終端，削弱機械猴子獸！' : RUN.chapter === 6 ? '全隊回復了 50% HP｜在東京找到第 8 個孩子的線索，打倒吸血魔獸！' : RUN.chapter === 8 ? '全隊回復了 50% HP｜打斷無限大砲，打倒機械邪龍獸！' : RUN.chapter === 9 ? '全隊回復了 50% HP｜打破小丑皇的魔術！' : '全隊回復了 50% HP');
  showRoute();
}

function startChapter(k) {
  RUN.chapter = k;
  RUN.route = genRoute(k);
  RUN.pos = null;
  RUN.visited = [];
  RUN.stats.chapters++;
}

// =========================================================
//   結局
// =========================================================
const ENDINGS = {
  light:  { name: '光明結局「被選召的孩子」', icon: '☀️' },
  hidden: { name: '隱藏結局「羈絆之光」', icon: '🌈' },
  dark:   { name: '黑暗結局「力量的代價」', icon: '🌑' },
};
async function ending() {
  // 黑暗結局：打倒惡魔獸時身上還有黑暗徽章（黑色齒輪／黑暗之力），或錯誤進化 3 次以上
  const kind = (has('darkgear') || has('darkpower') || (F().wrongEvo || 0) >= 3) ? 'dark' : (F().saved || 0) >= 4 ? 'hidden' : 'light';
  const sp = SPECIES[RUN.team[0].sp], mega = sp.evo ? sp.evo[2] : sp;
  const fall = { bg: 'castle', music: null, amb: 'drone', chars: [['Devimon', 50, 78, 52, 'dark']], lines: [[null, '惡魔獸發出最後的慘叫，化成無數的黑色碎片…']] };
  if (kind === 'light') {
    await cutscene([fall,
      { bg: 'light', music: 'route', amb: null, chars: [['partner', 50, 76, 40, 'in-l']], fx: '<div class="cutRays" style="--rx:50%;--ry:30%"></div>',
        lines: [[null, '黑色齒輪一個接一個化為光點，消失在天空中。檔案島恢復了和平。'], ['partner', '我們做到了！我們真的做到了！']] },
      { bg: 'island', amb: 'waves', chars: [['Jijimon', 30, 74, 30], ['partner', 72, 76, 30, 'flip']], lines: [['jijimon', '你們才是真正的被選召的孩子。數碼世界會永遠記得你們。']] },
      { bg: 'aurora', amb: null, lines: [[null, '極光再次出現。該回家了——但你知道，夥伴永遠在這裡等你。']] }]);
  } else if (kind === 'hidden') {
    await cutscene([fall,
      { bg: 'light', music: 'route', amb: null, chars: [['Meramon', 14, 70, 22, 'in-l'], ['Andromon', 34, 66, 24, 'in-l'], ['Jyureimon', 66, 66, 24, 'in-r'], ['Leomon', 86, 70, 24, 'in-r flip']],
        lines: [[null, '就在這時，島上各處亮起了光——'], ['leomon', '我們都來了！是你們救了大家！'], [null, '火焰獸、機械人獸、樹人獸、守衛獸…所有被你們拯救過的數碼寶貝，把光聚集到一起。']] },
      { bg: 'burst', sting: true, chars: [['partner', 50, 76, 42, 'in-l']], fx: '<div class="cutSpeed"></div>', lines: [['partner', '這是我們一路上結下的羈絆！大家的力量，全部借給我吧——！']] },
      { bg: 'light', chars: [[mega.img, 50, 78, 56, 'glow']], fx: '<div class="cutRays" style="--rx:50%;--ry:40%"></div>',
        lines: [[{ img: mega.img, name: mega.name }, '耀眼的光芒照亮了整個數碼世界，連最深處的黑暗也消失了。']] },
      { bg: 'island', amb: 'waves', chars: [['Jijimon', 30, 74, 30], ['partner', 72, 76, 30, 'flip']], lines: [['jijimon', '黑暗再也不會回來了。這是只有心地善良的你，才能開啟的未來。']] }]);
  } else {
    // 夥伴的黑暗型態（第一部是成熟期的黑暗型態）
    const dk = (P1() && sp.dark1) || sp.dark || { img: (sp.evo ? sp.evo[0] : sp).img };
    await cutscene([fall,
      { bg: 'void', amb: 'drone', chars: [[dk.img, 50, 78, 50, 'evil']],
        lines: [[null, '黑暗之力擊敗了惡魔獸…但那股力量並沒有消失，而是在你的心中擴散。'], ['shadow', '夥伴的身體開始扭曲、發出可怕的咆哮——']] },
      { bg: 'void', chars: [['partner', 50, 76, 36]], lines: [['partner', '……醒醒啊！是我！我不要變成這樣！我只想跟你在一起！'],
        [null, '夥伴的聲音把你拉了回來。黑暗退去了，但數碼裝置上，留下了一道再也消不掉的黑色裂痕…']] }]);
  }
  const e = ENDINGS[kind];
  const first = !META.endings.includes(kind);
  if (first) META.endings.push(kind);
  unlockStarter('palmon');
  unlockKid('takeru');
  if (META.endings.length >= 2) { unlockKid('hikari'); unlockStarter('plotmon'); }
  if (first && META.endings.length === 1) await cutscene([   // 第一次拿到結局：第二部的預告
    { bg: 'sea', music: 'route', amb: 'waves', chars: [['Whamon', 56, 74, 46, 'in-r']], fx: '<div class="cutRays" style="--rx:72%;--ry:42%"></div>',
      lines: [[null, '檔案島恢復了和平。但在大海的另一邊……'], [null, '還有一塊被選召的孩子們沒去過的土地——「伺服大陸」。']] },
    { bg: 'stage', music: null, amb: null, chars: [['Etemon', 50, 78, 58, 'dark']], lines: [['shadow', '嘿嘿嘿……下一場演唱會，就等你們來囉～']] },
    { bg: 'void', amb: 'drone', fx: '<div class="cutEyes"><i style="--r:12deg"></i><i style="--r:-12deg"></i></div><div class="cutTitle"><b>第二部</b><strong>伺服大陸篇</strong><small>標題畫面已經可以開始第二部了！</small></div>',
      lines: [['shadow', '……第八個孩子。必須在他們之前找到。']] }]);
  META.clears++;
  recordDex();
  await saveClearRecord(kind);   // 第二部從通關紀錄接續
  clearRun();
  const o = $('#overlay');
  o.innerHTML = `<div class="chapterCard"><div style="font-size:80px">${e.icon}</div><h1>${e.name}</h1>
    <p>${first ? '🎉 新結局解鎖！' : ''}　已收集結局 ${META.endings.length} / 3</p>
    <div class="endTeam">${RUN.team.map(m => spPic(m.sp, 's80')).join('')}</div>
    <p>擊敗 ${RUN.stats.wins} 隻敵人　｜　隊伍 ${RUN.team.length} 隻　｜　牌組 ${RUN.deck.length} 張</p>
    <button class="btn primary big" id="endBack">回到標題</button></div>`;
  o.classList.remove('hidden');
  o.querySelector('#endBack').onclick = () => { o.classList.add('hidden'); showTitle(); };
}
