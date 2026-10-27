'use strict';
/* =========================================================
   畫質樣品（只用來看畫面）
   - 不會存檔，也不會動到正式遊戲的存檔
   - 一打開就從第一章出發，可以自由走、戰鬥
   - 右上角可以切換「高畫質／原本」比較，或換一張地圖
   ========================================================= */
store.set = () => {}; store.del = () => {};   // 不寫入任何存檔
const HQ_GRASS = COZY.grass;
let hqOn = true;
function demoStart() {
  chosenKid = 'taichi';
  RUN = { kid: 'taichi', team: [], items: ['potion', 'potion'], deck: [...STARTER_DECK, KIDS.taichi.card], courage: 10, bits: 100, relics: [], flags: {}, rules: 'p1',
          chapter: 1, route: null, pos: null, visited: [], usedEvents: [], seen: [], stats: { wins: 1, chapters: 0 } };
  RUN.team.push(newMember('agumon', 3));
  RUN.team.forEach(m => m.hp = memberStats(m).maxhp);
  startChapter(1);
  G.mode = 'story';
  showScreen('');
  showRoute();
}
// 換一張地圖：同一層隨便挑一個節點重新進去
function demoNewMap() {
  if (G.screen !== 'area' || G.mode !== 'explore' && G.mode !== 'area') { toast('先選一座小島進去探索，再換地圖'); return; }
  const f = RUN.pos ? RUN.pos.f : 0, row = RUN.route[f], nd = row[Math.floor(Math.random() * row.length)];
  RUN.pos = { f, i: nd.i };
  enterArea(nd);
}
function demoToggle() {
  hqOn = !hqOn;
  if (hqOn) COZY.grass = HQ_GRASS; else delete COZY.grass;
  A3.A = null; A3.fogKey = '';   // 重新建 3D 場景
  $('#demoHQ').textContent = hqOn ? '✨ 高畫質（點一下看原本）' : '📷 原本（點一下看高畫質）';
}
const bar = document.createElement('div');
bar.id = 'demoBar';
bar.innerHTML = '<b>畫質樣品・第一章</b><button class="btn" id="demoHQ">✨ 高畫質（點一下看原本）</button><button class="btn" id="demoMap">🎲 換一張地圖</button><button class="btn" id="demoRestart">↺ 重新開始</button>';
document.body.appendChild(bar);
$('#demoHQ').onclick = demoToggle;
$('#demoMap').onclick = demoNewMap;
$('#demoRestart').onclick = demoStart;
$('#verTag').textContent = '畫質樣品';
setTimeout(demoStart, 300);
