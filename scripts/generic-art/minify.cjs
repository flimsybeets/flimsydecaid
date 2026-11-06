// Rewrites path data as compact relative commands (1 decimal, no drift:
// deltas are taken from the previous rounded point).
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (v) => { let s = String(r1(v) || 0); if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2); return s; };
function join(nums) {
  let out = '';
  for (const s of nums) {
    if (!out) { out = s; continue; }
    const prevHasDot = /\.\d*$/.test(out.slice(out.lastIndexOf(' ') + 1)) || /[.]\d*$/.test(out);
    out += (s[0] === '-' || (s[0] === '.' && prevHasDot)) ? s : ' ' + s;
  }
  return out;
}
function minifyPath(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, out = '', last = '';
  const emit = (c, nums) => { const s = join(nums); out += (c === last && c !== 'm' ? (s[0] === '-' ? '' : ' ') : c) + s; last = c === 'm' ? 'l' : c; };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, n = ARGS[C];
    if (C === 'Z') { out += 'z'; last = 'z'; cx = sx; cy = sy; continue; }
    const a = toks.slice(i, i + n).map(Number); i += n;
    if (a.length < n || a.some(isNaN)) break;
    const ax = (x) => (rel ? cx + x : x), ay = (y) => (rel ? cy + y : y);
    if (C === 'M' || C === 'L' || C === 'T') {
      const x = r1(ax(a[0])), y = r1(ay(a[1]));
      emit(C.toLowerCase(), [fmt(x - cx), fmt(y - cy)]); cx = x; cy = y;
      if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    } else if (C === 'H') { const x = r1(rel ? cx + a[0] : a[0]); emit('h', [fmt(x - cx)]); cx = x; }
    else if (C === 'V') { const y = r1(rel ? cy + a[0] : a[0]); emit('v', [fmt(y - cy)]); cy = y; }
    else if (C === 'C' || C === 'S' || C === 'Q') {
      const pts = []; for (let k = 0; k < n; k += 2) pts.push([r1(ax(a[k])), r1(ay(a[k + 1]))]);
      emit(C.toLowerCase(), pts.flatMap(([x, y]) => [fmt(x - cx), fmt(y - cy)]));
      cx = pts[pts.length - 1][0]; cy = pts[pts.length - 1][1];
    } else if (C === 'A') {
      const x = r1(ax(a[5])), y = r1(ay(a[6]));
      emit('a', [fmt(a[0]), fmt(a[1]), fmt(a[2]), String(a[3] ? 1 : 0), String(a[4] ? 1 : 0), fmt(x - cx), fmt(y - cy)]); cx = x; cy = y;
    }
  }
  return out;
}
const minifySvg = (svg) => svg.replace(/ d="([^"]*)"/g, (_, d) => ` d="${minifyPath(d)}"`);
module.exports = { minifyPath, minifySvg };
