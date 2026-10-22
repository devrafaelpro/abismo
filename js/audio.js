// Som sintetizado: ambiente submarino, respiração, coração, tubarão, tesouros.
let ctx = null, master = null, wet = null, on = true;
let amb = null, ambGain = null, ambFilter = null, drone = null, droneGain = null;
let breathT = 0, heartT = 0, sharkT = 0, sharkStep = 0, whaleT = 20;

export function setOn(v) {
  on = v;
  if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.1);
}
export function unlock() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ctx.destination);
  // eco submarino
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  wet = ctx.createGain(); wet.gain.value = 0.35;
  wet.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master);
  // ambiente: ruído marrom filtrado
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  amb = ctx.createBufferSource(); amb.buffer = buf; amb.loop = true;
  ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 500;
  ambGain = ctx.createGain(); ambGain.gain.value = 0;
  amb.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master); amb.start();
  drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 48;
  droneGain = ctx.createGain(); droneGain.gain.value = 0;
  drone.connect(droneGain); droneGain.connect(master); drone.start();
  const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start();
}

function tone(f, dur, { type = 'sine', vol = 0.2, when = 0, slide = 0, attack = 0.005, echo = false } = {}) {
  if (!ctx || !on) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); if (echo) g.connect(wet);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.2, when = 0, type = 'bandpass', f = 1000, q = 1, f2 = 0, attack = 0.01 } = {}) {
  if (!ctx || !on) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  click() { tone(900, 0.05, { type: 'triangle', vol: 0.08 }); },
  buy() { tone(660, 0.08, { type: 'triangle', vol: 0.12 }); tone(990, 0.2, { type: 'triangle', vol: 0.12, when: 0.07 }); tone(1320, 0.3, { vol: 0.08, when: 0.14, echo: true }); },
  deny() { tone(160, 0.18, { type: 'sawtooth', vol: 0.06, slide: 0.7 }); },
  splash() { noise(0.9, { vol: 0.35, f: 1200, f2: 300, q: 0.6, attack: 0.02 }); noise(1.5, { vol: 0.15, type: 'lowpass', f: 600, when: 0.2 }); },
  surface() { noise(0.6, { vol: 0.3, f: 2000, f2: 800, q: 0.5 }); noise(0.7, { vol: 0.22, f: 900, f2: 1600, q: 2, when: 0.25, attack: 0.15 }); },
  pickup(tier) {
    const base = [880, 988, 1175, 1319, 1568, 1760][Math.min(5, tier)];
    tone(base, 0.25, { vol: 0.12, echo: true }); tone(base * 1.5, 0.3, { vol: 0.07, when: 0.05, echo: true });
  },
  chestCreak() { tone(220, 0.5, { type: 'sawtooth', vol: 0.03, slide: 1.4, attack: 0.1 }); },
  chest() { for (let i = 0; i < 9; i++) tone(1400 + Math.random() * 1600, 0.12, { type: 'triangle', vol: 0.06, when: i * 0.05 + Math.random() * 0.03 }); tone(523, 0.6, { vol: 0.1, echo: true }); tone(784, 0.7, { vol: 0.08, when: 0.1, echo: true }); },
  artifact() { [392, 494, 587, 740, 988].forEach((f, i) => tone(f, 2.2, { vol: 0.08, when: i * 0.12, attack: 0.25, echo: true })); tone(1976, 2.5, { vol: 0.03, when: 0.6, attack: 0.4, echo: true }); },
  hit() { tone(90, 0.4, { type: 'sine', vol: 0.5, slide: 0.5 }); noise(0.35, { vol: 0.3, type: 'lowpass', f: 400 }); },
  harpoon() { noise(0.15, { vol: 0.25, f: 3000, f2: 600, q: 2 }); tone(200, 0.2, { type: 'square', vol: 0.05, slide: 0.5 }); },
  air() { noise(0.8, { vol: 0.3, f: 700, f2: 1800, q: 1.5, attack: 0.2 }); tone(660, 0.4, { vol: 0.06, when: 0.3, echo: true }); },
  full() { tone(300, 0.15, { type: 'square', vol: 0.05 }); tone(240, 0.2, { type: 'square', vol: 0.05, when: 0.15 }); },
  alarm() { tone(880, 0.12, { type: 'square', vol: 0.06 }); tone(660, 0.12, { type: 'square', vol: 0.06, when: 0.15 }); },
  zone() { [196, 247, 294, 392].forEach((f, i) => tone(f, 3, { vol: 0.07, when: i * 0.25, attack: 0.6, echo: true })); },
  record() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.08, when: i * 0.08, echo: true })); },
  sting() { tone(110, 1.2, { type: 'sawtooth', vol: 0.12, slide: 0.94, attack: 0.02 }); tone(116.5, 1.2, { type: 'sawtooth', vol: 0.12, slide: 0.94, attack: 0.02 }); noise(0.6, { vol: 0.2, type: 'lowpass', f: 300 }); },
  grab() { tone(70, 1.5, { type: 'sawtooth', vol: 0.18, slide: 0.6 }); noise(1, { vol: 0.25, type: 'lowpass', f: 250 }); },
  struggle() { noise(0.12, { vol: 0.15, f: 500 + Math.random() * 400, q: 1 }); },
  dead() { tone(220, 3, { vol: 0.15, slide: 0.25, attack: 0.05, echo: true }); tone(110, 3.5, { type: 'triangle', vol: 0.12, slide: 0.4 }); },
  cash() { for (let i = 0; i < 6; i++) tone(2000 + i * 250, 0.08, { type: 'triangle', vol: 0.05, when: i * 0.04 }); },
  sonar() { tone(1500, 0.6, { vol: 0.05, echo: true }); },
};

// Chamado a cada quadro durante o mergulho
export function diveTick(dt, dv) {
  if (!ctx) return;
  const y = dv.d.y;
  const t = ctx.currentTime;
  ambGain.gain.setTargetAtTime(on ? 0.5 : 0, t, 0.5);
  ambFilter.frequency.setTargetAtTime(Math.max(140, 520 - y * 0.15), t, 1);
  droneGain.gain.setTargetAtTime(on ? Math.min(0.12, y / 4000) : 0, t, 1);
  drone.frequency.setTargetAtTime(52 - Math.min(14, y / 400), t, 1);
  // respiração
  const o2f = dv.o2 / dv.s.o2;
  const panic = o2f < 0.25 || dv.threat > 0.6;
  breathT -= dt;
  if (breathT <= 0 && dv.state !== 'apnea') {
    breathT = panic ? 1.8 : 3.6;
    noise(panic ? 0.5 : 0.9, { vol: 0.07, f: 600, f2: 1100, q: 1, attack: 0.3 });
    noise(panic ? 0.5 : 0.9, { vol: 0.06, f: 1300, f2: 500, q: 0.8, when: panic ? 0.7 : 1.3, attack: 0.05 });
    for (let i = 0; i < 4; i++) tone(300 + Math.random() * 500, 0.06, { vol: 0.03, when: (panic ? 0.8 : 1.4) + i * 0.07, slide: 1.6 });
  }
  // coração
  if (o2f < 0.3 || dv.state === 'apnea' || dv.grab) {
    heartT -= dt;
    if (heartT <= 0) {
      heartT = dv.state === 'apnea' ? 0.42 : o2f < 0.15 ? 0.55 : 0.8;
      tone(58, 0.15, { vol: 0.45, slide: 0.7 }); tone(52, 0.15, { vol: 0.35, when: 0.17, slide: 0.7 });
    }
  }
  // tubarão: duas notas que aceleram
  if (dv.threat > 0.3) {
    sharkT -= dt;
    if (sharkT <= 0) {
      sharkT = 0.75 - dv.threat * 0.5;
      sharkStep ^= 1;
      tone(sharkStep ? 82.4 : 87.3, 0.3, { type: 'sawtooth', vol: 0.06 + dv.threat * 0.1, attack: 0.02 });
    }
  }
  // canto de baleia
  if (y > 120 && y < 1500) {
    whaleT -= dt;
    if (whaleT <= 0) {
      whaleT = 25 + Math.random() * 30;
      const f = 180 + Math.random() * 120;
      tone(f, 3, { vol: 0.05, slide: 1.6, attack: 1, echo: true }); tone(f * 1.6, 2.5, { vol: 0.03, when: 2.6, slide: 0.6, attack: 0.8, echo: true });
    }
  }
}
export function surfaceTick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  ambGain.gain.setTargetAtTime(on ? 0.22 : 0, t, 0.8);
  ambFilter.frequency.setTargetAtTime(900, t, 0.8);
  droneGain.gain.setTargetAtTime(0, t, 0.5);
}
