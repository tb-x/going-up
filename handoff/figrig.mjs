// Node harness for the figure pools: loads the real art code (tuning .. layout banners) with three r160 (no WebGL), builds
// people, occupants, a diner and a waiter, runs artFigSync and checks that the pool vertices + slot texture reproduce
// every virtual mesh's world-space vertices as the pool shader does; then hides, re-parents, merges a fork in, disposes
// and churns 400 figures (compaction). Needs three@0.160.0's build/three.module.js, examples/jsm/geometries/
// RoundedBoxGeometry.js and examples/jsm/utils/BufferGeometryUtils.js in one folder, their "from 'three'" imports changed
// to './three.module.js'. Run: node handoff/figrig.mjs <that folder> [legacy]
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
if (!process.argv[2]) { console.log('usage: node handoff/figrig.mjs <folder with three r160 files> [legacy] [building]'); process.exit(2); }
const lib = (f) => pathToFileURL(path.join(path.resolve(process.argv[2]), f)).href;
const THREE = await import(lib('three.module.js'));
const { RoundedBoxGeometry } = await import(lib('RoundedBoxGeometry.js'));
const { mergeGeometries } = await import(lib('BufferGeometryUtils.js'));
const legacy = process.argv.includes('legacy');
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
  : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), getElementById: () => null, documentElement: { dataset: {} } };
globalThis.location = { search: legacy ? '?legacyFigures' : '' };
const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('cut ' + a); return src.slice(i, j); };
const code = cut('/* ======== tuning ======== */', process.argv.includes('building') ? '/* ======== renderer & camera ======== */' : '/* ======== layout ======== */') + '\n' + fs.readFileSync(new URL(process.argv.includes('building') ? './figrig-building.js' : './figrig-body.js', import.meta.url), 'utf8');
new Function('THREE', 'RoundedBoxGeometry', 'mergeGeometries', 'RoomEnvironment', 'legacy', code)(THREE, RoundedBoxGeometry, mergeGeometries, null, legacy);
