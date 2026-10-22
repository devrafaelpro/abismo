// Renderizador em canvas: o fundo do mar, a superfície, criaturas, luz e escuridão.
import { walls, decoAt, hash01, noise1 } from './world.js';
import { zoneAt, ZONES, BOATS, stationsBetween } from './data.js';
import { short } from './fmt.js';

// ---------- cores ----------
const colorCache = new Map();
function parse(c) {
  if (colorCache.has(c)) return colorCache.get(c);
  let r;
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1);
    r = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else {
    const m = c.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const f = n => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    r = [f(0), f(8), f(4)];
  }
  colorCache.set(c, r);
  return r;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function zoneSpan(y) {
  const z = zoneAt(y);
  const next = z.i + 1 < ZONES.length ? ZONES[z.i + 1].from : z.from + 8000;
  const f = Math.max(0, Math.min(1, (y - z.from) / (next - z.from)));
  return { z, f, nz: zoneAt(next + 1) };
}
export function waterAt(y) {
  const { z, f } = zoneSpan(Math.max(0, y));
  return mix(parse(z.top), parse(z.bot), f);
}
export function darkAt(y) {
  if (y < 0) return 0;
  const { z, f, nz } = zoneSpan(y);
  return z.dark + (nz.dark - z.dark) * Math.pow(f, 1.5);
}

const GEM_COLORS = [['#ff4d6d', '#8b0a22'], ['#3ddc84', '#0b6b38'], ['#4da3ff', '#0a3a8b'], ['#c77dff', '#4b1c80'], ['#ffd166', '#9a6b00']];
const FISH_COLORS = [['#ffd23f', '#f08a24'], ['#5ec8ff', '#1f6fb2'], ['#ff8a5c', '#d1453b'], ['#d9e3ea', '#7d8f9c']];

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.lc = document.createElement('canvas');
    this.lg = this.lc.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.shake = 0;
    this.parts = [];
    this.texts = [];
    this.snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.4 + Math.random() * 0.8, r: Math.random() }));
    this.gulls = Array.from({ length: 3 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.12, s: 0.01 + Math.random() * 0.01, ph: i * 2 }));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    this.W = W; this.H = H; this.dpr = dpr;
    this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr);
    this.c.style.width = W + 'px'; this.c.style.height = H + 'px';
    this.lc.width = Math.ceil(W / 2); this.lc.height = Math.ceil(H / 2);
    this.ppm = Math.max(15, Math.min(28, W / 21));
  }

  sx(x) { return (x - this.cam.x) * this.ppm + this.W / 2; }
  sy(y) { return (y - this.cam.y) * this.ppm + this.H * 0.45; }

  // ---------- partículas ----------
  burst(x, y, kind, n = 12, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      this.parts.push({ k: kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 0.8 + Math.random() * 0.8, t: 0, r: 0.05 + Math.random() * 0.1, color });
    }
  }
  bubbles(x, y, n = 6, big = false) {
    for (let i = 0; i < n; i++) this.parts.push({ k: 'bub', x: x + (Math.random() - 0.5) * 0.2, y: y + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.4, vy: -(1 + Math.random() * 1.3), life: 3 + Math.random() * 2, t: 0, r: (big ? 0.08 : 0.03) + Math.random() * (big ? 0.12 : 0.07), ph: Math.random() * 6 });
  }
  text(x, y, s, color = '#ffe08a', size = 1) { this.texts.push({ x, y, s, color, size, t: 0 }); }
  stepParts(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.k === 'bub') { p.vx += Math.sin(p.t * 6 + p.ph) * 0.8 * dt; p.vy -= 0.4 * dt; if (p.y < 0.05) p.t = p.life; }
      else { p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.6 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const t of this.texts) { t.t += dt; t.y -= dt * 0.9; }
    this.texts = this.texts.filter(t => t.t < 1.6);
    this.shake *= Math.exp(-dt * 8);
  }

  // ============ MERGULHO ============
  drawDive(dv, t, dt) {
    const g = this.g, W = this.W, H = this.H, P = this.ppm;
    const d = dv.d;
    // câmera com antecipação
    const tx = d.x + d.vx * 0.35, ty = d.y + d.vy * 0.45;
    const k = 1 - Math.exp(-dt * 4);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    const [L0, R0] = walls(this.cam.y);
    const half = W / 2 / P;
    if (R0 - L0 < half * 2) this.cam.x = Math.max(L0 + half - 1.5, Math.min(R0 - half + 1.5, this.cam.x));
    this.stepParts(dt);

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0.01) g.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
    const top = this.cam.y - H * 0.45 / P, bot = top + H / P;

    // água
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, rgb(waterAt(top)));
    grd.addColorStop(1, rgb(waterAt(bot)));
    g.fillStyle = grd; g.fillRect(-20, -20, W + 40, H + 40);
    if (top < 0) this.drawSurfaceFromBelow(top, t);

    // raios de sol
    if (this.cam.y < 220) this.drawRays(t, Math.max(0, 1 - this.cam.y / 220));

    // parede de fundo (profundidade)
    this.drawWalls(top, bot, t, true);
    this.drawMarineSnow(t, dt);
    this.drawStations(dv, top, bot, t);
    this.drawWalls(top, bot, t, false);

    // tesouros
    for (const it of dv.items) if (!it.dead && it.y > top - 2 && it.y < bot + 2) this.drawItem(it, t, dv);
    // criaturas
    for (const m of dv.mobs) if (!m.dead && m.y > top - 6 && m.y < bot + 6) this.drawMob(m, t, dv);
    // arpão
    for (const s of dv.shots) {
      g.strokeStyle = `rgba(220,240,255,${s.t * 4})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(this.sx(s.x1), this.sy(s.y1)); g.lineTo(this.sx(s.x2), this.sy(s.y2)); g.stroke();
    }
    this.drawDiver(dv, t);
    this.drawParts(false);

    // escuridão e luzes
    this.drawDarkness(dv, top, bot, t);
    this.drawParts(true);
    this.drawTexts();
    this.drawOverlays(dv, t);
  }

  drawSurfaceFromBelow(top, t) {
    const g = this.g, W = this.W;
    const y0 = this.sy(0);
    // céu acima da linha d'água
    const sk = g.createLinearGradient(0, this.sy(top), 0, y0);
    sk.addColorStop(0, '#7ec8e8'); sk.addColorStop(1, '#d6f2ff');
    g.fillStyle = sk;
    g.beginPath(); g.moveTo(-20, -20); g.lineTo(W + 20, -20);
    for (let x = W + 20; x >= -20; x -= 10) g.lineTo(x, y0 + Math.sin(x * 0.03 + t * 2) * 3 + Math.sin(x * 0.07 - t * 3) * 1.5);
    g.closePath(); g.fill();
    // brilho da superfície vista de baixo
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    g.beginPath();
    for (let x = -20; x <= W + 20; x += 10) { const y = y0 + Math.sin(x * 0.03 + t * 2) * 3 + Math.sin(x * 0.07 - t * 3) * 1.5; x === -20 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    // barco
    const bx = this.sx(walls(0)[0] + (walls(0)[1] - walls(0)[0]) / 2 + 3);
    g.fillStyle = 'rgba(20,30,40,0.85)';
    g.beginPath(); g.ellipse(bx, y0 + 4, 70, 12, 0, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(20,30,40,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(bx - 30, y0 + 10); g.lineTo(bx - 34, y0 + 120); g.stroke(); // corda
  }

  drawRays(t, a) {
    const g = this.g, W = this.W, H = this.H;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * W * 1.4 - W * 0.2 + Math.sin(t * 0.2 + i) * 30;
      const w = 30 + 40 * hash01(i * 13);
      const grd = g.createLinearGradient(0, 0, 0, H);
      const al = a * (0.07 + 0.05 * Math.sin(t * 0.7 + i * 2));
      grd.addColorStop(0, `rgba(220,255,255,${al})`); grd.addColorStop(1, 'rgba(220,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(x, -10); g.lineTo(x + w, -10); g.lineTo(x + w * 0.5 - 160, H); g.lineTo(x - w - 160, H); g.closePath(); g.fill();
    }
    g.restore();
  }

  drawMarineSnow(t, dt) {
    const g = this.g, W = this.W, H = this.H;
    g.fillStyle = 'rgba(220,240,255,0.55)';
    for (const s of this.snow) {
      const x = ((s.x * W - this.cam.x * this.ppm * s.z * 0.6 + Math.sin(t * 0.3 + s.r * 9) * 10) % W + W) % W;
      const y = ((s.y * H - this.cam.y * this.ppm * s.z * 0.6 + t * 6 * s.z) % H + H) % H;
      g.globalAlpha = 0.25 + s.z * 0.4;
      g.fillRect(x, y, 1.2 * s.z + 0.4, 1.2 * s.z + 0.4);
    }
    g.globalAlpha = 1;
  }

  drawWalls(top, bot, t, back) {
    const g = this.g, P = this.ppm, W = this.W;
    const step = 0.5;
    const y0 = Math.floor(top) - 1, y1 = Math.ceil(bot) + 1;
    const zc = zoneAt(this.cam.y);
    const water = waterAt(this.cam.y);
    const wc = parse(zc.wall), wc2 = parse(zc.wall2);
    const off = back ? 2.4 : 0;
    const colA = back ? mix(water, wc2, 0.45) : wc;
    const colB = back ? mix(water, wc2, 0.6) : wc2;
    for (const side of [0, 1]) {
      g.beginPath();
      const edgeX = side === 0 ? -30 : W + 30;
      g.moveTo(edgeX, this.sy(y0));
      for (let y = y0; y <= y1; y += step) {
        const w = walls(y);
        let x = side === 0 ? w[0] - off : w[1] + off;
        if (back) x += (side === 0 ? -1 : 1) * 1.5 * noise1(y / 7 + side * 50);
        g.lineTo(this.sx(x), this.sy(y));
      }
      g.lineTo(edgeX, this.sy(y1));
      g.closePath();
      const cx = this.sx(walls(this.cam.y)[side]);
      const grd = g.createLinearGradient(cx, 0, side === 0 ? cx - 160 : cx + 160, 0);
      grd.addColorStop(0, rgb(colA)); grd.addColorStop(1, rgb(colB));
      g.fillStyle = grd; g.fill();
      if (!back) {
        g.strokeStyle = rgb(mix(colA, [255, 255, 255], 0.12), 0.7); g.lineWidth = 2; g.stroke();
      }
    }
    if (!back) this.drawDeco(y0, y1, t, zc);
  }

  drawDeco(y0, y1, t, zc) {
    const g = this.g, P = this.ppm;
    for (let m = Math.max(0, y0); m <= y1; m++) {
      const z = zoneAt(m);
      const r = decoAt(m);
      const w = walls(m);
      for (const side of [0, 1]) {
        const rr = side ? r.r2 : r.r;
        const x = w[side], dir = side ? -1 : 1;
        const X = this.sx(x), Y = this.sy(m + r.r3);
        // pedrinhas na parede
        if (rr > 0.55 && rr < 0.75) {
          g.fillStyle = rgb(parse(z.wall2), 0.6);
          g.beginPath(); g.ellipse(X + dir * P * 0.2, Y, P * (0.2 + rr * 0.3), P * 0.15, 0, 0, 6.28); g.fill();
        }
        if (z.deco === 'coral' || (z.deco === 'wreck' && m < 90)) {
          if (rr < 0.3) this.coral(X, Y, dir, rr, t);
          else if (rr > 0.9) this.kelp(X, Y, dir, rr, t);
        } else if (z.deco === 'wreck') {
          if (rr < 0.05) this.wreck(X, Y, dir, rr);
          else if (rr > 0.93) this.kelp(X, Y, dir, rr, t);
        } else if (z.deco === 'rock') {
          if (rr < 0.12) this.spike(X, Y, dir, rr, z);
        } else if (z.deco === 'vent') {
          if (rr < 0.06) this.vent(X, Y, dir, rr, t);
          else if (rr < 0.16) this.spike(X, Y, dir, rr, z);
        } else if (z.deco === 'ruins') {
          if (rr < 0.08) this.column(X, Y, dir, rr, t);
        } else if (z.deco === 'crystal') {
          if (rr < 0.2) this.crystal(X, Y, dir, rr, z);
        } else if (z.deco === 'bio') {
          if (rr < 0.16) this.spike(X, Y, dir, rr, z);
        }
      }
    }
  }
  coral(X, Y, dir, r, t) {
    const g = this.g, P = this.ppm;
    const cols = ['#ff7a8a', '#ffb347', '#c792ea', '#ff5e9c', '#7ee0c3'];
    const c = cols[Math.floor(r * 100) % cols.length];
    g.strokeStyle = c; g.lineCap = 'round';
    if (r < 0.15) {
      // coral galhudo
      const br = (x, y, a, len, d) => {
        if (d > 3) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = Math.max(1.5, (4 - d) * P * 0.06);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        br(x2, y2, a - 0.45 + Math.sin(t + d) * 0.03, len * 0.72, d + 1);
        br(x2, y2, a + 0.5, len * 0.68, d + 1);
      };
      br(X, Y, dir > 0 ? -0.6 : Math.PI + 0.6, P * 0.7, 0);
    } else {
      // leque
      g.fillStyle = c; g.globalAlpha = 0.75;
      g.beginPath(); g.moveTo(X, Y);
      g.arc(X, Y, P * 0.9, dir > 0 ? -1.4 : Math.PI + 0.2, dir > 0 ? -0.2 : Math.PI + 1.4);
      g.closePath(); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = (dir > 0 ? -1.4 : Math.PI + 0.2) + i * 0.24; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * P * 0.85, Y + Math.sin(a) * P * 0.85); g.stroke(); }
    }
  }
  kelp(X, Y, dir, r, t) {
    const g = this.g, P = this.ppm;
    g.strokeStyle = r > 0.95 ? '#4f8f3a' : '#3c7a3a'; g.lineWidth = P * 0.13; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X, Y);
    const len = 3 + r * 4;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10;
      g.lineTo(X + dir * P * f * 1.2 + Math.sin(t * 1.2 + f * 3 + r * 10) * P * 0.35 * f, Y - P * len * f);
    }
    g.stroke();
  }
  wreck(X, Y, dir, r) {
    const g = this.g, P = this.ppm;
    g.fillStyle = '#2b2620'; g.strokeStyle = '#4a3f33'; g.lineWidth = 2;
    // casco quebrado
    g.beginPath(); g.moveTo(X, Y - P * 2);
    g.quadraticCurveTo(X + dir * P * 4, Y - P * 1.5, X + dir * P * 5, Y + P * 0.5);
    g.lineTo(X + dir * P * 4.2, Y + P * 1.2); g.lineTo(X, Y + P * 1.4); g.closePath(); g.fill(); g.stroke();
    // costelas
    g.strokeStyle = '#3b332a'; g.lineWidth = P * 0.12;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(X + dir * P * i * 0.9, Y - P * (1.6 - i * 0.15)); g.lineTo(X + dir * P * (i * 0.9 + 0.3), Y - P * 3.4 + i * P * 0.2); g.stroke(); }
    // vigia
    g.fillStyle = 'rgba(255,220,140,0.15)';
    g.beginPath(); g.arc(X + dir * P * 2.2, Y - P * 0.2, P * 0.3, 0, 6.28); g.fill();
  }
  spike(X, Y, dir, r, z) {
    const g = this.g, P = this.ppm;
    g.fillStyle = rgb(parse(z.wall));
    g.beginPath(); g.moveTo(X, Y - P * 0.5); g.lineTo(X + dir * P * (0.8 + r * 8), Y + P * (r - 0.05) * 4); g.lineTo(X, Y + P * 0.6); g.closePath(); g.fill();
  }
  vent(X, Y, dir, r, t) {
    const g = this.g, P = this.ppm;
    g.fillStyle = '#1d0e09';
    g.beginPath(); g.moveTo(X, Y + P); g.lineTo(X + dir * P * 1.6, Y + P * 0.8); g.lineTo(X + dir * P * 1.2, Y - P * 1.2); g.lineTo(X + dir * P * 0.5, Y - P * 1.3); g.closePath(); g.fill();
    // fumaça preta subindo
    for (let i = 0; i < 6; i++) {
      const f = ((t * 0.5 + i / 6 + r * 7) % 1);
      g.fillStyle = `rgba(15,10,10,${0.5 * (1 - f)})`;
      g.beginPath(); g.arc(X + dir * P * 0.9 + Math.sin(f * 6 + i) * P * 0.4, Y - P * 1.3 - f * P * 4, P * (0.3 + f * 0.7), 0, 6.28); g.fill();
    }
  }
  column(X, Y, dir, r, t) {
    const g = this.g, P = this.ppm;
    const x = X + dir * P * 1.2;
    g.fillStyle = '#2f6a72';
    g.fillRect(x - P * 0.35, Y - P * 3.5, P * 0.7, P * 4);
    g.fillStyle = '#3f8892';
    g.fillRect(x - P * 0.55, Y - P * 3.8, P * 1.1, P * 0.35);
    g.fillRect(x - P * 0.55, Y + P * 0.3, P * 1.1, P * 0.35);
    g.fillStyle = `rgba(90,255,255,${0.4 + 0.3 * Math.sin(t * 2 + r * 50)})`;
    for (let i = 0; i < 3; i++) g.fillRect(x - P * 0.1, Y - P * (2.8 - i * 0.9), P * 0.2, P * 0.4);
  }
  crystal(X, Y, dir, r, z) {
    const g = this.g, P = this.ppm;
    for (let i = 0; i < 3; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + (i - 1) * 0.5 - 0.3;
      const len = P * (0.8 + r * 6 + i * 0.4);
      const bx = X, by = Y + i * P * 0.2;
      g.fillStyle = i % 2 ? 'rgba(200,140,255,0.8)' : 'rgba(150,100,240,0.85)';
      g.beginPath();
      g.moveTo(bx + Math.cos(a + 1.57) * P * 0.2, by + Math.sin(a + 1.57) * P * 0.2);
      g.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
      g.lineTo(bx + Math.cos(a - 1.57) * P * 0.2, by + Math.sin(a - 1.57) * P * 0.2);
      g.closePath(); g.fill();
    }
  }

  drawStations(dv, top, bot, t) {
    const g = this.g, P = this.ppm;
    for (const st of stationsBetween(top - 3, bot + 3)) {
      const y = st.y;
      const w = walls(y);
      const cx = (w[0] + w[1]) / 2;
      const X = this.sx(cx), Y = this.sy(y);
      const owned = dv.stations > st.k;
      // plataforma
      g.fillStyle = owned ? '#2d3d4a' : '#1c252c';
      g.fillRect(this.sx(w[0]), Y - P * 0.25, (w[1] - w[0]) * P, P * 0.5);
      // domo
      g.fillStyle = owned ? '#3c5566' : '#222d35';
      g.beginPath(); g.ellipse(X, Y - P * 0.2, P * 3.2, P * 2, 0, Math.PI, 0); g.fill();
      g.strokeStyle = owned ? 'rgba(160,220,255,0.5)' : 'rgba(120,140,150,0.3)'; g.lineWidth = 2; g.stroke();
      // janelas
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = owned ? `rgba(255,220,140,${0.7 + 0.2 * Math.sin(t * 2 + i)})` : 'rgba(80,90,100,0.6)';
        g.beginPath(); g.arc(X + i * P * 1.1, Y - P * 0.9, P * 0.28, 0, 6.28); g.fill();
      }
      // escotilha
      if (dv.startY === y) {
        g.fillStyle = '#0b1218';
        g.beginPath(); g.ellipse(X, Y + P * 0.25, P * 0.9, P * 0.3, 0, 0, 6.28); g.fill();
        g.strokeStyle = '#ffcf5a'; g.lineWidth = 2; g.stroke();
      }
      g.fillStyle = owned ? 'rgba(255,230,170,0.9)' : 'rgba(180,190,200,0.5)';
      g.font = `700 ${Math.round(P * 0.62)}px "Barlow Condensed", sans-serif`;
      g.textAlign = 'center';
      g.fillText(`ESTAÇÃO ${y} m${owned ? '' : ' · ABANDONADA'}`, X, Y - P * 2.6);
    }
  }

  // ---------- tesouros ----------
  drawItem(it, t, dv) {
    const g = this.g, P = this.ppm;
    const X = this.sx(it.x), Y = this.sy(it.y + Math.sin(t * 1.5 + it.ph) * 0.06);
    const sc = it.type === 'art' || it.type === 'chest' ? 1.35 : 1.85;
    g.save(); g.translate(X, Y); g.scale(P * sc, P * sc);
    switch (it.type) {
      case 'coin': {
        const sw = Math.abs(Math.cos(t * 2 + it.ph));
        const gr = g.createLinearGradient(-0.2, -0.2, 0.2, 0.2);
        gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.5, '#f2c230'); gr.addColorStop(1, '#a8740d');
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.22 * Math.max(0.15, sw), 0.22, 0, 0, 6.28); g.fill();
        g.strokeStyle = '#8a5c0e'; g.lineWidth = 0.03; g.stroke();
        break;
      }
      case 'shell': {
        g.fillStyle = '#f7c6b5'; g.strokeStyle = '#c98572'; g.lineWidth = 0.025;
        g.beginPath(); g.moveTo(0, 0.18); g.arc(0, 0.18, 0.32, -2.6, -0.54); g.closePath(); g.fill(); g.stroke();
        for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.48; g.beginPath(); g.moveTo(0, 0.18); g.lineTo(Math.cos(a) * 0.3, 0.18 + Math.sin(a) * 0.3); g.stroke(); }
        break;
      }
      case 'pearl': {
        g.fillStyle = '#6d6a78'; g.beginPath(); g.ellipse(0, 0.12, 0.3, 0.12, 0, 0, Math.PI); g.fill();
        g.fillStyle = '#8c8798'; g.beginPath(); g.ellipse(0, 0.0, 0.3, 0.1, 0, Math.PI, 6.28); g.fill();
        const gr = g.createRadialGradient(-0.05, -0.02, 0.01, 0, 0.04, 0.14);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c9d6e8');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0.04, 0.12, 0, 6.28); g.fill();
        break;
      }
      case 'gem': {
        const [c1, c2] = GEM_COLORS[it.hue % GEM_COLORS.length];
        g.rotate(Math.sin(t + it.ph) * 0.2);
        g.fillStyle = c2; g.beginPath(); g.moveTo(0, -0.24); g.lineTo(0.2, -0.06); g.lineTo(0, 0.26); g.lineTo(-0.2, -0.06); g.closePath(); g.fill();
        g.fillStyle = c1; g.beginPath(); g.moveTo(0, -0.24); g.lineTo(0.2, -0.06); g.lineTo(0, 0.02); g.lineTo(-0.2, -0.06); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(-0.06, -0.16); g.lineTo(0.02, -0.18); g.lineTo(-0.02, -0.08); g.closePath(); g.fill();
        break;
      }
      case 'gold': {
        const gr = g.createLinearGradient(0, -0.15, 0, 0.15);
        gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.4, '#f2c230'); gr.addColorStop(1, '#9a6a08');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-0.28, 0.13); g.lineTo(0.28, 0.13); g.lineTo(0.2, -0.12); g.lineTo(-0.2, -0.12); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,220,0.8)'; g.lineWidth = 0.03;
        g.beginPath(); g.moveTo(-0.16, -0.08); g.lineTo(0.12, -0.08); g.stroke();
        break;
      }
      case 'chest': {
        const open = dv.chest === it ? dv.chestT : 0;
        if (dv.chest === it) {
          g.strokeStyle = 'rgba(255,215,100,0.9)'; g.lineWidth = 0.07;
          g.beginPath(); g.arc(0, 0, 0.75, -Math.PI / 2, -Math.PI / 2 + open * 6.283); g.stroke();
        }
        g.fillStyle = '#6b4320'; g.fillRect(-0.42, -0.08, 0.84, 0.4);
        g.fillStyle = '#d9a52b'; g.fillRect(-0.42, -0.08, 0.84, 0.06); g.fillRect(-0.3, -0.08, 0.07, 0.4); g.fillRect(0.23, -0.08, 0.07, 0.4);
        if (open > 0) {
          const gl = g.createRadialGradient(0, -0.1, 0, 0, -0.1, 0.6);
          gl.addColorStop(0, `rgba(255,220,120,${open})`); gl.addColorStop(1, 'rgba(255,220,120,0)');
          g.fillStyle = gl; g.beginPath(); g.arc(0, -0.1, 0.6, 0, 6.28); g.fill();
        }
        g.save(); g.translate(-0.42, -0.08); g.rotate(-open * 1.2);
        g.fillStyle = '#7d5026'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0.84, 0); g.quadraticCurveTo(0.84, -0.3, 0.42, -0.3); g.quadraticCurveTo(0, -0.3, 0, 0); g.fill();
        g.fillStyle = '#d9a52b'; g.fillRect(0.38, -0.12, 0.09, 0.12);
        g.restore();
        break;
      }
      case 'art': {
        const z = zoneAt(it.y);
        const gc = parse(z.glow);
        const pulse = 0.7 + 0.3 * Math.sin(t * 3 + it.ph);
        g.save(); g.globalCompositeOperation = 'lighter';
        g.rotate(t * 0.3);
        for (let i = 0; i < 8; i++) {
          g.rotate(Math.PI / 4);
          g.fillStyle = rgb(gc, 0.12 * pulse);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-0.12, 1.4); g.lineTo(0.12, 1.4); g.closePath(); g.fill();
        }
        g.restore();
        this.artShape(it.shape, t);
        break;
      }
    }
    // brilho
    const gl = (t * 0.7 + it.ph) % 3;
    if (gl < 0.25) {
      const s = Math.sin(gl / 0.25 * Math.PI) * 0.22;
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(0.12 - s, -0.12); g.lineTo(0.12 + s, -0.12); g.moveTo(0.12, -0.12 - s); g.lineTo(0.12, -0.12 + s); g.stroke();
    }
    g.restore();
  }
  artShape(shape, t) {
    const g = this.g;
    const gr = g.createLinearGradient(0, -0.4, 0, 0.4);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#f0b92b'); gr.addColorStop(1, '#8a5a06');
    g.fillStyle = gr; g.strokeStyle = '#6d4704'; g.lineWidth = 0.03;
    g.beginPath();
    switch (shape) {
      case 'amphora': g.moveTo(-0.08, -0.38); g.lineTo(0.08, -0.38); g.quadraticCurveTo(0.34, -0.1, 0.12, 0.38); g.lineTo(-0.12, 0.38); g.quadraticCurveTo(-0.34, -0.1, -0.08, -0.38); break;
      case 'crown': g.moveTo(-0.32, 0.18); g.lineTo(-0.32, -0.2); g.lineTo(-0.16, -0.02); g.lineTo(0, -0.3); g.lineTo(0.16, -0.02); g.lineTo(0.32, -0.2); g.lineTo(0.32, 0.18); break;
      case 'orb': g.arc(0, 0, 0.28, 0, 6.28); break;
      case 'idol': g.arc(0, -0.2, 0.14, 0, 6.28); g.moveTo(-0.16, -0.04); g.lineTo(0.16, -0.04); g.lineTo(0.22, 0.38); g.lineTo(-0.22, 0.38); break;
      case 'bell': g.moveTo(-0.05, -0.36); g.lineTo(0.05, -0.36); g.quadraticCurveTo(0.24, -0.25, 0.3, 0.3); g.lineTo(-0.3, 0.3); g.quadraticCurveTo(-0.24, -0.25, -0.05, -0.36); break;
      default: g.moveTo(-0.03, 0.4); g.lineTo(-0.03, -0.15); g.lineTo(-0.25, -0.15); g.lineTo(-0.25, -0.4); g.lineTo(-0.18, -0.25); g.lineTo(-0.06, -0.25); g.lineTo(0, -0.45); g.lineTo(0.06, -0.25); g.lineTo(0.18, -0.25); g.lineTo(0.25, -0.4); g.lineTo(0.25, -0.15); g.lineTo(0.03, -0.15); g.lineTo(0.03, 0.4);
    }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-0.08, -0.1, 0.04, 0.12, 0.3, 0, 6.28); g.fill();
  }

  // ---------- criaturas ----------
  drawMob(m, t, dv) {
    const g = this.g, P = this.ppm;
    const X = this.sx(m.x), Y = this.sy(m.y);
    g.save(); g.translate(X, Y); g.scale(P, P);
    switch (m.t) {
      case 'jelly': {
        const pulse = 1 + Math.sin(m.ph * 3) * 0.12;
        const glow = m.glow;
        const c1 = glow ? 'rgba(120,255,240,0.55)' : 'rgba(255,160,210,0.55)', c2 = glow ? 'rgba(60,180,255,0.15)' : 'rgba(200,120,255,0.15)';
        g.strokeStyle = glow ? 'rgba(140,255,240,0.5)' : 'rgba(255,190,230,0.45)'; g.lineWidth = 0.035;
        for (let i = 0; i < 6; i++) {
          const x0 = -0.3 + i * 0.12;
          g.beginPath(); g.moveTo(x0, 0);
          for (let j = 1; j <= 8; j++) g.lineTo(x0 + Math.sin(m.ph * 2 + j * 0.6 + i) * 0.08 * j * 0.3, j * 0.16);
          g.stroke();
        }
        const gr = g.createRadialGradient(0, -0.15, 0.02, 0, -0.1, 0.5);
        gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(0, 0, 0.45 * pulse, 0.42 / pulse, 0, Math.PI, 0); g.quadraticCurveTo(0, 0.12, -0.45 * pulse, 0); g.fill();
        if (m.stun) { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill(); }
        break;
      }
      case 'fish': {
        for (let i = 0; i < m.n; i++) {
          const a = i * 2.39996 + m.seed * 10;
          const ox = Math.cos(a) * (0.6 + (i % 4) * 0.5) + Math.sin(m.ph * 1.3 + i) * 0.25;
          const oy = Math.sin(a) * (0.4 + (i % 3) * 0.35) + Math.cos(m.ph * 1.7 + i) * 0.15;
          const dir = m.vx >= 0 ? 1 : -1;
          const [c1, c2] = FISH_COLORS[m.hue % FISH_COLORS.length];
          g.save(); g.translate(ox * 1.3, oy * 1.3); g.scale(dir * 1.6, 1.6);
          const wag = Math.sin(m.ph * 12 + i) * 0.06;
          g.fillStyle = c2; g.beginPath(); g.moveTo(-0.16, 0); g.lineTo(-0.3, -0.09 + wag); g.lineTo(-0.3, 0.09 + wag); g.closePath(); g.fill();
          const gr = g.createLinearGradient(0, -0.08, 0, 0.08); gr.addColorStop(0, c2); gr.addColorStop(0.5, c1); gr.addColorStop(1, '#fff8');
          g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.19, 0.075, 0, 0, 6.28); g.fill();
          g.fillStyle = '#111'; g.beginPath(); g.arc(0.11, -0.015, 0.018, 0, 6.28); g.fill();
          g.restore();
        }
        break;
      }
      case 'eel': {
        const ext = Math.max(0.35, m.ext);
        g.scale(m.dir, 1);
        g.strokeStyle = '#4a5a2a'; g.lineWidth = 0.26; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-0.2, 0);
        for (let i = 1; i <= 10; i++) { const f = i / 10; g.lineTo(f * ext, Math.sin(m.ph * 8 - f * 6) * 0.12 * f); }
        g.stroke();
        g.strokeStyle = '#6b7d3b'; g.lineWidth = 0.08; g.stroke();
        const hy = Math.sin(m.ph * 8 - 6) * 0.12;
        g.fillStyle = '#4a5a2a';
        g.beginPath(); g.ellipse(ext + 0.1, hy, 0.24, 0.15, 0, 0, 6.28); g.fill();
        const jaw = m.st === 'out' ? 0.35 : 0.08;
        g.fillStyle = '#2b0d0d'; g.beginPath(); g.moveTo(ext + 0.12, hy); g.lineTo(ext + 0.36, hy - jaw * 0.5); g.lineTo(ext + 0.36, hy + jaw * 0.5); g.closePath(); g.fill();
        g.fillStyle = '#ffe66b'; g.beginPath(); g.arc(ext + 0.13, hy - 0.06, 0.04, 0, 6.28); g.fill();
        break;
      }
      case 'shark': {
        const f = m.face || 1;
        g.scale(f, 1);
        if (m.stun) g.rotate(Math.sin(t * 8) * 0.15);
        const sw = Math.sin(m.ph * (m.st === 'charge' ? 14 : 6)) * 0.18;
        // cauda
        g.fillStyle = '#3e5566';
        g.beginPath(); g.moveTo(-1.3, 0); g.lineTo(-1.9, -0.65 + sw); g.lineTo(-1.7, 0 + sw * 0.5); g.lineTo(-1.85, 0.45 + sw); g.closePath(); g.fill();
        // corpo
        const gr = g.createLinearGradient(0, -0.4, 0, 0.4);
        gr.addColorStop(0, '#4f6b80'); gr.addColorStop(0.55, '#6f8ea3'); gr.addColorStop(0.6, '#d7e1e8'); gr.addColorStop(1, '#c5d0d8');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(1.55, 0.05);
        g.quadraticCurveTo(1.2, -0.42, 0.2, -0.42); g.quadraticCurveTo(-0.9, -0.35, -1.4, 0);
        g.quadraticCurveTo(-0.9, 0.3, 0.2, 0.36); g.quadraticCurveTo(1.2, 0.36, 1.55, 0.05); g.fill();
        // barbatanas
        g.fillStyle = '#4a6578';
        g.beginPath(); g.moveTo(0.3, -0.4); g.lineTo(-0.15, -0.95); g.lineTo(-0.35, -0.38); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0.4, 0.25); g.lineTo(0.0, 0.75 + sw * 0.3); g.lineTo(-0.1, 0.28); g.closePath(); g.fill();
        // guelras e olho
        g.strokeStyle = 'rgba(30,45,55,0.6)'; g.lineWidth = 0.025;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0.65 - i * 0.1, -0.18); g.lineTo(0.6 - i * 0.1, 0.12); g.stroke(); }
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(1.1, -0.1, 0.05, 0, 6.28); g.fill();
        if (m.st === 'charge') { g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(1.05 + i * 0.08, 0.14); g.lineTo(1.09 + i * 0.08, 0.22); g.lineTo(1.13 + i * 0.08, 0.14); g.fill(); } }
        break;
      }
      case 'angler': {
        g.scale(m.face || 1, 1);
        const open = m.st === 'bite' ? 0.35 : 0.12;
        const gr = g.createRadialGradient(-0.1, -0.1, 0.05, 0, 0, 0.6);
        gr.addColorStop(0, '#3a2a2a'); gr.addColorStop(1, '#120a0a');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 0.55, 0.3 + open, Math.PI * 2 - 0.3 - open); g.lineTo(0.1, 0); g.closePath(); g.fill();
        g.fillStyle = '#e8e0d0';
        for (let i = 0; i < 6; i++) {
          const a = 0.35 + open + i * 0.05;
          g.beginPath(); g.moveTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5); g.lineTo(Math.cos(a) * 0.3 + 0.05, Math.sin(a) * 0.2 - 0.02); g.lineTo(Math.cos(a + 0.05) * 0.5, Math.sin(a + 0.05) * 0.5); g.fill();
          g.beginPath(); g.moveTo(Math.cos(-a) * 0.5, Math.sin(-a) * 0.5); g.lineTo(Math.cos(-a) * 0.3 + 0.05, Math.sin(-a) * 0.2 + 0.02); g.lineTo(Math.cos(-a - 0.05) * 0.5, Math.sin(-a - 0.05) * 0.5); g.fill();
        }
        g.fillStyle = '#d8f6ff'; g.beginPath(); g.arc(0.12, -0.28, 0.06, 0, 6.28); g.fill();
        // isca
        g.strokeStyle = '#2a1d1d'; g.lineWidth = 0.04;
        const lx = 0.9 + Math.sin(m.ph * 2) * 0.08, ly = -0.85 + Math.cos(m.ph * 1.5) * 0.06;
        g.beginPath(); g.moveTo(0.05, -0.5); g.quadraticCurveTo(0.6, -1.2, lx, ly); g.stroke();
        g.fillStyle = '#dfffff'; g.beginPath(); g.arc(lx, ly, 0.09, 0, 6.28); g.fill();
        m.lure = [m.x + lx * (m.face || 1), m.y + ly];
        break;
      }
      case 'squid': {
        const dvv = dv.d;
        const SQ = 1.8;
        g.scale(SQ, SQ);
        const grab = dv.grab && dv.grab.m === m;
        g.strokeStyle = '#a3402f'; g.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          g.lineWidth = 0.12 - i * 0.008;
          g.beginPath(); g.moveTo(-0.3 + i * 0.09, 0.9);
          if (grab) {
            const tx = (dvv.x - m.x) / SQ + Math.sin(t * 3 + i) * 0.2, ty = (dvv.y - m.y) / SQ + Math.cos(t * 3 + i) * 0.2;
            g.quadraticCurveTo(tx * 0.5 + Math.sin(t * 2 + i) * 0.8, 1.6 + ty * 0.3, tx, ty);
          } else {
            for (let j = 1; j <= 10; j++) g.lineTo(-0.3 + i * 0.09 + Math.sin(m.ph * 1.5 + j * 0.5 + i) * 0.12 * j * 0.4, 0.9 + j * 0.32);
          }
          g.stroke();
        }
        const gr = g.createLinearGradient(-0.6, 0, 0.6, 0);
        gr.addColorStop(0, '#7a2a1e'); gr.addColorStop(0.5, '#c4553f'); gr.addColorStop(1, '#7a2a1e');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -2.2); g.quadraticCurveTo(0.75, -0.6, 0.55, 0.9); g.lineTo(-0.55, 0.9); g.quadraticCurveTo(-0.75, -0.6, 0, -2.2); g.fill();
        g.fillStyle = '#ffde59'; g.beginPath(); g.arc(-0.25, 0.55, 0.13, 0, 6.28); g.arc(0.25, 0.55, 0.13, 0, 6.28); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(-0.25, 0.57, 0.06, 0, 6.28); g.arc(0.25, 0.57, 0.06, 0, 6.28); g.fill();
        break;
      }
      case 'air': {
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4 + m.ph, r = 0.12 + (i % 3) * 0.08;
          const x = Math.cos(a * 0.7) * 0.35, y = Math.sin(a) * 0.3;
          g.strokeStyle = 'rgba(220,250,255,0.85)'; g.lineWidth = 0.035;
          g.beginPath(); g.arc(x, y, r, 0, 6.28); g.stroke();
          g.fillStyle = 'rgba(200,245,255,0.18)'; g.fill();
          g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, 6.28); g.fill();
        }
        break;
      }
    }
    g.restore();
  }

  // ---------- mergulhador ----------
  drawDiver(dv, t) {
    const g = this.g, P = this.ppm, d = dv.d;
    const X = this.sx(d.x), Y = this.sy(d.y);
    // bolhas de respiração
    const breath = (t % 3.6) / 3.6;
    if (breath > 0.55 && breath < 0.6 && Math.random() < 0.5) {
      const hx = d.x + Math.cos(d.ang) * 0.7, hy = d.y + Math.sin(d.ang) * 0.7 - 0.15;
      this.bubbles(hx, hy, 2);
    }
    g.save(); g.translate(X, Y); g.rotate(d.ang);
    if (Math.cos(d.ang) < 0) g.scale(1, -1);
    g.scale(P * 1.2, P * 1.2);
    if (d.hurt > 0 && Math.floor(d.hurt * 12) % 2 === 0) g.globalAlpha = 0.5;
    const kick = Math.sin(d.kick * 3);
    // pés de pato
    for (const s of [-1, 1]) {
      g.save(); g.translate(-0.78, 0.02 * s); g.rotate(kick * 0.35 * s);
      g.fillStyle = s > 0 ? '#e0a612' : '#f5c02a';
      g.beginPath(); g.moveTo(0, -0.05); g.lineTo(-0.5, -0.16); g.lineTo(-0.52, 0.12); g.lineTo(0, 0.06); g.closePath(); g.fill();
      g.restore();
    }
    // pernas
    g.strokeStyle = '#141b26'; g.lineCap = 'round'; g.lineWidth = 0.17;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(-0.2, 0); g.lineTo(-0.5, 0.03 + kick * 0.06 * s); g.lineTo(-0.78, 0.02 * s + kick * 0.04 * s); g.stroke();
    }
    // cilindro
    const tg = g.createLinearGradient(0, -0.36, 0, -0.14);
    tg.addColorStop(0, '#ffe07a'); tg.addColorStop(1, '#c9921a');
    g.fillStyle = tg;
    g.beginPath(); g.roundRect(-0.32, -0.36, 0.7, 0.2, 0.1); g.fill();
    g.fillStyle = '#555'; g.fillRect(0.36, -0.31, 0.06, 0.1);
    // corpo
    const bg = g.createLinearGradient(0, -0.2, 0, 0.2);
    bg.addColorStop(0, '#2a3546'); bg.addColorStop(1, '#0f141c');
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(-0.28, -0.18, 0.78, 0.36, 0.17); g.fill();
    g.fillStyle = '#19c3b5'; g.fillRect(-0.15, -0.18, 0.05, 0.36); g.fillRect(0.3, -0.18, 0.04, 0.36);
    // braço
    const reach = dv.target ? 1 : 0.4;
    g.strokeStyle = '#141b26'; g.lineWidth = 0.12;
    g.beginPath(); g.moveTo(0.35, 0.08); g.lineTo(0.55 + reach * 0.15, 0.2 + Math.sin(d.kick * 1.5) * 0.04); g.lineTo(0.75 + reach * 0.15, 0.18); g.stroke();
    // cabeça e máscara
    g.fillStyle = '#141b26'; g.beginPath(); g.arc(0.62, -0.02, 0.15, 0, 6.28); g.fill();
    const mg = g.createLinearGradient(0.66, -0.1, 0.8, 0.06);
    mg.addColorStop(0, '#bff7ff'); mg.addColorStop(1, '#2b8fb3');
    g.fillStyle = mg; g.beginPath(); g.roundRect(0.66, -0.1, 0.12, 0.13, 0.04); g.fill();
    g.strokeStyle = '#f5c02a'; g.lineWidth = 0.025; g.stroke();
    // lanterna na cabeça
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(0.7, -0.15, 0.035, 0, 6.28); g.fill();
    // mangueira
    g.strokeStyle = '#333'; g.lineWidth = 0.03;
    g.beginPath(); g.moveTo(0.38, -0.26); g.quadraticCurveTo(0.55, -0.3, 0.7, 0.04); g.stroke();
    g.restore();
  }

  drawParts(glowPass) {
    const g = this.g, P = this.ppm;
    for (const p of this.parts) {
      const X = this.sx(p.x), Y = this.sy(p.y);
      const a = 1 - p.t / p.life;
      if (p.k === 'bub' && !glowPass) {
        g.strokeStyle = `rgba(210,245,255,${0.7 * a})`; g.lineWidth = 1;
        g.beginPath(); g.arc(X, Y, p.r * P, 0, 6.28); g.stroke();
        g.fillStyle = `rgba(255,255,255,${0.6 * a})`; g.beginPath(); g.arc(X - p.r * P * 0.35, Y - p.r * P * 0.35, p.r * P * 0.25, 0, 6.28); g.fill();
      } else if (p.k !== 'bub' && glowPass) {
        g.save(); g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.color || `rgba(255,220,120,${a})`;
        g.globalAlpha = a;
        g.beginPath(); g.arc(X, Y, p.r * P * (p.k === 'spark' ? 1 : 1.4), 0, 6.28); g.fill();
        g.restore();
      }
    }
  }
  drawTexts() {
    const g = this.g, P = this.ppm;
    g.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.min(1, (1.6 - t.t) * 2);
      const s = Math.round(P * 0.72 * t.size * (t.t < 0.15 ? 0.7 + t.t * 2 : 1));
      g.font = `800 ${s}px "Barlow Condensed", sans-serif`;
      g.lineWidth = 3; g.strokeStyle = `rgba(0,0,0,${0.6 * a})`;
      g.strokeText(t.s, this.sx(t.x), this.sy(t.y));
      g.fillStyle = t.color; g.globalAlpha = a;
      g.fillText(t.s, this.sx(t.x), this.sy(t.y));
      g.globalAlpha = 1;
    }
  }

  // ---------- escuridão ----------
  drawDarkness(dv, top, bot, t) {
    const dk = Math.min(0.9, darkAt(this.cam.y) * 0.95);
    const g = this.g, lg = this.lg, W = this.W, H = this.H, P = this.ppm;
    const lights = [];
    const d = dv.d;
    const s = 0.5; // escala do canvas de luz
    // luzes do cenário
    for (const m of dv.mobs) {
      if (m.dead || m.y < top - 5 || m.y > bot + 5) continue;
      if (m.t === 'jelly' && m.glow) lights.push([m.x, m.y, 3, 0.55, '#5ff']);
      if (m.t === 'angler' && m.lure) lights.push([m.lure[0], m.lure[1], 2.6, 0.95, '#bff']);
      if (m.t === 'air') lights.push([m.x, m.y, 2.2, 0.5, '#bef']);
    }
    for (const it of dv.items) {
      if (it.dead || it.y < top - 3 || it.y > bot + 3) continue;
      if (it.type === 'art') lights.push([it.x, it.y, 3.5, 0.8, zoneAt(it.y).glow]);
      else if (dk > 0.6) lights.push([it.x, it.y, 0.6, 0.35, null]);
    }
    for (const st of stationsBetween(top - 5, bot + 5)) { const w = walls(st.y); lights.push([(w[0] + w[1]) / 2, st.y - 0.9, dv.stations > st.k ? 9 : 3, 0.9, '#fd9']); }
    // deco que brilha
    for (let m = Math.max(0, Math.floor(top)); m <= bot; m++) {
      const z = zoneAt(m);
      if (z.deco !== 'bio' && z.deco !== 'vent' && z.deco !== 'ruins' && z.deco !== 'crystal') continue;
      const r = decoAt(m), w = walls(m);
      for (const side of [0, 1]) {
        const rr = side ? r.r2 : r.r;
        const x = w[side] + (side ? -0.6 : 0.6);
        if (z.deco === 'bio' && rr > 0.68) lights.push([x, m + r.r3, 1 + rr, 0.45 + 0.25 * Math.sin(t * 2 + m), z.glow]);
        if (z.deco === 'vent' && rr < 0.06) lights.push([w[side] + (side ? -1 : 1), m + r.r3, 5, 0.8, '#f73']);
        if (z.deco === 'ruins' && rr < 0.08) lights.push([w[side] + (side ? -1.2 : 1.2), m + r.r3 - 1.5, 4, 0.7, '#4ff']);
        if (z.deco === 'crystal' && rr < 0.2) lights.push([x, m + r.r3, 3, 0.6, '#c8f']);
      }
    }
    if (dk > 0.02) {
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.globalCompositeOperation = 'source-over';
      lg.clearRect(0, 0, this.lc.width, this.lc.height);
      const wc = waterAt(this.cam.y + 30);
      lg.fillStyle = `rgba(${wc[0] * 0.1 | 0},${wc[1] * 0.1 | 0},${wc[2] * 0.15 + 3 | 0},${dk})`;
      lg.fillRect(0, 0, this.lc.width, this.lc.height);
      lg.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, i) => {
        const X = this.sx(x) * s, Y = this.sy(y) * s, R = r * P * s;
        const gr = lg.createRadialGradient(X, Y, 0, X, Y, R);
        gr.addColorStop(0, `rgba(0,0,0,${i})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = gr; lg.beginPath(); lg.arc(X, Y, R, 0, 6.28); lg.fill();
      };
      // lanterna em cone
      const L = dv.s.light;
      const ang = d.ang;
      const DX = this.sx(d.x) * s, DY = this.sy(d.y) * s;
      const flick = dv.state === 'apnea' ? (Math.random() < 0.3 ? 0.3 : 0.8) : 1;
      const gr = lg.createRadialGradient(DX, DY, 0, DX, DY, L * P * s);
      gr.addColorStop(0, `rgba(0,0,0,${flick})`); gr.addColorStop(0.7, `rgba(0,0,0,${0.75 * flick})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr;
      lg.beginPath(); lg.moveTo(DX, DY); lg.arc(DX, DY, L * P * s, ang - 0.55, ang + 0.55); lg.closePath(); lg.fill();
      hole(d.x, d.y, 3.2 + L * 0.18, 0.92 * flick);
      for (const l of lights) hole(l[0], l[1], l[2], l[3]);
      g.drawImage(this.lc, 0, 0, W, H);
    }
    // brilhos coloridos
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l[4]) continue;
      const X = this.sx(l[0]), Y = this.sy(l[1]), R = l[2] * P * 0.7;
      const c = parse(l[4]);
      const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, rgb(c, 0.35 * Math.max(0.3, dk))); gr.addColorStop(1, rgb(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, 6.28); g.fill();
    }
    // feixe visível da lanterna
    if (dk > 0.3) {
      const L = dv.s.light * P, X = this.sx(d.x), Y = this.sy(d.y);
      const gr = g.createRadialGradient(X, Y, 0, X, Y, L);
      gr.addColorStop(0, `rgba(255,250,220,${0.12 * dk})`); gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(X, Y); g.arc(X, Y, L, d.ang - 0.45, d.ang + 0.45); g.closePath(); g.fill();
    }
    g.restore();
  }

  drawOverlays(dv, t) {
    const g = this.g, W = this.W, H = this.H;
    // vinheta
    const o2f = dv.o2 / dv.s.o2;
    let vig = 0.45;
    if (dv.state === 'apnea') vig = 0.75 + (1 - dv.apnea / 4) * 0.25;
    const gr = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * (dv.state === 'apnea' ? 0.12 * dv.apnea / 4 + 0.05 : 0.35), W / 2, H * 0.45, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${vig})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // pouco ar: pulsar vermelho
    if (o2f < 0.3 || dv.state === 'apnea') {
      const beat = Math.pow(Math.max(0, Math.sin(t * (o2f < 0.15 ? 9 : 6))), 6);
      const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(160,0,0,0)'); rg.addColorStop(1, `rgba(170,10,20,${0.15 + beat * 0.35})`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    // dano
    if (dv.d.hurt > 0.8) { g.fillStyle = `rgba(255,40,40,${(dv.d.hurt - 0.8) * 1.2})`; g.fillRect(0, 0, W, H); }
    // pressão: vidro trincando nos cantos
    if (dv.d.y > dv.s.rating) {
      const over = Math.min(1, (dv.d.y - dv.s.rating) / 30);
      const n = 2 + Math.floor(over * 5);
      g.lineWidth = 1.3;
      for (let i = 0; i < n; i++) {
        const corner = i % 4;
        let x = corner % 2 ? W - 6 : 6, y = corner < 2 ? 70 + hash01(i * 3) * 60 : H - 90 - hash01(i * 5) * 80;
        const dx = corner % 2 ? -1 : 1, dy = corner < 2 ? 1 : -1;
        g.strokeStyle = `rgba(230,245,255,${0.35 + over * 0.45})`;
        g.beginPath(); g.moveTo(x, y);
        const len = 4 + Math.floor(over * 4);
        for (let j = 0; j < len; j++) {
          x += dx * (6 + hash01(i * 13 + j) * 14); y += dy * (hash01(i * 17 + j) * 14 - 4);
          g.lineTo(x, y);
          if (hash01(i * 29 + j) < 0.35) { g.moveTo(x, y); g.lineTo(x + dx * 8, y - dy * 9); g.moveTo(x, y); }
        }
        g.stroke();
      }
    }
  }

  // ============ SUPERFÍCIE ============
  drawSurface(st, t, dt) {
    const g = this.g, W = this.W, H = this.H;
    this.stepParts(dt);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    const night = hr < 5.5 || hr > 19.5, dusk = !night && (hr < 7.5 || hr > 17);
    const hz = H * 0.46;
    // céu
    const sk = g.createLinearGradient(0, 0, 0, hz);
    if (night) { sk.addColorStop(0, '#030714'); sk.addColorStop(1, '#14243f'); }
    else if (dusk) { sk.addColorStop(0, '#24335e'); sk.addColorStop(0.55, '#c0587a'); sk.addColorStop(1, '#ffb070'); }
    else { sk.addColorStop(0, '#2a86d6'); sk.addColorStop(1, '#a9e3ff'); }
    g.fillStyle = sk; g.fillRect(0, 0, W, hz + 2);
    if (night) {
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + i))})`; g.fillRect(hash01(i) * W, hash01(i + 99) * hz * 0.9, 1.3, 1.3); }
    }
    // sol / lua
    const sunX = W * 0.72, sunY = night ? hz * 0.3 : dusk ? hz * 0.82 : hz * 0.25;
    const sc = night ? '#f4f1dc' : dusk ? '#ffd27a' : '#fff6d0';
    const sg = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, night ? 60 : 120);
    sg.addColorStop(0, sc); sg.addColorStop(0.15, sc); sg.addColorStop(0.16, night ? 'rgba(244,241,220,0.25)' : 'rgba(255,220,150,0.45)'); sg.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(sunX, sunY, night ? 60 : 120, 0, 6.28); g.fill();
    // nuvens
    g.fillStyle = night ? 'rgba(120,140,170,0.15)' : dusk ? 'rgba(255,190,190,0.35)' : 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 4; i++) {
      const cx = ((hash01(i * 5) * W * 1.5 + t * (6 + i * 2)) % (W + 300)) - 150, cy = hz * (0.15 + hash01(i * 9) * 0.45);
      for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(cx + j * 28 - 40, cy + Math.sin(j * 2) * 6, 34 - Math.abs(j - 1.5) * 6, 14, 0, 0, 6.28); g.fill(); }
    }
    // ilha
    g.fillStyle = night ? '#08131c' : dusk ? '#3a2c45' : '#2f6b5a';
    g.beginPath(); g.moveTo(-10, hz);
    for (let x = -10; x <= W * 0.55; x += 8) g.lineTo(x, hz - 40 - 30 * Math.sin(x / W * 5) * (1 - x / (W * 0.55)) - 10 * noise1(x / 30));
    g.lineTo(W * 0.55, hz); g.closePath(); g.fill();
    if (night) for (let i = 0; i < 6; i++) { g.fillStyle = '#ffd27a'; g.fillRect(20 + i * 22, hz - 8 - (i % 3) * 5, 2, 2); }
    // gaivotas
    if (!night) {
      g.strokeStyle = dusk ? '#2a1e2e' : '#203040'; g.lineWidth = 1.5;
      for (const b of this.gulls) {
        const x = ((b.x + t * b.s) % 1.2 - 0.1) * W, y = b.y * H, f = Math.sin(t * 6 + b.ph) * 4;
        g.beginPath(); g.moveTo(x - 8, y - f); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 8, y - f); g.stroke();
      }
    }
    // mar
    const sea = g.createLinearGradient(0, hz, 0, H);
    if (night) { sea.addColorStop(0, '#0a1e33'); sea.addColorStop(1, '#010810'); }
    else if (dusk) { sea.addColorStop(0, '#5b4a78'); sea.addColorStop(0.3, '#1d4a6e'); sea.addColorStop(1, '#03182a'); }
    else { sea.addColorStop(0, '#2aa3c9'); sea.addColorStop(0.35, '#0d6c94'); sea.addColorStop(1, '#03253d'); }
    g.fillStyle = sea; g.fillRect(0, hz, W, H - hz);
    // reflexo do sol
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const y = hz + 4 + i * i * 0.7;
      const w = (10 + i * 3) * (0.6 + 0.4 * Math.sin(t * 3 + i * 1.7));
      g.fillStyle = night ? `rgba(240,240,210,${0.25 - i * 0.008})` : `rgba(255,230,170,${0.35 - i * 0.011})`;
      g.fillRect(sunX - w / 2 + Math.sin(t + i) * 6, y, w, 2);
    }
    g.restore();
    // ondas
    for (let i = 0; i < 9; i++) {
      const y = hz + 10 + i * i * 4.5;
      g.strokeStyle = `rgba(255,255,255,${0.1 + i * 0.012})`; g.lineWidth = 1 + i * 0.15;
      g.beginPath();
      for (let x = 0; x <= W; x += 12) { const yy = y + Math.sin(x * 0.02 + t * (1 + i * 0.1) + i) * (1 + i * 0.6); x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
    // frota ao fundo
    const crew = st.crew;
    const extra = Math.min(8, Math.floor(crew / 3));
    for (let i = 0; i < extra; i++) {
      const bx = W * (0.12 + hash01(i * 3 + 1) * 0.8), by = hz + 12 + hash01(i * 7) * 30;
      this.boat(bx, by + Math.sin(t * 1.4 + i) * 1.5, 0.35 + hash01(i) * 0.15, Math.min(5, 1 + (i % 3)), t + i, night);
    }
    // boias das estações
    for (let k = 0; k < Math.min(st.stations, 6); k++) {
      const bx = W * (0.08 + k * 0.15), by = hz + 70 + (k % 2) * 16 + Math.sin(t * 2 + k) * 2;
      g.fillStyle = '#ff6a3d'; g.beginPath(); g.arc(bx, by, 5, Math.PI, 0); g.fill();
      g.fillStyle = (Math.floor(t * 1.5 + k) % 2) ? '#ffe680' : '#7a6a30'; g.beginPath(); g.arc(bx, by - 7, 2, 0, 6.28); g.fill();
    }
    // barco principal
    let tier = 0; BOATS.forEach((b, i) => { if (crew >= b.at) tier = i; });
    const by = hz + H * 0.17;
    this.boat(W * 0.5, by + Math.sin(t * 1.2) * 3, Math.min(2, W / 240), tier, t, night, true);
    this.drawParts(false);
  }

  boat(x, y, s, tier, t, night, main) {
    const g = this.g;
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 1.1) * 0.03); g.scale(s, s);
    const len = [70, 110, 130, 170, 210, 230][tier];
    const hullC = ['#e8622c', '#f3f1ea', '#3b2a1e', '#f4f6f8', '#1d2a38', '#2a3c4c'][tier];
    const stripe = ['#333', '#2c6fb5', '#d9a52b', '#d0342c', '#f2c230', '#19c3b5'][tier];
    // reflexo
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, 10, len * 0.55, 6, 0, 0, 6.28); g.fill();
    // casco
    g.fillStyle = hullC;
    g.beginPath(); g.moveTo(-len / 2, -14); g.lineTo(len / 2 + 10, -16); g.quadraticCurveTo(len / 2, 6, len / 2 - 15, 8); g.lineTo(-len / 2 + 8, 8); g.closePath(); g.fill();
    g.fillStyle = stripe; g.fillRect(-len / 2 + 2, -6, len - 4, 4);
    if (tier === 0) { g.fillStyle = '#333'; g.fillRect(-len / 2 - 6, -12, 8, 14); }
    if (tier >= 1) {
      // cabine
      g.fillStyle = tier === 2 ? '#5a3d28' : '#e6e9ee';
      const cw = len * 0.32;
      g.fillRect(-cw / 2 - len * 0.08, -36, cw, 22);
      g.fillStyle = night ? '#ffd27a' : '#2e5a78';
      for (let i = 0; i < 3; i++) g.fillRect(-cw / 2 - len * 0.08 + 5 + i * (cw / 3), -31, cw / 3 - 8, 8);
    }
    if (tier === 2) {
      g.strokeStyle = '#2a1e14'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-10, -14); g.lineTo(-10, -90); g.moveTo(30, -14); g.lineTo(30, -70); g.stroke();
      g.fillStyle = '#f2ecd8'; g.beginPath(); g.moveTo(-8, -86); g.quadraticCurveTo(20, -55, -8, -20); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(32, -66); g.quadraticCurveTo(55, -45, 32, -22); g.closePath(); g.fill();
    }
    if (tier >= 3) {
      g.fillStyle = '#d5dbe2'; g.fillRect(-len * 0.2, -58, len * 0.22, 22);
      g.strokeStyle = '#f2c230'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(len * 0.25, -14); g.lineTo(len * 0.35, -70); g.lineTo(len * 0.5, -60); g.stroke();
      g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(len * 0.5, -60); g.lineTo(len * 0.5, -20); g.stroke();
    }
    if (tier >= 4) { g.fillStyle = '#334'; g.beginPath(); g.ellipse(-len * 0.38, -18, 20, 4, 0, 0, 6.28); g.fill(); g.fillStyle = '#ddd'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('H', -len * 0.38, -15); }
    if (night) { g.fillStyle = Math.floor(t * 2) % 2 ? '#ff4040' : '#600'; g.beginPath(); g.arc(len / 2, -18, 2, 0, 6.28); g.fill(); }
    if (main) { g.fillStyle = '#f2c230'; g.beginPath(); g.arc(-len * 0.3, -18, 4, 0, 6.28); g.fill(); }
    g.restore();
  }
}
