// Node checks for the figure pools' pure parts (index.html, between "figpure: pure helpers" and "figpure end"):
// face atlas cell mapping (as the pool shader does it), the slot / vertex range allocator, compaction and slot writes.
// Run: node handoff/figtest.mjs
import fs from 'fs';
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = src.indexOf('/* ---- figpure: pure helpers'), b = src.indexOf('/* ---- figpure end ---- */');
if (a < 0 || b < 0) throw new Error('figpure section not found');
const { ART_FACE_GRID, artFaceCell, artFaceCellRect, ArtRange, artPackParts, artSlotWrite, artSlotZero } =
  new Function(src.slice(a, b) + '\nreturn { ART_FACE_GRID, artFaceCell, artFaceCellRect, ArtRange, artPackParts, artSlotWrite, artSlotZero };')();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL', m); } };
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const ri = (n) => Math.floor(rnd() * n);

// 1. face atlas: 8 distinct cells; the shader's uv remap lands on the same canvas pixel as the single face texture
{
  const { cols, rows, px } = ART_FACE_GRID, W = cols * px, H = rows * px, seen = new Set();
  for (let st = 0; st < 4; st++) for (const bl of [false, true]) {
    const c = artFaceCell(st, bl); seen.add(c); ok(c >= 0 && c < cols * rows, `cell ${c} in range`);
    const R = artFaceCellRect(c);
    for (const [u, v] of [[0, 0], [1, 1], [0.5, 0.25], [0.13, 0.87]]) {
      // shader: vMapUv = (vec2(mod(cell, cols), rows - 1 - floor(cell / cols)) + uv) / vec2(cols, rows); flipY: canvas y = (1 - v) * H
      const au = ((c % cols) + u) / cols, av = (rows - 1 - Math.floor(c / cols) + v) / rows;
      const x = au * W, y = (1 - av) * H, ex = R.x + u * px, ey = R.y + (1 - v) * px;
      ok(Math.abs(x - ex) < 1e-6 && Math.abs(y - ey) < 1e-6, `cell ${c} uv ${u},${v}: atlas px ${x},${y} vs ${ex},${ey}`);
      ok(Math.abs(au - (R.u0 + u * R.su)) < 1e-9 && Math.abs(av - (R.v0 + v * R.sv)) < 1e-9, `cell ${c} rect uv`);
    }
  }
  ok(seen.size === 8, 'eight distinct face cells');
  ok(artFaceCell(9, false) === 3 && artFaceCell(-2, true) === 4, 'stage clamped to 0..3');
}

// 2. ArtRange: random alloc / release against a bitmap; no overlaps, used counts, holes merged, top falls back to 0
{
  const R = new ArtRange(), live = [], map = new Uint8Array(1 << 16);
  for (let it = 0; it < 20000; it++) {
    if (live.length && (rnd() < 0.45 || live.length > 300)) {
      const k = ri(live.length), [o, n] = live.splice(k, 1)[0];
      for (let i = o; i < o + n; i++) map[i] = 0; R.release(o, n);
    } else {
      const n = 1 + ri(rnd() < 0.2 ? 400 : 40), o = R.alloc(n); let clash = false;
      for (let i = o; i < o + n; i++) { if (map[i]) clash = true; map[i] = 1; }
      ok(!clash, `alloc ${o}+${n} overlaps a live block`); live.push([o, n]);
    }
    if (it % 997 === 0) {
      const used = live.reduce((s, [, n]) => s + n, 0); ok(R.used === used, `used ${R.used} vs ${used}`);
      for (let i = 1; i < R.holes.length; i++) ok(R.holes[i - 1][0] + R.holes[i - 1][1] < R.holes[i][0], 'holes sorted, apart (merged)');
      const last = R.holes[R.holes.length - 1]; ok(!last || last[0] + last[1] < R.top, 'no hole touching top');
      let hi = 0; for (const [o, n] of live) hi = Math.max(hi, o + n); ok(R.top >= hi, 'top covers every block');
    }
  }
  for (const [o, n] of live.splice(0)) R.release(o, n);
  ok(R.top === 0 && R.used === 0 && R.holes.length === 0, `all freed: top ${R.top} used ${R.used} holes ${R.holes.length}`);
  const S = new ArtRange(); const s0 = S.alloc(1), s1 = S.alloc(1), s2 = S.alloc(1); S.release(s1, 1);
  ok(S.alloc(1) === s1 && s0 === 0 && s2 === 2, 'slots: the lowest free id is reused first');
}

// 3. compaction: fragment a pool, pack it; every part keeps its vertices, its indices point at them, all contiguous
{
  const V = 20000, I = 60000, pos = new Float32Array(V * 3), slot = new Float32Array(V), index = new Uint32Array(I);
  const va = new ArtRange(), ia = new ArtRange(), parts = [];
  const add = (id) => {
    const nv = 3 + ri(60), ni = 3 * (1 + ri(40)), p = { id, nv, ni, v0: va.alloc(nv), i0: ia.alloc(ni), local: [] };
    for (let i = 0; i < nv; i++) { pos[(p.v0 + i) * 3] = id; pos[(p.v0 + i) * 3 + 1] = i; pos[(p.v0 + i) * 3 + 2] = -id; slot[p.v0 + i] = id; }
    for (let k = 0; k < ni; k++) { const l = ri(nv); p.local.push(l); index[p.i0 + k] = p.v0 + l; }
    parts.push(p);
  };
  let id = 1; for (let k = 0; k < 120; k++) add(id++);
  for (let k = 0; k < 70; k++) { const p = parts.splice(ri(parts.length), 1)[0]; index.fill(0, p.i0, p.i0 + p.ni); va.release(p.v0, p.nv); ia.release(p.i0, p.ni); }
  for (let k = 0; k < 30; k++) add(id++);
  const r = artPackParts(parts, [{ array: pos, size: 3 }, { array: slot, size: 1 }], index);
  ok(r.vTop === parts.reduce((s, p) => s + p.nv, 0) && r.iTop === parts.reduce((s, p) => s + p.ni, 0), 'packed tops = live sizes');
  const vs = [...parts].sort((x, y) => x.v0 - y.v0); let e = 0; for (const p of vs) { ok(p.v0 === e, 'vertices contiguous'); e += p.v0 === e ? p.nv : 0; }
  const is = [...parts].sort((x, y) => x.i0 - y.i0); e = 0; for (const p of is) { ok(p.i0 === e, 'indices contiguous'); e += p.ni; }
  for (const p of parts) {
    let good = true;
    for (let i = 0; i < p.nv; i++) if (pos[(p.v0 + i) * 3] !== p.id || pos[(p.v0 + i) * 3 + 1] !== i || slot[p.v0 + i] !== p.id) good = false;
    for (let k = 0; k < p.ni; k++) if (index[p.i0 + k] !== p.v0 + p.local[k]) good = false;
    ok(good, `part ${p.id} data and indices survive packing`);
    ok(!('dv' in p), 'no temp field left');
  }
}

// 4. slot writes: the shader's rows rebuild the matrix (point transform), and zeroing collapses it
{
  const d = new Float32Array(64), e = new Float32Array(16);
  // column-major THREE Matrix4: rotation 30 deg about y, scale (1, 0.92, 1), translation (3, 1.5, -2)
  const c = Math.cos(0.5236), s = Math.sin(0.5236);
  e.set([c, 0, -s, 0, 0, 0.92, 0, 0, s, 0, c, 0, 3, 1.5, -2, 1]);
  artSlotWrite(d, 2, e, 1, 0.5, 0.25, 0.7);
  const o = 2 * 16, p = [0.2, -0.4, 1.1];
  const rowDot = (r) => d[o + r * 4] * p[0] + d[o + r * 4 + 1] * p[1] + d[o + r * 4 + 2] * p[2] + d[o + r * 4 + 3];
  const want = [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]];
  for (let r = 0; r < 3; r++) ok(Math.abs(rowDot(r) - want[r]) < 1e-6, `row ${r}: ${rowDot(r)} vs ${want[r]}`);
  ok(d[o + 12] === 1 && d[o + 13] === 0.5 && d[o + 14] === 0.25 && Math.abs(d[o + 15] - 0.7) < 1e-6, 'tint and alpha in texel 3');
  ok(d.slice(0, 32).every((v) => v === 0) && d.slice(48).every((v) => v === 0), 'neighbour slots untouched');
  artSlotZero(d, 2); ok(d.every((v) => v === 0), 'zeroed slot');
}
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(fails ? 1 : 0);
