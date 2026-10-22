// Telas em DOM: superfície, painéis, HUD do mergulho, resultados.
import { UPGRADES, BOATS, CREW_NAMES, ARTIFACTS, ZONES, zoneAt, artifactName, ART_SHAPES, stationDepth, LOOT } from './data.js';
import * as S from './state.js';
import { money, meters, short, dur } from './fmt.js';
import { Renderer } from './render.js';
import { sfx } from './audio.js';

const $ = s => document.querySelector(s);
const svg = (p, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICON = {
  suit: svg('<circle cx="12" cy="11" r="8"/><rect x="8" y="8" width="8" height="6" rx="2.5"/><path d="M6 19l-1 3M18 19l1 3M9 21h6"/>'),
  tank: svg('<rect x="8" y="5" width="8" height="16" rx="4"/><path d="M10 5V3h4v2M14 2.5h3"/><path d="M8 10h8"/>'),
  fins: svg('<path d="M7 3c1 4 0 9-3 16l4 2 3-8"/><path d="M17 3c-1 4 0 9 3 16l-4 2-3-8"/>'),
  bag: svg('<path d="M5 9h14l-1.5 11a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>'),
  light: svg('<path d="M3 10h6l4-3v10l-4-3H3z"/><path d="M16 8l4-2M16 12h5M16 16l4 2"/>'),
  magnet: svg('<path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/><path d="M10 3v9a2 2 0 0 0 4 0V3"/>'),
  sonar: svg('<circle cx="12" cy="12" r="1.5"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>'),
  harpoon: svg('<path d="M3 21L19 5"/><path d="M14 4h6v6"/><path d="M6 15l3 3"/>'),
  station: svg('<path d="M3 17a9 7 0 0 1 18 0z"/><path d="M2 17h20M12 17v4M8 13h.01M12 12h.01M16 13h.01"/>'),
  boat: svg('<path d="M3 15h18l-2.5 5h-13z"/><path d="M6 15V10h8l3 5M9 10V6"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"/>'),
  museum: svg('<path d="M3 9l9-6 9 6M4 21h16M5 9v9M9.5 9v9M14.5 9v9M19 9v9M4 18h16"/>'),
  log: svg('<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h10M9 8h6"/>'),
  soundOn: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  soundOff: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
};
const LOOT_ICON = {
  coin: '<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="10" fill="#f2c230" stroke="#8a5c0e" stroke-width="1.5"/><circle cx="15" cy="15" r="6.5" fill="none" stroke="#c9921a" stroke-width="1.2"/></svg>',
  shell: '<svg viewBox="0 0 30 30"><path d="M15 22 L5 12 A11 11 0 0 1 25 12 Z" fill="#f7c6b5" stroke="#c98572" stroke-width="1.2"/><path d="M15 22L9 8M15 22l0-14M15 22l6-14" stroke="#c98572"/></svg>',
  pearl: '<svg viewBox="0 0 30 30"><ellipse cx="15" cy="20" rx="11" ry="4" fill="#6d6a78"/><circle cx="15" cy="16" r="6" fill="#f2f5fa"/><circle cx="13" cy="14" r="2" fill="#fff"/></svg>',
  gem: '<svg viewBox="0 0 30 30"><path d="M15 4l9 8-9 14-9-14z" fill="#4da3ff"/><path d="M15 4l9 8h-18z" fill="#9cd0ff"/></svg>',
  gold: '<svg viewBox="0 0 30 30"><path d="M4 21h22l-4-10H8z" fill="#f2c230" stroke="#9a6a08" stroke-width="1.2"/><path d="M9 13h11" stroke="#fff3b0" stroke-width="1.4"/></svg>',
  chest: '<svg viewBox="0 0 30 30"><rect x="5" y="12" width="20" height="12" rx="1.5" fill="#6b4320"/><path d="M5 12a10 6 0 0 1 20 0z" fill="#7d5026"/><rect x="5" y="12" width="20" height="2" fill="#d9a52b"/><rect x="13" y="13" width="4" height="5" fill="#d9a52b"/></svg>',
};
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export function haptic(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sem vibração */ } }

function artCanvas(shape, size = 92, glow = '#ffd36a') {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, glow + '55'); gr.addColorStop(1, glow + '00');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2); g.scale(size * 1.0, size * 1.0);
  Renderer.prototype.artShape.call({ g }, shape, 0);
  return c;
}

export class UI {
  constructor(state, actions) {
    this.s = state;
    this.a = actions; // { dive, save, wipe, toggleSound }
    this.sheet = null;
    this.toastT = null;
    this.buildHub();
  }

  // ---------- superfície ----------
  buildHub() {
    $('#menu').innerHTML = [
      ['gear', ICON.suit, 'Equipamento'], ['stations', ICON.station, 'Estações'], ['fleet', ICON.boat, 'Frota'],
      ['museum', ICON.museum, 'Museu'], ['log', ICON.log, 'Diário'],
    ].map(([id, ic, n]) => `<button data-sheet="${id}">${ic}<span>${n}</span><i class="dot"></i></button>`).join('');
    $('#menu').onclick = e => { const b = e.target.closest('[data-sheet]'); if (b) { sfx.click(); this.openSheet(b.dataset.sheet); } };
    $('#diveBtn').onclick = () => this.a.dive();
    $('#snd').onclick = () => { this.a.toggleSound(); this.updateSound(); };
    $('#starts').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; this.s.startK = +b.dataset.k; sfx.click(); this.refreshHub(true); };
    $('#sheetWrap').onclick = e => { if (e.target.id === 'sheetWrap') this.closeSheet(); };
    $('#pause').innerHTML = ICON.pause;
    this.updateSound();
  }
  updateSound() { $('#snd').innerHTML = this.s.sound ? ICON.soundOn : ICON.soundOff; }

  refreshHub(force) {
    const s = this.s;
    $('#cash').textContent = money(s.cash);
    const r = S.crewRate(s);
    $('#inc').textContent = r > 0 ? `+${money(r)}/s com a frota` : '';
    const z = zoneAt(s.record);
    $('#recordLine').textContent = s.record > 1 ? `Recorde ${meters(s.record)} · ${z.name}` : 'Mergulhe fundo · Volte vivo';
    const starts = S.startDepths(s);
    if (s.startK >= starts.length) s.startK = 0;
    const rating = S.stats(s).rating;
    if (starts[s.startK] > rating) s.startK = 0;
    const sh = starts.length > 1 ? starts.map((y, k) => y > rating ? `<button disabled style="opacity:.4">Estação ${y} m · roupa fraca</button>` : `<button data-k="${k}" class="${k === s.startK ? 'on' : ''}">${y === 0 ? 'Barco' : 'Estação ' + y + ' m'}</button>`).join('') : '';
    if ($('#starts')._h !== sh) { $('#starts').innerHTML = sh; $('#starts')._h = sh; }
    const st = S.stats(s);
    const from = starts[s.startK];
    $('#diveSub').textContent = `${from ? 'Saindo de ' + from + ' m · ' : ''}Ar ${Math.round(st.o2)}s · Roupa até ${Math.round(st.rating)} m`;
    // avisos nos botões
    const gear = UPGRADES.some(u => !S.upgLocked(s, u.id) && s.lv[u.id] < u.max && S.upgCost(s, u.id) <= s.cash);
    const station = s.record >= S.nextStationDepth(s) && S.nextStationCost(s) <= s.cash;
    const fleet = s.record >= 30 && S.crewCost(s) <= s.cash;
    for (const [id, on] of [['gear', gear], ['stations', station], ['fleet', fleet]]) {
      const b = document.querySelector(`[data-sheet="${id}"]`); if (b) b.classList.toggle('badge', on);
    }
    if (this.sheet && force) this.renderSheet();
  }

  // ---------- painéis ----------
  openSheet(id) { this.sheet = id; $('#sheetWrap').classList.remove('hidden'); this.renderSheet(); }
  closeSheet() { this.sheet = null; $('#sheetWrap').classList.add('hidden'); }
  renderSheet() {
    const s = this.s, el = $('#sheet');
    const head = (t) => `<div class="grabber"></div><div class="sh-head"><h2>${t}</h2><div class="c">${money(s.cash)}</div></div>`;
    let h = '';
    if (this.sheet === 'gear') {
      h = head('Equipamento') + UPGRADES.map(u => {
        const l = s.lv[u.id], max = l >= u.max, locked = S.upgLocked(s, u.id);
        const cost = S.upgCost(s, u.id);
        const pips = isFinite(u.max) && u.max <= 20 ? `<div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>` : '';
        const btn = locked ? `<button class="buy no" disabled>${u.minRecord} m</button>` : max ? '<button class="buy max" disabled>MÁX</button>'
          : `<button class="buy ${cost > s.cash ? 'no' : ''}" data-up="${u.id}">${money(cost)}</button>`;
        return `<div class="up ${locked ? 'locked' : ''}"><div class="ic">${ICON[u.id]}</div><div class="info">
          <div class="nm">${u.name}<em>NV ${l}</em></div>
          <div class="ds">${locked ? `Chegue a ${u.minRecord} m para liberar` : u.desc}</div>
          <div class="val">${u.fmt(u.val(l))}${max ? '' : ` → <b>${u.fmt(u.val(l + 1))}</b>`}</div>${pips}</div>${btn}</div>`;
      }).join('');
    } else if (this.sheet === 'stations') {
      const next = S.nextStationDepth(s), cost = S.nextStationCost(s), reach = s.record >= next;
      h = head('Estações') + `<p class="sh-note">Cada estação submarina vira um novo ponto de partida. Você desce de elevador e começa o mergulho lá embaixo. Só dá para construir onde você já chegou nadando.</p>`;
      for (let k = 0; k < s.stations; k++) h += `<div class="up"><div class="ic">${ICON.station}</div><div class="info"><div class="nm">Estação ${stationDepth(k)} m</div><div class="ds">${zoneAt(stationDepth(k)).name} · em operação</div></div><button class="buy max" disabled>ATIVA</button></div>`;
      h += `<div class="up ${reach ? '' : 'locked'}"><div class="ic">${ICON.station}</div><div class="info"><div class="nm">Estação ${next} m</div>
        <div class="ds">${reach ? zoneAt(next).name : `Alcance ${next} m num mergulho para liberar`}</div></div>
        ${reach ? `<button class="buy ${cost > s.cash ? 'no' : ''}" data-station="1">${money(cost)}</button>` : `<button class="buy no" disabled>${next} m</button>`}</div>`;
    } else if (this.sheet === 'fleet') {
      let tier = 0; BOATS.forEach((b, i) => { if (s.crew >= b.at) tier = i; });
      const nextBoat = BOATS[tier + 1];
      const cost = S.crewCost(s), ok = s.record >= 30;
      h = head('Frota') + `<p class="sh-note">Mergulhadores contratados trabalham o tempo todo, inclusive com o app fechado (até 8h). Rendem conforme o seu recorde de profundidade: quanto mais fundo você vai, mais eles trazem.</p>
        <div class="stats"><div><small>Embarcação</small><b style="font-size:18px">${BOATS[tier].name}</b></div><div><small>Renda</small><b>${money(S.crewRate(s))}/s</b></div></div>
        <div class="up ${ok ? '' : 'locked'}"><div class="ic">${ICON.boat}</div><div class="info"><div class="nm">Contratar mergulhador<em>${s.crew} na equipe</em></div>
        <div class="ds">${ok ? (nextBoat ? `Com ${nextBoat.at} na equipe: ${nextBoat.name}` : 'Sua frota é lendária') : 'Chegue a 30 m para montar equipe'}</div>
        <div class="val">+${money(S.crewRate({ ...s, crew: 1 }))}/s cada</div></div>
        ${ok ? `<button class="buy ${cost > s.cash ? 'no' : ''}" data-crew="1">${money(cost)}</button>` : '<button class="buy no" disabled>30 m</button>'}</div>
        ${s.crew ? `<p class="sh-note" style="margin-top:12px">Equipe: ${Array.from({ length: Math.min(s.crew, 60) }, (_, i) => CREW_NAMES[i % CREW_NAMES.length] + (i >= CREW_NAMES.length ? ' ' + (Math.floor(i / CREW_NAMES.length) + 1) : '')).join(', ')}${s.crew > 60 ? '...' : ''}.</p>` : ''}`;
    } else if (this.sheet === 'museum') {
      const set = new Set(s.found);
      const maxZone = Math.max(0, zoneAt(s.record).i + 1);
      h = head('Museu') + `<p class="sh-note">Cada artefato aumenta em 4% o valor de todos os tesouros. Complete uma coleção para ganhar mais 25%. Bônus atual: <b style="color:var(--gold)">+${Math.round((S.lootMult(s) - 1) * 100)}%</b></p>`;
      for (let z = 0; z <= maxZone; z++) {
        const zn = zoneAt(z < ZONES.length ? ZONES[z].from : 24000 + (z - ZONES.length) * 8000);
        const n = z < ARTIFACTS.length ? ARTIFACTS[z].length : 6;
        const got = Array.from({ length: n }, (_, k) => set.has(`${z}-${k}`));
        const cnt = got.filter(Boolean).length;
        h += `<div class="museum-zone"><h3 class="${cnt === n ? 'done' : ''}">${zn.name}<span>${cnt}/${n}${cnt === n ? ' · COMPLETA' : ''}</span></h3><div class="arts">
          ${got.map((g, k) => `<div class="art ${g ? 'got' : ''}" data-art="${g ? ART_SHAPES[k % ART_SHAPES.length] : ''}">${g ? '' : '<div style="font-family:var(--cond);font-size:30px;font-weight:800;padding:8px 0 6px;opacity:.4">?</div>'}${g ? artifactName(z, k) : 'Não encontrado'}</div>`).join('')}
        </div></div>`;
      }
    } else if (this.sheet === 'log') {
      h = head('Diário') + `<div class="stats">
        <div><small>Recorde</small><b>${meters(s.record)}</b></div><div><small>Ganho total</small><b>${money(s.earned)}</b></div>
        <div><small>Mergulhos</small><b>${s.dives}</b></div><div><small>Desmaios</small><b>${s.deaths}</b></div>
        <div><small>Por um triz</small><b>${s.closeCalls}</b></div><div><small>Maior saque</small><b>${money(s.bestHaul)}</b></div>
        <div><small>Artefatos</small><b>${s.found.length}</b></div><div><small>Tempo</small><b>${dur(s.play)}</b></div></div>
        ${!standalone() && isIOS ? `<div class="install">${ICON.boat}<span>Para instalar no iPhone, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span></div>` : ''}
        <div class="row-set"><span>Som</span><button class="tgl ${s.sound ? 'on' : ''}" data-set="sound"></button></div>
        <div class="row-set"><span>Apagar progresso</span><button class="buy no" style="min-width:auto" data-wipe="1">Apagar</button></div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-art]').forEach(d => { if (d.dataset.art) d.prepend(artCanvas(d.dataset.art)); });
    el.onclick = e => this.sheetClick(e);
  }
  sheetClick(e) {
    const s = this.s;
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.up) {
      const id = t.dataset.up, c = S.upgCost(s, id);
      if (c > s.cash) { sfx.deny(); return; }
      s.cash -= c; s.lv[id]++; sfx.buy(); haptic(15);
    } else if (t.dataset.station) {
      const c = S.nextStationCost(s);
      if (c > s.cash || s.record < S.nextStationDepth(s)) { sfx.deny(); return; }
      s.cash -= c; s.stations++; s.startK = s.stations; sfx.buy(); sfx.zone(); haptic(30);
    } else if (t.dataset.crew) {
      const c = S.crewCost(s);
      if (c > s.cash) { sfx.deny(); return; }
      s.cash -= c; s.crew++; sfx.buy(); haptic(15);
    } else if (t.dataset.set === 'sound') {
      this.a.toggleSound(); this.updateSound();
    } else if (t.dataset.wipe) {
      this.confirm('Apagar tudo?', 'Todo o progresso some: dinheiro, equipamento, estações, frota e museu.', 'Apagar', () => this.a.wipe());
      return;
    } else return;
    this.a.save();
    this.refreshHub(true);
  }

  // ---------- telas sobrepostas ----------
  overlay(html, cls = '') {
    const o = $('#overlay');
    o.className = 'overlay ' + cls;
    o.innerHTML = `<div class="card">${html}</div>`;
    return o;
  }
  hideOverlay() { $('#overlay').className = 'overlay hidden'; $('#overlay').innerHTML = ''; }
  confirm(title, text, label, fn) {
    const o = this.overlay(`<div class="title" style="font-size:38px">${title}</div><p class="lead">${text}</p>
      <button class="btn" id="cOk" style="background:linear-gradient(180deg,#ff9a9d,#ff5a5f);box-shadow:0 5px 0 #8a1c20;color:#2b0004">${label}</button><button class="btn ghost" id="cNo">Cancelar</button>`);
    o.querySelector('#cOk').onclick = () => { this.hideOverlay(); fn(); };
    o.querySelector('#cNo').onclick = () => this.hideOverlay();
  }

  intro(fn) {
    const o = this.overlay(`<div class="eyebrow">Primeiro mergulho</div><div class="title">O mar paga<br>quem volta</div>
      <div class="tut">
        <div><b>1</b><span><strong>Toque e segure</strong> na tela: o mergulhador nada até o seu dedo.</span></div>
        <div><b>2</b><span>Encoste nos tesouros para pegar. Fique parado perto de um <strong>baú</strong> para abrir.</span></div>
        <div><b>3</b><span><strong>Volte ao barco antes do ar acabar.</strong> Se desmaiar, o saque afunda.</span></div>
        <div><b>4</b><span>Lá embaixo há coisas que não querem você por perto.</span></div>
      </div><button class="btn cyan" id="go">Entrar na água</button>`);
    o.querySelector('#go').onclick = () => { this.hideOverlay(); fn(); };
  }

  pause(onResume, onQuit) {
    const o = this.overlay(`<div class="eyebrow">Pausa</div><div class="title">Prendendo<br>a respiração</div>
      <p class="lead">Se desistir agora, você é puxado de volta, mas o saque fica no fundo do mar.</p>
      <button class="btn cyan" id="pRes">Continuar</button><button class="btn ghost" id="pQuit">Desistir do mergulho</button>`);
    o.querySelector('#pRes').onclick = () => { this.hideOverlay(); onResume(); };
    o.querySelector('#pQuit').onclick = () => { this.hideOverlay(); onQuit(); };
  }

  offline(g) {
    const o = this.overlay(`<div class="eyebrow">Enquanto você estava fora</div><div class="title" style="font-size:40px">A frota<br>trabalhou</div>
      <p class="lead">Sua equipe mergulhou por ${dur(g.capped)}${g.secs > g.capped ? ' (o máximo é 8h)' : ''} e trouxe:</p>
      <div class="total">${money(g.v)}</div><button class="btn" id="ok">Coletar</button>`);
    o.querySelector('#ok').onclick = () => { this.hideOverlay(); sfx.cash(); };
  }

  result(r, fn) {
    // r: { bag, arts, closeCall, newRecord, maxY, startY, total }
    const groups = {};
    for (const it of r.bag) { (groups[it.type] = groups[it.type] || { n: 0, v: 0 }); groups[it.type].n++; groups[it.type].v += it.v; }
    const order = ['chest', 'gold', 'gem', 'pearl', 'coin', 'shell'];
    let rows = order.filter(k => groups[k]).map(k => `<div class="row"><span class="ic">${LOOT_ICON[k]}</span><span class="nm">${groups[k].n > 1 ? LOOT[k].pl : LOOT[k].name}</span><span class="q">×${groups[k].n}</span><span class="v">${money(groups[k].v)}</span></div>`);
    rows = rows.concat(r.arts.map(a => `<div class="row art"><span class="ic" data-shape="${a.shape}"></span><span class="nm">${a.name}</span><span class="v">${money(a.v)}</span></div>`));
    if (r.closeCall) rows.push(`<div class="row bonus"><span class="ic"></span><span class="nm">Bônus por um triz (+25%)</span><span class="v">${money(r.bonus)}</span></div>`);
    if (!rows.length) rows.push('<div class="row"><span class="nm" style="color:var(--mute)">Bolsa vazia. Pelo menos você voltou.</span></div>');
    const badges = [];
    if (r.newRecord) badges.push(`<span class="badge-p gold">NOVO RECORDE ${meters(r.maxY)}</span>`);
    else badges.push(`<span class="badge-p">MÁXIMA ${meters(r.maxY)}</span>`);
    if (r.closeCall) badges.push('<span class="badge-p red">POR UM TRIZ</span>');
    if (r.arts.length) badges.push(`<span class="badge-p gold">${r.arts.length} ARTEFATO${r.arts.length > 1 ? 'S' : ''}</span>`);
    const o = this.overlay(`<div class="eyebrow">De volta${r.startY ? ' à estação' : ' ao barco'}</div>
      <div class="title">${r.closeCall ? 'Por um triz!' : r.total > this.s.bestHaul * 0.99 && r.total > 0 ? 'Que mergulho!' : 'Respira...'}</div>
      <div class="badges">${badges.join('')}</div>
      <div class="haul">${rows.join('')}</div>
      <div class="total" id="tot">R$ 0</div><div class="total-l">TOTAL DO MERGULHO</div>
      <button class="btn" id="sell">Vender tudo</button>`);
    o.querySelectorAll('.haul .row').forEach((row, i) => { row.style.animationDelay = (0.15 + i * 0.12) + 's'; });
    o.querySelectorAll('[data-shape]').forEach(sp => { const c = artCanvas(sp.dataset.shape, 60); c.style.width = '30px'; c.style.height = '30px'; sp.appendChild(c); });
    // contagem do total
    const el = o.querySelector('#tot');
    const t0 = performance.now(), D = 1200 + Math.min(1200, rows.length * 120);
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / D);
      el.textContent = money(r.total * (1 - Math.pow(1 - f, 3)));
      if (f < 1) requestAnimationFrame(tick);
    };
    setTimeout(tick, 300);
    let blips = 0; const bt = setInterval(() => { if (blips++ > Math.min(10, rows.length + 2)) clearInterval(bt); else sfx.pickup(blips % 5); }, 130);
    o.querySelector('#sell').onclick = () => { clearInterval(bt); this.hideOverlay(); fn(); };
  }

  death(r, fn) {
    const lost = r.bag.reduce((a, b) => a + b.v, 0);
    const o = this.overlay(`<div class="eyebrow" style="color:#ff8f93">Apagou</div>
      <div class="title dead-title">Escuridão</div>
      <p class="lead">Você desmaiou a <b>${meters(r.y)}</b>. A equipe de resgate puxou seu corpo pela corda.<br>${lost > 0 ? `<b style="color:var(--gold)">${money(lost)}</b> em tesouros afundaram com a bolsa.` : 'Pelo menos a bolsa estava vazia.'}</p>
      ${r.arts.length ? `<p class="lead">Mas ${r.arts.length > 1 ? 'os artefatos ficaram presos' : `<b>${r.arts[0].name}</b> ficou preso`} no seu cinto. ${r.arts.length > 1 ? 'Eles vão' : 'Ele vai'} para o museu.</p>` : ''}
      <button class="btn ghost" id="ok">Respirar fundo</button>`, 'black');
    o.querySelector('#ok').onclick = () => { this.hideOverlay(); fn(); };
  }

  // ---------- HUD do mergulho ----------
  hud(dv, st) {
    const d = dv.d;
    $('#dDepth').textContent = Math.floor(d.y);
    const zn = $('#dZone');
    const over = d.y > dv.s.rating;
    zn.textContent = over ? 'PRESSÃO ALÉM DA ROUPA' : zoneAt(d.y).name;
    zn.classList.toggle('danger', over);
    const f = Math.max(0, dv.o2 / dv.s.o2);
    $('#o2Ring').style.strokeDashoffset = (169.6 * (1 - f)).toFixed(1);
    $('#o2Sec').textContent = Math.ceil(dv.o2Time());
    $('#o2').className = 'o2 ' + (f < 0.25 ? 'low' : f < 0.5 ? 'mid' : '');
    const bag = $('#dBag');
    bag.textContent = `${dv.bag.length}/${dv.s.bag}`;
    bag.classList.toggle('full', dv.bag.length >= dv.s.bag);
    $('#dVal').textContent = money(dv.bagValue() + dv.arts.reduce((a, b) => a + b.v, 0));
    // distância de volta
    const up = d.y - dv.startY;
    const rt = dv.returnTime(), ot = dv.o2Time();
    const danger = ot < rt * 1.25 + 4 && up > 3;
    const ret = $('#ret');
    const rh = up > 8 ? `▲ ${Math.ceil(up)} m até ${dv.startY ? 'a estação' : 'o barco'}` : '';
    if (ret._h !== rh) { ret.textContent = rh; ret._h = rh; }
    ret.classList.toggle('bad', danger);
    $('#warn').classList.toggle('hidden', !danger || dv.state === 'apnea');
    $('#apnea').classList.toggle('hidden', dv.state !== 'apnea');
    $('#grabTip').classList.toggle('hidden', !dv.grab);
    if (dv.grab) $('#grabBar').style.transform = `scaleX(${Math.max(0, dv.grab.need / (9 + Math.floor(d.y / 1500)))})`;
  }
  banner(top, name, sub) {
    const b = $('#banner');
    b.innerHTML = `<div class="d">${top}</div><div class="n">${name}</div><div class="s">${sub || ''}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  toast(text, cls = '') {
    const t = $('#toast');
    t.textContent = text; t.className = 'dtoast ' + cls;
    void t.offsetWidth; t.classList.add('show');
  }
}
