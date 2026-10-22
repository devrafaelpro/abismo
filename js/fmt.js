// Números em pt-BR
const NAMES = ['', 'mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci', 'undeci', 'duodeci', 'tredeci',
  'quatordeci', 'quindeci', 'sexdeci', 'septendeci', 'octodeci', 'novendeci', 'vigint'];
const L = 'abcdefghijklmnopqrstuvwxyz';

export function short(x) {
  if (!isFinite(x)) return '∞';
  if (x < 0) return '-' + short(-x);
  if (x < 1e6) return Math.floor(x).toLocaleString('pt-BR');
  let e = Math.floor(Math.log10(x) / 3);
  let m = x / Math.pow(10, e * 3);
  if (m >= 999.95) { e++; m /= 1000; }
  const suf = e < NAMES.length ? NAMES[e] : L[Math.floor((e - NAMES.length) / 26) % 26] + L[(e - NAMES.length) % 26];
  return m.toFixed(m < 10 ? 2 : m < 100 ? 1 : 0).replace('.', ',') + ' ' + suf;
}
export const money = x => 'R$ ' + short(x);
export const meters = y => Math.floor(y).toLocaleString('pt-BR') + ' m';
export function dur(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'min';
  return Math.floor(s / 3600) + 'h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'min';
}
