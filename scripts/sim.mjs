// Robô que joga mergulhos reais (mesma física) e compra equipamento. Mede o ritmo.
// Uso: node scripts/sim.mjs [mergulhos]
import { Dive } from '../js/dive.js';
import * as S from '../js/state.js';
import { UPGRADES, zoneAt } from '../js/data.js';
import { money } from '../js/fmt.js';

const N = +(process.argv[2] || 150);
const s = S.fresh();
let clock = 0;
const fmtT = x => `${Math.floor(x / 3600)}h${String(Math.floor(x % 3600 / 60)).padStart(2, '0')}`;

for (let n = 0; n < N; n++) {
  const starts = S.startDepths(s);
  const startY = starts[starts.length - 1];
  const st = S.stats(s);
  const dv = new Dive(st, { startY, seed: n * 977 + 1, found: new Set(s.found), record: s.record, first: n === 0 });
  const goal = Math.min(st.rating + 5, startY + 420);
  let phase = 'down', t = 0;
  const dt = 1 / 30;
  while (dv.state !== 'done' && dv.state !== 'dead' && t < 900) {
    const d = dv.d;
    if (dv.grab) { if (Math.random() < 0.25) dv.tapEscape(); }
    const full = dv.bag.length >= st.bag;
    if (phase === 'down' && (dv.o2Time() < dv.returnTime() * 1.35 + 4 || d.y >= goal || full)) phase = 'up';
    let tgt = null;
    const picky = phase === 'down' && d.y < startY + (goal - startY) * 0.6 && dv.bag.length > st.bag * 0.2;
    const near = dv.items.filter(i => !i.dead && Math.abs(i.y - d.y) < 7 && (phase === 'down' ? i.y > d.y - 2 : i.y < d.y + 1) && (!picky || i.type === 'art'));
    if (!full && near.length) {
      near.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
      tgt = { x: near[0].x, y: near[0].y };
    }
    if (!tgt) tgt = { x: d.x, y: phase === 'down' ? d.y + 5 : d.y - 5 };
    if (phase === 'up' && tgt.y > d.y) tgt.y = d.y - 3;
    dv.target = tgt;
    dv.update(dt);
    dv.ev.length = 0;
    t += dt;
  }
  clock += t + 12;
  s.dives++;
  s.record = Math.max(s.record, dv.maxY);
  for (const a of dv.arts) if (!s.found.includes(`${a.zone}-${a.k}`)) s.found.push(`${a.zone}-${a.k}`);
  let gain = 0;
  if (dv.state === 'done') gain = dv.bagValue() + dv.arts.reduce((a, b) => a + b.v, 0);
  else s.deaths++;
  s.cash += gain + S.crewRate(s) * (t + 12);
  // compras: estação > roupa > resto barato
  for (let k = 0; k < 40; k++) {
    if (s.record >= S.nextStationDepth(s) && S.nextStationCost(s) <= s.cash) { s.cash -= S.nextStationCost(s); s.stations++; continue; }
    const opts = UPGRADES.filter(u => !S.upgLocked(s, u.id) && s.lv[u.id] < u.max).map(u => ({ id: u.id, c: S.upgCost(s, u.id) }));
    if (s.record >= 30) opts.push({ id: 'crew', c: S.crewCost(s) * 2 });
    opts.sort((a, b) => a.c - b.c);
    const o = opts[0];
    if (!o || o.c > s.cash) break;
    if (o.id === 'crew') { s.cash -= S.crewCost(s); s.crew++; } else { s.cash -= o.c; s.lv[o.id]++; }
  }
  if (n < 10 || n % 10 === 0 || n === N - 1)
    console.log(`#${String(n + 1).padStart(3)} ${fmtT(clock)} ${dv.state.padEnd(4)} máx ${dv.maxY.toFixed(0).padStart(5)}m ganho ${money(gain).padEnd(14)} caixa ${money(s.cash).padEnd(14)} recorde ${s.record.toFixed(0)}m roupa ${st.rating}m ar ${st.o2}s est ${s.stations} frota ${s.crew} art ${s.found.length} ${zoneAt(s.record).name}`);
}
console.log('mortes', s.deaths, 'níveis', JSON.stringify(s.lv));
