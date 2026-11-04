'use strict';
/* =========================================================
   音效：全部用 Web Audio 即時合成（不需要音效檔、沒有版權問題）
   用法：sfx('click')、sfx('hit')…  開關：toggleSound()
   ========================================================= */
const SFX = { ctx: null, master: null, on: true, vol: .45 };
try { SFX.on = localStorage.getItem('digimon-sfx') !== 'off'; } catch (e) { }

function audioCtx() {
  if (!SFX.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    SFX.ctx = new AC();
    SFX.master = SFX.ctx.createGain();
    SFX.master.gain.value = SFX.vol;
    SFX.master.connect(SFX.ctx.destination);
  }
  if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
  return SFX.ctx;
}
// 單一音：頻率可以從 f 滑到 f2
function tone({ f = 440, f2, type = 'square', dur = .1, vol = .25, delay = 0, attack = .005 }) {
  const c = SFX.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(SFX.master);
  o.start(t); o.stop(t + dur + .02);
}
// 雜訊：打擊、咻的聲音
function noise({ dur = .15, vol = .25, freq = 1200, q = 1, delay = 0, type = 'bandpass', sweep }) {
  const c = SFX.ctx, t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
  if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(SFX.master);
  s.start(t); s.stop(t + dur);
}
const notes = (list, opt = {}) => list.forEach((f, i) => tone({ f, type: 'square', dur: .12, vol: .16, delay: i * (opt.gap || .08), ...opt }));

const SOUNDS = {
  // ---- 介面 ----
  click:   () => tone({ f: 880, f2: 1320, dur: .04, vol: .1 }),
  open:    () => { tone({ f: 520, f2: 780, type: 'triangle', dur: .1, vol: .18 }); tone({ f: 780, f2: 1170, type: 'triangle', dur: .1, vol: .14, delay: .05 }); },
  close:   () => tone({ f: 700, f2: 420, type: 'triangle', dur: .09, vol: .14 }),
  error:   () => { tone({ f: 200, f2: 150, type: 'sawtooth', dur: .12, vol: .14 }); tone({ f: 160, f2: 120, type: 'sawtooth', dur: .14, vol: .12, delay: .1 }); },
  dialog:  () => tone({ f: 1046, type: 'sine', dur: .03, vol: .08 }),
  title:   () => notes([523, 659, 784, 1046, 1318], { type: 'triangle', gap: .09, dur: .22, vol: .18 }),
  turn:    () => { tone({ f: 988, type: 'sine', dur: .1, vol: .16 }); tone({ f: 1318, type: 'sine', dur: .16, vol: .16, delay: .08 }); },
  // ---- 地圖 ----
  pickup:  () => { tone({ f: 988, type: 'square', dur: .07, vol: .12 }); tone({ f: 1318, type: 'square', dur: .14, vol: .12, delay: .07 }); },
  chest:   () => notes([659, 880, 1046, 1318], { type: 'triangle', gap: .06, dur: .15, vol: .15 }),
  portal:  () => { noise({ dur: .45, vol: .12, freq: 300, sweep: 3000, q: 3 }); tone({ f: 220, f2: 880, type: 'sine', dur: .45, vol: .12 }); },
  encounter: () => { notes([330, 330, 440, 330], { type: 'square', gap: .07, dur: .07, vol: .14 }); noise({ dur: .3, vol: .1, freq: 800, delay: .28 }); },
  // ---- 戰鬥 ----
  card:    () => noise({ dur: .12, vol: .1, freq: 2500, sweep: 6000, q: .7, type: 'highpass' }),
  hit:     () => { noise({ dur: .12, vol: .3, freq: 600, q: .8, type: 'lowpass' }); tone({ f: 140, f2: 60, type: 'square', dur: .12, vol: .18 }); },
  crit:    () => { SOUNDS.hit(); tone({ f: 1760, f2: 2637, type: 'square', dur: .1, vol: .12, delay: .03 }); },
  block:   () => { tone({ f: 1200, type: 'square', dur: .05, vol: .1 }); tone({ f: 900, type: 'triangle', dur: .18, vol: .12, delay: .02 }); },
  heal:    () => [523, 784, 1046, 1568].forEach((f, i) => tone({ f, type: 'sine', dur: .2, vol: .1, delay: i * .06 })),
  courage: () => tone({ f: 440, f2: 880, type: 'triangle', dur: .14, vol: .1 }),
  evolve:  () => { tone({ f: 150, f2: 1200, type: 'sawtooth', dur: .9, vol: .1 }); noise({ dur: .9, vol: .08, freq: 400, sweep: 6000, q: 2 });
                   [523, 659, 784, 1046].forEach(f => tone({ f, type: 'square', dur: .6, vol: .07, delay: .9 })); },
  wrongevo:() => { tone({ f: 600, f2: 80, type: 'sawtooth', dur: 1, vol: .14 }); tone({ f: 622, f2: 85, type: 'sawtooth', dur: 1, vol: .1 }); noise({ dur: .8, vol: .12, freq: 200, type: 'lowpass' }); },
  fail:    () => notes([392, 330, 262], { type: 'triangle', gap: .14, dur: .2, vol: .15 }),
  victory: () => { notes([523, 523, 523, 659, 784], { gap: .1, dur: .12, vol: .14 }); tone({ f: 1046, type: 'square', dur: .5, vol: .14, delay: .5 }); },
  defeat:  () => notes([440, 415, 392, 330, 262], { type: 'triangle', gap: .18, dur: .3, vol: .15 }),
  levelup: () => notes([784, 988, 1175, 1568], { gap: .07, dur: .12, vol: .13 }),
  persuade:() => notes([659, 831, 988, 1318], { type: 'sine', gap: .09, dur: .25, vol: .16 }),
  angry:   () => { tone({ f: 110, f2: 70, type: 'sawtooth', dur: .35, vol: .18 }); noise({ dur: .3, vol: .12, freq: 300, type: 'lowpass' }); },
};

let sfxLast = {};
function sfx(name) {
  if (!SFX.on || !SOUNDS[name]) return;
  const now = performance.now();
  if (now - (sfxLast[name] || 0) < 40) return;   // 同一個音效太密集時只播一次
  sfxLast[name] = now;
  if (!audioCtx()) return;
  try { SOUNDS[name](); } catch (e) { }
}
function toggleSound() {
  SFX.on = !SFX.on;
  try { localStorage.setItem('digimon-sfx', SFX.on ? 'on' : 'off'); } catch (e) { }
  document.querySelectorAll('.soundBtn').forEach(b => b.textContent = SFX.on ? '🔊' : '🔇');
  if (SFX.on) sfx('open');
  toast(SFX.on ? '🔊 音效開啟' : '🔇 音效關閉');
}

// 按鈕、卡片、節點……點下去都有「嗶」一聲
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .card:not(.static), .rnode.can, .kid, .starter, .pickMon, .evoOpt, .swOpt, .relic.clickable')) sfx('click');
}, true);
// 瀏覽器規定要等玩家第一次點擊才能發出聲音，所以「開場音效」在第一次點擊時播放
let sfxGreeted = false;
document.addEventListener('pointerdown', () => {
  if (sfxGreeted) return;
  sfxGreeted = true;
  if (typeof G !== 'undefined' && G.mode === 'title') setTimeout(() => sfx('title'), 60);
}, true);
