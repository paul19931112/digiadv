'use strict';
/* =========================================================
   探索地圖：3D 版（Three.js）
   地圖一樣是 24×16 的格子，遊戲規則完全沒變，只是改用 3D 畫出來：
   整張地圖是一座浮在天空的小島（或城市），鏡頭跟著隊長，數碼寶貝用圖片看板（永遠面向鏡頭）。
   原本的 #area 畫布疊在最上面，只畫雷達、出口箭頭、轉場閃光。
   不支援 WebGL、或是用 file:// 直接開檔（圖片不能當 3D 貼圖）時，會用原本的平面地圖。
   ========================================================= */
const A3 = { on: null, t: 0 };

function area3DOn() {
  if (A3.on !== null) return A3.on;
  A3.on = false;
  if (!window.THREE || location.protocol === 'file:') return false;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true });
    if (!r.getContext()) return false;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputEncoding = THREE.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;   // 影子：只有柔和風格的章節會用，牆變了才重畫
    r.domElement.className = 'a3Canvas';
    A3.renderer = r;
    A3.camera = new THREE.PerspectiveCamera(45, 1, .1, 300);
    $('#areaScreen').prepend(r.domElement);
    $('#areaScreen').classList.add('a3d');
    A3.on = true;
  } catch (e) { A3.on = false; }
  return A3.on;
}

function a3Layout() {
  const r = A3.renderer, el = r.domElement, w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
  if (A3.w === w && A3.h === h) return;
  A3.w = w; A3.h = h;
  r.setSize(w, h, false);
  A3.camera.aspect = w / h; A3.camera.updateProjectionMatrix();
  cvs.width = w; cvs.height = h;   // 上面那層 2D 畫布：雷達、出口箭頭
  // 直式手機：鏡頭拉高一點，看得比較遠
  A3.off = h > w ? new THREE.Vector3(0, 17, 10.5) : new THREE.Vector3(0, 11, 8);
}

// ---------- 貼圖 ----------
const A3_TEX = new Map();
function a3EmojiTex(e) {
  if (A3_TEX.has('e:' + e)) return A3_TEX.get('e:' + e);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.font = `96px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.userData = { w: 1, h: 1 };
  A3_TEX.set('e:' + e, t); return t;
}
// 數碼寶貝的圖：還沒載入好就先用 emoji，載好了再換
function a3SpTex(key, emoji) {
  const r = loadImg(key);
  if (r.state !== 'ok') return null;
  if (A3_TEX.has(key)) return A3_TEX.get(key);
  const im = r.canvas, t = new THREE.Texture(im);
  t.needsUpdate = true; t.encoding = THREE.sRGBEncoding;
  t.userData = { w: im.width || im.naturalWidth || 1, h: im.height || im.naturalHeight || 1 };
  A3_TEX.set(key, t); return t;
}
// 看板：底部貼在地面上
function a3Board(size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: .05, side: THREE.DoubleSide, depthWrite: true, toneMapped: false }));
  s.center.set(.5, 0); s.userData.size = size;
  return s;
}
function a3SetBoard(s, tex, flip) {
  if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
  const { w, h } = tex.userData, k = s.userData.size / Math.max(w, h);
  s.scale.set(w * k * (flip ? -1 : 1), h * k, 1);
}
function a3BoardSp(s, sp, flip) { a3SetBoard(s, a3SpTex(sp.img, sp.emoji) || a3EmojiTex(sp.emoji), flip); }

const a3Lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra));
const a3Glow = (color, opacity = .5) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function a3Ring(r1, r2, color, op) { const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 24), a3Glow(color, op)); m.rotation.x = -Math.PI / 2; m.position.y = .03; return m; }
function a3Shadow(r = .32) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .02; return m; }

// ---------- 牆（樹、石頭、大樓…）：依章節主題 ----------
const WALL_PARTS = {
  trunk:  () => [new THREE.CylinderGeometry(.08, .12, .6, 5).translate(0, .3, 0), 0x7a4a2a],
  leaf:   th => [new THREE.IcosahedronGeometry(.46, 0).translate(0, .95, 0), th.leaf],
  pineA:  th => [new THREE.ConeGeometry(.44, .75, 6).translate(0, .7, 0), th.leaf],
  pineB:  th => [new THREE.ConeGeometry(.3, .6, 6).translate(0, 1.15, 0), th.leaf],
  rock:   th => [new THREE.DodecahedronGeometry(.42, 0).translate(0, .28, 0), 0x8a8580],
  cactus: th => [new THREE.CylinderGeometry(.12, .14, .95, 6).translate(0, .47, 0), 0x4f8a3a],
  cArm:   th => [new THREE.CylinderGeometry(.07, .07, .4, 6).rotateZ(-.9).translate(.18, .55, 0), 0x4f8a3a],
  block:  () => [new THREE.BoxGeometry(1, 1.15, 1).translate(0, .575, 0), 0xc9a25e],
  bldg:   () => [new THREE.BoxGeometry(.94, 1, .94).translate(0, .5, 0), 0xffffff],
  car:    () => [new THREE.BoxGeometry(.72, .32, .42).translate(0, .22, 0), 0xffffff],
  crate:  () => [new THREE.BoxGeometry(.86, .86, .86).translate(0, .43, 0), 0x8a95a8],
  card:   () => [new THREE.BoxGeometry(.96, 1.3, .1).translate(0, .65, 0), 0xf8fafc],
  carou:  () => [new THREE.ConeGeometry(.5, .7, 8).translate(0, 1.1, 0), 0xffffff],
  carouB: () => [new THREE.CylinderGeometry(.42, .46, .75, 8).translate(0, .38, 0), 0xffffff],
  spike:  () => [new THREE.ConeGeometry(.45, 1.15, 5).translate(0, .57, 0), 0x4a3d55],
};
// ---------- 高畫質（樣品：第一章）：柔和影子、電影感色調、圓滑的模型、高解析地面、光暈 ----------
// 地圖內容完全不變，只改呈現方式
const COZY = {
  grass: { sky: ['#5aa9e6', '#dff2ff'], mist: '#d3ebf6', hemi: [0xfff4e0, 0x6f8f5a, .55], sun: 1.35, exposure: 1.05,
           top: 0x6cc24a, dirt: 0x8a5a35, rock: 0x7a6a5c, puff: [0x3f9e3a, 0x4fae42, 0x358a32, 0x5cb84a] },
};
const cozyMat = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
const puff = (r, x, y, z) => () => [new THREE.SphereGeometry(r, 14, 10).translate(x, y, z), 0xffffff];
Object.assign(WALL_PARTS, {
  cTrunk: () => [new THREE.CylinderGeometry(.07, .1, .55, 8).translate(0, .27, 0), 0x7a4a2a],
  cP1: puff(.42, 0, .95, 0), cP2: puff(.32, .3, .78, .08), cP3: puff(.3, -.27, .76, -.12), cP4: puff(.28, .04, .74, .32), cP5: puff(.25, .08, 1.3, -.06),
  cRock: () => [new THREE.DodecahedronGeometry(.42, 1).scale(1.1, .75, 1).translate(0, .26, 0), 0x8a8580],
});
// 光暈貼圖（發光的東西周圍那一圈）
function a3HaloTex() {
  if (A3_TEX.has('halo')) return A3_TEX.get('halo');
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); A3_TEX.set('halo', t); return t;
}
function a3Halo(color, size, op = .6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: a3HaloTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
}
function wallKind(theme, c) {
  const P = PALETTE[theme] || {};
  if (COZY[theme]) return c === 'R' ? ['cRock'] : ['cTrunk', 'cP1', 'cP2', 'cP3', 'cP4', 'cP5'];
  if (P.park) return c === 'T' ? ['card'] : ['carouB', 'carou'];
  if (P.void) return c === 'T' ? ['dcube'] : ['dshard'];
  if (P.building) return c === 'T' ? ['bldg'] : ['car'];
  if (P.brick) return ['block'];
  if (P.crate) return ['crate'];
  if (P.lava) return ['spike'];
  if (c === 'R') return ['rock'];
  if (P.cactus) return ['cactus', 'cArm'];
  if (theme === 'forest') return ['trunk', 'pineA', 'pineB'];
  return ['trunk', 'leaf'];
}
// 大樓的窗戶貼圖
function a3WindowTex() {
  if (A3_TEX.has('win')) return A3_TEX.get('win');
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#2a2f45'; g.fillRect(0, 0, 32, 64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { g.fillStyle = Math.random() < .55 ? '#fde68a' : '#11131d'; g.fillRect(2 + x * 8, 2 + y * 8, 5, 5); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter;
  A3_TEX.set('win', t); return t;
}

// ---------- 建立整張地圖 ----------
function a3Build(A) {
  if (A3.scene) A3.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.isSprite) o.material.dispose(); });
  const th = ISL_THEME[A.theme] || ISL_THEME.grass, P = PALETTE[A.theme];
  const scene = new THREE.Scene(), dark = ['tokyo', 'pyramid', 'factory', 'park', 'void'].includes(A.theme), cz = COZY[A.theme], sky = cz ? cz.sky : th.sky;
  scene.background = islSky(sky[0], sky[1]);
  scene.fog = new THREE.Fog(new THREE.Color(sky[1]), 26, 70);
  scene.add(cz ? new THREE.HemisphereLight(cz.hemi[0], cz.hemi[1], cz.hemi[2]) : new THREE.HemisphereLight(0xffffff, 0x445066, dark ? .65 : .8));
  const sun = new THREE.DirectionalLight(0xfff2dd, cz ? cz.sun : dark ? .55 : .8); sun.position.set(8, 14, 10); scene.add(sun);
  if (cz) {   // 柔和的影子：整座島一張陰影圖（往右下方落）
    sun.color.set(0xfff0d8); sun.position.set(COLS / 2 - 9, 17, ROWS / 2 - 7); sun.target.position.set(COLS / 2, 0, ROWS / 2); scene.add(sun.target);
    sun.castShadow = true; const sc = sun.shadow.camera, big = Math.min(innerWidth, innerHeight) > 600;
    sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024); sc.left = -17; sc.right = 17; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50; sc.updateProjectionMatrix();
    sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  }
  A3.scene = scene; A3.A = A; A3.dark = dark; A3.cozy = !!cz;
  A3.mist = dark ? [10, 12, 28] : (() => { const c = new THREE.Color(cz ? cz.mist : sky[1]); return [c.r * 255 | 0, c.g * 255 | 0, c.b * 255 | 0]; })();
  A3.renderer.toneMapping = cz ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;   // 電影感色調：亮部不死白
  A3.renderer.toneMappingExposure = cz ? cz.exposure : 1;

  // 地面：用原本的地圖圖塊畫成一張貼圖，迷霧直接畫在上面
  const K = cz ? 2 : 1, base = document.createElement('canvas'); base.width = COLS * TS * K; base.height = ROWS * TS * K;
  const g = base.getContext('2d'); g.scale(K, K);
  const flat = c => SOLID.has(c) && c !== '~' ? '.' : c;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(x, y, cz && (A.T[y][x] === ',' || A.T[y][x] === '~') ? '.' : flat(A.T[y][x]), 0, P, g);
  if (cz) for (const ch of [',', '~']) {   // 高畫質：草叢、水的邊緣畫成圓滑的形狀（位置跟原本一樣）
    const clip = new Path2D(), is = (x, y) => (A.T[y] || [])[x] === ch, r = TS * .62;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (is(x, y)) {
      const cx = (x + .5) * TS, cy = (y + .5) * TS; clip.moveTo(cx + r, cy); clip.arc(cx, cy, r, 0, Math.PI * 2);
      if (is(x + 1, y)) clip.rect(cx, cy - r, TS, r * 2);
      if (is(x, y + 1)) clip.rect(cx - r, cy, r * 2, TS);
      if (is(x + 1, y) && is(x, y + 1) && is(x + 1, y + 1)) clip.rect(cx, cy, TS, TS);
    }
    g.save(); g.clip(clip);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (is(x, y) || is(x + 1, y) || is(x - 1, y) || is(x, y + 1) || is(x, y - 1)) drawTile(x, y, ch, 0, P, g);
    g.restore();
  }
  if (cz) {   // 高畫質：地面加上大片柔和的明暗，不會看起來像一格一格
    const r0 = islRng(A.nd.f * 97 + A.nd.i * 13 + 3);
    for (let k = 0; k < 50; k++) { const x = r0() * COLS * TS, y = r0() * ROWS * TS, r = TS * (1 + r0() * 2.5), gr = g.createRadialGradient(x, y, 0, x, y, r), lt = r0() < .5;
      gr.addColorStop(0, lt ? 'rgba(255,250,220,.16)' : 'rgba(20,40,10,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const out = document.createElement('canvas'); out.width = base.width; out.height = base.height;
  const tex = new THREE.CanvasTexture(out); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(COLS / 2, 0, ROWS / 2); ground.receiveShadow = !!cz; scene.add(ground);
  A3.ground = { base, out, tex, fog: Object.assign(document.createElement('canvas'), { width: COLS, height: ROWS }) };
  A3.fogKey = '';

  // 島的底部：厚土層 + 倒過來的大岩錐 + 掛著的小石頭
  const rng = islRng(A.nd.f * 131 + A.nd.i * 17 + 5);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(COLS + .4, 1, ROWS + .4), a3Lam(cz ? cz.top : th.top)); slab.position.set(COLS / 2, -.505, ROWS / 2); scene.add(slab);
  const under = new THREE.Mesh(islJitter(new THREE.ConeGeometry(COLS * .5, 12, 10, 3), rng, .8), a3Lam(cz ? cz.dirt : th.dirt));
  under.rotation.x = Math.PI; under.scale.z = ROWS / COLS * 1.1; under.position.set(COLS / 2, -7, ROWS / 2); scene.add(under);
  for (let k = 0; k < 8; k++) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.5 + rng() * .9, 0), a3Lam(cz ? cz.rock : th.rock));
    st.position.set(COLS / 2 + (rng() - .5) * COLS * 1.1, -3 - rng() * 9, ROWS / 2 + (rng() - .5) * ROWS * 1.1); scene.add(st);
  }
  const cloudMat = new THREE.MeshLambertMaterial({ color: th.cloud || 0xffffff, transparent: true, opacity: dark ? .35 : .85, flatShading: true });
  A3.clouds = [];
  for (let k = 0; k < 14; k++) {
    const c = new THREE.Group();
    for (let m = 0; m < 4; m++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rng() * 1.3, 0), cloudMat); b.position.set(m * 1.4 - 2, rng() * .6, rng() - .5); c.add(b); }
    c.position.set(COLS / 2 + (rng() - .5) * 70, -6 - rng() * 10, ROWS / 2 + (rng() - .5) * 60);
    scene.add(c); A3.clouds.push(c);
  }

  // 牆：同一種零件用 InstancedMesh 一次畫完
  const parts = {};
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = A.T[y][x];
    if (!SOLID.has(c) || c === '~') continue;
    const h = hash(x, y), s = .85 + (h % 7) * .05;
    const wallAt = (dx, dy) => { const c2 = (A.T[y + dy] || [])[x + dx]; return c2 && SOLID.has(c2) && c2 !== '~'; };
    const rot = PALETTE[A.theme].park ? (wallAt(-1, 0) || wallAt(1, 0) ? 0 : Math.PI / 2) : (h % 13) / 13 * Math.PI * 2;   // 撲克牌：沿著牆排
    for (const k of wallKind(A.theme, c)) {
      (parts[k] = parts[k] || []).push({ i: y * COLS + x, x, y, s, rot, h });
    }
  }
  A3.walls = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const k in parts) {
    const [geo, col] = WALL_PARTS[k](th), list = parts[k];
    const mat = k === 'bldg' ? new THREE.MeshLambertMaterial({ map: a3WindowTex(), emissive: 0x332a10 }) : cz ? cozyMat(0xffffff) : a3Lam(0xffffff);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.castShadow = !!cz;
    list.forEach((it, n) => {
      const hy = k === 'bldg' ? 1 + (it.h % 5) * .3 : k === 'block' ? 1 : it.s;
      const flatRot = ['block', 'crate', 'bldg'].includes(k) ? 0 : it.rot, card = k === 'card';
      it.m = m4.compose(v.set(it.x + .5 + (it.ox || 0), 0, it.y + .5 + (it.oz || 0)), q.setFromAxisAngle(up, flatRot), sc.set(k === 'block' || k === 'bldg' || card ? 1 : it.s, card ? 1 : hy, k === 'block' || k === 'bldg' || card ? 1 : it.s)).clone();
      const cc = cz && k.startsWith('cP') ? cz.puff[(it.h + +k[2]) % cz.puff.length] : k === 'car' ? [0xb91c1c, 0x1d4ed8, 0xe5e7eb, 0x15803d][it.h % 4] : k === 'carou' || k === 'carouB' ? [0xf472b6, 0xfacc15, 0x60a5fa][it.h % 3] : k === 'card' && it.h % 2 ? 0xfde2e2 : col;
      it.c = new THREE.Color(cc).multiplyScalar(cz ? .96 + (it.h % 3) * .03 : .9 + (it.h % 5) * .04);
      mesh.setMatrixAt(n, it.m); mesh.setColorAt(n, it.c);
    });
    scene.add(mesh);
    A3.walls.push({ mesh, list });
  }

  // 出口：旋轉的光環 + 光柱
  const ex = new THREE.Group(); ex.position.set(A.exit.x + .5, 0, A.exit.y + .5);
  A3.exRings = [0x60a5fa, 0xa78bfa, 0xf0abfc].map((c, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(.42 - i * .1, .04, 6, 24, Math.PI * 1.4), a3Glow(c, .9)); r.rotation.x = -Math.PI / 2; r.position.y = .1 + i * .08; ex.add(r); return r; });
  A3.beam = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, 14, 14, 1, true), a3Glow(0x93c5fd, .35)); A3.beam.position.y = 7; ex.add(A3.beam);
  if (cz) { A3.exHalo = a3Halo(0x93c5fd, 3.2, .55); A3.exHalo.position.y = .6; ex.add(A3.exHalo); } else A3.exHalo = null;
  A3.lock = a3Board(.55); A3.lock.position.y = .6; a3SetBoard(A3.lock, a3EmojiTex('🔒')); ex.add(A3.lock);
  scene.add(ex);

  // 主角
  A3.hero = new THREE.Group(); A3.heroBoard = a3Board(1.15); A3.hero.add(a3Shadow(), A3.heroBoard); scene.add(A3.hero);
  A3.tap = a3Ring(.25, .4, 0xfde047, .9); scene.add(A3.tap);
  A3.seal = null;
  A3.objs = new Map();
  A3.cam = null;
}

// ---------- 地圖上的物件 ----------
function a3MakeObj(o) {
  const g = new THREE.Group(), add = m => { g.add(m); return m; };
  const d = { g, kind: o.kind };
  const sp = o.sp && SPECIES[o.sp];
  if (o.kind === 'enemy' || o.kind === 'npc' || o.kind === 'shop' || o.kind === 'band') {
    const big = o.role === 'boss' ? 1.75 : o.role === 'elite' ? 1.4 : 1.15;
    add(a3Shadow(.3 * big));
    if (o.role === 'elite' || o.role === 'boss') d.aura = add(a3Ring(.35 * big, .5 * big, o.role === 'boss' ? 0xdc003c : 0x8c00c8, .6));
    if (o.kind !== 'enemy') d.aura = add(a3Ring(.36, .5, o.kind === 'band' ? 0xfde047 : 0xffffff, .4));
    d.board = add(a3Board(big)); d.sp = sp;
    if (o.kind === 'enemy' && RUN.chapter === 10 && o.role !== 'boss') d.board.material.color.set(0xa07aff);   // 最終章：殘影
    const tag = o.kind === 'shop' ? '🛒' : o.kind === 'npc' ? '💬' : o.kind === 'band' ? '🎵' : o.role === 'guard' ? '❗' : null;
    if (tag) { d.tag = add(a3Board(.4)); a3SetBoard(d.tag, a3EmojiTex(tag)); d.tag.position.set(.35, big + .05, 0); }
  } else if (o.kind === 'chest') {
    add(a3Shadow(.34));
    add(new THREE.Mesh(new THREE.BoxGeometry(.55, .32, .38).translate(0, .16, 0), a3Lam(o.rich ? 0x3a5aa8 : 0x9a5a2a)));
    add(new THREE.Mesh(new THREE.BoxGeometry(.58, .1, .41).translate(0, .36, 0), a3Lam(0xffcc33, { emissive: 0x332200 })));
    if (o.rich) { d.spin = add(new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), a3Lam(0x7dd3fc, { emissive: 0x1a4a6a }))); d.spin.position.y = .65; }
  } else if (o.kind === 'spring') {
    add(new THREE.Mesh(new THREE.TorusGeometry(.38, .09, 5, 14).rotateX(Math.PI / 2).translate(0, .06, 0), a3Lam(0xc8c0b0)));
    d.aura = add(new THREE.Mesh(new THREE.CircleGeometry(.36, 16).rotateX(-Math.PI / 2).translate(0, .07, 0), a3Glow(0xf472b6, .8)));
    d.tag = add(a3Board(.45)); a3SetBoard(d.tag, a3EmojiTex('💗')); d.tag.position.y = .35;
  } else if (o.kind === 'egg') {
    add(a3Shadow(.25));
    d.wob = add(new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8).scale(1, 1.3, 1).translate(0, .29, 0), a3Lam(o.star ? 0xfff2a8 : 0xfff4dc, o.star ? { emissive: 0x5a4a00 } : {})));
    if (o.star) d.aura = add(a3Ring(.3, .45, 0xfde047, .7));
  } else if (o.kind === 'pickup') {
    d.aura = add(a3Ring(.15, .32, 0x22d3ee, .5));
    d.spin = add(new THREE.Mesh(new THREE.OctahedronGeometry(.17, 0), a3Lam(0x22d3ee, { emissive: 0x0e7490 }))); d.spin.position.y = .4;
    if (A3.cozy) { const h = add(a3Halo(0x22d3ee, 1.1, .5)); h.position.y = .4; }
  } else {   // 其他：用 emoji 看板
    const e = o.mem ? '💠' : { stone: '🗿', tp: '🌀', hack: '💻', trial: '🌟', clue: '🔎', crest: '✨', trap: '⚠️' }[o.kind] || '❓';
    const col = o.mem ? 0xa855f7 : { stone: 0xfde047, tp: 0x22d3ee, hack: 0x4ade80, trial: 0xfde047, clue: 0xf472b6, trap: 0xf87171 }[o.kind];
    if (col) d.aura = add(a3Ring(.3, .48, col, .55));
    d.tag = add(a3Board(o.kind === 'stone' || o.kind === 'hack' ? .8 : .6)); a3SetBoard(d.tag, a3EmojiTex(e)); d.tag.position.y = .05;
  }
  g.position.set(o.x + .5, 0, o.y + .5);
  if (A3.cozy) { g.traverse(m => { if (m.isMesh && !m.material.transparent) m.castShadow = true; }); A3.renderer.shadowMap.needsUpdate = true; }
  A3.scene.add(g);
  return d;
}

// ---------- 迷霧：地面貼圖 + 牆的明暗 ----------
function a3Fog(A, rx, ry, R, vis) {
  const key = `${rx.toFixed(2)},${ry.toFixed(2)},${R},${A.scanned ? 1 : 0}`;
  if (A3.fogKey === key && !A._fogDirty) return;
  A3.fogKey = key; A._fogDirty = false;
  const G0 = A3.ground, fg = G0.fog.getContext('2d'), [mr, mg, mb] = A3.mist, light = new Float32Array(COLS * ROWS);
  fg.clearRect(0, 0, COLS, ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x, d = Math.hypot(x - rx, y - ry), seen = A.seen[i];
    const base = vis ? (A.scanned ? .6 : 1) : seen ? .5 : .93;
    const a = vis && !vis.has(i) ? (A.scanned ? .6 : 1) : d <= R - 1.2 ? 0 : d <= R ? base * (d - (R - 1.2)) / 1.2 : base;
    const hidden = vis ? !vis.has(i) && !A.scanned : !seen;
    light[i] = hidden ? -1 : 1 - a * .65;
    if (a > 0) { fg.fillStyle = hidden ? `rgba(${mr},${mg},${mb},${a})` : `rgba(8,10,26,${a * .85})`; fg.fillRect(x, y, 1, 1); }
  }
  const og = G0.out.getContext('2d');
  og.drawImage(G0.base, 0, 0);
  og.imageSmoothingEnabled = true; og.drawImage(G0.fog, 0, 0, G0.out.width, G0.out.height);
  G0.tex.needsUpdate = true;
  // 牆：沒看過的藏起來（像被雲遮住），看過但不在視野內的變暗
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color();
  A3.walls.forEach(w => {
    w.list.forEach((it, n) => {
      const L = light[it.i];
      w.mesh.setMatrixAt(n, L < 0 ? zero : it.m);
      if (L >= 0) w.mesh.setColorAt(n, c.copy(it.c).multiplyScalar(L));
    });
    w.mesh.instanceMatrix.needsUpdate = true; if (w.mesh.instanceColor) w.mesh.instanceColor.needsUpdate = true;
  });
  A3.renderer.shadowMap.needsUpdate = true;
}

// ---------- 每一格畫面 ----------
function drawArea3D(t) {
  const A = AREA;
  a3Layout();
  if (A3.A !== A) a3Build(A);
  const m = A.mv;
  let rx = A.x, ry = A.y;
  if (m.moving) { rx = m.fromX + (m.toX - m.fromX) * m.t; ry = m.fromY + (m.toY - m.fromY) * m.t; }
  const R = sightR(), inSight = (x, y) => Math.hypot(x - rx, y - ry) <= R;
  const vis = A.theme === 'pyramid' ? losVis(A, Math.round(rx), Math.round(ry), R) : null;
  a3Fog(A, rx, ry, R, vis);

  // 物件（看得到的規則跟平面版一樣）
  for (const o of A.objs) {
    let d = A3.objs.get(o);
    let show = !o.done;
    if (show) show = o.kind === 'enemy' || (o.kind === 'pickup' && !o.show) ? inSight(o.x, o.y) || (o.kind === 'pickup' && A.scanned) : !!A.seen[o.y * COLS + o.x];
    if (show && vis && !vis.has(o.y * COLS + o.x) && !(o.kind === 'pickup' && A.scanned)) show = false;
    if (show && o.kind === 'crest') show = Math.hypot(o.x - A.x, o.y - A.y) <= 1.6;
    if (show && o.kind === 'trap') show = !!A.scanned;
    if (!show) { if (d) d.g.visible = false; continue; }
    if (!d) { d = a3MakeObj(o); A3.objs.set(o, d); }
    d.g.visible = true;
    d.g.position.set(o.x + .5, 0, o.y + .5);   // 敵人會走動
    if (d.board) { a3BoardSp(d.board, d.sp, false); d.board.position.y = o.kind === 'band' ? Math.abs(Math.sin(t * 6)) * .12 : Math.sin(t * 3 + o.x) * .04; }
    if (d.aura) d.aura.material.opacity = .4 + Math.sin(t * 4) * .2;
    if (d.spin) { d.spin.rotation.y = t * 2; d.spin.position.y = (o.kind === 'pickup' ? .4 : .65) + Math.sin(t * 2.5 + o.x) * .06; }
    if (d.wob) d.wob.rotation.z = Math.sin(t * 8) * .08;
    if (d.tag && d.board) d.tag.position.y = d.board.position.y + d.board.scale.y + .05;
    else if (d.tag) d.tag.position.y = .05 + Math.sin(t * 3 + o.x) * .05;
  }

  // 出口
  const locked = exitLocked();
  A3.exRings.forEach((r, i) => { r.rotation.z = t * (locked ? .5 : 2) * (i % 2 ? -1 : 1); r.material.color.set(locked ? 0x777777 : [0x60a5fa, 0xa78bfa, 0xf0abfc][i]); });
  A3.beam.material.opacity = locked ? .25 : .3 + Math.sin(t * 3) * .1;
  A3.beam.material.color.set(locked ? 0xa0a0aa : 0x93c5fd);
  if (A3.exHalo) { A3.exHalo.material.opacity = locked ? .15 : .45 + Math.sin(t * 3) * .12; A3.exHalo.material.color.set(locked ? 0x888888 : 0x93c5fd); }
  A3.lock.visible = locked;

  // 陷阱房的光牆
  if (A.seal && !A3.seal) {
    const s = A.seal, w = s.r * 2 + 1, box = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, w), a3Glow(0xc084fc, .3));
    box.position.set(s.x + .5, .7, s.y + .5); A3.scene.add(box); A3.seal = box;
  } else if (!A.seal && A3.seal) { A3.scene.remove(A3.seal); A3.seal = null; }
  if (A3.seal) A3.seal.material.opacity = .22 + Math.sin(t * 6) * .1;

  // 點擊的目標
  A3.tap.visible = !!(A.tapMark && A.path && A.path.length);
  if (A3.tap.visible) { const k = ((performance.now() - A.tapMark.t) / 1000) % 1; A3.tap.position.set(A.tapMark.x + .5, .04, A.tapMark.y + .5); A3.tap.scale.setScalar(1 + k); A3.tap.material.opacity = .9 - k * .6; }

  // 主角
  const lead = SPECIES[RUN.team[0].sp], hop = m.moving ? Math.abs(Math.sin(m.t * Math.PI)) * .18 : Math.sin(t * 3) * .03;
  a3BoardSp(A3.heroBoard, lead, A.facing > 0);
  A3.heroBoard.position.y = hop;
  A3.hero.position.set(rx + .5, 0, ry + .5);

  A3.clouds.forEach((c, k) => { c.position.x += .01 * (k % 2 ? 1 : -1); if (c.position.x > COLS / 2 + 40) c.position.x -= 80; if (c.position.x < COLS / 2 - 40) c.position.x += 80; });

  // 鏡頭跟著主角
  const cam = A3.camera, tgt = new THREE.Vector3(rx + .5, 0, ry + .5);
  if (!A3.cam) A3.cam = tgt.clone();
  A3.cam.lerp(tgt, A3.cam.distanceTo(tgt) > 6 ? 1 : .12);   // 傳送：直接跳過去
  cam.position.copy(A3.cam).add(A3.off);
  cam.lookAt(A3.cam.x, .3, A3.cam.z - .4);
  A3.renderer.render(A3.scene, cam);

  // 上面那層 2D：雷達、出口在畫面外的箭頭、轉場閃光
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  drawCrestRadar(A, rx, ry, t);
  const ep = new THREE.Vector3(A.exit.x + .5, .5, A.exit.y + .5).project(cam);
  if (ep.z < 1 && (Math.abs(ep.x) > .95 || Math.abs(ep.y) > .95)) {
    const ang = Math.atan2(-ep.y, ep.x), cx = cvs.width / 2, cy = cvs.height / 2;
    const k = Math.min((cvs.width / 2 - 34) / Math.abs(Math.cos(ang) || 1e-6), (cvs.height / 2 - 34) / Math.abs(Math.sin(ang) || 1e-6));
    const ax = cx + Math.cos(ang) * k, ay = cy + Math.sin(ang) * k, pulse = Math.sin(t * 5) * 3;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = locked ? 'rgba(160,160,170,.9)' : 'rgba(147,197,253,.95)';
    ctx.beginPath(); ctx.moveTo(14 + pulse, 0); ctx.lineTo(-4 + pulse, -12); ctx.lineTo(-4 + pulse, 12); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('出口', ax - Math.cos(ang) * 26, ay - Math.sin(ang) * 26);
  }
  if (G.mode === 'transition') {
    ctx.fillStyle = Math.floor(G.trans.t * 12) % 2 ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
  }
}

// 點畫面 → 地圖上的哪一格
function a3TileAt(ev) {
  if (!A3.scene) return null;
  const r = cvs.getBoundingClientRect();
  const p = new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(p, A3.camera);
  const hit = rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  return hit ? { x: Math.floor(hit.x), y: Math.floor(hit.z) } : null;
}
