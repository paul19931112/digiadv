'use strict';
/* =========================================================
   援護：在冒險途中幫助其他孩子的夥伴，戰鬥中可以請牠們來幫一招
   - 不佔隊伍位置，同時最多帶 2 種，每種整趟冒險可以用 3 次
   - 戰鬥中從「道具」面板叫出來，花 1 能量，每場戰鬥最多 1 次
   - 第一部（v13 起新開的冒險）才會出現
   ========================================================= */
const ASSIST_MAX = 2, ASSIST_USES = 3, ASSIST_COST = 1;
const ASSISTS = {
  greymon:     { sp: 'agumon',   name: '暴龍獸',   img: 'Greymon',     move: '超級火焰', desc: '造成傷害，勇氣值 +10',
                 fx: a => { assistHit(a, 29); gainCourage(10, true); } },
  garurumon:   { sp: 'gabumon',  name: '加魯魯獸', img: 'Garurumon',   move: '狐火',     desc: '造成傷害，敵人行動條 -40%',
                 fx: a => { assistHit(a, 26); if (B.e.hp > 0) pushGauge(B.e, -40); } },
  birdramon:   { sp: 'piyomon',  name: '巴多拉獸', img: 'Birdramon',   move: '流星火焰', desc: '造成傷害，燒傷 2 回合',
                 fx: a => { assistHit(a, 26); if (B.e.hp > 0) addStatus(B.e, 'burn', 2); } },
  kabuterimon: { sp: 'tentomon', name: '比多獸',   img: 'Kabuterimon', move: '超級雷電', desc: '造成傷害，敵人麻痺',
                 fx: a => { assistHit(a, 26); if (B.e.hp > 0) addStatus(B.e, 'para', 1); } },
  togemon:     { sp: 'palmon',   name: '仙人掌獸', img: 'Togemon',     move: '千針刺',   desc: '造成 4 段傷害',
                 fx: a => assistHit(a, 10, 4) },
  ikkakumon:   { sp: 'gomamon',  name: '海獅獸',   img: 'Ikkakumon',   move: '魚雷',     desc: '出戰夥伴獲得大量護盾',
                 fx: a => gainBlock(B.p, blockVal(20, .35)) },
  angemon:     { sp: 'patamon',  name: '天使獸',   img: 'Angemon',     move: '天堂之拳', desc: '造成大傷害',
                 fx: a => assistHit(a, 38) },
};
const assistOn = () => NEW();
const assistList = () => (RUN.assists || []).filter(x => x.n > 0);
// 還能遇到的援護：沒拿過、不是自己的搭檔、隊伍裡沒有
function assistPool() {
  const got = RUN.flags.assistGot || [];
  return Object.keys(ASSISTS).filter(k => !got.includes(k) && ASSISTS[k].sp !== KIDS[RUN.kid].partner && !RUN.team.some(m => m.sp === ASSISTS[k].sp));
}

// 援護的傷害：用隊伍最高等級、成熟期的能力來算（跟出戰夥伴無關）
function assistHit(a, power, hits = 1, o = {}) {
  const lv = Math.max(...RUN.team.map(m => m.level)), s = memberStats({ sp: a.sp, level: lv });
  const att = { atk: Math.round(s.atk * TIERS[1].m.atk), attr: SPECIES[a.sp].attr, st: {}, isPlayer: true };
  const e = B.e;
  for (let i = 0; i < hits; i++) {
    if (e.hp <= 0) break;
    if (e.st.ward) { delete e.st.ward; floatText(e, '✨ 守護！', 'heal'); sfx('block'); continue; }
    let d = calcRaw(att, e, power) * rand(.9, 1.1);
    if (e.st.expose) d *= 1.3;
    if (B.dom === 'armor') d *= .85;
    d = Math.max(1, Math.round(d));
    if (e.block > 0) { const bl = Math.min(e.block, d); e.block -= bl; d -= bl; }
    e.hp = Math.max(0, e.hp - d);
    checkPhase2();
    floatText(e, d > 0 ? `-${d}` : '🛡 擋下', 'dmg'); sfx(d ? 'hit' : 'block'); shake(e);
  }
}

// ---------- 戰鬥中使用 ----------
function assistBlock() {
  if (!B || B.phase !== 'player' || B.anim) return '現在不能用';
  if (B.assistUsed) return '這場戰鬥已經請過援護了';
  if (B.p.dark) return '暴走中，聽不進去';
  if (B.energy < ASSIST_COST) return `需要 ${ASSIST_COST} 能量`;
  return null;
}
async function useAssist(k) {
  const x = (RUN.assists || []).find(y => y.k === k), a = ASSISTS[k];
  if (!x || x.n <= 0 || assistBlock()) return;
  closePopups();
  B.energy -= ASSIST_COST; B.assistUsed = true; x.n--;
  log(`🤝 ${a.name} 趕來援護！「${a.move}」！（剩 ${x.n} 次）`);
  B.anim = true; renderBattle();
  const myB = B;
  try { await Promise.race([cutIn(B.p, a.move, `images/${a.img}.png`), sleep(1500)]); } catch (e) { /* 特效失敗不影響結算 */ }
  if (B !== myB) return;
  B.anim = false;
  a.fx(a);
  if (checkEnd()) return;
  renderBattle();
}
// 道具面板裡的援護區
function assistBagHtml() {
  const list = assistList();
  if (!assistOn() || !list.length) return '';
  const why = assistBlock();
  return `<div class="mini2" style="padding:6px 4px 2px">🤝 援護（花 ${ASSIST_COST} 能量，每場戰鬥 1 次）</div>` + list.map(x => {
    const a = ASSISTS[x.k];
    return `<div class="swOpt assistOpt${why ? ' off' : ''}" data-ak="${x.k}">${dpic(a.img, '🤝', 's44')}<div class="grow"><b>${a.name}・${a.move}</b><div class="mini2">${a.desc}　剩 ${x.n} 次</div></div>${why ? `<span class="why">${why}</span>` : '<span>援護</span>'}</div>`;
  }).join('');
}

// ---------- 地圖事件：救出其他孩子的夥伴 ----------
const ASSIST_RATE = .12;   // 每張地圖出現的機率
function maybePlaceAssist(place, free, ndType) {
  if (!assistOn() || ['boss', 'tutorial', 'shop', 'rest'].includes(ndType) || Math.random() > ASSIST_RATE) return;
  const pool = assistPool(); if (!pool.length) return;
  const k = pick(pool);
  place({ kind: 'npc', sp: ASSISTS[k].sp, asp: k, opt: true }, free(5));
}
async function giveAssist(k) {
  const a = ASSISTS[k];
  RUN.flags.assistGot = [...(RUN.flags.assistGot || []), k];
  RUN.assists = (RUN.assists || []).filter(x => x.n > 0);
  if (RUN.assists.length >= ASSIST_MAX) {
    const opts = RUN.assists.map(x => ({ text: `放開 ${ASSISTS[x.k].name}（剩 ${x.n} 次）`, note: ASSISTS[x.k].desc }));
    opts.push({ text: `不帶 ${a.name}`, note: '維持現在的援護' });
    const c = await ask(null, `援護最多 ${ASSIST_MAX} 種，要換掉哪一個？`, opts);
    if (c >= RUN.assists.length) { await say(null, `${a.name}：「需要的時候，隨時叫我！」（沒有帶上援護）`); return; }
    RUN.assists.splice(c, 1);
  }
  RUN.assists.push({ k, n: ASSIST_USES });
  sfx('levelup');
  await say(null, `獲得援護 <b>🤝 ${a.name}・${a.move}</b>：${a.desc}<br><small>戰鬥中從「道具」叫出來，花 ${ASSIST_COST} 能量，每場 1 次，整趟冒險可以用 ${ASSIST_USES} 次</small>`);
}
async function assistEvent(o) {
  const a = ASSISTS[o.asp], sp = SPECIES[a.sp];
  SPECIES['assist_' + o.asp] = SPECIES['assist_' + o.asp] || { name: sp.name, img: sp.img, emoji: sp.emoji };
  await say('assist_' + o.asp, `${sp.name}被黑色齒輪控制的數碼寶貝圍住了！「救、救命——！」`);
  const c = await ask(null, `要幫助${sp.name}嗎？`, [
    { text: '衝過去幫忙！', note: '跟一隻敵人戰鬥，打贏就能得到援護' },
    { text: '現在沒有餘力…', note: '什麼都不會發生' },
  ]);
  if (c !== 0) { await say('partner', `…希望${sp.name}沒事。`); return; }
  const ch = CHAPTERS[RUN.chapter];
  const res = await eventBattle(pick(ch.zone), curLv());
  if (res !== 'win') return;
  await say('assist_' + o.asp, `謝謝你們！我也是被選召的孩子的夥伴。需要的時候，我會進化成${a.name}來幫忙！`);
  await giveAssist(o.asp);
}
