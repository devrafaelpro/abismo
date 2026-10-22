// Mundo procedural: o paredão é fixo (você aprende o caminho); tesouros e criaturas mudam a cada mergulho.
import { zoneAt, dv, BASE_VALUE, LOOT, ARTIFACTS, ART_SHAPES, nearestStation } from './data.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(i) {
  let h = Math.imul((i | 0) ^ 0x27d4eb2d, 0x9E3779B1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967295 * 2 - 1;
}
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hash(i), b = hash(i + 1);
  return a + (b - a) * u;
}
export function hash01(i) { return (hash(i) + 1) / 2; }

// Centro e largura do abismo na profundidade y (metros)
export function center(y) { return 7 * noise1(y / 60) + 4 * noise1(y / 17 + 100) + 1.2 * noise1(y / 4.3 + 300); }
export function walls(y) {
  const c = center(y);
  let w = 17 + 9 * noise1(y / 45 + 50) + 1.6 * noise1(y / 3.1 + 900) + 0.8 * noise1(y / 1.3 + 77);
  if (y < 18) w += (18 - y) * 1.8;
  // abre uma câmara em volta das estações
  const ds = Math.abs(y - nearestStation(y));
  if (y > 100 && ds < 10) w += (10 - ds) * 1.4;
  if (w < 9) w = 9;
  return [c - w / 2, c + w / 2];
}
// correnteza horizontal: retorna velocidade (m/s)
export function current(y) {
  if (y < 160) return 0;
  const n = noise1(y / 28 + 4000);
  if (Math.abs(n) < 0.62) return 0;
  return Math.sign(n) * (Math.abs(n) - 0.62) * 9 * Math.min(2, 1 + y / 3000);
}

export const CHUNK = 20;

// Gera tesouros e criaturas de um pedaço do abismo
export function genChunk(k, seed, found) {
  const R = rng(seed * 7919 + k * 104729);
  const y0 = k * CHUNK;
  const items = [], mobs = [];
  if (y0 < 0) return { items, mobs };
  const z = zoneAt(y0 + CHUNK / 2).i;
  const place = (margin = 1.2) => {
    const y = y0 + R() * CHUNK;
    const [L, Rw] = walls(y);
    // tesouros gostam de ficar perto das paredes
    const side = R();
    const x = side < 0.35 ? L + margin + R() * 2.5 : side < 0.7 ? Rw - margin - R() * 2.5 : L + margin + R() * (Rw - L - 2 * margin);
    return [x, y];
  };
  // tesouros
  const weights = {
    shell: Math.max(0, 4 - z * 1.5), coin: 4, pearl: 1.6 + z * 0.3,
    gem: z >= 1 ? 1 + z * 0.35 : 0.3, gold: z >= 1 ? 0.6 + z * 0.3 : 0.1, chest: z === 0 ? 0.22 : 0.4,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const n = 3 + Math.floor(R() * 3) + (z >= 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let r = R() * total, type = 'coin';
    for (const t in weights) { r -= weights[t]; if (r <= 0) { type = t; break; } }
    const [x, y] = place();
    const v = BASE_VALUE * LOOT[type].v * dv(y) * (0.8 + R() * 0.4);
    items.push({ type, x, y, v, ph: R() * 6.28, hue: Math.floor(R() * 5) });
  }
  // artefato
  const zoneArts = z < ARTIFACTS.length ? ARTIFACTS[z].length : 6;
  const missing = [];
  for (let a = 0; a < zoneArts; a++) if (!found.has(`${z}-${a}`)) missing.push(a);
  const artChance = z === 0 ? 0.13 : 0.08;
  if (missing.length && R() < artChance) {
    const a = missing[Math.floor(R() * missing.length)];
    const [x, y] = place(1.5);
    items.push({ type: 'art', zone: z, k: a, x, y, v: BASE_VALUE * 150 * dv(y), ph: R() * 6.28, shape: ART_SHAPES[a % ART_SHAPES.length] });
  }
  // criaturas
  const add = (t, extra = {}) => { const [x, y] = place(2); mobs.push({ t, x, y, hx: x, hy: y, vx: 0, vy: 0, ph: R() * 6.28, st: 'idle', cd: 0, stun: 0, seed: R(), ...extra }); };
  const roll = p => { let c = 0; while (p > 0) { if (R() < Math.min(1, p)) c++; p -= 1; } return c; };
  const deep = Math.min(2.2, 1 + y0 / 3000);
  for (let i = roll(0.45 * (z === 0 ? 0.6 : 1) * deep); i--;) add('jelly', { glow: z >= 3 });
  if (z <= 2) for (let i = roll(0.7); i--;) add('fish', { n: 7 + Math.floor(R() * 8), hue: Math.floor(R() * 4) });
  if (z >= 1 && z <= 4) for (let i = roll(0.28); i--;) {
    const y = y0 + R() * CHUNK; const [L, Rw] = walls(y); const left = R() < 0.5;
    mobs.push({ t: 'eel', x: left ? L : Rw, y, dir: left ? 1 : -1, ext: 0, st: 'hide', cd: 0, stun: 0, ph: R() * 6 });
  }
  if (z >= 2) for (let i = roll((z === 2 ? 0.12 : 0.2) * deep); i--;) add('shark', { dir: R() < 0.5 ? 1 : -1, speed: 2 + R() });
  if (z >= 4) for (let i = roll(0.35 * deep); i--;) add('angler');
  if (z >= 3) for (let i = roll(0.045); i--;) add('squid');
  for (let i = roll(z === 0 ? 0.12 : 0.24); i--;) add('air');
  return { items, mobs };
}

// Decoração fixa do paredão (por metro)
export function decoAt(m) {
  const r = hash01(m * 31 + 7);
  return { r, r2: hash01(m * 17 + 3), r3: hash01(m * 53 + 11) };
}
