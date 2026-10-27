'use strict';
/* =========================================================
   資料：數碼寶貝、卡片、敵人招式、徽章道具、章節
   ========================================================= */

// ---------- 工具 ----------
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weighted(obj) { const tot = Object.values(obj).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const k in obj) { r -= obj[k]; if (r <= 0) return k; } return Object.keys(obj)[0]; }
let uidSeq = 0;

// ---------- 平衡參數 ----------
const ATB_K = 3.5;
const EVO_TURNS = 3;
const HAND_SIZE = 5;      // 每回合開始把手牌補到幾張
const PIN_MAX = 2;        // 回合結束時最多能釘住（保留）幾張牌，究極技卡不算
const ENERGY = 3;
const CARRY_MAX = 2;      // 沒用完的能量最多保留幾點到下回合
const COURAGE_MAX = 120;
const COURAGE_SAFE = 40;   // 保留線：戰鬥結束後勇氣值 40 以下完全保留，超過的部分減半（舊存檔才用）
// 第一部規則（v13 起新開的冒險）：只能進化到成熟期、沒有徽章、勇氣值上限 40、不會減半
const P1 = () => typeof RUN !== 'undefined' && !!RUN && RUN.rules === 'p1';
const P2 = () => typeof RUN !== 'undefined' && !!RUN && RUN.rules === 'p2';   // 第二部
const NEW = () => P1() || P2();   // 第一部、第二部共用的新規則（勇氣值 40、背包 4 格、沒有徽章道具…）
const COURAGE_MAX_P1 = 40;
const courageMax = () => NEW() ? COURAGE_MAX_P1 : COURAGE_MAX;
const tierCap = f => P1() ? 1 : P2() ? ((f.leader || (typeof crestPartner === 'function' && crestPartner(f))) ? (RUN.awaken ? 3 : RUN.crest ? 2 : 1) : 1) : (f.leader ? 3 : 1);   // 能進化到的最高階段
const crestCost = (tier, from = tier - 1) => Math.max(1, tier - Math.max(1, from));   // v16.4：每往上一階 1 格（成熟期→完全體 1、完全體→究極體 1、成熟期直接究極進化 2）
const crestShop = () => P2() && RUN && RUN.crest;   // 有徽章之後：回復泉可以充能、商店賣徽章碎片
const CREST_KEYS = ['courage', 'friendship', 'love', 'knowledge', 'sincerity', 'purity', 'hope', 'light'];
const teamMax = () => 6 + (K().teamPlus || 0);
const RECRUIT_CHANCE = 0.2;
const expNeed = lv => 15 + lv * 10;
const ENEMY_HP = 1.5;    // 敵人血量倍率（想更難就調高）
const ENEMY_ATK = 1.55;  // 敵人攻擊倍率

const TIERS = [
  { name: '成長期' },
  { name: '成熟期', verb: '進化',     cost: 30,  lv: 1, m: { hp: 1.5, atk: 1.5,  def: 1.35, spd: 1.15 }, energy: 1, power: 24 },
  { name: '完全體', verb: '超進化',   cost: 60,  lv: 4, m: { hp: 2.0, atk: 1.95, def: 1.7,  spd: 1.3 },  energy: 1, power: 32 },
  { name: '究極體', verb: '究極進化', cost: 100, lv: 7, m: { hp: 2.6, atk: 2.5,  def: 2.0,  spd: 1.45 }, energy: 2, power: 42 },
];

const ATTR_NAME = { vaccine: '疫苗種', data: '資料種', virus: '病毒種' };
const ATTR_ICON = { vaccine: '💉', data: '💾', virus: '🦠' };
const BEATS = { vaccine: 'virus', virus: 'data', data: 'vaccine' };
function attrMult(a, d) { if (BEATS[a] === d) return 1.5; if (BEATS[d] === a) return 0.75; return 1; }

const STATUS = {
  burn:   { name: '燒傷',  icon: '🔥' },
  poison: { name: '中毒',  icon: '☠️' },
  para:   { name: '麻痺',  icon: '⚡' },
  haste:  { name: '加速',  icon: '💨' },
  atkUp:  { name: '攻擊↑', icon: '💪' },
  expose: { name: '受傷↑', icon: '🎯' },
  ward:   { name: '光之守護', icon: '✨' },
  root:   { name: '寄生之根', icon: '🌱' },
  tired:  { name: '疲勞', icon: '😮‍💨' },
};

// =========================================================
//   數碼寶貝（img = images/ 資料夾裡的檔名）
// =========================================================
const SPECIES = {
  // ----- 初代夥伴 -----
  agumon: { name: '亞古獸', img: 'Agumon', emoji: '🦖', attr: 'vaccine', hp: 62, atk: 14, def: 8, spd: 10, starter: true,
    flavor: 'burn', desc: '攻擊力高，招式會燒傷對手', sig: { name: '小火球', power: 12 }, dark1: { name: '黑暴龍獸', img: 'Dark_Tyranomon' }, dark: { name: '骷髏暴龍獸', img: 'Skull_Greymon' },
    evo: [{ name: '暴龍獸', img: 'Greymon', ult: '超級火焰' },
          { name: '機械暴龍獸', img: 'Metal_Greymon', ult: '巨型毀滅者' },
          { name: '戰鬥暴龍獸', img: 'War_Greymon', ult: '蓋亞能量炮' }] },
  gabumon: { name: '加布獸', img: 'Gabumon', emoji: '🦊', attr: 'data', hp: 68, atk: 12, def: 11, spd: 9, starter: true,
    flavor: 'shield', desc: '防禦力高，攻擊同時獲得護盾', sig: { name: '藍色火焰', power: 11 }, dark1: { name: '黑加魯魯獸', img: 'Garurumon_(Black)' }, dark: { name: '黑色獸人加魯魯', img: 'Were_Garurumon_(Black)' },
    evo: [{ name: '加魯魯獸', img: 'Garurumon', ult: '狐火' },
          { name: '獸人加魯魯', img: 'Were_Garurumon', ult: '狼人之爪', hits: 2 },
          { name: '鋼鐵加魯魯', img: 'Metal_Garurumon', ult: '冰河吐息' }] },
  piyomon: { name: '比丘獸', img: 'Piyomon', emoji: '🐤', attr: 'vaccine', hp: 54, atk: 12, def: 7, spd: 13, starter: true,
    flavor: 'haste', desc: '速度最快，能讓自己加速多次行動', sig: { name: '魔法之火', power: 10 }, dark1: { name: '黑暗鳥獸', img: 'Saberdramon' }, dark: { name: '黑暗鳥獸', img: 'Saberdramon' },
    evo: [{ name: '巴多拉獸', img: 'Birdramon', ult: '流星之翼', hits: 3 },
          { name: '迦樓羅獸', img: 'Garudamon', ult: '火焰之翼', hits: 2 },
          { name: '鳳凰獸', img: 'Hououmon', ult: '星光爆發' }] },
  patamon: { name: '巴達獸', img: 'Patamon', emoji: '🐹', attr: 'data', hp: 58, atk: 11, def: 9, spd: 12, starter: true,
    flavor: 'heal', desc: '必殺技便宜，進化後擅長補血', sig: { name: '空氣炮', power: 8, cost: 1 }, dark1: { name: '惡魔獸', img: 'Devimon' }, dark: { name: '惡魔獸', img: 'Devimon' },
    unlock: '通過第一章後解鎖',
    evo: [{ name: '天使獸', img: 'Angemon', ult: '天堂之拳' },
          { name: '神聖天使獸', img: 'Holy_Angemon', ult: '天國之門' },
          { name: '熾天使獸', img: 'Seraphimon', ult: '七重天', hits: 3 }] },
  gomamon: { name: '哥瑪獸', img: 'Gomamon', emoji: '🦦', attr: 'vaccine', hp: 64, atk: 11, def: 10, spd: 10, starter: true,
    flavor: 'delay', desc: '擅長把對手的行動條往回拉', sig: { name: '魚群行進', power: 10 }, dark1: { name: '蓋索獸', img: 'Gesomon' }, dark: { name: '邪惡海龍獸', img: 'Waru_Seadramon' },
    unlock: '抵達第三章後解鎖',
    evo: [{ name: '海獅獸', img: 'Ikkakumon', ult: '魚雷鋼角' },
          { name: '祖頓獸', img: 'Zudomon', ult: '雷神之錘' },
          { name: '維京獸', img: 'Vikemon', ult: '北極風暴', hits: 2 }] },
  palmon: { name: '巴魯獸', img: 'Palmon', emoji: '🌺', attr: 'data', hp: 60, atk: 11, def: 9, spd: 11, starter: true,
    flavor: 'poison', desc: '用毒持續削減對手 HP', sig: { name: '毒藤', power: 9 }, dark1: { name: '樹木獸', img: 'Woodmon' }, dark: { name: '莉莉絲獸', img: 'Lilithmon' },
    unlock: '達成任一結局後解鎖',
    evo: [{ name: '仙人掌獸', img: 'Togemon', ult: '千刺拳', hits: 4 },
          { name: '百合獸', img: 'Lilimon', ult: '花之炮' },
          { name: '薔薇獸', img: 'Rosemon', ult: '禁忌的誘惑', hits: 2 }] },

  tentomon: { name: '甲蟲獸', img: 'Tentomon', emoji: '🐞', attr: 'vaccine', hp: 58, atk: 12, def: 10, spd: 10, starter: true,
    flavor: 'para', desc: '雷電攻擊會麻痺對手', sig: { name: '小雷擊', power: 10 }, dark1: { name: '鍬形獸', img: 'Kuwagamon' },
    evo: [{ name: '比多獸', img: 'Kabuterimon', ult: '超級雷電' },
          { name: '超比多獸', img: 'Atlur_Kabuterimon_(Red)', ult: '巨角衝擊' },
          { name: '赫拉克比多獸', img: 'Herakle_Kabuterimon', ult: '雷電加農炮' }] },
  plotmon: { name: '小狗獸', img: 'Plotmon', emoji: '🐶', attr: 'vaccine', hp: 56, atk: 12, def: 8, spd: 12, starter: true,
    flavor: 'holy', desc: '神聖之力能淨化敵人的強化與護盾', sig: { name: '幼犬之吼', power: 9 }, dark1: { name: '黑迪路獸', img: 'Black_Tailmon' }, dark: { name: '黑迪路獸', img: 'Black_Tailmon' },
    unlock: '解鎖八神嘉兒後可選',
    evo: [{ name: '迪路獸', img: 'Tailmon', ult: '迪路貓拳', hits: 3 },
          { name: '天女獸', img: 'Angewomon', ult: '神聖之箭' },
          { name: '聖龍獸', img: 'Holydramon', ult: '神聖火焰' }] },

  // ----- 野生（打贏有機會收服） -----
  kunemon: { weak: true, name: '毛蟲獸', img: 'Kunemon', emoji: '🐛', attr: 'virus', hp: 54, atk: 11, def: 8, spd: 10,
    flavor: 'pierce', desc: '攻擊無視護盾', sig: { name: '電擊絲', power: 10 }, moves: ['bite', 'electric'],
    evo: [{ name: '鍬形獸', img: 'Kuwagamon', ult: '剪刀臂' },
          { name: '大鍬形獸', img: 'Okuwamon', ult: '雙重剪刀', hits: 2 },
          { name: '巨大鍬形獸', img: 'Gran_Kuwagamon', ult: '次元剪刀' }] },
  betamon: { weak: true, name: '貝塔獸', img: 'Betamon', emoji: '🐸', attr: 'virus', hp: 56, atk: 11, def: 9, spd: 10,
    flavor: 'para', desc: '招式有機率麻痺對手', sig: { name: '電擊', power: 10 }, moves: ['bite', 'electric', 'guard'],
    evo: [{ name: '海龍獸', img: 'Seadramon', ult: '冰之箭' },
          { name: '超級海龍獸', img: 'Mega_Seadramon', ult: '雷擊標槍' },
          { name: '鋼鐵海龍獸', img: 'Metal_Seadramon', ult: '能量洪流' }] },
  mushmon: { weak: true, name: '蘑菇獸', img: 'Mushmon', emoji: '🍄', attr: 'virus', hp: 52, atk: 12, def: 7, spd: 11,
    flavor: 'poison', desc: '用毒持續削減對手 HP', sig: { name: '毒菇粉', power: 10 }, moves: ['bite', 'spore'],
    evo: [{ name: '樹木獸', img: 'Woodmon', ult: '分枝鑽頭' },
          { name: '樹人獸', img: 'Jyureimon', ult: '櫻桃炸彈', hits: 2 },
          { name: '木偶獸', img: 'Pinochimon', ult: '子彈錘' }] },
  elecmon: { weak: true, name: '電擊獸', img: 'Elecmon', emoji: '🐿️', attr: 'data', hp: 54, atk: 12, def: 8, spd: 12,
    flavor: 'rage', desc: '招式會提升自己的攻擊', sig: { name: '超級雷擊', power: 10 }, moves: ['bite', 'electric'],
    evo: [{ name: '獅子獸', img: 'Leomon', ult: '獸王拳' },
          { name: '冰獅獸', img: 'Panjyamon', ult: '冰獅拳', hits: 2 },
          { name: '劍齒獅獸', img: 'Saber_Leomon', ult: '無限之爪', hits: 3 }] },
  hagurumon: { weak: true, name: '齒輪獸', img: 'Hagurumon', emoji: '⚙️', attr: 'virus', hp: 58, atk: 10, def: 11, spd: 9,
    flavor: 'shield', desc: '防禦力高，攻擊同時獲得護盾', sig: { name: '暗黑齒輪', power: 10 }, moves: ['bite', 'gear', 'guard'],
    evo: [{ name: '守衛獸', img: 'Guardromon', ult: '毀滅導彈' },
          { name: '機械人獸', img: 'Andromon', ult: '旋轉刀刃' },
          { name: '高級機械人獸', img: 'Hi_Andromon', ult: '原子光束' }] },

  // ----- 只會當敵人 / 劇情角色 -----
  goblimon:   { name: '哥布林獸', img: 'Goburimon', emoji: '👺', attr: 'virus',   hp: 36, atk: 11, def: 7,  spd: 8,  flavor: 'rage', desc: '愛用蠻力，越打越兇', sig: { name: '哥布林棒', power: 11 },
    evo: [{ name: '大鬼獸', img: 'Orgemon', ult: '霸王拳' },
      { name: '骷髏撒旦獸', img: 'Skull_Satamon', ult: '骷髏杖' },
      { name: '小丑皇', img: 'Piemon', ult: '王牌之劍', hits: 3 }],
    moves: ['bite', 'club', 'guard'] },
  numemon:    { name: '蛞蝓獸',   img: 'Numemon',   emoji: '🐌', attr: 'virus',   hp: 38, atk: 9,  def: 6,  spd: 8,  flavor: 'para', desc: '便便攻擊會讓對手動彈不得', sig: { name: '便便攻擊', power: 11 },
    evo: [{ name: '黏液獸', img: 'Geremon', ult: '黏液炸彈' },
      { name: '玩偶獸', img: 'Monzaemon', ult: '愛心炸彈', hits: 2 },
      { name: '白金蛞蝓獸', img: 'Platinum_Numemon', ult: '白金便便', hits: 3 }],
    moves: ['poop', 'bite'] },
  gottsumon:  { name: '岩石獸',   img: 'Gottsumon', emoji: '🪨', attr: 'data',    hp: 42, atk: 10, def: 10, spd: 7,  flavor: 'shield', desc: '岩石般的身體，攻守兼備', sig: { name: '岩石拳', power: 11 },
    evo: [{ name: '獨角龍獸', img: 'Monochromon', ult: '火焰衝擊' },
      { name: '三角龍獸', img: 'Triceramon', ult: '三角衝角' },
      { name: '古代火山獸', img: 'Ancient_Volcamon', ult: '火山爆發', hits: 2 }],
    moves: ['rock', 'guard', 'bite'] },
  gekomon:    { name: '青蛙獸',   img: 'Gekomon',   emoji: '🎺', attr: 'virus',   hp: 44, atk: 11, def: 8,  spd: 9,  flavor: 'para', desc: '歌聲能麻痺對手', sig: { name: '青蛙之歌', power: 11 },
    evo: [{ name: '殿下青蛙獸', img: 'Tonosama_Gekomon', ult: '震天號角' },
      { name: '鯨魚獸', img: 'Whamon', ult: '潮汐之波' },
      { name: '蛇頸龍獸', img: 'Plesiomon', ult: '死亡之歌' }],
    moves: ['song', 'bite'] },
  shellmon:   { name: '貝殼獸',   img: 'Shellmon',  emoji: '🐚', attr: 'data',    hp: 52, atk: 12, def: 12, spd: 7,  flavor: 'shield', desc: '堅硬的殼能擋下攻擊', sig: { name: '高壓水柱', power: 11 },
    evo: [{ name: '腔棘魚獸', img: 'Coelamon', ult: '鎧甲衝撞' },
      { name: '奇蝦獸', img: 'Anomalocarimon', ult: '暴風之爪', hits: 2 },
      { name: '腕龍獸', img: 'Brachimon', ult: '巨石重擊' }],
    moves: ['water', 'guard', 'heavy'] },
  unimon:     { name: '獨角獸',   img: 'Unimon',    emoji: '🦄', attr: 'vaccine', hp: 46, atk: 13, def: 9,  spd: 12, flavor: 'haste', desc: '飛得又快又遠', sig: { name: '精神炮', power: 11 },
    evo: [{ name: '天馬獸', img: 'Pegasmon', ult: '星光衝擊', hits: 3 },
      { name: '霍茲獸', img: 'Holsmon', ult: '閃光之翼', hits: 2 },
      { name: '斯雷普尼爾獸', img: 'Sleipmon', ult: '比夫羅斯特' }],
    moves: ['charge', 'bite', 'roar'] },
  orgemon:    { name: '大鬼獸',   img: 'Orgemon',   emoji: '👹', attr: 'virus',   hp: 52, atk: 14, def: 10, spd: 9,  flavor: 'rage', desc: '力氣大，越戰越勇', sig: { name: '霸王拳', power: 11 },
    evo: [{ name: '赤鬼獸', img: 'Fugamon', ult: '鬼神拳' },
      { name: '猛瑪獸', img: 'Mammon', ult: '寒冰長牙' },
      { name: '骷髏猛瑪獸', img: 'Skull_Mammon', ult: '死神長牙', hits: 2 }],
    moves: ['heavy', 'club', 'roar', 'guard'] },
  meramon:    { name: '火焰獸',   img: 'Meramon',   emoji: '🔥', attr: 'data',    hp: 48, atk: 14, def: 8,  spd: 11, flavor: 'burn', desc: '全身是火，攻擊會燒傷對手', sig: { name: '火焰拳', power: 11 },
    evo: [{ name: '藍火焰獸', img: 'Blue_Meramon', ult: '冷焰' },
      { name: '死亡火焰獸', img: 'Death_Meramon', ult: '重金屬火焰' },
      { name: '太陽神獸', img: 'Apollomon', ult: '日冕炎' }],
    moves: ['flame', 'bite', 'roar'] },
  guardromon: { name: '守衛獸',   img: 'Guardromon', emoji: '🤖', attr: 'virus',  hp: 54, atk: 12, def: 13, spd: 7,  flavor: 'shield', desc: '鋼鐵之軀，非常耐打', sig: { name: '毀滅導彈', power: 11 },
    evo: [{ name: '坦克獸', img: 'Tankmon', ult: '重型機槍', hits: 3 },
      { name: '機械人獸', img: 'Andromon', ult: '旋轉刀刃', hits: 2 },
      { name: '高級機械人獸', img: 'Hi_Andromon', ult: '原子光束' }],
    moves: ['missile', 'guard', 'bite'] },
  woodmon:    { name: '樹木獸',   img: 'Woodmon',   emoji: '🌳', attr: 'virus',   hp: 52, atk: 12, def: 10, spd: 8,  flavor: 'poison', desc: '樹液有毒，持續削弱對手', sig: { name: '分枝鑽頭', power: 11 },
    evo: [{ name: '樹人獸', img: 'Jyureimon', ult: '櫻桃炸彈', hits: 2 },
      { name: '花朵獸', img: 'Blossomon', ult: '花朵旋風', hits: 3 },
      { name: '蓮花獸', img: 'Lotusmon', ult: '蓮花之光' }],
    moves: ['branch', 'spore', 'guard'] },
  etemon:     { name: '猴子獸',   img: 'Etemon',    emoji: '🐵', attr: 'virus',   hp: 62, atk: 15, def: 11, spd: 11, flavor: 'para', desc: '歌聲讓對手渾身無力', sig: { name: '愛之小夜曲', power: 11 },
    evo: [{ name: '猴子王', img: 'King_Etemon', ult: '黑暗精神' },
      { name: '鋼鐵猴子獸', img: 'Metal_Etemon', ult: '黑暗精神DX' },
      { name: '閃電獸', img: 'Boltmon', ult: '戰斧旋風', hits: 2 }],
    moves: ['serenade', 'darkspirit', 'roar'] },
  skullgreymon:{ name: '骷髏暴龍獸', img: 'Skull_Greymon', emoji: '💀', attr: 'virus', hp: 72, atk: 18, def: 12, spd: 10, flavor: 'pierce', desc: '骨頭身體的攻擊能貫穿防禦', sig: { name: '地獄導彈', power: 11 },
    evo: [{ name: '機械暴龍獸（病毒）', img: 'Metal_Greymon_(Virus)', ult: '巨型毀滅者', hits: 2 },
      { name: '黑色戰鬥暴龍獸', img: 'Black_War_Greymon', ult: '黑暗蓋亞炮' },
      { name: '暗黑龍獸', img: 'Darkdramon', ult: '數碼十字', hits: 3 }],
    moves: ['groundzero', 'bite', 'roar'] },
  // ----- 第二部以後的敵人（p2 = 第二部起才會從蛋裡孵出；fixed = 原作就不會進化，只有原本的型態） -----
  gazimon:    { name: '加奇獸',   img: 'Gazimon',     emoji: '🐰', attr: 'virus', hp: 46, atk: 13, def: 8,  spd: 12, moves: ['bite', 'electric', 'roar'], p2: true, flavor: 'para', desc: '電擊會麻痺對手', sig: { name: '麻痺吐息', power: 10 },
    evo: [{ name: '黑加魯魯獸', img: 'Garurumon_(Black)', ult: '黑色狐火' },
          { name: '黑色獸人加魯魯', img: 'Were_Garurumon_(Black)', ult: '凱撒之爪', hits: 2 },
          { name: '鋼鐵加魯魯', img: 'Metal_Garurumon', ult: '冰河吐息' }] },
  kokatorimon:{ name: '雞頭怪獸', img: 'Kokatorimon', emoji: '🐓', attr: 'data',  hp: 56, atk: 13, def: 10, spd: 8,  moves: ['stoneglare', 'bite', 'guard'], p2: true, flavor: 'para', desc: '石化凝視讓對手動彈不得', sig: { name: '石化凝視', power: 11 },
    evo: [{ name: '巴多拉獸', img: 'Birdramon', ult: '流星之翼', hits: 3 },
          { name: '迦樓羅獸', img: 'Garudamon', ult: '火焰之翼', hits: 2 },
          { name: '鳳凰獸', img: 'Hououmon', ult: '星光爆發' }] },
  otamamon:   { name: '蝌蚪獸',   img: 'Otamamon',    emoji: '🐸', attr: 'virus', hp: 42, atk: 11, def: 8,  spd: 10, moves: ['water', 'song', 'bite'], p2: true, flavor: 'delay', desc: '歌聲能把對手的行動條往回拉', sig: { name: '蝌蚪之歌', power: 10 },
    evo: [{ name: '青蛙獸', img: 'Gekomon', ult: '青蛙之歌' },
          { name: '殿下青蛙獸', img: 'Tonosama_Gekomon', ult: '震天號角' },
          { name: '蛇頸龍獸', img: 'Plesiomon', ult: '死亡之歌' }] },
  tyranomon:  { name: '恐龍獸',   img: 'Tyranomon',   emoji: '🦖', attr: 'data',  hp: 62, atk: 15, def: 11, spd: 8,  moves: ['flame', 'bite', 'heavy'], p2: true, flavor: 'burn', desc: '火焰吐息會燒傷對手', sig: { name: '火焰吐息', power: 11 },
    evo: [{ name: '黑暴龍獸', img: 'Dark_Tyranomon', ult: '火焰之息' },
          { name: '機械暴龍獸（病毒）', img: 'Metal_Greymon_(Virus)', ult: '巨型毀滅者', hits: 2 },
          { name: '戰鬥暴龍獸', img: 'War_Greymon', ult: '蓋亞能量炮' }] },
  nanimon:    { name: '納尼獸',   img: 'Nanimon',     emoji: '🕶️', attr: 'virus', hp: 54, atk: 15, def: 9,  spd: 11, moves: ['heavy', 'rock', 'roar'], p2: true, flavor: 'rage', desc: '越打越火大，攻擊越來越強', sig: { name: '納尼拳', power: 11 },
    evo: [{ name: '猴子獸', img: 'Etemon', ult: '愛之小夜曲' },
          { name: '猴子王', img: 'King_Etemon', ult: '黑暗精神' },
          { name: '鋼鐵猴子獸', img: 'Metal_Etemon', ult: '黑暗精神DX' }] },
  // 第五章：金字塔
  tankmon:    { name: '坦克獸',   img: 'Tankmon',     emoji: '🚜', attr: 'data',  hp: 60, atk: 14, def: 14, spd: 6,  moves: ['gatling', 'missile', 'guard'], p2: true, flavor: 'shield', desc: '鋼鐵車身，攻擊同時獲得護盾', sig: { name: '加農砲', power: 11 },
    evo: [{ name: '守衛獸', img: 'Guardromon', ult: '毀滅導彈' },
          { name: '機械人獸', img: 'Andromon', ult: '旋轉刀刃', hits: 2 },
          { name: '高級機械人獸', img: 'Hi_Andromon', ult: '原子光束' }] },
  kuwagamon:  { name: '鍬形獸',   img: 'Kuwagamon',   emoji: '🪲', attr: 'virus', hp: 54, atk: 16, def: 10, spd: 11, moves: ['scissor', 'bite', 'roar'], p2: true, flavor: 'pierce', desc: '大剪刀能貫穿防禦', sig: { name: '剪刀臂', power: 11 },
    evo: [{ name: '比多獸', img: 'Kabuterimon', ult: '超級雷電' },
          { name: '大鍬形獸', img: 'Okuwamon', ult: '雙重剪刀', hits: 2 },
          { name: '巨大鍬形獸', img: 'Gran_Kuwagamon', ult: '次元剪刀' }] },
  deltamon:   { name: '三頭獸',   img: 'Deltamon',    emoji: '🐲', attr: 'virus', hp: 58, atk: 15, def: 11, spd: 9,  moves: ['tripleforce', 'bite', 'guard'], p2: true, flavor: 'rage', desc: '三顆頭一起發威，越戰越勇', sig: { name: '三重力量', power: 11 },
    evo: [{ name: '惡魔龍獸', img: 'Devidramon', ult: '紅色魔眼' },
          { name: '百萬龍獸', img: 'Megadramon', ult: '暗黑導彈', hits: 2 },
          { name: '暗黑龍獸', img: 'Darkdramon', ult: '數碼十字', hits: 3 }] },
  datamon:    { name: '數據獸',   img: 'Datamon',     emoji: '🤖', attr: 'virus', hp: 58, atk: 15, def: 12, spd: 10, moves: ['electric', 'missile', 'guard', 'regen'], p2: true, flavor: 'shield', desc: '電腦護盾擋下攻擊', sig: { name: '數位炸彈', power: 11 }, fixed: true },
  okuwamon:   { name: '大鍬形獸', img: 'Okuwamon',    emoji: '🪲', attr: 'virus', hp: 66, atk: 17, def: 12, spd: 10, moves: ['doublescissor', 'scissor', 'roar'], p2: true, flavor: 'pierce', desc: '雙重剪刀能貫穿防禦', sig: { name: '雙重剪刀', power: 11 }, fixed: true },
  // 第六章：東京
  bakemon:    { name: '幽靈獸',   img: 'Bakemon',     emoji: '👻', attr: 'virus', hp: 48, atk: 14, def: 9,  spd: 11, moves: ['hellhand', 'bite', 'guard'], p2: true, flavor: 'poison', desc: '陰森的手會慢慢削弱對手', sig: { name: '地獄之手', power: 10 },
    evo: [{ name: '惡魔獸', img: 'Devimon', ult: '死亡之爪' },
          { name: '死神獸', img: 'Phantomon', ult: '暗影鐮刀', hits: 2 },
          { name: '小丑皇', img: 'Piemon', ult: '王牌之劍', hits: 3 }] },
  picodevimon:{ name: '小惡魔獸', img: 'Pico_Devimon', emoji: '🦇', attr: 'virus', hp: 42, atk: 14, def: 8,  spd: 14, moves: ['darkwing', 'bite', 'roar'], p2: true, flavor: 'haste', desc: '小小的翅膀飛得很快', sig: { name: '小惡魔之鏢', power: 10 },
    evo: [{ name: '惡魔獸', img: 'Devimon', ult: '死亡之爪' },
          { name: '吸血魔獸', img: 'Vamdemon', ult: '夜之掠奪者', hits: 3 },
          { name: '吸血魔王獸', img: 'Venom_Vamdemon', ult: '毒液注入' }] },
  mummymon:   { name: '木乃伊獸', img: 'Mummymon',    emoji: '🧟', attr: 'virus', hp: 60, atk: 16, def: 12, spd: 9,  moves: ['snakebandage', 'heavy', 'guard'], p2: true, flavor: 'poison', desc: '詛咒繃帶持續削弱對手', sig: { name: '蛇之繃帶', power: 11 }, fixed: true },
  gesomon:    { name: '蓋索獸',   img: 'Gesomon',     emoji: '🦑', attr: 'virus', hp: 56, atk: 15, def: 11, spd: 9,  moves: ['water', 'bite', 'guard'], p2: true, flavor: 'delay', desc: '觸手纏住對手，拉慢行動條', sig: { name: '珊瑚碎擊', power: 11 },
    evo: [{ name: '章魚獸', img: 'Octmon', ult: '墨汁炮' },
          { name: '海魔獸', img: 'Marin_Devimon', ult: '冰凍之觸', hits: 2 },
          { name: '蛇頸龍獸', img: 'Plesiomon', ult: '死亡之歌' }] },
  wizarmon:   { name: '巫師獸',   img: 'Wizarmon',    emoji: '🧙', attr: 'data',  hp: 52, atk: 15, def: 10, spd: 12, moves: ['thunderball', 'guard', 'regen'], p2: true, flavor: 'holy', desc: '魔法能淨化敵人的強化與護盾', sig: { name: '雷電球', power: 11 },
    evo: [{ name: '天使獸', img: 'Angemon', ult: '天堂之拳' },
          { name: '神聖天使獸', img: 'Holy_Angemon', ult: '天國之門' },
          { name: '熾天使獸', img: 'Seraphimon', ult: '七重天', hits: 3 }] },
  phantomon:  { name: '死神獸',   img: 'Phantomon',   emoji: '💀', attr: 'virus', hp: 62, atk: 17, def: 11, spd: 12, moves: ['shadowscythe', 'darkwing', 'roar'], p2: true, flavor: 'pierce', desc: '死神鐮刀無視護盾', sig: { name: '暗影鐮刀', power: 11 }, fixed: true },
  vamdemon:   { name: '吸血魔獸', img: 'Vamdemon',    emoji: '🧛', attr: 'virus', hp: 66, atk: 17, def: 12, spd: 13, moves: ['nightraid', 'bloodylash', 'roar', 'guard'] },
  venomvamdemon:{ name: '吸血魔王獸', img: 'Venom_Vamdemon', emoji: '👹', attr: 'virus', hp: 70, atk: 18, def: 12, spd: 13, moves: ['venominfuse'] },
  // 第三部・第七章：螺旋山（海與森林）
  seadramon:  { name: '海龍獸',   img: 'Seadramon',   emoji: '🐉', attr: 'data',  hp: 60, atk: 16, def: 11, spd: 10, dragon: true, moves: ['water', 'bite', 'guard'], p2: true, flavor: 'para', desc: '冰之箭會凍得對手動不了', sig: { name: '冰之箭', power: 11 },
    evo: [{ name: '邪惡海龍獸', img: 'Waru_Seadramon', ult: '邪惡冰柱' },
          { name: '超級海龍獸', img: 'Mega_Seadramon', ult: '雷擊標槍' },
          { name: '鋼鐵海龍獸', img: 'Metal_Seadramon', ult: '能量洪流' }] },
  hangyomon:  { name: '潛水獸',   img: 'Hangyomon',   emoji: '🐟', attr: 'data',  hp: 56, atk: 16, def: 10, spd: 12, moves: ['harpoon', 'water', 'bite'], p2: true, flavor: 'delay', desc: '魚叉能把對手的行動條往回拉', sig: { name: '魚叉砲', power: 11 }, fixed: true },
  octmon:     { name: '章魚獸',   img: 'Octmon',      emoji: '🐙', attr: 'virus', hp: 54, atk: 15, def: 10, spd: 11, moves: ['inkgun', 'bite', 'guard'], p2: true, flavor: 'poison', desc: '墨汁有毒，持續削弱對手', sig: { name: '墨汁炮', power: 10 },
    evo: [{ name: '蓋索獸', img: 'Gesomon', ult: '珊瑚碎擊' },
          { name: '超級海龍獸', img: 'Mega_Seadramon', ult: '雷擊標槍' },
          { name: '鋼鐵海龍獸', img: 'Metal_Seadramon', ult: '能量洪流' }] },
  coelamon:   { name: '腔棘魚獸', img: 'Coelamon',    emoji: '🐠', attr: 'data',  hp: 64, atk: 15, def: 14, spd: 7,  moves: ['heavy', 'guard', 'bite'], p2: true, flavor: 'shield', desc: '古老的硬鱗能擋下攻擊', sig: { name: '鎧甲衝撞', power: 11 },
    evo: [{ name: '鯨魚獸', img: 'Whamon', ult: '潮汐之波' },
          { name: '奇蝦獸', img: 'Anomalocarimon', ult: '暴風之爪', hits: 2 },
          { name: '腕龍獸', img: 'Brachimon', ult: '巨石重擊' }] },
  vegiemon:   { name: '蔬菜獸',   img: 'Vegiemon',    emoji: '🥬', attr: 'virus', hp: 56, atk: 15, def: 10, spd: 10, moves: ['spore', 'branch', 'bite'], p2: true, flavor: 'poison', desc: '有毒的藤蔓持續削減對手 HP', sig: { name: '甜蜜之息', power: 10 },
    evo: [{ name: '樹木獸', img: 'Woodmon', ult: '分枝鑽頭' },
          { name: '花朵獸', img: 'Blossomon', ult: '花朵旋風', hits: 3 },
          { name: '蓮花獸', img: 'Lotusmon', ult: '蓮花之光' }] },
  kiwimon:    { name: '奇異鳥獸', img: 'Kiwimon',     emoji: '🥝', attr: 'data',  hp: 52, atk: 16, def: 9,  spd: 13, moves: ['peckpeck', 'bite', 'roar'], p2: true, flavor: 'haste', desc: '跑得飛快，能多次行動', sig: { name: '啄啄炸彈', power: 10 },
    evo: [{ name: '仙人掌獸', img: 'Togemon', ult: '千刺拳', hits: 4 },
          { name: '百合獸', img: 'Lilimon', ult: '花之炮' },
          { name: '薔薇獸', img: 'Rosemon', ult: '禁忌的誘惑', hits: 2 }] },
  megaseadramon:{ name: '超級海龍獸', img: 'Mega_Seadramon', emoji: '🐲', attr: 'data', hp: 70, atk: 18, def: 13, spd: 11, dragon: true, moves: ['thunderjavelin', 'water', 'guard'], p2: true, flavor: 'para', desc: '雷擊會麻痺對手', sig: { name: '雷擊標槍', power: 11 }, fixed: true },
  marindevimon:{ name: '海魔獸',  img: 'Marin_Devimon', emoji: '🦑', attr: 'virus', hp: 68, atk: 18, def: 12, spd: 10, moves: ['deathclaw', 'inkgun', 'roar'], p2: true, flavor: 'delay', desc: '觸手纏住對手，拉慢行動條', sig: { name: '冰凍之觸', power: 11 }, fixed: true },
  metalseadramon:{ name: '鋼鐵海龍獸', img: 'Metal_Seadramon', emoji: '🐉', attr: 'data', hp: 72, atk: 19, def: 14, spd: 12, dragon: true, moves: ['ultimatestream', 'tidecrash', 'guard'] },
  pinochimon: { name: '木偶獸',   img: 'Pinochimon',  emoji: '🎭', attr: 'virus', hp: 66, atk: 18, def: 12, spd: 14, moves: ['bulletsummer', 'pinocchihammer', 'roar'] },
  // 第三部・第八章：機械邪龍獸的工廠
  mechanorimon:{ name: '機械騎士獸', img: 'Mechanorimon', emoji: '🤖', attr: 'data', hp: 60, atk: 16, def: 13, spd: 9,  moves: ['twinbeam', 'missile', 'guard'], p2: true, flavor: 'shield', desc: '機甲外殼非常耐打', sig: { name: '雙子光束', power: 11 },
    evo: [{ name: '坦克獸', img: 'Tankmon', ult: '重型機槍', hits: 3 },
          { name: '數據獸', img: 'Datamon', ult: '數位炸彈' },
          { name: '機械邪龍獸', img: 'Mugendramon', ult: '無限大砲' }] },
  mamemon:    { name: '豆豆獸',   img: 'Mamemon',     emoji: '🥜', attr: 'data',  hp: 46, atk: 18, def: 10, spd: 14, moves: ['smilebomb', 'bite', 'roar'], p2: true, flavor: 'rage', desc: '小小的身體藏著大大的力氣', sig: { name: '微笑炸彈', power: 11 }, fixed: true },
  thunderballmon:{ name: '雷球獸', img: 'Thunderballmon', emoji: '⚡', attr: 'data', hp: 50, atk: 15, def: 10, spd: 13, moves: ['electric', 'thunderjavelin', 'bite'], p2: true, flavor: 'para', desc: '雷電攻擊會麻痺對手', sig: { name: '雷電球', power: 11 },
    evo: [{ name: '比多獸', img: 'Kabuterimon', ult: '超級雷電' },
          { name: '超比多獸', img: 'Atlur_Kabuterimon_(Red)', ult: '巨角衝擊' },
          { name: '赫拉克比多獸', img: 'Herakle_Kabuterimon', ult: '雷電加農炮' }] },
  raremon:    { name: '腐爛獸',   img: 'Raremon',     emoji: '🦠', attr: 'virus', hp: 64, atk: 15, def: 9,  spd: 7,  moves: ['spore', 'heavy', 'bite'], p2: true, flavor: 'poison', desc: '腐爛的身體會讓對手中毒', sig: { name: '腐爛污泥', power: 10 },
    evo: [{ name: '黏液獸', img: 'Geremon', ult: '黏液炸彈' },
          { name: '外星獸', img: 'Vademon', ult: '飛碟光線' },
          { name: '閃電獸', img: 'Boltmon', ult: '戰斧旋風', hits: 2 }] },
  megadramon: { name: '百萬龍獸', img: 'Megadramon',  emoji: '🐉', attr: 'virus', hp: 72, atk: 19, def: 13, spd: 11, dragon: true, moves: ['genocideattack', 'ultimateslicer', 'roar'], p2: true, flavor: 'burn', desc: '暗黑導彈會燒傷對手', sig: { name: '暗黑導彈', power: 11 }, fixed: true },
  gigadramon: { name: '千兆龍獸', img: 'Gigadramon',  emoji: '🐉', attr: 'virus', hp: 74, atk: 19, def: 13, spd: 10, dragon: true, moves: ['genocideattack', 'ultimateslicer', 'guard'], p2: true, flavor: 'burn', desc: '暗黑導彈會燒傷對手', sig: { name: '暗黑導彈', power: 11 }, fixed: true },
  mugendramon:{ name: '機械邪龍獸', img: 'Mugendramon', emoji: '🦾', attr: 'virus', hp: 78, atk: 20, def: 16, spd: 10, dragon: true, moves: ['mugenclaw', 'mugenrocket', 'guard'] },
  // 第三部・第九章：小丑皇的遊樂園
  devidramon: { name: '惡魔龍獸', img: 'Devidramon',  emoji: '😈', attr: 'virus', hp: 62, atk: 18, def: 11, spd: 12, dragon: true, moves: ['redeye', 'darkwing', 'bite'], p2: true, flavor: 'pierce', desc: '紅色魔眼看穿一切防禦', sig: { name: '紅色魔眼', power: 11 },
    evo: [{ name: '黑暴龍獸', img: 'Dark_Tyranomon', ult: '火焰之息' },
          { name: '骷髏暴龍獸', img: 'Skull_Greymon', ult: '地獄導彈' },
          { name: '黑色戰鬥暴龍獸', img: 'Black_War_Greymon', ult: '黑暗蓋亞炮' }] },
  vademon:    { name: '外星獸',   img: 'Vademon',     emoji: '👽', attr: 'virus', hp: 52, atk: 17, def: 10, spd: 12, moves: ['uforay', 'bite', 'guard'], p2: true, flavor: 'para', desc: '飛碟光線讓對手動彈不得', sig: { name: '飛碟光線', power: 11 }, fixed: true },
  dokugumon:  { name: '毒蜘蛛獸', img: 'Dokugumon',   emoji: '🕷️', attr: 'virus', hp: 58, atk: 16, def: 11, spd: 11, moves: ['spore', 'bite', 'guard'], p2: true, flavor: 'poison', desc: '毒絲持續削減對手 HP', sig: { name: '毒蜘蛛絲', power: 10 },
    evo: [{ name: '惡魔獸', img: 'Devimon', ult: '死亡之爪' },
          { name: '女惡魔獸', img: 'Lady_Devimon', ult: '黑暗波動', hits: 3 },
          { name: '莉莉絲獸', img: 'Lilithmon', ult: '魔王之爪' }] },
  deathmeramon:{ name: '死亡火焰獸', img: 'Death_Meramon', emoji: '🔥', attr: 'virus', hp: 66, atk: 19, def: 11, spd: 11, moves: ['heavymetalfire', 'flame', 'roar'], p2: true, flavor: 'burn', desc: '重金屬火焰會燒傷對手', sig: { name: '重金屬火焰', power: 11 }, fixed: true },
  ladydevimon:{ name: '女惡魔獸', img: 'Lady_Devimon', emoji: '🦇', attr: 'virus', hp: 70, atk: 20, def: 12, spd: 13, moves: ['darknesswave', 'deathclaw', 'roar'], p2: true, flavor: 'haste', desc: '黑暗之翼飛得很快', sig: { name: '黑暗波動', power: 11 }, fixed: true },
  skullsatamon:{ name: '骷髏撒旦獸', img: 'Skull_Satamon', emoji: '💀', attr: 'virus', hp: 72, atk: 20, def: 13, spd: 11, moves: ['nailbone', 'darkwing', 'guard'], p2: true, flavor: 'holy', desc: '骨杖能打散敵人的強化與護盾', sig: { name: '骨釘杖', power: 11 }, fixed: true },
  piemon:     { name: '小丑皇',   img: 'Piemon',      emoji: '🃏', attr: 'virus', hp: 80, atk: 21, def: 15, spd: 13, moves: ['trumpsword', 'clownslash', 'roar'] },
  metaletemon:{ name: '機械猴子獸', img: 'Metal_Etemon', emoji: '🦍', attr: 'virus', hp: 68, atk: 16, def: 11, spd: 11, moves: ['darkspiritdx', 'metalpunch', 'guard', 'roar'] },
  andromon:   { name: '機械人獸', img: 'Andromon',  emoji: '🦾', attr: 'vaccine', hp: 60, atk: 15, def: 13, spd: 10, moves: ['spiral', 'missile', 'guard'] },
  jyureimon:  { name: '樹人獸',   img: 'Jyureimon', emoji: '🌲', attr: 'virus',   hp: 64, atk: 14, def: 11, spd: 9,  moves: ['cherry', 'branch', 'spore', 'regen'] },
  devimon:    { name: '惡魔獸',   img: 'Devimon',   emoji: '😈', attr: 'virus',   hp: 62, atk: 16, def: 11, spd: 12, moves: ['deathclaw', 'darkwing', 'roar', 'guard', 'regen'] },
  // 劇情 NPC（不戰鬥）
  jijimon:    { name: '長老獸',   img: 'Jijimon',   emoji: '👴' },
  leomon:     { name: '獅子獸',   img: 'Leomon',    emoji: '🦁' },
  monzaemon:  { name: '玩偶獸',   img: 'Monzaemon', emoji: '🧸' },
};

// ---------- 招式附加效果 ----------
function flavor(kind, t) {
  switch (kind) {
    case 'burn':   return t === 0 ? { desc: () => '40% 燒傷 2 回合', fx: () => chanceStatus(B.e, 'burn', 2, .4) }
                                  : { desc: () => `燒傷 ${t + 1} 回合`, fx: () => addStatus(B.e, 'burn', t + 1) };
    case 'shield': { const v = () => blockVal(3 + t * 4, .04 + t * .02); return { desc: () => `獲得 ${v()} 護盾`, fx: () => gainBlock(B.p, v()) }; }
    case 'haste':  { const n = 2 + Math.floor(t / 2); return { desc: () => `加速 ${n} 回合`, fx: () => addStatus(B.p, 'haste', n) }; }
    case 'heal':   { const pc = [5, 10, 14, 18][t]; return { desc: () => `回復 ${pc}% HP`, fx: () => healF(B.p, Math.round(B.p.maxhp * pc / 100)) }; }
    case 'holy':   return { desc: () => t === 0 ? '淨化：解除敵人的攻擊↑' : `淨化：解除攻擊↑和護盾<br>受傷↑ ${t} 回合`,
                            fx: () => { if (B.e.st.atkUp) delete B.e.st.atkUp; if (t) { B.e.block = 0; addStatus(B.e, 'expose', t); } floatText(B.e, '✨ 淨化', 'info', 60); } };
    case 'delay':  { const n = 30 + t * 12; return { desc: () => `敵人行動條 -${n}%`, fx: () => pushGauge(B.e, -n) }; }
    case 'poison': { const n = 3 + t; return { desc: () => `中毒 ${n} 回合`, fx: () => addStatus(B.e, 'poison', n) }; }
    case 'para':   { const c = t === 0 ? .35 : .5 + t * .15, n = t === 0 ? 1 : 2;
                     return { desc: () => `${Math.round(c * 100)}% 麻痺 ${n} 回合`, fx: () => chanceStatus(B.e, 'para', n, c) }; }
    case 'pierce': return { desc: () => '無視護盾', pierce: true };
    case 'rage':   { const n = t + 1; return { desc: () => `攻擊↑ ${n} 回合`, fx: () => addStatus(B.p, 'atkUp', n) }; }
  }
  return { desc: () => '' };
}

// ---------- 卡片描述用 ----------
function curDef() { return B ? B.p.def : (RUN && RUN.team[0]) ? memberStats(RUN.team[0]).def : 10; }
// 友情之力的次數：每 2 隻夥伴多 1 下（算到 6 隻），超過 6 隻每隻 +1，最少 1 下
function friendHits() { const n = B ? B.fighters.filter(f => f.hp > 0).length : (RUN ? RUN.team.length : 1); return Math.max(1, Math.floor(Math.min(n, 6) / 2) + Math.max(0, n - 6)); }
// 希望之光能進化到的最高階段
const hopeTier = f => Math.min(tierCap(f), f.m.level >= TIERS[3].lv ? 3 : f.m.level >= TIERS[2].lv ? 2 : 1);   // 只有隊長能超進化以上，其他夥伴最多到成熟期
const hpPct = (f, pc) => Math.round(f.maxhp * pc);
// 護盾量 = 基礎值 ＋ 出戰夥伴最大 HP × 比例（進化後 HP 變大，護盾也跟著變大）
function curMaxHp() { return B ? B.p.maxhp : (RUN && RUN.team[0]) ? memberStats(RUN.team[0]).maxhp : 60; }
function blockVal(base, pct) { return Math.round(base + curMaxHp() * pct); }
function dmgTxt(power, hits = 1) {
  const s = (B && B.e) ? `<b>${Math.max(1, Math.round(calcRaw(B.p, B.e, power)))}</b>` : `威力${power}`;
  return hits > 1 ? `${s} ×${hits}` : s;
}

// ---------- 通用卡片（u = 是否強化過，強化後名稱多一個 +） ----------
const CARDS = {
  strike: { name: '撞擊',     cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 9 : 6)} 傷害`, fx: u => hit(u ? 9 : 6) },
  guard:  { name: '防禦',     cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 8 : 5, u ? .13 : .10)} 護盾`, fx: u => gainBlock(B.p, blockVal(u ? 8 : 5, u ? .13 : .10)) },
  focus:  { name: '鼓起勇氣', cost: 0, type: 'skill', desc: u => `勇氣值 +${u ? 12 : 8}<br>抽 1 張牌`, fx: u => { gainCourage(u ? 12 : 8, true); drawCards(1); } },
  double: { name: '連續攻擊', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(4, u ? 3 : 2)} 傷害`, fx: u => hit(4, u ? 3 : 2) },
  heavy:  { name: '全力衝撞', cost: 2, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 22 : 16)} 傷害`, fx: u => hit(u ? 22 : 16) },
  wall:   { name: '鐵壁',     cost: 2, type: 'skill', desc: u => `獲得 ${blockVal(u ? 16 : 12, u ? .26 : .20)} 護盾`, fx: u => gainBlock(B.p, blockVal(u ? 16 : 12, u ? .26 : .20)) },
  haste:  { name: '疾風',     cost: 1, type: 'skill', desc: u => `加速 ${u ? 4 : 3} 回合<br><small>行動條 ×1.5</small>`, fx: u => addStatus(B.p, 'haste', u ? 4 : 3) },
  heal:   { name: '回復晶片', cost: 1, type: 'skill', exhaust: true, desc: u => `回復 ${u ? 35 : 25}% HP<br><small>本場用過即移除</small>`, fx: u => healF(B.p, hpPct(B.p, u ? .35 : .25)) },
  jam:    { name: '干擾電波', cost: 1, type: 'skill', desc: u => `敵人行動條 -${u ? 70 : 50}%`, fx: u => pushGauge(B.e, u ? -70 : -50) },
  drain:  { name: '能量吸收', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 8 : 5)} 傷害<br>回復一半傷害值`, fx: u => { const d = hit(u ? 8 : 5); healF(B.p, Math.ceil(d / 2), true); } },
  scan:   { name: '數碼掃描', cost: 0, type: 'skill', desc: u => `抽 ${u ? 3 : 2} 張牌`, fx: u => drawCards(u ? 3 : 2) },
  cry:    { name: '戰鬥吶喊', cost: 1, ucost: 0, type: 'power', desc: u => '攻擊↑ 3 回合<br><small>傷害 ×1.3</small>', fx: u => addStatus(B.p, 'atkUp', 3) },
  pierce: { name: '貫穿攻擊', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 8 : 5)} 傷害<br>無視護盾`, fx: u => hit(u ? 8 : 5, 1, { pierce: true }) },
  rush:   { name: '先發制人', cost: 0, type: 'skill', desc: u => `下次行動條<br>從 ${u ? 60 : 40}% 開始`, fx: u => { B.p.nextGauge = Math.min(90, (B.p.nextGauge || 0) + hv(u ? 60 : 40)); } },
  crest:  { name: '勇氣徽章', cost: 1, type: 'power', desc: u => `勇氣值 +${u ? 21 : 15}`, fx: u => gainCourage(u ? 21 : 15, true) },
  hotblood: { name: '熱血吶喊', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 7 : 5)} 傷害<br>勇氣值 +${u ? 5 : 3}`, fx: u => { hit(u ? 7 : 5); gainCourage(u ? 5 : 3, true); } },
  // 劇情獲得
  beastking: { name: '獸王拳', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 18 : 13)} 傷害<br><small>獅子獸傳授的拳法</small>`, fx: u => hit(u ? 18 : 13) },
  // 孩子的專屬起始卡
  reckless:  { name: '捨身衝撞', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 19 : 14)} 傷害<br>自己失去 8% HP`, fx: u => { hit(u ? 19 : 14); const d = Math.max(1, Math.round(B.p.maxhp * .08)); B.p.hp = Math.max(1, B.p.hp - d); floatText(B.p, `-${d}`, 'dot'); } },
  friendship:{ name: '友情之力', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 7 : 5, friendHits())} 傷害<br><small>每 2 隻能戰鬥的夥伴多打 1 下</small>`, fx: u => hit(u ? 7 : 5, friendHits()) },
  tender:    { name: '溫柔守護', cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 8 : 5, u ? .10 : .08)} 護盾<br>回復 ${u ? 12 : 8}% HP`, fx: u => { gainBlock(B.p, blockVal(u ? 8 : 5, u ? .10 : .08)); healF(B.p, hpPct(B.p, u ? .12 : .08)); } },
  analyze:   { name: '弱點分析', cost: 0, type: 'skill', desc: u => `敵人 受傷↑ ${u ? 3 : 2} 回合<br><small>受到的傷害 ×1.3</small>`, fx: u => addStatus(B.e, 'expose', u ? 3 : 2) },
  blossom:   { name: '花之祝福', cost: 1, type: 'skill', desc: u => `勇氣值 +${u ? 12 : 8}<br>回復 ${u ? 12 : 8}% HP`, fx: u => { gainCourage(u ? 12 : 8, true); healF(B.p, hpPct(B.p, u ? .12 : .08)); } },
  prepare:   { name: '萬全準備', cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 13 : 9, u ? .20 : .15)} 護盾<br>清除自己的異常狀態`, fx: u => { gainBlock(B.p, blockVal(u ? 13 : 9, u ? .20 : .15)); ['burn', 'poison', 'para'].forEach(k => delete B.p.st[k]); } },
  hopelight: { name: '希望之光', cost: 0, type: 'power', exhaust: true, permanent: true, noTarget: true,
              canPlay: () => B && !B.p.dark && !B.p.noEvo && !(B.p.sealUntil >= B.turnNo) && hopeTier(B.p) > B.p.tier,
              desc: u => `立刻進化到能達到的最高階段<br>不需勇氣・必定成功${u ? '<br>進化持續 +1 回合' : ''}<br><small>整局只能用一次</small>`,
              fx: u => { log('🕊️ 希望之光！奇蹟發生了！'); doEvolve(B.p, hopeTier(B.p), false); if (u) B.p.evoTurns += 1; } },
  lightward: { name: '光之守護', cost: 2, ucost: 1, type: 'skill', noTarget: true, desc: u => '下一次受到的攻擊<br>完全無效', fx: u => addStatus(B.p, 'ward', 9) },
  friend:    { name: '夥伴的羈絆', cost: 1, type: 'skill', exhaust: true, desc: u => `全隊回復 ${u ? 22 : 15}% HP<br>勇氣值 +10`, fx: u => { B.fighters.forEach(f => { if (f.hp <= 0) return; if (f === B.p) healF(f, hpPct(f, u ? .22 : .15)); else f.hp = Math.min(f.maxhp, f.hp + hv(healAmt(f.maxhp * (u ? .22 : .15)))); }); gainCourage(10, true); } },
  // ---- 商店限定（只能在玩偶獸的商店買到；shop = 價格） ----
  lovebox:   { name: '愛心大放送', cost: 1, type: 'skill', shop: 100, desc: u => `二選一：<br>復活 1 隻倒下的夥伴（${u ? 45 : 30}% HP）<br>或 全隊回復 ${u ? 15 : 10}%＋護盾`, fx: u => loveBox(u) },
  evoext:    { name: '進化延長', cost: 1, ucost: 0, type: 'power', shop: 130, canPlay: () => B && B.p.tier > 0, desc: u => '進化中才能用<br>進化持續 +1 回合', fx: u => { B.p.evoTurns += 1; floatText(B.p, '✨ 進化延長', 'info'); log(`✨ ${B.p.name} 的進化持續時間延長了！`); } },
  allin:     { name: '孤注一擲', cost: 0, type: 'atk', shop: 120, desc: u => `消耗全部勇氣值<br>每 10 點造成 ${dmgTxt(u ? 7 : 5)} 傷害<br><small>目前 ${Math.floor((RUN ? RUN.courage : 0) / 10)} 下</small>`, fx: u => { const n = Math.floor(RUN.courage / 10); RUN.courage = 0; updateCourageUI(); if (n) hit(u ? 7 : 5, n); else floatText(B.p, '勇氣值不夠…', 'info'); } },
  overclock: { name: '超頻晶片', cost: 0, type: 'skill', exhaust: true, shop: 110, desc: u => `能量 +${u ? 3 : 2}<br><small>本場用過即移除</small>`, fx: u => { const n = hv(u ? 3 : 2); B.energy += n; floatText(B.p, `⚡+${n}`, 'info'); } },
  relay:     { name: '交棒連擊', cost: 1, type: 'atk', shop: 100, desc: u => `造成 ${dmgTxt(u ? 9 : 6)} 傷害<br>這回合下一次換手不花能量`, fx: u => { hit(u ? 9 : 6); B.relayFree = true; floatText(B.p, '🔄 換手免費', 'info', 60); } },
  notes:     { name: '戰術筆記', cost: 0, type: 'skill', shop: 90, desc: u => `這回合 📌 保留上限 +1<br>抽 ${u ? 2 : 1} 張牌`, fx: u => { B.pinBonus = 1; drawCards(u ? 2 : 1); } },
  breaker:   { name: '破甲彈', cost: 2, type: 'atk', shop: 150, desc: u => `清除敵人的護盾<br>造成 ${dmgTxt(u ? 15 : 11)} 傷害<br><small>對頭目、精英傷害 ×1.5</small>`, fx: u => { if (B.e.block) { B.e.block = 0; floatText(B.e, '護盾粉碎！', 'info', 60); } hit((u ? 15 : 11) * (B.e.boss || B.e.elite ? 1.5 : 1)); } },
  signal:    { name: '友好訊號', cost: 1, type: 'skill', shop: 90, desc: u => `下一次勸降的成功率 +${u ? 30 : 20}%`, fx: u => { B.e.signal = (B.e.signal || 0) + hv(u ? 30 : 20) / 100; floatText(B.e, '💗 好像願意聽了', 'info', 60); } },
  // ----- 第二部的新卡（p2：只在第二部出現） -----
  spread:    { name: '擴散', cost: 1, type: 'skill', p2: true, noTarget: true, desc: u => '這回合下一張攻擊卡<br>打到<b>所有</b>敵人部位<br><small>只有一個敵人時沒有額外效果</small>', fx: u => { B.aoeTurn = B.turnNo; floatText(B.p, '🌐 擴散', 'info'); } },
  tagres:    { name: '標籤共鳴', cost: 0, type: 'power', p2: true, shop: 500, max: 1, exhaust: true, permanent: true, noTarget: true,
               canPlay: () => B && P2() && RUN.crest && !B.freeCrest, desc: u => '這場戰鬥下一次超進化<br><b>不消耗徽章刻度</b><br><small>用過就從牌組消失</small>', fx: u => { B.freeCrest = true; floatText(B.p, '🔰 標籤共鳴', 'info'); } },
  sandstorm: { name: '沙塵暴', cost: 1, type: 'skill', p2: true, desc: u => `敵人接下來 ${u ? 3 : 2} 次攻擊<br>各有 50% 機率落空`, fx: u => { B.missN = u ? 3 : 2; floatText(B.e, '🌪️ 沙塵暴', 'info', 60); } },
  datasteal: { name: '數據竊取', cost: 1, ucost: 0, type: 'skill', p2: true, desc: u => '偷走敵人身上一個<br>強化效果（攻擊↑、加速、守護、護盾）', fx: u => stealBuff() },
  counter:   { name: '反擊架勢', cost: 1, type: 'skill', p2: true, desc: u => `這回合被攻擊時<br>反彈 ${u ? 70 : 50}% 傷害`, fx: u => { B.counterTurn = B.turnNo; B.counterPct = u ? .7 : .5; floatText(B.p, '↩️ 反擊架勢', 'info'); } },
  charge:    { name: '蓄力一擊', cost: 1, ucost: 0, type: 'skill', p2: true, desc: u => '下一張攻擊卡<br>傷害 ×2', fx: u => { B.chargeNext = true; floatText(B.p, '💥 蓄力', 'info'); } },
  purify:    { name: '淨化', cost: 1, ucost: 0, type: 'skill', shop: 120, noHalf: true, max: 2, desc: u => '清除手牌和出戰夥伴<br>身上的負面效果<br><small>整局最多 2 張</small>', fx: u => purifyAll() },
};
const TYPE_NAME = { atk: '攻擊', skill: '技能', power: '強化', sig: '必殺', ult: '究極' };
const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'sig', 'sig', 'focus'];
const SHOP_POOL = Object.keys(CARDS).filter(k => CARDS[k].shop);   // 商店限定卡
const shopPool = () => SHOP_POOL.filter(k => !CARDS[k].p2 || P2());
const REWARD_POOL = ['double', 'heavy', 'wall', 'haste', 'heal', 'jam', 'drain', 'scan', 'cry', 'pierce', 'rush', 'sig', 'focus', 'crest', 'hotblood', 'hotblood'];
const rewardPool = () => P2() ? [...REWARD_POOL, 'spread', 'sandstorm', 'datasteal', 'counter', 'charge'] : REWARD_POOL;

function sigDef(sp, u) {
  const fl = flavor(sp.flavor, 0), pw = Math.round(sp.sig.power * (u ? 1.4 : 1));
  return { name: sp.sig.name, cost: sp.sig.cost || 2, type: 'sig',
    desc: () => `造成 ${dmgTxt(pw)} 傷害<br>${fl.desc()}${B ? '' : '<br><small>（依出戰夥伴變化）</small>'}`,
    fx: () => { hit(pw, 1, { pierce: fl.pierce }); fl.fx && fl.fx(); } };
}
function ultDef(sp, tier) {
  const ev = sp.evo[tier - 1], hits = ev.hits || 1, fl = flavor(sp.flavor, tier);
  const per = Math.round(TIERS[tier].power / hits * (hits > 1 ? 1.1 : 1) * (RUN && has('ultboost') ? 1.25 : 1));
  return { name: ev.ult, cost: 2, type: 'ult',
    desc: () => `造成 ${dmgTxt(per, hits)} 傷害<br>${fl.desc()}`,
    fx: () => { hit(per, hits, { pierce: fl.pierce }); fl.fx && fl.fx(); } };
}
function cardDef(id) {
  const u = id.endsWith('+'), base = u ? id.slice(0, -1) : id;
  const sp = B ? B.p.sp : (RUN && RUN.team[0]) ? SPECIES[RUN.team[0].sp] : SPECIES.agumon;
  let d;
  if (base === 'sig') d = sigDef(sp, u);
  else if (base === 'ult2') d = ult2Def(B ? B.p.m.sp : 'agumon');   // 第三部：第二究極技
  else if (base === 'ult') { d = (B && B.p.tier > 0) ? ultDef(sp, B.p.tier) : sigDef(sp); if (B && B.p.dark) d = { ...d, name: '暴走・' + d.name }; }
  else {
    const c = CARDS[base];
    d = { name: c.name, cost: u && c.ucost != null ? c.ucost : c.cost, type: c.type, exhaust: c.exhaust, permanent: c.permanent, canPlay: c.canPlay,
          shop: c.shop, noHalf: c.noHalf, noTarget: c.noTarget, max: c.max, desc: () => c.desc(u), fx: () => c.fx(u) };
  }
  return { ...d, name: d.name + (u ? '+' : ''), u };
}
const canUpgrade = id => !id.endsWith('+');

// ---------- 敵人招式 ----------
const MOVES = {
  bite:     { name: '咬擊',     kind: 'atk', power: 7, w: 3 },
  club:     { name: '棍棒揮擊', kind: 'atk', power: 10, w: 2 },
  electric: { name: '電擊',     kind: 'atk', power: 6, status: ['para', 2], chance: .5, w: 2 },
  spore:    { name: '毒孢子',   kind: 'atk', power: 5, status: ['poison', 3], chance: 1, w: 2 },
  gear:     { name: '暗黑齒輪', kind: 'atk', power: 8, status: ['para', 1], chance: .6, w: 2 },
  charge:   { name: '衝角',     kind: 'atk', power: 13, w: 2 },
  heavy:    { name: '重拳',     kind: 'atk', power: 15, w: 1 },
  guard:    { name: '防禦姿態', kind: 'guard', block: 10, w: 1 },
  roar:     { name: '怒吼',     kind: 'buff', status: ['atkUp', 2], w: 1 },
  poop:     { name: '便便攻擊', kind: 'atk', power: 5, status: ['para', 1], chance: .3, w: 3 },
  rock:     { name: '岩石拳',   kind: 'atk', power: 9, w: 3 },
  song:     { name: '青蛙之歌', kind: 'atk', power: 4, status: ['para', 2], chance: .6, w: 2 },
  water:    { name: '高壓水柱', kind: 'atk', power: 11, w: 2 },
  flame:    { name: '火焰拳',   kind: 'atk', power: 9, status: ['burn', 2], chance: .6, w: 3 },
  missile:  { name: '毀滅導彈', kind: 'atk', power: 12, w: 2 },
  branch:   { name: '分枝鑽頭', kind: 'atk', power: 10, w: 2 },
  serenade: { name: '愛之小夜曲', kind: 'atk', power: 6, status: ['para', 2], chance: .7, w: 2 },
  darkspirit:{ name: '黑暗精神', kind: 'atk', power: 14, w: 2 },
  groundzero:{ name: '地獄導彈', kind: 'atk', power: 20, w: 1 },
  spiral:   { name: '旋轉刀刃', kind: 'atk', power: 8, hits: 2, w: 3 },
  cherry:   { name: '櫻桃炸彈', kind: 'atk', power: 7, hits: 2, status: ['poison', 2], chance: .5, w: 3 },
  deathclaw:{ name: '死亡之手', kind: 'atk', power: 16, status: ['para', 2], chance: .5, w: 2 },
  darkwing: { name: '黑暗之翼', kind: 'atk', power: 6, hits: 2, w: 3 },
  stoneglare:{ name: '石化凝視', kind: 'atk', power: 8, status: ['para', 2], chance: .5, w: 2 },
  loveSerenade:{ name: '愛之小夜曲・全力', kind: 'serenade', w: 0 },
  gatling:  { name: '重型機槍', kind: 'atk', power: 4, hits: 3, w: 2 },
  scissor:  { name: '剪刀臂',   kind: 'atk', power: 12, w: 3 },
  doublescissor:{ name: '雙重剪刀', kind: 'atk', power: 8, hits: 2, w: 2 },
  tripleforce:{ name: '三重力量', kind: 'atk', power: 5, hits: 3, w: 2 },
  darkspiritdx:{ name: '黑暗精神DX', kind: 'atk', power: 16, w: 2 },
  metalpunch:{ name: '鋼鐵重拳', kind: 'atk', power: 8, hits: 2, w: 3 },
  hellhand: { name: '地獄之手', kind: 'atk', power: 8, status: ['para', 1], chance: .4, w: 3 },
  snakebandage:{ name: '蛇之繃帶', kind: 'atk', power: 8, hits: 2, w: 3 },
  thunderball:{ name: '雷電球', kind: 'atk', power: 11, status: ['para', 2], chance: .4, w: 3 },
  shadowscythe:{ name: '暗影鐮刀', kind: 'atk', power: 16, w: 2 },
  nightraid:{ name: '夜襲',     kind: 'atk', power: 14, w: 2 },
  bloodylash:{ name: '血腥鞭',  kind: 'atk', power: 8, hits: 2, w: 3 },
  venominfuse:{ name: '毒液注入', kind: 'atk', power: 17, w: 2 },
  venomclaw:{ name: '魔王之爪', kind: 'atk', power: 9, hits: 2, w: 3 },
  venomwing:{ name: '黑暗之翼', kind: 'support', w: 1 },
  venomarm: { name: '毒之臂',   kind: 'atk', power: 7, status: ['poison', 3], chance: 1, pol: 1, w: 2 },
  venompush:{ name: '魔王之壓', kind: 'atk', power: 6, push: -40, w: 1 },
  harpoon:  { name: '魚叉',     kind: 'atk', power: 12, w: 3 },
  inkgun:   { name: '墨汁噴射', kind: 'atk', power: 7, status: ['para', 1], chance: .5, w: 3 },
  peckpeck: { name: '連續啄擊', kind: 'atk', power: 5, hits: 3, w: 3 },
  thunderjavelin:{ name: '雷擊標槍', kind: 'atk', power: 15, status: ['para', 1], chance: .4, w: 2 },
  ultimatestream:{ name: '終極激流', kind: 'atk', power: 18, w: 2 },
  tidecrash:{ name: '巨浪衝擊', kind: 'atk', power: 8, hits: 2, w: 3 },
  bulletsummer:{ name: '子彈夏天', kind: 'atk', power: 6, hits: 3, w: 3 },
  pinocchihammer:{ name: '木偶之錘', kind: 'atk', power: 15, w: 2 },
  twinbeam: { name: '雙重光束', kind: 'atk', power: 6, hits: 2, w: 3 },
  smilebomb:{ name: '微笑炸彈', kind: 'atk', power: 14, w: 2 },
  genocideattack:{ name: '種族滅絕攻擊', kind: 'atk', power: 6, hits: 3, w: 2 },
  ultimateslicer:{ name: '終極切割', kind: 'atk', power: 16, w: 2 },
  mugenclaw:{ name: '無限之爪', kind: 'atk', power: 9, hits: 2, w: 3 },
  mugenrocket:{ name: '無限火箭', kind: 'atk', power: 14, w: 2 },
  infinitycannon:{ name: '無限大砲', kind: 'cannon', w: 0 },
  redeye:   { name: '紅色魔眼', kind: 'atk', power: 9, status: ['para', 1], chance: .4, w: 3 },
  uforay:   { name: '飛碟光線', kind: 'atk', power: 11, w: 3 },
  heavymetalfire:{ name: '重金屬火焰', kind: 'atk', power: 13, status: ['burn', 2], chance: .5, w: 3 },
  darknesswave:{ name: '黑暗波動', kind: 'atk', power: 6, hits: 3, w: 2 },
  nailbone: { name: '骨釘杖',   kind: 'atk', power: 16, w: 2 },
  trumpsword:{ name: '撲克劍',  kind: 'atk', power: 6, hits: 4, w: 3 },
  clownslash:{ name: '小丑斬擊', kind: 'atk', power: 16, w: 2 },
  keychain: { name: '鑰匙圈魔術', kind: 'keychain', w: 0 },
  regen:    { name: '黑暗再生', kind: 'heal', heal: .12, w: 1 },
  deathmark:{ name: '死亡宣告', kind: 'doom', w: 0 },
};

// =========================================================
//   徽章道具（被動效果）
// =========================================================
const RELICS = {
  courage:   { name: '勇氣徽章', icon: '🔥', desc: '每場戰鬥開始時，勇氣值 +10' },
  friendship:{ name: '友情徽章', icon: '🤝', desc: '換手不消耗能量（大和：每回合第一次換手時抽 1 張牌）' },
  love:      { name: '愛心徽章', icon: '💗', desc: '戰鬥勝利後，全隊回復 10% HP' },
  knowledge: { name: '知識徽章', icon: '📘', desc: '每回合多抽 1 張牌' },
  sincerity: { name: '誠實徽章', icon: '💧', desc: '每回合開始時獲得 4 點護盾' },
  purity:    { name: '純真徽章', icon: '🌟', desc: '回復泉的回復量提高' },
  hope:      { name: '希望徽章', icon: '🕊️', desc: '第一次全滅時，全隊以 30% HP 復活（只有一次）' },
  light:     { name: '光明徽章', icon: '☀️', desc: '每場戰鬥第一回合能量 +1' },
  digivice:  { name: '神聖計畫', icon: '📟', desc: '進化持續回合 +1，強行進化成功率 +10%' },
  pureheart: { name: '純潔之心', icon: '🤍', desc: '強行進化時，錯誤進化的機率減半' },
  will:      { name: '堅定意志', icon: '💪', desc: '強行進化時，失敗的機率減半' },
  boots:     { name: '疾風之靴', icon: '👟', desc: '戰鬥開始時行動條 +35%' },
  coin:      { name: '招財貓',   icon: '🐱', desc: '戰鬥獲得的數碼幣 +50%' },
  radar:     { name: '數碼探測器', icon: '📡', desc: '探索地圖時的視野 +2 格' },
  bigbag:    { name: '大背包',   icon: '🎒', desc: '背包上限 +1' },
  ultboost:  { name: '究極強化', icon: '💠', desc: '所有究極技威力 +25%（商店購買）', special: true },
  ultproof:  { name: '究極之證', icon: '🏅', desc: '進化時多拿 1 張究極技卡（隱藏獎勵）', special: true },
  darkgear:  { name: '黑色齒輪', icon: '⚙️', desc: '全隊攻擊 ×1.25，但每回合開始失去 3% HP、進化失控機率 +50%；帶著它打倒惡魔獸會走向黑暗結局（回復泉可以淨化）', dark: true },
  darkpower: { name: '黑暗之力', icon: '🌑', desc: '進化所需勇氣值 -30%，全隊攻擊 ×1.2，但進化失控機率 +50%；帶著它打倒最後的頭目會走向黑暗結局（回復泉可以淨化）', dark: true },
};
const has = k => RUN.relics.includes(k);

// =========================================================
//   背包道具（戰鬥中使用，不花能量；最多帶 4 個，舊存檔 3 個）
// =========================================================
const bagMax = () => (NEW() ? 9 : 3) + (has('bigbag') ? 1 : 0);   // v15.1：同一種道具可以疊放，總數最多 9 個（大背包 10 個）
// 背包裡的道具依種類疊起來顯示：[{ k, n, i（第一個的位置） }]
const itemGroups = () => { const g = []; RUN.items.forEach((k, i) => { const x = g.find(y => y.k === k); if (x) x.n++; else g.push({ k, n: 1, i }); }); return g; };
// 經驗資料：全隊每隻拿到升級所需經驗的 frac
function teamExp(frac) {
  RUN.team.forEach(m => { m.exp = (m.exp || 0) + Math.round(expNeed(m.level) * frac);
    while (m.exp >= expNeed(m.level)) { const b = memberStats(m); m.exp -= expNeed(m.level); m.level++; const a = memberStats(m); m.hp = Math.min(a.maxhp, m.hp + (a.maxhp - b.maxhp)); toast(`⬆️ ${SPECIES[m.sp].name} 升到 Lv.${m.level}！`); } });
}
const ITEMS = {
  potion: { name: '回復藥',   icon: '💊', desc: '一隻夥伴回復 30% HP（戰鬥中給出戰夥伴，戰鬥外可以自己選）' },
  juice:  { name: '勇氣飲料', icon: '🧃', desc: '勇氣值 +25' },
  smoke:  { name: '煙霧彈',   icon: '💨', desc: '放出煙霧：敵人的下一次攻擊有 50% 會落空（頭目戰也能用）' },
  charm:  { name: '數碼護符', icon: '🧿', desc: '守護下一次進化：不會失控；強行進化成功率 +20%、失敗不受反噬' },
  chip:   { name: '能量晶片', icon: '⚡', desc: '這回合能量 +2' },
  antidote:{ name: '解毒劑',  icon: '🧪', desc: '出戰夥伴解除中毒、燒傷、麻痺' },
  capsule:{ name: '護盾膠囊', icon: '🛡️', desc: '出戰夥伴獲得護盾（10＋最大 HP×15%）' },
  speed:  { name: '加速晶片', icon: '⏩', desc: '下一次的行動條 +40%（更快輪到你，可以和其他加速效果疊加）' },
  expdata:{ name: '經驗資料', icon: '📀', desc: '全隊獲得經驗值（每隻約升級所需的 30%）；戰鬥外使用' },
  scanner:{ name: '數據掃描器', icon: '🔍', desc: '探索地圖時使用：標出這張地圖所有的數據碎片；在金字塔迷宮裡會照亮整張地圖的路線、標出陷阱（只在商店販售）', shopOnly: true },
};
const RANDOM_ITEMS = Object.keys(ITEMS).filter(k => !ITEMS[k].shopOnly);   // 寶箱、地上撿到的道具（不含商店限定）
// 拿到新道具：背包滿了就讓玩家選一個丟掉（也可以丟掉新的）
async function addItem(k) {
  if (RUN.items.length < bagMax()) { sfx('pickup'); RUN.items.push(k); toast(`獲得 ${ITEMS[k].icon} ${ITEMS[k].name}`); updateHUD(); return true; }
  // 背包滿了：選一個道具「使用」（回復藥、勇氣飲料可以當場用掉）或「丟掉」，空出位置給新道具
  for (;;) {
    const items = [...itemGroups().map(g => ({ id: g.k, i: g.i, n: g.n })), { id: k, i: -1 }];   // 同種道具疊在一起，丟掉／使用只動其中 1 個
    const act = await new Promise(res => {
      const o = $('#overlay');
      o.innerHTML = `<h2>🎒 背包滿了！</h2><p class="sub">撿到了 ${ITEMS[k].icon} ${ITEMS[k].name}。回復藥、勇氣飲料可以<b>當場使用</b>，或選一個<b>丟掉</b></p><div class="relicList bagList"></div>`;
      const list = o.querySelector('.bagList');
      items.forEach(x => {
        const it = ITEMS[x.id], field = FIELD_ITEMS.includes(x.id), el = document.createElement('div');
        el.className = 'relic' + (x.i < 0 ? ' newItem' : '');
        el.innerHTML = `<div class="ri">${it.icon}</div><div style="flex:1"><b>${it.name}${x.n > 1 ? ` ×${x.n}` : ''}${x.i < 0 ? '（新撿到的）' : ''}</b><div class="rd">${it.desc}</div></div>
          <div class="col2">${field ? '<button class="btn primary">使用</button>' : ''}<button class="btn">丟掉</button></div>`;
        const bs = el.querySelectorAll('button');
        if (field) bs[0].onclick = () => { o.classList.add('hidden'); res({ x, use: true }); };
        bs[bs.length - 1].onclick = () => { o.classList.add('hidden'); res({ x, use: false }); };
        list.appendChild(el);
      });
      o.classList.remove('hidden');
      sfx('open');
    });
    if (act.use && !(await applyFieldItem(act.x.id))) continue;   // 取消使用 → 回到選單
    if (act.x.i < 0) { if (!act.use) toast(`丟掉了 ${ITEMS[k].name}`); updateHUD(); return false; }
    RUN.items.splice(act.x.i, 1, k);
    toast(`${act.use ? '用掉' : '丟掉'} ${ITEMS[act.x.id].name}，放進 ${ITEMS[k].icon} ${ITEMS[k].name}`);
    updateHUD();
    return true;
  }
}
const relicPool = () => Object.keys(RELICS).filter(k => !RELICS[k].dark && !RELICS[k].special && !has(k) && !(k === 'hope' && RUN.flags.hopeUsed) && !(NEW() && CREST_KEYS.includes(k)));   // 第一部沒有徽章

// =========================================================
//   章節
// =========================================================
const CHAPTERS = {
  1: { title: '第一章　檔案島', theme: 'grass', floors: 7, lv: [1, 4],
       zone: ['kunemon', 'goblimon', 'betamon', 'mushmon', 'elecmon', 'numemon', 'gottsumon'],
       elites: ['orgemon', 'unimon'], boss: { id: 'meramon', lv: 5, domain: 'heat' }, next: 'route' },
  city: { title: '第二章　齒輪城市', theme: 'metal', floors: 7, lv: [5, 8],
       zone: ['hagurumon', 'guardromon', 'gekomon', 'kunemon', 'elecmon', 'gottsumon'],
       elites: ['guardromon', 'etemon'], boss: { id: 'andromon', lv: 11, domain: 'jam' }, next: 3 },
  forest: { title: '第二章　迷霧森林', theme: 'forest', floors: 7, lv: [5, 8],
       zone: ['mushmon', 'woodmon', 'betamon', 'shellmon', 'numemon', 'kunemon'],
       elites: ['woodmon', 'shellmon'], boss: { id: 'jyureimon', lv: 11, domain: 'fog' }, next: 3 },
  3: { title: '第三章　無限山', theme: 'mountain', floors: 7, lv: [8, 12],
       zone: ['orgemon', 'unimon', 'meramon', 'gekomon', 'shellmon', 'guardromon'],
       elites: ['skullgreymon', 'etemon'], boss: { id: 'devimon', lv: 16, domain: 'dark' }, next: 'end' },
  // ----- 第二部 -----
  4: { title: '第四章　伺服大陸・沙漠', theme: 'desert', floors: 7, lv: [14, 18],
       zone: ['gekomon', 'gottsumon', 'numemon', 'gazimon', 'kokatorimon', 'otamamon'],
       elites: ['tyranomon', 'nanimon'], boss: { id: 'etemon', lv: 20, domain: 'concert' }, next: 5 },
  5: { title: '第五章　伺服大陸・金字塔', theme: 'pyramid', floors: 7, lv: [18, 22],
       zone: ['guardromon', 'tankmon', 'kuwagamon', 'deltamon', 'gazimon', 'numemon'],
       elites: ['datamon', 'okuwamon'], boss: { id: 'metaletemon', lv: 24, domain: 'metal' }, next: 6 },
  6: { title: '第六章　東京・吸血魔獸', theme: 'tokyo', floors: 7, lv: [22, 26],
       zone: ['bakemon', 'picodevimon', 'mummymon', 'gesomon', 'bakemon', 'picodevimon'],
       elites: ['phantomon', 'wizarmon'], boss: { id: 'vamdemon', lv: 28, domain: 'vamp' }, next: 'p2done' },
  // ----- 第三部 -----
  7: { title: '第七章　螺旋山・海與森林', theme: 'spiral', floors: 7, lv: [26, 30],
       zone: ['seadramon', 'hangyomon', 'octmon', 'coelamon', 'vegiemon', 'kiwimon'],
       elites: ['megaseadramon', 'marindevimon'], boss: { id: 'metalseadramon', partner: 'pinochimon', lv: 32, domain: 'duo' }, next: 8 },
  8: { title: '第八章　螺旋山・機械邪龍獸的工廠', theme: 'factory', floors: 7, lv: [30, 34],
       zone: ['mechanorimon', 'mamemon', 'thunderballmon', 'raremon', 'mechanorimon', 'mamemon'],
       elites: ['megadramon', 'gigadramon'], boss: { id: 'mugendramon', lv: 36, domain: 'mugen' }, next: 9 },
  9: { title: '第九章　螺旋山・小丑皇的遊樂園', theme: 'park', floors: 7, lv: [34, 38],
       zone: ['devidramon', 'vademon', 'dokugumon', 'deathmeramon', 'devidramon', 'vademon'],
       elites: ['ladydevimon', 'skullsatamon'], boss: { id: 'piemon', lv: 40, domain: 'clown' }, next: 'p3done' },
};
// 頭目／精英的領域效果（對玩家不利）
const DOMAINS = {
  heat:  { name: '灼熱之軀', icon: '🔥', desc: '每回合開始燒傷；卡片燒傷：點燃手牌，打出燃燒的卡會受傷' },
  jam:   { name: '干擾電波', icon: '📡', desc: '手牌少補 1 張、換手多花 1 能量；鎖定分析：進化中的夥伴傷害 +40%；看破手牌、召喚小齒輪' },
  fog:   { name: '迷霧森林', icon: '🌫️', desc: '看不到招式預告，勇氣值獲得減半；寄生之根；霧化手牌、種植回血' },
  dark:  { name: '黑暗壓迫', icon: '🌑', desc: '進化消耗 +30%、持續回合 -1；卡片汙染；血量剩一半時進入第二階段' },
  concert: { name: '黑暗演唱會', icon: '🎤', desc: '每 3 次行動唱一次「愛之小夜曲」（會先預告），預告後打出最大 HP 3% 的傷害才能打斷，沒打斷下回合能量 -1；🎵 安可：沒打出去的標記卡會讓他變強' },
  armor: { name: '暗黑之軀', icon: '🛡️', desc: '被黑色齒輪強化，受到的傷害 -15%' },
};
// 頭目戰開始前的說明視窗
const BOSS_INFO = {
  heat: [['🔥 灼熱之軀', '每回合開始，出戰夥伴會燒傷。'],
         ['🔥 卡片燒傷', '火焰獸行動時會點燃你<b>下一手牌</b>的 1 張（血量一半以下 2 張）。打出燃燒中的卡，夥伴會受到最大 HP 6% 的傷害。卡片離開手牌後燒傷就會消失，但 📌 保留的牌會一直燒。']],
  jam:  [['📡 干擾電波', '每回合手牌<b>少補 1 張</b>（補到 4 張），換手多花 1 能量。'],
         ['🎯 鎖定分析', '對<b>進化中</b>的夥伴傷害 +40%。'],
         ['🔍 看破', '每次行動後，你下一手牌會有 1 張能量 +1。'],
         ['⚙️ 召喚小齒輪', '每次行動召喚 1 隻（最多 1 隻，血量一半以下最多 2 隻）。每隻小齒輪會<b>擋下一張攻擊卡</b>（必殺、究極技也算）。']],
  fog:  [['🌫️ 迷霧森林', '看不到招式預告，勇氣值獲得減半。'],
         ['🌱 寄生之根', '同一隻夥伴連續在場 3 回合以上，每回合受到越來越重的傷害，換手就能甩開。'],
         ['🌫️ 霧化', '每次行動後，你下一手牌會有 1 張（沒有 📌 保留的）被迷霧籠罩，只看得到能量。'],
         ['🌳 種植', '沒有種子時會種下一顆，2 次行動後回復最大 HP 的 5%。']],
  dark: [['🌑 黑暗壓迫', '進化消耗 +30%、持續回合 -1。'],
         ['☠️ 卡片汙染', '每次行動後汙染你下一手牌的 1 張（第二階段 2 張），<b>效果減半</b>，究極技也會被汙染。打出被汙染的卡，所有同名的卡 2 回合內都會效果減半。'],
         ['💥 第二階段', '血量剩一半時：進化中的夥伴會被<b>強制退化</b>（沒進化的受到 30% 傷害），接下來 1 回合不能進化；之後每 3 次行動發動「☠️ 死亡宣告」（會先預告）。']],
};
BOSS_INFO.concert = [['🎤 黑暗演唱會', '猴子獸每 3 次行動會唱一次「<b>愛之小夜曲・全力</b>」，唱之前的那次行動就會預告。'],
  ['💥 打斷', '預告出現後，在他唱之前打出他<b>最大 HP 3%</b> 以上的傷害（大約要進化後的 2～3 張攻擊卡）（燒傷、援護、反擊也算）就能打斷。敵人頭上會顯示還差多少。'],
  ['💘 陶醉', '沒打斷的話，你的夥伴會聽得陶醉，<b>下回合能量 -1</b>。'],
  ['🎵 安可', '每次行動後，你下一手牌會有 1 張（血量一半以下 2 張）被標上 🎵。<b>這回合沒打出去</b>的話，他會攻擊↑，每張再回復 3% HP。']];
// 究極之證的謎語（撿到神聖計畫時出現）
const PROOF_RIDDLE = '當孩子懷抱著屬於自己的徽章，<br>與最初相遇的夥伴一同登上究極之巔，<br>幾乎毫髮無傷地擊倒強大的敵人——<br>那份證明，將會顯現。';
// 孩子自己的徽章道具（太一 → 勇氣徽章…）
const kidCrest = () => Object.keys(RELICS).find(k => RELICS[k].name === KIDS[RUN.kid].crest + '徽章');
const NODE_INFO = {
  battle: { icon: '⚔️', name: '戰鬥' },
  elite:  { icon: '💀', name: '精英' },
  event:  { icon: '❓', name: '事件' },
  rest:   { icon: '💗', name: '回復泉' },
  shop:   { icon: '🛒', name: '商店' },
  egg:    { icon: '🥚', name: '數碼蛋' },
  treasure:{ icon: '🎁', name: '寶藏' },
  puzzle: { icon: '🧩', name: '古代遺跡' },
  tutorial: { icon: '🔰', name: '訓練場' },
  boss:   { icon: '😈', name: '頭目' },
};

function scaleStats(base, lv) {
  const m = 1 + 0.1 * (lv - 1);
  return { maxhp: Math.round(base.hp * m), atk: Math.round(base.atk * m), def: Math.round(base.def * m), spd: +(base.spd * (1 + 0.04 * (lv - 1))).toFixed(1) };
}
const FIXED_M = { hp: 1.1, atk: 1.1, def: 1.1, spd: 1 };     // 不會進化的夥伴（原作就是完全體）的能力加成
const evoNote = sp => sp.evo ? `會進化成 ${sp.evo.map(e => e.name).join(' → ')}` : '🚫 不會進化，一直是原本的型態（能力比一般夥伴高）';
function memberStats(m) {
  const sp = SPECIES[m.sp], s = scaleStats(sp, m.level);
  if (!sp.weak && !sp.starter) s.maxhp = Math.round(s.maxhp * 1.25);   // 原本只當敵人的種族，血量設計得比較低
  if (sp.fixed) { s.maxhp = Math.round(s.maxhp * FIXED_M.hp); s.atk = Math.round(s.atk * FIXED_M.atk); s.def = Math.round(s.def * FIXED_M.def); s.spd = +(s.spd * FIXED_M.spd).toFixed(1); }   // 不會進化：一直都是完全體的力量
  s.maxhp = Math.round(s.maxhp * K().hp);
  return s;
}

// =========================================================
//   被選召的孩子（加成與弱點）
// =========================================================
const KIDS = {
  taichi:   { name: '八神太一', nick: '太一',   crest: '勇氣', icon: '🔥', color: '#f97316', plus: '夥伴造成的傷害 +20%，強行進化成功率 +15%，每場戰鬥開始勇氣值 +5', minus: '受到的傷害 +15%，強行進化成功時更容易失控',
              card: 'reckless', line: '好！不管遇到什麼，衝就對了！', mods: { atk: 1.2, taken: 1.15, forceSuccess: .15, forceWrong: .1, startCourage: 5 }, partner: 'agumon' },
  yamato:   { name: '石田大和', nick: '大和',   crest: '友情', icon: '🤝', color: '#3b82f6', plus: '每回合第一次換手不消耗能量，候補也拿全額經驗，隊伍上限 7 隻；第 4 隻起每隻攻擊 +2%（最多 +5%）', minus: '隊伍少於 3 隻時，夥伴攻擊 -15%',
              card: 'friendship', line: '…我會保護好大家的。', mods: { freeSwitch: true, benchFull: true, teamPlus: 1, teamAtk: true }, partner: 'gabumon' },
  sora:     { name: '武之內素娜', nick: '素娜', crest: '愛心', icon: '💗', color: '#ef4444', plus: '愛的守護：每場戰鬥中，夥伴第一次被打倒時會以 1 HP 撐住；勝利後全隊回復 15% HP，勸降成功率 +15%', minus: '夥伴的攻擊 -10%',
              card: 'tender', line: '大家都不要受傷喔，我會照顧好每一個人。', mods: { winHeal: .15, persuade: .15, atk: .9, loveGuard: true }, partner: 'piyomon' },
  koushiro: { name: '泉光子郎', nick: '光子郎',   crest: '知識', icon: '📘', color: '#a855f7', plus: '每回合多抽 1 張牌、商店 85 折、探索視野 +2', minus: '全隊 HP -15%',
              card: 'analyze', line: '這個世界的構造…真是太有意思了！', mods: { draw: 1, shop: .85, hp: .85, sight: 2 }, partner: 'tentomon' },
  mimi:     { name: '太刀川美美', nick: '美美', crest: '純真', icon: '🌟', color: '#22c55e', plus: '勇氣值累積 +40%，回復泉的回復量提高', minus: '數碼幣收入 -30%',
              card: 'blossom', line: '哇～好多可愛的數碼寶貝！大家一起加油吧！', mods: { courage: 1.4, bits: .7, springPlus: .15 }, partner: 'palmon', unlock: '通過第一章後解鎖' },
  jou:      { name: '城戶丈', nick: '阿丈',     crest: '誠實', icon: '💧', color: '#94a3b8', plus: '每回合開始獲得護盾（3＋最大 HP×5%）', minus: '速度 -10%',
              card: 'prepare', line: '等、等一下！我們先擬定計畫再出發比較安全！', mods: { blockDef: true, spd: .9 }, partner: 'gomamon', unlock: '抵達第三章後解鎖' },
  takeru:   { name: '高石武', nick: '阿武',     crest: '希望', icon: '🕊️', color: '#facc15', plus: '每局可以復活一次（全隊 40% HP），強行進化失敗不受反噬', minus: '進化消耗的勇氣值 +20%',
              card: 'hopelight', line: '只要不放棄，一定會有希望的！', mods: { revive: true, evo: 1.2, noRecoil: true }, partner: 'patamon', unlock: '達成任一結局後解鎖' },
  hikari:   { name: '八神嘉兒', nick: '嘉兒',     crest: '光明', icon: '☀️', color: '#f9a8d4', plus: '所有回復效果 +50%，強行進化成功時不會失控，每場戰鬥第一回合出的第一張牌少 1 能量', minus: '牌組上限 18 張（一般是 20 張）',
              card: 'lightward', line: '…我感覺得到，數碼寶貝們在呼喚我們。', mods: { heal: 1.5, deckMax: 18, noWrong: true, firstDisc: true }, partner: 'plotmon', unlock: '收集 2 種結局後解鎖' },
};
const KID_DEFAULT = { teamPlus: 0, teamAtk: false, lowHpPenalty: false, loveGuard: false, blockDef: false, forceSuccess: 0, forceWrong: 0, startCourage: 0, springPlus: 0, firstDisc: false, noWrong: false, noRecoil: false, sight: 0, atk: 1, taken: 1, courage: 1, bits: 1, shop: 1, hp: 1, spd: 1, heal: 1, evo: 1, draw: 0, block: 0, persuade: 0, winHeal: 0, deckMax: 20 };
function K() {
  const k = { ...KID_DEFAULT, ...((typeof RUN !== 'undefined' && RUN && KIDS[RUN.kid]) ? KIDS[RUN.kid].mods : {}) };
  if (P2()) {
    k.deckMax += 2; k.shop *= 1.8;   // 第二部：牌組上限 +2、商店價格 ×1.8
    if (RUN.crest && typeof AWAKEN !== 'undefined' && AWAKEN[RUN.kid]) Object.assign(k, AWAKEN[RUN.kid].mods);   // 徽章覺醒
  }
  return k;
}
function gainBits(n) { const v = Math.round(n * K().bits); RUN.bits += v; return v; }
// ---------- 牌組上限：整副 20 張（嘉兒 18），每一類也有上限 ----------
const CAT_INFO = {
  atk: { icon: '⚔️', name: '攻擊', get max() { return P2() ? 9 : 8; } },   // 第二部 9 張
  def: { icon: '🛡️', name: '防禦回復', get max() { return P2() ? 7 : 6; } },
  cou: { icon: '🔥', name: '勇氣', max: 3 },
  buf: { icon: '💨', name: '強化干擾', get max() { return P2() ? 6 : 4; } },   // v16.4：第二部新增很多強化卡，第二、三部放寬到 6 張
  sig: { icon: '✴️', name: '必殺', max: 3 },
};
const CARD_CAT = {
  strike: 'atk', double: 'atk', heavy: 'atk', drain: 'atk', pierce: 'atk', hotblood: 'atk', beastking: 'atk', reckless: 'atk', friendship: 'atk', allin: 'atk', relay: 'atk', breaker: 'atk',
  guard: 'def', wall: 'def', heal: 'def', tender: 'def', prepare: 'def', lightward: 'def', friend: 'def', lovebox: 'def', purify: 'def',
  focus: 'cou', crest: 'cou', blossom: 'cou',
  counter: 'def', spread: 'buf', tagres: 'buf', sandstorm: 'buf', datasteal: 'buf', charge: 'buf',
  haste: 'buf', jam: 'buf', scan: 'buf', cry: 'buf', rush: 'buf', analyze: 'buf', hopelight: 'buf', evoext: 'buf', signal: 'buf', notes: 'buf', overclock: 'buf',
};
const cardCat = id => { const b = id.replace('+', ''); return b === 'sig' ? 'sig' : CARD_CAT[b] || 'buf'; };
const catCount = cat => RUN.deck.filter(x => cardCat(x) === cat).length;
const minDeck = () => K().deckMax - 2;   // 出售卡片時最少要保留的張數
// 目前每一類的張數（顯示用）
function deckSummary() {
  return `${RUN.deck.length}/${K().deckMax} 張｜` + Object.entries(CAT_INFO).map(([k, c]) => `${c.icon}${catCount(k)}/${c.max}`).join(' ');
}
// 放得下就回傳 null；放不下回傳原因和「可以換掉哪些卡」
function cardRoom(id) {
  const cat = cardCat(id), C = CAT_INFO[cat];
  if (catCount(cat) >= C.max) return { why: `${C.icon} ${C.name}類已滿（${C.max} 張）`, filter: x => cardCat(x) === cat };
  if (RUN.deck.length >= K().deckMax) return { why: `牌組已滿（${K().deckMax} 張）`, filter: () => true };
  return null;
}
function addCard(id) { if (cardRoom(id)) return false; RUN.deck.push(id); return true; }
// 拿到新卡：放不下就讓玩家選一張換掉（也可以不要）
async function acquireCard(id) {
  const room = cardRoom(id);
  if (!room) { RUN.deck.push(id); return true; }
  const x = await chooseCardFromDeck(`${room.why}：選一張換成「${cardDef(id).name}」`, room.filter, '不要這張');
  if (!x) { toast(`沒有拿「${cardDef(id).name}」`); return false; }
  RUN.deck[x.i] = id;
  toast(`「${cardDef(x.id).name}」換成了「${cardDef(id).name}」`);
  return true;
}
// 出售價格：一般 15、強化過 +10、商店限定卡收回半價
function sellPrice(id) { const b = id.replace('+', ''), c = CARDS[b]; return (c && c.shop ? Math.round(c.shop / 2) : 15) + (id.endsWith('+') ? 10 : 0); }
// 商店的卡片強化：第一次 30，之後每次 ×1.5（整局累計）
const shopUpPrice = () => Math.round(30 * Math.pow(1.5, RUN.shopUps || 0) * K().shop);
const ULT_BOOST_PRICE = 500;   // 究極強化（不打折）
const ultBoostPrice = () => P2() ? 1000 : ULT_BOOST_PRICE;
const TAGRES_PRICE = 500;   // 標籤共鳴（第二部商店，固定價）
const healAmt = n => Math.round(n * K().heal);
function newMember(sp, level) {
  return { uid: Date.now() + Math.random(), sp, level, exp: 0, hp: scaleStats(SPECIES[sp], level).maxhp };
}
let BOSS_SPD = 1.25;   // 第二、三部頭目的速度倍率
function makeEnemy(id, lv, opt = {}) {
  const sp = SPECIES[id], s = scaleStats(sp, lv);
  if (sp.weak) { s.maxhp = Math.round(s.maxhp * .6); s.atk = Math.round(s.atk * .85); s.def = Math.round(s.def * .9); }
  if (opt.elite) { s.maxhp = Math.round(s.maxhp * 1.6); s.atk = Math.round(s.atk * 1.25); }
  if (opt.elite && typeof RUN !== 'undefined' && RUN && RUN.part === 3) s.maxhp = Math.round(s.maxhp * .65);   // v16.4：第三部精英太厚
  if (opt.boss) { s.maxhp = Math.round(s.maxhp * 3.6); s.atk = Math.round(s.atk * 1.35); s.def = Math.round(s.def * 1.15); }
  // 難度旋鈕：敵人整體的血量與攻擊加成
  // 各章節的敵人強度：第一章手下留情，越後面越強 [血量, 攻擊]
  const CH_SCALE = { 1: [1, .85], city: [1.15, 1.1], forest: [1.15, 1.1], 3: [1.3, 1.2], 4: [1.5, 1.35], 5: [1.6, 1.42], 6: [1.7, 1.5], 7: [1.8, 1.58], 8: [1.9, 1.66], 9: [2.0, 1.74], 10: [2.1, 1.82] };
  const [chHp, chAtk] = (typeof RUN !== 'undefined' && RUN && CH_SCALE[RUN.chapter]) || [1, 1];
  s.maxhp = Math.round(s.maxhp * ENEMY_HP * chHp); s.atk = Math.round(s.atk * ENEMY_ATK * chAtk);
  // 第二部的頭目再加強（第二部隊伍有完全體可以用；用電腦模擬調到勝率約六成）
  const BOSS_EXTRA = { 4: [1.26, 1.1], 5: [1, .88], 6: [.71, .77], 7: [.37, .55], 8: [.51, 1.25], 9: [.46, .8], 10: [.5, .85] };   // v16.4：血量大幅降低（每隻頭目大約 40～50 張基本攻擊卡），攻擊用模擬重新調
  if (opt.boss && typeof RUN !== 'undefined' && RUN && BOSS_EXTRA[RUN.chapter]) { s.spd = +(s.spd * BOSS_SPD).toFixed(1);   // v16.4：第二、三部的頭目比較快，能力比較常出現
    s.maxhp = Math.round(s.maxhp * BOSS_EXTRA[RUN.chapter][0]); s.atk = Math.round(s.atk * BOSS_EXTRA[RUN.chapter][1]); }
  const name = (opt.elite ? '暗黑' : '') + sp.name;
  return { id, sp, name, img: sp.img, emoji: sp.emoji, attr: sp.attr, lvl: lv, ...s, hp: s.maxhp,
           block: 0, st: {}, gauge: rand(0, 30), moves: sp.moves, boss: !!opt.boss, elite: !!opt.elite, tier: 0 };
}
