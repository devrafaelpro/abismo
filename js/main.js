// Laço principal, entrada de toque e fluxo entre superfície e mergulho.
import * as S from './state.js';
import { Dive } from './dive.js';
import { Renderer } from './render.js';
import { UI, haptic } from './ui.js';
import * as A from './audio.js';
import { zoneAt, stationDepth } from './data.js';
import { money, meters } from './fmt.js';

let s = S.load();
A.setOn(s.sound);
const R = new Renderer(document.getElementById('cv'));
let mode = 'hub';
let dive = null, paused = false, slow = 0, closeCall = false, sonarT = 0;
let pointer = null;
let t = 0, last = performance.now(), hubAcc = 0, saveAcc = 0;

const ui = new UI(s, {
  dive: startDive,
  save: () => S.save(s),
  wipe: () => { S.wipe(); location.reload(); },
  toggleSound: () => { s.sound = !s.sound; A.setOn(s.sound); S.save(s); },
});

// ganhos da frota enquanto o app estava fechado
function checkOffline(since) {
  const secs = (Date.now() - since) / 1000;
  if (s.crew > 0 && secs > 60) {
    const g = S.offlineGain(s, secs);
    s.cash += g.v; s.earned += g.v;
    ui.offline(g);
    S.save(s);
  }
}
checkOffline(s.last);
ui.refreshHub(true);

// ---------- mergulho ----------
function startDive() {
  A.unlock();
  if (s.tut) { ui.intro(() => { s.tut = false; S.save(s); begin(); }); return; }
  begin();
}
function begin() {
  const starts = S.startDepths(s);
  let startY = starts[Math.min(s.startK, starts.length - 1)];
  if (startY > S.stats(s).rating) { startY = 0; s.startK = 0; }
  dive = new Dive(S.stats(s), { startY, seed: (Math.random() * 1e9) | 0, found: new Set(s.found), record: s.record, first: s.dives === 0 });
  dive.stations = s.stations;
  R.cam.x = dive.d.x; R.cam.y = dive.d.y - 2;
  R.parts = []; R.texts = [];
  mode = 'dive'; paused = false; slow = 0; closeCall = false; pointer = null;
  ui.closeSheet();
  document.getElementById('hub').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  A.sfx.splash();
  R.bubbles(dive.d.x, dive.d.y, 30, true);
  const z = zoneAt(startY + 1);
  if (startY) ui.banner(`ELEVADOR · ${meters(startY)}`, z.name, z.sub);
  else ui.banner('ILHA GRANDE · RJ', 'Mergulho ' + (s.dives + 1), s.record > 0 ? `Seu recorde: ${meters(s.record)}` : 'Boa sorte lá embaixo');
}

function endDive(ok) {
  const d = dive;
  mode = 'end';
  pointer = null;
  s.dives++;
  const newRecord = d.maxY > s.record + 0.5;
  s.record = Math.max(s.record, d.maxY);
  for (const a of d.arts) if (!s.found.includes(`${a.zone}-${a.k}`)) s.found.push(`${a.zone}-${a.k}`);
  const back = () => {
    mode = 'hub';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('hub').classList.remove('hidden');
    ui.refreshHub(true);
    S.save(s);
  };
  if (ok) {
    A.sfx.surface();
    const base = d.bagValue() + d.arts.reduce((a, b) => a + b.v, 0);
    const bonus = closeCall ? base * 0.25 : 0;
    if (closeCall) s.closeCalls++;
    const total = base + bonus;
    S.save(s);
    setTimeout(() => ui.result({ bag: d.bag, arts: d.arts, closeCall, bonus, newRecord, maxY: d.maxY, startY: d.startY, total }, () => {
      s.cash += total; s.earned += total;
      s.bestHaul = Math.max(s.bestHaul, total);
      A.sfx.cash();
      back();
    }), 500);
  } else {
    s.deaths++;
    A.sfx.dead();
    S.save(s);
    setTimeout(() => ui.death({ y: d.d.y, bag: d.bag, arts: d.arts }, back), 1400);
  }
}

function handleEvents() {
  const d = dive;
  for (const e of d.ev) {
    switch (e.type) {
      case 'pickup':
        A.sfx.pickup({ shell: 0, coin: 1, pearl: 2, gem: 3, gold: 4 }[e.loot] ?? 1);
        R.text(e.x, e.y - 0.4, '+' + money(e.v));
        R.burst(e.x, e.y, 'spark', 8, 'rgba(255,220,120,1)');
        haptic(5);
        break;
      case 'chestStart': A.sfx.chestCreak(); break;
      case 'chest': {
        const v = d.bag[d.bag.length - 1].v;
        R.burst(e.x, e.y, 'spark', 30, 'rgba(255,210,90,1)');
        R.text(e.x, e.y - 0.8, 'BAÚ! +' + money(v), '#ffd36a', 1.3);
        A.sfx.chest(); haptic(30);
        break;
      }
      case 'artifact':
        slow = 1.4;
        A.sfx.artifact(); haptic(60);
        R.burst(e.x, e.y, 'spark', 46, zoneAt(e.y).glow);
        ui.banner('ARTEFATO ENCONTRADO', e.name, `+4% no valor de todos os tesouros · ${money(e.v)}`);
        break;
      case 'hit':
        R.shake = 1; A.sfx.hit(); haptic(70);
        R.text(d.d.x, d.d.y - 1.2, '− AR', '#ff8f93', 1.2);
        R.bubbles(d.d.x, d.d.y, 16, true);
        break;
      case 'drop': ui.toast(`Derrubou ${e.n} tesouro${e.n > 1 ? 's' : ''}! Pegue de volta`, 'red'); break;
      case 'harpoon': A.sfx.harpoon(); break;
      case 'air':
        A.sfx.air(); haptic(20);
        R.text(e.x, e.y - 0.6, '+ AR', '#bff6ff', 1.2);
        R.bubbles(e.x, e.y, 18, true);
        break;
      case 'full': A.sfx.full(); ui.toast('BOLSA CHEIA · HORA DE SUBIR', 'red'); break;
      case 'pressure': A.sfx.alarm(); haptic(30); ui.toast('A ROUPA ESTÁ CEDENDO À PRESSÃO', 'red'); break;
      case 'zone': A.sfx.zone(); ui.banner(meters(e.zone.from), e.zone.name, e.zone.sub); break;
      case 'record': A.sfx.record(); ui.toast(`NOVO RECORDE · ${meters(e.y)}`, 'gold'); break;
      case 'sharkCharge': A.sfx.sting(); haptic(40); break;
      case 'eel': case 'angler': A.sfx.sting(); break;
      case 'grab': A.sfx.grab(); haptic(120); R.shake = 1.2; break;
      case 'struggle': A.sfx.struggle(); R.shake = Math.max(R.shake, 0.35); haptic(8); break;
      case 'escape': ui.toast('VOCÊ SE SOLTOU!', 'gold'); break;
      case 'apnea': A.sfx.alarm(); haptic(200); break;
      case 'closecall': closeCall = true; break;
      case 'success': endDive(true); break;
      case 'dead': endDive(false); break;
    }
  }
  d.ev.length = 0;
}

// setas do sonar para tesouros fora da tela
function drawSonar() {
  if (!dive || !dive.s.sonar) return;
  const g = R.g, W = R.W, H = R.H, d = dive.d;
  g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  let any = false;
  for (const it of dive.items) {
    if (it.dead) continue;
    const dist = Math.hypot(it.x - d.x, it.y - d.y);
    if (dist > dive.s.sonar) continue;
    const X = R.sx(it.x), Y = R.sy(it.y);
    if (X > 10 && X < W - 10 && Y > 10 && Y < H - 10) continue;
    any = true;
    const cx = W / 2, cy = H * 0.45;
    const a = Math.atan2(Y - cy, X - cx);
    const m = 26;
    const k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H * 0.45 - m) / Math.abs(Math.sin(a) || 1e-6));
    const px = cx + Math.cos(a) * k, py = cy + Math.sin(a) * k;
    g.save(); g.translate(px, py); g.rotate(a);
    g.fillStyle = it.type === 'art' ? 'rgba(120,255,250,0.9)' : it.type === 'chest' ? 'rgba(255,190,80,0.9)' : 'rgba(255,220,120,0.6)';
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill();
    g.restore();
  }
  sonarT -= 1 / 60;
  if (any && sonarT <= 0) { sonarT = 4; A.sfx.sonar(); }
}

// ---------- entrada ----------
const cv = document.getElementById('cv');
function toWorld(p) { return { x: (p.x - R.W / 2) / R.ppm + R.cam.x, y: (p.y - R.H * 0.45) / R.ppm + R.cam.y }; }
cv.addEventListener('pointerdown', e => {
  A.unlock();
  if (mode !== 'dive' || paused) return;
  if (dive.grab) { dive.tapEscape(); return; }
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
});
cv.addEventListener('pointermove', e => { if (pointer && e.pointerId === pointer.id) { pointer.x = e.clientX; pointer.y = e.clientY; } });
const up = e => { if (pointer && e.pointerId === pointer.id) pointer = null; };
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, () => A.unlock(), { passive: true });
document.getElementById('pause').addEventListener('click', () => doPause());
function doPause() {
  if (mode !== 'dive' || paused) return;
  paused = true; pointer = null;
  ui.pause(() => { paused = false; last = performance.now(); }, () => { paused = false; dive.state = 'dead'; dive.bag = []; endDive(false); });
}

// ---------- laço ----------
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now; t += dt;
  s.play += dt;
  // frota rende sempre
  const cr = S.crewRate(s);
  if (cr > 0) { s.cash += cr * dt; s.earned += cr * dt; }
  if ((mode === 'dive' || mode === 'end') && dive) {
    let sdt = dt;
    if (slow > 0) { slow -= dt; sdt = dt * 0.25; }
    if (mode === 'dive' && !paused) {
      dive.target = pointer ? toWorld(pointer) : null;
      dive.update(sdt);
      handleEvents();
      A.diveTick(dt, dive);
    }
    R.drawDive(dive, t, mode === 'dive' && !paused ? sdt : 0.0001);
    if (mode === 'dive') drawSonar();
    if (mode === 'dive') ui.hud(dive);
  } else {
    R.drawSurface(s, t, dt);
    A.surfaceTick();
    hubAcc += dt;
    if (hubAcc > 0.25) { hubAcc = 0; ui.refreshHub(false); }
  }
  saveAcc += dt;
  if (saveAcc > 10 && mode === 'hub') { saveAcc = 0; S.save(s); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    if (mode === 'dive') doPause();
    S.save(s);
  } else {
    last = performance.now();
    if (mode === 'hub' && hiddenAt) {
      // a renda já foi somada até o momento em que saiu; soma o tempo fora
      const since = hiddenAt; hiddenAt = 0;
      checkOffline(since);
    }
  }
});
window.addEventListener('pagehide', () => S.save(s));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
window.__s = s;
window.__dbg = { get dive() { return dive; }, R };
