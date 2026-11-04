'use strict';
/* =========================================================
   戰鬥特效：出牌、必殺技、究極技、敵人攻擊
   全部用網頁動畫做，不需要額外素材。每個函式回傳「打中」的時間點。
   ========================================================= */

// [中心色, 主色, 外圍色]
const VFX_COLORS = {
  fire:    ['#fff7c2', '#ff9a1f', '#e2362b'],
  ice:     ['#ffffff', '#7dd3fc', '#2563eb'],
  wind:    ['#f0fff4', '#86efac', '#16a34a'],
  light:   ['#ffffff', '#fde68a', '#f59e0b'],
  water:   ['#e0f2fe', '#38bdf8', '#1d4ed8'],
  poison:  ['#f5d0fe', '#c026d3', '#581c87'],
  thunder: ['#ffffff', '#fde047', '#ca8a04'],
  dark:    ['#e9d5ff', '#7c3aed', '#1e1b4b'],
  punch:   ['#fff7ed', '#fb923c', '#c2410c'],
  heal:    ['#f0fdf4', '#4ade80', '#15803d'],
  shield:  ['#eef2ff', '#a5b4fc', '#4f46e5'],
  courage: ['#fff7ed', '#fdba74', '#ea580c'],
  target:  ['#fee2e2', '#f87171', '#b91c1c'],
};
// 數碼寶貝系統 → 必殺技／究極技的特效
const FLAVOR_VFX = { burn: 'fire', shield: 'ice', haste: 'wind', heal: 'light', delay: 'water', poison: 'poison', para: 'thunder', pierce: 'slash', rage: 'punch' };
// 一般卡片 → 特效（沒列到的攻擊卡用斬擊）
const CARD_VFX = {
  double: { slash: 2 }, friendship: { slash: 3 }, heavy: { slash: 1, big: true }, reckless: { slash: 1, big: true },
  pierce: { slash: 1 }, strike: { slash: 1 }, hotblood: { proj: 'fire' }, drain: { proj: 'heal' }, beastking: { proj: 'punch' },
  guard: { aura: 'shield' }, wall: { aura: 'shield' }, tender: { aura: 'shield' }, prepare: { aura: 'shield' }, lightward: { aura: 'light' },
  heal: { aura: 'heal' }, hopelight: { aura: 'heal' }, friend: { aura: 'heal' }, blossom: { aura: 'heal' },
  focus: { aura: 'courage' }, crest: { aura: 'courage' }, cry: { aura: 'courage' },
  haste: { aura: 'wind' }, rush: { aura: 'wind' }, scan: { aura: 'light' },
  jam: { proj: 'thunder' }, analyze: { auraEnemy: 'target' },
};
// 敵人招式 → 特效
const MOVE_VFX = {
  flame: 'fire', missile: 'fire', electric: 'thunder', gear: 'thunder', song: 'thunder', serenade: 'thunder',
  spore: 'poison', cherry: 'poison', poop: 'poison', water: 'water',
  deathclaw: 'dark', darkwing: 'dark', darkspirit: 'dark', groundzero: 'dark',
};

const vfxLayer = () => $('#vfxLayer');
const wait = ms => new Promise(r => setTimeout(r, ms));
function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
const spriteCenter = f => centerOf(unitOf(f).querySelector('.emo'));
function glow(c) { return `radial-gradient(circle, ${c[0]} 0%, ${c[1]} 40%, ${c[2]}aa 60%, transparent 72%)`; }
function mk(cls, x, y, w, h = w) {
  const d = document.createElement('div');
  d.className = 'vfx ' + cls;
  Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  vfxLayer().appendChild(d);
  return d;
}
function play(el, frames, opt) { return el.animate(frames, { fill: 'forwards', ...opt }).finished.then(() => el.remove()); }

// ---------- 基本特效 ----------
async function flashScreen(c, ms = 260) {
  const f = mk('flash', 0, 0, window.innerWidth, window.innerHeight);
  f.style.background = `radial-gradient(circle, ${c[0]}ee, ${c[1]}88 50%, ${c[2]}00 80%)`;
  play(f, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: ms * 2 });
  await wait(ms);
}
function burst(p, c, big) {
  const s = mk('burst', p.x, p.y, big ? 280 : 150);
  s.style.background = glow(c);
  play(s, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }],
       { duration: big ? 560 : 380, easing: 'ease-out' });
  for (let i = 0; i < (big ? 14 : 7); i++) {   // 飛散的火花
    const sp = mk('spark', p.x, p.y, big ? 12 : 8);
    sp.style.background = c[1]; sp.style.boxShadow = `0 0 8px ${c[1]}`;
    const a = Math.random() * Math.PI * 2, r = rand(50, big ? 170 : 100);
    play(sp, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.3)`, opacity: 0 }],
         { duration: rand(350, 600), easing: 'ease-out' });
  }
  if (big) restartAnim($('#battle'), 'bigShake');
}
async function projectile(kind, a, b, big) {
  const c = VFX_COLORS[kind] || VFX_COLORS.light;
  if (kind === 'thunder') return bolt(b, c, big);
  const size = big ? 120 : 64;
  const p = mk('proj', a.x, a.y, size);
  p.style.background = glow(c);
  p.style.boxShadow = `0 0 ${big ? 60 : 26}px ${c[1]}`;
  const dx = b.x - a.x, dy = b.y - a.y, dur = big ? 440 : 320;
  // 拖尾
  const trail = setInterval(() => {
    const r = p.getBoundingClientRect(), t = mk('trail', r.left + r.width / 2, r.top + r.height / 2, size * .55);
    t.style.background = glow(c);
    play(t, [{ opacity: .7, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }], { duration: 260 });
  }, 40);
  await p.animate([{ transform: 'translate(-50%,-50%) scale(.35) rotate(0deg)' }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(360deg)` }],
                  { duration: dur, easing: 'cubic-bezier(.55,0,.85,.55)', fill: 'forwards' }).finished;
  clearInterval(trail);
  p.remove();
  burst(b, c, big);
}
async function bolt(b, c, big) {
  const w = big ? 90 : 54;
  const el = mk('bolt', b.x - w / 2, 0, w, b.y + 20);
  el.style.background = `linear-gradient(90deg, transparent, ${c[1]}, ${c[0]}, ${c[1]}, transparent)`;
  el.style.filter = `drop-shadow(0 0 14px ${c[1]})`;
  play(el, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .2, offset: .35 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 380 });
  await wait(140);
  burst(b, c, big);
}
async function slash(target, n = 1, big = false) {
  const b = spriteCenter(target);
  for (let i = 0; i < n; i++) {
    const s = mk('slash', b.x, b.y, big ? 260 : 190, big ? 10 : 6);
    const ang = -35 + rand(-20, 20) + (i % 2 ? 70 : 0);
    play(s, [{ transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(0)`, opacity: 1 },
             { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: .5 },
             { transform: `translate(-50%,-50%) rotate(${ang}deg) scaleX(1.1)`, opacity: 0 }], { duration: 260 });
    await wait(n > 1 ? 110 : 140);
  }
  if (big) restartAnim($('#battle'), 'bigShake');
}
async function aura(f, kind) {
  const c = VFX_COLORS[kind], p = spriteCenter(f);
  const ring = mk('ring', p.x, p.y, 120);
  ring.style.borderColor = c[1]; ring.style.boxShadow = `0 0 24px ${c[1]}, inset 0 0 24px ${c[1]}`;
  play(ring, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], { duration: 480, easing: 'ease-out' });
  for (let i = 0; i < 8; i++) {   // 往上飄的光點
    const d = mk('spark', p.x + rand(-50, 50), p.y + rand(-10, 40), rand(6, 11));
    d.style.background = c[1]; d.style.boxShadow = `0 0 10px ${c[1]}`;
    play(d, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(-50%, calc(-50% - ${rand(60, 120)}px))`, opacity: 0 }], { duration: rand(500, 800), easing: 'ease-out' });
  }
  await wait(260);
}

// ---------- v12：新的技能動畫 ----------
const HEX_SVG = `<svg viewBox="0 0 150 170"><defs><pattern id="hxp" width="26" height="30" patternUnits="userSpaceOnUse"><path d="M13 0 L26 7.5 L26 22.5 L13 30 L0 22.5 L0 7.5 Z" fill="rgba(125,211,252,.18)" stroke="#bae6fd" stroke-width="1.5"/></pattern></defs><path d="M75 4 L146 44 L146 126 L75 166 L4 126 L4 44 Z" fill="url(#hxp)" stroke="#e0f2fe" stroke-width="4"/></svg>`;
async function shieldFx(f) {   // 身前展開六角形的能量盾
  const a = spriteCenter(f), b = spriteCenter(f.isPlayer ? B.e : B.p);
  const sh = mk('shieldFx', a.x + (b.x - a.x) * .18, a.y + (b.y - a.y) * .18, 130, 147); sh.innerHTML = HEX_SVG;
  play(sh, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: .25 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .75 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0 }], { duration: 1000, easing: 'ease-out' });
  await wait(260);
}
async function reticleFx(f) {   // 準星鎖定敵人
  const p = spriteCenter(f), rt = mk('reticle', p.x, p.y, 130);
  play(rt, [{ transform: 'translate(-50%,-50%) rotate(0deg) scale(2)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(135deg) scale(.7)', opacity: 1, offset: .45 },
            { transform: 'translate(-50%,-50%) rotate(135deg) scale(.7)', opacity: 1, borderColor: '#fff', offset: .8 }, { transform: 'translate(-50%,-50%) rotate(135deg) scale(.7)', opacity: 0 }], { duration: 950, easing: 'ease-out' });
  await wait(450);
}
async function cutIn(f, name, src) {   // 究極技的招式特寫（src：援護用別的圖）
  const img = unitOf(f).querySelector('img'), c = mk('cutin', 0, 0, innerWidth, innerHeight);
  c.innerHTML = `<div class="dim"></div><div class="band"><img src="${src || (img ? img.src : '')}" alt=""><div class="nm">${name}！</div></div>`;
  await wait(20); c.classList.add('on'); sfx('evolve');
  await wait(950); c.classList.add('out'); await wait(240); c.remove();
}

// ---------- 對外：出牌 / 敵人攻擊 ----------
async function cardVfx(id, d, fromRect) {
  if (!B) return;
  const base = id.replace('+', '');
  // 技能從自己的數碼寶貝身上打出去（先做一個往前衝的動作）
  const from = spriteCenter(B.p);
  const to = spriteCenter(B.e);
  if (d.type === 'sig' || d.type === 'ult') {
    const kind = FLAVOR_VFX[B.p.sp.flavor] || 'light', big = d.type === 'ult';
    if (big) await cutIn(B.p, d.name);
    lunge(B.p); await wait(120);
    if (big) await flashScreen(VFX_COLORS[kind === 'slash' ? 'light' : kind]);
    if (kind === 'slash') return slash(B.e, big ? 3 : 1, big);
    const hits = big ? (B.p.sp.evo[B.p.tier - 1].hits || 1) : 1;
    for (let i = 0; i < hits; i++) { await projectile(kind, from, to, big); }
    return;
  }
  const v = CARD_VFX[base] || (d.type === 'atk' ? { slash: 1 } : { aura: 'light' });
  if (v.slash) { const back = await dashTo(B.p, B.e); await slash(B.e, v.slash, v.big); back(); return; }   // 衝過去打，再退回
  if (v.proj) { lunge(B.p); await wait(120); return projectile(v.proj, from, to, false); }
  if (v.aura === 'shield') return shieldFx(B.p);
  if (v.aura) return aura(B.p, v.aura);
  if (v.auraEnemy === 'target') return reticleFx(B.e);
  if (v.auraEnemy) return aura(B.e, v.auraEnemy);
}
async function enemyVfx(moveId, m) {
  if (!B) return;
  if (m.kind === 'guard') return shieldFx(B.e);
  if (m.kind === 'heal') return aura(B.e, 'heal');
  if (m.kind === 'buff' || m.kind === 'serenade') return aura(B.e, 'target');
  const kind = MOVE_VFX[moveId];
  const big = m.power >= 15 || moveId === 'groundzero';
  if (!kind) { const back = await dashTo(B.e, B.p, .5); await slash(B.p, m.hits || 1, big); back(); return; }   // 近身招式：衝過來打
  if (big) await flashScreen(VFX_COLORS[kind], 200);
  return projectile(kind, spriteCenter(B.e), spriteCenter(B.p), big);
}
