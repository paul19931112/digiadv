'use strict';
/* v12.0 戰場背景（從戰鬥畫面樣品移植）：用 canvas 畫多層場景（天空 → 遠景 → 中景 → 地面 → 地面小物），再加上會動的雲、霧、粒子 */
const SCENES = {
  dusk: { name: '🌅 檔案島・黃昏', sky: ['#241a45', '#6d3560', '#d8704e', '#f4b06a'], hz: .47, sun: { x: .63, y: .3, r: .075, c: '255,227,160' },
    clouds: 'rgba(255,196,196,.32)', far: { kind: 'hills', c: '#5b3b60', c2: '#3e2c48' }, mid: { kind: 'pines', c: '#22351e' },
    ground: ['#79a650', '#4f7a36', '#2c4c20'], spots: 'rgba(40,70,25,.35)', tufts: '#3f7a2c', flowers: ['#ffd1dc', '#fff4a8', '#ffffff', '#f9a8d4'], rocks: '#8a7e70',
    path: 'rgba(214,180,120,.35)', haze: 'rgba(255,180,120,.45)', parts: 'ember' },
  city: { name: '🌃 齒輪城市・夜晚', sky: ['#05081a', '#141a44', '#2e2462', '#57367a'], hz: .5, moon: { x: .22, y: .2, r: .045, c: '220,230,255' },
    far: { kind: 'skyline', c: '#1b2140', c2: '#121731' }, mid: { kind: 'gears', c: '#0f1428' },
    ground: ['#4a5470', '#2c3449', '#151a28'], grid: 'rgba(94,234,212,.28)', haze: 'rgba(120,90,200,.4)', parts: 'spark' },
  forest: { name: '🌫️ 迷霧森林', sky: ['#4b6658', '#7f9a88', '#adc0ac', '#c6d3c0'], hz: .5,
    far: { kind: 'bigtrees', c: '#3b5244', c2: '#2a3d31' }, mid: { kind: 'bushes', c: '#1e3324' },
    ground: ['#4f7a45', '#2f5230', '#183019'], spots: 'rgba(20,40,20,.4)', tufts: '#2c5a2a', mush: true, rocks: '#5f6b5a',
    haze: 'rgba(210,225,210,.55)', fog: true, parts: 'firefly' },
  mountain: { name: '🏔️ 無限山', sky: ['#2f62a8', '#6fa3dc', '#b9d9f2', '#e6f2fb'], hz: .48, sun: { x: .8, y: .18, r: .05, c: '255,255,240' },
    clouds: 'rgba(255,255,255,.55)', far: { kind: 'peaks', c: '#6c7f9c', c2: '#4b5d78' }, mid: { kind: 'crags', c: '#3d4656' },
    ground: ['#a08f7a', '#76664f', '#463a2c'], spots: 'rgba(60,45,30,.3)', rocks: '#9a9aa0', manyRocks: true, haze: 'rgba(230,240,255,.5)', parts: 'snow' },
  desert: { name: '🏜️ 伺服大陸・沙漠', sky: ['#3b82c4', '#7cc0e8', '#f3d9a4', '#f7c77e'], hz: .5, sun: { x: .25, y: .2, r: .07, c: '255,250,225' },
    clouds: 'rgba(255,255,255,.35)', far: { kind: 'hills', c: '#d9a35c', c2: '#bf8440' }, mid: { kind: 'crags', c: '#a8692f' },
    ground: ['#e9c27a', '#d3a15a', '#a8743a'], spots: 'rgba(150,100,40,.25)', rocks: '#b08a5a', haze: 'rgba(255,220,160,.45)', parts: 'ember' },
  factory: { name: '🏭 機械邪龍獸的工廠', sky: ['#0b0f19', '#1f2937', '#3f3f46', '#7c2d12'], hz: .5, moon: { x: .8, y: .2, r: .04, c: '255,160,80' },
    far: { kind: 'skyline', c: '#1f2430', c2: '#161a23' }, mid: { kind: 'gears', c: '#111827' },
    ground: ['#52525b', '#3f3f46', '#18181b'], grid: 'rgba(249,115,22,.22)', haze: 'rgba(249,115,22,.25)', parts: 'spark' },
  spiral: { name: '🌊 螺旋山・海與森林', sky: ['#0f172a', '#1e3a5f', '#2d6a7a', '#6fb3b8'], hz: .5, moon: { x: .2, y: .2, r: .04, c: '220,240,255' },
    clouds: 'rgba(200,220,240,.25)', far: { kind: 'peaks', c: '#24364d', c2: '#1a2738' }, mid: { kind: 'pines', c: '#12261a' },
    ground: ['#4f8a6a', '#2f5a45', '#1a3328'], spots: 'rgba(20,50,40,.4)', tufts: '#2c5a2a', rocks: '#5f6b6a', haze: 'rgba(125,211,252,.3)', parts: 'firefly' },
  tokyo: { name: '🗼 東京・夜晚', sky: ['#0b0618', '#2e1065', '#4c1d95', '#7e22ce'], hz: .5, moon: { x: .78, y: .18, r: .05, c: '255,120,120' },
    far: { kind: 'skyline', c: '#1e1033', c2: '#140a24' }, mid: { kind: 'skyline', c: '#0e0818' },
    ground: ['#3a3f52', '#262a3a', '#13151f'], grid: 'rgba(168,85,247,.2)', haze: 'rgba(168,85,247,.35)', fog: true, parts: 'wisp' },
  pyramid: { name: '🔺 金字塔・夜晚', sky: ['#020617', '#1e1b4b', '#3b1d5c', '#7c3a12'], hz: .5, moon: { x: .75, y: .2, r: .045, c: '200,240,255' },
    far: { kind: 'hills', c: '#3b2412', c2: '#24160a' }, mid: { kind: 'ruins', c: '#1a1008' },
    ground: ['#a0763e', '#7a5428', '#4a3014'], grid: 'rgba(34,211,238,.25)', rocks: '#6b4c26', haze: 'rgba(34,211,238,.18)', parts: 'spark' },
  dark: { name: '🌑 黑暗・惡魔獸', sky: ['#040209', '#160822', '#34102c', '#5c1430'], hz: .5, moon: { x: .7, y: .22, r: .06, c: '255,80,80' },
    far: { kind: 'spires', c: '#1e0d22', c2: '#120717' }, mid: { kind: 'ruins', c: '#0c050f' },
    ground: ['#33263a', '#1d1424', '#0b070e'], cracks: '#b45cff', rocks: '#3a2e40', haze: 'rgba(160,40,90,.4)', parts: 'wisp' },
};

// 固定亂數：同一個場景每次畫出來都一樣
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const Scene = {
  cv: null, ctx: null, key: 'dusk', W: 0, H: 0, dpr: 1, base: null, parts: [], clouds: [], t: 0, mirror: true, partsKind: null,
  init(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.resize(); addEventListener('resize', () => this.resize()); requestAnimationFrame(t => this.loop(t)); },
  // 換場景；parts 可以指定粒子（null 用場景預設、'none' 不要粒子）
  set(key, parts = null) { this.key = key; this.partsKind = parts; this.build(); },
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.dpr = Math.min(POWER.save ? 1 : 2, devicePixelRatio || 1); this.W = r.width; this.H = r.height;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.build();
  },
  build() {
    const S = SCENES[this.key], W = this.W, H = this.H;
    if (W < 20 || H < 20) { this.base = null; return; }   // 畫面還沒有大小（例如被隱藏）就先不畫
    const off = document.createElement('canvas'); off.width = W * this.dpr; off.height = H * this.dpr;
    const g = off.getContext('2d'); g.scale(this.dpr, this.dpr);
    drawStatic(g, W, H, S);
    this.base = off;
    const R = rng(7);
    this.clouds = S.clouds ? Array.from({ length: 6 }, () => ({ x: R() * W, y: H * (.06 + R() * .25), s: 40 + R() * 70, v: 4 + R() * 8 })) : [];
    this.parts = [];
  },
  // 小圖快取：發光粒子、霧帶
  _spr: {},
  sprite(kind) {
    if (this._spr[kind]) return this._spr[kind];
    const col = { ember: '255,150,60', firefly: '220,255,120', wisp: '170,80,255' }[kind] || '255,255,255';
    const cv = document.createElement('canvas'); cv.width = cv.height = 48; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    return (this._spr[kind] = cv);
  },
  fogStrip() {
    if (this._fog) return this._fog;
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 80; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 80); gr.addColorStop(0, 'rgba(220,232,220,0)'); gr.addColorStop(.5, 'rgba(220,232,220,.28)'); gr.addColorStop(1, 'rgba(220,232,220,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 80);
    return (this._fog = cv);
  },
  loop(now) {
    if (!POWER.gate('scene', now, POWER.fps())) { requestAnimationFrame(t => this.loop(t)); return; }   // 省電：限制每秒重畫次數
    const dt = Math.min(.05, (now - (this.last || now)) / 1000); this.last = now; this.t += dt;
    if (!this.cv.offsetParent) { requestAnimationFrame(t => this.loop(t)); return; }   // 不在戰鬥畫面就不畫
    const r = this.cv.parentElement; if (Math.abs(r.clientWidth - this.W) > 2 || Math.abs(r.clientHeight - this.H) > 2) this.resize();
    const S = SCENES[this.key], c = this.ctx, W = this.W, H = this.H, hz = H * S.hz;
    if (!this.base) { if (this.cv.parentElement.clientWidth > 20) this.resize(); requestAnimationFrame(t => this.loop(t)); return; }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.base, 0, 0, W, H);
    // 雲
    for (const cl of this.clouds) {
      cl.x += cl.v * dt; if (cl.x - cl.s * 2 > W) cl.x = -cl.s * 2;
      c.fillStyle = S.clouds;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(cl.x + i * cl.s * .45, cl.y + Math.sin(i * 2) * cl.s * .08, cl.s * .55, cl.s * .22, 0, 0, 7); c.fill(); }
    }
    // 霧（迷霧森林）
    if (S.fog) for (let i = 0; i < 4; i++) {
      const y = hz + (H - hz) * (i * .22 - .05), off = Math.sin(this.t * .3 + i) * 60;
      c.drawImage(this.fogStrip(), -100 + off, y - 40, W + 200, 80);
    }
    // 粒子
    const PK = POWER.save ? 'none' : this.partsKind || S.parts;   // 省電模式：沒有粒子
    if (PK !== 'none') this.spawn({ ...S, parts: PK }, dt);
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (PK === 'firefly') { p.vx += (Math.random() - .5) * 20 * dt; p.vy += (Math.random() - .5) * 20 * dt; }
      const a = Math.max(0, Math.min(1, p.life * 1.5)) * (PK === 'firefly' ? .5 + .5 * Math.sin(this.t * 6 + p.x) : 1);
      c.globalAlpha = a;
      if (PK === 'snow') { c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
      else if (PK === 'spark') { c.strokeStyle = '#7ff5ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); c.stroke(); }
      else {
        c.drawImage(this.sprite(PK), p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);   // 發光的粒子：同一種只畫一次，之後貼圖
      }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter(p => p.life > 0 && p.y > -20 && p.y < H + 20);
    requestAnimationFrame(t => this.loop(t));
  },
  spawn(S, dt) {
    const W = this.W, H = this.H, hz = H * S.hz, n = { ember: 14, spark: 10, firefly: 6, snow: 40, wisp: 10 }[S.parts] * dt;
    for (let i = 0; i < n + (Math.random() < n % 1 ? 1 : 0); i++) {
      if (S.parts === 'ember') this.parts.push({ x: W * ((this.mirror ? .53 : .12) + Math.random() * .35), y: H * (.5 + Math.random() * .2), vx: (Math.random() - .3) * 20, vy: -30 - Math.random() * 40, r: 1.5 + Math.random() * 1.5, life: 1.5 + Math.random() });
      if (S.parts === 'spark') this.parts.push({ x: Math.random() * W, y: hz + Math.random() * (H - hz), vx: (Math.random() - .5) * 220, vy: -60 - Math.random() * 120, r: 1, life: .3 + Math.random() * .3 });
      if (S.parts === 'firefly' && this.parts.length < 40) this.parts.push({ x: Math.random() * W, y: hz * .7 + Math.random() * (H - hz * .7), vx: 0, vy: 0, r: 1.6 + Math.random(), life: 4 + Math.random() * 3 });
      if (S.parts === 'snow') this.parts.push({ x: Math.random() * W * 1.2 - W * .1, y: -5, vx: -15 - Math.random() * 15, vy: 30 + Math.random() * 40, r: 1 + Math.random() * 1.8, life: 8 });
      if (S.parts === 'wisp') this.parts.push({ x: Math.random() * W, y: H * (.6 + Math.random() * .4), vx: (Math.random() - .5) * 10, vy: -20 - Math.random() * 25, r: 2 + Math.random() * 2, life: 2 + Math.random() * 1.5 });
    }
  },
};

function drawStatic(g, W, H, S) {
  const R = rng(1234), hz = H * S.hz;
  // 天空
  const sky = g.createLinearGradient(0, 0, 0, hz);
  S.sky.forEach((c, i) => sky.addColorStop(i / (S.sky.length - 1), c));
  g.fillStyle = sky; g.fillRect(0, 0, W, hz + 2);
  // 星星（夜晚場景）
  if (S.moon) { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${.2 + R() * .6})`; g.fillRect(R() * W, R() * hz * .8, 1.3, 1.3); } }
  // 太陽／月亮
  const orb = S.sun || S.moon;
  if (orb) {
    const x = W * orb.x, y = H * orb.y, r = Math.min(W, H) * orb.r * 2.2;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, `rgba(${orb.c},1)`); gr.addColorStop(.2, `rgba(${orb.c},.9)`); gr.addColorStop(.45, `rgba(${orb.c},.25)`); gr.addColorStop(1, `rgba(${orb.c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
  }
  // 遠景
  const F = S.far, ridge = (base, amp, step, col, jag = 1) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 2); let x = 0;
    step = Math.max(8, step);   // 寬度是 0 時不要陷入無窮迴圈
    while (x <= W + step) { g.lineTo(x, base - (R() * amp * jag + amp * (1 - jag) * .5)); x += step * (.6 + R() * .8); }
    g.lineTo(W, hz + 2); g.closePath(); g.fill();
  };
  if (F.kind === 'hills') { ridge(hz - H * .06, H * .12, W * .08, F.c); ridge(hz - H * .01, H * .06, W * .06, F.c2); }
  if (F.kind === 'peaks') {
    for (let i = 0; i < 7; i++) {
      const cx = W * (i / 6) + (R() - .5) * W * .1, top = hz - H * (.16 + R() * .14), w = W * (.12 + R() * .08);
      g.fillStyle = i % 2 ? F.c : F.c2; g.beginPath(); g.moveTo(cx - w, hz + 2); g.lineTo(cx, top); g.lineTo(cx + w, hz + 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(cx - w * .28, top + (hz - top) * .28); g.lineTo(cx, top); g.lineTo(cx + w * .28, top + (hz - top) * .28);
      g.lineTo(cx + w * .1, top + (hz - top) * .22); g.lineTo(cx - w * .05, top + (hz - top) * .3); g.fill();
    }
  }
  if (F.kind === 'skyline') {
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < W) {
        const w = 20 + R() * 50, h = H * (layer ? .08 + R() * .12 : .14 + R() * .2);
        g.fillStyle = layer ? F.c2 : F.c; g.fillRect(x, hz - h, w, h + 2);
        if (!layer) for (let wy = hz - h + 6; wy < hz - 4; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (R() < .35) { g.fillStyle = R() < .5 ? 'rgba(255,214,120,.8)' : 'rgba(120,220,255,.7)'; g.fillRect(wx, wy, 3, 4); }
        x += w + R() * 6;
      }
    }
  }
  if (F.kind === 'bigtrees') {
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 9; i++) {
      const x = R() * W, tw = 10 + R() * 14, top = hz - H * (layer ? .28 : .38) * (.7 + R() * .4);
      g.fillStyle = layer ? F.c2 : F.c; g.fillRect(x - tw / 2, top, tw, hz - top + 2);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (R() - .5) * 50, top + R() * 30, 30 + R() * 25, 18 + R() * 14, 0, 0, 7); g.fill(); }
    }
  }
  if (F.kind === 'spires') {
    for (let i = 0; i < 12; i++) {
      const x = R() * W, w = 8 + R() * 18, h = H * (.08 + R() * .26);
      g.fillStyle = i % 2 ? F.c : F.c2; g.beginPath(); g.moveTo(x - w, hz + 2); g.lineTo(x - w * .4, hz - h * .8); g.lineTo(x, hz - h); g.lineTo(x + w * .4, hz - h * .8); g.lineTo(x + w, hz + 2); g.fill();
      if (R() < .4) { g.fillStyle = 'rgba(255,60,90,.7)'; g.fillRect(x - 1.5, hz - h * .6, 3, 4); }
    }
  }
  // 中景
  const M = S.mid;
  if (M.kind === 'pines') for (let i = 0; i < 26; i++) {
    const x = R() * W, h = 18 + R() * 30; g.fillStyle = M.c;
    g.beginPath(); g.moveTo(x - h * .35, hz + 3); g.lineTo(x, hz - h); g.lineTo(x + h * .35, hz + 3); g.fill();
  }
  if (M.kind === 'gears') for (let i = 0; i < 4; i++) {
    const x = W * (.1 + i * .27) + (R() - .5) * 40, y = hz - 10 - R() * 20, r = 22 + R() * 30;
    g.fillStyle = M.c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-4, -r - 7, 8, 10); g.restore(); }
    g.fillStyle = S.sky[2]; g.beginPath(); g.arc(x, y, r * .35, 0, 7); g.fill();
  }
  if (M.kind === 'bushes' || M.kind === 'crags' || M.kind === 'ruins') for (let i = 0; i < 18; i++) {
    const x = R() * W, w = 20 + R() * 40, h = 8 + R() * (M.kind === 'ruins' ? 30 : 16); g.fillStyle = M.c;
    if (M.kind === 'ruins') g.fillRect(x, hz - h, w * .3, h + 3);
    else { g.beginPath(); g.ellipse(x, hz + 2, w, h, 0, Math.PI, 0); g.fill(); }
  }
  // 地平線的光暈
  const hzG = g.createLinearGradient(0, hz - H * .06, 0, hz + H * .05); hzG.addColorStop(0, 'rgba(0,0,0,0)'); hzG.addColorStop(.5, S.haze); hzG.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hzG; g.fillRect(0, hz - H * .06, W, H * .11);
  // 地面
  const gd = g.createLinearGradient(0, hz, 0, H); S.ground.forEach((c, i) => gd.addColorStop(i / (S.ground.length - 1), c));
  g.fillStyle = gd; g.fillRect(0, hz, W, H - hz);
  const persp = y => (y - hz) / (H - hz);   // 0（遠）～1（近）
  if (S.spots) for (let i = 0; i < 160; i++) { const y = hz + Math.pow(R(), 1.4) * (H - hz), p = persp(y); g.fillStyle = S.spots; g.beginPath(); g.ellipse(R() * W, y, 6 + p * 60 * R(), 2 + p * 14 * R(), 0, 0, 7); g.fill(); }
  if (S.path) { g.fillStyle = S.path; g.beginPath(); g.ellipse(W * .48, hz + (H - hz) * .55, W * .5, (H - hz) * .26, -.22, 0, 7); g.fill(); }
  if (S.grid) {   // 金屬地板：往遠處收斂的格線
    g.strokeStyle = S.grid; g.lineWidth = 1; const vx = W * .5;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(vx + i * W * .02, hz); g.lineTo(vx + i * W * .16, H); g.stroke(); }
    for (let k = 1; k < 12; k++) { const y = hz + (H - hz) * Math.pow(k / 12, 1.8); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,90,200,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, hz + (H - hz) * .62); g.lineTo(W, hz + (H - hz) * .5); g.stroke();
  }
  if (S.cracks) {   // 裂開的地面透出紫光
    g.shadowColor = S.cracks; g.shadowBlur = 10; g.strokeStyle = S.cracks; g.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) {
      let x = R() * W, y = hz + R() * (H - hz); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - .5) * 60 * (1 + persp(y)); y += (R() - .3) * 20 * (1 + persp(y)); g.lineTo(x, y); }
      g.stroke();
    }
    g.shadowBlur = 0;
  }
  // 地面小物：草叢、花、石頭、蘑菇（近大遠小）
  const items = [];
  for (let i = 0; i < (S.manyRocks ? 70 : 40); i++) items.push({ y: hz + Math.pow(R(), .8) * (H - hz), x: R() * W, k: R() });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const p = persp(it.y), s = 3 + p * 22;
    if (S.tufts && it.k < .45) {
      g.fillStyle = S.tufts;
      for (let b = 0; b < 5; b++) { const bx = it.x + (b - 2) * s * .25; g.beginPath(); g.moveTo(bx - s * .12, it.y); g.lineTo(bx + (b - 2) * s * .12, it.y - s * (.7 + R() * .5)); g.lineTo(bx + s * .12, it.y); g.fill(); }
      if (S.flowers && R() < .5) { g.fillStyle = S.flowers[Math.floor(R() * S.flowers.length)]; g.beginPath(); g.arc(it.x + s * .2, it.y - s * .8, s * .14, 0, 7); g.fill(); }
    } else if (S.mush && it.k < .6) {
      g.fillStyle = '#e8dcc8'; g.fillRect(it.x - s * .08, it.y - s * .45, s * .16, s * .45);
      g.fillStyle = R() < .5 ? '#c0392b' : '#8e6bb8'; g.beginPath(); g.ellipse(it.x, it.y - s * .45, s * .32, s * .2, 0, Math.PI, 0); g.fill();
    } else if (S.rocks && it.k < (S.manyRocks ? .9 : .7)) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(it.x, it.y + s * .05, s * .5, s * .12, 0, 0, 7); g.fill();
      g.fillStyle = S.rocks; g.beginPath(); g.moveTo(it.x - s * .45, it.y); g.lineTo(it.x - s * .25, it.y - s * .4); g.lineTo(it.x + s * .15, it.y - s * .5); g.lineTo(it.x + s * .45, it.y); g.fill();
      g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(it.x - s * .25, it.y - s * .4); g.lineTo(it.x + s * .15, it.y - s * .5); g.lineTo(it.x, it.y - s * .2); g.fill();
    }
  }
}
