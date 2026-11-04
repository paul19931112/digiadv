'use strict';
/* =========================================================
   數碼冒險 RPG（第一章試玩）— 3D 世界、角色、戰鬥
   ========================================================= */
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CELL = 2.4;
const ROWS = MAP_TXT.trim().split('\n');
const MW = ROWS[0].length, MH = ROWS.length;
const T = ROWS.map(r => r.split(''));            // 地形（會變：岩壁裂開、柵門打開）
const wx = cx => (cx + .5) * CELL, wz = cy => (cy + .5) * CELL;
const cellOf = v => Math.floor(v / CELL);
const SOLID = new Set('ptr#~lhgxw'.split(''));
function solidAt(x, z) {
  const cx = cellOf(x), cy = cellOf(z);
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return true;
  return SOLID.has(T[cy][cx]);
}
function blocked(x, z, r) { return solidAt(x - r, z - r) || solidAt(x + r, z - r) || solidAt(x - r, z + r) || solidAt(x + r, z + r); }
function moveCirc(o, dx, dz, r) {
  let hit = false;
  if (!blocked(o.x + dx, o.z, r)) o.x += dx; else hit = true;
  if (!blocked(o.x, o.z + dz, r)) o.z += dz; else hit = true;
  return hit;
}
// 地圖上的物件：ENTS['J'][0] = { c, cx, cy, x, z, i }
const ENTS = {};
MAP_ENTS.forEach(([c, cx, cy]) => { (ENTS[c] = ENTS[c] || []).push({ c, cx, cy, x: wx(cx), z: wz(cy), i: (ENTS[c] || []).length }); });
const ent = c => ENTS[c] && ENTS[c][0];

// ---------- 場景 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const SKY_DAY = new THREE.Color(0xa9dcf2), SKY_NIGHT = new THREE.Color(0x0c1430), SKY_DUSK = new THREE.Color(0xf0a070);
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(0xa9dcf2, 38, 78);
const camera = new THREE.PerspectiveCamera(48, 1, .1, 260);
const CAM_OFF = new THREE.Vector3(0, 20, 14);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a6a3a, .8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(30, 50, 20); scene.add(sun);
const lamp = new THREE.PointLight(0xffd9a0, 0, 16, 1.6); scene.add(lamp);   // 晚上主角身邊的光
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  if (h > w) CAM_OFF.set(0, 27, 18); else CAM_OFF.set(0, 20, 14);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- 地面（依地圖畫出來的貼圖） ----------
const GROUND_COL = { '.': '#6aac52', t: '#5c9c48', p: '#3f7a3a', q: '#5c9c48', f: '#72b25a', ',': '#e8d6a0', '~': '#3d8ed0', s: '#3d8ed0', b: '#3d8ed0',
  r: '#8a9a7a', '#': '#7d7468', '=': '#c9a86a', h: '#6aac52', l: '#ff6a1a', ':': '#6b5a52', c: '#4b4458', x: '#4b4458', g: '#6b5a52', w: '#3d8ed0' };
let groundTex, emisTex, ground;
function buildGround() {
  const P = 10, c = document.createElement('canvas'); c.width = MW * P; c.height = MH * P;
  const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = c.width; e.height = c.height; const eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, e.width, e.height);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let ch = T[y][x];
    if (ch === 'x' || ch === 'g') ch = y < 10 && x < 26 ? 'c' : ':';
    g.fillStyle = GROUND_COL[ch] || '#6aac52'; g.fillRect(x * P, y * P, P, P);
    if (ch === 'l') { eg.fillStyle = '#ff5a10'; eg.fillRect(x * P, y * P, P, P); }
    if (ch === '~' || ch === 's' || ch === 'b' || ch === 'w') { eg.fillStyle = '#0a2a4a'; eg.fillRect(x * P, y * P, P, P); }
  }
  // 細節：草、沙的斑點，水的波紋
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height, ch = T[Math.floor(y / P)][Math.floor(x / P)];
    if ('.tqfh'.includes(ch)) { g.fillStyle = Math.random() < .5 ? '#5d9c47' : '#7cbc62'; g.fillRect(x, y, 1.5, 3); }
    else if (ch === ',') { g.fillStyle = Math.random() < .5 ? '#d9c48a' : '#f3e6bb'; g.fillRect(x, y, 2, 2); }
    else if ('~sbw'.includes(ch)) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 4, 1); }
    else if (ch === 'l') { g.fillStyle = Math.random() < .5 ? '#ffb020' : '#c23a0a'; g.fillRect(x, y, 3, 3); }
    else if (ch === ':' || ch === 'c') { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, y, 2, 2); }
  }
  // 沙灘靠海的地方畫白色浪花
  for (let y = 1; y < MH; y++) for (let x = 0; x < MW; x++) if (T[y][x] === '~' && T[y - 1][x] === ',') { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x * P, y * P, P, 2); }
  groundTex = new THREE.CanvasTexture(c); emisTex = new THREE.CanvasTexture(e);
  const mat = new THREE.MeshLambertMaterial({ map: groundTex, emissiveMap: emisTex, emissive: 0xffffff });
  ground = new THREE.Mesh(new THREE.PlaneGeometry(MW * CELL, MH * CELL), mat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(MW * CELL / 2, 0, MH * CELL / 2);
  scene.add(ground);
  // 地圖外面：海和山
  const out = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: 0x2f78b8 }));
  out.rotation.x = -Math.PI / 2; out.position.set(MW * CELL / 2, -.05, MH * CELL / 2); scene.add(out);
}

// ---------- 地圖上的立體物件 ----------
const MESH = {};
function inst(geo, mat, cells, place) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cells.length));
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  cells.forEach((c, i) => { const o = place(c, i); M4.compose(p.set(o.x, o.y, o.z), o.q ? q.copy(o.q) : q.identity(), s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1)); m.setMatrixAt(i, M4); if (o.col) m.setColorAt(i, col.set(o.col)); });
  if (!cells.length) m.count = 0;
  scene.add(m); return m;
}
const yq = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
function cellsOf(chars) { const L = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (chars.includes(T[y][x])) L.push({ x, y, h: ((x * 73856093) ^ (y * 19349663)) >>> 0 }); return L; }
const hash01 = (c, k = 0) => ((c.h >>> k) % 1000) / 1000;
function buildProps() {
  const L = MeshLambert => new THREE.MeshLambertMaterial(MeshLambert);
  // 闊葉樹（t）和假樹（q：顏色淡一點點，仔細看才看得出來）
  const tq = cellsOf('tq');
  inst(new THREE.CylinderGeometry(.22, .32, 1.4, 6), L({ color: 0x7a5230 }), tq, c => ({ x: wx(c.x), y: .7, z: wz(c.y) }));
  inst(new THREE.IcosahedronGeometry(1.25, 0), L({ color: 0xffffff }), tq, c => {
    const k = .85 + hash01(c) * .5;
    return { x: wx(c.x) + (hash01(c, 3) - .5) * .5, y: 2.2 * k, z: wz(c.y), s: k, q: yq(hash01(c, 5) * 6), col: T[c.y][c.x] === 'q' ? 0x64a845 : (hash01(c, 7) < .5 ? 0x3f8a3a : 0x4a9440) };
  });
  // 松樹（森林）
  const pp = cellsOf('p');
  inst(new THREE.CylinderGeometry(.2, .3, 1.2, 5), L({ color: 0x6a4428 }), pp, c => ({ x: wx(c.x), y: .6, z: wz(c.y) }));
  inst(new THREE.ConeGeometry(1.45, 3.4, 7), L({ color: 0xffffff }), pp, c => {
    const k = .85 + hash01(c) * .55;
    return { x: wx(c.x) + (hash01(c, 2) - .5) * .6, y: 2.6 * k, z: wz(c.y) + (hash01(c, 4) - .5) * .6, s: k, q: yq(hash01(c, 6) * 6), col: hash01(c, 8) < .5 ? 0x2c6b35 : 0x347a3c };
  });
  // 岩石
  const rr = cellsOf('r');
  inst(new THREE.DodecahedronGeometry(.95, 0), L({ color: 0xffffff }), rr, c => {
    const k = .8 + hash01(c) * .5, volc = c.x > 40 && c.y < 14;
    return { x: wx(c.x), y: .45 * k, z: wz(c.y), sx: k * 1.1, sy: k * .8, sz: k, q: yq(hash01(c, 3) * 6), col: volc ? 0x5a4a44 : c.y > 41 ? 0xb8ae98 : 0x9aa0a8 };
  });
  // 懸崖、山
  const cl = cellsOf('#');
  inst(new THREE.BoxGeometry(CELL, 1, CELL), L({ color: 0xffffff }), cl, c => {
    const hgt = 3 + hash01(c) * 2.2;
    return { x: wx(c.x), y: hgt / 2, z: wz(c.y), sy: hgt, col: c.x > 39 ? 0x5a4a44 : hash01(c, 4) < .5 ? 0x7d7468 : 0x8a8070 };
  });
  const mt = new THREE.Mesh(new THREE.ConeGeometry(15, 30, 8), L({ color: 0x6d6258 }));
  mt.position.set(wx(33), 14, wz(5)); scene.add(mt);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(4.2, 8.4, 8), L({ color: 0x2a2030 }));
  snow.position.set(wx(33), 25.8, wz(5)); scene.add(snow);   // 無限山的山頂（黑黑的，惡魔獸在上面）
  // 火山口
  const vol = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 4, 9, 1, true), L({ color: 0x4a3a34, side: THREE.DoubleSide }));
  vol.position.set(wx(60), 2, wz(3)); scene.add(vol);
  // 房子：香菇屋
  const hh = cellsOf('h');
  inst(new THREE.CylinderGeometry(.95, 1.05, 1.7, 9), L({ color: 0xf3e3c3 }), hh, c => ({ x: wx(c.x), y: .85, z: wz(c.y) }));
  inst(new THREE.ConeGeometry(1.55, 1.5, 9), L({ color: 0xffffff }), hh, c => ({ x: wx(c.x), y: 2.4, z: wz(c.y), col: [0xe8524a, 0x4a8ae8, 0xf0b030, 0x9a5ae0][c.h % 4] }));
  // 花
  const ff = cellsOf('f'), fl = [];
  ff.forEach(c => { for (let i = 0; i < 4; i++) fl.push({ x: wx(c.x) + rand(-1, 1), z: wz(c.y) + rand(-1, 1), col: pick([0xff7aa8, 0xffe066, 0xffffff, 0xc49aff]) }); });
  inst(new THREE.SphereGeometry(.18, 6, 4), L({ color: 0xffffff }), fl, c => ({ x: c.x, y: .2, z: c.z, col: c.col }));
  // 木橋、踏腳石
  inst(new THREE.BoxGeometry(CELL * .98, .18, CELL * .8), L({ color: 0x9a6a3a }), cellsOf('b'), c => ({ x: wx(c.x), y: .09, z: wz(c.y) }));
  inst(new THREE.CylinderGeometry(.75, .85, .25, 8), L({ color: 0x9aa0a8 }), cellsOf('s'), c => ({ x: wx(c.x), y: .1, z: wz(c.y) }));
  // 瀑布
  inst(new THREE.BoxGeometry(CELL, 6, CELL * .6), new THREE.MeshLambertMaterial({ color: 0x9ad6ff, emissive: 0x2a5a8a, transparent: true, opacity: .85 }), cellsOf('w'), c => ({ x: wx(c.x), y: 3, z: wz(c.y) }));
  // 熔岩上方的光暈
  const lava = cellsOf('l').filter((c, i) => i % 3 === 0);
  inst(new THREE.SphereGeometry(.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .55 }), lava, c => ({ x: wx(c.x) + rand(-.8, .8), y: .1, z: wz(c.y) + rand(-.8, .8), sy: .3 }));
  // 會消失的東西：火山的柵門、裂開的岩壁
  MESH.gate = inst(new THREE.BoxGeometry(.35, 1.8, CELL), L({ color: 0x3a2a2a }), cellsOf('g'), c => ({ x: wx(c.x), y: .9, z: wz(c.y), q: yq(Math.PI / 2) }));
  MESH.gateGlow = inst(new THREE.BoxGeometry(CELL, .25, .3), new THREE.MeshBasicMaterial({ color: 0xff3030 }), cellsOf('g'), c => ({ x: wx(c.x), y: 1.4, z: wz(c.y) }));
  MESH.wall = inst(new THREE.BoxGeometry(CELL, 4.2, CELL), L({ color: 0x5a5262 }), cellsOf('x'), c => ({ x: wx(c.x), y: 2.1, z: wz(c.y) }));
}
function openGate() { G.flags.bridge = 1; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (T[y][x] === 'g') T[y][x] = ':'; MESH.gate.visible = MESH.gateGlow.visible = false; }
function openWall() { G.flags.wall = 1; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (T[y][x] === 'x') T[y][x] = 'c'; MESH.wall.visible = false; }

// ---------- 看板圖片（數碼寶貝都是 2D 圖片，永遠面向鏡頭） ----------
const TEX = {}, IMG_ASPECT = {};
const texLoader = new THREE.TextureLoader();
for (const k in SPRITES) { TEX[k] = texLoader.load(SPRITES[k]); const im = new Image(); im.onload = () => IMG_ASPECT[k] = im.width / im.height; im.src = SPRITES[k]; }
const shadowGeo = new THREE.CircleGeometry(1, 20), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false });
function makeBB(img, h, ghost) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX[img], transparent: true, alphaTest: .1 })); sp.center.set(.5, 0);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = .03;
  scene.add(sp, sh);
  const o = { sp, sh, img, h, flip: 1, y: 0 };
  if (ghost) {   // 被樹擋住時也看得到（半透明的影子）
    o.gh = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX[img], transparent: true, opacity: .32, depthTest: false, color: 0xbfe0ff })); o.gh.center.set(.5, 0); o.gh.renderOrder = 5; scene.add(o.gh);
  }
  sizeBB(o); return o;
}
function sizeBB(o) {
  const a = IMG_ASPECT[o.img] || .75;
  o.sp.scale.set(o.h * a * o.flip, o.h, 1); o.sh.scale.set(o.h * a * .42, o.h * .2, 1);
  if (o.gh) o.gh.scale.copy(o.sp.scale);
}
function setBBImg(o, img, h) { o.img = img; o.h = h; o.sp.material.map = TEX[img]; o.sp.material.needsUpdate = true; if (o.gh) { o.gh.material.map = TEX[img]; o.gh.material.needsUpdate = true; } sizeBB(o); }
function placeBB(o, x, z, y = 0) { o.sp.position.set(x, y, z + o.h * .12); o.sh.position.set(x, .03, z); if (o.gh) o.gh.position.copy(o.sp.position); }
function faceBB(o, f) { if (f !== o.flip) { o.flip = f; sizeBB(o); } }
function killBB(o) { scene.remove(o.sp, o.sh); o.sp.material.dispose(); if (o.gh) { scene.remove(o.gh); o.gh.material.dispose(); } }
// 名字／記號（畫在 canvas 上的文字看板）
function textSprite(txt, color = '#fff', size = 1) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 34px "Microsoft JhengHei", "PingFang TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(txt, 128, 32); g.fillStyle = color; g.fillText(txt, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(4 * size, 1 * size, 1); s.renderOrder = 6; scene.add(s); return s;
}
function glowTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const GLOW = { fire: glowTexture('#ff9a2e'), blue: glowTexture('#60a5fa'), cyan: glowTexture('#22d3ee'), red: glowTexture('#ff3b3b'), purple: glowTexture('#c084fc'), gold: glowTexture('#ffd84d'), white: glowTexture('#ffffff'), dark: glowTexture('#5b21b6') };
function glowSprite(tex, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); scene.add(s); return s; }

// =========================================================
//   遊戲中的狀態
//   G = 存檔資料（ui.js 會建立）　W = 這一次開遊戲才有的東西
// =========================================================
let G = null;
const W = { t: 0, enemies: [], shots: [], eShots: [], drops: [], fx: [], hazards: [], booms: [], timers: [], orbits: [], props: [], party: [], trail: [], wT: {},
  boss: null, event: null, evoT: 0, inv: 0, st: null, lvQueue: 0, shake: 0, camps: [], seenT: 0 };
const after = (t, fn) => W.timers.push({ t, fn });
const needExp = lv => Math.round(8 + lv * 6 + lv * lv * .8);

// ---------- 能力值（升級＋飾品） ----------
function calcStats() {
  const u = id => G.ups[id] || 0, m = { move: 0, armor: 0, pick: 0, coin: 0, orbit: 0, orbitDmg: 0, dmg: 0, regen: 0, exp: 0, evo: 0, evoT: 0, crit: 0, inv: 0, critDmg: 0, hp: 0, cd: 0 };
  for (const id of G.eq) { const a = ACC[id]; if (a) for (const k in a.mod) m[k] += a.mod[k]; }
  W.st = {
    maxhp: Math.round(90 + 12 * (G.lv - 1) + 25 * u('hp') + m.hp),
    dmg: (1 + .07 * (G.lv - 1)) * (1 + .15 * u('dmg')) * (1 + m.dmg),
    rate: (1 + .12 * u('cd')) * (1 + m.cd),
    move: 7.2 * (1 + .08 * u('spd')) * (1 + m.move),
    pick: 3.2 * (1 + .4 * u('pick')) * (1 + m.pick),
    armor: Math.pow(.9, u('armor')) * (1 - m.armor),
    crit: .08 + .06 * u('crit') + m.crit, critDmg: 1.8 + m.critDmg,
    regen: .8 * u('regen') + m.regen,
    orbit: u('orbit') + m.orbit, orbitDmg: 1 + m.orbitDmg,
    coin: 1 + m.coin, exp: 1 + m.exp,
    evoGain: (1 + .3 * u('evo')) * (1 + m.evo), evoDur: 20 + 4 * u('evo') + m.evoT,
    inv: .75 * (1 + m.inv),
  };
  G.hp = Math.min(G.hp, W.st.maxhp);
  rebuildOrbits();
}

// ---------- 主角隊伍 ----------
function buildParty() {
  W.party.forEach(p => killBB(p.bb));
  W.party = G.party.map((id, i) => {
    const P = PARTNERS[id], evo = W.evoT > 0;
    const o = { id, P, x: G.pos.x, z: G.pos.z, bb: makeBB(evo ? P.evo : P.img, evo ? P.eh : P.h, true), face: 1 };
    placeBB(o.bb, o.x, o.z); return o;
  });
  W.trail = [];
}
const leader = () => W.party[0];

// ---------- 敵人 ----------
function makeEnemy(kind, lv, x, z, opt = {}) {
  const E = ENEMY[kind];
  const e = { kind, name: E.name, lv, x, z, hp: E.hp * lvHp(lv), atk: E.atk * lvAtk(lv), spd: E.spd, r: E.h * .28, exp: E.exp * lvExp(lv), coin: E.coin * lvExp(lv),
    shot: E.shot, shotT: rand(1, 3), mush: E.mush, bb: makeBB(kind, E.h), flash: 0, kx: 0, kz: 0, hitCd: {},
    home: { x, z }, state: opt.aggro ? 'chase' : 'idle', wT: rand(0, 2), tx: x, tz: z, camp: opt.camp, summon: opt.summon };
  e.maxhp = e.hp; placeBB(e.bb, x, z);
  W.enemies.push(e); return e;
}
function spawnCamp(cp) {
  cp.alive = [];
  for (let i = 0; i < cp.n; i++) {
    let x, z, k = 0;
    do { x = cp.x + rand(-3.5, 3.5); z = cp.z + rand(-3.5, 3.5); } while (blocked(x, z, .5) && ++k < 20);
    if (k >= 20) { x = cp.x; z = cp.z; }
    cp.alive.push(makeEnemy(cp.kinds[i % cp.kinds.length], cp.lv + (Math.random() < .25 ? 1 : 0), x, z, { camp: cp }));
  }
  cp.deadAt = 0;
}
function buildCamps() {
  W.camps = [];
  for (const c in CAMPS) (ENTS[c] || []).forEach((en, i) => {
    const D = CAMPS[c];
    W.camps.push({ c, x: en.x, z: en.z, kinds: D.kinds, n: D.n, lv: D.lv[i] ?? D.lv[0], alive: [], deadAt: 0 });
  });
  W.camps.forEach(spawnCamp);
}
function respawnCamps(force = true) {
  for (const cp of W.camps) {
    const left = cp.alive.filter(e => !e.dead);
    if (left.length === cp.n) continue;
    if (!force && (!cp.deadAt || W.t - cp.deadAt < 150 || Math.hypot(cp.x - G.pos.x, cp.z - G.pos.z) < 32)) continue;
    left.forEach(e => { e.dead = true; e.silent = true; });
    spawnCamp(cp);
  }
}
// 頭目／精英
function makeBoss(key, x, z, opt = {}) {
  const B = BOSS[key];
  const e = { kind: key, boss: B, name: B.name, lv: 0, x, z, hp: B.hp, maxhp: B.hp, atk: B.atk, spd: B.spd, r: B.r, exp: B.exp, coin: B.coin,
    bb: makeBB(B.img, B.h), flash: 0, kx: 0, kz: 0, hitCd: {}, home: { x, z }, state: opt.idle ? 'idle' : 'chase', wT: 0, tx: x, tz: z,
    actT: 1.5, busy: 0, mi: 0, phase: 1, elite: B.elite, onWin: opt.onWin, onHalf: opt.onHalf, isBoss: !B.elite };
  placeBB(e.bb, x, z); W.enemies.push(e); return e;
}
function startBoss(key, at, opt = {}) {
  const B = BOSS[key];
  clearNear(at.x, at.z, B.arena + 5);
  const b = makeBoss(key, opt.x ?? at.x, opt.z ?? at.z, opt);
  W.boss = b; b.arena = { x: at.x, z: at.z, r: B.arena };
  if (B.arena) { W.arenaRing = new THREE.Mesh(new THREE.RingGeometry(B.arena - .25, B.arena, 64), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .6, side: THREE.DoubleSide }));
    W.arenaRing.rotation.x = -Math.PI / 2; W.arenaRing.position.set(at.x, .06, at.z); scene.add(W.arenaRing); }
  bossBar(b); sfx('boss'); banner(`⚠️ ${B.name}`);
  return b;
}
// 頭目戰開始時，把附近的小怪清掉（之後會再重生）
function clearNear(x, z, r) { for (const e of W.enemies) if (!e.dead && e.kind !== 'gear' && !e.elite && Math.hypot(e.x - x, e.z - z) < r) { e.dead = true; e.silent = true; } }
function endBossArena() { if (W.arenaRing) { scene.remove(W.arenaRing); W.arenaRing = null; } W.boss = null; bossBar(null); }

// ---------- 地圖上的人物、物件 ----------
const PROPS = W.props;
function addProp(p) { PROPS.push(p); return p; }
function npcBB(c, img, h, label) {
  const e = ent(c), bb = makeBB(img, h); placeBB(bb, e.x, e.z);
  const lb = textSprite(label, '#ffe680', .85); lb.position.set(e.x, h + .9, e.z + h * .12);
  const mk = textSprite('❗', '#ffd84d', 1.1); mk.position.set(e.x, h + 1.8, e.z + h * .12); mk.visible = false;
  return { bb, lb, mk };
}
function buildProps2() {
  PROPS.length = 0;
  // 村民
  const npc = (c, img, h, label, act, mark) => { const v = npcBB(c, img, h, label); return addProp({ c, kind: 'npc', ...ent(c), ...v, h, label, act, mark, r: 2.8 }); };
  npc('J', 'Jijimon', 2.3, '老爺爺獸長老', () => STORY.jijimon(), () => [1, 4].includes(G.q.main) || G.q.gears === 1);
  npc('E', 'Elecmon', 2.0, '電擊獸', () => STORY.elecmon(), () => G.q.eggs === undefined || G.q.eggs === 1);
  npc('N', 'Numemon', 2.0, '大廚臭臭獸', () => STORY.numemon(), () => G.q.mush === undefined || G.q.mush === 1);
  npc('$', 'Gekomon', 2.1, '雜貨店', () => STORY.geko(), () => false);
  const mame = npc('M', 'Mamemon', 1.7, '神秘商人', () => STORY.mame(), () => false); mame.night = true;
  // 電話亭
  { const e = ent('P'), g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), new THREE.MeshLambertMaterial({ color: 0x3a9a4a })); box.position.y = 1.5;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.55), new THREE.MeshLambertMaterial({ color: 0xcfefff, emissive: 0x335566 })); win.position.y = 1.7;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, .3, 1.7), new THREE.MeshLambertMaterial({ color: 0x2a7a3a })); top.position.y = 3.1;
    g.add(box, win, top); g.position.set(e.x, 0, e.z); scene.add(g);
    addProp({ c: 'P', kind: 'obj', ...e, label: '電話亭', act: () => STORY.phone(), r: 2.6, mesh: g, win, mark: () => night() && !G.flags.phone }); }
  // 石碑
  ['1', '2', '3'].forEach(n => { const e = ent(n);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, .5), new THREE.MeshLambertMaterial({ color: 0x8a8f9a, emissive: 0x113355 }));
    m.position.set(e.x, 1.1, e.z); scene.add(m);
    const gl = glowSprite(GLOW.cyan, 2.2); gl.position.set(e.x, 1.4, e.z + .3);
    addProp({ c: n, kind: 'obj', ...e, label: '古代石碑', act: () => STORY.tablet(+n), r: 2.4, mesh: m, glow: gl }); });
  // 營火（休息點）
  (ENTS['+'] || []).forEach((e, i) => {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.3, 5), new THREE.MeshLambertMaterial({ color: 0x6a4428 })); lg.rotation.z = Math.PI / 2; lg.rotation.y = k * Math.PI / 4; lg.position.y = .15; g.add(lg); }
    g.position.set(e.x, 0, e.z); scene.add(g);
    const fl = glowSprite(GLOW.fire, 2.4); fl.position.set(e.x, .9, e.z);
    addProp({ c: '+', kind: 'obj', ...e, label: '營火', act: () => STORY.rest(i), r: 2.6, fl, rest: i });
  });
  // 寶箱
  (ENTS['C'] || []).forEach((e, i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, .8, .9), new THREE.MeshLambertMaterial({ color: 0x9a5a2a })); b.position.y = .4;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.35, .35, .95), new THREE.MeshLambertMaterial({ color: 0xd9a030, emissive: 0x332200 })); lid.position.y = .95;
    g.add(b, lid); g.position.set(e.x, 0, e.z); g.rotation.y = rand(-.4, .4); scene.add(g);
    addProp({ c: 'C', kind: 'chest', ...e, label: '寶箱', act: () => openChest(i), r: 2.2, mesh: g, lid });
  });
  // 數碼蛋
  (ENTS['o'] || []).forEach((e, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 10), new THREE.MeshLambertMaterial({ color: [0xfff6e0, 0xffd6e8, 0xd6f0ff, 0xe8ffd6, 0xfff0b0][i], emissive: 0x222222 }));
    m.scale.set(1, 1.3, 1); m.position.set(e.x, .7, e.z); scene.add(m);
    addProp({ c: 'o', kind: 'egg', ...e, r: 1.4, mesh: m, idx: i });
  });
  // 黑色齒輪（可以打碎的物件）
  (ENTS['*'] || []).forEach((e, i) => {
    if (G.gears.includes(i)) return;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .32, 6, 12), new THREE.MeshLambertMaterial({ color: 0x1a1a22, emissive: 0x2a0a3a }));
    g.add(ring);
    for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.4, .5, .3), ring.material); t.position.set(Math.cos(k / 8 * 6.283) * 1.25, Math.sin(k / 8 * 6.283) * 1.25, 0); t.rotation.z = k / 8 * 6.283; g.add(t); }
    g.position.set(e.x, 1.6, e.z); scene.add(g);
    const gl = glowSprite(GLOW.dark, 3.4); gl.position.set(e.x, 1.6, e.z);
    const en = { kind: 'gear', name: '黑色齒輪', gear: i, x: e.x, z: e.z, hp: 120 + 60 * i, maxhp: 120 + 60 * i, atk: 0, spd: 0, r: 1.1, exp: 0, coin: 30, bb: null, mesh: g, glow: gl, flash: 0, kx: 0, kz: 0, hitCd: {}, state: 'still' };
    W.enemies.push(en);
  });
  // 劇情人物（還沒打的頭目站在原地）
  if (G.q.main <= 3) { const e = ent('K'); W.kuwaSleep = makeBB('Kuwagamon', 4.0); placeBB(W.kuwaSleep, e.x, e.z); }
  if (!G.flags.mono) { const e = ent('O'); W.monoIdle = makeBB('Monochromon', 4.0); placeBB(W.monoIdle, e.x, e.z); }
  if (!G.flags.mera) { const e = ent('F'); W.meraIdle = makeBB('Meramon', 5.0); placeBB(W.meraIdle, e.x, e.z); }
  if (!G.flags.leo) { const e = ent('L'); W.leoIdle = makeBB('Leomon', 4.4); placeBB(W.leoIdle, e.x, e.z); }
  if (G.q.main === 2) { const e = ent('G'); W.gabuWait = makeBB('Gabumon', 2.1); placeBB(W.gabuWait, e.x, e.z); }
  // 流浪的精英
  if (!G.flags.orge) { const e = ent('Y'); W.orge = makeBoss('Orgemon', e.x, e.z, { idle: true, onWin: () => { G.flags.orge = 1; secret('orge'); } }); }
  if (!G.flags.tyrano) { const e = ent('T'); W.tyr = makeBoss('Tyranomon', e.x, e.z, { idle: true, onWin: () => { G.flags.tyrano = 1; secret('tyrano'); } }); }
  refreshProps();
}
function refreshProps() {
  for (const p of PROPS) {
    if (p.kind === 'chest' && G.chests.includes(p.i)) { p.done = true; p.lid.rotation.x = -1.1; p.lid.position.set(0, 1.1, -.45); p.lid.material = p.lid.material.clone(); p.lid.material.emissive.set(0); p.lid.material.color.set(0x7a5a2a); }
    if (p.kind === 'egg') p.mesh.visible = !G.eggs.includes(p.idx);
    if (p.glow) p.glow.visible = !G.tabs.includes(+p.c);
  }
}
function openChest(i) {
  if (G.chests.includes(i)) return say([['旁白', '寶箱已經空了。']]);
  G.chests.push(i); refreshProps(); sfx('chest');
  const C = CHESTS[i], got = [];
  if (C.coin) { give('coin', C.coin); got.push(`💰 ${C.coin} 數碼幣`); }
  if (C.meat) { give('meat', C.meat); got.push(`🍖 肉 ×${C.meat}`); }
  if (C.bigMeat) { give('bigMeat', C.bigMeat); got.push(`🍗 大塊肉 ×${C.bigMeat}`); }
  if (C.acc) { giveAcc(C.acc, true); got.push(`${ACC[C.acc].ic} <b>${ACC[C.acc].name}</b>（${ACC[C.acc].desc}）`); }
  save();
  return say([['寶箱', '打開寶箱！<br>' + got.join('<br>')]]);
}

// =========================================================
//   戰鬥
// =========================================================
const shotGeo = new THREE.SphereGeometry(.28, 10, 8);
const SHOT_COL = { fire: 0xffd27a, blue: 0xb8e1ff, magic: 0xffb0d0 };
function nearest(x, z, range, n = 1) {
  const r2 = range * range, L = [];
  for (const e of W.enemies) { if (e.dead) continue; const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < r2) L.push({ e, d }); }
  L.sort((a, b) => a.d - b.d); return L.slice(0, n).map(o => o.e);
}
function shoot(from, ang, o) {
  const mesh = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color: o.col })); mesh.scale.setScalar(o.size || 1);
  const glow = glowSprite(o.tex, 2.2 * (o.size || 1)), y = o.y ?? 1.1;
  mesh.position.set(from.x, y, from.z); glow.position.copy(mesh.position); scene.add(mesh);
  W.shots.push({ x: from.x, z: from.z, y, vx: Math.cos(ang) * o.spd, vz: Math.sin(ang) * o.spd, life: o.life || 1.2, dmg: o.dmg, pierce: o.pierce || 0, boom: o.boom || 0, hit: new Set(), mesh, glow, r: .5 * (o.size || 1) });
}
function weapons(dt) {
  const st = W.st, evo = W.evoT > 0;
  for (const p of W.party) {
    W.wT[p.id] = (W.wT[p.id] || 0) - dt * st.rate;
    if (W.wT[p.id] > 0) continue;
    const tg = nearest(p.x, p.z, 19, 6);
    if (!tg.length) { W.wT[p.id] = .1; continue; }
    const a0 = Math.atan2(tg[0].z - p.z, tg[0].x - p.x);
    faceBB(p.bb, tg[0].x < p.x ? -1 : 1);
    if (p.id === 'agumon') {
      W.wT[p.id] = .75;
      const n = 1 + (G.ups.fire || 0);
      for (let i = 0; i < n; i++) { const t = tg[i % tg.length]; shoot(p, Math.atan2(t.z - p.z, t.x - p.x) + (i >= tg.length ? rand(-.2, .2) : 0), { col: SHOT_COL.fire, tex: evo ? GLOW.fire : GLOW.fire, spd: 20, dmg: 10 * st.dmg * (evo ? 1.9 : 1), size: evo ? 1.6 : 1, boom: evo ? 2.4 : 0, y: evo ? 1.8 : 1 }); }
      sfx('shoot');
    } else if (p.id === 'gabumon') {
      W.wT[p.id] = 1.15;
      const n = evo ? 2 : 1;
      for (let i = 0; i < n; i++) shoot(p, a0 + (i - (n - 1) / 2) * .12, { col: SHOT_COL.blue, tex: GLOW.blue, spd: 25, dmg: 12 * (1 + .1 * (G.ups.pierce || 0)) * st.dmg * (evo ? 1.8 : 1), pierce: 2 + (G.ups.pierce || 0) + (evo ? 2 : 0), size: evo ? 1.3 : .9, life: 1 });
    } else if (p.id === 'piyomon') {
      W.wT[p.id] = 1.5;
      const n = 3 + 2 * (G.ups.magic || 0);
      for (let i = 0; i < n; i++) shoot(p, a0 + (i - (n - 1) / 2) * .2, { col: SHOT_COL.magic, tex: GLOW.fire, spd: 15, dmg: 6.5 * st.dmg * (evo ? 1.6 : 1), size: .8, life: .95, y: 1.6 });
      if (evo) for (const t of nearest(p.x, p.z, 15, 3)) boom(t.x + rand(-1, 1), t.z + rand(-1, 1), 2.3, 16 * st.dmg, .35);
    }
  }
}
// 我方的爆炸（暴龍獸的火焰、巴多拉獸的流星）
function boom(x, z, r, dmg, delay = 0) {
  const go = () => { burst(x, z, 10, GLOW.fire); for (const e of W.enemies) if (!e.dead && Math.hypot(e.x - x, e.z - z) < r + e.r) hitEnemy(e, dmg, 0, 0, true); };
  delay ? after(delay, go) : go();
}
function rebuildOrbits() {
  W.orbits.forEach(o => scene.remove(o.glow));
  W.orbits = [];
  const n = W.st ? W.st.orbit : 0;
  for (let i = 0; i < n; i++) W.orbits.push({ a: i / n * Math.PI * 2, glow: glowSprite(GLOW.red, 2) });
}
function hitEnemy(e, dmg, kx, kz, noCrit) {
  if (e.dead) return;
  const crit = !noCrit && Math.random() < W.st.crit; if (crit) dmg *= W.st.critDmg;
  if (e.isBoss || e.elite) dmg *= 1;
  e.hp -= dmg; e.flash = .12;
  if (!e.boss && e.spd) { e.kx += kx * 5; e.kz += kz * 5; }
  if (e.state === 'idle' && e.kind !== 'gear') aggro(e);
  dmgText(e.x, 1.6, e.z, Math.round(dmg), crit ? 'big' : '');
  sfx('hit');
  if (e === W.boss || e.elite) bossBar(e);
  if (e.boss && e.onHalf && e.phase === 1 && e.hp < e.maxhp / 2) { e.phase = 2; const f = e.onHalf; e.onHalf = null; f(e); }
  if (e.hp <= 0) killEnemy(e);
}
function aggro(e) {
  e.state = 'chase';
  if (e.camp) for (const o of e.camp.alive) if (!o.dead && o.state === 'idle') o.state = 'chase';
  if (e.elite && !W.boss) bossBar(e);
}
function killEnemy(e) {
  e.dead = true; G.kills++;
  burst(e.x, e.z, e.boss ? 40 : 8, e.boss ? GLOW.fire : e.kind === 'gear' ? GLOW.dark : GLOW.cyan);
  if (e.exp) dropGem(e.x, e.z, e.exp * W.st.exp);
  if (e.coin && (e.boss || e.kind === 'gear' || Math.random() < .6)) dropCoin(e.x + rand(-.5, .5), e.z + rand(-.5, .5), Math.max(1, Math.round(e.coin * W.st.coin * rand(.7, 1.3))));
  if (e.mush && Math.random() < e.mush) dropMush(e.x, e.z);
  if (G.evoOn && !W.evoT) G.evo = Math.min(100, G.evo + (e.boss ? 15 : 2.2) * W.st.evoGain);
  if (e.camp && e.camp.alive.every(o => o.dead)) e.camp.deadAt = W.t;
  if (e.kind === 'gear') { scene.remove(e.mesh, e.glow); gearBroken(e); }
  if (e.boss) {
    if (e.boss.drop) after(.6, () => giveAcc(e.boss.drop, true));
    if (e.boss.bigMeat) give('bigMeat', e.boss.bigMeat);
    W.enemies.forEach(o => { if (o.summon && !o.dead) { o.dead = true; burst(o.x, o.z, 6, GLOW.cyan); } });
    W.hazards.forEach(h => h.t = 99); W.eShots.forEach(s => s.life = 0);
    if (e === W.boss) endBossArena(); else bossBar(null);
    sfx('win'); banner(`🏆 打倒了${e.name}！`);
    if (e.onWin) { W.trig = true; after(1.2, () => { W.trig = false; e.onWin(e); }); }   // 勝利劇情跑完前不要再觸發同一隻頭目
  }
}
function gearBroken(e) {
  G.gears.push(e.gear); sfx('rumble'); shake(.5);
  toast(`⚙️ 打碎了黑色齒輪！（${G.gears.length}/5）`);
  // 齒輪碎掉時，被控制的數碼寶貝會跳出來
  const cx = cellOf(e.x), cy = cellOf(e.z);
  const kinds = cy > 41 ? ['Betamon', 'Otamamon'] : cx < 26 ? ['Kunemon', 'Goburimon', 'Mushmon'] : cy < 13 ? ['Goburimon', 'Tyranomon'] : ['Hagurumon', 'Gazimon'];
  const lv = cy < 13 ? 11 : cx < 26 ? 5 : 7;
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; let x = e.x + Math.cos(a) * 5, z = e.z + Math.sin(a) * 5; if (blocked(x, z, .5)) { x = e.x; z = e.z; } makeEnemy(pick(kinds), lv, x, z, { aggro: true, summon: true }); }
  checkQuests(); save();
}
// 掉落物
const gemGeo = new THREE.OctahedronGeometry(.3, 0), gemMat = new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x0e7490 });
const coinGeo = new THREE.CylinderGeometry(.32, .32, .1, 12), coinMat = new THREE.MeshLambertMaterial({ color: 0xffd84d, emissive: 0x664400 });
const mushGeo = new THREE.SphereGeometry(.35, 8, 6, 0, 6.283, 0, 1.6), mushMat = new THREE.MeshLambertMaterial({ color: 0xd04040, emissive: 0x330000 });
function dropThing(x, z, type, v, geo, mat) { const m = new THREE.Mesh(geo, mat); m.position.set(x, .5, z); if (type === 'exp') m.scale.setScalar(Math.min(2, .8 + v * .05)); if (type === 'coin') m.rotation.x = Math.PI / 2; scene.add(m); W.drops.push({ x, z, type, v, mesh: m, pull: false, age: 0 }); }
const dropGem = (x, z, v) => dropThing(x, z, 'exp', v, gemGeo, gemMat);
const dropCoin = (x, z, v) => dropThing(x, z, 'coin', v, coinGeo, coinMat);
const dropMush = (x, z) => dropThing(x, z, 'mush', 1, mushGeo, mushMat);

// ---------- 敵人的攻擊：預警範圍 ----------
const hzMatFill = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide });
const hzMatEdge = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
const circGeo = new THREE.CircleGeometry(1, 40), ringGeo = new THREE.RingGeometry(.94, 1, 40), planeGeo = new THREE.PlaneGeometry(1, 1);
function hzCircle(x, z, r, warn, dmg, opt = {}) {
  const fill = new THREE.Mesh(circGeo, hzMatFill), edge = new THREE.Mesh(ringGeo, hzMatEdge);
  [fill, edge].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.set(x, .07, z); scene.add(m); });
  edge.scale.set(r, r, 1); fill.scale.set(.01, .01, 1);
  W.hazards.push({ kind: 'c', x, z, r, t: 0, T: warn, dmg, fill, edge, ...opt });
}
function hzLine(x, z, ang, len, w, warn, dmg, opt = {}) {
  const cx = x + Math.cos(ang) * len / 2, cz = z + Math.sin(ang) * len / 2;
  const fill = new THREE.Mesh(planeGeo, hzMatFill), edge = new THREE.Mesh(planeGeo, hzMatEdge.clone());
  edge.material.opacity = .25;
  [fill, edge].forEach(m => { m.rotation.x = -Math.PI / 2; m.rotation.z = -ang; m.position.set(cx, .07, cz); scene.add(m); });
  edge.scale.set(len, w, 1); fill.scale.set(len, .01, 1);
  W.hazards.push({ kind: 'l', x, z, ang, len, w, t: 0, T: warn, dmg, fill, edge, ...opt });
}
function inHazard(h, x, z) {
  if (h.kind === 'c') return Math.hypot(x - h.x, z - h.z) < h.r + .4;
  const dx = x - h.x, dz = z - h.z, along = dx * Math.cos(h.ang) + dz * Math.sin(h.ang), side = -dx * Math.sin(h.ang) + dz * Math.cos(h.ang);
  return along > -.5 && along < h.len + .5 && Math.abs(side) < h.w / 2 + .4;
}
function updHazards(dt) {
  for (const h of W.hazards) {
    h.t += dt; const k = Math.min(1, h.t / h.T);
    if (h.kind === 'c') h.fill.scale.set(h.r * k, h.r * k, 1); else h.fill.scale.set(h.len, h.w * k, 1);
    if (h.t >= h.T && !h.fired) {
      h.fired = true;
      if (h.t < 50) {
        if (h.kind === 'c') burst(h.x, h.z, 12, h.tex || GLOW.fire); else for (let i = 0; i < 6; i++) burst(h.x + Math.cos(h.ang) * h.len * i / 5, h.z + Math.sin(h.ang) * h.len * i / 5, 3, h.tex || GLOW.cyan);
        if (h.dmg && inHazard(h, G.pos.x, G.pos.z)) hurt(h.dmg, h.knock ? { x: h.x, z: h.z, f: h.knock } : null);
        if (h.then) h.then();
      }
    }
  }
  W.hazards = W.hazards.filter(h => { if (h.fired) { scene.remove(h.fill, h.edge); if (h.edge.material !== hzMatEdge) h.edge.material.dispose(); return false; } return true; });
}
function eShot(x, z, ang, spd, dmg, tex = GLOW.red, size = 1.6, life = 3) {
  const g = glowSprite(tex, size); g.position.set(x, 1.2, z);
  W.eShots.push({ x, z, vx: Math.cos(ang) * spd, vz: Math.sin(ang) * spd, life, dmg, glow: g, r: size * .28 });
}
const toPlayer = e => Math.atan2(G.pos.z - e.z, G.pos.x - e.x);
// 頭目的招式。回傳這招大概要花幾秒
function chargeAt(b, warn, len = 16, spd = 26) {
  const a = toPlayer(b);
  hzLine(b.x, b.z, a, len, 2.8, warn, 0, { then: () => { b.dash = { vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, t: len / spd }; sfx('dash'); } });
  return warn + len / spd;
}
const BOSS_MOVES = {
  jet(b) { const a = toPlayer(b); hzLine(b.x, b.z, a, 18, 2.6, 1, b.atk * 1.3, { tex: GLOW.cyan }); return 1.2; },
  slam(b) { hzCircle(b.x, b.z, 5.5, 1.1, b.atk * 1.5); return 1.3; },
  summonOta(b) { for (let i = 0; i < 3; i++) makeEnemy('Otamamon', 3, b.x + rand(-3, 3), b.z + rand(-3, 3), { aggro: true, summon: true }); return .6; },
  charge(b) { return chargeAt(b, .9) + .3; },
  charge3(b) { const t1 = chargeAt(b, .75) + .25; after(t1, () => { if (!b.dead) { const t2 = chargeAt(b, .6) + .25; after(t2, () => { if (!b.dead) chargeAt(b, .6); }); } }); return t1 * 3; },
  dash2(b) { const t1 = chargeAt(b, .55, 15, 30) + .15; after(t1, () => { if (!b.dead) chargeAt(b, .5, 15, 30); }); return t1 * 2 + .2; },
  spin(b) { const n = 10, o = rand(0, 1); for (let i = 0; i < n; i++) eShot(b.x, b.z, (i + o) / n * 6.283, 9, b.atk * .8, GLOW.red); sfx('boss'); return .8; },
  dive(b) { for (let i = 0; i < 3; i++) after(i * .5, () => { if (!b.dead) hzCircle(G.pos.x, G.pos.z, 3, 1, b.atk * 1.5); }); return 2; },
  boulder(b) { hzCircle(G.pos.x, G.pos.z, 2.8, 1.3, b.atk * 1.4, { tex: GLOW.fire }); for (let i = 0; i < 2; i++) hzCircle(G.pos.x + rand(-5, 5), G.pos.z + rand(-5, 5), 2.8, 1.3, b.atk * 1.4); return 1.5; },
  stomp(b) { hzCircle(b.x, b.z, 6.5, 1.2, b.atk * 1.6); return 1.4; },
  ring(b) {
    const n = 16; for (let i = 0; i < n; i++) eShot(b.x, b.z, i / n * 6.283, 9, b.atk * .8, GLOW.fire, 1.8);
    if (b.phase > 1) after(.45, () => { if (!b.dead) for (let i = 0; i < n; i++) eShot(b.x, b.z, (i + .5) / n * 6.283, 9, b.atk * .8, GLOW.fire, 1.8); });
    return 1;
  },
  meteor(b) { const n = b.phase > 1 ? 9 : 6; hzCircle(G.pos.x, G.pos.z, 2.4, 1.2, b.atk * 1.4); for (let i = 1; i < n; i++) { const a = rand(0, 6.283), d = rand(2, 7); hzCircle(G.pos.x + Math.cos(a) * d, G.pos.z + Math.sin(a) * d, 2.4, 1.2 + i * .06, b.atk * 1.4); } return 1.7; },
  fist(b) { for (let i = 0; i < 3; i++) after(i * .28, () => { if (!b.dead) eShot(b.x, b.z, toPlayer(b), 16, b.atk, GLOW.fire, 2.4); }); return 1.1; },
  summonFire(b) { const n = b.phase > 1 ? 4 : 3; for (let i = 0; i < n; i++) makeEnemy('Goburimon', 10, b.x + rand(-4, 4), b.z + rand(-4, 4), { aggro: true, summon: true }); return .6; },
  lionFist(b) { const a = toPlayer(b); for (let i = -1; i <= 1; i++) eShot(b.x, b.z, a + i * .25, 15, b.atk * 1.3, GLOW.gold, 3.2); if (b.phase > 1) after(.4, () => { if (!b.dead) { const a2 = toPlayer(b); for (let i = -2; i <= 2; i += 2) eShot(b.x, b.z, a2 + i * .18, 15, b.atk * 1.3, GLOW.gold, 3.2); } }); return 1; },
  roar(b) { hzCircle(b.x, b.z, 7.5, 1, b.atk * 1.5, { knock: 9 }); return 1.3; },
  club(b) { hzCircle(G.pos.x, G.pos.z, 3.6, .9, b.atk * 1.6); return 1.2; },
  breath(b) { const a = toPlayer(b); for (let i = -2; i <= 2; i++) eShot(b.x, b.z, a + i * .18, 11, b.atk * .9, GLOW.fire, 1.8); after(.5, () => { if (!b.dead) { const a2 = toPlayer(b); for (let i = -2; i <= 2; i++) eShot(b.x, b.z, a2 + i * .18 + .09, 11, b.atk * .9, GLOW.fire, 1.8); } }); return 1.2; },
};

// ---------- 主角受傷 ----------
function hurt(dmg, knock) {
  if (W.inv > 0 || W.dead) return;
  dmg *= W.st.armor * (W.evoT > 0 ? .8 : 1);
  G.hp -= dmg; W.inv = W.st.inv; sfx('hurt');
  dmgText(G.pos.x, 2.6, G.pos.z, '-' + Math.round(dmg), 'hurt');
  hurtFlash();
  if (G.evoOn && !W.evoT) G.evo = Math.min(100, G.evo + 1.5 * W.st.evoGain);
  if (knock) { const a = Math.atan2(G.pos.z - knock.z, G.pos.x - knock.x); W.knock = { vx: Math.cos(a) * knock.f, vz: Math.sin(a) * knock.f, t: .25 }; }
  if (G.hp <= 0) { G.hp = 0; die(); }
  updateHUD();
}
function heal(n) { const b = G.hp; G.hp = Math.min(W.st.maxhp, G.hp + n); if (G.hp - b >= 1) dmgText(G.pos.x, 2.8, G.pos.z, '+' + Math.round(G.hp - b), 'heal'); updateHUD(); }

// ---------- 進化 ----------
function evolve() {
  if (!G.evoOn || W.evoT > 0 || G.evo < 100 || W.dead) return;
  W.evoT = W.st.evoDur; G.evo = 100;
  W.party.forEach(p => { setBBImg(p.bb, p.P.evo, p.P.eh); burst(p.x, p.z, 30, GLOW.fire); });
  sfx('evolve'); shake(.6);
  for (const e of W.enemies) { const dx = e.x - G.pos.x, dz = e.z - G.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 9 && !e.dead) hitEnemy(e, 40 * W.st.dmg, dx / d * 3, dz / d * 3, true); }
  banner('✨ ' + W.party.map(p => p.P.evoName).join('、') + '！');
  heal(W.st.maxhp * .25);
}
function devolve() { W.evoT = 0; G.evo = 0; W.party.forEach(p => { setBBImg(p.bb, p.P.img, p.P.h); burst(p.x, p.z, 10, GLOW.white); }); }

// ---------- 特效 ----------
function burst(x, z, n, tex) {
  for (let i = 0; i < n && W.fx.length < 260; i++) { const s = glowSprite(tex, rand(.4, 1)); s.position.set(x, rand(.5, 2), z); W.fx.push({ s, vx: rand(-6, 6), vy: rand(2, 8), vz: rand(-6, 6), life: rand(.3, .7) }); }
}
function shake(s) { W.shake = Math.max(W.shake, s); }

// ---------- 時間（白天／晚上） ----------
const DAY_LEN = 240;
const night = () => G && (G.time > .72 && G.time < .96);
function setTime(t) { G.time = t; }
function updSky() {
  const t = G.time;
  // 0 = 白天、1 = 晚上
  let n = t < .62 ? 0 : t < .72 ? (t - .62) / .1 : t < .96 ? 1 : 1 - (t - .96) / .04;
  const dusk = t > .6 && t < .76 ? Math.sin((t - .6) / .16 * Math.PI) : 0;
  const col = SKY_DAY.clone().lerp(SKY_NIGHT, n).lerp(SKY_DUSK, dusk * .35);
  scene.background.copy(col); scene.fog.color.copy(col);
  hemi.intensity = .85 - .55 * n; sun.intensity = .55 - .42 * n;
  sun.color.setHSL(.1, .3 * dusk, 1 - .3 * n);
  lamp.intensity = 1.3 * n;
  ground.material.emissiveIntensity = .25 + .75 * n;
}
