'use strict';
/* =========================================================
   畫質樣品（只用來看畫面）
   - 不會存檔，也不會動到正式遊戲的存檔
   - 一打開就從第一章出發，可以自由走、戰鬥；右上角可以換章節
   - 右上角可以切換「高畫質／原本」比較，或換一張地圖
   ========================================================= */
store.set = () => {}; store.del = () => {};   // 不寫入任何存檔
const DEMO_CH = [[1, '第一章 檔案島'], ['city', '第二章 齒輪城市'], ['forest', '第二章 迷霧森林'], [3, '第三章 無限山'], [4, '第四章 沙漠'], [5, '第五章 金字塔'],
  [6, '第六章 東京'], [7, '第七章 海與森林'], [8, '第八章 工廠'], [9, '第九章 遊樂園'], [10, '最終章 黑暗之海']];
let demoCh = 1;
function demoStart() {
  const ch = CHAPTERS[demoCh], part = typeof demoCh === 'number' && demoCh >= 7 ? 3 : typeof demoCh === 'number' && demoCh >= 4 ? 2 : 1;
  chosenKid = 'taichi';
  RUN = { kid: 'taichi', team: [], items: ['potion', 'potion'], deck: [...STARTER_DECK, KIDS.taichi.card], courage: 10, bits: 100, relics: [], flags: {}, rules: part > 1 ? 'p2' : 'p1',
          part, chapter: demoCh, route: null, pos: null, visited: [], usedEvents: [], seen: [], stats: { wins: 1, chapters: 0 },
          crest: part > 1, awaken: part > 2, crestTicks: part > 2 ? 12 : 0, learned2: [], crests: Object.keys(KIDS) };
  RUN.team.push(newMember('agumon', ch.lv[0] + 2));
  RUN.team.forEach(m => m.hp = memberStats(m).maxhp);
  startChapter(demoCh);
  G.mode = 'story';
  showScreen('');
  showRoute();
}
// 換一張地圖：同一層隨便挑一個節點重新進去
function demoNewMap() {
  if (G.screen !== 'area' || G.mode !== 'area') { toast('先選一座小島進去探索，再換地圖'); return; }
  const f = RUN.pos ? RUN.pos.f : 0, row = RUN.route[f].filter(n => n.type !== 'boss'), nd = row[Math.floor(Math.random() * row.length)] || RUN.route[f][0];
  RUN.pos = { f, i: nd.i };
  enterArea(nd);
}
function demoToggle() {
  A3.hq = A3.hq === false;   // 切換高畫質／原本
  A3.A = null; A3.fogKey = '';   // 重新建 3D 場景
  $('#demoHQ').textContent = A3.hq !== false ? '✨ 高畫質（點一下看原本）' : '📷 原本（點一下看高畫質）';
}
const bar = document.createElement('div');
bar.id = 'demoBar';
bar.innerHTML = `<b>畫質樣品</b><select id="demoCh" class="btn">${DEMO_CH.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`
  + '<button class="btn" id="demoHQ">✨ 高畫質（點一下看原本）</button><button class="btn" id="demoMap">🎲 換一張地圖</button><button class="btn" id="demoRestart">↺ 重新開始</button>';
document.body.appendChild(bar);
$('#demoCh').onchange = e => { const v = e.target.value; demoCh = isNaN(+v) ? v : +v; demoStart(); };
$('#demoHQ').onclick = demoToggle;
$('#demoMap').onclick = demoNewMap;
$('#demoRestart').onclick = demoStart;
$('#verTag').textContent = '畫質樣品';
setTimeout(demoStart, 300);
