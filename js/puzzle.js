'use strict';
/* =========================================================
   益智遊戲：剪影猜猜看（古代遺跡的石碑）
   ========================================================= */

// 題庫：所有數碼寶貝和牠們的進化型態（依圖檔去重）
function quizPool() {
  const m = new Map();
  for (const [k, sp] of Object.entries(SPECIES)) {
    if (!sp.img || k.endsWith('_npc') || k === 'devimon_voice') continue;
    m.set(sp.img, { name: sp.name, img: sp.img, emoji: sp.emoji || '❔' });
    (sp.evo || []).forEach(e => { if (!m.has(e.img)) m.set(e.img, { name: e.name, img: e.img, emoji: sp.emoji }); });
    if (sp.dark && !m.has(sp.dark.img)) m.set(sp.dark.img, { name: sp.dark.name, img: sp.dark.img, emoji: sp.emoji });
  }
  return [...m.values()];
}
// 等圖片載入（剪影一定要有圖）
async function imgReady(key) {
  const r = loadImg(key);
  for (let i = 0; i < 30 && r.state === 'loading'; i++) await sleep(50);
  return r.state === 'ok';
}

async function silhouetteQuiz(rounds = 3) {
  const pool = quizPool(), used = new Set();
  let right = 0;
  const o = $('#overlay');
  for (let q = 0; q < rounds; q++) {
    let ans;
    for (let tries = 0; tries < 10; tries++) {
      ans = pick(pool.filter(x => !used.has(x.img)));
      if (await imgReady(ans.img)) break;
    }
    used.add(ans.img);
    const names = new Set([ans.name]);
    const opts = [ans];
    for (const x of shuffle(pool.slice())) { if (opts.length >= 4) break; if (!names.has(x.name)) { names.add(x.name); opts.push(x); } }
    shuffle(opts);
    const ok = await new Promise(res => {
      o.innerHTML = `<h2>🧩 古代遺跡：剪影猜猜看</h2>
        <p class="sub">石碑上浮現出一個影子……這是哪一隻數碼寶貝？</p>
        <div class="quiz"><div class="sil">${dpic(ans.img, ans.emoji)}</div>
        <div class="opts">${opts.map((x, i) => `<button class="btn" data-i="${i}"><span class="ck">${i + 1}</span> ${x.name}</button>`).join('')}</div>
        <div class="prog">第 ${q + 1} / ${rounds} 題　｜　答對 ${right} 題　｜　也可以按數字鍵 1～4 作答</div></div>`;
      o.classList.remove('hidden');
      let done = false;
      const choose = i => {
        if (done) return; done = true;
        document.removeEventListener('keydown', onKey);
        const correct = opts[i] === ans;
        o.querySelectorAll('.opts .btn').forEach((b, j) => { b.disabled = true; if (opts[j] === ans) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
        o.querySelector('.sil').classList.add('reveal');
        o.querySelector('.prog').innerHTML = correct ? `⭕ 答對了！是 <b>${ans.name}</b>！` : `❌ 答錯了…正確答案是 <b>${ans.name}</b>`;
        setTimeout(() => res(correct), 1500);
      };
      const onKey = e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); };
      document.addEventListener('keydown', onKey);
      o.querySelectorAll('.opts .btn').forEach(b => b.onclick = () => choose(+b.dataset.i));
    });
    if (ok) right++;
  }
  o.classList.add('hidden');
  return right;
}

// 石碑：挑戰剪影猜猜看，依答對題數給獎勵
async function stoneTablet() {
  const c = await ask(null, '一塊刻滿古代文字的石碑，正散發著微弱的光芒。<br>看來是在考驗來訪者對數碼寶貝的認識……', [
    { text: '挑戰石碑的謎題', note: '剪影猜猜看，共 3 題' },
    { text: '先不要', note: '' },
  ]);
  if (c !== 0) return false;
  const right = await silhouetteQuiz(3);
  if (right === 3) {
    const pool = relicPool();
    if (pool.length) { const k = pick(pool); RUN.relics.push(k); await say(null, `全部答對！石碑打開了，裡面藏著 <b>${RELICS[k].icon} ${RELICS[k].name}</b>：${RELICS[k].desc}`); }
    else { const b = gainBits(60); await say(null, `全部答對！石碑裡藏著 💰 ${b} 數碼幣！`); }
  } else if (right === 2) {
    const k = pick(RANDOM_ITEMS); await addItem(k); const b = gainBits(15);
    await say(null, `答對 2 題！石碑掉出了 ${ITEMS[k].icon} ${ITEMS[k].name} 和 💰 ${b} 數碼幣。`);
  } else if (right === 1) {
    const b = gainBits(25); await say(null, `答對 1 題。石碑縫隙裡掉出了 💰 ${b} 數碼幣。`);
  } else {
    teamDamage(.08); await say(null, '一題都沒答對……石碑發出電擊！全隊受到了一點傷害。');
  }
  return true;
}
