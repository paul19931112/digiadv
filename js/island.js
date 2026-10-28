'use strict';
/* =========================================================
   路線圖：3D 浮空小島（Three.js）
   每個節點是一座浮在天空的小島，用木板吊橋連起來。
   節點圖示用 HTML 疊在小島上方（清楚、可以點，也不會有 file:// 圖片的限制）。
   瀏覽器不支援 WebGL 時，showRoute 會改用原本的平面路線圖。
   ========================================================= */
const ISL_THEME = {
  grass:    { top: 0x6cc24a, dirt: 0x8a5a35, rock: 0x6b4a2e, sky: ['#5fb4ff', '#cfeeff'], deco: 'tree',   leaf: 0x3f9e3a },
  metal:    { top: 0x9aa7b8, dirt: 0x5a6070, rock: 0x3f4452, sky: ['#5a6f96', '#c4d0e4'], deco: 'metal',  leaf: 0x7e8aa0 },
  forest:   { top: 0x3f8a4a, dirt: 0x5b3f2a, rock: 0x3b2c20, sky: ['#3d6e74', '#b6d6cf'], deco: 'pine',   leaf: 0x24633a },
  mountain: { top: 0x8fae6a, dirt: 0x7a6a5a, rock: 0x5c5048, sky: ['#6a5fa8', '#f0c8b8'], deco: 'rock',   leaf: 0x5f8a45 },
  desert:   { top: 0xe8c47a, dirt: 0xc08a4a, rock: 0x9a6a3a, sky: ['#f29a4a', '#ffe2a8'], deco: 'cactus', leaf: 0x5aa04a },
  pyramid:  { top: 0xd9b56a, dirt: 0xa77a42, rock: 0x7d5a33, sky: ['#c2553a', '#ffc58a'], deco: 'pyra',   leaf: 0xc9a25a },
  tokyo:    { top: 0x6b7080, dirt: 0x4a4550, rock: 0x35313c, sky: ['#141a40', '#4a4f8a'], deco: 'city',   leaf: 0xffd36a },
  spiral:   { top: 0x5cc28a, dirt: 0x5e7a8a, rock: 0x405868, sky: ['#2f86c8', '#bfe8ff'], deco: 'palm',   leaf: 0x2fa06a },
  factory:  { top: 0x8a7a70, dirt: 0x5a4038, rock: 0x3a2a26, sky: ['#5a2a2a', '#c27a5a'], deco: 'gear',   leaf: 0xb0603a },
  park:     { top: 0xc27ad0, dirt: 0x6a4a8a, rock: 0x4a3466, sky: ['#3a1f5e', '#e08ac0'], deco: 'park',   leaf: 0xffd23a },
};
const ISL_SZ = 7, ISL_XW = 13;   // 每一層的前後距離、左右寬度
let ISL = null;

// 固定亂數：同一張路線圖每次畫出來都長一樣
function islRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function islInit(box) {
  if (ISL) return ISL;
  if (!window.THREE) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
  ISL = { renderer, camera, focus: 0, target: 0, t: 0, raf: 0, islands: [], bridges: [], overlay: [], clouds: [] };
  renderer.domElement.className = 'islCanvas';
  // 拖曳上下：看整條路線；點小島：前往
  const cv = renderer.domElement;
  let drag = null;
  const down = e => { drag = { y: e.clientY, x: e.clientX, f: ISL.target, moved: 0 }; };
  const move = e => {
    if (!drag) return;
    const dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dy) + Math.abs(e.clientX - drag.x));
    ISL.target = islClampFocus(drag.f - dy * .045);   // 手指往下拉 → 看更遠（上面）的小島
  };
  const up = e => {
    if (drag && drag.moved < 8 && e.target === cv) islPick(e);
    drag = null;
  };
  cv.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); ISL.target = islClampFocus(ISL.target + e.deltaY * .02); }, { passive: false });
  cv.addEventListener('pointermove', e => { if (!drag) islHover(e); });
  window.addEventListener('resize', () => { if (ISL.scene) islResize(); });
  return ISL;
}

function islClampFocus(z) { return clamp(z, -(ISL.floors - 1) * ISL_SZ, ISL_SZ * .6); }

function islResize() {
  const box = ISL.box, w = box.clientWidth || 600, h = box.clientHeight || 500;
  ISL.renderer.setSize(w, h, false);
  ISL.renderer.domElement.style.width = w + 'px'; ISL.renderer.domElement.style.height = h + 'px';
  ISL.camera.aspect = w / h; ISL.camera.updateProjectionMatrix();
  // 直式手機畫面比較窄：鏡頭拉遠一點，讓整排小島都看得到
  const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(ISL.camera.fov / 2)) * ISL.camera.aspect);
  ISL.dist = clamp((ISL_XW * .62) / Math.tan(hf), 15, 42);
  ISL.w = w; ISL.h = h;
}

function islSky(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

const islMat = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra));

// 讓幾何的頂點稍微不規則，看起來比較像手捏的小島
function islJitter(geo, rng, amt, keepTopY) {
  const p = geo.attributes.position, seen = new Map();
  for (let k = 0; k < p.count; k++) {
    const key = `${p.getX(k).toFixed(3)},${p.getY(k).toFixed(3)},${p.getZ(k).toFixed(3)}`;
    let d = seen.get(key);
    if (!d) { d = [(rng() - .5) * amt, (rng() - .5) * amt, (rng() - .5) * amt]; seen.set(key, d); }
    const top = keepTopY != null && p.getY(k) >= keepTopY;
    p.setXYZ(k, p.getX(k) + d[0], p.getY(k) + (top ? 0 : d[1]), p.getZ(k) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// 小島上的裝飾（依章節主題）
function islDeco(kind, th, rng) {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, islMat(color)); m.position.set(x, y, z); g.add(m); return m; };
  const s = .75 + rng() * .5;
  if (kind === 'tree' || kind === 'palm') {
    add(new THREE.CylinderGeometry(.06, .09, .5, 5), 0x7a4a2a, 0, .25, 0);
    if (kind === 'palm') for (let k = 0; k < 5; k++) { const l = add(new THREE.ConeGeometry(.12, .7, 4), th.leaf, 0, .55, 0); l.rotation.z = Math.PI / 2.4; l.rotation.y = k * 1.26; l.position.x = Math.cos(k * 1.26) * .2; l.position.z = -Math.sin(k * 1.26) * .2; }
    else add(new THREE.IcosahedronGeometry(.34, 0), th.leaf, 0, .7, 0);
  } else if (kind === 'pine') {
    add(new THREE.CylinderGeometry(.05, .07, .3, 5), 0x5a3a22, 0, .15, 0);
    add(new THREE.ConeGeometry(.32, .55, 6), th.leaf, 0, .5, 0);
    add(new THREE.ConeGeometry(.24, .45, 6), th.leaf, 0, .8, 0);
  } else if (kind === 'rock') {
    add(new THREE.DodecahedronGeometry(.28, 0), th.rock, 0, .18, 0);
    add(new THREE.DodecahedronGeometry(.16, 0), 0x8a7a6a, .25, .1, .1);
  } else if (kind === 'cactus') {
    add(new THREE.CylinderGeometry(.08, .09, .6, 6), th.leaf, 0, .3, 0);
    add(new THREE.CylinderGeometry(.05, .05, .25, 6), th.leaf, .13, .38, 0).rotation.z = -1;
  } else if (kind === 'pyra') {
    add(new THREE.ConeGeometry(.42, .5, 4), 0xe0bf74, 0, .25, 0).rotation.y = Math.PI / 4;
  } else if (kind === 'city') {
    const h = .4 + rng() * .7;
    add(new THREE.BoxGeometry(.32, h, .32), 0x8088a0, 0, h / 2, 0);
    add(new THREE.BoxGeometry(.34, .04, .34), th.leaf, 0, h * .7, 0);   // 窗戶的燈
  } else if (kind === 'metal') {
    add(new THREE.BoxGeometry(.3, .3, .3), 0x8a95a8, 0, .15, 0);
    add(new THREE.CylinderGeometry(.06, .06, .6, 6), 0x5a6478, .2, .3, 0);
  } else if (kind === 'gear') {
    const r = add(new THREE.TorusGeometry(.22, .07, 4, 8), 0x9a8a7a, 0, .3, 0); r.rotation.x = Math.PI / 2 * rng();
    add(new THREE.CylinderGeometry(.05, .05, .5, 5), 0x6a4030, .22, .25, 0);
  } else if (kind === 'void') {   // 最終章：浮著的數據方塊、結晶
    add(new THREE.BoxGeometry(.3, .3, .3), 0x6d28d9, 0, .3 + rng() * .3, 0).rotation.set(rng() * 3, rng() * 3, 0);
    add(new THREE.OctahedronGeometry(.16, 0), th.leaf, .22, .2, .05).scale.y = 1.6;
  } else if (kind === 'park') {
    add(new THREE.CylinderGeometry(.015, .015, .7, 3), 0xeeeeee, 0, .35, 0);
    add(new THREE.SphereGeometry(.16, 8, 6), [0xff5a7a, 0x5ad0ff, 0xffd23a, 0x8aff7a][Math.floor(rng() * 4)], 0, .8, 0);
  }
  g.scale.setScalar(s);
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

// 小島中間的「節點道具」：一眼看得出這座島有什麼
function islProp(type, th) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  if (type === 'rest') { add(new THREE.CylinderGeometry(.5, .5, .06, 12), glow(0x7fe3ff), 0, .03, 0); add(new THREE.TorusGeometry(.5, .08, 4, 12), islMat(0xb8b0a0), 0, .05, 0).rotation.x = Math.PI / 2; }
  else if (type === 'egg') { const e = add(new THREE.SphereGeometry(.28, 10, 8), islMat(0xfff4dc), 0, .36, 0); e.scale.y = 1.3; }
  else if (type === 'treasure') { add(new THREE.BoxGeometry(.5, .3, .34), islMat(0x9a5a2a), 0, .15, 0); add(new THREE.BoxGeometry(.52, .08, .36), islMat(0xffcc33), 0, .32, 0); }
  else if (type === 'shop') { add(new THREE.ConeGeometry(.5, .55, 6), islMat(0xff7a5a), 0, .55, 0); add(new THREE.CylinderGeometry(.42, .42, .3, 6), islMat(0xfff0d0), 0, .15, 0); }
  else if (type === 'elite') add(new THREE.OctahedronGeometry(.32, 0), islMat(0xa855f7, { emissive: 0x4a1a7a }), 0, .5, 0);
  else if (type === 'puzzle') { add(new THREE.BoxGeometry(.16, .6, .16), islMat(0xb0a890), -.25, .3, 0); add(new THREE.BoxGeometry(.16, .6, .16), islMat(0xb0a890), .25, .3, 0); add(new THREE.BoxGeometry(.7, .14, .2), islMat(0xb0a890), 0, .66, 0); }
  else if (type === 'hack') { add(new THREE.BoxGeometry(.4, .5, .25), islMat(0x3a4050), 0, .25, 0); add(new THREE.PlaneGeometry(.3, .22), glow(0x33e0ff), 0, .32, .13); }
  else if (type === 'trial') add(new THREE.OctahedronGeometry(.3, 0), islMat(0xffe066, { emissive: 0x7a5a00 }), 0, .55, 0);
  else if (type === 'boss') for (let k = 0; k < 5; k++) { const c = add(new THREE.ConeGeometry(.22, 1 + (k % 2) * .5, 5), islMat(0x5a1020, { emissive: 0x3a0010 }), Math.cos(k * 1.26) * 1.3, .4, Math.sin(k * 1.26) * 1.3); c.rotation.z = Math.cos(k * 1.26) * -.25; c.rotation.x = Math.sin(k * 1.26) * .25; }
  else if (type === 'battle') { const sw = add(new THREE.BoxGeometry(.06, .6, .02), islMat(0xd8dde8), 0, .35, 0); sw.rotation.z = .5; const s2 = add(new THREE.BoxGeometry(.06, .6, .02), islMat(0xd8dde8), 0, .35, 0); s2.rotation.z = -.5; }
  return g;
}

function islBuildIsland(nd, th, rng, big) {
  const r = big ? 2.3 : 1.25 + rng() * .25;
  const grp = new THREE.Group();
  // 上面的草地 + 下面倒過來的岩石
  const top = new THREE.Mesh(islJitter(new THREE.CylinderGeometry(r, r * .93, .32, big ? 11 : 8, 1), rng, .14, .15), islMat(th.top));
  top.position.y = -.16;
  const under = new THREE.Mesh(islJitter(new THREE.ConeGeometry(r * .93, r * (1.5 + rng() * .5), big ? 10 : 7, 2), rng, .3), islMat(big ? 0x4a2030 : th.dirt));
  under.rotation.x = Math.PI; under.position.y = -.32 - r * .8;
  grp.add(top, under);
  // 底下掛著的小石塊
  for (let k = 0; k < 2; k++) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.18 + rng() * .15, 0), islMat(th.rock));
    const a = rng() * Math.PI * 2; st.position.set(Math.cos(a) * r * .7, -1.2 - rng() * r, Math.sin(a) * r * .7);
    grp.add(st);
  }
  if (!big) {   // 邊緣的裝飾
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) { const d = islDeco(th.deco, th, rng), a = rng() * Math.PI * 2, rr = r * (.55 + rng() * .25); d.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); grp.add(d); }
  }
  grp.add(islProp(nd.type, th));
  grp.userData.r = r;
  return grp;
}

function islDispose(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

// 畫出 3D 路線圖；不支援 WebGL 就回傳 false
function showRoute3D(box, floors, ch) {
  const S = islInit(box);
  if (!S) return false;
  if (S.scene) { islDispose(S.scene); }
  cancelAnimationFrame(S.raf);
  S.box = box; S.floors = floors.length;
  const th = ISL_THEME[ch.theme] || ISL_THEME.grass;
  const scene = new THREE.Scene();
  scene.background = islSky(th.sky[0], th.sky[1]);
  scene.fog = new THREE.Fog(new THREE.Color(th.sky[1]), 30, 90);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, .75));
  const sun = new THREE.DirectionalLight(0xfff2dd, .85); sun.position.set(6, 12, 8); scene.add(sun);
  S.scene = scene;
  box.innerHTML = '';
  box.appendChild(S.renderer.domElement);
  const ov = document.createElement('div'); ov.className = 'islOverlay'; box.appendChild(ov);
  islResize();

  // 小島
  const seedBase = String(RUN.chapter).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const posOf = nd => new THREE.Vector3(((nd.i + 1) / (floors[nd.f].length + 1) - .5 + nd.jx) * ISL_XW, 0, -nd.f * ISL_SZ);
  S.islands = []; S.overlay = []; S.pick = [];
  const here = RUN.pos ? `${RUN.pos.f}-${RUN.pos.i}` : null;
  floors.forEach(row => row.forEach(nd => {
    const rng = islRng(seedBase * 997 + nd.f * 131 + nd.i * 17 + 1), key = `${nd.f}-${nd.i}`;
    const big = nd.type === 'boss', grp = islBuildIsland(nd, th, rng, big), p = posOf(nd);
    if (big) p.x = 0;
    p.y = (rng() - .5) * 1.4;
    grp.position.copy(p);
    const can = reachable(nd.f, nd.i), done = RUN.visited.includes(key);
    if (done && key !== here) grp.traverse(o => { if (o.material && o.material.color) o.material.color.multiplyScalar(.55); });
    if (can) {   // 可以前往：島下面有發光的光環
      const ring = new THREE.Mesh(new THREE.RingGeometry(grp.userData.r * 1.05, grp.userData.r * 1.35, 24), new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -.12; grp.add(ring); grp.userData.ring = ring;
    }
    grp.traverse(o => { if (o.isMesh) { o.userData.nd = nd; S.pick.push(o); } });
    scene.add(grp);
    const isl = { nd, grp, base: p.y, phase: rng() * 6.28, can, key };
    S.islands.push(isl);
    // HTML 圖示
    const info = NODE_INFO[nd.type], el = document.createElement('button');
    el.className = `rnode isl ${nd.type}${can ? ' can' : ''}${done ? ' done' : ''}${key === here ? ' here' : ''}`;
    el.innerHTML = big ? spPic(ch.boss.id, 's64') : `<span>${info.icon}</span>`;
    el.title = info.name;
    if (can) el.onclick = () => enterNode(nd);
    ov.appendChild(el);
    S.overlay.push({ el, isl, dy: big ? 2.6 : 1.5 });
  }));
  // 起點的小島（還沒出發時，隊長站在這裡）
  let start = null;
  if (!RUN.pos) {
    const rng = islRng(seedBase + 5), grp = islBuildIsland({ type: 'start' }, th, rng, false);
    grp.position.set(0, -.3, ISL_SZ); scene.add(grp);
    start = { nd: null, grp, base: -.3, phase: 1, can: false, key: 'start' };
    S.islands.push(start);
  }
  const hereIsl = start || S.islands.find(x => x.key === here);
  if (hereIsl && RUN.team && RUN.team[0]) {   // 隊長的頭像
    const el = document.createElement('div'); el.className = 'islHero';
    el.innerHTML = spPic(RUN.team[0].sp, 's44');
    ov.appendChild(el);
    S.overlay.push({ el, isl: hereIsl, dy: hereIsl === start ? 1.3 : 2.9, hero: true });
  }

  // 吊橋：走過的金色、可以走的亮色、其他的暗色
  const idx = new Map(S.islands.filter(x => x.nd).map(x => [x.key, x]));
  const cats = [[], [], []];
  floors.forEach(row => row.forEach(nd => nd.next.forEach(j => {
    const a = idx.get(`${nd.f}-${nd.i}`), b = idx.get(`${nd.f + 1}-${j}`);
    const lit = RUN.visited.includes(a.key) && (RUN.visited.includes(b.key) || a.key === here);
    const open = a.key === here && b.can;
    cats[lit && !open ? 0 : open ? 1 : 2].push([a, b]);
  })));
  if (start) S.islands.filter(x => x.can).forEach(b => cats[1].push([start, b]));
  S.bridges = [];
  const plank = new THREE.BoxGeometry(.6, .07, .2);
  [[0xffcc33, 0x6a4a10], [0xfff3c0, 0x8a7a30], [0x8a6a4a, 0x000000]].forEach(([c, em], ci) => {
    const list = cats[ci];
    if (!list.length) return;
    const per = 14, mesh = new THREE.InstancedMesh(plank, islMat(c, { emissive: em }), list.length * per);
    scene.add(mesh);
    S.bridges.push({ mesh, list, per });
  });

  // 雲
  S.clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: th.cloud || 0xffffff, transparent: true, opacity: .85, flatShading: true });
  const crng = islRng(seedBase + 77);
  for (let k = 0; k < 16; k++) {
    const c = new THREE.Group();
    for (let m = 0; m < 4; m++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.8 + crng() * 1, 0), cloudMat); b.position.set(m * 1.1 - 1.6, crng() * .5, crng() - .5); c.add(b); }
    c.position.set((crng() - .5) * 46, -4 - crng() * 8, ISL_SZ * 2 - crng() * (floors.length + 3) * ISL_SZ);
    c.scale.setScalar(.8 + crng() * 1.2);
    scene.add(c); S.clouds.push(c);
  }

  // 鏡頭：從目前位置稍微後面滑進來
  const want = RUN.pos ? -(RUN.pos.f + .7) * ISL_SZ : ISL_SZ * .3;
  S.target = islClampFocus(want);
  S.focus = S.target + ISL_SZ * .8;
  S.hover = null;
  const loop = () => {
    if (!box.isConnected || $('#routeScreen').classList.contains('hidden')) { S.raf = 0; return; }
    S.raf = requestAnimationFrame(loop);
    islFrame();
  };
  loop();
  return true;
}

function islFrame() {
  const S = ISL, cam = S.camera;
  S.t += 1 / 60;
  if (S.box.clientWidth !== S.w || S.box.clientHeight !== S.h) islResize();
  S.focus += (S.target - S.focus) * .1;
  const d = S.dist, sway = Math.sin(S.t * .3) * .4;
  cam.position.set(sway, d * .62, S.focus + d * .78);
  cam.lookAt(0, -1, S.focus - 3);
  // 小島慢慢上下浮動
  S.islands.forEach(x => {
    x.grp.position.y = x.base + Math.sin(S.t * .9 + x.phase) * .12;
    if (x.grp.userData.ring) { const k = 1 + Math.sin(S.t * 4) * .06; x.grp.userData.ring.scale.set(k, k, 1); x.grp.userData.ring.material.opacity = .45 + Math.sin(S.t * 4) * .25; }
    const tgt = x === S.hover ? 1.08 : 1; x.grp.scale.setScalar(x.grp.scale.x + (tgt - x.grp.scale.x) * .2);
  });
  // 吊橋跟著兩邊的小島
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  S.bridges.forEach(b => {
    b.list.forEach(([A, B], li) => {
      const a = A.grp.position, c = B.grp.position, dx = c.x - a.x, dz = c.z - a.z, len = Math.hypot(dx, dz);
      const ra = A.grp.userData.r * .85 / len, rb = 1 - B.grp.userData.r * .85 / len, yaw = Math.atan2(dx, dz);
      for (let k = 0; k < b.per; k++) {
        const t = ra + (rb - ra) * (k + .5) / b.per;
        v.set(a.x + dx * t, a.y + (c.y - a.y) * t - .02 - Math.sin(Math.PI * (k + .5) / b.per) * .45, a.z + dz * t);
        e.set(0, yaw, 0); q.setFromEuler(e); m.compose(v, q, one);
        b.mesh.setMatrixAt(li * b.per + k, m);
      }
    });
    b.mesh.instanceMatrix.needsUpdate = true;
  });
  S.clouds.forEach((c, k) => { c.position.x += .006 * (k % 2 ? 1 : -1); if (c.position.x > 26) c.position.x = -26; if (c.position.x < -26) c.position.x = 26; });
  S.renderer.render(S.scene, cam);
  // HTML 圖示跟著小島
  S.overlay.forEach(o => {
    v.copy(o.isl.grp.position); v.y += o.dy * o.isl.grp.scale.x;
    const dist = cam.position.distanceTo(v);
    v.project(cam);
    if (v.z > 1 || v.y < -1.3 || v.y > 1.3) { o.el.style.display = 'none'; return; }
    o.el.style.display = '';
    o.el.style.left = ((v.x + 1) / 2 * S.w) + 'px';
    o.el.style.top = ((1 - v.y) / 2 * S.h) + 'px';
    o.el.style.setProperty('--s', clamp(26 / dist, .45, 1.15).toFixed(3));
    o.el.style.zIndex = String(1000 - Math.round(dist * 10));
  });
}

function islRay(e) {
  const r = ISL.renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(p, ISL.camera);
  const hit = rc.intersectObjects(ISL.pick, false)[0];
  return hit ? hit.object.userData.nd : null;
}
function islPick(e) {
  const nd = islRay(e);
  if (nd && reachable(nd.f, nd.i)) { sfx('click'); enterNode(nd); }
}
function islHover(e) {
  const nd = islRay(e), can = nd && reachable(nd.f, nd.i);
  ISL.hover = can ? ISL.islands.find(x => x.nd === nd) : null;
  ISL.renderer.domElement.style.cursor = can ? 'pointer' : 'grab';
}
