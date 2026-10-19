'use strict';
/* =========================================================
   數碼倖存者（3D 試玩版）
   Three.js：3D 場地＋鏡頭，數碼寶貝用 2D 圖片當看板（永遠面向鏡頭）
   ========================================================= */
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WORLD = 95;   // 場地半徑

// ---------- 音效（Web Audio 合成，不用音檔） ----------
let AC = null;
let MUTED = false; try { MUTED = localStorage.getItem('digi-survivor-mute') === '1'; } catch (e) { }
function setMute(m) {
  MUTED = m; try { localStorage.setItem('digi-survivor-mute', m ? '1' : '0'); } catch (e) { }
  document.querySelectorAll('.muteBtn').forEach(b => b.textContent = m ? '🔇' : '🔊');
}
function tone(f, f2, dur, vol = .08, type = 'square') {
  if (MUTED) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur);
  } catch (e) { }
}
const SFX = {
  shoot: () => tone(600, 300, .06, .025, 'triangle'),
  hit: () => tone(180, 90, .06, .04),
  pickup: () => tone(1100, 1600, .05, .03, 'sine'),
  level: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0, .15, .07, 'triangle'), i * 70)),
  hurt: () => tone(160, 60, .2, .08, 'sawtooth'),
  evolve: () => { tone(150, 1200, .9, .07, 'sawtooth'); setTimeout(() => tone(1046, 0, .4, .08, 'triangle'), 700); },
};

// ---------- 場景 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecf9a);
scene.fog = new THREE.Fog(0x8ecf9a, 34, 70);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
const CAM_OFF = new THREE.Vector3(0, 19, 15);
scene.add(new THREE.HemisphereLight(0xffffff, 0x446633, .75));
const sun = new THREE.DirectionalLight(0xffffff, .45); sun.position.set(20, 40, 10); scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  CAM_OFF.set(0, h > w ? 24 : 19, h > w ? 17 : 15);   // 手機直拿時鏡頭拉遠一點
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// 地面：程式畫的草地紋理
function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#5a9a48'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < .5 ? '#4c8a3e' : '#6cae58'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3 + Math.random() * 3); }
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(226,207,154,.35)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 14, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2 + 40, WORLD * 2 + 40), new THREE.MeshLambertMaterial({ map: grassTexture() }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

// 樹、石頭（低多邊形）
(() => {
  const N = 170;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .35, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x7a5230 }), N);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.2, 7), new THREE.MeshLambertMaterial({ color: 0x2f7d3b, flatShading: true }), N);
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.8, 0), new THREE.MeshLambertMaterial({ color: 0x9a9fab, flatShading: true }), 60);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    let x, z; do { x = rand(-WORLD - 15, WORLD + 15); z = rand(-WORLD - 15, WORLD + 15); } while (Math.hypot(x, z) < 12);
    const k = rand(.8, 1.4);
    m.compose(p.set(x, .7 * k, z), q.identity(), s.set(k, k, k)); trunk.setMatrixAt(i, m);
    m.compose(p.set(x, 2.8 * k, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6)), s.set(k, k, k)); leaf.setMatrixAt(i, m);
  }
  for (let i = 0; i < 60; i++) { const k = rand(.5, 1.3); m.compose(p.set(rand(-WORLD, WORLD), .3 * k, rand(-WORLD, WORLD)), q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), s.set(k, k * .7, k)); rock.setMatrixAt(i, m); }
  scene.add(trunk, leaf, rock);
  // 場地邊界：一圈石柱
  const pillar = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 2.5, 1.2), new THREE.MeshLambertMaterial({ color: 0x5b6477 }), 120);
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; m.compose(p.set(Math.cos(a) * (WORLD + 2), 1.25, Math.sin(a) * (WORLD + 2)), q.identity(), s.set(1, 1, 1)); pillar.setMatrixAt(i, m); }
  scene.add(pillar);
})();

// ---------- 看板圖片 ----------
const TEX = {};
const texLoader = new THREE.TextureLoader();
for (const k in SPRITES) TEX[k] = texLoader.load(SPRITES[k]);
const IMG_ASPECT = {};
for (const k in SPRITES) { const im = new Image(); im.onload = () => IMG_ASPECT[k] = im.width / im.height; im.src = SPRITES[k]; }
const shadowGeo = new THREE.CircleGeometry(1, 20), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false });
function makeBillboard(img, h) {
  const mat = new THREE.SpriteMaterial({ map: TEX[img], transparent: true, alphaTest: .1 });
  const sp = new THREE.Sprite(mat); sp.center.set(.5, 0);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = .02;
  scene.add(sp, sh);
  const o = { sp, sh, img, h, flip: 1 };
  setBillboardSize(o);
  return o;
}
function setBillboardSize(o) { const a = IMG_ASPECT[o.img] || .75; o.sp.scale.set(o.h * a * o.flip, o.h, 1); o.sh.scale.set(o.h * a * .45, o.h * .22, 1); }
function setImg(o, img, h) { o.img = img; o.h = h; o.sp.material.map = TEX[img]; o.sp.material.needsUpdate = true; setBillboardSize(o); }
function placeBillboard(o, x, z) { o.sp.position.set(x, 0, z); o.sh.position.set(x, .02, z); }
function removeBillboard(o) { scene.remove(o.sp, o.sh); o.sp.material.dispose(); }

// 發光的貼圖（火球、碎片用）
function glowTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const GLOW = { fire: glowTexture('#ff9a2e'), blue: glowTexture('#60a5fa'), cyan: glowTexture('#22d3ee'), red: glowTexture('#ff3b3b') };
function glowSprite(tex, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); scene.add(s); return s; }

// ---------- 遊戲狀態 ----------
const FORMS = [
  { name: '亞古獸', img: 'Agumon', h: 2.2, shot: '小火球', dmgMul: 1, size: .7 },
  { name: '暴龍獸', img: 'Greymon', h: 3.4, shot: '超級火焰', dmgMul: 1.7, size: 1.1 },
  { name: '機械暴龍獸', img: 'Metal_Greymon', h: 4.0, shot: '巨型破壞彈', dmgMul: 2.6, size: 1.4 },
];
const ENEMY_TYPES = {
  Kunemon:   { hp: 14, spd: 3.0, dmg: 6, h: 1.8, exp: 1 },
  Numemon:   { hp: 20, spd: 2.4, dmg: 7, h: 1.9, exp: 1 },
  Goburimon: { hp: 34, spd: 3.3, dmg: 9, h: 2.3, exp: 2 },
  Betamon:   { hp: 44, spd: 3.8, dmg: 10, h: 2.0, exp: 2 },
  Mushmon:   { hp: 60, spd: 2.8, dmg: 12, h: 2.3, exp: 3 },
};
let S = null;   // 一局的所有狀態
const keys = new Set();

function newGame() {
  if (S) cleanup();
  const pl = makeBillboard('Agumon', FORMS[0].h);
  S = {
    t: 0, running: true, paused: false, kills: 0, level: 1, exp: 0, form: 0, bossSpawned: false, boss: null, won: false,
    p: { x: 0, z: 0, hp: 100, maxhp: 100, speed: 7, inv: 0, bb: pl, face: 1 },
    stat: { dmg: 12, cd: .7, count: 1, pierce: 0, pickup: 3.2, armor: 0, orbit: 0, orbitDmg: 8 },
    cdT: 0, spawnT: 0, enemies: [], shots: [], gems: [], fx: [], orbits: [], eShots: [],
  };
  updateHUD();
}
function cleanup() {
  removeBillboard(S.p.bb);
  S.enemies.forEach(e => removeBillboard(e.bb));
  S.shots.forEach(s => { scene.remove(s.mesh, s.glow); });
  S.eShots.forEach(s => scene.remove(s.glow));
  S.gems.forEach(g => scene.remove(g.mesh));
  S.fx.forEach(f => scene.remove(f.s));
  S.orbits.forEach(o => scene.remove(o.glow));
  $('#dmgLayer').innerHTML = '';
}

// ---------- 敵人 ----------
function spawnEnemy(type, opt = {}) {
  const T = ENEMY_TYPES[type] || opt.T, a = rand(0, Math.PI * 2), r = opt.r || rand(24, 30);
  const x = clamp(S.p.x + Math.cos(a) * r, -WORLD, WORLD), z = clamp(S.p.z + Math.sin(a) * r, -WORLD, WORLD);
  const scale = opt.boss ? 1 : 1 + S.t / 70;   // 時間越久越硬（頭目固定）
  const e = { type, x, z, hp: T.hp * scale * (opt.hpMul || 1), spd: T.spd * (opt.spdMul || 1), dmg: T.dmg * (1 + S.t / 180) * (opt.dmgMul || 1),
    r: T.h * .3, exp: T.exp, bb: makeBillboard(type, T.h * (opt.sizeMul || 1)), flash: 0, kx: 0, kz: 0, boss: !!opt.boss, hitCd: {} };
  e.maxhp = e.hp;
  placeBillboard(e.bb, x, z);
  S.enemies.push(e);
  return e;
}
function spawnWave(dt) {
  S.spawnT -= dt;
  if (S.spawnT > 0) return;
  const t = S.t;
  S.spawnT = Math.max(.3, .8 - t * .004);
  const pool = t < 30 ? ['Kunemon', 'Numemon'] : t < 60 ? ['Kunemon', 'Numemon', 'Goburimon'] : t < 95 ? ['Goburimon', 'Numemon', 'Betamon'] : ['Goburimon', 'Betamon', 'Mushmon'];
  const n = 1 + Math.floor(t / 40);
  for (let i = 0; i < n && S.enemies.length < 120; i++) spawnEnemy(pick(pool));
  // 偶爾一整圈包圍
  if (t > 45 && Math.random() < .015) { const ty = pick(pool); for (let i = 0; i < 14; i++) spawnEnemy(ty, { r: 22 }); }
}
function spawnBoss() {
  S.bossSpawned = true;
  const b = spawnEnemy('Meramon', { T: { hp: 1100, spd: 3.6, dmg: 22, h: 5.2, exp: 30 }, boss: true, r: 20 });
  b.r = 1.4; b.fireT = 3;
  S.boss = b;
  banner('😈 頭目 火焰獸 出現了！');
}
function hitEnemy(e, dmg, kx, kz) {
  if (e.dead) return;
  const crit = Math.random() < .1; if (crit) dmg *= 1.8;
  e.hp -= dmg; e.flash = .12;
  if (!e.boss) { e.kx += kx * 6; e.kz += kz * 6; }
  dmgText(e.x, 1.5, e.z, Math.round(dmg), crit ? 'big' : '');
  SFX.hit();
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; S.kills++;
  burst(e.x, e.z, e.boss ? 40 : 8, e.boss ? GLOW.fire : GLOW.cyan);
  dropGem(e.x, e.z, e.exp);
  if (e.boss) { for (let i = 0; i < 20; i++) dropGem(e.x + rand(-3, 3), e.z + rand(-3, 3), 3); S.won = true; setTimeout(() => endGame(true), 1500); }
}

// ---------- 數據碎片（經驗值） ----------
const gemGeo = new THREE.OctahedronGeometry(.32, 0), gemMat = new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x0e7490 });
function dropGem(x, z, v) { const mesh = new THREE.Mesh(gemGeo, gemMat); mesh.position.set(x, .5, z); mesh.scale.setScalar(.8 + v * .25); scene.add(mesh); S.gems.push({ x, z, v, mesh, pull: false }); }
function expNeed() { return 3 + S.level * 3; }
function gainExp(v) {
  S.exp += v;
  if (S.exp >= expNeed()) { S.exp -= expNeed(); S.level++; levelUp(); }
  updateHUD();
}

// ---------- 升級 ----------
const UPGRADES = [
  { id: 'count', ic: '🔥', name: '火球 +1 顆', desc: '一次多發射一顆', ok: () => S.stat.count < 6, fx: () => S.stat.count++ },
  { id: 'dmg', ic: '💥', name: '火力強化', desc: '火球傷害 +25%', ok: () => true, fx: () => S.stat.dmg *= 1.25 },
  { id: 'cd', ic: '⏩', name: '連射', desc: '攻擊速度 +18%', ok: () => S.stat.cd > .25, fx: () => S.stat.cd *= .82 },
  { id: 'spd', ic: '👟', name: '疾風', desc: '移動速度 +12%', ok: () => S.p.speed < 12, fx: () => S.p.speed *= 1.12 },
  { id: 'pick', ic: '🧲', name: '數據吸收', desc: '拾取範圍 +45%', ok: () => S.stat.pickup < 9, fx: () => S.stat.pickup *= 1.45 },
  { id: 'orbit', ic: '🌀', name: '旋轉火焰', desc: () => S.stat.orbit ? '旋轉火焰 +1 團、傷害 +20%' : '身邊環繞會灼傷敵人的火焰', ok: () => S.stat.orbit < 5, fx: () => { S.stat.orbit++; if (S.stat.orbit > 1) S.stat.orbitDmg *= 1.2; rebuildOrbits(); } },
  { id: 'pierce', ic: '🔱', name: '貫穿', desc: '火球可以多穿過 1 隻敵人', ok: () => S.stat.pierce < 4, fx: () => S.stat.pierce++ },
  { id: 'hp', ic: '❤️', name: '堅韌', desc: '最大 HP +25，回復 30%', ok: () => true, fx: () => { S.p.maxhp += 25; heal(S.p.maxhp * .3); } },
  { id: 'armor', ic: '🛡️', name: '硬皮', desc: '受到的傷害 -12%', ok: () => S.stat.armor < 3, fx: () => S.stat.armor++ },
];
function levelUp() {
  SFX.level();
  if (S.level === 5 || S.level === 10) evolve();
  S.paused = true;
  const opts = UPGRADES.filter(u => u.ok()).sort(() => Math.random() - .5).slice(0, 3);
  $('#levelTitle').textContent = `升級！Lv.${S.level}`;
  const box = $('#choices'); box.innerHTML = '';
  opts.forEach((u, i) => {
    const el = document.createElement('div'); el.className = 'choice';
    el.innerHTML = `<div class="ic">${u.ic}</div><div><b>${u.name}</b><small>${typeof u.desc === 'function' ? u.desc() : u.desc}</small><span class="key">按 ${i + 1}</span></div>`;
    el.onclick = () => choose(u);
    box.appendChild(el);
  });
  S.choices = opts;
  $('#levelPanel').classList.remove('hidden');
}
function choose(u) {
  if (!S || !S.paused || !S.choices) return;
  u.fx(); S.choices = null; S.paused = false;
  $('#levelPanel').classList.add('hidden');
  updateHUD();
}
function evolve() {
  S.form = Math.min(2, S.form + 1);
  const F = FORMS[S.form];
  setImg(S.p.bb, F.img, F.h);
  S.p.maxhp = Math.round(S.p.maxhp * 1.4); heal(S.p.maxhp);
  SFX.evolve();
  burst(S.p.x, S.p.z, 50, GLOW.fire);
  // 進化的衝擊波：把附近的敵人震開、造成傷害
  S.enemies.forEach(e => { const dx = e.x - S.p.x, dz = e.z - S.p.z, d = Math.hypot(dx, dz) || 1; if (d < 9) hitEnemy(e, 40 * F.dmgMul, dx / d * 3, dz / d * 3); });
  banner(`✨ 亞古獸 進化——${F.name}！`);
}
function heal(n) { const b = S.p.hp; S.p.hp = Math.min(S.p.maxhp, S.p.hp + n); if (S.p.hp > b) dmgText(S.p.x, 2.5, S.p.z, '+' + Math.round(S.p.hp - b), 'heal'); updateHUD(); }

// ---------- 攻擊 ----------
const shotGeo = new THREE.SphereGeometry(.28, 10, 8);
const shotMat = [new THREE.MeshBasicMaterial({ color: 0xffd27a }), new THREE.MeshBasicMaterial({ color: 0xffb347 }), new THREE.MeshBasicMaterial({ color: 0xb8e1ff })];
function nearestEnemies(n) {
  return S.enemies.filter(e => !e.dead).map(e => ({ e, d: (e.x - S.p.x) ** 2 + (e.z - S.p.z) ** 2 })).filter(o => o.d < 22 * 22).sort((a, b) => a.d - b.d).slice(0, n).map(o => o.e);
}
function fire(dt) {
  S.cdT -= dt;
  if (S.cdT > 0) return;
  const targets = nearestEnemies(S.stat.count);
  if (!targets.length) return;
  S.cdT = S.stat.cd;
  const F = FORMS[S.form];
  for (let i = 0; i < S.stat.count; i++) {
    const tg = targets[i % targets.length];
    let dx = tg.x - S.p.x, dz = tg.z - S.p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const spread = (i - (S.stat.count - 1) / 2) * (targets.length === 1 ? .15 : 0);
    const c = Math.cos(spread), s = Math.sin(spread), vx = dx * c - dz * s, vz = dx * s + dz * c;
    const mesh = new THREE.Mesh(shotGeo, shotMat[S.form]); mesh.scale.setScalar(F.size);
    const glow = glowSprite(S.form === 2 ? GLOW.blue : GLOW.fire, 2.2 * F.size);
    const y = F.h * .45;
    mesh.position.set(S.p.x, y, S.p.z); glow.position.copy(mesh.position);
    scene.add(mesh);
    S.shots.push({ x: S.p.x, z: S.p.z, y, vx: vx * 20, vz: vz * 20, life: 1.4, dmg: S.stat.dmg * F.dmgMul, pierce: S.stat.pierce + (S.form >= 1 ? 1 : 0), hit: new Set(), mesh, glow, r: .5 * F.size });
  }
  if (tgFace(targets[0])) { }
  SFX.shoot();
}
function tgFace(t) { const f = t.x < S.p.x ? -1 : 1; if (f !== S.p.face) { S.p.face = f; S.p.bb.flip = f; setBillboardSize(S.p.bb); } return true; }
function rebuildOrbits() {
  S.orbits.forEach(o => scene.remove(o.glow));
  S.orbits = [];
  for (let i = 0; i < S.stat.orbit; i++) S.orbits.push({ a: i / S.stat.orbit * Math.PI * 2, glow: glowSprite(GLOW.red, 2) });
}

// ---------- 特效 ----------
function burst(x, z, n, tex) {
  for (let i = 0; i < n; i++) { const s = glowSprite(tex, rand(.4, 1)); s.position.set(x, rand(.5, 2), z); S.fx.push({ s, vx: rand(-6, 6), vy: rand(2, 8), vz: rand(-6, 6), life: rand(.3, .7) }); }
}
const v3 = new THREE.Vector3();
function dmgText(x, y, z, txt, cls) {
  v3.set(x, y, z).project(camera);
  if (v3.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = txt;
  d.style.left = (v3.x * .5 + .5) * innerWidth + 'px'; d.style.top = (-v3.y * .5 + .5) * innerHeight + 'px';
  $('#dmgLayer').appendChild(d); setTimeout(() => d.remove(), 600);
}
let bannerT;
function banner(t) { const b = $('#banner'); b.textContent = t; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2200); }

// ---------- HUD ----------
function updateHUD() {
  if (!S) return;
  $('#expBar i').style.width = (S.exp / expNeed() * 100) + '%';
  $('#lvTxt').textContent = `Lv.${S.level}`;
  $('#killTxt').textContent = `💀 ${S.kills}`;
  $('#hpBar i').style.width = (S.p.hp / S.p.maxhp * 100) + '%';
  $('#hpTxt').textContent = `${Math.ceil(S.p.hp)} / ${S.p.maxhp}`;
  $('#formTag').textContent = FORMS[S.form].name + (S.stat.orbit ? '　🌀' + S.stat.orbit : '');
  const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60);
  $('#timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- 輸入：鍵盤＋觸控搖桿 ----------
const KEYMAP = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { keys.add(k); e.preventDefault(); }
  if (S && S.paused && S.choices && /^[1-3]$/.test(k)) choose(S.choices[+k - 1]);
  if (k === 'm' && !e.repeat) setMute(!MUTED);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const JOY = { id: null, x: 0, y: 0, dx: 0, dz: 0 };
const joyEl = $('#joy'), joyKnob = $('#joy i');
function joyHome() { if (JOY.id !== null) return; joyEl.style.left = '82px'; joyEl.style.top = (innerHeight - 120) + 'px'; joyKnob.style.transform = 'translate(-50%,-50%)'; }
joyHome(); addEventListener('resize', joyHome);
const isTouch = matchMedia('(pointer:coarse)').matches;
if (!isTouch) joyEl.classList.add('hidden');
renderer.domElement.addEventListener('pointerdown', e => {
  if (JOY.id !== null) return;
  JOY.id = e.pointerId; JOY.x = e.clientX; JOY.y = e.clientY; JOY.dx = JOY.dz = 0;
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.classList.add('on');
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerId !== JOY.id) return;
  let dx = e.clientX - JOY.x, dy = e.clientY - JOY.y; const d = Math.hypot(dx, dy), R = 52;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  if (d < 10) { JOY.dx = JOY.dz = 0; return; }
  JOY.dx = dx / R; JOY.dz = dy / R;
});
const joyEnd = e => { if (e.pointerId !== JOY.id) return; JOY.id = null; JOY.dx = JOY.dz = 0; joyEl.classList.remove('on'); joyHome(); };
renderer.domElement.addEventListener('pointerup', joyEnd);
renderer.domElement.addEventListener('pointercancel', joyEnd);

// ---------- 主迴圈 ----------
function update(dt) {
  const p = S.p;
  S.t += dt;
  // 移動
  let mx = JOY.dx, mz = JOY.dz;
  for (const k of keys) { mx += KEYMAP[k][0]; mz += KEYMAP[k][1]; }
  const ml = Math.hypot(mx, mz);
  if (ml > 0) {
    const sc = Math.min(1, ml) / ml;
    p.x = clamp(p.x + mx * sc * p.speed * dt, -WORLD, WORLD); p.z = clamp(p.z + mz * sc * p.speed * dt, -WORLD, WORLD);
    if (Math.abs(mx) > .2) { const f = mx < 0 ? -1 : 1; if (f !== p.face) { p.face = f; p.bb.flip = f; setBillboardSize(p.bb); } }
  }
  const bob = ml > 0 ? Math.abs(Math.sin(S.t * 12)) * .18 : 0;
  placeBillboard(p.bb, p.x, p.z); p.bb.sp.position.y = bob;
  p.inv = Math.max(0, p.inv - dt);
  p.bb.sp.material.opacity = p.inv > 0 && Math.floor(S.t * 20) % 2 ? .45 : 1;

  // 生怪、頭目
  if (!S.bossSpawned && S.t >= 120) spawnBoss();
  if (!S.won) spawnWave(dt);

  // 敵人
  const pr = FORMS[S.form].size * .9;
  for (const e of S.enemies) {
    if (e.dead) continue;
    let dx = p.x - e.x, dz = p.z - e.z; const d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d * e.spd + e.kx) * dt; e.z += (dz / d * e.spd + e.kz) * dt;
    e.kx *= Math.pow(.02, dt); e.kz *= Math.pow(.02, dt);
    if (Math.abs(dx) > .3) { const f = dx < 0 ? -1 : 1; if (f !== e.bb.flip) { e.bb.flip = f; setBillboardSize(e.bb); } }
    placeBillboard(e.bb, e.x, e.z);
    e.bb.sp.position.y = Math.abs(Math.sin(S.t * 8 + e.x)) * .12;
    e.flash = Math.max(0, e.flash - dt);
    e.bb.sp.material.color.setRGB(1, e.flash > 0 ? .4 : 1, e.flash > 0 ? .4 : 1);
    // 碰到玩家
    if (d < e.r + pr && p.inv <= 0) {
      const dmg = e.dmg * Math.pow(.88, S.stat.armor);
      p.hp -= dmg; p.inv = .7; SFX.hurt();
      dmgText(p.x, 2.5, p.z, '-' + Math.round(dmg), '');
      const h = $('#hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 120);
      if (p.hp <= 0) { p.hp = 0; updateHUD(); endGame(false); return; }
      updateHUD();
    }
    // 頭目：每隔幾秒朝玩家噴一圈火球
    if (e.boss) {
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = S.t > 150 ? 2.2 : 3.2;
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const g = glowSprite(GLOW.red, 1.6); g.position.set(e.x, 1.2, e.z); S.eShots.push({ x: e.x, z: e.z, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, life: 3, glow: g }); }
      }
    }
  }
  // 敵人互相推開（避免全部疊在一起）
  const E = S.enemies;
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const a = E[i], b = E[j]; if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dz = b.z - a.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > .0001) { const d = Math.sqrt(d2), push = (min - d) * .5 / d; if (!a.boss) { a.x -= dx * push; a.z -= dz * push; } if (!b.boss) { b.x += dx * push; b.z += dz * push; } }
  }
  // 頭目的火球
  for (const s of S.eShots) {
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; s.glow.position.set(s.x, 1.2, s.z);
    if (p.inv <= 0 && Math.hypot(s.x - p.x, s.z - p.z) < pr + .4) { const dmg = 14 * Math.pow(.88, S.stat.armor); p.hp -= dmg; p.inv = .55; s.life = 0; SFX.hurt(); dmgText(p.x, 2.5, p.z, '-' + Math.round(dmg)); if (p.hp <= 0) { p.hp = 0; updateHUD(); endGame(false); return; } updateHUD(); }
  }
  S.eShots = S.eShots.filter(s => { if (s.life <= 0) { scene.remove(s.glow); return false; } return true; });

  // 攻擊
  fire(dt);
  for (const s of S.shots) {
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    s.mesh.position.set(s.x, s.y, s.z); s.glow.position.copy(s.mesh.position);
    for (const e of S.enemies) {
      if (e.dead || s.hit.has(e)) continue;
      if ((e.x - s.x) ** 2 + (e.z - s.z) ** 2 < (e.r + s.r) ** 2) {
        s.hit.add(e); const l = Math.hypot(s.vx, s.vz); hitEnemy(e, s.dmg, s.vx / l, s.vz / l);
        if (s.pierce-- <= 0) { s.life = 0; break; }
      }
    }
  }
  S.shots = S.shots.filter(s => { if (s.life <= 0) { scene.remove(s.mesh, s.glow); return false; } return true; });
  // 旋轉火焰
  S.orbits.forEach((o, i) => {
    o.a += dt * 3; const R = 2.6 + S.form * .6, x = p.x + Math.cos(o.a) * R, z = p.z + Math.sin(o.a) * R;
    o.glow.position.set(x, 1, z);
    for (const e of S.enemies) {
      if (e.dead || (e.hitCd[i] || 0) > S.t) continue;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 < (e.r + .8) ** 2) { e.hitCd[i] = S.t + .5; hitEnemy(e, S.stat.orbitDmg * FORMS[S.form].dmgMul * .6, (e.x - p.x) * .2, (e.z - p.z) * .2); }
    }
  });
  // 清掉倒下的敵人
  S.enemies = S.enemies.filter(e => { if (e.dead) { removeBillboard(e.bb); return false; } return true; });

  // 數據碎片
  for (const g of S.gems) {
    const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
    if (d < S.stat.pickup) g.pull = true;
    if (g.pull) { const sp = 14 * dt; g.x += dx / (d || 1) * Math.min(d, sp); g.z += dz / (d || 1) * Math.min(d, sp); }
    g.mesh.position.set(g.x, .5 + Math.sin(S.t * 4 + g.x) * .12, g.z); g.mesh.rotation.y += dt * 3;
    if (d < .8) { g.got = true; SFX.pickup(); gainExp(g.v); if (S.paused) break; }
  }
  S.gems = S.gems.filter(g => { if (g.got) { scene.remove(g.mesh); return false; } return true; });

  // 粒子
  for (const f of S.fx) { f.life -= dt; f.vy -= 18 * dt; f.s.position.x += f.vx * dt; f.s.position.y = Math.max(.1, f.s.position.y + f.vy * dt); f.s.position.z += f.vz * dt; f.s.material.opacity = Math.max(0, f.life * 2); }
  S.fx = S.fx.filter(f => { if (f.life <= 0) { scene.remove(f.s); return false; } return true; });

  updateHUD();
}

function endGame(win) {
  if (!S.running) return;
  S.running = false;
  $('#endTitle').textContent = win ? '🏆 打倒火焰獸了！' : '全滅了…';
  const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60);
  $('#endStats').innerHTML = `存活時間 <b>${m}:${String(s).padStart(2, '0')}</b>　｜　擊倒 <b>${S.kills}</b> 隻　｜　等級 <b>Lv.${S.level}</b>　｜　最終型態 <b>${FORMS[S.form].name}</b>`;
  setTimeout(() => $('#endPanel').classList.remove('hidden'), win ? 0 : 600);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S && S.running && !S.paused) update(dt);
  // 鏡頭跟著主角（平滑）
  const px = S ? S.p.x : 0, pz = S ? S.p.z : 0;
  camera.position.lerp(v3.set(px + CAM_OFF.x, CAM_OFF.y, pz + CAM_OFF.z), Math.min(1, dt * 6));
  camera.lookAt(px, 1, pz);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- 畫面 ----------
$('#startPics').innerHTML = ['Agumon', 'Greymon', 'Metal_Greymon'].map(k => `<img src="${SPRITES[k]}" alt="">`).join('<span style="align-self:center;font-size:24px">▶</span>');
$('#btnStart').onclick = () => { $('#startPanel').classList.add('hidden'); $('#hud').classList.remove('hidden'); newGame(); banner('撐過頭目來襲吧！'); };
document.querySelectorAll('.muteBtn').forEach(b => b.onclick = e => { e.stopPropagation(); setMute(!MUTED); });
setMute(MUTED);
$('#btnRetry').onclick = () => { $('#endPanel').classList.add('hidden'); newGame(); };
// 開始畫面時也有一隻亞古獸站在中間
newGame(); S.running = false;
