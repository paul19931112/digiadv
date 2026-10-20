'use strict';
/* =========================================================
   劇情插畫：每一幕是一整張會動的插畫（程式畫的背景＋數碼寶貝的圖），下面是對話框
   用法：await cutscene([{ bg, music, amb, chars, fx, lines }, ...])
     bg：PAINT 裡的背景　music：BGM 曲名（null＝停）　amb：環境音 waves / wind / drone / fire / crowd
     chars：[[圖或 'partner', x%, 腳底 y%, 身高 vh, 特效 class], ...]
     lines：[[說話者, 台詞], ...]，說話者：null＝旁白、'me'＝主角、'partner'＝夥伴、SPECIES 的 key、或 { img, name }
   孩子沒有人物圖，用代表道具的小徽章表示
   ========================================================= */
const KID_ITEM = { taichi: ['🥽', '#fdba74'], yamato: ['🎵', '#93c5fd'], sora: ['🧢', '#fca5a5'], koushiro: ['💻', '#d8b4fe'],
                   mimi: ['👒', '#86efac'], jou: ['👓', '#cbd5e1'], takeru: ['🎩', '#fde047'], hikari: ['📷', '#f9a8d4'] };

// ---------- 背景畫布 ----------
function cutCloud(g, x, y, s) { g.beginPath(); g.ellipse(x, y, s, s * .28, 0, 0, 7); g.ellipse(x + s * .5, y - s * .12, s * .55, s * .3, 0, 0, 7); g.ellipse(x - s * .45, y + s * .02, s * .5, s * .22, 0, 0, 7); g.fill(); }
const cutGrad = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; };
const cutGlow = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, g.canvas.width, g.canvas.height); };
function cutHills(g, W, H, base, amp, col, seed, t = 0, sway = 0) {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H * base + Math.sin(x / (W * .16) + seed) * H * amp + Math.sin(x / (W * .05) + seed * 3) * H * amp * .3 + Math.sin(x / 40 + t * 2) * sway);
  g.lineTo(W, H); g.fill();
}
const PAINT = {
  aurora(g, W, H, t) {   // 夏夜的極光
    g.fillStyle = cutGrad(g, 0, H, ['#020617', '#0f172a', '#1e1b4b']); g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; for (let i = 0; i < 80; i++) { g.globalAlpha = .4 + .4 * Math.sin(t * 2 + i); g.fillRect((Math.sin(i * 51.7) * .5 + .5) * W, (Math.cos(i * 23.1) * .5 + .5) * H * .6, 1.5, 1.5); } g.globalAlpha = 1;
    g.save(); g.globalCompositeOperation = 'screen';
    [['#22d3ee', .18], ['#a78bfa', .26], ['#4ade80', .34]].forEach(([c, y], k) => {
      g.strokeStyle = c + '55'; g.lineWidth = H * .06;
      g.beginPath(); for (let x = -20; x <= W + 20; x += 12) g.lineTo(x, H * y + Math.sin(x / (W * .2) + t * .5 + k) * H * .05); g.stroke();
    });
    g.restore();
    cutHills(g, W, H, .78, .03, '#0b1020', 1); cutHills(g, W, H, .86, .02, '#05070f', 4);
  },
  island(g, W, H, t) {   // 晴朗的檔案島：海、遠山、草地
    g.fillStyle = cutGrad(g, 0, H * .6, ['#38bdf8', '#bae6fd']); g.fillRect(0, 0, W, H);
    cutGlow(g, W * .8, H * .12, H * .3, [[0, '#fff'], [.15, '#fef9c3'], [1, '#fff0']]);
    g.fillStyle = '#ffffffcc'; for (let i = 0; i < 4; i++) cutCloud(g, ((i * .3 + t * .005) % 1.3 - .15) * W, H * (.1 + i * .07), W * .1);
    g.fillStyle = '#0ea5e9'; g.fillRect(0, H * .5, W, H * .1);
    cutHills(g, W, H, .5, .05, '#4d7c0f', 2); cutHills(g, W, H, .62, .03, '#65a30d', 5); cutHills(g, W, H, .74, .02, '#84cc16', 8, t, 1);
  },
  volcano(g, W, H, t) {   // 火山：紅色天空、熔岩、火星
    g.fillStyle = cutGrad(g, 0, H, ['#450a0a', '#991b1b', '#ea580c']); g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c1917'; g.beginPath(); g.moveTo(W * .1, H * .7); g.lineTo(W * .42, H * .22); g.lineTo(W * .58, H * .22); g.lineTo(W * .9, H * .7); g.fill();
    cutGlow(g, W * .5, H * .22, H * .25, [[0, '#fde047cc'], [.4, '#f9731655'], [1, '#0000']]);
    cutHills(g, W, H, .72, .02, '#292524', 3); cutHills(g, W, H, .84, .015, '#7c2d12', 6, t, 2);
    g.fillStyle = '#fdba74'; for (let i = 0; i < 40; i++) { const p = (t * .15 + i * .137) % 1; g.globalAlpha = 1 - p; g.fillRect((Math.sin(i * 7.3) * .5 + .5) * W + Math.sin(t + i) * 10, H * (.9 - p * .8), 2.5, 2.5); } g.globalAlpha = 1;
  },
  city(g, W, H, t) {   // 齒輪城市：灰藍色的機械剪影
    g.fillStyle = cutGrad(g, 0, H, ['#0f172a', '#334155', '#64748b']); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { const w = W * (.07 + (i % 3) * .03), x = (i / 9) * W, h = H * (.25 + (Math.sin(i * 3.1) * .5 + .5) * .3);
      g.fillStyle = i % 2 ? '#1e293b' : '#273449'; g.fillRect(x, H * .72 - h, w, h);
      g.fillStyle = '#fbbf2499'; for (let y = H * .72 - h + 8; y < H * .7; y += 14) if (Math.sin(i * 9 + y) > .2) g.fillRect(x + 6, y, 5, 5); }
    [[.2, .3, .09, 1], [.78, .25, .12, -1]].forEach(([x, y, r, d]) => { g.save(); g.translate(W * x, H * y); g.rotate(t * .4 * d); g.strokeStyle = '#94a3b855'; g.lineWidth = W * .015;
      g.beginPath(); g.arc(0, 0, W * r, 0, 7); g.stroke(); for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.fillStyle = '#94a3b855'; g.fillRect(W * r - 4, -6, 16, 12); } g.restore(); });
    g.fillStyle = '#111827'; g.fillRect(0, H * .72, W, H);
  },
  forest(g, W, H, t) {   // 迷霧森林：一層層的樹影和霧
    g.fillStyle = cutGrad(g, 0, H, ['#052e16', '#14532d', '#1a2e05']); g.fillRect(0, 0, W, H);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 9; i++) { const x = ((i + l * .37) / 9) * W, w = W * (.04 + l * .02);
      g.fillStyle = ['#0f2a12', '#0a1f0c', '#051207'][l]; g.fillRect(x, 0, w, H);
      g.beginPath(); g.ellipse(x + w / 2, H * (.15 + l * .05), w * 2.4, H * .12, 0, 0, 7); g.fill(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#d1fae51a'; g.beginPath(); g.ellipse(((i * .23 + t * .01) % 1.3 - .15) * W, H * (.55 + i * .08), W * .4, H * .06, 0, 0, 7); g.fill(); }
  },
  castle(g, W, H, t) {   // 無限山頂的城堡：暗紅天空、閃電
    g.fillStyle = cutGrad(g, 0, H, ['#0c0a09', '#3b0764', '#7f1d1d']); g.fillRect(0, 0, W, H);
    if (Math.sin(t * 1.7) > .97) { g.fillStyle = '#e9d5ff55'; g.fillRect(0, 0, W, H); }
    g.fillStyle = '#0c0a09'; g.beginPath(); g.moveTo(0, H * .8); g.lineTo(W * .5, H * .3); g.lineTo(W, H * .8); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillRect(W * .44, H * .2, W * .12, H * .14); g.fillRect(W * .4, H * .14, W * .04, H * .2); g.fillRect(W * .56, H * .14, W * .04, H * .2);
    g.fillStyle = '#ef4444'; g.globalAlpha = .6 + .4 * Math.sin(t * 3); g.fillRect(W * .485, H * .25, W * .03, H * .03); g.globalAlpha = 1;
  },
  light(g, W, H, t) {   // 光明結局：金色晨光
    g.fillStyle = cutGrad(g, 0, H, ['#fef3c7', '#fde68a', '#fb923c']); g.fillRect(0, 0, W, H);
    cutGlow(g, W * .5, H * .45, Math.max(W, H) * .6, [[0, '#fff'], [.3, '#fff7d6aa'], [1, '#fff0']]);
    g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const p = (t * .08 + i * .113) % 1; g.globalAlpha = Math.sin(p * Math.PI); g.beginPath(); g.arc((Math.sin(i * 5.1) * .5 + .5) * W, H * (1 - p), 2.5, 0, 7); g.fill(); } g.globalAlpha = 1;
  },
  sea(g, W, H, t) {   // 清晨的海
    g.fillStyle = cutGrad(g, 0, H * .55, ['#1e3a8a', '#f472b6', '#fdba74']); g.fillRect(0, 0, W, H);
    cutGlow(g, W * .72, H * .42, H * .5, [[0, '#fff7d6'], [.12, '#fde68a'], [.4, '#fb923c55'], [1, '#0000']]);
    g.fillStyle = '#fff6'; for (let i = 0; i < 5; i++) cutCloud(g, ((i * .27 + t * .006) % 1.3 - .15) * W, H * (.12 + i * .06), W * .12);
    for (let l = 0; l < 5; l++) { const y0 = H * (.55 + l * .1), wy = x => y0 + Math.sin(x / (60 + l * 20) + t * (1 + l * .4)) * (4 + l * 3);
      g.fillStyle = ['#1d4ed8', '#1e40af', '#1e3a8a', '#172554', '#0b1437'][l]; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, wy(x)); g.lineTo(W, H); g.fill(); }
  },
  burst(g, W, H) {   // 熱血特寫
    cutGlow(g, W / 2, H * .5, Math.max(W, H) * .7, [[0, '#fff7d6'], [.25, '#fbbf24'], [.6, '#ea580c'], [1, '#7c2d12']]);
  },
  stage(g, W, H, t) {   // 陰暗的舞台＋聚光燈
    g.fillStyle = '#0b0414'; g.fillRect(0, 0, W, H);
    for (const [x, c] of [[.3, '#a855f7'], [.7, '#ec4899']]) { const sway = Math.sin(t * .8 + x * 9) * W * .05; g.save(); g.globalCompositeOperation = 'screen';
      g.fillStyle = cutGrad(g, 0, H, [c + 'aa', c + '00']); g.beginPath(); g.moveTo(W * x + sway, 0); g.lineTo(W * .25, H * .95); g.lineTo(W * .75, H * .95); g.fill(); g.restore(); }
  },
  void(g, W, H, t) {   // 黑暗紫霧
    g.fillStyle = '#05010a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) cutGlow(g, W * (.5 + .45 * Math.sin(t * .2 + i * 1.7)), H * (.5 + .35 * Math.cos(t * .17 + i * 2.3)), W * .5, [[0, '#4c1d9533'], [1, '#0000']]);
  },
};

// ---------- 環境音 ----------
const AMB = (() => {
  let stopCur = null;
  const noiseSrc = (ctx, buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = .9 + Math.random() * .2; return s; };
  const lfo = (ctx, rate, depth, target, base) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(target); target.value = base; o.start(); return o; };
  const filtered = (ctx, out, buf, type, fq, gain, q = 1) => { const n = noiseSrc(ctx, buf), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = type; f.frequency.value = fq; f.Q.value = q; g.gain.value = gain; n.connect(f); f.connect(g); g.connect(out); n.start(); return { n, f, g }; };
  const KINDS = {
    waves(ctx, out, buf) { const a = filtered(ctx, out, buf, 'lowpass', 500, 0), b = filtered(ctx, out, buf, 'highpass', 2400, 0);
      return [a.n, b.n, lfo(ctx, .12, .22, a.g.gain, .23), lfo(ctx, .09, .07, b.g.gain, .075)]; },
    wind(ctx, out, buf) { const a = filtered(ctx, out, buf, 'bandpass', 650, .16, 2.5); return [a.n, lfo(ctx, .07, 350, a.f.frequency, 650), lfo(ctx, .11, .08, a.g.gain, .14)]; },
    fire(ctx, out, buf) { const a = filtered(ctx, out, buf, 'lowpass', 300, .25), b = filtered(ctx, out, buf, 'bandpass', 1800, .05, .8);   // 熔岩的隆隆聲＋劈啪聲
      return [a.n, b.n, lfo(ctx, 7, .05, b.g.gain, .05), lfo(ctx, .2, .1, a.g.gain, .2)]; },
    crowd(ctx, out, buf) { const a = filtered(ctx, out, buf, 'bandpass', 900, .1, .7); return [a.n, lfo(ctx, .3, .05, a.g.gain, .1)]; },
    drone(ctx, out) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = .09; f.connect(g); g.connect(out);
      const os = [55, 55.6, 82.4].map(fq => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.connect(f); o.start(); return o; });
      const beat = setInterval(() => { const t = ctx.currentTime; [0, .22].forEach(d => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(40, t + d + .2);
        gg.gain.setValueAtTime(.35, t + d); gg.gain.exponentialRampToValueAtTime(.001, t + d + .25); o.connect(gg); gg.connect(out); o.start(t + d); o.stop(t + d + .3); }); }, 1300);
      return [...os, { stop: () => clearInterval(beat) }];
    },
  };
  function stop() { if (stopCur) { stopCur(); stopCur = null; } }
  function play(kind) {
    stop();
    if (!kind || !VOICE.music) return;
    const a = BGM.audio(); if (!a) return;
    const out = a.ctx.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(1, a.ctx.currentTime + 1.2); out.connect(a.out);
    const nodes = KINDS[kind](a.ctx, out, a.noiseBuf);
    stopCur = () => { const t = a.ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + .8);
      setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) { } }); out.disconnect(); }, 900); };
  }
  function sting() {   // 熱血的提示音
    if (!SFX.on) return; const a = BGM.audio(); if (!a) return; const { ctx, out, noiseBuf } = a, t = ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((fq, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = fq;
      g.gain.setValueAtTime(.07, t + i * .07); g.gain.exponentialRampToValueAtTime(.001, t + i * .07 + .25); o.connect(g); g.connect(out); o.start(t + i * .07); o.stop(t + i * .07 + .3); });
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 3000;
    g.gain.setValueAtTime(.18, t + .35); g.gain.exponentialRampToValueAtTime(.001, t + 1.4); n.connect(f); f.connect(g); g.connect(out); n.start(t + .35); n.stop(t + 1.5);
  }
  return { play, stop, sting };
})();

// ---------- 播放 ----------
function cutWho(w) {
  if (!w) return null;
  if (w === 'me') { const k = KID_ITEM[RUN.kid] || ['⭐', '#fff']; return { icon: k[0], color: k[1], name: KIDS[RUN.kid].nick }; }
  if (KID_ITEM[w] && KIDS[w]) return { icon: KID_ITEM[w][0], color: KID_ITEM[w][1], name: KIDS[w].nick };
  if (w === 'shadow') return { icon: '👁', color: '#111', name: '？？？' };
  if (typeof w === 'object') return w;
  const sp = w === 'partner' ? SPECIES[RUN.team[0].sp] : SPECIES[w];
  return sp ? { img: sp.img, name: sp.name } : { name: String(w) };
}
const cutImg = k => k === 'partner' ? SPECIES[RUN.team[0].sp].img : k;
async function cutscene(scenes) {
  const root = document.createElement('div'); root.className = 'cutRoot';
  root.innerHTML = `<div class="cutScene"></div><button class="cutSkip">跳過 ▶▶</button>
    <div class="cutBox"><div class="cutName"></div><div class="cutTxt"></div><div class="cutMore">▼</div></div>`;
  document.body.appendChild(root);
  const sceneEl = root.querySelector('.cutScene'), nameEl = root.querySelector('.cutName'), txt = root.querySelector('.cutTxt');
  const prevMode = G.mode; G.mode = 'busy'; G.cut = { music: null };
  const DPR = Math.min(2, devicePixelRatio || 1);
  let si = -1, li = 0, typing = null, cur = null, done = false, raf = 0, finish;
  const ended = new Promise(r => finish = r);
  function build(S) {
    const cg = document.createElement('div'); cg.className = 'cutCg';
    cg.innerHTML = `<div class="cutCam" style="--px:${S.px || 0};--py:${S.py || 0}"><canvas></canvas>` +
      (S.chars || []).map(([img, x, y, h, cls]) => `<div class="cutShadow" style="left:${x}%;top:${y}%;width:${h * .5}vh;height:${h * .08}vh"></div><div class="cutCh ${cls || ''}" style="left:${x}%;top:${y}%;height:${h}vh"><img src="images/${cutImg(img)}.png" alt=""></div>`).join('') +
      `${S.fx || ''}<div class="cutVig"></div></div>`;
    sceneEl.appendChild(cg);
    const cv = cg.querySelector('canvas'), g = cv.getContext('2d');
    cg._size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * DPR); cv.height = Math.max(1, r.height * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); };
    cg._size(); cg._paint = t => (PAINT[S.bg] || PAINT.void)(g, cv.width / DPR, cv.height / DPR, t);
    requestAnimationFrame(() => cg.classList.add('on'));
    return cg;
  }
  const loop = now => { if (done) return; if (cur) cur._paint(now / 1000); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  function showLine() {
    const S = scenes[si], [w, text] = S.lines[li], who = cutWho(w);
    root.querySelectorAll('[data-from]').forEach(el => el.style.display = li >= +el.dataset.from ? '' : 'none');
    if (!who) { nameEl.className = 'cutName hide'; txt.className = 'cutTxt narr'; }
    else {
      nameEl.className = 'cutName'; txt.className = 'cutTxt';
      nameEl.innerHTML = who.img ? `<img src="images/${who.img}.png" alt="">${who.name}` : `<i style="--c:${who.color || '#fff'}">${who.icon || ''}</i>${who.name}`;
    }
    clearInterval(typing); let n = 0; const chars = Array.from(text.replace(/<[^>]+>/g, '')); txt.textContent = '';
    typing = setInterval(() => { n++; txt.textContent = chars.slice(0, n).join(''); if (n >= chars.length) { clearInterval(typing); typing = null; txt.innerHTML = text; } }, 35);
    sfx('dialog');
  }
  function audio(S) {
    if (S.music !== undefined) G.cut.music = S.music;
    if (S.amb !== undefined && S.amb !== audio.amb) { AMB.play(S.amb); audio.amb = S.amb; }
    if (S.sting) AMB.sting();
  }
  function end() {
    if (done) return; done = true;
    clearInterval(typing); cancelAnimationFrame(raf); AMB.stop();
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    root.classList.add('out'); setTimeout(() => root.remove(), 500);
    G.cut = null; G.mode = prevMode === 'busy' ? G.mode : prevMode;
    finish();
  }
  function next() {
    if (done) return;
    if (typing) { clearInterval(typing); typing = null; txt.innerHTML = scenes[si].lines[li][1]; return; }   // 還在打字：先把這句顯示完
    if (si >= 0 && li < scenes[si].lines.length - 1) { li++; showLine(); return; }
    if (si >= scenes.length - 1) { end(); return; }
    si++; li = 0;
    const old = cur; cur = build(scenes[si]);
    if (old) { old.classList.remove('on'); setTimeout(() => old.remove(), 900); }
    audio(scenes[si]); showLine();
  }
  function onKey(e) { if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); next(); } else if (e.key === 'Escape') { e.stopPropagation(); end(); } }
  const onResize = () => cur && cur._size();
  addEventListener('keydown', onKey, true); addEventListener('resize', onResize);
  root.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('.cutSkip')) end(); else next(); });
  next();
  return ended;
}
