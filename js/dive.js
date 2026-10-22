// Simulação de um mergulho.
import { walls, current, genChunk, CHUNK } from './world.js';
import { zoneAt, artifactName } from './data.js';

const DMG = { jelly: 0.07, eel: 0.12, shark: 0.22, angler: 0.18 };

export class Dive {
  constructor(stats, opts) {
    this.s = stats; // { o2, speed, rating, light, magnet, bag, sonar, harpoon, lootMult }
    this.startY = opts.startY;
    this.seed = opts.seed;
    this.found = opts.found; // Set "zona-k"
    this.record = opts.record;
    const [L, R] = walls(this.startY + 2);
    this.d = { x: (L + R) / 2, y: this.startY + 1.2, vx: 0, vy: 0.6, ang: Math.PI / 2, face: 1, kick: 0, slow: 0, hurt: 0 };
    this.o2 = stats.o2;
    this.bag = [];
    this.arts = [];
    this.items = [];
    this.mobs = [];
    this.loose = [];
    this.chunks = new Set();
    this.t = 0;
    this.state = 'dive';
    this.apnea = 0;
    this.target = null;
    this.ev = [];
    this.maxY = this.d.y;
    this.zone = zoneAt(this.d.y).i;
    this.threat = 0;
    this.grab = null;
    this.harpoonCd = 2;
    this.shots = [];
    this.fullCd = 0;
    this.pressureCd = 0;
    this.chestT = 0; this.chest = null;
    this.closeCall = false;
    this.ensure();
    if (opts.first) {
      const [l, r] = walls(11);
      this.items.push({ type: 'chest', x: (l + r) / 2 + 2.5, y: 11, v: 140, ph: 0, hue: 0 });
    }
  }

  emit(type, data = {}) { this.ev.push({ type, ...data }); }

  ensure() {
    const y = this.d.y;
    const k0 = Math.floor((y - 30) / CHUNK), k1 = Math.floor((y + 50) / CHUNK);
    for (let k = k0; k <= k1; k++) {
      if (k < 0 || this.chunks.has(k)) continue;
      this.chunks.add(k);
      const { items, mobs } = genChunk(k, this.seed, this.found);
      for (const it of items) if (it.y > this.startY + 3) this.items.push(it);
      for (const m of mobs) if (m.y > this.startY + 6) this.mobs.push(m);
    }
    // limpa o que ficou muito longe
    if (this.items.length > 220) this.items = this.items.filter(i => Math.abs(i.y - y) < 90);
    if (this.mobs.length > 120) this.mobs = this.mobs.filter(m => Math.abs(m.y - y) < 90);
  }

  bagValue() { return this.bag.reduce((a, b) => a + b.v, 0); }
  weightPenalty() { return Math.min(0.3, this.bag.length * 0.01); }
  speed() { return this.s.speed * (1 - this.weightPenalty()) * (this.d.slow > 0 ? 0.45 : 1); }
  returnTime() { return Math.max(0, this.d.y - this.startY) / Math.max(0.5, this.speed()); }
  o2Time() { return this.o2 / this.drainRate(); }
  drainRate() {
    let r = 1;
    const over = this.d.y - this.s.rating;
    if (over > 0) r *= 1 + over / 12;
    if (this.grab) r *= 3;
    return r;
  }

  hurt(kind, x, y) {
    const d = this.d;
    if (d.hurt > 0) return false;
    const scale = Math.min(2, 1 + d.y / 4000);
    this.o2 -= this.s.o2 * DMG[kind] * scale;
    d.hurt = 1.1;
    d.slow = 0.8;
    const dx = d.x - x, dy = d.y - y, l = Math.hypot(dx, dy) || 1;
    d.vx += dx / l * 6; d.vy += dy / l * 6;
    this.emit('hit', { kind });
    return true;
  }

  dropLoot(n) {
    n = Math.min(n, this.bag.length);
    for (let i = 0; i < n; i++) {
      const it = this.bag.splice(Math.floor(Math.random() * this.bag.length), 1)[0];
      this.items.push({ ...it, x: this.d.x + (Math.random() - 0.5) * 2, y: this.d.y + 0.5, vy: 0.6 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 2, ph: Math.random() * 6, dropped: 1.2 });
    }
    if (n) this.emit('drop', { n });
  }

  tapEscape() {
    if (!this.grab) return;
    this.grab.need -= 1;
    this.emit('struggle');
    if (this.grab.need <= 0) {
      const m = this.grab.m;
      m.st = 'flee'; m.stun = 3; m.cd = 8;
      this.grab = null;
      this.d.vy -= 5;
      this.emit('escape');
    }
  }

  update(dt) {
    if (this.state === 'done' || this.state === 'dead') return;
    this.t += dt;
    const d = this.d, s = this.s;
    this.ensure();

    // ar
    this.o2 -= this.drainRate() * dt;
    if (d.y > s.rating) {
      this.pressureCd -= dt;
      if (this.pressureCd <= 0) { this.pressureCd = 3; this.emit('pressure'); }
    }
    if (this.o2 <= 0 && this.state === 'dive') { this.o2 = 0; this.state = 'apnea'; this.apnea = 4; this.emit('apnea'); }
    if (this.state === 'apnea') {
      this.o2 = 0;
      this.apnea -= dt;
      if (this.apnea <= 0) { this.state = 'dead'; this.emit('dead'); return; }
    }

    // movimento
    d.hurt = Math.max(0, d.hurt - dt);
    d.slow = Math.max(0, d.slow - dt);
    const sp = this.speed() * (this.state === 'apnea' ? 0.6 : 1);
    if (this.grab) {
      const m = this.grab.m;
      d.vx += (m.x - d.x) * 3 * dt; d.vy += (m.y + 1.5 - d.y) * 3 * dt;
      m.hy += 0.7 * dt;
      d.vx *= Math.exp(-4 * dt); d.vy *= Math.exp(-4 * dt);
    } else if (this.target) {
      const dx = this.target.x - d.x, dy = this.target.y - d.y;
      const l = Math.hypot(dx, dy);
      if (l > 0.25) {
        const k = Math.min(1, l / 1.6);
        const tx = dx / l * sp * k, ty = dy / l * sp * k;
        const a = 1 - Math.exp(-5 * dt);
        d.vx += (tx - d.vx) * a; d.vy += (ty - d.vy) * a;
        d.kick += dt * (4 + sp * 1.5) * k;
      } else { d.vx *= Math.exp(-4 * dt); d.vy *= Math.exp(-4 * dt); }
    } else {
      d.vx *= Math.exp(-1.6 * dt);
      d.vy += (0.15 - d.vy) * (1 - Math.exp(-0.8 * dt)); // afunda bem devagar
      d.kick += dt * 1.2;
    }
    const cur = current(d.y);
    d.x += (d.vx + cur) * dt; d.y += d.vy * dt;
    const [L, R] = walls(d.y);
    if (d.x < L + 0.55) { d.x = L + 0.55; if (d.vx < 0) d.vx *= -0.2; }
    if (d.x > R - 0.55) { d.x = R - 0.55; if (d.vx > 0) d.vx *= -0.2; }
    const spd = Math.hypot(d.vx, d.vy);
    if (spd > 0.3) {
      const want = Math.atan2(d.vy, d.vx);
      let diff = want - d.ang;
      while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      d.ang += diff * Math.min(1, dt * 7);
      if (Math.abs(d.vx) > 0.25) d.face = d.vx > 0 ? 1 : -1;
    }
    if (d.y > this.maxY) {
      this.maxY = d.y;
      if (this.maxY > this.record) {
        const prev = this.record;
        this.record = this.maxY;
        if (Math.floor(this.record / 50) > Math.floor(prev / 50) && prev > 5) this.emit('record', { y: Math.floor(this.record / 50) * 50 });
      }
    }
    const z = zoneAt(d.y).i;
    if (z !== this.zone) { if (z > this.zone) this.emit('zone', { zone: zoneAt(d.y) }); this.zone = z; }

    // voltou
    if (d.y <= this.startY + 0.25 && this.maxY > this.startY + 2.5) {
      this.state = 'done';
      if (this.closeCall || this.o2 < s.o2 * 0.06) this.emit('closecall');
      this.emit('success');
      return;
    }
    if (this.state === 'apnea' && d.y <= this.startY + 0.25) { this.closeCall = true; }

    this.updateItems(dt);
    this.updateMobs(dt);
    this.updateHarpoon(dt);
    this.fullCd -= dt;
  }

  updateItems(dt) {
    const d = this.d, s = this.s;
    const room = this.bag.length < s.bag;
    let nearChest = null;
    for (const it of this.items) {
      if (it.dead) continue;
      if (it.dropped) { it.dropped -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= 0.97; continue; }
      const dx = d.x - it.x, dy = d.y - it.y, l = Math.hypot(dx, dy);
      if (it.type === 'chest') {
        if (l < s.magnet + 0.6) nearChest = it;
        continue;
      }
      const canTake = it.type === 'art' || room;
      if (!it.fly && l < s.magnet && canTake) it.fly = true;
      if (!canTake && l < s.magnet && this.fullCd <= 0) { this.fullCd = 4; this.emit('full'); }
      if (it.fly) {
        const k = Math.min(1, dt * 9);
        it.x += dx * k; it.y += dy * k;
        if (l < 0.45) this.collect(it);
      }
    }
    // baú: fique perto para abrir
    if (nearChest && room) {
      if (this.chest !== nearChest) { this.chest = nearChest; this.chestT = 0; this.emit('chestStart'); }
      this.chestT += dt / 1.3;
      if (this.chestT >= 1) { this.collect(nearChest); this.chest = null; this.chestT = 0; this.emit('chest', { x: nearChest.x, y: nearChest.y }); }
    } else {
      if (nearChest && !room && this.fullCd <= 0) { this.fullCd = 4; this.emit('full'); }
      this.chestT = Math.max(0, this.chestT - dt * 1.5);
      if (this.chestT === 0) this.chest = null;
    }
    if (Math.random() < 0.02) this.items = this.items.filter(i => !i.dead);
  }

  collect(it) {
    it.dead = true;
    const v = it.v * this.s.lootMult;
    if (it.type === 'art') {
      const name = artifactName(it.zone, it.k);
      this.arts.push({ zone: it.zone, k: it.k, name, v, shape: it.shape });
      this.found.add(`${it.zone}-${it.k}`);
      this.emit('artifact', { name, v, x: it.x, y: it.y, shape: it.shape });
      return;
    }
    this.bag.push({ type: it.type, v });
    this.emit('pickup', { loot: it.type, v, x: it.x, y: it.y });
  }

  updateMobs(dt) {
    const d = this.d;
    let threat = 0;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const dx = d.x - m.x, dy = d.y - m.y, l = Math.hypot(dx, dy);
      if (Math.abs(dy) > 70) continue;
      m.ph += dt;
      m.cd = Math.max(0, m.cd - dt);
      m.stun = Math.max(0, m.stun - dt);
      switch (m.t) {
        case 'jelly':
          m.x = m.hx + Math.sin(m.ph * 0.35) * 1.6;
          m.y = m.hy + Math.sin(m.ph * 0.6) * 0.8;
          if (l < 0.95 && m.cd <= 0 && !m.stun) { if (this.hurt('jelly', m.x, m.y)) m.cd = 2.5; }
          break;
        case 'fish': {
          // cardume foge do mergulhador
          if (l < 4) { m.vx -= dx / l * 6 * dt; m.vy -= dy / l * 6 * dt; }
          m.vx += (Math.cos(m.ph * 0.4) * 1.2 - m.vx) * dt; m.vy += (Math.sin(m.ph * 0.7) * 0.4 - m.vy) * dt;
          m.x += m.vx * dt; m.y += m.vy * dt;
          const [L, R] = walls(m.y); if (m.x < L + 2) m.vx += 3 * dt; if (m.x > R - 2) m.vx -= 3 * dt;
          break;
        }
        case 'eel': {
          if (m.st === 'hide' && l < 3.4 && m.cd <= 0 && !m.stun) { m.st = 'out'; m.ext = 0; this.emit('eel'); }
          if (m.st === 'out') {
            m.ext += dt * 9;
            const hx = m.x + m.dir * m.ext, hy = m.y;
            if (Math.hypot(d.x - hx, d.y - hy) < 0.8) this.hurt('eel', hx, hy);
            if (m.ext >= 3) { m.st = 'back'; }
          } else if (m.st === 'back') {
            m.ext -= dt * 2.5;
            if (m.ext <= 0) { m.ext = 0; m.st = 'hide'; m.cd = 3; }
          }
          break;
        }
        case 'shark': {
          const [L, R] = walls(m.y);
          if (m.stun > 0) { m.vx *= 0.95; m.vy *= 0.95; m.vy += 0.3 * dt; }
          else if (m.st === 'idle' || m.st === 'flee') {
            if (m.st === 'flee' && m.cd <= 0) m.st = 'idle';
            const tx = m.st === 'flee' ? -Math.sign(dx) * 4 : m.dir * m.speed;
            m.vx += (tx - m.vx) * dt; m.vy += ((m.hy - m.y) * 0.3 + Math.sin(m.ph * 0.5) * 0.4 - m.vy) * dt;
            if (m.x < L + 3) m.dir = 1; if (m.x > R - 3) m.dir = -1;
            if (m.st === 'idle' && l < 11 && m.cd <= 0) { m.st = 'stalk'; m.t0 = 0; this.emit('sharkSee'); }
          } else if (m.st === 'stalk') {
            m.t0 += dt;
            // circula antes de atacar
            const ang = Math.atan2(-dy, -dx) + dt * 0.9;
            const r = Math.max(5, l - dt * 1.5);
            const tx = d.x + Math.cos(ang) * r, ty = d.y + Math.sin(ang) * r;
            m.vx += ((tx - m.x) * 1.4 - m.vx) * dt * 2; m.vy += ((ty - m.y) * 1.4 - m.vy) * dt * 2;
            if (m.t0 > 2.4 + m.seed * 1.5) { m.st = 'charge'; m.t0 = 0; this.emit('sharkCharge'); }
            if (l > 18) m.st = 'idle';
          } else if (m.st === 'charge') {
            m.t0 += dt;
            const v = 7 + Math.min(6, this.d.y / 800);
            m.vx += (dx / l * v - m.vx) * dt * 3; m.vy += (dy / l * v - m.vy) * dt * 3;
            if (l < 1.2) { if (this.hurt('shark', m.x, m.y)) this.dropLoot(2); m.st = 'flee'; m.cd = 5; }
            if (m.t0 > 3) { m.st = 'flee'; m.cd = 3; }
          }
          m.x += m.vx * dt; m.y += m.vy * dt;
          if (m.x < L + 1) { m.x = L + 1; m.vx = Math.abs(m.vx); }
          if (m.x > R - 1) { m.x = R - 1; m.vx = -Math.abs(m.vx); }
          if (Math.abs(m.vx) > 0.2) m.face = m.vx > 0 ? 1 : -1;
          if (m.st === 'stalk' || m.st === 'charge') threat = Math.max(threat, m.st === 'charge' ? 1 : Math.max(0.35, 1 - l / 16));
          else if (l < 14 && m.st === 'idle') threat = Math.max(threat, 0.2);
          break;
        }
        case 'angler': {
          m.x = m.hx + Math.sin(m.ph * 0.25) * 1.2; m.y = m.hy + Math.sin(m.ph * 0.4) * 0.6;
          m.face = dx > 0 ? 1 : -1;
          if (m.st === 'idle' && l < 2.8 && m.cd <= 0 && !m.stun) { m.st = 'bite'; m.t0 = 0; this.emit('angler'); }
          if (m.st === 'bite') {
            m.t0 += dt;
            m.hx += dx / l * 9 * dt; m.hy += dy / l * 9 * dt;
            if (l < 0.9) { this.hurt('angler', m.x, m.y); m.st = 'idle'; m.cd = 4; }
            if (m.t0 > 0.45) { m.st = 'idle'; m.cd = 3; }
          }
          if (l < 5) threat = Math.max(threat, 0.3);
          break;
        }
        case 'squid': {
          m.x = m.hx + Math.sin(m.ph * 0.2) * 2; m.y = m.hy + Math.sin(m.ph * 0.3) * 1.5;
          if (!this.grab && m.st !== 'flee' && m.cd <= 0 && !m.stun && l < 3.6) {
            this.grab = { m, need: 9 + Math.floor(this.d.y / 1500) };
            m.st = 'grab';
            this.emit('grab');
          }
          if (m.st === 'flee') { m.hy += 3 * dt; if (m.cd <= 0) m.st = 'idle'; }
          if (l < 9) threat = Math.max(threat, this.grab ? 1 : 0.5);
          break;
        }
        case 'air': {
          m.x = m.hx + Math.sin(m.ph * 0.8) * 0.3; m.y = m.hy + Math.sin(m.ph * 1.1) * 0.3;
          if (l < 1.3) {
            m.dead = true;
            this.o2 = Math.min(this.s.o2, this.o2 + this.s.o2 * 0.35);
            if (this.state === 'apnea') { this.state = 'dive'; this.closeCall = true; }
            this.emit('air', { x: m.x, y: m.y });
          }
          break;
        }
      }
    }
    this.threat += (threat - this.threat) * Math.min(1, dt * 3);
  }

  updateHarpoon(dt) {
    for (const sh of this.shots) sh.t -= dt;
    this.shots = this.shots.filter(s => s.t > 0);
    if (!this.s.harpoon) return;
    this.harpoonCd -= dt;
    if (this.harpoonCd > 0) return;
    const d = this.d;
    let best = null, bl = 7;
    for (const m of this.mobs) {
      if (m.dead || m.stun) continue;
      const hostile = (m.t === 'shark' && (m.st === 'stalk' || m.st === 'charge')) || (m.t === 'angler') || (m.t === 'squid' && m.st === 'grab') || (m.t === 'jelly');
      if (!hostile) continue;
      const l = Math.hypot(d.x - m.x, d.y - m.y);
      if (l < bl) { bl = l; best = m; }
    }
    if (!best) return;
    this.harpoonCd = this.s.harpoon;
    best.stun = best.t === 'jelly' ? 3 : 4;
    if (best.t === 'shark') { best.st = 'flee'; best.cd = 6; best.vx = -best.vx; }
    if (best.t === 'squid' && this.grab && this.grab.m === best) { this.grab = null; best.st = 'flee'; best.cd = 8; this.emit('escape'); }
    this.shots.push({ x1: d.x, y1: d.y, x2: best.x, y2: best.y, t: 0.25 });
    this.emit('harpoon');
  }
}
