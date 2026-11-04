'use strict';
/* =========================================================
   數碼冒險 RPG（第一章試玩）— 遊戲內容
   敵人、頭目、夥伴、升級、飾品、商店、任務、對話劇情都在這裡
   ========================================================= */

// ---------- 夥伴 ----------
const PARTNERS = {
  agumon:  { name: '亞古獸', img: 'Agumon',  h: 2.2, evo: 'Greymon',   evoName: '暴龍獸',   eh: 3.5, weapon: 'fire',  atkName: '小火球', evoAtk: '超級火焰' },
  gabumon: { name: '加布獸', img: 'Gabumon', h: 2.1, evo: 'Garurumon', evoName: '加魯魯獸', eh: 3.0, weapon: 'blue',  atkName: '小藍火', evoAtk: '狐火' },
  piyomon: { name: '比丘獸', img: 'Piyomon', h: 2.0, evo: 'Birdramon', evoName: '巴多拉獸', eh: 3.8, weapon: 'magic', atkName: '魔法火焰', evoAtk: '流星火焰' },
};

// ---------- 一般敵人（Lv1 的數值，等級越高越強） ----------
const ENEMY = {
  Betamon:   { name: '蛙獸',     hp: 18, atk: 6, spd: 3.2, h: 1.8, exp: 2, coin: 2, shot: { cd: 2.8, spd: 9, dmg: 5, tex: 'cyan' } },
  Otamamon:  { name: '蝌蚪獸',   hp: 14, atk: 5, spd: 3.7, h: 1.6, exp: 2, coin: 1 },
  Kunemon:   { name: '毛毛蟲獸', hp: 20, atk: 6, spd: 3.4, h: 1.7, exp: 2, coin: 2 },
  Mushmon:   { name: '蘑菇獸',   hp: 30, atk: 7, spd: 2.6, h: 2.0, exp: 3, coin: 2, shot: { cd: 3.2, spd: 8, dmg: 6, tex: 'purple' }, mush: .4 },
  Goburimon: { name: '哥布林獸', hp: 34, atk: 9, spd: 3.8, h: 2.2, exp: 3, coin: 3 },
  Hagurumon: { name: '齒輪獸',   hp: 32, atk: 8, spd: 3.0, h: 1.9, exp: 3, coin: 3 },
  Gazimon:   { name: '加支獸',   hp: 26, atk: 8, spd: 4.7, h: 1.9, exp: 3, coin: 3 },
  Tyranomon: { name: '鐵甲暴龍獸', hp: 70, atk: 13, spd: 2.8, h: 3.0, exp: 6, coin: 6 },
  Bakemon:   { name: '幽靈獸',   hp: 44, atk: 10, spd: 3.5, h: 2.3, exp: 4, coin: 4, shot: { cd: 3.5, spd: 7, dmg: 8, tex: 'purple' } },
};
// 敵群：地圖上的小寫字母。lv = 每一群的等級（照地圖上的順序）
const CAMPS = {
  a: { kinds: ['Betamon', 'Otamamon', 'Otamamon'], n: 4, lv: [1, 2, 2, 1, 3] },
  k: { kinds: ['Kunemon', 'Kunemon', 'Mushmon', 'Goburimon'], n: 5, lv: [4, 3, 4, 6, 4, 5, 5] },
  z: { kinds: ['Hagurumon', 'Gazimon', 'Goburimon'], n: 5, lv: [6, 7, 7, 8, 8, 6] },
  v: { kinds: ['Goburimon', 'Tyranomon', 'Gazimon'], n: 4, lv: [10, 10, 11, 11] },
  u: { kinds: ['Bakemon'], n: 5, lv: [12] },
};
const lvHp = lv => 1 + .3 * (lv - 1), lvAtk = lv => 1 + .12 * (lv - 1), lvExp = lv => 1 + .35 * (lv - 1);

// ---------- 頭目／精英 ----------
// moves：頭目會輪流使用的招式（engine.js 的 BOSS_MOVES）
const BOSS = {
  Shellmon:    { name: '貝殼獸',   img: 'Shellmon',    hp: 1100, atk: 14, spd: 2.2, h: 4.2, r: 1.5, arena: 13, exp: 30,  coin: 120, drop: 'shell', moves: ['jet', 'jet', 'slam', 'summonOta'], cd: 2.2 },
  Kuwagamon:   { name: '鍬形獸',   img: 'Kuwagamon',   hp: 3000, atk: 22, spd: 3.4, h: 4.0, r: 1.4, arena: 13, exp: 70,  coin: 200, drop: 'jaw',   moves: ['charge3', 'spin', 'dive'], cd: 2.0 },
  Monochromon: { name: '獨角龍獸', img: 'Monochromon', hp: 4200, atk: 25, spd: 2.6, h: 4.0, r: 1.6, arena: 13, exp: 110, coin: 250, drop: 'horn',  moves: ['boulder', 'charge', 'stomp', 'boulder'], cd: 2.1 },
  Meramon:     { name: '火焰獸',   img: 'Meramon',     hp: 9500, atk: 34, spd: 3.0, h: 5.0, r: 1.5, arena: 14, exp: 200, coin: 300, drop: null,    moves: ['ring', 'meteor', 'fist', 'summonFire', 'meteor', 'ring'], cd: 1.7, phase2: true },
  Leomon:      { name: '獅子獸',   img: 'Leomon',      hp: 10500, atk: 28, spd: 4.0, h: 4.4, r: 1.4, arena: 9,  exp: 260, coin: 400, drop: 'mane',  moves: ['lionFist', 'dash2', 'roar', 'lionFist'], cd: 1.8, phase2: true },
  Orgemon:     { name: '歐加獸',   img: 'Orgemon',     hp: 1300, atk: 16, spd: 3.6, h: 3.4, r: 1.2, arena: 0,  exp: 60,  coin: 150, drop: 'club',  moves: ['club', 'charge'], cd: 2.4, elite: true },
  Tyranomon:   { name: '鐵甲暴龍獸', img: 'Tyranomon', hp: 2200, atk: 20, spd: 3.0, h: 3.8, r: 1.4, arena: 0,  exp: 90,  coin: 300, drop: null,    moves: ['breath', 'charge', 'breath'], cd: 2.2, elite: true, bigMeat: 2 },
};

// ---------- 升級時三選一 ----------
const UPGRADES = [
  { id: 'dmg',    ic: '💥', name: '火力強化', max: 6, desc: '全隊傷害 +15%' },
  { id: 'cd',     ic: '⏩', name: '連射',     max: 5, desc: '全隊攻擊速度 +12%' },
  { id: 'spd',    ic: '👟', name: '疾風',     max: 4, desc: '移動速度 +8%' },
  { id: 'hp',     ic: '❤️', name: '堅韌',     max: 6, desc: '最大 HP +25' },
  { id: 'pick',   ic: '🧲', name: '數據吸收', max: 3, desc: '拾取範圍 +40%' },
  { id: 'armor',  ic: '🛡️', name: '硬皮',     max: 4, desc: '受到的傷害 -10%' },
  { id: 'crit',   ic: '🎯', name: '會心',     max: 4, desc: '爆擊率 +6%' },
  { id: 'regen',  ic: '🌿', name: '自癒',     max: 3, desc: '每秒回復 0.8 HP' },
  { id: 'orbit',  ic: '🌀', name: '旋轉火焰', max: 4, desc: '身邊多 1 團環繞的火焰' },
  { id: 'fire',   ic: '🔥', name: '亞古獸：火球 +1', max: 4, desc: '小火球一次多發射 1 顆', need: () => true },
  { id: 'pierce', ic: '🔱', name: '加布獸：貫穿 +1', max: 3, desc: '小藍火多穿過 1 隻敵人、傷害 +10%', need: () => G.party.includes('gabumon') },
  { id: 'magic',  ic: '🪶', name: '比丘獸：火焰 +2', max: 3, desc: '魔法火焰多 2 團', need: () => G.party.includes('piyomon') },
  { id: 'evo',    ic: '✨', name: '勇氣之心', max: 2, desc: '勇氣累積 +30%、進化多 4 秒', need: () => G.evoOn },
];

// ---------- 飾品（最多裝備 3 個） ----------
const ACC = {
  boots:   { ic: '👟', name: '疾風之靴',     desc: '移動速度 +15%', mod: { move: .15 } },
  charm:   { ic: '🧿', name: '守護護符',     desc: '受到的傷害 -15%', mod: { armor: .15 } },
  magnet:  { ic: '🧲', name: '磁力鑰匙圈',   desc: '拾取範圍 +60%、數碼幣 +10%', mod: { pick: .6, coin: .1 } },
  stone:   { ic: '🌋', name: '火山石',       desc: '多 1 團旋轉火焰，旋轉火焰傷害 +30%', mod: { orbit: 1, orbitDmg: .3 } },
  ring:    { ic: '💪', name: '力量手環',     desc: '傷害 +15%', mod: { dmg: .15 } },
  eggc:    { ic: '🥚', name: '蛋殼護符',     desc: '每秒回復 1.5 HP', mod: { regen: 1.5 } },
  card:    { ic: '📞', name: '神秘電話卡',   desc: '數碼幣 +30%、經驗 +15%', mod: { coin: .3, exp: .15 } },
  shard:   { ic: '🔥', name: '勇氣碎片',     desc: '勇氣累積 +50%、進化多 5 秒', mod: { evo: .5, evoT: 5 } },
  mane:    { ic: '🦁', name: '獅子王鬃毛',   desc: '傷害 +25%、爆擊率 +10%', mod: { dmg: .25, crit: .1 } },
  dice:    { ic: '🎲', name: '幸運骰子',     desc: '爆擊率 +12%', mod: { crit: .12 } },
  shell:   { ic: '🐚', name: '貝殼盾牌',     desc: '受傷後的無敵時間 +60%、受到的傷害 -5%', mod: { inv: .6, armor: .05 } },
  jaw:     { ic: '🪲', name: '鍬形大顎',     desc: '爆擊傷害 +60%', mod: { critDmg: .6 } },
  horn:    { ic: '🦏', name: '堅硬的角',     desc: '最大 HP +40、受到的傷害 -5%', mod: { hp: 40, armor: .05 } },
  club:    { ic: '🦴', name: '歐加獸的骨棒', desc: '傷害 +10%、最大 HP +20', mod: { dmg: .1, hp: 20 } },
  feather: { ic: '🪶', name: '火焰羽毛',     desc: '攻擊速度 +12%', mod: { cd: .12 } },
  scope:   { ic: '🔭', name: '望遠鏡',       desc: '放在背包就有效（不用裝備）：地圖上會顯示還沒打開的寶箱', mod: {}, passive: true },
};

// ---------- 商店 ----------
const SHOPS = {
  geko: { name: '青蛙獸的雜貨店', who: 'Gekomon', items: [
    { k: 'meat', price: 25 }, { k: 'bigMeat', price: 80, need: () => G.flags.bigMeatShop },
    { acc: 'magnet', price: 200 }, { acc: 'boots', price: 260 }, { acc: 'charm', price: 320 }, { acc: 'stone', price: 550 }] },
  mame: { name: '豆豆獸的夜市', who: 'Mamemon', items: [
    { k: 'bigMeat', price: 60 }, { acc: 'dice', price: 380 }, { acc: 'shard', price: 420 }] },
};
const ITEM = {
  meat:    { ic: '🍖', name: '肉',     desc: '回復 35% HP（按 R）' },
  bigMeat: { ic: '🍗', name: '大塊肉', desc: '回復全部 HP（背包裡使用）' },
  mush:    { ic: '🍄', name: '野生蘑菇', desc: '臭臭獸想要的食材' },
};
// 寶箱：照地圖上 C 的順序
const CHESTS = [
  { acc: 'feather' },                     // 秘密小樹林
  { coin: 80, meat: 2 },                  // 森林東南
  { coin: 50, meat: 2 },                  // 海灘
  { acc: 'scope', coin: 100 },            // 齒輪草原東北角
  { coin: 250, bigMeat: 1 },              // 火山西北
  { coin: 300, bigMeat: 2 },              // 隱藏洞窟
  { coin: 30, meat: 1 },                  // 起始之鎮（房子後面）
  { coin: 60, meat: 1 },                  // 森林西邊
];

// ---------- 說話的人 ----------
const WHO = {
  太一: { ic: '🧒' }, 亞古獸: { img: 'Agumon' }, 加布獸: { img: 'Gabumon' }, 比丘獸: { img: 'Piyomon' },
  老爺爺獸: { img: 'Jijimon' }, 電擊獸: { img: 'Elecmon' }, 臭臭獸: { img: 'Numemon' }, 青蛙獸: { img: 'Gekomon' },
  豆豆獸: { img: 'Mamemon' }, 貝殼獸: { img: 'Shellmon' }, 鍬形獸: { img: 'Kuwagamon' }, 獨角龍獸: { img: 'Monochromon' },
  火焰獸: { img: 'Meramon' }, 獅子獸: { img: 'Leomon' }, 惡魔獸: { img: 'Devimon' }, 歐加獸: { img: 'Orgemon' },
  '？？？': { ic: '📞' }, 石碑: { ic: '🗿' }, 旁白: { ic: '📜' }, 營火: { ic: '🔥' }, 寶箱: { ic: '🎁' },
};

// ---------- 任務 ----------
// stage：目前進行到第幾步；text 可以是函式（顯示進度）；at：目標在地圖上的位置（物件代號）
const QUESTS = {
  main: { title: '第一章　檔案島的異變', main: true, steps: [
    { text: '沿著海灘往東走，調查電話亭', at: 'P' },
    { text: '往北走，到起始之鎮找老爺爺獸長老', at: 'J' },
    { text: '到西邊的森林尋找加布獸', at: 'G' },
    { text: '深入森林北邊，打倒鍬形獸、救出比丘獸', at: 'K' },
    { text: '回起始之鎮向長老報告', at: 'J' },
    { text: '往東穿過齒輪草原，擊退守橋的獨角龍獸', at: 'O' },
    { text: '登上火山，阻止失控的火焰獸', at: 'F' },
  ] },
  eggs: { title: '迷路的數碼蛋', steps: [
    { text: () => `找到 5 顆迷路的數碼蛋（${G.eggs.length}/5）` },
    { text: '把數碼蛋帶回去給電擊獸', at: 'E' },
  ] },
  gears: { title: '黑色齒輪', steps: [
    { text: () => `破壞 5 個黑色齒輪（${G.gears.length}/5）` },
    { text: '向老爺爺獸長老報告', at: 'J' },
  ] },
  mush: { title: '臭臭獸的料理', steps: [
    { text: () => `收集 5 個野生蘑菇（${Math.min(5, G.mush)}/5，蘑菇獸會掉）` },
    { text: '把蘑菇交給臭臭獸', at: 'N' },
  ] },
  tabs: { title: '石碑之謎', hidden: true, steps: [
    { text: () => `找到並讀完 3 塊古代石碑（${G.tabs.length}/3）` },
    { text: '「水之歌落下之處」……去瀑布旁邊看看', at: 'x' },
    { text: '洞窟深處好像有什麼……', at: 'L' },
  ] },
  phone: { title: '午夜的電話', hidden: true, steps: [
    { text: '晚上再到海灘的電話亭看看（營火可以休息到晚上）', at: 'P' },
  ] },
};
// 秘密（第一章結束時會統計）
const SECRETS = {
  grove: '假樹後面的秘密小樹林', island: '湖中的小島', cave: '瀑布後的洞窟', phone: '午夜的電話',
  mame: '夜晚的神秘商人', leomon: '解放獅子獸', orge: '打倒流浪的歐加獸', tyrano: '打倒火山的鐵甲暴龍獸',
};

// ---------- 劇情與對話 ----------
// 這些函式會用到 ui.js 的 say / ask / toast 等等
const STORY = {
  async opening() {
    await say([
      ['太一', '好痛……這裡是哪裡？剛剛明明還在夏令營的……'],
      ['亞古獸', '太一！你終於醒了！我是亞古獸，一直在等你喔！'],
      ['太一', '數碼……寶貝？'],
      ['亞古獸', '這裡是檔案島。最近島上怪怪的，大家都變得好兇……'],
      ['亞古獸', '啊！海灘東邊有一座奇怪的電話亭，說不定能打電話回你的世界！'],
      ['旁白', '移動：WASD／方向鍵（手機：按住畫面拖曳）。<br>亞古獸會<b>自動攻擊</b>附近的敵人，你負責走位、閃開<b style="color:#f87171">紅色預警</b>的範圍。<br><b>空白鍵</b>（手機：💨）可以衝刺閃避，衝刺時不會受傷。<br>按 <b>E</b>（手機：💬）可以對話、調查。'],
    ]);
  },

  // ----- 電話亭 -----
  async phone() {
    if (night() && !G.flags.phone) {
      sfx('ring');
      await say([['旁白', '鈴鈴鈴——鈴鈴鈴——<br>電話亭裡的電話……自己響了！'], ['太一', '……喂？']]);
      await say([
        ['？？？', '……被選召的孩子……聽得到嗎……'],
        ['？？？', '黑色齒輪……來自山的頂端……三塊石碑……會指引你……'],
        ['？？？', '收下這個……它能讓你在這個世界……走得更遠……'],
        ['旁白', '電話掛斷了。話筒旁邊，多了一張閃著光的卡片。'],
      ]);
      G.flags.phone = 1; secret('phone'); giveAcc('card'); qDone('phone');
      return;
    }
    if (G.flags.phone) return say([['旁白', '電話亭安安靜靜的。那通電話到底是誰打來的呢……']]);
    await say([['旁白', '一座舊舊的電話亭。拿起話筒，只聽得到沙沙的雜音……'], ['太一', '果然打不通嗎……']]);
    if (G.q.main === 0) await say([['亞古獸', '咦？太一，你有沒有感覺地面在晃……？']]);
  },

  // ----- 貝殼獸 -----
  async shellIntro() {
    await say([
      ['旁白', '轟隆隆隆——！海面突然隆起！'],
      ['貝殼獸', '這片海灘是我的地盤！統統給我滾出去！'],
      ['亞古獸', '牠的背上……卡著一個黑色的齒輪！太一，小心！'],
    ]);
  },
  async shellHalf() {
    await say([
      ['太一', '亞古獸！撐住啊！！'],
      ['亞古獸', '太一……我感覺到……一股好熱好熱的力量……！'],
      ['旁白', '✨ 太一的數碼暴龍機發出了光芒！<br>勇氣滿了！按 <b>Q</b>（手機：⚡）讓亞古獸<b>進化</b>！'],
    ]);
  },
  async shellWin() {
    await say([
      ['旁白', '黑色齒輪從貝殼獸身上飛了出來，碎成了粉末。'],
      ['貝殼獸', '我……我剛剛在做什麼？頭好痛……'],
      ['貝殼獸', '對不起……北邊有個「起始之鎮」，老爺爺獸長老什麼都知道，去問他吧。'],
      ['旁白', '升級時可以三選一強化。打倒頭目會掉<b>飾品</b>，按 <b>B</b>（🎒）可以裝備，最多 3 個。'],
    ]);
  },

  // ----- 老爺爺獸 -----
  async jijimon() {
    const s = G.q.main;
    if (s === 1) {
      await say([
        ['老爺爺獸', '喔喔……你就是傳說中「被選召的孩子」嗎！'],
        ['老爺爺獸', '最近島上到處出現奇怪的<b>黑色齒輪</b>。被齒輪纏上的數碼寶貝，會變得兇暴失控。'],
        ['老爺爺獸', '加布獸說要去西邊的森林調查，到現在都還沒回來……拜託你們去找找他！'],
        ['老爺爺獸', '對了，要是看到地上的黑色齒輪，就把它打碎吧！打碎 5 個再來找我，我有謝禮。'],
        ['旁白', '鎮上的<b>營火</b>可以回滿 HP、存檔。全滅的話會回到最後一次休息的營火。'],
      ]);
      qSet('main', 2); qStart('gears');
      return;
    }
    if (G.q.gears === 1) {
      await say([['老爺爺獸', '5 個黑色齒輪都打碎了？了不起！這個手環給你，戴上會更有力氣。']]);
      qDone('gears'); giveAcc('ring'); give('coin', 200);
      return;
    }
    if (s === 4) {
      await say([
        ['老爺爺獸', '什麼！連比丘獸都被鍬形獸抓走了？幸好有你們在。'],
        ['老爺爺獸', '不過……火山那邊一直冒出黑煙。火焰獸平常很溫和的，現在卻……'],
        ['老爺爺獸', '去火山要經過東邊的<b>齒輪草原</b>。但是守橋的獨角龍獸，好像也被齒輪控制了。'],
      ]);
      qSet('main', 5); checkMain();
      return;
    }
    const line = {
      2: '加布獸往西邊的森林去了，森林裡的路有點複雜，小心別迷路。',
      3: '鍬形獸的巢穴在森林的最北邊。那傢伙很兇，準備好再去！',
      5: '火山的橋在齒輪草原的北邊。獨角龍獸很硬，打不動的話先去別的地方練練吧。',
      6: '火焰獸就在火山的山頂……孩子們，拜託了！',
      7: '你們是檔案島的英雄！不過……島上好像還藏著很多秘密呢，呵呵。',
    }[s] || '……';
    await say([['老爺爺獸', line], ['老爺爺獸', pick(RUMORS)]]);
  },

  // ----- 電擊獸：數碼蛋 -----
  async elecmon() {
    if (G.q.eggs === undefined) {
      await say([
        ['電擊獸', '哇！不好了不好了！'],
        ['電擊獸', '前幾天的大地震，把育嬰床的<b>數碼蛋</b>震得滾到島上各處了……'],
        ['電擊獸', '一共 5 顆，拜託幫我找回來！有的可能滾到很奇怪的地方……'],
      ]);
      qStart('eggs'); checkQuests();
      return;
    }
    if (G.q.eggs === 1) {
      await say([['電擊獸', '5 顆都找回來了！太好了，寶寶們都很平安！'], ['電擊獸', '這是用孵化後的蛋殼做的護符，戴著它，傷口會慢慢癒合喔。']]);
      qDone('eggs'); giveAcc('eggc'); give('coin', 150);
      return;
    }
    if (G.q.eggs === 'done') return say([['電擊獸', '寶寶們都長得很好！謝謝你們～'], ['電擊獸', pick(RUMORS)]]);
    const hints = [
      '我好像看到一顆滾到<b>海灘東邊的礁石</b>後面……',
      '<b>森林的西邊</b>，樹叢裡好像有一閃一閃的光……可是那邊明明全是樹啊？',
      '<b>齒輪草原的南邊</b>也有人看到過白白圓圓的東西。',
      '<b>瀑布</b>那邊……不，那裡被岩壁擋住了，不可能吧？',
      '<b>湖中間的小島</b>上，好像有什麼白白的東西……可是要怎麼過去呢？',
    ];
    const miss = [0, 1, 2, 3, 4].filter(i => !G.eggs.includes(i));
    await say([['電擊獸', `已經找到 ${G.eggs.length} 顆了！還差 ${miss.length} 顆。`], ['電擊獸', hints[pick(miss)]]]);
    if (G.q.phone === undefined) { await say([['電擊獸', '對了……聽說<b>晚上</b>海邊的電話亭會自己響起來……好可怕！']]); qStart('phone'); }
  },

  // ----- 臭臭獸：蘑菇 -----
  async numemon() {
    if (G.q.mush === undefined) {
      await say([
        ['臭臭獸', '嘿嘿，我是鎮上的大廚臭臭獸！……雖然大家都不敢吃我做的菜。'],
        ['臭臭獸', '我想做「蘑菇燉肉」，可是森林裡的<b>蘑菇獸</b>很兇……幫我收集 5 個<b>野生蘑菇</b>好嗎？'],
      ]);
      qStart('mush'); checkQuests();
      return;
    }
    if (G.q.mush === 1) {
      await say([
        ['臭臭獸', '好香——！蘑菇燉肉完成啦！這是謝禮，吃了會變得很有勇氣喔！'],
        ['臭臭獸', '我也教了青蛙獸怎麼做「大塊肉」，以後雜貨店就買得到了！'],
      ]);
      G.mush -= 5; G.flags.bigMeatShop = 1; qDone('mush'); giveAcc('shard');
      return;
    }
    if (G.q.mush === 'done') return say([['臭臭獸', '下次想做什麼菜呢～'], ['臭臭獸', '我聽說喔，<b>晚上的齒輪草原</b>，篝火旁邊會出現一個很小很小的商人……']]);
    await say([['臭臭獸', `蘑菇有 ${Math.min(5, G.mush)} 個了！再多一點、再多一點～`]]);
  },

  async geko() { await say([['青蛙獸', '呱！歡迎光臨！要買點什麼嗎？']]); openShop('geko'); },
  async mame() {
    if (!G.flags.mame) { await say([['豆豆獸', '嘿嘿……被你找到了。這是只在夜晚開張的特別商店。'], ['豆豆獸', '白天我可是不在的喔～']]); G.flags.mame = 1; secret('mame'); }
    openShop('mame');
  },

  // ----- 石碑 -----
  async tablet(n) {
    const T = { 1: '「水之歌落下之處，岩壁沉睡」', 2: '「沉睡的獅子，被黑暗纏繞」', 3: '「三碑共鳴之時，道路將會開啟」' };
    await say([['石碑', `古老的石碑，刻著發光的文字：<br><br><b>${T[n]}</b>`]]);
    if (!G.tabs.includes(n)) {
      G.tabs.push(n);
      if (G.q.tabs === undefined) qStart('tabs');
      if (G.tabs.length >= 3) {
        shake(1.2); sfx('rumble');
        await say([['旁白', '三塊石碑同時發出了光！<br>遠方傳來岩石崩落的聲音……好像是從<b>森林北邊的瀑布</b>傳來的！']]);
        openWall(); qSet('tabs', 1);
      } else toast(`🗿 石碑 ${G.tabs.length}/3`);
    }
  },
  async enterCave() {
    secret('cave'); if (G.q.tabs === 1) qSet('tabs', 2);
    await say([['旁白', '瀑布後面藏著一個洞窟……空氣很冷，深處傳來低沉的吼聲。']]);
  },
  async leoIntro() {
    await say([
      ['獅子獸', '……吼……離開……這裡……'],
      ['獅子獸', '我……控制不住……這個身體……快逃……！'],
      ['亞古獸', '是黑色齒輪！太一，我們來救他！'],
    ]);
  },
  async leoWin() {
    await say([
      ['獅子獸', '……謝謝你們，被選召的孩子。'],
      ['獅子獸', '這是我的鬃毛，帶著它吧。它會給你獅子的力量。'],
      ['獅子獸', '黑色齒輪……來自無限山上的那個傢伙。小心<b>惡魔獸</b>。'],
    ]);
    qDone('tabs'); secret('leomon');
  },

  // ----- 森林：加布獸、鍬形獸 -----
  async gabuIntro() {
    await say([
      ['加布獸', '太一？亞古獸！小心，四周都是被齒輪控制的數碼寶貝！'],
      ['亞古獸', '加布獸，我們來幫你！'],
      ['旁白', '撐過 3 波敵人！'],
    ]);
  },
  async gabuWin() {
    await say([
      ['加布獸', '呼……謝啦！我跟你們一起走！'],
      ['加布獸', '對了……<b>比丘獸</b>被鍬形獸抓到森林北邊的巢穴去了！快去救她！'],
      ['旁白', '加布獸加入了！加布獸會發射可以<b>貫穿</b>敵人的小藍火。'],
    ]);
  },
  async kuwaSleep() { await say([['旁白', '一隻巨大的鍬形獸在巢穴裡打呼……現在最好別惹牠。']]); },
  async kuwaIntro() { await say([['鍬形獸', '嘰嘰嘰嘰——！'], ['比丘獸', '救命啊——！誰來救救我！'], ['加布獸', '是比丘獸！上吧！']]); },
  async kuwaWin() {
    await say([
      ['比丘獸', '謝謝你們！我還以為要被吃掉了……'],
      ['比丘獸', '我也要幫忙！黑色齒輪實在太過分了！'],
      ['旁白', '比丘獸加入了！比丘獸會一次放出好幾團<b>魔法火焰</b>。'],
    ]);
  },

  // ----- 獨角龍獸 -----
  async monoIntro() { await say([['旁白', '橋頭站著一隻巨大的獨角龍獸。牠的眼睛閃著紅光，背上卡著黑色齒輪。'], ['獨角龍獸', '哞——！誰都不准過去！']]); },
  async monoWin() {
    await say([
      ['獨角龍獸', '呼……謝謝。我好像做了一場很長的惡夢。'],
      ['獨角龍獸', '橋已經可以過了。火焰獸就在火山頂……他身上的齒輪，比我的大好多。'],
      ['旁白', '往火山的橋打開了！'],
    ]);
  },

  // ----- 火焰獸 -----
  async meraIntro() {
    await say([
      ['火焰獸', '燒吧……全部燒光吧……！'],
      ['加布獸', '好燙！他身上的齒輪好大……'],
      ['太一', '大家，上吧！把火焰獸救回來！'],
    ]);
  },
  async meraHalf() { await say([['火焰獸', '這股力量……停不下來……！！'], ['旁白', '火焰獸的火焰變得更猛烈了！']]); },
  async leoHalf() { await say([['獅子獸', '吼——！！快……打碎……齒輪……！'], ['旁白', '獅子獸的動作變快了！']]); },
  async meraWin() {
    await say([
      ['旁白', '巨大的黑色齒輪碎裂了，火山的黑煙也慢慢散去。'],
      ['火焰獸', '我……被一個披著黑色斗篷的傢伙……用齒輪……'],
      ['火焰獸', '他在無限山的山頂……他叫……<b>惡魔獸</b>……'],
      ['惡魔獸', '呵呵呵……被選召的孩子。這座島，遊戲才剛開始呢。'],
      ['太一', '惡魔獸……！不管你是誰，我們一定會阻止你！'],
    ]);
  },

  // ----- 營火 -----
  async rest(i) {
    const first = G.rest !== i;
    G.rest = i; heal(9999); respawnCamps(); save();
    if (first) toast('🔥 營火點燃了！全滅時會回到這裡');
    const c = await ask('營火', '溫暖的營火。HP 回滿了，也存好檔了。<br>要休息一下嗎？', ['休息到晚上 🌙', '休息到早上 ☀️', '出發！']);
    if (c === 0) { setTime(.74); toast('🌙 到了晚上'); }
    if (c === 1) { setTime(.12); toast('☀️ 到了早上'); }
  },
};
const RUMORS = [
  '聽說森林西邊的樹，有幾棵是<b>假的</b>，走得過去喔。',
  '島上有三塊古代石碑，聽說把它們全部讀過，會發生不可思議的事。',
  '湖的西岸好像有一排石頭，可以踩著過去？',
  '晚上的數碼世界，會出現白天看不到的東西……',
  '齒輪草原有一隻到處流浪的歐加獸，很強，別隨便惹他。',
  '火山上的鐵甲暴龍獸守著寶物？誰知道呢。',
];
