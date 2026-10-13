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
const HAND_SIZE = 5;
const ENERGY = 3;
const CARRY_MAX = 2;      // 沒用完的能量最多保留幾點到下回合
const COURAGE_MAX = 120;
const COURAGE_SAFE = 40;   // 保留線：戰鬥結束後勇氣值 40 以下完全保留，超過的部分減半
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
};

// =========================================================
//   數碼寶貝（img = images/ 資料夾裡的檔名）
// =========================================================
const SPECIES = {
  // ----- 初代夥伴 -----
  agumon: { name: '亞古獸', img: 'Agumon', emoji: '🦖', attr: 'vaccine', hp: 62, atk: 14, def: 8, spd: 10, starter: true,
    flavor: 'burn', desc: '攻擊力高，招式會燒傷對手', sig: { name: '小火球', power: 12 }, dark: { name: '骷髏暴龍獸', img: 'Skull_Greymon' },
    evo: [{ name: '暴龍獸', img: 'Greymon', ult: '超級火焰' },
          { name: '機械暴龍獸', img: 'Metal_Greymon', ult: '巨型毀滅者' },
          { name: '戰鬥暴龍獸', img: 'War_Greymon', ult: '蓋亞能量炮' }] },
  gabumon: { name: '加布獸', img: 'Gabumon', emoji: '🦊', attr: 'data', hp: 68, atk: 12, def: 11, spd: 9, starter: true,
    flavor: 'shield', desc: '防禦力高，攻擊同時獲得護盾', sig: { name: '藍色火焰', power: 11 }, dark: { name: '黑色獸人加魯魯', img: 'Were_Garurumon_(Black)' },
    evo: [{ name: '加魯魯獸', img: 'Garurumon', ult: '狐火' },
          { name: '獸人加魯魯', img: 'Were_Garurumon', ult: '狼人之爪', hits: 2 },
          { name: '鋼鐵加魯魯', img: 'Metal_Garurumon', ult: '冰河吐息' }] },
  piyomon: { name: '比丘獸', img: 'Piyomon', emoji: '🐤', attr: 'vaccine', hp: 54, atk: 12, def: 7, spd: 13, starter: true,
    flavor: 'haste', desc: '速度最快，能讓自己加速多次行動', sig: { name: '魔法之火', power: 10 }, dark: { name: '黑暗鳥獸', img: 'Saberdramon' },
    evo: [{ name: '巴多拉獸', img: 'Birdramon', ult: '流星之翼', hits: 3 },
          { name: '迦樓羅獸', img: 'Garudamon', ult: '火焰之翼', hits: 2 },
          { name: '鳳凰獸', img: 'Hououmon', ult: '星光爆發' }] },
  patamon: { name: '巴達獸', img: 'Patamon', emoji: '🐹', attr: 'data', hp: 58, atk: 11, def: 9, spd: 12, starter: true,
    flavor: 'heal', desc: '必殺技便宜，進化後擅長補血', sig: { name: '空氣炮', power: 8, cost: 1 }, dark: { name: '惡魔獸', img: 'Devimon' },
    unlock: '通過第一章後解鎖',
    evo: [{ name: '天使獸', img: 'Angemon', ult: '天堂之拳' },
          { name: '神聖天使獸', img: 'Holy_Angemon', ult: '天國之門' },
          { name: '熾天使獸', img: 'Seraphimon', ult: '七重天', hits: 3 }] },
  gomamon: { name: '哥瑪獸', img: 'Gomamon', emoji: '🦦', attr: 'vaccine', hp: 64, atk: 11, def: 10, spd: 10, starter: true,
    flavor: 'delay', desc: '擅長把對手的行動條往回拉', sig: { name: '魚群行進', power: 10 }, dark: { name: '邪惡海龍獸', img: 'Waru_Seadramon' },
    unlock: '抵達第三章後解鎖',
    evo: [{ name: '海獅獸', img: 'Ikkakumon', ult: '魚雷鋼角' },
          { name: '祖頓獸', img: 'Zudomon', ult: '雷神之錘' },
          { name: '維京獸', img: 'Vikemon', ult: '北極風暴', hits: 2 }] },
  palmon: { name: '巴魯獸', img: 'Palmon', emoji: '🌺', attr: 'data', hp: 60, atk: 11, def: 9, spd: 11, starter: true,
    flavor: 'poison', desc: '用毒持續削減對手 HP', sig: { name: '毒藤', power: 9 }, dark: { name: '莉莉絲獸', img: 'Lilithmon' },
    unlock: '達成任一結局後解鎖',
    evo: [{ name: '仙人掌獸', img: 'Togemon', ult: '千刺拳', hits: 4 },
          { name: '百合獸', img: 'Lilimon', ult: '花之炮' },
          { name: '薔薇獸', img: 'Rosemon', ult: '禁忌的誘惑', hits: 2 }] },

  tentomon: { name: '甲蟲獸', img: 'Tentomon', emoji: '🐞', attr: 'vaccine', hp: 58, atk: 12, def: 10, spd: 10, starter: true,
    flavor: 'para', desc: '雷電攻擊會麻痺對手', sig: { name: '小雷擊', power: 10 },
    evo: [{ name: '比多獸', img: 'Kabuterimon', ult: '超級雷電' },
          { name: '超比多獸', img: 'Atlur_Kabuterimon_(Red)', ult: '巨角衝擊' },
          { name: '赫拉克比多獸', img: 'Herakle_Kabuterimon', ult: '雷電加農炮' }] },
  plotmon: { name: '小狗獸', img: 'Plotmon', emoji: '🐶', attr: 'vaccine', hp: 56, atk: 12, def: 8, spd: 12, starter: true,
    flavor: 'holy', desc: '神聖之力能淨化敵人的強化與護盾', sig: { name: '幼犬之吼', power: 9 }, dark: { name: '黑迪路獸', img: 'Black_Tailmon' },
    unlock: '解鎖八神光後可選',
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
    case 'shield': { const v = () => blockVal(3 + t * 4, .3 + t * .15); return { desc: () => `獲得 ${v()} 護盾`, fx: () => gainBlock(B.p, v()) }; }
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
const hopeTier = f => f.m.level >= TIERS[3].lv ? 3 : f.m.level >= TIERS[2].lv ? 2 : 1;
const hpPct = (f, pc) => Math.round(f.maxhp * pc);
function blockVal(base, mult) { return Math.round(base + curDef() * mult); }
function dmgTxt(power, hits = 1) {
  const s = (B && B.e) ? `<b>${Math.max(1, Math.round(calcRaw(B.p, B.e, power)))}</b>` : `威力${power}`;
  return hits > 1 ? `${s} ×${hits}` : s;
}

// ---------- 通用卡片（u = 是否強化過，強化後名稱多一個 +） ----------
const CARDS = {
  strike: { name: '撞擊',     cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 9 : 6)} 傷害`, fx: u => hit(u ? 9 : 6) },
  guard:  { name: '防禦',     cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 8 : 5, u ? .5 : .4)} 護盾`, fx: u => gainBlock(B.p, blockVal(u ? 8 : 5, u ? .5 : .4)) },
  focus:  { name: '鼓起勇氣', cost: 0, type: 'skill', desc: u => `勇氣值 +${u ? 12 : 8}<br>抽 1 張牌`, fx: u => { gainCourage(u ? 12 : 8, true); drawCards(1); } },
  double: { name: '連續攻擊', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(4, u ? 3 : 2)} 傷害`, fx: u => hit(4, u ? 3 : 2) },
  heavy:  { name: '全力衝撞', cost: 2, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 22 : 16)} 傷害`, fx: u => hit(u ? 22 : 16) },
  wall:   { name: '鐵壁',     cost: 2, type: 'skill', desc: u => `獲得 ${blockVal(u ? 16 : 12, u ? 1 : .8)} 護盾`, fx: u => gainBlock(B.p, blockVal(u ? 16 : 12, u ? 1 : .8)) },
  haste:  { name: '疾風',     cost: 1, type: 'skill', desc: u => `加速 ${u ? 4 : 3} 回合<br><small>行動條 ×1.5</small>`, fx: u => addStatus(B.p, 'haste', u ? 4 : 3) },
  heal:   { name: '回復晶片', cost: 1, type: 'skill', exhaust: true, desc: u => `回復 ${u ? 35 : 25}% HP<br><small>本場用過即移除</small>`, fx: u => healF(B.p, hpPct(B.p, u ? .35 : .25)) },
  jam:    { name: '干擾電波', cost: 1, type: 'skill', desc: u => `敵人行動條 -${u ? 70 : 50}%`, fx: u => pushGauge(B.e, u ? -70 : -50) },
  drain:  { name: '能量吸收', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 8 : 5)} 傷害<br>回復一半傷害值`, fx: u => { const d = hit(u ? 8 : 5); healF(B.p, Math.ceil(d / 2)); } },
  scan:   { name: '數碼掃描', cost: 0, type: 'skill', desc: u => `抽 ${u ? 3 : 2} 張牌`, fx: u => drawCards(u ? 3 : 2) },
  cry:    { name: '戰鬥吶喊', cost: 1, ucost: 0, type: 'power', desc: u => '攻擊↑ 3 回合<br><small>傷害 ×1.3</small>', fx: u => addStatus(B.p, 'atkUp', 3) },
  pierce: { name: '貫穿攻擊', cost: 1, type: 'atk',   desc: u => `造成 ${dmgTxt(u ? 8 : 5)} 傷害<br>無視護盾`, fx: u => hit(u ? 8 : 5, 1, { pierce: true }) },
  rush:   { name: '先發制人', cost: 0, type: 'skill', desc: u => `下次行動條<br>從 ${u ? 60 : 40}% 開始`, fx: u => { B.p.nextGauge = Math.min(90, (B.p.nextGauge || 0) + (u ? 60 : 40)); } },
  crest:  { name: '勇氣徽章', cost: 1, type: 'power', desc: u => `勇氣值 +${u ? 21 : 15}`, fx: u => gainCourage(u ? 21 : 15, true) },
  hotblood: { name: '熱血吶喊', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 7 : 5)} 傷害<br>勇氣值 +${u ? 5 : 3}`, fx: u => { hit(u ? 7 : 5); gainCourage(u ? 5 : 3, true); } },
  // 劇情獲得
  beastking: { name: '獸王拳', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 18 : 13)} 傷害<br><small>獅子獸傳授的拳法</small>`, fx: u => hit(u ? 18 : 13) },
  // 孩子的專屬起始卡
  reckless:  { name: '捨身衝撞', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 19 : 14)} 傷害<br>自己失去 8% HP`, fx: u => { hit(u ? 19 : 14); const d = Math.max(1, Math.round(B.p.maxhp * .08)); B.p.hp = Math.max(1, B.p.hp - d); floatText(B.p, `-${d}`, 'dot'); } },
  friendship:{ name: '友情之力', cost: 1, type: 'atk', desc: u => `造成 ${dmgTxt(u ? 7 : 5, friendHits())} 傷害<br><small>每 2 隻能戰鬥的夥伴多打 1 下</small>`, fx: u => hit(u ? 7 : 5, friendHits()) },
  tender:    { name: '溫柔守護', cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 8 : 5, u ? .4 : .3)} 護盾<br>回復 ${u ? 12 : 8}% HP`, fx: u => { gainBlock(B.p, blockVal(u ? 8 : 5, u ? .4 : .3)); healF(B.p, hpPct(B.p, u ? .12 : .08)); } },
  analyze:   { name: '弱點分析', cost: 0, type: 'skill', desc: u => `敵人 受傷↑ ${u ? 3 : 2} 回合<br><small>受到的傷害 ×1.3</small>`, fx: u => addStatus(B.e, 'expose', u ? 3 : 2) },
  blossom:   { name: '花之祝福', cost: 1, type: 'skill', desc: u => `勇氣值 +${u ? 12 : 8}<br>回復 ${u ? 12 : 8}% HP`, fx: u => { gainCourage(u ? 12 : 8, true); healF(B.p, hpPct(B.p, u ? .12 : .08)); } },
  prepare:   { name: '萬全準備', cost: 1, type: 'skill', desc: u => `獲得 ${blockVal(u ? 13 : 9, u ? .8 : .6)} 護盾<br>清除自己的異常狀態`, fx: u => { gainBlock(B.p, blockVal(u ? 13 : 9, u ? .8 : .6)); ['burn', 'poison', 'para'].forEach(k => delete B.p.st[k]); } },
  hopelight: { name: '希望之光', cost: 0, type: 'power', exhaust: true, permanent: true,
              canPlay: () => B && !B.p.dark && !B.p.noEvo && hopeTier(B.p) > B.p.tier,
              desc: u => `立刻進化到能達到的最高階段<br>不需勇氣・必定成功${u ? '<br>進化持續 +1 回合' : ''}<br><small>整局只能用一次</small>`,
              fx: u => { log('🕊️ 希望之光！奇蹟發生了！'); doEvolve(B.p, hopeTier(B.p), false); if (u) B.p.evoTurns += 1; } },
  lightward: { name: '光之守護', cost: 1, ucost: 0, type: 'skill', desc: u => '下一次受到的攻擊<br>完全無效', fx: u => addStatus(B.p, 'ward', 9) },
  friend:    { name: '夥伴的羈絆', cost: 1, type: 'skill', exhaust: true, desc: u => `全隊回復 ${u ? 22 : 15}% HP<br>勇氣值 +10`, fx: u => { B.fighters.forEach(f => { if (f.hp <= 0) return; if (f === B.p) healF(f, hpPct(f, u ? .22 : .15)); else f.hp = Math.min(f.maxhp, f.hp + healAmt(f.maxhp * (u ? .22 : .15))); }); gainCourage(10, true); } },
};
const TYPE_NAME = { atk: '攻擊', skill: '技能', power: '強化', sig: '必殺', ult: '究極' };
const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'sig', 'sig', 'focus'];
const REWARD_POOL = ['double', 'heavy', 'wall', 'haste', 'heal', 'jam', 'drain', 'scan', 'cry', 'pierce', 'rush', 'sig', 'focus', 'crest', 'hotblood', 'hotblood'];

function sigDef(sp, u) {
  const fl = flavor(sp.flavor, 0), pw = Math.round(sp.sig.power * (u ? 1.4 : 1));
  return { name: sp.sig.name, cost: sp.sig.cost || 2, type: 'sig',
    desc: () => `造成 ${dmgTxt(pw)} 傷害<br>${fl.desc()}${B ? '' : '<br><small>（依出戰夥伴變化）</small>'}`,
    fx: () => { hit(pw, 1, { pierce: fl.pierce }); fl.fx && fl.fx(); } };
}
function ultDef(sp, tier) {
  const ev = sp.evo[tier - 1], hits = ev.hits || 1, fl = flavor(sp.flavor, tier);
  const per = Math.round(TIERS[tier].power / hits * (hits > 1 ? 1.1 : 1));
  return { name: ev.ult, cost: 2, type: 'ult',
    desc: () => `造成 ${dmgTxt(per, hits)} 傷害<br>${fl.desc()}`,
    fx: () => { hit(per, hits, { pierce: fl.pierce }); fl.fx && fl.fx(); } };
}
function cardDef(id) {
  const u = id.endsWith('+'), base = u ? id.slice(0, -1) : id;
  const sp = B ? B.p.sp : (RUN && RUN.team[0]) ? SPECIES[RUN.team[0].sp] : SPECIES.agumon;
  let d;
  if (base === 'sig') d = sigDef(sp, u);
  else if (base === 'ult') { d = (B && B.p.tier > 0) ? ultDef(sp, B.p.tier) : sigDef(sp); if (B && B.p.dark) d = { ...d, name: '暴走・' + d.name }; }
  else {
    const c = CARDS[base];
    d = { name: c.name, cost: u && c.ucost != null ? c.ucost : c.cost, type: c.type, exhaust: c.exhaust, permanent: c.permanent, canPlay: c.canPlay, desc: () => c.desc(u), fx: () => c.fx(u) };
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
  regen:    { name: '黑暗再生', kind: 'heal', heal: .12, w: 1 },
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
  bigbag:    { name: '大背包',   icon: '🎒', desc: '背包上限 +1（變成 4 格）' },
  darkgear:  { name: '黑色齒輪', icon: '⚙️', desc: '全隊攻擊 ×1.25，但每回合開始失去 3% HP', dark: true },
  darkpower: { name: '黑暗之力', icon: '🌑', desc: '進化所需勇氣值 -30%，全隊攻擊 ×1.2', dark: true },
};
const has = k => RUN.relics.includes(k);

// =========================================================
//   背包道具（戰鬥中使用，不花能量；最多帶 3 個）
// =========================================================
const bagMax = () => 3 + (has('bigbag') ? 1 : 0);
const ITEMS = {
  potion: { name: '回復藥',   icon: '💊', desc: '一隻夥伴回復 30% HP（戰鬥中給出戰夥伴，戰鬥外可以自己選）' },
  juice:  { name: '勇氣飲料', icon: '🧃', desc: '勇氣值 +25' },
  smoke:  { name: '煙霧彈',   icon: '💨', desc: '一般戰鬥 100% 逃跑成功' },
  charm:  { name: '數碼護符', icon: '🧿', desc: '這場戰鬥的下一次強行進化必定成功' },
  chip:   { name: '能量晶片', icon: '⚡', desc: '這回合能量 +2' },
};
// 拿到新道具：背包滿了就讓玩家選一個丟掉（也可以丟掉新的）
async function addItem(k) {
  if (RUN.items.length < bagMax()) { sfx('pickup'); RUN.items.push(k); toast(`獲得 ${ITEMS[k].icon} ${ITEMS[k].name}`); updateHUD(); return true; }
  const items = [...RUN.items.map((id, i) => ({ id, i })), { id: k, i: -1 }];
  const drop = await pickScreen({ title: '🎒 背包滿了！', sub: `撿到了 ${ITEMS[k].icon} ${ITEMS[k].name}。選一個要<b>丟掉</b>的道具`, items, allowSkip: false,
    render: x => { const it = ITEMS[x.id], el = document.createElement('div'); el.className = 'relic clickable' + (x.i < 0 ? ' newItem' : '');
      el.innerHTML = `<div class="ri">${it.icon}</div><div><b>${it.name}${x.i < 0 ? '（新撿到的）' : ''}</b><div class="rd">${it.desc}</div></div><div class="cnt price">丟掉</div>`; return el; } });
  if (drop.i < 0) { toast(`丟掉了 ${ITEMS[k].name}`); return false; }
  RUN.items.splice(drop.i, 1, k);
  toast(`丟掉 ${ITEMS[drop.id].name}，換成 ${ITEMS[k].icon} ${ITEMS[k].name}`);
  updateHUD();
  return true;
}
const relicPool = () => Object.keys(RELICS).filter(k => !RELICS[k].dark && !has(k) && !(k === 'hope' && RUN.flags.hopeUsed));

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
};
// 頭目／精英的領域效果（對玩家不利）
const DOMAINS = {
  heat:  { name: '灼熱之軀', icon: '🔥', desc: '每回合開始，出戰夥伴會燒傷' },
  jam:   { name: '干擾電波', icon: '📡', desc: '每回合少抽 1 張牌，換手多花 1 能量' },
  fog:   { name: '迷霧森林', icon: '🌫️', desc: '看不到敵人的招式預告，勇氣值獲得減半' },
  dark:  { name: '黑暗壓迫', icon: '🌑', desc: '進化消耗 +30%、持續回合 -1；血量剩一半時進入第二階段' },
  armor: { name: '暗黑之軀', icon: '🛡️', desc: '被黑色齒輪強化，受到的傷害 -15%' },
};
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
function memberStats(m) {
  const sp = SPECIES[m.sp], s = scaleStats(sp, m.level);
  if (!sp.weak && !sp.starter) s.maxhp = Math.round(s.maxhp * 1.25);   // 原本只當敵人的種族，血量設計得比較低
  s.maxhp = Math.round(s.maxhp * K().hp);
  return s;
}

// =========================================================
//   被選召的孩子（加成與弱點）
// =========================================================
const KIDS = {
  taichi:   { name: '八神太一', nick: '太一',   crest: '勇氣', icon: '🔥', color: '#f97316', plus: '夥伴造成的傷害 +20%，強行進化成功率 +15%', minus: '受到的傷害 +15%，強行進化成功時更容易失控',
              card: 'reckless', line: '好！不管遇到什麼，衝就對了！', mods: { atk: 1.2, taken: 1.15, forceSuccess: .15, forceWrong: .1 }, partner: 'agumon' },
  yamato:   { name: '石田大和', nick: '大和',   crest: '友情', icon: '🤝', color: '#3b82f6', plus: '每回合第一次換手不消耗能量，候補也拿全額經驗，隊伍上限 7 隻；第 4 隻起每隻攻擊 +2%（最多 +5%）', minus: '隊伍少於 3 隻時，夥伴攻擊 -15%',
              card: 'friendship', line: '…我會保護好大家的。', mods: { freeSwitch: true, benchFull: true, teamPlus: 1, teamAtk: true }, partner: 'gabumon' },
  sora:     { name: '武之內素娜', nick: '素娜', crest: '愛心', icon: '💗', color: '#ef4444', plus: '勝利後全隊回復 15% HP，勸降成功率 +15%', minus: '夥伴的攻擊 -10%，對 HP 低於 20% 的敵人傷害再 -10%',
              card: 'tender', line: '大家都不要受傷喔，我會照顧好每一個人。', mods: { winHeal: .15, persuade: .15, atk: .9, lowHpPenalty: true }, partner: 'piyomon' },
  koushiro: { name: '泉光子郎', nick: '光子郎',   crest: '知識', icon: '📘', color: '#a855f7', plus: '每回合多抽 1 張牌、商店 85 折、探索視野 +2', minus: '全隊 HP -15%',
              card: 'analyze', line: '這個世界的構造…真是太有意思了！', mods: { draw: 1, shop: .85, hp: .85, sight: 2 }, partner: 'tentomon' },
  mimi:     { name: '太刀川美美', nick: '美美', crest: '純真', icon: '🌟', color: '#22c55e', plus: '勇氣值累積 +40%', minus: '數碼幣收入 -30%',
              card: 'blossom', line: '哇～好多可愛的數碼寶貝！大家一起加油吧！', mods: { courage: 1.4, bits: .7 }, partner: 'palmon', unlock: '通過第一章後解鎖' },
  jou:      { name: '城戶丈', nick: '阿丈',     crest: '誠實', icon: '💧', color: '#94a3b8', plus: '每回合開始獲得護盾（3＋防禦×0.3）', minus: '速度 -10%',
              card: 'prepare', line: '等、等一下！我們先擬定計畫再出發比較安全！', mods: { blockDef: true, spd: .9 }, partner: 'gomamon', unlock: '抵達第三章後解鎖' },
  takeru:   { name: '高石武', nick: '阿武',     crest: '希望', icon: '🕊️', color: '#facc15', plus: '每局可以復活一次（全隊 40% HP），強行進化失敗不受反噬', minus: '進化消耗的勇氣值 +20%',
              card: 'hopelight', line: '只要不放棄，一定會有希望的！', mods: { revive: true, evo: 1.2, noRecoil: true }, partner: 'patamon', unlock: '達成任一結局後解鎖' },
  hikari:   { name: '八神光', nick: '小光',     crest: '光明', icon: '☀️', color: '#f9a8d4', plus: '所有回復效果 +50%，強行進化成功時不會失控', minus: '牌組上限 20 張',
              card: 'lightward', line: '…我感覺得到，數碼寶貝們在呼喚我們。', mods: { heal: 1.5, deckMax: 20, noWrong: true }, partner: 'plotmon', unlock: '收集 2 種結局後解鎖' },
};
const KID_DEFAULT = { teamPlus: 0, teamAtk: false, lowHpPenalty: false, blockDef: false, forceSuccess: 0, forceWrong: 0, noWrong: false, noRecoil: false, sight: 0, atk: 1, taken: 1, courage: 1, bits: 1, shop: 1, hp: 1, spd: 1, heal: 1, evo: 1, draw: 0, block: 0, persuade: 0, winHeal: 0, deckMax: 99 };
function K() { return { ...KID_DEFAULT, ...((typeof RUN !== 'undefined' && RUN && KIDS[RUN.kid]) ? KIDS[RUN.kid].mods : {}) }; }
function gainBits(n) { const v = Math.round(n * K().bits); RUN.bits += v; return v; }
function addCard(id) {
  if (RUN.deck.length >= K().deckMax) { toast(`牌組已滿（上限 ${K().deckMax} 張）`); return false; }
  RUN.deck.push(id); return true;
}
const healAmt = n => Math.round(n * K().heal);
function newMember(sp, level) {
  return { uid: Date.now() + Math.random(), sp, level, exp: 0, hp: scaleStats(SPECIES[sp], level).maxhp };
}
function makeEnemy(id, lv, opt = {}) {
  const sp = SPECIES[id], s = scaleStats(sp, lv);
  if (sp.weak) { s.maxhp = Math.round(s.maxhp * .6); s.atk = Math.round(s.atk * .85); s.def = Math.round(s.def * .9); }
  if (opt.elite) { s.maxhp = Math.round(s.maxhp * 1.6); s.atk = Math.round(s.atk * 1.25); }
  if (opt.boss) { s.maxhp = Math.round(s.maxhp * 3.6); s.atk = Math.round(s.atk * 1.35); s.def = Math.round(s.def * 1.15); }
  // 難度旋鈕：敵人整體的血量與攻擊加成
  // 各章節的敵人強度：第一章手下留情，越後面越強 [血量, 攻擊]
  const CH_SCALE = { 1: [1, .85], city: [1.15, 1.1], forest: [1.15, 1.1], 3: [1.3, 1.2] };
  const [chHp, chAtk] = (typeof RUN !== 'undefined' && RUN && CH_SCALE[RUN.chapter]) || [1, 1];
  s.maxhp = Math.round(s.maxhp * ENEMY_HP * chHp); s.atk = Math.round(s.atk * ENEMY_ATK * chAtk);
  const name = (opt.elite ? '暗黑' : '') + sp.name;
  return { id, sp, name, img: sp.img, emoji: sp.emoji, attr: sp.attr, lvl: lv, ...s, hp: s.maxhp,
           block: 0, st: {}, gauge: rand(0, 30), moves: sp.moves, boss: !!opt.boss, elite: !!opt.elite, tier: 0 };
}
