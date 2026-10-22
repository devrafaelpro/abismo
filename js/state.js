// Progresso salvo e regras de economia.
import { UPGRADES, dv, BASE_VALUE, stationDepth, stationCost, ARTIFACTS } from './data.js';

const KEY = 'abismo-save-v1';

export function fresh() {
  return {
    v: 1, cash: 0, earned: 0, record: 0,
    lv: Object.fromEntries(UPGRADES.map(u => [u.id, 0])),
    stations: 0, crew: 0, found: [],
    dives: 0, deaths: 0, closeCalls: 0, bestHaul: 0, play: 0,
    sound: true, tut: true, last: Date.now(), startK: 0,
  };
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) { const f = fresh(); return { ...f, ...s, lv: { ...f.lv, ...s.lv } }; }
  } catch (e) { /* save corrompido */ }
  return fresh();
}
export function save(s) {
  s.last = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sem espaço */ }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } }

export function upg(id) { return UPGRADES.find(u => u.id === id); }
export function upgCost(s, id) {
  const u = upg(id);
  return u.k * BASE_VALUE * dv(u.costAt(s.lv[id])) * (u.grow ? u.grow(s.lv[id]) : 1);
}
export function upgLocked(s, id) { const u = upg(id); return u.minRecord && s.record < u.minRecord; }

export function setsDone(s) {
  const set = new Set(s.found);
  let n = 0;
  for (let z = 0; z < 40; z++) {
    const len = z < ARTIFACTS.length ? ARTIFACTS[z].length : 6;
    let all = true;
    for (let k = 0; k < len; k++) if (!set.has(`${z}-${k}`)) { all = false; break; }
    if (all) n++;
  }
  return n;
}
export function lootMult(s) { return 1 + 0.04 * s.found.length + 0.25 * setsDone(s); }

export function stats(s) {
  const v = id => upg(id).val(s.lv[id]);
  return {
    o2: v('tank'), speed: v('fins'), rating: v('suit'), bag: v('bag'), light: v('light'),
    magnet: v('magnet'), sonar: v('sonar'), harpoon: v('harpoon'), lootMult: lootMult(s),
  };
}

// Frota: mergulhadores contratados trabalham sozinhos
export function crewRate(s) { return s.crew * 0.04 * BASE_VALUE * dv(Math.max(20, s.record)) * lootMult(s); }
export function crewCost(s) { return 25 * BASE_VALUE * dv(Math.max(20, s.record)) * Math.pow(1.17, s.crew); }

export function nextStationCost(s) { return stationCost(s.stations); }
export function nextStationDepth(s) { return stationDepth(s.stations); }
export function startDepths(s) {
  const list = [0];
  for (let k = 0; k < s.stations; k++) list.push(stationDepth(k));
  return list;
}
export function offlineGain(s, secs) {
  const capped = Math.min(secs, 8 * 3600);
  return { secs, capped, v: crewRate(s) * capped };
}
