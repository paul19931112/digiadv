'use strict';
/* =========================================================
   背景音樂（原創 8-bit 曲，用 Web Audio 即時合成，不需要音樂檔）＋ 進化語音（瀏覽器內建的文字轉語音）
   BGM.play('field' | 'route' | 'battle' | 'boss')、BGM.stop()、BGM.volume(0~1)
   VOICE.lang = 'ja' | 'zh' | 'off'；VOICE.evo('agumon')
   ========================================================= */
const BGM = (() => {
  let ctx = null, master = null, cur = null, timer = null, vol = .5, noiseBuf = null;
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const freq = n => { const m = n.match(/^([A-G][#b]?)(\d)$/); return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12); };
  const CHORD = { C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], E: ['E', 'G#', 'B'], Dm: ['D', 'F', 'A'],
                  Bb: ['Bb', 'D', 'F'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'], Em: ['E', 'G', 'B'] };
  // 一小節 16 格：音名＝起音、- ＝延長、. ＝休止
  const bars = s => s.trim().split(/\s+/);
  const TRACKS = {
    // 探索地圖：輕快的冒險感（C 大調）
    field: { bpm: 124, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], bass: 'bounce', harm: 'stab', drum: 'k . h . s . h . k . h k s . h .', lead: 'square', leadVol: .11,
      mel: ['E5 - G5 - C6 - - - B5 - G5 - E5 - - -', 'A5 - - G5 E5 - C5 - D5 - E5 - C5 - - -', 'F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -', 'D5 - - - G5 - - - B4 - D5 - G5 - - -',
            'E5 - G5 - C6 - D6 - E6 - D6 - C6 - - -', 'A5 - C6 - B5 - A5 - G5 - E5 - - - . .', 'F5 - E5 - D5 - F5 - G5 - - - D5 - B4 -', 'C5 - - - - - - - G4 - C5 - E5 - G5 -'] },
    // 選路線：安靜、思考的感覺（F 大調）
    route: { bpm: 92, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'], bass: 'long', harm: 'arp', drum: 'h . . . h . . . h . . . h . . .', lead: 'triangle', leadVol: .16,
      mel: ['A5 - - - C6 - - - A5 - G5 - F5 - - -', 'D5 - - - F5 - A5 - - - - - . . . .', 'Bb5 - - - A5 - G5 - F5 - - - D5 - - -', 'E5 - - - G5 - - - C5 - - - - - - -',
            'F5 - A5 - C6 - F6 - E6 - - - C6 - - -', 'D6 - - - C6 - A5 - F5 - - - - - - -', 'G5 - - - Bb5 - - - A5 - G5 - F5 - E5 -', 'F5 - - - - - - - . . . . . . . .'] },
    // 一般戰鬥：節奏快、緊張（A 小調）
    battle: { bpm: 152, chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E'], bass: 'drive', harm: 'stab', drum: 'k . h . s . h . k . k . s . h h', lead: 'square', leadVol: .1,
      mel: ['A5 - E5 - A5 - C6 - B5 - A5 - G5 - E5 -', 'F5 - - - A5 - C6 - - - A5 - F5 - - -', 'G5 - D5 - G5 - B5 - D6 - C6 - B5 - G5 -', 'G#5 - - - B5 - - - E6 - - - D6 - B5 -',
            'C6 - B5 - A5 - E5 - A5 - B5 - C6 - D6 -', 'E6 - - - C6 - A5 - F5 - A5 - C6 - - -', 'D6 - C6 - B5 - G5 - D5 - G5 - B5 - D6 -', 'E6 - - - - - - - G#5 - - - B5 - - -'] },
    // 頭目戰：厚重、壓迫感（D 小調）
    boss: { bpm: 138, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], bass: 'ostinato', harm: 'pad', drum: 'k k s . k . s . k k s . k . s s', lead: 'saw', leadVol: .07, crash: true,
      mel: ['D5 - - - F5 - - - A5 - - - G#5 - A5 -', 'Bb5 - - - A5 - - - F5 - - - D5 - - -', 'G5 - - - Bb5 - - - D6 - - - C#6 - D6 -', 'E6 - - - C#6 - - - A5 - - - - - - -',
            'D6 - C6 - A5 - F5 - D5 - F5 - A5 - D6 -', 'F6 - - - E6 - D6 - Bb5 - - - - - - -', 'G5 - A5 - Bb5 - C6 - D6 - Eb6 - D6 - C6 -', 'C#6 - - - - - - - E6 - - - A5 - - -'] },
  };
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = vol * .6; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(type, f, t, dur, v, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type === 'saw' ? 'sawtooth' : type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008);
    g.gain.setValueAtTime(v, t + Math.max(.01, dur - .04)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(t, dur, v, hp) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .02);
  }
  const drum = (k, t) => {
    if (k === 'k') tone('sine', 150, t, .12, .5, 45);
    else if (k === 's') { noise(t, .12, .25, 1200); tone('triangle', 220, t, .06, .12, 120); }
    else if (k === 'h') noise(t, .04, .08, 7000);
  };
  // 一個 16 分音符格子要排的音
  function step(T, i, t, sd) {
    const bar = Math.floor(i / 16) % T.chords.length, s = i % 16, ch = CHORD[T.chords[bar]], root = ch[0];
    // 主旋律
    const mel = T._mel[bar], tok = mel[s];
    if (tok !== '-' && tok !== '.') { let n = 1; while (s + n < 16 && mel[s + n] === '-') n++; tone(T.lead, freq(tok), t, n * sd * .95, T.leadVol); }
    // 低音
    const B = (o, d, v = .22) => tone('triangle', freq(o), t, d, v);
    if (T.bass === 'bounce' && s % 4 === 0) B((s % 8 ? ch[2] : root) + '2', sd * 2);
    if (T.bass === 'long' && s === 0) B(root + '2', sd * 15, .2);
    if (T.bass === 'drive' && s % 2 === 0) B(root + (s % 4 ? '3' : '2'), sd * 1.6);
    if (T.bass === 'ostinato') B(root + ([0, 3, 6, 10, 12].includes(s) ? '2' : '3'), sd * .9, s % 4 ? .14 : .24);
    // 和聲
    if (T.harm === 'stab' && (s === 4 || s === 12)) ch.forEach(n => tone('square', freq(n + '4'), t, sd * 1.2, .028));
    if (T.harm === 'arp') tone('square', freq(ch[s % 3] + (s % 6 < 3 ? '4' : '5')), t, sd * .9, .03);
    if (T.harm === 'pad' && s === 0) ch.forEach(n => tone('saw', freq(n + '3'), t, sd * 16, .022));
    // 鼓
    const dk = T._drum[s]; if (dk !== '.') drum(dk, t);
    if (T.crash && s === 0 && bar % 4 === 0) noise(t, .6, .12, 3000);
  }
  function play(key) {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (cur && cur.key === key) return;
    stop();
    const T = TRACKS[key]; if (!T) return;
    T._mel = T._mel || T.mel.map(bars); T._drum = T._drum || bars(T.drum);
    const sd = 60 / T.bpm / 4;
    cur = { key, i: 0, next: ctx.currentTime + .08 };
    timer = setInterval(() => {   // 往前排 0.15 秒的音，切到背景分頁也不會亂掉
      while (cur && cur.next < ctx.currentTime + .15) { step(T, cur.i, cur.next, sd); cur.i++; cur.next += sd; }
    }, 25);
  }
  function stop() { clearInterval(timer); timer = null; cur = null; if (master) { const old = master; old.gain.setTargetAtTime(0, ctx.currentTime, .05); setTimeout(() => old.disconnect(), 300); master = ctx.createGain(); master.gain.value = vol * .6; master.connect(ctx.destination); } }
  return { play, stop, volume: v => { vol = v; if (master) master.gain.value = v * .6; }, get playing() { return cur && cur.key; }, TRACKS };
})();

const VOICE = (() => {
  // 進化台詞：日文（片假名名字）／中文
  const JA = { agumon: ['アグモン', 'グレイモン'], gabumon: ['ガブモン', 'ガルルモン'], piyomon: ['ピヨモン', 'バードラモン'], tentomon: ['テントモン', 'カブテリモン'],
               palmon: ['パルモン', 'トゲモン'], gomamon: ['ゴマモン', 'イッカクモン'], patamon: ['パタモン', 'エンジェモン'], plotmon: ['プロットモン', 'テイルモン'] };
  const ZH = { agumon: ['亞古獸', '暴龍獸'], gabumon: ['加布獸', '加魯魯獸'], piyomon: ['比丘獸', '巴多拉獸'], tentomon: ['甲蟲獸', '比多獸'],
               palmon: ['巴魯獸', '仙人掌獸'], gomamon: ['哥瑪獸', '海象獸'], patamon: ['巴達獸', '天使獸'], plotmon: ['小狗獸', '迪路獸'] };
  const V = { lang: 'ja', JA, ZH };
  function pickVoice(lang) {
    const vs = speechSynthesis.getVoices(), want = lang === 'ja' ? /^ja/i : /^zh[-_](TW|HK|Hant)/i;
    return vs.find(v => want.test(v.lang)) || (lang === 'zh' ? vs.find(v => /^zh/i.test(v.lang)) : null);
  }
  V.available = lang => 'speechSynthesis' in window && !!pickVoice(lang);
  V.say = (text, lang) => {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = pickVoice(lang);
    u.lang = lang === 'ja' ? 'ja-JP' : 'zh-TW'; if (v) u.voice = v;
    u.rate = lang === 'ja' ? 1.15 : 1.05; u.pitch = 1.15; u.volume = 1;
    speechSynthesis.speak(u);
    return !!v;
  };
  V.evo = (sp, lang = V.lang) => {
    if (lang === 'off') return;
    const n = (lang === 'ja' ? JA : ZH)[sp]; if (!n) return;
    return V.say(lang === 'ja' ? `${n[0]}、進化ーっ！　${n[1]}！` : `${n[0]}進化——${n[1]}！`, lang);
  };
  if ('speechSynthesis' in window) speechSynthesis.getVoices();   // 有些瀏覽器要先叫一次才會載入語音清單
  return V;
})();
