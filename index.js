// Défense spatiale : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle demande l'accès complet pour utiliser les outils d'interface de NeoBase. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap wide\">\n      <div class=\"agHead\"><span class=\"label\">Défense spatiale</span><span class=\"hint\" id=\"tdInfo\"></span><div class=\"agNav\"><select class=\"f gSel\" id=\"tdMap\"></select><select class=\"f gSel\" id=\"tdDiff\" title=\"Difficulté\"></select><button class=\"btn px\" id=\"tdNew\">NOUVELLE PARTIE</button></div></div>\n      <div class=\"gameBox g85\"><canvas id=\"tdCanvas\" width=\"384\" height=\"240\"></canvas></div>\n      <div class=\"tdBar\"><div id=\"tdTowers\"></div><div class=\"sysCard px\" id=\"tdSel\"></div><div class=\"tdCtl\"><button class=\"btn main px\" id=\"tdWaveBtn\">LANCER LA VAGUE 1</button><button class=\"btn px\" id=\"tdFast\">VITESSE ×1</button></div></div>\n      <div class=\"hint\">1 à 5 : choisir une tourelle · Maj + clic : en poser plusieurs · clic sur une tourelle : l'améliorer (U) ou la vendre (V) · espace : pause · clic droit ou Échap : annuler.</div>\n    </div>";
/*CSS-MOVED*/ const CSS = `.gameBox{display:grid;place-items:center;padding:10px;background:#05010b;box-shadow:0 0 0 3px var(--line2)}
.gameBox canvas{width:min(100%,1152px);aspect-ratio:384/144;image-rendering:pixelated;cursor:var(--cp,pointer)}
.gameBox.tall canvas{width:auto;height:min(720px,72vh);aspect-ratio:240/320}
.gSel{width:auto;font-size:14px;padding:6px 10px;margin-right:8px}
.gameBox.g85 canvas{aspect-ratio:384/240;width:min(100%,calc((100vh - 360px) * 1.6))}
.tdBar{display:flex;gap:16px;align-items:stretch;flex-wrap:wrap}
#tdTowers{display:flex;gap:10px;flex-wrap:wrap}
.tdTower{height:auto;padding:8px 12px;display:grid;grid-template-columns:32px auto;grid-template-rows:auto auto;column-gap:10px;text-align:left;font-size:15px}
.tdTower img{grid-row:span 2;width:32px;height:32px;image-rendering:pixelated}
.tdTower small{font-size:12px;color:var(--lilac);font-weight:400}
#tdSel{flex:1;min-width:240px}
.tdCtl{display:flex;flex-direction:column;gap:10px}
`;  // le style de ce plugin (il utilise les variables du thème de NeoBase)
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => id === "defenseApp" ? view : (view.querySelector('#' + id) || document.getElementById(id));  // les identifiants de ta vue d'abord, puis ceux de la page (fenêtres, menus)
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const __icon = () => ctx.icon;  // l'icône de ce plugin
  const LEGACY_GAMES = {"top":["tdPrefs"],"best":"^td"};
  let games = await doc('games');
  if (games == null) {  // première ouverture : tu retrouves tes records et tes parties d'avant
    const old = legacy.api ? await legacy.api('games').catch(() => null) : null; games = { best: {} };
    if (old) { const re = new RegExp(LEGACY_GAMES.best); for (const [k, v] of Object.entries(old.best || {})) if (re.test(k)) games.best[k] = v; for (const k of LEGACY_GAMES.top) if (old[k] !== undefined) games[k] = old[k]; await folder.write('games', games); }
  }
  games = { best: {}, ...games };
  let gamesTimer = null;
  const saveGames = () => { clearTimeout(gamesTimer); gamesTimer = setTimeout(() => { gamesTimer = null; folder.write('games', games).catch(() => {}); }, 500); };
  const best = (k, v, higher = true) => { const b = games.best[k]; if (b == null || (higher ? v > b : v < b)) { games.best[k] = v; saveGames(); return true; } return false; };
  const gstore = (k, init) => (games[k] ??= init);  // la section d'un jeu
function gameLoop(st, appKey, update, draw) {
  cancelAnimationFrame(st.raf);
  const STEP = 1000 / 60; let acc = 0, last = performance.now();
  const frame = t => {
    if (!view.classList.contains('on')) { st.raf = 0; if (st.mode === 'play') st.mode = 'pause'; return; }  // leaving the tab pauses the game
    st.raf = requestAnimationFrame(frame);
    acc += Math.min(200, t - last); last = t;
    while (acc >= STEP) { if (st.mode === 'play') update(); st.tick++; acc -= STEP; }
    draw();
  };
  st.raf = requestAnimationFrame(frame);
}
function gameText(g, w, lines, y0) {  // centred pixel-font lines over a dark band
  g.fillStyle = 'rgba(11,3,28,.72)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
  g.textAlign = 'center';
  lines.forEach(([text, color, size], i) => { g.fillStyle = color; g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.fillText(text, w / 2, y0 + i * 14); });
  g.textAlign = 'left';
}
const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
function sprite(g, rows, x, y, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } }); }
  // ---- ton code d'origine ----
const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pxFont = (g, text, x, y, color, size = 8, align = 'left') => { g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align; g.fillStyle = '#05010b'; g.fillText(text, x + 1, y + 1); g.fillStyle = color; g.fillText(text, x, y); g.textAlign = 'left'; };

/* ---------- Défense spatiale: build and upgrade 5 kinds of turrets along the route, 30 waves with a boss every 10 ---------- */
const TD = {W: 384, H: 240, T: 16, COLS: 24, ROWS: 15};
const TD_MAPS = [
  {name: 'Ceinture d\'astéroïdes', paths: [[[-1, 3], [6, 3], [6, 11], [13, 11], [13, 4], [19, 4], [19, 9], [24, 9]]]},
  {name: 'Spirale', paths: [[[-1, 2], [21, 2], [21, 13], [3, 13], [3, 5], [17, 5], [17, 10], [8, 10], [8, 8], [12, 8]]]},
  {name: 'Double flux', paths: [[[-1, 3], [9, 3], [9, 7], [24, 7]], [[-1, 12], [14, 12], [14, 7], [24, 7]]]},
  {name: 'Zigzag', paths: [[[-1, 1], [4, 1], [4, 13], [9, 13], [9, 1], [14, 1], [14, 13], [19, 13], [19, 1], [24, 1]]]},
  {name: 'Escalier', paths: [[[-1, 1], [4, 1], [4, 4], [8, 4], [8, 7], [12, 7], [12, 10], [16, 10], [16, 13], [24, 13]]]},
  {name: 'Serpent', paths: [[[-1, 1], [22, 1], [22, 4], [1, 4], [1, 7], [22, 7], [22, 10], [1, 10], [1, 13], [24, 13]]]},
  {name: 'Anneau', paths: [[[-1, 7], [4, 7], [4, 2], [19, 2], [19, 12], [7, 12], [7, 9], [24, 9]]]},
  {name: 'Croisement', paths: [[[-1, 3], [12, 3], [12, 13], [24, 13]], [[-1, 11], [6, 11], [6, 6], [24, 6]]]},
  {name: 'Triple entrée', paths: [[[-1, 2], [8, 2], [8, 7], [24, 7]], [[-1, 12], [8, 12], [8, 7], [24, 7]], [[16, -1], [16, 7], [24, 7]]]},
  {name: 'Labyrinthe', paths: [[[-1, 13], [3, 13], [3, 2], [8, 2], [8, 11], [13, 11], [13, 2], [18, 2], [18, 11], [21, 11], [21, 4], [24, 4]]]},
  {name: 'Couloir', paths: [[[-1, 7], [24, 7]]]},
  {name: 'Tempête finale', paths: [[[-1, 1], [11, 1], [11, 6], [24, 6]], [[-1, 13], [11, 13], [11, 9], [24, 9]], [[5, 15], [5, 9], [11, 9]]]},
];
// how hard: enemy health and speed, gold, lives (the records are kept per map and per difficulty)
const TD_DIFFS = {facile: {name: 'Facile', hp: .7, spd: .9, gold: 1.3, lives: 30, start: 280}, normal: {name: 'Normal', hp: 1, spd: 1, gold: 1, lives: 20, start: 220},
  difficile: {name: 'Difficile', hp: 1.35, spd: 1.08, gold: .9, lives: 15, start: 200}, cauchemar: {name: 'Cauchemar', hp: 1.8, spd: 1.18, gold: .8, lives: 10, start: 180}};
const tdKey = () => 'td' + td.map + (td.diff === 'normal' ? '' : td.diff);  // normal keeps the old record names
const TD_TOWERS = {
  laser: {name: 'Laser', color: '#ff5ad9', desc: 'Rapide, une cible', lv: [{cost: 50, range: 44, rate: 14, dmg: 9}, {cost: 60, range: 50, rate: 12, dmg: 16}, {cost: 110, range: 56, rate: 10, dmg: 28}]},
  canon: {name: 'Canon à plasma', color: '#ff9a3c', desc: 'Explose sur une zone', lv: [{cost: 80, range: 52, rate: 52, dmg: 26, splash: 20}, {cost: 90, range: 56, rate: 48, dmg: 44, splash: 24}, {cost: 160, range: 60, rate: 44, dmg: 75, splash: 28}]},
  givre: {name: 'Givre', color: '#7fe0ee', desc: 'Ralentit tout autour', lv: [{cost: 70, range: 36, rate: 30, dmg: 3, slow: .4}, {cost: 80, range: 42, rate: 28, dmg: 6, slow: .5}, {cost: 130, range: 48, rate: 26, dmg: 10, slow: .6}]},
  tesla: {name: 'Tesla', color: '#ffd07a', desc: 'Éclair qui rebondit', lv: [{cost: 150, range: 48, rate: 40, dmg: 30, chain: 3}, {cost: 160, range: 52, rate: 36, dmg: 50, chain: 4}, {cost: 240, range: 56, rate: 32, dmg: 80, chain: 6}]},
  missile: {name: 'Missiles', color: '#8ee8a0', desc: 'Longue portée, vise le plus solide', lv: [{cost: 120, range: 84, rate: 70, dmg: 60}, {cost: 140, range: 92, rate: 64, dmg: 110}, {cost: 220, range: 100, rate: 58, dmg: 190}]},
};
const TD_FOES = {
  drone: {name: 'Drone', hp: 30, spd: .55, gold: 5, size: 5, color: '#b46aee'},
  eclaireur: {name: 'Éclaireur', hp: 18, spd: 1, gold: 4, size: 4, color: '#7fe0ee'},
  essaim: {name: 'Essaim', hp: 11, spd: .8, gold: 2, size: 3, color: '#8ee8a0'},
  cuirasse: {name: 'Cuirassé', hp: 120, spd: .34, gold: 12, armor: 4, size: 7, color: '#c9bdf0'},
  bouclier: {name: 'Porte-bouclier', hp: 60, shield: 50, spd: .5, gold: 10, size: 6, color: '#ff5ad9'},
  boss: {name: 'Vaisseau-mère', hp: 1600, spd: .26, gold: 150, armor: 6, size: 11, lives: 5, color: '#ff4f6d'},
};
const TD_LAST = 30;
const tdHp = w => 1 + .15 * (w - 1) + .012 * (w - 1) ** 2;
function tdWave(w) {  // groups of enemies, one after the other
  const n = k => Math.round(k * (1 + w * .08)), g = [];
  if (w % 10 === 0) return [{type: 'boss', n: w / 10, gap: 150}, {type: 'drone', n: n(8), gap: 30}, {type: 'cuirasse', n: w / 5, gap: 70}];
  g.push({type: 'drone', n: n(8), gap: 36});
  if (w >= 3) g.push({type: 'eclaireur', n: n(w % 3 === 0 ? 10 : 4), gap: 24});
  if (w >= 4 && w % 2 === 0) g.push({type: 'essaim', n: n(14), gap: 10});
  if (w >= 5) g.push({type: 'cuirasse', n: n(w % 5 === 0 ? 6 : 2), gap: 60});
  if (w >= 7) g.push({type: 'bouclier', n: n(w % 4 === 3 ? 6 : 2), gap: 48});
  return g;
}
let td = null;
function tdBuildMap(m) {  // pixel routes along the waypoints, and the tiles they cover
  const road = new Set(), routes = TD_MAPS[m].paths.map(wp => {
    const pts = wp.map(([x, y]) => [x * TD.T + TD.T / 2, y * TD.T + TD.T / 2]), segs = []; let len = 0;
    for (let i = 1; i < wp.length; i++) {
      const [ax, ay] = wp[i - 1], [bx, by] = wp[i];
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) road.add(y * TD.COLS + x);
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push({a: pts[i - 1], b: pts[i], at: len, l}); len += l;
    }
    return {segs, len};
  });
  const rnd = seeded(m * 31 + 5), rocks = new Set();
  for (let i = 0; i < 14; i++) { const c = Math.floor(rnd() * TD.COLS), r = 1 + Math.floor(rnd() * (TD.ROWS - 1)); if (!road.has(r * TD.COLS + c)) rocks.add(r * TD.COLS + c); }
  return {road, routes, rocks};
}
const tdPos = (route, d) => { const s = route.segs.find(s => d <= s.at + s.l) || route.segs.at(-1), k = Math.min(1, (d - s.at) / s.l); return [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k]; };
function tdStart(map = +$('tdMap').value) {
  if (!td && games?.tdPrefs?.diff) $('tdDiff').value = games.tdPrefs.diff;  // the difficulty chosen last time
  td = td || {raf: 0}; $('tdMap').value = String(map);
  const diff = TD_DIFFS[$('tdDiff').value] ? $('tdDiff').value : 'normal', D = TD_DIFFS[diff]; gstore('tdPrefs', {}).diff = diff;
  Object.assign(td, {g: $('tdCanvas').getContext('2d'), mode: 'ready', tick: 0, map, diff, ...tdBuildMap(map), gold: D.start, lives: D.lives, wave: 0, next: -1, queue: [], foes: [], towers: [], shots: [], fx: [], parts: [], place: null, sel: null, hover: null, fast: false, overAt: 0, won: false, kills: 0,
    stars: Array.from({length: 90}, () => [Math.random() * TD.W, Math.random() * TD.H, Math.random()])});
  tdUi(); gameLoop(td, 'neodyme:defense', tdUpdate, tdDraw);
}
function tdCallWave() {
  if (!td || td.mode === 'over') return;
  if (td.mode !== 'play') td.mode = 'play';
  if (td.queue.length) return;
  if (td.next > 0) td.gold += Math.floor(td.next / 60) * 2;  // calling early pays
  td.wave++; td.next = 0; let at = 0;
  for (const grp of tdWave(td.wave)) { for (let i = 0; i < grp.n; i++) { td.queue.push({type: grp.type, at, route: i % td.routes.length}); at += grp.gap; } at += 60; }
  td.spawnT = 0; td.banner = {text: td.wave % 10 === 0 ? 'VAGUE ' + td.wave + ' · VAISSEAU-MÈRE' : 'VAGUE ' + td.wave, t: 100};
  sfx('notify'); tdUi();
}
function tdDamage(e, dmg) {
  const def = TD_FOES[e.type];
  if (e.shield > 0) { const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a; }
  e.hit = 0;
  e.hp -= def.armor ? Math.max(dmg * .3, dmg - def.armor) : dmg;
  e.flash = 4;
}
function tdStep() {
  if (td.queue.length) td.spawnT++;
  while (td.queue.length && td.queue[0].at <= td.spawnT) {
    const q = td.queue.shift(), def = TD_FOES[q.type], k = tdHp(td.wave) * TD_DIFFS[td.diff].hp;
    td.foes.push({type: q.type, route: q.route, d: 0, hp: def.hp * k, max: def.hp * k, shield: (def.shield || 0) * k, maxShield: (def.shield || 0) * k, slowT: 0, slowF: 0, hit: 0, flash: 0, wob: Math.random() * 6});
  }
  for (const e of td.foes) {
    const def = TD_FOES[e.type], route = td.routes[e.route];
    e.d += def.spd * TD_DIFFS[td.diff].spd * (e.slowT > 0 ? 1 - e.slowF : 1);
    if (e.slowT > 0) e.slowT--; e.hit++; if (e.flash) e.flash--;
    if (e.maxShield && e.hit > 90 && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * .004);
    [e.x, e.y] = tdPos(route, e.d);
    if (e.d >= route.len) { e.gone = true; td.lives -= def.lives || 1; td.shake = 8; sfx('error'); }
    if (e.hp <= 0 && !e.gone) { e.dead = true; td.gold += Math.round(def.gold * TD_DIFFS[td.diff].gold); td.kills++; for (let i = 0; i < (e.type === 'boss' ? 40 : 8); i++) td.parts.push({x: e.x, y: e.y, vx: (Math.random() - .5) * 2.4, vy: (Math.random() - .5) * 2.4, life: 16 + Math.random() * 20, color: i % 2 ? def.color : '#ffd07a'}); }
  }
  td.foes = td.foes.filter(e => !e.dead && !e.gone);
  for (const t of td.towers) {
    const s = TD_TOWERS[t.type].lv[t.lv]; if (t.cool > 0) { t.cool--; continue; }
    const inRange = td.foes.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= s.range);
    if (!inRange.length) continue;
    t.cool = s.rate;
    const first = inRange.reduce((a, e) => e.d > a.d ? e : a);
    if (t.type === 'laser') { tdDamage(first, s.dmg); td.fx.push({k: 'beam', x: t.x, y: t.y, tx: first.x, ty: first.y, t: 6, c: '#ff5ad9'}); t.aim = Math.atan2(first.y - t.y, first.x - t.x); }
    if (t.type === 'canon') { td.shots.push({k: 'shell', x: t.x, y: t.y, tgt: first, tx: first.x, ty: first.y, dmg: s.dmg, splash: s.splash, spd: 2.6}); t.aim = Math.atan2(first.y - t.y, first.x - t.x); }
    if (t.type === 'givre') { for (const e of inRange) { tdDamage(e, s.dmg); e.slowF = e.slowT > 0 ? Math.max(e.slowF, s.slow) : s.slow; e.slowT = 60; } td.fx.push({k: 'ring', x: t.x, y: t.y, r: s.range, t: 14}); }
    if (t.type === 'tesla') {
      let cur = inRange.reduce((a, e) => Math.hypot(e.x - t.x, e.y - t.y) < Math.hypot(a.x - t.x, a.y - t.y) ? e : a), from = [t.x, t.y], dmg = s.dmg; const hit = new Set();
      for (let i = 0; i < s.chain && cur; i++) {
        tdDamage(cur, dmg); hit.add(cur); td.fx.push({k: 'bolt', x: from[0], y: from[1], tx: cur.x, ty: cur.y, t: 8});
        from = [cur.x, cur.y]; dmg *= .85;
        cur = td.foes.filter(e => !hit.has(e) && e.hp > 0 && Math.hypot(e.x - from[0], e.y - from[1]) < 40).sort((a, b) => Math.hypot(a.x - from[0], a.y - from[1]) - Math.hypot(b.x - from[0], b.y - from[1]))[0];
      }
    }
    if (t.type === 'missile') { const tough = inRange.reduce((a, e) => e.hp > a.hp ? e : a); td.shots.push({k: 'missile', x: t.x, y: t.y, tgt: tough, tx: tough.x, ty: tough.y, dmg: s.dmg, spd: 1.6, ang: -Math.PI / 2}); }
  }
  for (const p of td.shots) {
    if (p.tgt && p.tgt.hp > 0 && !p.tgt.gone) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (p.k === 'missile') { p.spd = Math.min(3.6, p.spd + .06); const want = Math.atan2(dy, dx); let da = want - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); p.ang += Math.max(-.18, Math.min(.18, da)); p.x += Math.cos(p.ang) * p.spd; p.y += Math.sin(p.ang) * p.spd; if (td.tick % 2) td.parts.push({x: p.x, y: p.y, vx: 0, vy: 0, life: 10, color: '#5e4d85'}); }
    else { p.x += dx / (d || 1) * Math.min(d, p.spd); p.y += dy / (d || 1) * Math.min(d, p.spd); }
    if (Math.hypot(p.tx - p.x, p.ty - p.y) < 3) {
      p.dead = true;
      if (p.splash) { for (const e of td.foes) if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) tdDamage(e, p.dmg); td.fx.push({k: 'boom', x: p.tx, y: p.ty, r: p.splash, t: 12}); }
      else if (p.tgt && p.tgt.hp > 0) { tdDamage(p.tgt, p.dmg); td.fx.push({k: 'boom', x: p.tx, y: p.ty, r: 8, t: 10}); }
    }
  }
  td.shots = td.shots.filter(p => !p.dead);
  if (td.lives <= 0) { td.lives = 0; td.mode = 'over'; td.overAt = Date.now(); td.record = best(tdKey(), td.wave - 1); saveGames(); sfx('error'); return tdUi(); }
  if (td.wave && !td.queue.length && !td.foes.length && td.next === 0) {  // wave cleared
    td.gold += Math.round((20 + td.wave * 3) * TD_DIFFS[td.diff].gold); best(tdKey(), td.wave); saveGames();
    if (td.wave === TD_LAST && !td.won) { td.won = true; td.banner = {text: 'VICTOIRE ! Les 30 vagues sont repoussées', t: 240}; sfx('launch'); }
    td.next = 900; tdUi();
  }
  if (td.next > 0 && --td.next === 0) tdCallWave();
}
function tdUpdate() {
  for (let i = 0; i < (td.fast ? 2 : 1) && td.mode === 'play'; i++) tdStep();
  for (const f of td.fx) f.t--; td.fx = td.fx.filter(f => f.t > 0);
  for (const p of td.parts) { p.x += p.vx; p.y += p.vy; p.life--; } td.parts = td.parts.filter(p => p.life > 0);
  if (td.banner && --td.banner.t <= 0) td.banner = null;
  if (td.shake > 0) td.shake--;
  if (td.tick % 15 === 0) tdHud();
}
function tdTowerArt(g, type, lv, x, y, aim = -Math.PI / 2) {  // 14 x 14 turret centred on x, y
  const c = TD_TOWERS[type].color;
  px(g, '#05010b', x - 7, y - 7, 14, 14); px(g, '#2b2468', x - 6, y - 6, 12, 12); px(g, '#3a2a6e', x - 6, y - 6, 12, 2);
  px(g, '#130a20', x - 4, y - 4, 8, 8); px(g, c, x - 3, y - 3, 6, 6); px(g, 'rgba(255,255,255,.55)', x - 3, y - 3, 6, 1);
  if (type === 'givre') { px(g, '#e0ffff', x - 1, y - 6, 2, 12); px(g, '#e0ffff', x - 6, y - 1, 12, 2); }
  else if (type === 'tesla') { px(g, '#fff0c8', x - 1, y - 5, 2, 3); px(g, '#fff0c8', x - 2, y - 2, 2, 2); px(g, '#fff0c8', x, y, 2, 3); }
  else if (type === 'missile') { px(g, '#1f7a4a', x - 5, y - 5, 3, 4); px(g, '#1f7a4a', x + 2, y - 5, 3, 4); px(g, '#e6fff4', x - 4, y - 6, 1, 1); px(g, '#e6fff4', x + 3, y - 6, 1, 1); }
  else { const ex = Math.round(Math.cos(aim) * 6), ey = Math.round(Math.sin(aim) * 6); for (let i = 2; i <= 6; i++) px(g, type === 'canon' ? '#8a3c10' : '#8a1a7a', x + Math.round(ex * i / 6) - 1, y + Math.round(ey * i / 6) - 1, type === 'canon' ? 3 : 2, type === 'canon' ? 3 : 2); }
  for (let i = 0; i <= lv; i++) px(g, '#ffd07a', x - 5 + i * 4, y + 5, 2, 2);
}
function tdFoeArt(g, e) {
  const def = TD_FOES[e.type], s = def.size, x = Math.round(e.x), y = Math.round(e.y + Math.sin((td.tick + e.wob * 10) / 9) * (e.type === 'boss' ? 0 : 1)), c = e.flash ? '#ffffff' : e.slowT > 0 ? '#bdf6ff' : def.color;
  if (e.type === 'boss') {
    px(g, '#05010b', x - s - 1, y - 6, s * 2 + 2, 12); px(g, '#8a1a2e', x - s, y - 5, s * 2, 10); px(g, c, x - s + 2, y - 4, s * 2 - 4, 6);
    px(g, '#ffd07a', x - 3, y - 2, 6, 3); px(g, '#05010b', x - s - 3, y - 2, 3, 4); px(g, '#05010b', x + s, y - 2, 3, 4);
    for (let i = -2; i <= 2; i++) px(g, (td.tick >> 3) % 2 ? '#ffd07a' : '#ff9a3c', x + i * 4, y + 5, 2, 2);
  } else {
    px(g, '#05010b', x - s, y - s + 1, s * 2, s * 2 - 2); px(g, '#05010b', x - s + 1, y - s, s * 2 - 2, s * 2);
    px(g, c, x - s + 1, y - s + 1, s * 2 - 2, s * 2 - 2); px(g, 'rgba(255,255,255,.4)', x - s + 1, y - s + 1, s * 2 - 2, 1);
    px(g, '#130a20', x - 1, y - 1, 2, 2);
    if (e.type === 'cuirasse') { px(g, '#5e4d85', x - s + 1, y + s - 3, s * 2 - 2, 2); }
    if (e.type === 'eclaireur') { px(g, '#e0ffff', x - s - 2, y, 2, 1); }
  }
  if (e.shield > 0) { g.strokeStyle = `rgba(255,90,217,${.3 + .5 * e.shield / e.maxShield})`; g.lineWidth = 1; g.beginPath(); g.arc(x, y, s + 3, 0, Math.PI * 2); g.stroke(); }
  if (e.hp < e.max) { const w = Math.max(8, s * 2); px(g, '#05010b', x - w / 2, y - s - 5, w, 3); px(g, e.hp / e.max > .5 ? '#8ee8a0' : e.hp / e.max > .25 ? '#ffd07a' : '#ff4f6d', x - w / 2, y - s - 4, Math.ceil(w * e.hp / e.max), 1); }
}
function tdDraw() {
  const g = td.g, {W, H, T} = TD;
  g.save(); if (td.shake) g.translate(Math.round((Math.random() - .5) * td.shake / 2), Math.round((Math.random() - .5) * td.shake / 2));
  g.fillStyle = '#060114'; g.fillRect(-4, -4, W + 8, H + 8);
  for (const [x, y, z] of td.stars) px(g, z > .8 ? '#8f7bb8' : z > .5 ? '#3a2a6e' : '#221844', (x + td.tick * z * .05) % W, y);
  for (const k of td.rocks) { const x = k % TD.COLS * T, y = Math.floor(k / TD.COLS) * T; px(g, '#130a20', x + 2, y + 3, 12, 10); px(g, '#2a1d52', x + 3, y + 3, 10, 8); px(g, '#3a2a6e', x + 4, y + 4, 4, 3); px(g, '#130a20', x + 8, y + 7, 3, 2); }
  for (const k of td.road) {
    const c = k % TD.COLS, r = Math.floor(k / TD.COLS); if (c < 0 || c >= TD.COLS || r < 0 || r >= TD.ROWS) continue;
    const x = c * T, y = r * T; px(g, '#1a1035', x, y, T, T); px(g, '#221644', x + 1, y + 1, T - 2, T - 2);
    for (const [dc, dr, ex, ey, ew, eh] of [[0, -1, 0, 0, T, 1], [0, 1, 0, T - 1, T, 1], [-1, 0, 0, 0, 1, T], [1, 0, T - 1, 0, 1, T]]) if (!td.road.has((r + dr) * TD.COLS + c + dc) || c + dc < 0 || c + dc >= TD.COLS) px(g, '#5e4d85', x + ex, y + ey, ew, eh);
  }
  for (const route of td.routes) for (let d = (td.tick * .5) % 24; d < route.len; d += 24) { const [x, y] = tdPos(route, d); px(g, 'rgba(138,92,240,.35)', x - 1, y - 1, 2, 2); }  // the flow of the route
  for (const route of td.routes) { const [x, y] = route.segs[0].a, [sx, sy] = [Math.max(4, x), y]; px(g, '#ff5ad9', sx - 3, sy - 6, 2, 12); px(g, (td.tick >> 3) % 2 ? '#ff5ad9' : '#8a1a7a', sx - 1, sy - 5, 2, 10); }
  const end = td.routes[0].segs.at(-1).b, bx = Math.min(W - 10, end[0]), by = end[1];
  px(g, '#05010b', bx - 9, by - 9, 18, 18); px(g, '#4a3c86', bx - 8, by - 8, 16, 16); px(g, '#7fe0ee', bx - 5, by - 5, 10, 10); px(g, '#e0ffff', bx - 2, by - 2, 4, 4); px(g, (td.tick >> 4) % 2 ? '#ff4f6d' : '#8a1a2e', bx - 1, by - 8, 2, 2);
  const showGrid = td.place || td.sel;
  if (td.place) for (let c = 0; c < TD.COLS; c++) for (let r = 1; r < TD.ROWS; r++) if (tdFree(c, r)) px(g, 'rgba(142,232,160,.06)', c * T + 1, r * T + 1, T - 2, T - 2);
  for (const t of td.towers) tdTowerArt(g, t.type, t.lv, t.x, t.y, t.aim);
  const sel = td.sel && td.towers.includes(td.sel) ? td.sel : null;
  if (sel) { g.strokeStyle = 'rgba(255,208,122,.7)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(sel.x, sel.y, TD_TOWERS[sel.type].lv[sel.lv].range, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); px(g, '#ffd07a', sel.x - 8, sel.y - 8, 16, 1); px(g, '#ffd07a', sel.x - 8, sel.y + 7, 16, 1); }
  for (const e of td.foes) tdFoeArt(g, e);
  for (const p of td.shots) { if (p.k === 'missile') { px(g, '#e6fff4', p.x - 1, p.y - 1, 3, 3); px(g, '#ff9a3c', p.x - Math.cos(p.ang) * 3 - 1, p.y - Math.sin(p.ang) * 3 - 1, 2, 2); } else { px(g, '#ffd07a', p.x - 2, p.y - 2, 4, 4); px(g, '#ffffff', p.x - 1, p.y - 1, 2, 2); } }
  for (const f of td.fx) {
    if (f.k === 'beam') { g.strokeStyle = f.c; g.globalAlpha = f.t / 6; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.tx, f.ty); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; }
    if (f.k === 'bolt') { g.strokeStyle = '#fff0c8'; g.globalAlpha = f.t / 8; g.lineWidth = 1; g.beginPath(); g.moveTo(f.x, f.y); for (let i = 1; i < 5; i++) g.lineTo(f.x + (f.tx - f.x) * i / 5 + (Math.random() - .5) * 6, f.y + (f.ty - f.y) * i / 5 + (Math.random() - .5) * 6); g.lineTo(f.tx, f.ty); g.stroke(); g.globalAlpha = 1; }
    if (f.k === 'ring') { g.strokeStyle = `rgba(127,224,238,${f.t / 14 * .7})`; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r * (1 - f.t / 16), 0, Math.PI * 2); g.stroke(); }
    if (f.k === 'boom') { const k = 1 - f.t / 12; g.fillStyle = `rgba(255,154,60,${(1 - k) * .6})`; g.beginPath(); g.arc(f.x, f.y, f.r * (.4 + k * .6), 0, Math.PI * 2); g.fill(); }
  }
  for (const p of td.parts) px(g, p.color, p.x, p.y, 2, 2);
  if (td.place && td.hover) {  // the turret to build, under the mouse
    const [c, r] = td.hover, ok = tdFree(c, r) && td.gold >= TD_TOWERS[td.place].lv[0].cost, x = c * T + 8, y = r * T + 8;
    g.fillStyle = ok ? 'rgba(142,232,160,.12)' : 'rgba(255,79,109,.12)'; g.beginPath(); g.arc(x, y, TD_TOWERS[td.place].lv[0].range, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .75; tdTowerArt(g, td.place, 0, x, y); g.globalAlpha = 1;
    if (!ok) { px(g, '#ff4f6d', x - 7, y - 7, 14, 1); px(g, '#ff4f6d', x - 7, y + 6, 14, 1); }
  }
  px(g, 'rgba(11,3,28,.82)', 0, 0, W, 14);
  pxFont(g, '♦ ' + td.gold, 4, 10, '#ffd07a', 7);
  pxFont(g, '♥ ' + td.lives, 84, 10, '#ff4f6d', 7);
  pxFont(g, 'VAGUE ' + td.wave + (td.wave <= TD_LAST ? ' / ' + TD_LAST : ''), W / 2 + 20, 10, '#d9c6ff', 7, 'center');
  pxFont(g, td.next > 0 ? 'Suivante dans ' + Math.ceil(td.next / 60) + ' s' : td.queue.length || td.foes.length ? td.foes.length + td.queue.length + ' ennemis' : '', W - 4, 10, '#8f7bb8', 6, 'right');
  if (td.banner) gameText(g, W, [[td.banner.text, '#ff5ad9', 9]], H / 2);
  if (td.mode === 'ready') gameText(g, W, [['DÉFENSE SPATIALE', '#ff5ad9', 12], ['Place des tourelles le long de la route', '#d9c6ff'], ['puis lance la première vague', '#d9c6ff'], ['Record sur cette carte : vague ' + (games?.best[tdKey()] ?? 0), '#ffd07a']], H / 2 - 20);
  if (td.mode === 'pause') gameText(g, W, [['PAUSE', '#ffffff', 12], ['Espace : reprendre', '#d9c6ff']], H / 2);
  if (td.mode === 'over') gameText(g, W, [['LA STATION EST TOMBÉE', '#ff4f6d', 10], ['Tu as tenu ' + (td.wave - 1) + ' vagues · ' + td.kills + ' ennemis détruits', '#ffffff'], [td.record ? 'NOUVEAU RECORD !' : 'Record : vague ' + (games?.best[tdKey()] ?? 0), '#ffd07a'], ['Nouvelle partie : bouton en haut', '#d9c6ff']], H / 2 - 14);
  g.restore();
}
const tdFree = (c, r) => c >= 0 && c < TD.COLS && r >= 1 && r < TD.ROWS && !td.road.has(r * TD.COLS + c) && !td.rocks.has(r * TD.COLS + c) && !td.towers.some(t => t.c === c && t.r === r);
const tdCell = e => { const rc = $('tdCanvas').getBoundingClientRect(); return [Math.floor((e.clientX - rc.left) / rc.width * TD.W / TD.T), Math.floor((e.clientY - rc.top) / rc.height * TD.H / TD.T)]; };
const tdInvested = t => TD_TOWERS[t.type].lv.slice(0, t.lv + 1).reduce((a, l) => a + l.cost, 0);
function tdBuild(type, c, r) {
  const cost = TD_TOWERS[type].lv[0].cost;
  if (!tdFree(c, r) || td.gold < cost) return false;
  td.gold -= cost; const t = {type, lv: 0, c, r, x: c * TD.T + 8, y: r * TD.T + 8, cool: 0, aim: -Math.PI / 2}; td.towers.push(t); sfx('click'); return t;
}
function tdUpgrade(t) { const nx = TD_TOWERS[t.type].lv[t.lv + 1]; if (!nx || td.gold < nx.cost) return false; td.gold -= nx.cost; t.lv++; sfx('notify'); return true; }
function tdSell(t) { td.gold += Math.floor(tdInvested(t) * .7); td.towers.splice(td.towers.indexOf(t), 1); td.sel = null; sfx('close'); }
const tdIcon = type => { const c = document.createElement('canvas'); c.width = c.height = 16; tdTowerArt(c.getContext('2d'), type, 0, 8, 8); return c.toDataURL(); };
let tdIcons = null;
function tdUi() {
  tdIcons ??= Object.fromEntries(Object.keys(TD_TOWERS).map(k => [k, tdIcon(k)]));
  $('tdTowers').replaceChildren(...Object.entries(TD_TOWERS).map(([k, t], i) => {
    const b = el('button', 'btn px tdTower' + (td.place === k ? ' main' : '')), img = el('img'); img.src = tdIcons[k];
    b.append(img, el('span', '', (i + 1) + ' · ' + t.name), el('small', '', t.lv[0].cost + ' ♦ · ' + t.desc));
    b.disabled = td.gold < t.lv[0].cost && td.place !== k;
    b.onclick = () => { td.place = td.place === k ? null : k; td.sel = null; tdUi(); };
    return b;
  }));
  const t = td.sel && td.towers.includes(td.sel) ? td.sel : null, box = $('tdSel');
  if (t) {
    const def = TD_TOWERS[t.type], s = def.lv[t.lv], nx = def.lv[t.lv + 1];
    const up = el('button', 'btn main px', nx ? 'Améliorer · ' + nx.cost + ' ♦' : 'Niveau max'); up.disabled = !nx || td.gold < nx.cost; up.onclick = () => { tdUpgrade(t); tdUi(); };
    const sell = el('button', 'btn del px', 'Vendre · ' + Math.floor(tdInvested(t) * .7) + ' ♦'); sell.onclick = () => { tdSell(t); tdUi(); };
    box.replaceChildren(el('b', '', def.name + ' · niveau ' + (t.lv + 1)), el('span', 'hint', 'Dégâts ' + s.dmg + ' · portée ' + s.range + (s.splash ? ' · zone ' + s.splash : '') + (s.slow ? ' · ralentit ' + Math.round(s.slow * 100) + ' %' : '') + (s.chain ? ' · ' + s.chain + ' cibles' : '') + ' · ' + (60 / s.rate).toFixed(1) + ' tirs/s'), el('div', 'row', ''));
    box.lastChild.append(up, sell);
  } else box.replaceChildren(el('span', 'hint', td.place ? 'Clique une case libre pour construire · clic droit ou Échap : annuler' : 'Choisis une tourelle puis une case libre, ou clique une tourelle pour l\'améliorer.'));
  $('tdWaveBtn').textContent = td.mode === 'over' ? 'PARTIE TERMINÉE' : td.queue.length || (td.foes.length && !td.next) ? 'VAGUE EN COURS' : td.wave ? 'VAGUE SUIVANTE (+' + Math.floor(Math.max(0, td.next) / 60) * 2 + ' ♦)' : 'LANCER LA VAGUE 1';
  $('tdWaveBtn').disabled = td.mode === 'over' || !!td.queue.length;
  $('tdFast').textContent = 'VITESSE ×' + (td.fast ? 2 : 1);
  tdHud();
}
function tdHud() { $('tdInfo').textContent = TD_MAPS[td.map].name + ' · ' + TD_DIFFS[td.diff].name + ' · record : vague ' + (games?.best[tdKey()] ?? 0); for (const b of $('tdTowers').children) { const k = Object.keys(TD_TOWERS)[[...b.parentNode.children].indexOf(b)]; b.disabled = td.gold < TD_TOWERS[k].lv[0].cost && td.place !== k; } }
$('tdCanvas').onpointermove = e => { if (td) td.hover = tdCell(e); };
$('tdCanvas').onpointerleave = () => { if (td) td.hover = null; };
$('tdCanvas').oncontextmenu = e => { e.preventDefault(); if (td) { td.place = null; td.sel = null; tdUi(); } };
$('tdCanvas').onpointerdown = e => {
  if (!td || e.button !== 0) return;
  if (td.mode === 'pause') { td.mode = 'play'; return; }
  const [c, r] = tdCell(e);
  if (td.place) { if (tdBuild(td.place, c, r)) { if (td.gold < TD_TOWERS[td.place].lv[0].cost || !e.shiftKey) td.place = null; } else sfx('error'); return tdUi(); }  // Maj : construire plusieurs
  td.sel = td.towers.find(t => t.c === c && t.r === r) || null; tdUi();
};
$('tdWaveBtn').onclick = () => tdCallWave();
$('tdFast').onclick = () => { td.fast = !td.fast; tdUi(); };
$('tdNew').onclick = () => tdStart();
$('tdMap').replaceChildren(...TD_MAPS.map((m, i) => { const o = el('option', '', m.name); o.value = i; return o; }));
$('tdMap').onchange = () => tdStart();
$('tdDiff').replaceChildren(...Object.entries(TD_DIFFS).map(([k, d]) => { const o = el('option', '', d.name); o.value = k; return o; }));
$('tdDiff').value = 'normal';
$('tdDiff').onchange = () => tdStart();

document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (view.classList.contains('on') && td) {
    if (k === ' ') { e.preventDefault(); if (td.mode === 'play') td.mode = 'pause'; else if (td.mode === 'pause' || td.mode === 'ready') td.mode = 'play'; }
    if (k === 'Escape') { td.place = null; td.sel = null; tdUi(); }
    if (/^[1-5]$/.test(k)) { const t = Object.keys(TD_TOWERS)[+k - 1]; td.place = td.place === t ? null : t; td.sel = null; tdUi(); }
    if (k === 'u' && td.sel) { tdUpgrade(td.sel); tdUi(); }
    if (k === 'v' && td.sel) { tdSell(td.sel); tdUi(); }
  }
});  // (non indenté : les textes sur plusieurs lignes restent exactement les tiens)
  // ---- fin ----
  ctx.onOpen(() => { td ? (tdUi(), gameLoop(td, 'neodyme:defense', tdUpdate, tdDraw)) : tdStart(); });
}
