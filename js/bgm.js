'use strict';
/* =========================================================
   背景音樂（原創 8-bit 曲，用 Web Audio 即時合成，不需要音樂檔）＋ 進化語音
   BGM.play('field' | 'route' | 'battle' | 'boss')、BGM.stop()
   VOICE.evoLine(…)：日文／國語用瀏覽器內建的文字轉語音，機械音用合成器做
   聲音設定存在 localStorage 'digimon-audio'
   ========================================================= */
const BGM = (() => {
  let ctx = null, master = null, cur = null, timer = null, vol = .5, noiseBuf = null;
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const freq = (n, oct = 0) => { const m = n.match(/^([A-G][#b]?)(\d)$/); return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1 + oct) * 12 - 69) / 12); };
  const CHORD = { C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], E: ['E', 'G#', 'B'], Dm: ['D', 'F', 'A'],
                  Bb: ['Bb', 'D', 'F'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'], Em: ['E', 'G', 'B'], B: ['B', 'D#', 'F#'] };
  // 一小節 16 格：音名＝起音、- ＝延長、. ＝休止
  const bars = s => s.trim().split(/\s+/);
  const TRACKS = {
    // 探索地圖：比較悠閒、不高亢（C 大調，低一個八度、用柔和的三角波）
    field: { bpm: 100, oct: -1, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], bass: 'bounce', harm: 'stab', drum: 'k . . . s . . . k . . k s . . .', lead: 'triangle', leadVol: .2,
      mel: ['E5 - G5 - C6 - - - B5 - G5 - E5 - - -', 'A5 - - G5 E5 - C5 - D5 - E5 - C5 - - -', 'F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 -', 'D5 - - - G5 - - - B4 - D5 - G5 - - -',
            'E5 - G5 - C6 - D6 - E6 - D6 - C6 - - -', 'A5 - C6 - B5 - A5 - G5 - E5 - - - . .', 'F5 - E5 - D5 - F5 - G5 - - - D5 - B4 -', 'C5 - - - - - - - G4 - C5 - E5 - G5 -'] },
    // 選路線：安靜、思考的感覺（F 大調）
    route: { bpm: 92, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'], bass: 'long', harm: 'arp', drum: 'h . . . h . . . h . . . h . . .', lead: 'triangle', leadVol: .16,
      mel: ['A5 - - - C6 - - - A5 - G5 - F5 - - -', 'D5 - - - F5 - A5 - - - - - . . . .', 'Bb5 - - - A5 - G5 - F5 - - - D5 - - -', 'E5 - - - G5 - - - C5 - - - - - - -',
            'F5 - A5 - C6 - F6 - E6 - - - C6 - - -', 'D6 - - - C6 - A5 - F5 - - - - - - -', 'G5 - - - Bb5 - - - A5 - G5 - F5 - E5 -', 'F5 - - - - - - - . . . . . . . .'] },
    // 一般戰鬥：厚重、緊張（D 小調，原本的頭目曲）
    battle: { bpm: 138, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], bass: 'ostinato', harm: 'pad', drum: 'k k s . k . s . k k s . k . s s', lead: 'saw', leadVol: .07, crash: true,
      mel: ['D5 - - - F5 - - - A5 - - - G#5 - A5 -', 'Bb5 - - - A5 - - - F5 - - - D5 - - -', 'G5 - - - Bb5 - - - D6 - - - C#6 - D6 -', 'E6 - - - C#6 - - - A5 - - - - - - -',
            'D6 - C6 - A5 - F5 - D5 - F5 - A5 - D6 -', 'F6 - - - E6 - D6 - Bb5 - - - - - - -', 'G5 - A5 - Bb5 - C6 - D6 - Eb6 - D6 - C6 -', 'C#6 - - - - - - - E6 - - - A5 - - -'] },
    // 頭目戰：更壓迫（E 弗里吉亞：E 和 F 的半音拉扯）、馬蹄低音、低沉的持續音、定音鼓
    boss: { bpm: 126, chords: ['Em', 'F', 'Em', 'F', 'C', 'B', 'Em', 'B'], bass: 'gallop', harm: 'pad', drone: true, boom: true, drum: 'k . . k s . . k k . k . s . . s', lead: 'saw', leadVol: .075, crash: true,
      mel: ['E5 - - - - - F5 - E5 - - - B4 - - -', 'F5 - - - E5 - - - C5 - - - A4 - - -', 'G5 - - - F5 - - - E5 - - - D#5 - E5 -', 'A5 - - - G5 - F5 - E5 - - - - - - -',
            'E6 - - - D6 - C6 - B5 - - - G5 - - -', 'F#5 - - - D#5 - - - B4 - - - D#5 - F#5 -', 'G5 - F#5 - E5 - D#5 - E5 - G5 - B5 - E6 -', 'D#6 - - - - - - - F#5 - - - B4 - - -'] },
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
    if (tok !== '-' && tok !== '.') { let n = 1; while (s + n < 16 && mel[s + n] === '-') n++; tone(T.lead, freq(tok, T.oct || 0), t, n * sd * .95, T.leadVol); }
    // 低音
    const B = (o, d, v = .22) => tone('triangle', freq(o), t, d, v);
    if (T.bass === 'bounce' && s % 4 === 0) B((s % 8 ? ch[2] : root) + '2', sd * 2);
    if (T.bass === 'long' && s === 0) B(root + '2', sd * 15, .2);
    if (T.bass === 'drive' && s % 2 === 0) B(root + (s % 4 ? '3' : '2'), sd * 1.6);
    if (T.bass === 'gallop' && [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s)) B(root + (s % 4 === 0 ? '1' : '2'), sd * .8, s % 4 ? .16 : .3);
    if (T.bass === 'ostinato') B(root + ([0, 3, 6, 10, 12].includes(s) ? '2' : '3'), sd * .9, s % 4 ? .14 : .24);
    // 和聲
    if (T.harm === 'stab' && (s === 4 || s === 12)) ch.forEach(n => tone('square', freq(n + '4'), t, sd * 1.2, .028));
    if (T.harm === 'arp') tone('square', freq(ch[s % 3] + (s % 6 < 3 ? '4' : '5')), t, sd * .9, .03);
    if (T.harm === 'pad' && s === 0) ch.forEach(n => tone('saw', freq(n + '3'), t, sd * 16, .022));
    if (T.drone && s === 0) tone('sawtooth', freq(root + '1'), t, sd * 16, .05);
    if (T.boom && s === 0 && bar % 2 === 0) tone('sine', 80, t, .9, .45, 38);   // 定音鼓
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
  const audio = () => { if (!init()) return null; if (ctx.state === 'suspended') ctx.resume(); return { ctx, out: ctx.destination, noiseBuf }; };
  return { play, stop, audio, ctxRaw: () => ctx, volume: v => { vol = v; if (master) master.gain.value = v * .6; }, get playing() { return cur && cur.key; }, TRACKS };
})();

const VOICE = (() => {
  // 日文名字（用圖片檔名對照）
  const JA = { Agumon: 'アグモン', Greymon: 'グレイモン', Metal_Greymon: 'メタルグレイモン', War_Greymon: 'ウォーグレイモン', Skull_Greymon: 'スカルグレイモン',
    Gabumon: 'ガブモン', Garurumon: 'ガルルモン', Were_Garurumon: 'ワーガルルモン', Metal_Garurumon: 'メタルガルルモン', 'Were_Garurumon_(Black)': 'ブラックワーガルルモン',
    Piyomon: 'ピヨモン', Birdramon: 'バードラモン', Garudamon: 'ガルダモン', Hououmon: 'ホウオウモン', Saberdramon: 'セーバードラモン',
    Patamon: 'パタモン', Angemon: 'エンジェモン', Holy_Angemon: 'ホーリーエンジェモン', Seraphimon: 'セラフィモン', Devimon: 'デビモン',
    Gomamon: 'ゴマモン', Ikkakumon: 'イッカクモン', Zudomon: 'ズドモン', Vikemon: 'ヴァイクモン', Waru_Seadramon: 'ワルシードラモン',
    Palmon: 'パルモン', Togemon: 'トゲモン', Lilimon: 'リリモン', Rosemon: 'ロゼモン', Lilithmon: 'リリスモン',
    Tentomon: 'テントモン', Kabuterimon: 'カブテリモン', 'Atlur_Kabuterimon_(Red)': 'アトラーカブテリモン', Herakle_Kabuterimon: 'ヘラクルカブテリモン',
    Plotmon: 'プロットモン', Tailmon: 'テイルモン', Angewomon: 'エンジェウーモン', Holydramon: 'ホーリードラモン', Black_Tailmon: 'ブラックテイルモン',
    Kunemon: 'クネモン', Kuwagamon: 'クワガーモン', Okuwamon: 'オオクワモン', Gran_Kuwagamon: 'グランクワガーモン',
    Betamon: 'ベタモン', Seadramon: 'シードラモン', Mega_Seadramon: 'メガシードラモン', Metal_Seadramon: 'メタルシードラモン',
    Mushmon: 'マッシュモン', Woodmon: 'ウッドモン', Jyureimon: 'ジュレイモン', Pinochimon: 'ピノッキモン',
    Elecmon: 'エレキモン', Leomon: 'レオモン', Panjyamon: 'パンジャモン', Saber_Leomon: 'サーベルレオモン',
    Hagurumon: 'ハグルモン', Guardromon: 'ガードロモン', Andromon: 'アンドロモン', Hi_Andromon: 'ハイアンドロモン', Tankmon: 'タンクモン',
    Goburimon: 'ゴブリモン', Orgemon: 'オーガモン', Skull_Satamon: 'スカルサタモン', Piemon: 'ピエモン',
    Numemon: 'ヌメモン', Geremon: 'ゲレモン', Monzaemon: 'もんざえモン', Platinum_Numemon: 'プラチナヌメモン',
    Gottsumon: 'ゴツモン', Monochromon: 'モノクロモン', Triceramon: 'トリケラモン', Ancient_Volcamon: 'エンシェントボルケーモン',
    Gekomon: 'ゲコモン', Tonosama_Gekomon: 'トノサマゲコモン', Whamon: 'ホエーモン', Plesiomon: 'プレシオモン',
    Shellmon: 'シェルモン', Coelamon: 'シーラモン', Anomalocarimon: 'アノマロカリモン', Brachimon: 'ブラキモン',
    Unimon: 'ユニモン', Pegasmon: 'ペガスモン', Holsmon: 'ホルスモン', Sleipmon: 'スレイプモン',
    Fugamon: 'フーガモン', Mammon: 'マンモン', Skull_Mammon: 'スカルマンモン',
    Meramon: 'メラモン', Blue_Meramon: 'ブルーメラモン', Death_Meramon: 'デスメラモン', Apollomon: 'アポロモン',
    Blossomon: 'ブロッサモン', Lotusmon: 'ロータスモン', Etemon: 'エテモン', King_Etemon: 'キングエテモン', Metal_Etemon: 'メタルエテモン', Boltmon: 'ボルトモン',
    'Metal_Greymon_(Virus)': 'メタルグレイモン', Black_War_Greymon: 'ブラックウォーグレイモン', Darkdramon: 'ダークドラモン' };
  // 用暗化圖代替的黑暗型態（圖跟一般型態一樣，所以用中文名字對照）
  const JA_BY_NAME = { '黑暴龍獸': 'ダークティラノモン', '黑加魯魯獸': 'ブラックガルルモン', '蓋索獸': 'ゲソモン' };
  // [日文, 中文]：evo 進化／super 超進化／ult 究極進化／warp 直接跳到究極體／dark 錯誤進化
  const VERB = { evo: ['進化', '進化'], super: ['超進化', '超進化'], ult: ['究極進化', '究極進化'], warp: ['ワープ進化', '究極進化'], dark: ['暗黒進化', '黑暗進化'] };
  const V = { lang: 'ja', music: true };
  try { const s = JSON.parse(localStorage.getItem('digimon-audio') || '{}'); if (s.lang) V.lang = s.lang; if (s.music === false) V.music = false; } catch (e) { }
  V.save = () => { try { localStorage.setItem('digimon-audio', JSON.stringify({ lang: V.lang, music: V.music })); } catch (e) { } };
  function pickVoice(lang) {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices(), L = v => v.lang.replace('_', '-').toLowerCase();
    if (lang === 'ja') return vs.find(v => L(v).startsWith('ja')) || null;
    // 中文要台灣國語：zh-TW 優先，其次普通話（zh-CN），不要香港的粵語（zh-HK）
    return vs.find(v => L(v) === 'zh-tw') || vs.find(v => L(v).startsWith('zh-hant') && !/hk|yue|canton|粵/i.test(v.lang + v.name))
        || vs.find(v => L(v) === 'zh-cn' || L(v).startsWith('cmn')) || vs.find(v => L(v).startsWith('zh') && !/hk|yue|canton|粵/i.test(v.lang + v.name)) || null;
  }
  V.available = lang => lang === 'robot' ? !!(window.AudioContext || window.webkitAudioContext) : !!pickVoice(lang);
  V.say = (text, lang) => {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = pickVoice(lang);
    u.lang = lang === 'ja' ? 'ja-JP' : 'zh-TW'; if (v) u.voice = v;
    u.rate = lang === 'ja' ? 1.15 : 1.05; u.pitch = 1.15; u.volume = 1;
    speechSynthesis.speak(u);
    return !!v;
  };
  // 機械音「E・VO・LU・TION」：像數碼暴龍機那樣的合成人聲（用濾波器做出母音，不用語音檔）
  V.robot = () => {
    const A = BGM.audio(); if (!A) return;
    const { ctx, out, noiseBuf } = A, t0 = ctx.currentTime + .05;
    const master = ctx.createGain(); master.gain.value = .9; master.connect(out);
    [1047, 1319, 1568, 2093].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(.06, t0 + i * .06); g.gain.exponentialRampToValueAtTime(.001, t0 + i * .06 + .09); o.connect(g); g.connect(master); o.start(t0 + i * .06); o.stop(t0 + i * .06 + .1); });
    const t = t0 + .32;
    const src = ctx.createGain(); src.gain.value = 0;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    [o1, o2].forEach(o => { o.connect(src); o.start(t); o.stop(t + 1.3); });
    const P = [[0, 128], [.24, 128], [.46, 150], [.62, 132], [.85, 118], [1.1, 92]];
    P.forEach(([dt, f]) => { o1.frequency.linearRampToValueAtTime(f, t + dt); o2.frequency.linearRampToValueAtTime(f * 1.003, t + dt); });
    const F = [0, 1, 2].map(() => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 9; src.connect(b); b.connect(master); return b; });
    // [時間, 音量, F1, F2, F3]：e → v → o → l → u → (sh) → ə → n
    const K = [[0, .9, 500, 1850, 2500], [.16, .9, 500, 1850, 2500], [.2, .3, 260, 1300, 2300], [.26, .9, 560, 880, 2400], [.4, .9, 560, 880, 2400],
               [.44, .5, 360, 1050, 2400], [.5, 1, 320, 850, 2300], [.62, 1, 320, 850, 2300], [.66, 0, 320, 850, 2300], [.82, 0, 500, 1450, 2500],
               [.86, .85, 500, 1450, 2500], [1.0, .85, 480, 1500, 2500], [1.06, .5, 260, 1750, 2600], [1.22, 0, 250, 1750, 2600]];
    src.gain.setValueAtTime(0, t); K[0].slice(2).forEach((f, i) => F[i].frequency.setValueAtTime(f, t)); o1.frequency.setValueAtTime(128, t); o2.frequency.setValueAtTime(128, t);
    K.forEach(([dt, v, f1, f2, f3]) => { src.gain.linearRampToValueAtTime(v * .55, t + dt); [f1, f2, f3].forEach((f, i) => F[i].frequency.linearRampToValueAtTime(f, t + dt)); });
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf; n.loop = true; hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 1.2;
    ng.gain.setValueAtTime(0, t); ng.gain.setValueAtTime(0, t + .63); ng.gain.linearRampToValueAtTime(.5, t + .7); ng.gain.linearRampToValueAtTime(.4, t + .8); ng.gain.linearRampToValueAtTime(0, t + .86);
    n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 1.3);
    setTimeout(() => master.disconnect(), 2000);
  };
  // 日文名字：圖片檔名對照；暗化代替的型態用中文名字；都找不到就回傳 null（只喊「進化」）
  const jaName = (img, name, tint) => JA_BY_NAME[name] || (tint ? (JA[img] ? 'ダーク' + JA[img] : null) : JA[img]) || null;
  // 台詞：from / to = { img, name, tint }
  V.lines = (from, to, kind) => {
    const vb = VERB[kind] || VERB.evo, a = jaName(from.img, from.name), b = jaName(to.img, to.name, to.tint);
    const ja = kind === 'dark' ? `${a ? a + '、' : ''}${vb[0]}……！　${b || ''}` : `${a ? a + '、' : ''}${vb[0]}ーっ！　${b ? b + '！' : ''}`;
    return { ja, zh: `${from.name}${vb[1]}——${to.name}！` };
  };
  V.evoLine = (from, to, kind, lang = V.lang) => {
    if (lang === 'off') return;
    if (lang === 'robot') return V.robot();
    const L = V.lines(from, to, kind);
    return V.say(lang === 'ja' ? L.ja : L.zh, lang);
  };
  if ('speechSynthesis' in window) speechSynthesis.getVoices();   // 有些瀏覽器要先叫一次才會載入語音清單
  return V;
})();
