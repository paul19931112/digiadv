'use strict';
/* =========================================================
   世界：章節路線圖 + 每個節點的探索地圖
   ========================================================= */

// =========================================================
//   路線圖
// =========================================================
function genRoute(chKey) {
  const ch = CHAPTERS[chKey], F = ch.floors, floors = [];
  const shopFloor = randInt(2, F - 3);
  for (let f = 0; f < F; f++) {
    const n = f === F - 1 ? 1 : f === 0 ? 3 : f === F - 2 ? 2 : randInt(2, 4);
    const row = [];
    for (let i = 0; i < n; i++) {
      let type;
      if (f === 0) type = 'battle';
      else if (f === F - 1) type = 'boss';
      else if (f === F - 2) type = i === 0 ? 'rest' : pick(['shop', 'treasure', 'event']);
      else if (f === shopFloor && i === 0) type = 'shop';
      else type = weighted({ battle: 38, event: 24, elite: f >= 2 ? 10 : 0, rest: 6, shop: 4, egg: 5, treasure: 5, puzzle: 8 });
      row.push({ f, i, type, next: [], jx: rand(-.06, .06) });
    }
    floors.push(row);
  }
  if (chKey === 5) for (let f = 1; f <= 4; f++) {   // 金字塔：第 2～5 層各有一個駭客終端
    const row = floors[f], c = row.filter(nd => !['shop', 'rest'].includes(nd.type));
    if (!row.some(nd => nd.type === 'hack') && c.length) pick(c).type = 'hack';
  }
  // 連線：依位置比例連到下一層，並保證每個節點都走得到
  for (let f = 0; f < F - 1; f++) {
    const a = floors[f], b = floors[f + 1];
    a.forEach((nd, i) => {
      const j = a.length === 1 ? 0 : Math.round(i * (b.length - 1) / (a.length - 1));
      nd.next.push(j);
      if (Math.random() < .45) { const k = clamp(j + (Math.random() < .5 ? -1 : 1), 0, b.length - 1); if (!nd.next.includes(k)) nd.next.push(k); }
    });
    b.forEach((nd, j) => {
      if (!a.some(x => x.next.includes(j))) {
        let best = 0, bd = 9;
        a.forEach((x, i) => { const d = Math.abs(i / Math.max(1, a.length - 1) - j / Math.max(1, b.length - 1)); if (d < bd) { bd = d; best = i; } });
        a[best].next.push(j);
      }
    });
  }
  return floors;
}

function reachable(f, i) {
  if (!RUN.pos) return f === 0;
  const cur = RUN.route[RUN.pos.f][RUN.pos.i];
  return f === RUN.pos.f + 1 && cur.next.includes(i);
}

function showRoute() {
  G.screen = 'route'; G.mode = 'route';
  showScreen('#routeScreen');
  $('#hud').classList.remove('hidden');
  updateHUD();
  const ch = CHAPTERS[RUN.chapter], floors = RUN.route;
  const box = $('#routeMap');
  const W = box.clientWidth || 700, rowH = 92, H = floors.length * rowH + 40;
  box.style.height = H + 'px';
  const pos = (nd) => ({ x: ((nd.i + 1) / (floors[nd.f].length + 1) + nd.jx) * W, y: H - 50 - nd.f * rowH });
  let svg = `<svg width="${W}" height="${H}" class="routeLines">`;
  floors.forEach(row => row.forEach(nd => nd.next.forEach(j => {
    const a = pos(nd), b = pos(floors[nd.f + 1][j]);
    const lit = RUN.visited.includes(`${nd.f}-${nd.i}`) && (RUN.visited.includes(`${nd.f + 1}-${j}`) || (RUN.pos && RUN.pos.f === nd.f && RUN.pos.i === nd.i));
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${lit ? 'lit' : ''}"/>`;
  })));
  svg += '</svg>';
  box.innerHTML = svg;
  floors.forEach(row => row.forEach(nd => {
    const p = pos(nd), info = NODE_INFO[nd.type], key = `${nd.f}-${nd.i}`;
    const el = document.createElement('button');
    const can = reachable(nd.f, nd.i), done = RUN.visited.includes(key), here = RUN.pos && RUN.pos.f === nd.f && RUN.pos.i === nd.i;
    el.className = `rnode ${nd.type}${can ? ' can' : ''}${done ? ' done' : ''}${here ? ' here' : ''}`;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.innerHTML = nd.type === 'boss' ? spPic(ch.boss.id, 's64') : `<span>${info.icon}</span>`;
    el.title = info.name;
    if (can) el.onclick = () => enterNode(nd);
    box.appendChild(el);
  }));
  $('#routeTitle').textContent = ch.title;
  $('#routeSub').textContent = RUN.pos ? `第 ${RUN.pos.f + 1} / ${floors.length} 層　｜　點選發光的節點前進` : '選擇出發的路線';
  const wrap = $('#routeWrap');
  const target = RUN.pos ? pos(floors[RUN.pos.f][RUN.pos.i]).y : H;
  wrap.scrollTop = target - wrap.clientHeight * .6;
}

function enterNode(nd) {
  RUN.pos = { f: nd.f, i: nd.i };
  RUN.visited.push(`${nd.f}-${nd.i}`);
  enterArea(nd);
}

// =========================================================
//   探索地圖
// =========================================================
const TS = 32, COLS = 24, ROWS = 16;
let AREA = null;
const SOLID = new Set(['T', '~', 'R']);

function nodeLevel(f) {
  const ch = CHAPTERS[RUN.chapter], t = f / (ch.floors - 1);
  return Math.round(ch.lv[0] + t * (ch.lv[1] - ch.lv[0]));
}

function genArea(nd) {
  const theme = CHAPTERS[RUN.chapter].theme;
  const T = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ? 'T' : '.'));
  const blob = (ch, n, rmin, rmax) => {
    for (let k = 0; k < n; k++) {
      const cx = randInt(2, COLS - 3), cy = randInt(2, ROWS - 3), r = rand(rmin, rmax);
      for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++)
        if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r + rand(-1, 1)) T[y][x] = ch;
    }
  };
  const maze = theme === 'pyramid';
  if (maze) pyramidMaze(T);   // 金字塔：走道迷宮
  else if (theme === 'tokyo') tokyoCity(T);   // 東京：街道和大樓
  else {
    blob(',', randInt(5, 8), 1.5, 3.2);
    blob('T', theme === 'forest' ? randInt(9, 13) : theme === 'desert' ? randInt(3, 5) : randInt(5, 8), .8, 1.8);
    if (theme === 'mountain' || theme === 'desert') blob('R', randInt(4, 6), .8, 1.6);
    blob('~', theme === 'desert' ? randInt(0, 1) : randInt(1, 2), 1.2, 2.2);
  }
  const start = { x: 1, y: maze ? oddRow() : randInt(4, ROWS - 5) }, exit = { x: COLS - 2, y: maze ? oddRow() : randInt(3, ROWS - 4) };
  const clear = (p, r) => { for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1) T[y][x] = '.'; };
  clear(start, 1); clear(exit, 1);
  // 保證能從起點走到出口
  const bfs = () => {
    const d = Array.from({ length: ROWS }, () => Array(COLS).fill(-1)), q = [start]; d[start.y][start.x] = 0;
    while (q.length) { const c = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.x + dx, ny = c.y + dy; if (!SOLID.has(T[ny][nx]) && d[ny][nx] < 0) { d[ny][nx] = d[c.y][c.x] + 1; q.push({ x: nx, y: ny }); } } }
    return d;
  };
  let dist = bfs();
  if (dist[exit.y][exit.x] < 0) {
    let x = start.x, y = start.y;
    while (x !== exit.x || y !== exit.y) {
      if (Math.random() < .7) x += Math.sign(exit.x - x) || 0; else y += Math.sign(exit.y - y) || 0;
      if (x === exit.x && y !== exit.y) y += Math.sign(exit.y - y);
      x = clamp(x, 1, COLS - 2); y = clamp(y, 1, ROWS - 2);
      if (SOLID.has(T[y][x])) T[y][x] = '.';
    }
    dist = bfs();
  }
  const objs = [], used = new Set([`${start.x},${start.y}`, `${exit.x},${exit.y}`]);
  const free = (minStart = 4) => {
    const c = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++)
      if (dist[y][x] >= minStart && !used.has(`${x},${y}`)) c.push({ x, y });
    return c;
  };
  // 會一直留在原地的物件（商店、泉水、NPC、蛋）不能擋住通往出口的路
  const blocksPath = p => {
    const solid = new Set(objs.filter(o => o.kind !== 'enemy' && o.kind !== 'chest').map(o => `${o.x},${o.y}`).concat(`${p.x},${p.y}`));
    const seen = new Set([`${start.x},${start.y}`]), q = [start];
    while (q.length) { const c = q.shift(); if (c.x === exit.x && c.y === exit.y) return false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
        if (!SOLID.has(T[ny][nx]) && !solid.has(k) && !seen.has(k)) { seen.add(k); q.push({ x: nx, y: ny }); } } }
    return true;
  };
  const place = (o, cands) => {
    cands = shuffle(cands.slice());
    const p = ['enemy', 'chest', 'pickup', ...PASS_KINDS].includes(o.kind) ? cands[0] : cands.find(c => !blocksPath(c)) || (maze && o.kind === 'npc' ? cands[0] : null);
    if (!p) return;
    used.add(`${p.x},${p.y}`); objs.push({ ...o, x: p.x, y: p.y });
  };
  const nearExit = () => {
    for (const r of [3, 5, 8]) { const c = free(3).filter(p => Math.abs(p.x - exit.x) + Math.abs(p.y - exit.y) <= r); if (c.length) return c; }
    return free(2);
  };
  const middle = () => { const c = free(5).filter(p => p.x > 7 && p.x < 17); return c.length > 3 ? c : free(2); };
  const ch = CHAPTERS[RUN.chapter], lv = nodeLevel(nd.f);
  const enemy = (role, id, l) => ({ kind: 'enemy', role, sp: id, lv: Math.max(1, l), cd: rand(.5, 1.2) });

  switch (nd.type) {
    case 'battle':
      place(enemy('guard', pick(ch.zone), lv), nearExit());
      for (let k = 0; k < randInt(1, 2); k++) place(enemy('roam', pick(ch.zone), lv - 1), free(5));
      if (Math.random() < .5) place({ kind: 'chest' }, free(4));
      break;
    case 'elite':
      place(enemy('elite', pick(ch.elites), lv + 1), nearExit());
      place(enemy('roam', pick(ch.zone), lv - 1), free(5));
      place({ kind: 'chest', rich: true }, free(4));
      break;
    case 'event': {
      const ev = pickEvent();
      if (ev) place({ kind: 'npc', ev: ev.id, sp: ev.npc }, middle());
      else { place({ kind: 'chest', rich: true }, middle()); }
      if (Math.random() < .5) place(enemy('roam', pick(ch.zone), lv - 1), free(6));
      break;
    }
    case 'rest':   place({ kind: 'spring' }, middle()); break;
    case 'shop':   place({ kind: 'shop', sp: 'monzaemon' }, middle()); break;
    case 'egg':    place({ kind: 'egg', star: starterEggs().length > 0 && Math.random() < (P2() ? .4 : .25) }, middle()); place(enemy('roam', pick(ch.zone), lv - 1), free(6)); break;
    case 'treasure':
      for (let k = 0; k < randInt(2, 3); k++) place({ kind: 'chest' }, free(4));
      place(enemy('roam', pick(ch.zone), lv), free(6));
      break;
    case 'tutorial': {
      const near = free(2).filter(p => dist[p.y][p.x] >= 2 && dist[p.y][p.x] <= 4);
      place({ kind: 'pickup', show: true }, near.length ? near : free(2));
      place({ ...enemy('guard', 'numemon', 1), tut: 1 }, nearExit());
      break;
    }
    case 'hack':
      if (Math.random() < .6) place(enemy('roam', pick(ch.zone), lv - 1), free(6));
      break;
    case 'puzzle':
      place({ kind: 'stone' }, middle());
      if (Math.random() < .5) place(enemy('roam', pick(ch.zone), lv - 1), free(6));
      break;
    case 'boss':
      place(enemy('boss', ch.boss.id, ch.boss.lv), nearExit());
      break;
  }
  if (nd.type !== 'boss' && nd.type !== 'tutorial') {
    // 地圖上隨機散落的寶物：死路盡頭、離起點遠的地方比較容易有
    const cand = free(4);
    const openN = p => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !SOLID.has(T[p.y + dy][p.x + dx])).length;
    const dead = cand.filter(p => openN(p) === 1), far = cand.filter(p => dist[p.y][p.x] >= 14);
    for (let k = 0; k < randInt(2, 4) + (nd.type === 'treasure' ? 1 : 0); k++)
      place({ kind: 'pickup' }, dead.length && Math.random() < .6 ? dead : far.length && Math.random() < .6 ? far : cand);
    if (['battle', 'treasure', 'event'].includes(nd.type) && Math.random() < .2) place({ kind: 'stone' }, free(5));
  }
  maybePlaceAssist(place, free, nd.type);   // 援護事件：任何地圖都可能出現
  extraObjs(nd, place, free, T, dist);   // 第二部：傳送點、陷阱、駭客終端、徽章、樂團
  placeClue(nd, place, free);   // 第六章：第 8 個孩子的線索
  return { T, objs, start, exit, theme, nd, x: start.x, y: start.y, mv: { moving: false, t: 0 }, facing: 1, seen: new Uint8Array(COLS * ROWS) };
}

function exitLocked() {
  return AREA.objs.some(o => !o.done && ((o.kind === 'enemy' && o.role !== 'roam') || (o.kind === 'npc' && !o.opt)));   // opt：可以不理的 NPC（援護事件）
}

// ---------- 迷霧：只看得到身邊，走過的地方會記住地形 ----------
const sightR = () => 4 + K().sight + (has('radar') ? 2 : 0) - (AREA && AREA.theme === 'pyramid' ? 1 : 0);   // 金字塔裡比較暗
function reveal() {
  const A = AREA, R = sightR();
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
    if (Math.hypot(x - A.x, y - A.y) <= R + .5) A.seen[y * COLS + x] = 1;
}

// ---------- 存檔：把目前的節點地圖存起來（關掉網頁再回來會回到同一個地方） ----------
function serializeArea(A) {
  return { T: A.T, objs: A.objs, start: A.start, exit: A.exit, theme: A.theme, nd: { f: A.nd.f, i: A.nd.i, type: A.nd.type },
           x: A.mv.moving ? A.mv.toX : A.x, y: A.mv.moving ? A.mv.toY : A.y, facing: A.facing, seen: Array.from(A.seen), introDone: !!A.introDone, scanned: !!A.scanned, seal: A.seal || null };
}
function restoreArea(d) {
  const nd = (RUN.route && RUN.route[d.nd.f] && RUN.route[d.nd.f][d.nd.i]) || d.nd;
  return { T: d.T, objs: d.objs, start: d.start, exit: d.exit, theme: d.theme, nd, x: d.x, y: d.y, facing: d.facing || 1,
           mv: { moving: false, t: 0 }, seen: Uint8Array.from(d.seen), introDone: d.introDone, scanned: d.scanned, seal: d.seal || undefined };
}
async function resumeArea(data) {
  AREA = restoreArea(data);
  setTimeout(layoutArea, 0);
  G.screen = 'area'; G.mode = 'area';
  showScreen('#areaScreen');
  $('#hud').classList.remove('hidden');
  AREA.objs.forEach(o => o.sp && loadImg(SPECIES[o.sp].img));
  updateHUD();
  toast('從上次離開的地方繼續冒險', 2500);
  if (AREA.nd.type === 'boss' && !AREA.introDone) { await bossIntro(); AREA.introDone = true; saveRun(); }
}

async function enterArea(nd) {
  AREA = genArea(nd);
  setTimeout(layoutArea, 0);
  reveal();
  G.screen = 'area'; G.mode = 'area';
  showScreen('#areaScreen');
  $('#hud').classList.remove('hidden');
  AREA.objs.forEach(o => o.sp && loadImg(SPECIES[o.sp].img));
  updateHUD();
  const info = NODE_INFO[nd.type];
  banner(`${info.icon} ${info.name}`);
  const hint = { battle: '打倒守在出口的數碼寶貝才能離開', elite: '出口被暗黑化的強敵擋住了！', event: '好像有誰在等你…去跟牠說說話',
                 rest: '找到回復泉了', shop: '玩偶獸開了一家商店', egg: '附近有一顆數碼蛋', treasure: '這裡散落著寶箱！', tutorial: '長老獸的訓練場', puzzle: '發現了一座古代遺跡，石碑上刻著謎題', hack: '迷宮深處有一台古代終端機，駭進去可以削弱機械猴子獸', boss: '強大的氣息…頭目就在出口前' }[nd.type];
  toast(hint, 3000);
  if (AREA.objs.some(o => o.kind === 'crest')) setTimeout(() => toast('📟 數碼裝置有微弱的反應……這張地圖好像埋著徽章！（左上角的雷達越熱越近）', 4000), 3100);
  saveRun();   // 一進節點就存檔：商店的貨、寶箱、敵人都固定下來，不能用重開來刷
  if (nd.type === 'boss') { await bossIntro(); AREA.introDone = true; saveRun(); }
  if (P2() && RUN.chapter === 4 && !RUN.crest && nd.f >= 2) await crestEvent();   // 第四章中段：拿到自己的徽章
  if (P2() && RUN.chapter === 6 && !RUN.awaken && nd.f >= CHAPTERS[6].floors - 2) await awakenEvent();   // 第六章：頭目前一層徽章覺醒
  if (AREA && AREA.objs.some(o => o.kind === 'clue' && !o.done)) setTimeout(() => toast('🔎 這附近好像有第 8 個孩子的線索……', 3500), 3300);
}

function leaveArea() {
  sfx('portal');
  if (G.tutorial) { AREA = null; TUT.exited = true; return; }
  const nd = AREA.nd;
  AREA = null;
  saveRun();
  if (nd.type === 'boss') chapterComplete();
  else showRoute();
}

// ---------- 移動 / 互動 ----------
const keys = new Set();
const DIRS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
const STEP_TIME = 0.14;
// 目前按住的方向（可以同時按兩個方向 → 斜著走）
function heldVec() { let x = 0, y = 0; for (const k of keys) if (DIRS[k]) { x += DIRS[k][0]; y += DIRS[k][1]; } x = Math.sign(x); y = Math.sign(y); return x || y ? [x, y] : null; }
const objAt = (x, y) => AREA.objs.find(o => !o.done && o.x === x && o.y === y);

function updateArea(dt) {
  const A = AREA, m = A.mv;
  ch5Tick(A);
  if (m.moving) {
    m.t += dt / (STEP_TIME * (m.len || 1));   // 斜走一步比較遠（×1.4）
    if (m.t >= 1) { m.moving = false; A.x = m.toX; A.y = m.toY; reveal(); }
  }
  if (!m.moving && G.mode === 'area') {
    let vec = heldVec();
    if (vec) A.path = null;   // 有按方向鍵就取消自動走路
    else if (A.path && A.path.length) {
      const n = A.path.shift();
      vec = [n.x - A.x, n.y - A.y];
      if (Math.abs(vec[0]) + Math.abs(vec[1]) !== 1) { A.path = null; vec = null; }
    }
    if (vec) {
      const [dx, dy] = vec;
      if (dx) A.facing = dx;
      // 往某一格走一步：出口、碰到東西、空地才走得動；回傳有沒有成功
      const step = (sx, sy) => {
        const nx = A.x + sx, ny = A.y + sy;
        if (nx === A.exit.x && ny === A.exit.y) { A.path = null; tryExit(); return true; }
        if (sealBlocks(A, nx, ny)) { A.path = null; return false; }   // 陷阱房的光牆
        const o = objAt(nx, ny);
        if (o) { A.path = null; interact(o); return true; }
        if (SOLID.has(A.T[ny][nx])) return false;
        Object.assign(m, { fromX: A.x, fromY: A.y, toX: nx, toY: ny, t: 0, moving: true, len: sx && sy ? 1.41 : 1 });
        return true;
      };
      const free = (x, y) => !SOLID.has(A.T[y][x]) && !objAt(x, y) && !sealBlocks(A, x, y);
      if (dx && dy) {
        // 斜著走：旁邊兩格都是空地才能過（不能穿過牆角）；過不去就沿著牆滑
        if (!(free(A.x + dx, A.y) && free(A.x, A.y + dy) && step(dx, dy))) { if (!step(dx, 0)) step(0, dy); }
      } else step(dx, dy);
    }
  }
  // 遊蕩的敵人
  if (G.mode !== 'area') return;
  for (const o of A.objs) {
    if (o.done || o.kind !== 'enemy' || o.role !== 'roam') continue;
    o.cd -= dt;
    if (o.cd > 0) continue;
    o.cd = rand(.7, 1.3);
    const px = m.moving ? m.toX : A.x, py = m.moving ? m.toY : A.y;
    const near = Math.abs(o.x - px) + Math.abs(o.y - py) <= 5;
    let dirs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    if (near && Math.random() < .7) dirs.sort((a, b) => (Math.abs(o.x + a[0] - px) + Math.abs(o.y + a[1] - py)) - (Math.abs(o.x + b[0] - px) + Math.abs(o.y + b[1] - py)));
    for (const [dx, dy] of dirs) {
      const nx = o.x + dx, ny = o.y + dy;
      if (nx === px && ny === py) { interact(o); return; }
      if (SOLID.has(A.T[ny][nx]) || objAt(nx, ny) || (nx === A.exit.x && ny === A.exit.y) || (o.amb && sealBlocks(A, nx, ny))) continue;
      o.x = nx; o.y = ny; break;
    }
  }
}

function tryExit() {
  if (exitLocked()) { sfx('error'); toast(AREA.objs.some(o => !o.done && o.kind === 'npc' && !o.opt) ? '🔒 先去跟附近的數碼寶貝說說話吧' : '🔒 出口被擋住了，先打倒守門的敵人！'); keys.clear(); return; }
  keys.clear();
  leaveArea();
}

async function interact(o) {
  keys.clear();
  G.mode = 'busy';
  if (o.kind === 'enemy' && o.tut) {
    G.trans = { t: 0 }; G.mode = 'transition'; await sleep(600);
    await tutBattle1(); o.done = true; TUT.b1done = true; backToArea(); return;
  }
  if (o.kind === 'enemy') {
    G.trans = { t: 0 };
    G.mode = 'transition';
    await sleep(600);
    const res = await runBattle(o.sp, o.lv, { elite: o.role === 'elite', boss: o.role === 'boss', ...(o.opt || {}) });
    if (res === 'win') { o.done = true; if (o.role === 'boss') await bossDefeated(); }
    backToArea();
    if (res === 'flee') { o.cd = 2; G.graceT = 1.5; }
    return;
  }
  if (o.kind === 'chest') { o.done = true; await openChest(o.rich); }
  else if (o.kind === 'npc') { if (o.asp) await assistEvent(o); else await runEvent(o.ev); o.done = true; }
  else if (o.kind === 'spring') { if (await restSpot()) o.done = true; }
  else if (o.kind === 'shop') { await openShop(o); }
  else if (o.kind === 'egg') { o.done = true; await hatchEgg(o.star); }
  else if (o.kind === 'pickup') { o.done = true; await openPickup(); }
  else if (o.kind === 'stone') { if (await stoneTablet()) o.done = true; }
  else await ch5Interact(o);
  backToArea();
}
function backToArea() {
  if (!AREA) return;
  G.screen = 'area'; G.mode = 'area';
  showScreen('#areaScreen');
  $('#hud').classList.remove('hidden');
  updateHUD();
  saveRun();   // 戰鬥、事件、寶箱結束後存檔（經驗值、道具不會不見）
}

// ---------- 觸控：點地圖自動走過去 ----------
function findPath(tx, ty) {
  const A = AREA, start = { x: A.mv.moving ? A.mv.toX : A.x, y: A.mv.moving ? A.mv.toY : A.y };
  const key = (x, y) => y * COLS + x, prev = new Map([[key(start.x, start.y), null]]), q = [start];
  const isTarget = (x, y) => x === tx && y === ty;
  while (q.length) {
    const c = q.shift();
    if (isTarget(c.x, c.y)) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || prev.has(k)) continue;
      // 目標格可以是物件或出口；路上不能穿過牆和物件
      const ob = objAt(nx, ny), hiddenTrap = ob && ob.kind === 'trap';   // 看不見的陷阱不能拿來繞路（會直接踩上去）
      const blocked = SOLID.has(A.T[ny][nx]) || sealBlocks(A, nx, ny) || (((ob && !hiddenTrap) || (nx === A.exit.x && ny === A.exit.y)) && !isTarget(nx, ny));
      if (blocked) continue;
      prev.set(k, c); q.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  for (let c = { x: tx, y: ty }; c && !(c.x === start.x && c.y === start.y); c = prev.get(key(c.x, c.y))) path.unshift({ x: c.x, y: c.y });
  return path;
}
function tapArea(ev) {
  if (!AREA || G.mode !== 'area' || G.dialog) return;
  const r = cvs.getBoundingClientRect();
  const tx = Math.floor(((ev.clientX - r.left) / r.width * cvs.width + CAM.x) / TS), ty = Math.floor((ev.clientY - r.top) / r.height * ROWS);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  if (!AREA.seen[ty * COLS + tx] && !(tx === AREA.exit.x && ty === AREA.exit.y)) { toast('那裡還被迷霧籠罩，先往附近走走看'); return; }
  const path = findPath(tx, ty);
  if (!path) { toast('走不過去喔'); return; }
  AREA.path = path;
  AREA.tapMark = { x: tx, y: ty, t: performance.now() };
}

// ---------- 寶箱 / 回復泉 / 數碼蛋 / 商店 ----------
async function openChest(rich) {
  sfx('chest');
  const r = Math.random();
  if (rich && r < .35 && relicPool().length) {
    const k = pick(relicPool()); RUN.relics.push(k);
    await say(null, `寶箱裡有一個發光的道具！<br>獲得 <b>${RELICS[k].icon} ${RELICS[k].name}</b>：${RELICS[k].desc}`);
  } else if (r < .45) {
    const b = gainBits(randInt(20, 40) * (rich ? 2 : 1));
    await say(null, `寶箱裡有 💰 ${b} 數碼幣！`);
  } else if (r < .65) {
    const k = pick(RANDOM_ITEMS);
    await say(null, `寶箱裡有 ${ITEMS[k].icon} ${ITEMS[k].name}！`);
    await addItem(k);
  } else if (r < .88) {
    const id = await pickScreen({ title: '🎁 寶箱裡有卡片', sub: '選一張加入牌組', items: shuffle([...rewardPool()]).slice(0, 3), render: id => cardEl(id) });
    if (id) await acquireCard(id);
  } else {
    teamHeal(.3);
    await say(null, '寶箱裡有回復藥！全隊回復了 HP。');
  }
}
async function openPickup() {
  sfx('pickup');
  const r = Math.random();
  if (r < .45) { const b = gainBits(randInt(10, 25)); toast(`💾 解析數據碎片：💰 ${b} 數碼幣`); }
  else if (r < .85) await addItem(pick(RANDOM_ITEMS));
  else if (r < .95) {
    const id = await pickScreen({ title: '💾 數據碎片裡藏著卡片的資料', sub: '選一張加入牌組', items: shuffle([...rewardPool()]).slice(0, 3), render: id => cardEl(id) });
    if (id) await acquireCard(id);
  } else if (relicPool().length) {
    const k = pick(relicPool()); RUN.relics.push(k);
    await say(null, `數據碎片解析出一個道具！獲得 <b>${RELICS[k].icon} ${RELICS[k].name}</b>：${RELICS[k].desc}`);
  } else { const b = gainBits(40); toast(`💾 解析數據碎片：💰 ${b} 數碼幣`); }
  updateHUD();
}
async function restSpot() {
  const amt = (has('purity') ? .7 : .4) + (NEW() ? K().springPlus : 0);   // 美美：回復泉 +15%
  const c = await ask(null, '清澈的回復泉閃閃發光。要怎麼休息呢？', [
    { text: `休息`, note: `全隊回復 ${Math.min(100, Math.round(amt * K().heal * 100))}% HP` },
    { text: '特訓', note: '強化一張卡片', disabled: !RUN.deck.some(canUpgrade) },
    { text: '冥想', note: '勇氣值 +30' },
    { text: '先不要', note: '待會再來' },
    ...(hasDark() ? [{ text: '💧 淨化黑暗', note: '丟掉 1 個黑暗徽章（不能回血）' }] : []),
  ]);
  if (c === 4) {   // 淨化黑暗：一個回復泉只能淨化 1 個
    const darks = RUN.relics.filter(k => RELICS[k].dark);
    const k = darks.length > 1 ? await pickScreen({ title: '💧 要淨化哪一個？', sub: '回復泉只能洗掉 1 個黑暗徽章', items: darks, render: k => relicEl(k), skip: '取消' }) : darks[0];
    if (!k) return false;
    RUN.relics = RUN.relics.filter(x => x !== k);
    await say(null, `泉水洗去了 ${RELICS[k].icon} ${RELICS[k].name} 的黑暗…夥伴的眼神清澈了起來。`);
    return true;
  }
  if (c === 0) { teamHeal(amt); toast('💗 全隊回復了！'); return true; }
  if (c === 1) { const x = await chooseCardFromDeck('選一張卡片強化', canUpgrade); if (!x) return false; RUN.deck[x.i] = x.id + '+'; toast(`「${cardDef(x.id + '+').name}」強化完成！`); return true; }
  if (c === 2) { gainCourage(30); toast('🔥 勇氣值 +30'); return true; }
  return false;
}
function recruitables() { return Object.keys(SPECIES).filter(k => SPECIES[k].evo && !SPECIES[k].starter); }
// 發光的數碼蛋能孵出的夥伴：孩子們的搭檔（已解鎖、不在隊伍裡）
const starterEggs = () => Object.keys(SPECIES).filter(k => SPECIES[k].starter && META.unlocked.includes(k) && !RUN.team.some(m => m.sp === k));
async function hatchEgg(star) {
  const avg = Math.max(1, Math.round(RUN.team.reduce((a, m) => a + m.level, 0) / RUN.team.length) - 1);
  const stars = star ? starterEggs() : [];
  await say(null, stars.length ? '✨ 發光的數碼蛋開始搖晃…裡面傳來熟悉的聲音！' : '數碼蛋開始搖晃…裂開了！');
  const opts = stars.length ? shuffle([pick(stars), pick(recruitables())]) : shuffle(recruitables()).slice(0, 2);
  const id = await pickScreen({ title: '🥚 從數碼蛋裡誕生了！', sub: `選一隻加入隊伍（Lv.${avg}）`, items: opts, allowSkip: false,
    render: id => { const s = SPECIES[id], el = document.createElement('div'); el.className = 'pickMon';
      el.innerHTML = `${spPic(id, 's110')}<b>${s.starter ? '✨ ' : ''}${s.name}</b><span>${ATTR_ICON[s.attr]} ${ATTR_NAME[s.attr]}</span><small>${s.desc}</small><small>${s.evo.map(e => e.name).join(' → ')}</small>`; return el; } });
  if (RUN.team.length >= teamMax()) {
    const m = await pickScreen({ title: '隊伍已經滿了！', sub: `要讓哪一隻夥伴離開，換 ${SPECIES[id].name} 加入？`, skip: `不換了（${SPECIES[id].name} 送你 💰 50 後離開）`,
      items: RUN.team.slice(), render: m => { const s = SPECIES[m.sp], el = document.createElement('div'); el.className = 'pickMon';
        el.innerHTML = `${spPic(m.sp, 's80')}<b>${s.name}</b><span>Lv.${m.level}</span>`; return el; } });
    if (!m) { gainBits(50); return; }
    RUN.team.splice(RUN.team.indexOf(m), 1);
    toast(`${SPECIES[m.sp].name} 回到了森林`);
  }
  RUN.team.push(newMember(id, avg)); preloadLine(id);
  toast(`${SPECIES[id].name} 加入了隊伍！`);
}
async function openShop(o) {
  if (!o.stock) {
    o.stock = {
      cards: [...shuffle([...rewardPool()]).slice(0, 2).map(id => ({ id, price: Math.round(randInt(40, 65) * K().shop), sold: false })),
              ...shuffle(shopPool()).slice(0, 2).map(id => ({ id, price: id === 'tagres' ? TAGRES_PRICE : Math.round(CARDS[id].shop * K().shop), sold: false }))],   // 後 2 張是商店限定卡
      relics: shuffle(relicPool()).slice(0, 2).map(k => ({ k, price: Math.round(randInt(110, 150) * K().shop), sold: false })),
      items: [...shuffle([...RANDOM_ITEMS]).slice(0, 3).map(k => ({ k, price: Math.round(randInt(28, 45) * K().shop), sold: false })),
              { k: 'scanner', price: Math.round(25 * K().shop), sold: false }],   // 數據掃描器：每間商店都有
      removed: false,
    };
    await say('monzaemon', '歡迎光臨～！玩偶獸的愛心商店，什麼都有喔！');
  }
  await new Promise(res => {
    const render = () => {
      saveRun();
      const s = o.stock, ov = $('#overlay'), upPrice = shopUpPrice(), upN = (RUN.shopUps || 0) + 1;
      const showUlt = RUN.chapter !== 1 && !has('ultboost');   // 究極強化：第二章以後才有
      ov.innerHTML = `<h2>🧸 玩偶獸的商店</h2><p class="sub">💰 你有 ${RUN.bits} 數碼幣</p>
        <div class="shopRow cards"></div><div class="shopRow relics"></div><div class="shopRow items"></div>
        <div class="shopRow svc">
          <button class="btn" id="svcSell" ${(s.soldN || 0) >= 2 || RUN.deck.length <= minDeck() ? 'disabled' : ''}>💰 出售卡片（${s.soldN || 0}/2）<small>${RUN.deck.length <= minDeck() ? `牌組要超過 ${minDeck()} 張才能賣` : '一般 15、強化 +10、限定卡半價'}</small></button>
          <button class="btn" id="svcUp" ${RUN.bits < upPrice || !RUN.deck.some(canUpgrade) ? 'disabled' : ''}>⬆️ 強化一張卡　💰${upPrice}<small>（第 ${upN} 次，每次 ×1.5）</small></button>
          ${showUlt ? `<button class="btn evo" id="svcUlt" ${RUN.bits < ultBoostPrice() ? 'disabled' : ''}>💠 究極強化：所有究極技 +25%　💰${ultBoostPrice()}</button>` : ''}
          <button class="btn" id="svcHeal" ${RUN.bits < 35 ? 'disabled' : ''}>💊 全隊回復 40%　💰35</button>
        </div>
        <button class="btn primary" id="shopLeave">離開商店</button>`;
      const cr = ov.querySelector('.cards'), rr = ov.querySelector('.relics');
      const atMax = id => CARDS[baseId(id)] && CARDS[baseId(id)].max && RUN.deck.filter(x => baseId(x) === baseId(id)).length >= CARDS[baseId(id)].max;
      s.cards.forEach(c => { if (c.sold) return; cr.appendChild(cardEl(c.id, { price: c.price, playable: RUN.bits >= c.price && !atMax(c.id), onClick: () => {
        if (atMax(c.id)) { toast(`「${cardDef(c.id).name}」整局最多 ${CARDS[baseId(c.id)].max} 張`); return; }
        if (RUN.bits < c.price) return;
        acquireCard(c.id).then(ok => { if (ok) { RUN.bits -= c.price; c.sold = true; } render(); }); } })); });
      s.relics.forEach(r => { if (r.sold) return; rr.appendChild(relicEl(r.k, { price: r.price, onClick: () => { if (RUN.bits < r.price) return; RUN.bits -= r.price; RUN.relics.push(r.k); r.sold = true; render(); } })); });
      s.items.forEach(it => { if (it.sold) return; const el = document.createElement('div'); el.className = 'relic clickable';
        el.innerHTML = `<div class="ri">${ITEMS[it.k].icon}</div><div><b>${ITEMS[it.k].name}</b><div class="rd">${ITEMS[it.k].desc}</div></div><div class="cnt price">💰 ${it.price}</div>`;
        el.onclick = async () => { if (RUN.bits < it.price) return; RUN.bits -= it.price; it.sold = true; await addItem(it.k); render(); };
        ov.querySelector('.items').appendChild(el); });
      // 出售卡片：每間店最多 2 張，牌組至少保留「上限 − 2」張
      ov.querySelector('#svcSell').onclick = async () => {
        const items = RUN.deck.map((id, i) => ({ id, i }));
        const x = await pickScreen({ title: '💰 選一張要出售的卡', sub: `賣掉之後牌組剩 ${RUN.deck.length - 1} 張（${deckSummary()}）`, items, render: x => cardEl(x.id, { price: sellPrice(x.id) }), skip: '取消' });
        if (x && RUN.deck.length > minDeck() && (s.soldN || 0) < 2) {
          const p = sellPrice(x.id); RUN.deck.splice(x.i, 1); RUN.bits += p; s.soldN = (s.soldN || 0) + 1;
          toast(`賣掉「${cardDef(x.id).name}」，獲得 💰 ${p}`);
        }
        render();
      };
      // 強化一張卡：可以一直買，但每次 ×1.5（整局累計）
      ov.querySelector('#svcUp').onclick = async () => {
        const x = await chooseCardFromDeck(`選一張卡片強化　💰${upPrice}`, canUpgrade);
        if (x && RUN.bits >= upPrice) {
          RUN.deck[x.i] = x.id + '+'; RUN.bits -= upPrice; RUN.shopUps = upN; sfx('levelup');
          toast(`「${cardDef(x.id + '+').name}」強化完成！下次強化 💰${shopUpPrice()}`, 3000);
        }
        render();
      };
      if (showUlt) ov.querySelector('#svcUlt').onclick = () => {
        if (RUN.bits < ultBoostPrice()) return;
        RUN.bits -= ultBoostPrice(); RUN.relics.push('ultboost'); sfx('levelup');
        toast('💠 究極強化！所有究極技的威力 +25%', 3000); render();
      };
      ov.querySelector('#svcHeal').onclick = () => { RUN.bits -= 35; teamHeal(.4); toast('全隊回復了！'); render(); };
      ov.querySelector('#shopLeave').onclick = () => { ov.classList.add('hidden'); res(); };
      ov.classList.remove('hidden');
      updateHUD();
    };
    render();
  });
}

// =========================================================
//   繪圖
// =========================================================
const cvs = $('#area'), ctx = cvs.getContext('2d');
// 數據碎片：藍綠色的 01 方塊，底下有一圈光（不閃爍）
function drawFragment(cx, cy, t) {
  ctx.save();
  ctx.fillStyle = `rgba(34,211,238,${.22 + Math.sin(t * 2) * .06})`; ctx.beginPath(); ctx.arc(cx, cy + 3, 15, 0, 7); ctx.fill();
  ctx.translate(cx, cy + 1 + Math.sin(t * 2.5) * 1.5); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#0e7490'; ctx.fillRect(-8, -8, 16, 16);
  ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2; ctx.strokeRect(-8, -8, 16, 16);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#ecfeff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('01', 0, 1);
  ctx.restore();
}
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const PALETTE = {
  grass:    { floor: '#e2cf9a', dot: '#cdb67c', grass: '#79bf5c', tuft: '#5a9f43', treeBg: '#5c9c4f', tree: '#2d6a35', treeHi: '#3f8f4a', water: '#3a86d4', wave: '#8cc4f2' },
  metal:    { floor: '#a3abbb', dot: '#8b93a3', grass: '#7f8899', tuft: '#666f80', treeBg: '#8b93a3', tree: '#4b5263', treeHi: '#6b7385', water: '#2b3a55', wave: '#5eead4', crate: true },
  forest:   { floor: '#6f8d55', dot: '#5c7746', grass: '#3f6e3b', tuft: '#2d5530', treeBg: '#4f7040', tree: '#1f4a2a', treeHi: '#2f6038', water: '#355f6e', wave: '#8ac2c9', fog: true },
  desert:   { floor: '#ecc985', dot: '#d9ad62', grass: '#e0b366', tuft: '#c08f46', treeBg: '#e0b870', tree: '#4f8a3a', treeHi: '#7dbb5a', water: '#38bdf8', wave: '#bae6fd', cactus: true },
  pyramid:  { floor: '#c9a66b', dot: '#b08c52', grass: '#b8955c', tuft: '#9c7a44', treeBg: '#6b4c26', tree: '#8a6634', treeHi: '#b08850', water: '#1e3a5f', wave: '#22d3ee', brick: true },
  tokyo:    { floor: '#3a3f52', dot: '#4a5068', grass: '#3f6e3b', tuft: '#2d5530', treeBg: '#1c1f2e', tree: '#2a2f45', treeHi: '#fde68a', water: '#1e3a5f', wave: '#7dd3fc', building: true, fogc: true },
  mountain: { floor: '#9a8a92', dot: '#837480', grass: '#7c6a80', tuft: '#665570', treeBg: '#8a7a84', tree: '#4a3d55', treeHi: '#5f5070', water: '#e0532a', wave: '#ffc078', lava: true },
};

function drawSprite(key, emoji, cx, cy, size, flip) {
  const r = loadImg(key);
  ctx.save(); ctx.translate(cx, cy); if (flip) ctx.scale(-1, 1);
  if (r.state === 'ok') {
    const im = r.canvas, w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
    const s = size / Math.max(w, h);
    ctx.drawImage(im, -w * s / 2, size / 2 - h * s, w * s, h * s);
  } else {
    ctx.font = `${size * .8}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 0, 0);
  }
  ctx.restore();
}
function emojiAt(e, x, y, size) { ctx.font = `${size}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }

function drawTile(x, y, c, t, P) {
  const px = x * TS, py = y * TS, h = hash(x, y);
  if (c === ',') {
    ctx.fillStyle = P.grass; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = P.tuft; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const gx = px + 5 + ((h >> (i * 4)) % 22), gy = py + 8 + ((h >> (i * 5 + 2)) % 18), sw = Math.sin(t * 2 + x + i) * 1.2;
      ctx.beginPath(); ctx.moveTo(gx - 3, gy - 6); ctx.lineTo(gx + sw, gy); ctx.lineTo(gx + 3 + sw, gy - 6); ctx.stroke();
    }
  } else if (c === 'T' || c === 'R') {
    ctx.fillStyle = P.treeBg; ctx.fillRect(px, py, TS, TS);
    if (P.building && c === 'T') {   // 東京：大樓（亮著燈的窗戶）
      ctx.fillStyle = P.tree; ctx.fillRect(px + 1, py + 1, TS - 2, TS - 2);
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++) { const on = (h >> (wx + wy * 3)) & 1;
        ctx.fillStyle = on ? `rgba(253,230,138,${.55 + Math.sin(t * .5 + wx + wy + x) * .1})` : '#11131d'; ctx.fillRect(px + 5 + wx * 8, py + 5 + wy * 8, 5, 5); }
    } else if (P.building) {   // 路邊的車
      ctx.fillStyle = ['#b91c1c', '#1d4ed8', '#e5e7eb', '#15803d'][h % 4]; ctx.fillRect(px + 4, py + 10, 24, 12); ctx.fillRect(px + 8, py + 6, 15, 6);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px + 9, py + 23, 3, 0, 7); ctx.arc(px + 23, py + 23, 3, 0, 7); ctx.fill();
    } else if (P.brick) {   // 金字塔：砂岩磚牆
      ctx.fillStyle = P.tree; const o = (y % 2) * 8;
      for (let r = 0; r < 2; r++) for (let k = -1; k < 2; k++) ctx.fillRect(px + k * 16 + (r ? o + 8 : o) % 16 + 1, py + r * 16 + 1, 14, 14);
      ctx.fillStyle = P.treeHi; ctx.fillRect(px, py, TS, 2);
      if (h % 23 === 0) { ctx.fillStyle = `rgba(34,211,238,${.35 + Math.sin(t * 2 + x) * .25})`; ctx.fillRect(px + 6, py + 14, 20, 2); ctx.fillRect(px + 15, py + 8, 2, 14); }
    } else if (P.crate) {
      ctx.fillStyle = P.tree; ctx.fillRect(px + 3, py + 3, 26, 26);
      ctx.strokeStyle = P.treeHi; ctx.lineWidth = 2; ctx.strokeRect(px + 6, py + 6, 20, 20);
      ctx.beginPath(); ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + 26, py + 26); ctx.stroke();
    } else if (P.cactus && c === 'T') {   // 沙漠：仙人掌
      ctx.fillStyle = P.tree; ctx.fillRect(px + 13, py + 5, 7, 24); ctx.fillRect(px + 6, py + 12, 4, 9); ctx.fillRect(px + 6, py + 18, 9, 4); ctx.fillRect(px + 23, py + 9, 4, 9); ctx.fillRect(px + 18, py + 15, 9, 4);
      ctx.fillStyle = P.treeHi; ctx.fillRect(px + 14, py + 6, 2, 22);
    } else if (c === 'R' || P.lava) {
      ctx.fillStyle = P.tree; ctx.beginPath(); ctx.moveTo(px + 4, py + 28); ctx.lineTo(px + 12, py + 6); ctx.lineTo(px + 22, py + 10); ctx.lineTo(px + 29, py + 28); ctx.fill();
      ctx.fillStyle = P.treeHi; ctx.beginPath(); ctx.moveTo(px + 12, py + 6); ctx.lineTo(px + 16, py + 16); ctx.lineTo(px + 9, py + 20); ctx.fill();
    } else {
      ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 13, py + 20, 6, 10);
      ctx.fillStyle = P.tree; ctx.beginPath(); ctx.arc(px + 16, py + 14, 12, 0, 7); ctx.fill();
      ctx.fillStyle = P.treeHi; ctx.beginPath(); ctx.arc(px + 12, py + 10, 5, 0, 7); ctx.fill();
    }
  } else if (c === '~') {
    ctx.fillStyle = P.water; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = P.wave; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const wy = py + 10 + i * 12, off = Math.sin(t * 2 + x * .8 + y + i) * 4;
      ctx.beginPath(); ctx.moveTo(px + 6 + off, wy); ctx.quadraticCurveTo(px + 12 + off, wy - 4, px + 18 + off, wy); ctx.stroke();
    }
  } else {
    ctx.fillStyle = P.floor; ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = P.dot;
    if (P.crate) { ctx.fillRect(px, py, TS, 1); ctx.fillRect(px, py, 1, TS); }
    else ctx.fillRect(px + (h % 26) + 2, py + ((h >> 5) % 26) + 2, 3, 3);
  }
}

// ---------- 鏡頭：手機直向時只顯示一部分地圖，跟著角色捲動 ----------
const CAM = { cols: COLS, x: 0 };
function layoutArea() {
  const compact = matchMedia('(max-width:900px),(max-height:600px)').matches;
  const touch = matchMedia('(pointer:coarse)').matches;
  const portrait = innerHeight > innerWidth;
  const availW = innerWidth - (compact ? 12 : 320) - (touch && !portrait ? 170 : 0);
  const availH = innerHeight - (compact ? 64 : 60) - (touch && portrait ? 190 : 0);
  CAM.cols = compact ? clamp(Math.round(ROWS * availW / availH), 10, COLS) : COLS;   // 電腦版顯示整張地圖
  const cw = CAM.cols * TS, ch = ROWS * TS;
  if (cvs.width !== cw) cvs.width = cw;
  const sc = Math.min(availW / cw, availH / ch);
  cvs.style.width = Math.floor(cw * sc) + 'px';
  cvs.style.height = Math.floor(ch * sc) + 'px';
}
addEventListener('resize', layoutArea);
addEventListener('orientationchange', () => setTimeout(layoutArea, 200));

function drawArea(t) {
  const A = AREA, P = PALETTE[A.theme];
  // 鏡頭跟著主角（地圖比畫面寬時才需要）
  const pmx = A.mv.moving ? A.mv.fromX + (A.mv.toX - A.mv.fromX) * A.mv.t : A.x;
  CAM.x = clamp(pmx * TS + 16 - cvs.width / 2, 0, COLS * TS - cvs.width);
  ctx.setTransform(1, 0, 0, 1, -Math.round(CAM.x), 0);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(x, y, A.T[y][x], t, P);
  // 出口
  const ex = A.exit.x * TS + 16, ey = A.exit.y * TS + 16, locked = exitLocked();
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(t * (locked ? .5 : 2));
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = locked ? '#777' : ['#60a5fa', '#a78bfa', '#f0abfc'][i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 14 - i * 4, i, i + 4.2); ctx.stroke(); }
  ctx.restore();
  if (locked) emojiAt('🔒', ex, ey, 14);
  const m = A.mv;
  let rx = A.x, ry = A.y;
  if (m.moving) { rx = m.fromX + (m.toX - m.fromX) * m.t; ry = m.fromY + (m.toY - m.fromY) * m.t; }
  const R = sightR(), inSight = (x, y) => Math.hypot(x - rx, y - ry) <= R;
  // 物件：敵人要在視野內才看得到；寶箱、NPC 這些看過一次就會記住
  for (const o of A.objs) {
    if (o.done) continue;
    if (o.kind === 'enemy' || (o.kind === 'pickup' && !o.show) ? !inSight(o.x, o.y) : !A.seen[o.y * COLS + o.x]) continue;   // 敵人、數據碎片：要在視野內才看得到
    const cx = o.x * TS + 16, cy = o.y * TS + 14, bob = Math.sin(t * 3 + o.x) * 1.5;
    if (o.kind === 'enemy') {
      if (o.role === 'elite' || o.role === 'boss') {
        ctx.fillStyle = o.role === 'boss' ? `rgba(220,0,60,${.35 + Math.sin(t * 4) * .15})` : `rgba(140,0,200,${.35 + Math.sin(t * 4) * .15})`;
        ctx.beginPath(); ctx.arc(cx, cy + 2, o.role === 'boss' ? 22 : 18, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 15, 10, 4, 0, 0, 7); ctx.fill();
      const sp = SPECIES[o.sp];
      drawSprite(sp.img, sp.emoji, cx, cy + bob, o.role === 'boss' ? 46 : o.role === 'elite' ? 40 : 34, false);
      if (o.role === 'guard') emojiAt('❗', cx + 12, cy - 16, 12);
    } else if (o.kind === 'npc' || o.kind === 'shop') {
      const sp = SPECIES[o.sp];
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy + 2, 18, 0, 7); ctx.fill();
      drawSprite(sp.img, sp.emoji, cx, cy + bob, 36, false);
      emojiAt(o.kind === 'shop' ? '🛒' : '💬', cx + 13, cy - 16 + bob, 14);
    } else if (o.kind === 'chest') {
      emojiAt(o.rich ? '💎' : '🎁', cx, cy + 2 + bob, 24);
    } else if (o.kind === 'spring') {
      const pulse = 1 + Math.sin(t * 3) * .08;
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(cx, cy + 2, 14 * pulse, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✚', cx, cy + 3);
    } else if (o.kind === 'egg') {
      if (o.star) { ctx.fillStyle = `rgba(253,224,71,${.35 + Math.sin(t * 4) * .15})`; ctx.beginPath(); ctx.arc(cx, cy + 2, 18, 0, 7); ctx.fill(); emojiAt('✨', cx + 12, cy - 12, 12); }   // 發光的數碼蛋：孩子們的夥伴
      emojiAt('🥚', cx + Math.sin(t * 8) * 1.5, cy + 2, 26);
    } else if (o.kind === 'pickup') {
      drawFragment(cx, cy, t + o.x);
    } else if (o.kind === 'stone') {
      ctx.fillStyle = `rgba(253,224,71,${.25 + Math.sin(t * 3) * .12})`; ctx.beginPath(); ctx.arc(cx, cy + 2, 17, 0, 7); ctx.fill();
      emojiAt('🗿', cx, cy + 2, 26);
    } else drawCh5Obj(o, cx, cy, t);
  }
  // 點擊的目標
  if (A.tapMark && A.path && A.path.length) {
    const k = (performance.now() - A.tapMark.t) / 1000;
    ctx.strokeStyle = `rgba(253,224,71,${.9 - (k % 1) * .6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(A.tapMark.x * TS + 16, A.tapMark.y * TS + 16, 8 + (k % 1) * 8, 0, 7); ctx.stroke();
  }
  // 主角
  const cx = rx * TS + 16, cy = ry * TS + 14, bob = m.moving ? Math.abs(Math.sin(m.t * Math.PI)) * -4 : Math.sin(t * 3);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 15, 11, 4, 0, 0, 7); ctx.fill();
  const lead = SPECIES[RUN.team[0].sp];
  drawSprite(lead.img, lead.emoji, cx, cy + bob, 36, A.facing > 0);
  if (P.fogc) { ctx.fillStyle = `rgba(120,60,160,${.16 + Math.sin(t * .6) * .05})`; ctx.fillRect(0, 0, COLS * TS, ROWS * TS); }   // 吸血魔獸的紫色迷霧
  if (P.fog) { ctx.fillStyle = `rgba(230,240,235,${.13 + Math.sin(t * .7) * .04})`; ctx.fillRect(0, 0, COLS * TS, ROWS * TS); }
  // 迷霧：沒去過＝全黑，去過＝昏暗，視野內＝清楚（邊緣漸層）
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const d = Math.hypot(x - rx, y - ry), base = A.seen[y * COLS + x] ? .58 : .97;
    const a = d <= R - 1.2 ? 0 : d <= R ? base * (d - (R - 1.2)) / 1.2 : base;
    if (a > 0) { ctx.fillStyle = `rgba(6,8,22,${a})`; ctx.fillRect(x * TS, y * TS, TS, TS); }
  }
  drawCh5Overlay(A, rx, ry, t);
  // 用過數據掃描器：還沒撿的碎片在迷霧裡也會標出位置
  if (A.scanned) for (const o of A.objs) {
    if (o.kind !== 'pickup' || o.done || inSight(o.x, o.y)) continue;
    const px = o.x * TS + 16, py = o.y * TS + 16, k = (t * .8 + o.x * .3) % 1;
    ctx.strokeStyle = `rgba(34,211,238,${.9 - k * .7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 5 + k * 9, 0, 7); ctx.stroke();
    ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 5, py); ctx.fill();
  }
  // 出口光柱：從遠處就看得到方向
  const beam = ctx.createLinearGradient(0, 0, 0, ey);
  beam.addColorStop(0, 'rgba(147,197,253,0)');
  beam.addColorStop(1, locked ? 'rgba(160,160,170,.45)' : `rgba(147,197,253,${.5 + Math.sin(t * 3) * .15})`);
  ctx.fillStyle = beam; ctx.fillRect(ex - 7, 0, 14, ey);
  if (!inSight(A.exit.x, A.exit.y)) {
    ctx.fillStyle = locked ? 'rgba(160,160,170,.6)' : `rgba(147,197,253,${.6 + Math.sin(t * 3) * .2})`;
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, 7); ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCrestRadar(A, rx, ry, t);
  // 出口在畫面外：在邊緣畫一個指向出口的箭頭
  const exs = ex - CAM.x;
  if (exs > cvs.width - 4 || exs < 4) {
    const right = exs > 0, ax = right ? cvs.width - 18 : 18, pulse = Math.sin(t * 5) * 3;
    ctx.fillStyle = locked ? 'rgba(160,160,170,.9)' : 'rgba(147,197,253,.95)';
    ctx.beginPath();
    if (right) { ctx.moveTo(ax + 12 + pulse, ey); ctx.lineTo(ax - 4 + pulse, ey - 12); ctx.lineTo(ax - 4 + pulse, ey + 12); }
    else { ctx.moveTo(ax - 12 - pulse, ey); ctx.lineTo(ax + 4 - pulse, ey - 12); ctx.lineTo(ax + 4 - pulse, ey + 12); }
    ctx.fill();
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('出口', ax, ey + 26);
  }
  if (G.mode === 'transition') {
    ctx.fillStyle = Math.floor(G.trans.t * 12) % 2 ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
  }
}
