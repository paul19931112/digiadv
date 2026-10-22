'use strict';
// =========================================================
//   省電（v15.1）：畫面最多每秒重畫 30 次；地圖上沒在動的時候 10 次；省電模式 20 次、沒有粒子、解析度 1 倍
// =========================================================
const POWER = { save: false, act: 0, last: {} };
try { POWER.save = localStorage.getItem('digimon-power') === 'on'; } catch (e) { }
POWER.fps = () => POWER.save ? 20 : 30;
// 這一幀要不要畫（每個迴圈各自計時）
POWER.gate = (key, now, fps) => { if (now - (POWER.last[key] || 0) < 1000 / fps - 2) return false; POWER.last[key] = now; return true; };
POWER.toggle = () => { POWER.save = !POWER.save; try { localStorage.setItem('digimon-power', POWER.save ? 'on' : 'off'); } catch (e) { } if (typeof Scene !== 'undefined' && Scene.cv) Scene.resize(); };
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => POWER.act = performance.now(), { capture: true }));
/* =========================================================
   圖片載入 + 共用介面工具
   ========================================================= */

const IMG = {};
const IMG_REMOTE = k => `https://digi-api.com/images/digimon/w/${k}.png`;
function loadImg(key) {
  if (IMG[key]) return IMG[key];
  const rec = IMG[key] = { state: 'loading' };
  const finish = (im, process) => {
    let out = im, url = im.src;
    if (process) { try { out = removeWhiteBg(im); url = out.toDataURL(); } catch (e) { out = im; url = im.src; } }
    Object.assign(rec, { state: 'ok', canvas: out, url });
    document.querySelectorAll(`.dpic[data-k="${key}"]`).forEach(el => { el.querySelector('img').src = url; el.classList.add('ok'); });
  };
  const attempt = (src, cors, process, next) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => finish(im, process);
    im.onerror = next;
    im.src = src;
  };
  // images/ 資料夾的圖已經去背過，直接用；找不到才去網路抓並即時去背
  attempt(`images/${key}.png`, false, false,
    () => attempt(IMG_REMOTE(key), true, true, () => { rec.state = 'fail'; }));
  return rec;
}
function removeWhiteBg(im) {
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  const white = i => d[i] > 228 && d[i + 1] > 228 && d[i + 2] > 228;
  const seen = new Uint8Array(w * h), stack = [];
  for (let i = 0; i < w; i++) stack.push(i, (h - 1) * w + i);
  for (let j = 0; j < h; j++) stack.push(j * w, j * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue; seen[p] = 1;
    if (!white(p * 4)) continue;
    d[p * 4 + 3] = 0;
    const px = p % w, py = (p / w) | 0;
    if (px > 0) stack.push(p - 1); if (px < w - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - w); if (py < h - 1) stack.push(p + w);
  }
  x.putImageData(id, 0, 0);
  return c;
}
function dpic(key, emoji, cls = '') {
  const r = loadImg(key), ok = r.state === 'ok';
  return `<span class="dpic ${cls}${ok ? ' ok' : ''}" data-k="${key}"><img src="${ok ? r.url : ''}" alt=""><em>${emoji}</em></span>`;
}
const spPic = (id, cls) => dpic(SPECIES[id].img, SPECIES[id].emoji, cls);
function preloadLine(id) { const sp = SPECIES[id]; loadImg(sp.img); (sp.evo || []).forEach(e => loadImg(e.img)); }

function cardEl(id, { playable = true, key, onClick, isStatic = false, count, price, keep, pin, onPin, cost, marks, fog } = {}) {
  const d = cardDef(id);
  const el = document.createElement('div');
  const cst = cost ?? d.cost;
  el.className = `card ${d.type}${playable ? '' : ' disabled'}${isStatic ? ' static' : ''}${d.u ? ' up' : ''}${d.shop ? ' limited' : ''}${fog ? ' fogged' : ''}`;
  el.innerHTML = `<div class="cost${cst > d.cost ? ' plus' : ''}">${cst}</div><div class="ctype">${d.type === 'ult' ? '' : CAT_INFO[cardCat(id)].icon + ' '}${TYPE_NAME[d.type]}</div>
    ${fog ? '<div class="cname">？？？</div><div class="cdesc">🌫️ 被迷霧籠罩<br>看不清楚效果</div>' : `<div class="cname">${d.name}</div><div class="cdesc">${d.desc()}</div>`}
    ${d.shop ? '<div class="limTag">🧸 限定</div>' : ''}${marks ? `<div class="cmarks">${marks}</div>` : ''}
    ${keep ? '<div class="keepTag">📌 保留</div>' : ''}${key ? `<div class="ckey">${key}</div>` : ''}${count ? `<div class="cnt">×${count}</div>` : ''}${price != null ? `<div class="cnt price">💰 ${price}</div>` : ''}`;
  if (pin !== undefined) {   // 📌 圖釘：釘住的牌回合結束時會保留
    el.classList.toggle('pinned', pin);
    const pb = document.createElement('button');
    pb.className = 'pinBtn' + (pin ? ' on' : '');
    pb.textContent = '📌'; pb.title = pin ? '取消保留' : `保留到下回合（最多 ${PIN_MAX} 張）`;
    pb.addEventListener('click', e => { e.stopPropagation(); onPin && onPin(); });
    el.appendChild(pb);
  }
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
// HUD／戰鬥畫面上的徽章小圖示（神聖計畫可以點開究極之證的謎語）
function relicIcon(k) {
  const r = RELICS[k], rid = k === 'digivice';
  return `<span class="hr${rid ? ' riddle' : ''}" ${rid ? 'data-riddle="1"' : ''} title="${r.name}：${r.desc}${rid ? '（點一下看謎語）' : ''}">${r.icon}</span>`;
}
function showRiddle() {
  let b = $('#riddleBox');
  if (!b) { b = document.createElement('div'); b.id = 'riddleBox'; document.body.appendChild(b); }
  b.innerHTML = `<div class="nBox"><h3>📟 神聖計畫上浮現了文字…</h3><div class="riddle">${PROOF_RIDDLE}</div>` +
    `<div class="nFoot">（之後點徽章欄的 📟 可以再看一次）</div><button class="btn primary">關閉</button></div>`;
  b.classList.remove('hidden'); sfx('open');
  b.querySelector('button').onclick = () => { b.classList.add('hidden'); sfx('close'); };
}
document.addEventListener('click', e => { if (e.target.closest('[data-riddle]')) { e.stopPropagation(); showRiddle(); } });
// 手機沒有滑鼠移上去的提示：點道具圖示、標籤就在最上層跳出說明（幾秒後自己消失）
document.addEventListener('click', e => { const t = e.target.closest('.hr[title]:not([data-riddle]), .tierTag[title]'); if (t) toast(t.title, 3500); });
function relicEl(k, { onClick, price } = {}) {
  const r = RELICS[k];
  const el = document.createElement('div');
  el.className = 'relic' + (r.dark ? ' dark' : '') + (onClick ? ' clickable' : '');
  el.innerHTML = `<div class="ri">${r.icon}</div><div><b>${r.name}</b><div class="rd">${r.desc}</div></div>${price != null ? `<div class="cnt price">💰 ${price}</div>` : ''}`;
  if (onClick) el.onclick = onClick;
  return el;
}

function restartAnim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function banner(text) { if (text.includes('你的回合')) sfx('turn'); const b = $('#banner'); b.textContent = text; restartAnim(b, 'show'); }
let toastT;
function toast(msg, ms = 2500) {
  const t = $('#toast'); t.innerHTML = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
function showScreen(id) {
  if (id !== showScreen.cur && ['#title', '#kidSelect', '#select', '#routeScreen', '#reward'].includes(id)) sfx('open');
  showScreen.cur = id;
  ['#title', '#kidSelect', '#select', '#routeScreen', '#areaScreen', '#battle', '#reward', '#overlay'].forEach(s => $(s).classList.toggle('hidden', s !== id));
  if (id === '#areaScreen' && typeof layoutArea === 'function') setTimeout(layoutArea, 0);
}

// ---------- 通用「選一個」畫面（卡片、徽章、數碼寶貝） ----------
function pickScreen({ title, sub = '', items, render, skip = '跳過', allowSkip = true }) {
  return new Promise(res => {
    const o = $('#overlay');
    o.innerHTML = `<h2>${title}</h2><p class="sub">${sub}</p><div class="pickList"></div>${allowSkip ? `<button class="btn" id="pkSkip">${skip}</button>` : ''}`;
    const list = o.querySelector('.pickList');
    items.forEach((it, i) => { const el = render(it, i); el.addEventListener('click', () => { o.classList.add('hidden'); res(it); }); list.appendChild(el); });
    if (allowSkip) o.querySelector('#pkSkip').onclick = () => { o.classList.add('hidden'); res(null); };
    o.classList.remove('hidden');
    sfx('open');
  });
}
function chooseCardFromDeck(title, filter = () => true, skip = '取消') {
  const items = RUN.deck.map((id, i) => ({ id, i })).filter(x => filter(x.id));
  return pickScreen({ title, items, render: x => cardEl(x.id), skip });
}

// =========================================================
//   對話系統：await say(...) / await ask(...)
// =========================================================
const DLG = { resolve: null };
function dlgShow(img, emoji, name, text, choices) {
  sfx('dialog');
  const d = $('#dialog');
  d.innerHTML = `<div class="dportrait">${img ? dpic(img, emoji, 's110') : ''}</div>
    <div class="dbody"><div class="dname">${name || ''}</div><div class="dtext">${text}</div>
    <div class="dchoices"></div>${choices ? '' : '<div class="dnext">▼ 點一下或按空白鍵繼續</div>'}</div>`;
  d.classList.remove('hidden');
  G.dialog = true;
  return new Promise(res => {
    if (choices) {
      const box = d.querySelector('.dchoices');
      choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'btn choice';
        b.disabled = !!c.disabled;
        b.innerHTML = `<span class="ck">${i + 1}</span>${c.text}${c.note ? `<small>${c.note}</small>` : ''}`;
        b.onclick = e => { e.stopPropagation(); finish(i); };
        box.appendChild(b);
      });
    } else {
      d.onclick = () => finish(0);
    }
    const finish = i => { d.onclick = null; DLG.resolve = null; d.classList.add('hidden'); G.dialog = false; res(i); };
    DLG.resolve = finish;
    DLG.choices = choices;
  });
}
// who：數碼寶貝 id（SPECIES 的 key）、'me'（主角）、或 null（旁白）
function who(w) {
  if (!w) return [null, '', ''];
  if (w === 'me') return [null, '', RUN && KIDS[RUN.kid] ? KIDS[RUN.kid].name : '我'];
  if (w === 'partner') { const sp = SPECIES[RUN.team[0].sp]; return [sp.img, sp.emoji, sp.name]; }
  const sp = SPECIES[w]; return [sp.img, sp.emoji, sp.name];
}
async function say(w, text) { const [img, emo, name] = who(w); await dlgShow(img, emo, name, text, null); }
async function ask(w, text, choices) { const [img, emo, name] = who(w); return dlgShow(img, emo, name, text, choices); }
