// Conteúdo: zonas, tesouros, artefatos, equipamentos, estações e frota.

// Valor de referência de uma profundidade (cresce para sempre)
export function dv(y) {
  y = Math.max(0, y);
  const deep = y > 20000 ? Math.pow(1.003, y - 20000) : 1;
  return (1 + y / 20) * Math.pow(1.008, Math.min(y, 20000)) * deep;
}
export const BASE_VALUE = 5;

// Zonas do abismo. cores: água em cima / embaixo, paredes, brilho
export const ZONES = [
  { from: 0, name: 'Recife de Coral', sub: 'Águas rasas de Ilha Grande', top: '#41c9c6', bot: '#178fae', wall: '#1d5d5c', wall2: '#0b3036', dark: 0.0, deco: 'coral', glow: '#9ff' },
  { from: 50, name: 'Cemitério de Navios', sub: 'Onde os galeões descansam', top: '#178fae', bot: '#0d5b84', wall: '#24495a', wall2: '#0d2532', dark: 0.18, deco: 'wreck', glow: '#9ef' },
  { from: 150, name: 'Paredão Azul', sub: 'A luz começa a ir embora', top: '#0d5b84', bot: '#073b62', wall: '#1a3550', wall2: '#08182a', dark: 0.42, deco: 'rock', glow: '#8cf' },
  { from: 300, name: 'Zona do Crepúsculo', sub: 'Último azul antes do escuro', top: '#073b62', bot: '#031c38', wall: '#122540', wall2: '#040c1a', dark: 0.7, deco: 'rock', glow: '#7af' },
  { from: 1000, name: 'Zona da Meia-Noite', sub: 'Aqui, toda luz é de alguém', top: '#021022', bot: '#01060f', wall: '#0b1424', wall2: '#02050b', dark: 0.93, deco: 'bio', glow: '#3ff' },
  { from: 2500, name: 'Fontes Hidrotermais', sub: 'O fundo do mar ferve', top: '#160b08', bot: '#060202', wall: '#2a120b', wall2: '#0a0302', dark: 0.9, deco: 'vent', glow: '#f84' },
  { from: 4000, name: 'Planície Abissal', sub: 'Silêncio absoluto', top: '#04060c', bot: '#010103', wall: '#121620', wall2: '#030407', dark: 0.96, deco: 'bio', glow: '#9cf' },
  { from: 6000, name: 'Fossa Hadal', sub: 'Pressão de mil atmosferas', top: '#06040d', bot: '#010003', wall: '#16101f', wall2: '#040208', dark: 0.97, deco: 'bio', glow: '#c8f' },
  { from: 11000, name: 'Atlântida', sub: 'Ela existia', top: '#032830', bot: '#000c12', wall: '#14404a', wall2: '#03141a', dark: 0.86, deco: 'ruins', glow: '#4ff' },
  { from: 16000, name: 'Núcleo Cristalino', sub: 'O planeta canta aqui embaixo', top: '#1a0b2e', bot: '#06010e', wall: '#2a1846', wall2: '#0a0418', dark: 0.88, deco: 'crystal', glow: '#d8f' },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function zoneAt(y) {
  if (y >= 24000) {
    const k = Math.floor((y - 24000) / 8000);
    const hue = (k * 67 + 200) % 360;
    return { i: ZONES.length + k, from: 24000 + k * 8000, name: 'Abismo Sem Fim ' + (ROMAN[k] || k + 1), sub: 'Ninguém nunca voltou daqui',
      top: `hsl(${hue},45%,9%)`, bot: `hsl(${hue},60%,2%)`, wall: `hsl(${hue},30%,14%)`, wall2: `hsl(${hue},30%,4%)`, dark: 0.92, deco: k % 2 ? 'crystal' : 'bio', glow: `hsl(${hue},90%,70%)` };
  }
  let z = 0;
  for (let i = 0; i < ZONES.length; i++) if (y >= ZONES[i].from) z = i;
  return { i: z, ...ZONES[z] };
}

// Tesouros comuns: valor relativo, peso na bolsa
export const LOOT = {
  shell: { name: 'Concha rara', pl: 'Conchas raras', v: 0.6 },
  coin: { name: 'Moeda antiga', pl: 'Moedas antigas', v: 1 },
  pearl: { name: 'Pérola', pl: 'Pérolas', v: 2.5 },
  gem: { name: 'Pedra preciosa', pl: 'Pedras preciosas', v: 5 },
  gold: { name: 'Barra de ouro', pl: 'Barras de ouro', v: 9 },
  chest: { name: 'Baú', pl: 'Baús', v: 28 },
};

// Artefatos (únicos, vão para o museu)
export const ARTIFACTS = [
  ['Âncora de ferro', 'Sino de bronze', 'Ânfora romana', 'Cachimbo de pirata', 'Bússola de latão', 'Garrafa com mensagem'],
  ['Dobrão do galeão', 'Sextante dourado', 'Espada de capitão', 'Luneta de almirante', 'Cálice de prata', 'Mapa em couro'],
  ['Estátua de jade', 'Elmo de bronze', 'Colar de âmbar', 'Máscara cerimonial', 'Relógio de bolso', 'Medalhão gravado'],
  ['Coroa portuguesa', 'Cetro cravejado', 'Ovo de ouro', 'Caixa do Imperador', 'Diamante azul', 'Rosário de esmeraldas'],
  ['Ídolo de obsidiana', 'Pérola negra gigante', 'Olho de cristal', 'Tábua de runas', 'Lâmpada que não apaga', 'Concha que canta'],
  ['Lingote de magma', 'Trono de basalto', 'Rubi incandescente', 'Anel de enxofre', 'Totem fundido', 'Coração de ferro'],
  ['Esfera silenciosa', 'Bússola sem norte', 'Fóssil vivo', 'Dente de megalodonte', 'Sino abissal', 'Capacete soviético'],
  ['Cubo impossível', 'Gravura sem idade', 'Ovo do leviatã', 'Chave de lugar nenhum', 'Ampulheta parada', 'Espelho escuro'],
  ['Tridente de Posêidon', 'Placa de oricalco', 'Coroa de Atlas', 'Cristal de energia', 'Mapa estelar', 'Estátua do rei'],
  ['Semente de cristal', 'Prisma eterno', 'Fragmento de estrela', 'Diapasão do mundo', 'Geodo cantante', 'Pedra do início'],
];
export function artifactName(zone, k) {
  if (zone < ARTIFACTS.length) return ARTIFACTS[zone][k];
  return `Relíquia ${zone - ARTIFACTS.length + 1}-${k + 1}`;
}
export const ART_SHAPES = ['amphora', 'crown', 'orb', 'idol', 'bell', 'trident'];

// Equipamento. val(l) = atributo no nível l; costAt(l) = profundidade usada para o preço do próximo nível
export const UPGRADES = [
  { id: 'suit', name: 'Roupa de pressão', desc: 'Profundidade segura máxima', max: Infinity,
    val: l => l <= 5 ? 40 + 60 * l : 340 + 120 * (l - 5), fmt: v => `${Math.round(v)} m`, costAt: l => (l <= 5 ? 40 + 60 * l : 340 + 120 * (l - 5)), k: 24, grow: l => Math.min(Math.pow(1.2, l), 100) },
  { id: 'tank', name: 'Cilindro de ar', desc: 'Tempo de ar por mergulho', max: 45,
    val: l => 35 + 8 * l, fmt: v => `${Math.round(v)} s`, costAt: l => 15 + 26 * l + 2.5 * l * l, k: 10 },
  { id: 'fins', name: 'Nadadeiras', desc: 'Velocidade de nado', max: 32,
    val: l => 2.6 * Math.pow(1.075, l), fmt: v => `${v.toFixed(1).replace('.', ',')} m/s`, costAt: l => 18 + 25 * l + 2.5 * l * l, k: 9 },
  { id: 'bag', name: 'Bolsa de coleta', desc: 'Quantos tesouros você carrega', max: 30,
    val: l => 6 + 2 * l, fmt: v => `${v} itens`, costAt: l => 20 + 35 * l + 2 * l * l, k: 11 },
  { id: 'light', name: 'Lanterna', desc: 'Alcance da luz no escuro', max: 12,
    val: l => 4 + 0.9 * l, fmt: v => `${v.toFixed(1).replace('.', ',')} m`, costAt: l => 70 + 70 * l, k: 12 },
  { id: 'magnet', name: 'Ímã de tesouro', desc: 'Puxa tesouros de longe', max: 12,
    val: l => 1.2 + 0.3 * l, fmt: v => `${v.toFixed(1).replace('.', ',')} m`, costAt: l => 30 + 45 * l, k: 10 },
  { id: 'sonar', name: 'Sonar', desc: 'Mostra tesouros fora da tela', max: 6, minRecord: 60,
    val: l => l === 0 ? 0 : 8 + 6 * l, fmt: v => v ? `${v} m` : 'desligado', costAt: l => 80 + 110 * l, k: 16 },
  { id: 'harpoon', name: 'Arpão automático', desc: 'Atordoa predadores que chegam perto', max: 8, minRecord: 140,
    val: l => l === 0 ? 0 : 7 / Math.pow(1.2, l - 1), fmt: v => v ? `a cada ${v.toFixed(1).replace('.', ',')} s` : 'sem arpão', costAt: l => 150 + 130 * l, k: 18 },
];

// Estações submarinas: permitem começar o mergulho lá embaixo
const ST_LIST = [150, 300, 450, 650, 850, 1050, 1250, 1500, 1750, 2000];
export function stationDepth(k) { return k < ST_LIST.length ? ST_LIST[k] : 2000 + (k - ST_LIST.length + 1) * 300; }
// estações (todas, compradas ou não) entre y0 e y1
export function stationsBetween(y0, y1) {
  const out = [];
  for (let k = 0; ; k++) { const y = stationDepth(k); if (y > y1) break; if (y >= y0) out.push({ k, y }); if (k > 100000) break; }
  return out;
}
export function nearestStation(y) {
  if (y < 2000) { let b = ST_LIST[0]; for (const s of ST_LIST) if (Math.abs(s - y) < Math.abs(b - y)) b = s; return b; }
  return 2000 + Math.round((y - 2000) / 300) * 300;
}
export function stationCost(k) { return 120 * BASE_VALUE * dv(stationDepth(k)) * Math.min(Math.pow(1.13, k), 50); }

// Frota (renda passiva)
export const BOATS = [
  { at: 0, name: 'Bote inflável' },
  { at: 3, name: 'Traineira' },
  { at: 8, name: 'Escuna de mergulho' },
  { at: 15, name: 'Navio de pesquisa' },
  { at: 25, name: 'Navio-mãe' },
  { at: 40, name: 'Frota submarina' },
];
export const CREW_NAMES = ['Tião', 'Marina', 'Jorginho', 'Dona Lu', 'Kauã', 'Bia Polvo', 'Caramujo', 'Netinho', 'Iara', 'Russo', 'Pérola', 'Zé Arraia',
  'Cris Tubarão', 'Maré', 'Juca', 'Nanda', 'Tatu', 'Leco', 'Sereia', 'Baleia'];
