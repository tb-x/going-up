/* ======== vehicles (VEH_): die-cast style cars, vans, a truck and a city bus ======== */
// Needs THREE and mergeGeometries in scope. Deterministic per seed, no Math.random.
// VEH_build(kind, seed, opts) -> { group, info, setWheels(dist), setDoor(open01), setLights(night01), setBrake(on), dispose() }
//   kinds: mini, hatchback, sedan, taxi, suv, van, pickup, truck, bus (aliases: hatch, car, SUV, city bus, delivery)
//   Local frame: origin on the ground under the vehicle's centre, nose along +x, up +y, real metres (sedan 4.65 long).
//   The opening door is the front door on +z, hinged at its front edge (rotation.y > 0 swings it out). The bus doors are
//   on -z (the kerb side), plug doors that push out and slide apart.
//   opts.scale scales the whole group; setWheels takes the distance travelled in world units (scale is divided out).
//   setLights(0..1): head/tail lamps, taxi sign, bus interior; setBrake(on) brightens the tail lamps.
// Meshes: paint, glass, trim+lamps, wheels (one InstancedMesh), door, contact shadow; the bus adds 2 door leaves and a
// route sign. Geometries are cached per kind and materials per paint colour / light state, so instances share them;
// dispose() only detaches the group. VEH_setEnv(k) scales every vehicle material's env reflections (night dimming).

const VEH_MAT = new Map(), VEH_GEO = new Map(), VEH_TEX = new Map();
let VEH_ENV = 1;
const VEH_PN = 16;
// trim palette columns (uv.x picks the column): roughness / metalness per column, emissive per light state
const VEH_P = { rubber: 0, plastic: 1, gloss: 2, chrome: 3, alloy: 4, plate: 5, head: 6, tail: 7, amber: 8, sign: 9, cabin: 10, enamel: 11, fabric: 12, glass: 13 };
const VEH_ORM = [[0.9, 0], [0.55, 0], [0.14, 0], [0.07, 1], [0.26, 1], [0.4, 0], [0.04, 0.55], [0.1, 0.1], [0.1, 0.1], [0.25, 0], [0.4, 0], [0.22, 0.15], [0.95, 0], [0.04, 0.45]];
const VEH_COLS = ['#B9BEC4', '#EEEEEA', '#1C1E21', '#1F3560', '#A3242A', '#2E4A3C', '#CDBE9C', '#5A5F66', '#6E7F8E', '#8C2F39', '#D9D6CF'];
const VEH_METALLIC = new Set(['#B9BEC4', '#1C1E21', '#1F3560', '#2E4A3C', '#5A5F66', '#6E7F8E']);
const VEH_LIVERY = [['#F2C230', '#C8322A'], ['#2F5E9E', '#EEEEEA'], ['#B5362E', '#EDE3C8'], ['#3E7A4E', '#EEEEEA']];
const VEH_KIND = { hatch: 'hatchback', car: 'sedan', SUV: 'suv', 'city bus': 'bus', citybus: 'bus', delivery: 'truck', lorry: 'truck' };

function VEH_rng(seed) {
  let a = (seed >>> 0) ^ 0x9E3779B9;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ======== vehicles: materials ======== */
function VEH_matC(key, make) {
  if (VEH_MAT.has(key)) return VEH_MAT.get(key);
  const m = make(); if (m.envMapIntensity != null) { m.userData.vehEnv = m.envMapIntensity; m.envMapIntensity *= VEH_ENV; }
  VEH_MAT.set(key, m); return m;
}
function VEH_setEnv(k) { VEH_ENV = k; for (const m of VEH_MAT.values()) if (m.userData.vehEnv != null) m.envMapIntensity = m.userData.vehEnv * k; }
function VEH_dataTex(key, fill) {
  if (VEH_TEX.has(key)) return VEH_TEX.get(key);
  const d = new Uint8Array(VEH_PN * 4), q = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  for (let i = 0; i < VEH_PN; i++) { const [r, g, b] = fill(i); d[i * 4] = q(r); d[i * 4 + 1] = q(g); d[i * 4 + 2] = q(b); d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, VEH_PN, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  VEH_TEX.set(key, t); return t;
}
function VEH_trimMat(lv = 0, brake = 0) {          // lv: night level 0..4
  return VEH_matC('trim|' + lv + '|' + brake, () => {
    const n = lv / 4, hd = n, tl = Math.max(n * 0.5, brake ? 1 : 0), sg = 0.12 + 0.88 * n, cb = n;
    const orm = VEH_dataTex('orm', (i) => [1, (VEH_ORM[i] || [0.5, 0])[0], (VEH_ORM[i] || [0.5, 0])[1]]);
    const em = VEH_dataTex('em|' + lv + '|' + brake, (i) => i === 6 ? [hd, hd * 0.94, hd * 0.82] : i === 7 ? [tl, tl * 0.07, tl * 0.03]
      : i === 9 ? [sg, sg * 0.88, sg * 0.5] : i === 10 ? [cb, cb * 0.86, cb * 0.62] : i === 8 ? [n * 0.15, n * 0.08, 0] : [0, 0, 0]);
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, roughnessMap: orm, metalnessMap: orm, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 2.4, envMapIntensity: 1 });
  });
}
function VEH_paintMat(hex) {
  return VEH_matC('paint|' + hex, () => { const met = VEH_METALLIC.has(hex);
    return new THREE.MeshPhysicalMaterial({ color: hex, metalness: met ? 0.55 : 0.04, roughness: met ? 0.36 : 0.42, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.15 }); });
}
function VEH_glassMat(lv = 0, see = false) {      // see: see-through (bus windows), glows warm at night
  return VEH_matC('glass|' + lv + '|' + see, () => new THREE.MeshStandardMaterial({ color: see ? '#22313B' : '#2C3B47', roughness: 0.04, metalness: see ? 0.25 : 0.35, envMapIntensity: 1.6,
    transparent: see, opacity: see ? 0.42 : 1, depthWrite: !see, emissive: '#FFD49A', emissiveIntensity: see ? (lv / 4) * 0.35 : 0 }));
}
function VEH_shadowMat() {
  return VEH_matC('shadow', () => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.075)';
    for (let k = 0; k < 13; k++) { const ix = 4 + k * 3.2, iy = 3 + k * 1.9, w = 128 - ix * 2, h = 64 - iy * 2, r = Math.min(h / 2, 16);
      g.beginPath(); g.moveTo(ix + r, iy); g.arcTo(ix + w, iy, ix + w, iy + h, r); g.arcTo(ix + w, iy + h, ix, iy + h, r); g.arcTo(ix, iy + h, ix, iy, r); g.arcTo(ix, iy, ix + w, iy, r); g.fill(); }
    const t = new THREE.CanvasTexture(c);
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  });
}
function VEH_signMat(route) {
  return VEH_matC('sign|' + route, () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#0B0C0D'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#FFB21E'; g.font = 'bold 46px Verdana, Tahoma, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(String(route), 12, 34);
    g.font = 'bold 22px Verdana, Tahoma, sans-serif'; g.fillText('CENTRUM', 118, 34);
    g.fillStyle = 'rgba(0,0,0,0.45)'; for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 256, 1); for (let x = 0; x < 256; x += 4) g.fillRect(x, 0, 1, 64);   // LED dot grid
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: '#E6E6E6' });
  });
}

/* ======== vehicles: geometry helpers ======== */
const VEH_xf = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const VEH_box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
class VEH_B {                       // merge parts: vertex colour + palette column in uv.x
  constructor() { this.l = []; }
  add(geo, m4, hex = '#ffffff', pal = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    g.clearGroups(); g.applyMatrix4(m4);
    const n = g.attributes.position.count, uv = new Float32Array(n * 2), col = new Float32Array(n * 3), c = new THREE.Color(hex), u = (pal + 0.5) / VEH_PN;
    for (let i = 0; i < n; i++) { uv[i * 2] = u; uv[i * 2 + 1] = 0.5; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.l.push(g); geo.dispose(); return this;
  }
  box(w, h, d, x, y, z, hex, pal, rx = 0, ry = 0, rz = 0) { return this.add(VEH_box(w, h, d), VEH_xf(x, y, z, rx, ry, rz), hex, pal); }
  done() { const g = mergeGeometries(this.l, false); this.l.forEach((x) => x.dispose()); this.l = []; g.computeBoundingSphere(); return g; }
}
// outline from ops: [x, y, cornerRadius] or { arc: [cx, cy, R, a0, a1, clockwise] }
function VEH_shape(ops) {
  const sh = new THREE.Shape(), n = ops.length;
  const end = (o, last) => { if (!o.arc) return o; const [cx, cy, R, a0, a1] = o.arc, a = last ? a1 : a0; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
  let first = true;
  const go = (x, y) => { if (first) { sh.moveTo(x, y); first = false; } else sh.lineTo(x, y); };
  for (let i = 0; i < n; i++) {
    const o = ops[i];
    if (o.arc) { const [cx, cy, R, a0, a1, cw] = o.arc; go(cx + R * Math.cos(a0), cy + R * Math.sin(a0)); sh.absarc(cx, cy, R, a0, a1, cw); continue; }
    const r = o[2] || 0;
    if (!r) { go(o[0], o[1]); continue; }
    const p = end(ops[(i - 1 + n) % n], true), q = end(ops[(i + 1) % n], false);
    const d1 = Math.hypot(p[0] - o[0], p[1] - o[1]), d2 = Math.hypot(q[0] - o[0], q[1] - o[1]), rr = Math.min(r, d1 * 0.45, d2 * 0.45);
    go(o[0] + (p[0] - o[0]) * rr / d1, o[1] + (p[1] - o[1]) * rr / d1);
    sh.quadraticCurveTo(o[0], o[1], o[0] + (q[0] - o[0]) * rr / d2, o[1] + (q[1] - o[1]) * rr / d2);
  }
  return sh;
}
function VEH_ext(shape, width, bt, bs, segs = 2, cs = 5) {     // extrude across z, centred; total width incl. bevels
  const d = Math.max(0.005, width - 2 * bt);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bs, bevelSegments: segs, curveSegments: cs, steps: 1 });
  g.translate(0, 0, -d / 2); return g;
}
function VEH_inset(poly, d) {      // convex ccw polygon inset by d
  const n = poly.length, E = [];
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); E.push([a[0] - dy / l * d, a[1] + dx / l * d, dx, dy]); }
  return E.map((q, i) => { const p = E[(i - 1 + n) % n], den = p[2] * q[3] - p[3] * q[2]; if (Math.abs(den) < 1e-9) return [q[0], q[1]];
    const t = ((q[0] - p[0]) * q[3] - (q[1] - p[1]) * q[2]) / den; return [p[0] + p[2] * t, p[1] + p[3] * t]; });
}
function VEH_clipX(poly, x0, x1) {
  let P = poly;
  for (const [x, s] of [[x0, 1], [x1, -1]]) {
    const out = [];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = (a[0] - x) * s >= 0, ib = (b[0] - x) * s >= 0;
      if (ia) out.push(a); if (ia !== ib) { const t = (x - a[0]) / (b[0] - a[0]); out.push([x, a[1] + (b[1] - a[1]) * t]); } }
    P = out; if (P.length < 3) return null;
  }
  return P;
}
function VEH_arch(x, wr, cl, R) { const dy = wr - cl, dx = Math.sqrt(R * R - dy * dy), a = Math.atan2(dy, dx); return { arc: [x, wr, R, Math.PI + a, -a, true] }; }
// flat glass pane (thin slab) from a polygon, centred on z = 0
function VEH_pane(poly, r = 0.035, t = 0.01) { const g = new THREE.ExtrudeGeometry(VEH_shape(poly.map((p) => [p[0], p[1], r])), { depth: t, bevelEnabled: false, curveSegments: 2 }); g.translate(0, 0, -t / 2); return g; }
// a box lying along the segment a -> b (in the xy plane), pushed out along the outward normal by `off`
function VEH_along(B, a, b, off, thick, width, hex, pal, z = 0, shrink = 0.1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
  B.add(VEH_box(l - shrink * 2, thick, width), VEH_xf((a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off, z, 0, 0, Math.atan2(dy, dx)), hex, pal);
}
function VEH_wheelGeo(wr, tw, steel) {
  const key = 'wheel|' + wr + '|' + tw + '|' + steel; if (VEH_GEO.has(key)) return VEH_GEO.get(key);
  const B = new VEH_B(), r1 = wr * 0.64, zf = tw / 2;
  const pts = [[r1, -zf], [wr * 0.93, -zf - 0.004], [wr, -zf + tw * 0.18], [wr, zf - tw * 0.18], [wr * 0.93, zf + 0.004], [r1, zf]].map(([r, y]) => new THREE.Vector2(r, y));
  B.add(new THREE.LatheGeometry(pts, 14), VEH_xf(0, 0, 0, Math.PI / 2), '#1A1A1C', VEH_P.rubber);
  B.add(new THREE.CircleGeometry(r1, 14), VEH_xf(0, 0, zf - 0.045), steel ? '#9EA3A8' : '#2C2F33', steel ? VEH_P.enamel : VEH_P.alloy);
  B.add(new THREE.RingGeometry(r1 - 0.03, r1 + 0.004, 14), VEH_xf(0, 0, zf - 0.012), steel ? '#B9BEC4' : '#D3D7DB', VEH_P.alloy);
  if (steel) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; B.add(new THREE.CylinderGeometry(r1 * 0.11, r1 * 0.11, 0.012, 6), VEH_xf(Math.cos(a) * r1 * 0.6, Math.sin(a) * r1 * 0.6, zf - 0.034, Math.PI / 2), '#2A2C30', VEH_P.plastic); }
    B.add(new THREE.CylinderGeometry(r1 * 0.38, r1 * 0.45, 0.05, 10), VEH_xf(0, 0, zf - 0.03, Math.PI / 2), '#C9CCD0', VEH_P.chrome); }
  else { for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5, rm = r1 * 0.5; B.add(VEH_box(r1 * 0.2, r1 * 0.92, 0.024), VEH_xf(-Math.sin(a) * rm, Math.cos(a) * rm, zf - 0.03, 0, 0, a), '#D3D7DB', VEH_P.alloy); }
    B.add(new THREE.CylinderGeometry(r1 * 0.2, r1 * 0.24, 0.04, 6), VEH_xf(0, 0, zf - 0.025, Math.PI / 2), '#C9CCD0', VEH_P.chrome); }
  const g = B.done(); VEH_GEO.set(key, g); return g;
}
function VEH_plane() { if (!VEH_GEO.has('plane')) VEH_GEO.set('plane', new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)); return VEH_GEO.get('plane'); }

/* ======== vehicles: car specs ======== */
// L W H, wheel radius/width, front overhang fo, wheelbase wb, sill height cl, nose top y, beltline, windscreen base (cowl) x,
// roof front/rear x, rear window base x, rear: hatch | notch | box | bed, B-pillar x, side panes [x0, x1], doors 2 | 4
const VEH_SPEC = {
  mini:      { L: 3.55, W: 1.66, H: 1.50, wr: 0.29, tw: 0.18, fo: 0.66, wb: 2.42, cl: 0.15, noseY: 0.73, belt: 0.95, cowlX: 0.62, rFX: -0.12, rRX: -1.52, tailX: -1.71, rear: 'hatch', bX: -0.62, panes: [[-0.57, 9], [-9, -0.67]], doors: 2 },
  hatchback: { L: 4.05, W: 1.78, H: 1.47, wr: 0.31, tw: 0.2, fo: 0.82, wb: 2.6, cl: 0.17, noseY: 0.74, belt: 0.95, cowlX: 0.78, rFX: -0.06, rRX: -1.7, tailX: -1.96, rear: 'hatch', bX: -0.3, panes: [[-0.25, 9], [-1.42, -0.35]], doors: 4 },
  sedan:     { L: 4.65, W: 1.82, H: 1.44, wr: 0.32, tw: 0.21, fo: 0.9, wb: 2.75, cl: 0.17, noseY: 0.72, belt: 0.93, cowlX: 0.95, rFX: 0.12, rRX: -1.12, tailX: -1.66, rear: 'notch', deck: 0.97, bX: -0.26, panes: [[-0.21, 9], [-1.3, -0.31]], doors: 4 },
  suv:       { L: 4.55, W: 1.88, H: 1.70, wr: 0.37, tw: 0.24, fo: 0.86, wb: 2.72, cl: 0.25, noseY: 0.98, belt: 1.12, cowlX: 0.95, rFX: 0.18, rRX: -1.95, tailX: -2.18, rear: 'hatch', bX: -0.16, panes: [[-0.11, 9], [-1.22, -0.21]], quarter: -1.32, doors: 4, rails: true, cladding: true },
  van:       { L: 4.95, W: 1.95, H: 1.98, wr: 0.33, tw: 0.22, fo: 0.85, wb: 3.0, cl: 0.2, noseY: 0.96, belt: 1.08, cowlX: 1.45, rFX: 0.72, rRX: -2.4, tailX: -2.44, rear: 'box', bX: 0.36, panes: [[0.41, 9]], doors: 2, slide: true, cab: 0.93, steel: true },
  pickup:    { L: 5.3, W: 1.92, H: 1.82, wr: 0.38, tw: 0.25, fo: 0.95, wb: 3.2, cl: 0.27, noseY: 1.04, belt: 1.15, cowlX: 1.25, rFX: 0.52, rRX: -0.8, tailX: -0.92, rear: 'bed', bX: -0.08, panes: [[-0.03, 9], [-0.86, -0.13]], doors: 4, cladding: true },
};
VEH_SPEC.taxi = Object.assign({}, VEH_SPEC.sedan, { taxi: true });

function VEH_carGeo(kind) {
  if (VEH_GEO.has('car|' + kind)) return VEH_GEO.get('car|' + kind);
  const s = VEH_SPEC[kind], { L, W, H, wr, cl, noseY, belt, cowlX, rFX, rRX, tailX } = s, h = L / 2;
  const R = wr + 0.075, xf = h - s.fo, xr = xf - s.wb, btL = 0.07, bsL = 0.055, Wc = W * (s.cab || 0.86), btC = 0.075, bsC = 0.05, dC = Wc - 2 * btC;
  const deck = s.rear === 'notch' ? s.deck : belt + 0.02;
  // ---- paint: lower body with wheel arches, cabin, mirror caps, handles
  const P = new VEH_B();
  const lower = [[-h + 0.06, cl + 0.02, 0.05], VEH_arch(xr, wr, cl, R), VEH_arch(xf, wr, cl, R), [h - 0.06, cl + 0.02, 0.05], [h, cl + 0.28, 0.12], [h - 0.07, noseY, 0.16],
    [(h + cowlX) / 2, noseY + (belt - noseY) * 0.72, 0.5], [cowlX - 0.1, belt, 0.1]];
  if (s.rear === 'notch') lower.push([tailX - 0.05, belt + 0.01, 0.08], [-h + 0.07, deck, 0.14], [-h, cl + 0.3, 0.12]);
  else lower.push([-h + 0.03, deck, s.rear === 'bed' ? 0.05 : 0.12], [-h, cl + 0.3, 0.1]);
  P.add(VEH_ext(VEH_shape(lower), W, btL, bsL, 2, 4), new THREE.Matrix4(), '#ffffff');
  const cabPoly = [[cowlX, belt], [rFX, H], [rRX, H], [tailX, belt]];
  const cab = [[tailX + 0.04, belt - 0.08, 0], [cowlX - 0.02, belt - 0.08, 0], [cowlX, belt, 0.03], [rFX, H, 0.16], [(rFX + rRX) / 2, H + 0.025, 0.7], [rRX, H, 0.16], [tailX, belt, 0.03]];
  P.add(VEH_ext(VEH_shape(cab), Wc, btC, bsC, 2, 4), new THREE.Matrix4(), '#ffffff');
  const handles = [[s.bX - 0.2, belt - 0.1]]; if (s.doors === 4) handles.push([xr + R + 0.33, belt - 0.1]);
  for (const sd of [-1, 1]) {
    P.box(0.11, 0.1, 0.17, cowlX - 0.16, belt + 0.11, sd * (W / 2 + 0.07), '#fff');                    // mirror cap
    for (const [hx, hy] of handles) if (!(sd > 0 && hx === handles[0][0])) P.box(0.13, 0.03, 0.025, hx, hy, sd * (W / 2 + 0.01), '#fff');
  }
  const paint = P.done();
  // ---- glass
  const G = new VEH_B(), win = VEH_inset(cabPoly, 0.075), seal = VEH_inset(cabPoly, 0.045);
  const ranges = s.panes.slice(); if (s.quarter) ranges.push([-9, s.quarter]);
  const T = new VEH_B();
  for (const sd of [-1, 1]) for (const [a, b] of ranges) {
    const pw = VEH_clipX(win, a, b), ps = VEH_clipX(seal, a - 0.03, b + 0.03);
    if (pw) G.add(VEH_pane(pw, 0.035, 0.008), VEH_xf(0, 0, sd * (Wc / 2 + 0.006)), '#ffffff');
    if (ps) T.add(VEH_pane(ps, 0.04, 0.006), VEH_xf(0, 0, sd * (Wc / 2 + 0.002)), '#0E0F10', VEH_P.gloss);
  }
  const ws = [[cowlX, belt], [rFX, H]], rw = [[rRX, H], [tailX, belt]];
  VEH_along(G, ws[0], ws[1], bsC + 0.008, 0.01, dC - 0.06, '#fff', 0, 0, 0.06);
  VEH_along(G, rw[0], rw[1], bsC + 0.008, 0.01, dC - 0.1, '#fff', 0, 0, 0.08);
  VEH_along(T, ws[0], ws[1], bsC + 0.003, 0.008, dC - 0.02, '#0E0F10', VEH_P.gloss, 0, 0.03);
  VEH_along(T, rw[0], rw[1], bsC + 0.003, 0.008, dC - 0.05, '#0E0F10', VEH_P.gloss, 0, 0.05);
  const glass = G.done();
  // ---- trim: lamps, grille, bumpers, plates, wheel wells, seams, wipers, mirrors, extras
  const faceX = (y) => h - 0.07 * Math.max(0, Math.min(1, (y - cl - 0.28) / (noseY - cl - 0.28))) + bsL;
  const hy = noseY - 0.13, tailY = deck - 0.13;
  for (const sd of [-1, 1]) {
    T.box(0.1, 0.12, 0.36, faceX(hy) - 0.045, hy, sd * (W / 2 - 0.3), '#E9EEF2', VEH_P.head, 0, sd * 0.08, -0.25);      // headlamp lens
    T.box(0.28, 0.1, 0.06, h - 0.2, hy + 0.005, sd * (W / 2 - 0.012), '#E9EEF2', VEH_P.head, 0, 0, 0);                   // headlamp wrap
    T.box(0.06, 0.035, 0.14, faceX(hy - 0.1) - 0.02, hy - 0.1, sd * (W / 2 - 0.27), '#E8A33A', VEH_P.amber);             // indicator
    T.box(0.09, 0.11, 0.4, -h - bsL + 0.035, tailY, sd * (W / 2 - 0.3), '#8E1414', VEH_P.tail);                            // tail lamp
    T.box(0.22, 0.1, 0.06, -h + 0.14, tailY, sd * (W / 2 - 0.012), '#8E1414', VEH_P.tail);
    T.box(0.092, 0.035, 0.12, -h - bsL + 0.036, tailY - 0.03, sd * (W / 2 - 0.42), '#E8E8E4', VEH_P.plastic);              // reverse lamp
    T.box(0.06, 0.04, 0.09, cowlX - 0.12, belt + 0.06, sd * (W / 2 - 0.01), '#18191B', VEH_P.plastic);                   // mirror stalk
    T.box(0.02, 0.07, 0.13, cowlX - 0.105, belt + 0.11, sd * (W / 2 + 0.07), '#2A3036', VEH_P.chrome);                   // mirror glass
    T.box(Math.max(0.2, xf - xr - 2 * R - 0.1), s.cladding ? 0.12 : 0.07, 0.03, (xf + xr) / 2, cl + (s.cladding ? 0.08 : 0.06), sd * (W / 2 + 0.004), '#1C1D1F', VEH_P.plastic);   // sill strip
    const seams = [Math.min(cowlX - 0.08, xf - R - 0.04), s.bX]; if (s.doors === 4) seams.push(xr + R + 0.06);
    if (s.slide) seams.push(xr + R + 0.2);
    for (const x of seams) T.box(0.008, belt - cl - 0.12, 0.006, x, (belt + cl) / 2 + 0.02, sd * (W / 2 + 0.002), '#26282B', VEH_P.plastic);
    if (s.slide && sd < 0) T.box(xr + R + 0.2 - s.bX - 0.1, 0.012, 0.01, (xr + R + 0.2 + s.bX) / 2, belt + 0.18, sd * (W / 2 + 0.004), '#26282B', VEH_P.plastic);
    for (const x of [xf, xr]) T.box(2 * R - 0.06, wr + R - cl - 0.03, 0.02, x, (cl + wr + R) / 2 - 0.02, sd * (W / 2 - 0.2), '#0C0C0D', VEH_P.rubber);   // wheel well
    if (s.cladding) for (const x of [xf, xr]) T.add(new THREE.TorusGeometry(R + 0.02, 0.035, 3, 12, Math.PI + 0.5), VEH_xf(x, wr, sd * (W / 2 - 0.01), 0, 0, -0.25), '#1C1D1F', VEH_P.plastic);
    if (s.rails) { T.box(rFX - rRX - 0.35, 0.035, 0.04, (rFX + rRX) / 2 - 0.05, H + 0.07, sd * (Wc / 2 - 0.13), '#2A2C30', VEH_P.alloy);
      for (const x of [rFX - 0.25, rRX + 0.15]) T.box(0.06, 0.06, 0.04, x, H + 0.035, sd * (Wc / 2 - 0.13), '#1C1D1F', VEH_P.plastic); }
    T.box(0.012, 0.014, 0.48, cowlX - 0.07, belt + 0.04, sd * 0.3, '#151617', VEH_P.plastic, 0, 0, 0.4);                  // wipers
  }
  for (const x of [xf, xr]) T.box(2 * R - 0.08, wr + R - cl - 0.05, W - 0.42, x, (cl + wr + R) / 2 - 0.03, 0, '#0C0C0D', VEH_P.rubber);
  T.box(0.08, 0.15, W - 0.98, faceX(hy) - 0.03, hy - 0.02, 0, '#0D0E10', VEH_P.gloss);                                       // grille
  T.box(0.085, 0.022, W - 0.98, faceX(hy + 0.05) - 0.03, hy + 0.055, 0, '#D6DADE', VEH_P.chrome);
  T.add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), VEH_xf(faceX(hy) + 0.005, hy, 0, 0, 0, Math.PI / 2), '#D6DADE', VEH_P.chrome);   // badge
  T.box(0.08, 0.1, W - 0.62, h + bsL - 0.045, cl + 0.1, 0, '#18191B', VEH_P.plastic);                                         // lower intake
  T.box(0.08, 0.06, W - 0.2, -h - bsL + 0.045, cl + 0.07, 0, '#18191B', VEH_P.plastic);                                       // rear diffuser
  const plate = (x, y, rot) => { T.box(0.02, 0.11, 0.5, x, y, 0, '#F4F4F0', VEH_P.plate, 0, rot, 0); T.box(0.022, 0.11, 0.05, x, y, rot ? -0.225 : 0.225, '#2A4FA8', VEH_P.plate);
    for (let k = 0; k < 5; k++) T.box(0.024, 0.06, 0.045, x, y, (rot ? 1 : -1) * (-0.13 + k * 0.075), '#1A1A1A', VEH_P.plate); };
  plate(h + bsL + 0.0, cl + 0.24, 0); plate(-h - bsL - 0.0, s.rear === 'notch' ? deck - 0.3 : cl + 0.46, Math.PI);
  T.add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), VEH_xf(-h - 0.02, cl + 0.03, -W * 0.3, 0, 0, Math.PI / 2), '#C9CCD0', VEH_P.chrome);   // exhaust
  if (s.rear !== 'bed' && s.rear !== 'notch') T.box(0.05, 0.035, 0.3, rRX - 0.02, H - 0.02, 0, '#8E1414', VEH_P.tail);       // high stop lamp
  if (s.rear === 'notch') T.box(0.05, 0.025, 0.3, tailX + 0.06, belt + 0.03, 0, '#8E1414', VEH_P.tail);
  T.box(0.16, 0.05, 0.05, rRX + 0.28, H + 0.035, 0, '#141517', VEH_P.gloss);                                                   // shark fin
  if (s.rear === 'bed') {
    const bl = -0.95 + h;
    T.box(bl - 0.06, 0.03, W - 0.16, (-h - 0.95) / 2, belt + 0.015, 0, '#1C1D1F', VEH_P.plastic);                             // tonneau
    for (const sd of [-1, 1]) T.box(bl - 0.04, 0.03, 0.06, (-h - 0.95) / 2, belt + 0.02, sd * (W / 2 - 0.05), '#1C1D1F', VEH_P.plastic);
    T.box(0.13, 0.14, W - 0.06, -h - 0.04, cl + 0.12, 0, '#C9CCD0', VEH_P.chrome);
    T.box(0.05, 0.7, 0.05, -0.97, (belt + H) / 2 + 0.05, 0, '#1C1D1F', VEH_P.plastic);
  }
  if (s.taxi) {
    const sx = (rFX + rRX) / 2 + 0.05;
    T.box(0.62, 0.04, 0.3, sx, H + 0.045, 0, '#141517', VEH_P.plastic); T.box(0.54, 0.15, 0.24, sx, H + 0.14, 0, '#FFF3C4', VEH_P.sign);
    for (const sd of [-1, 1]) for (let k = 0; k < 12; k++) T.box(0.075, 0.07, 0.006, cowlX - 0.28 - k * 0.15 - (k % 2 ? 0 : 0.075), belt - 0.15 - (k % 2) * 0.07, sd * (W / 2 + 0.006), '#151617', VEH_P.gloss);
  }
  if (s.rear === 'box') T.box(0.006, deck - cl - 0.45, 0.012, -h - bsL + 0.002, (deck + cl) / 2 + 0.3, 0, '#26282B', VEH_P.plastic);
  const trim = T.done();
  // ---- door (front, +z), hinged at its front edge
  const df = Math.min(cowlX - 0.08, xf - R - 0.04), dz = W / 2 - 0.028;
  const doorShape = VEH_shape([[df, cl + 0.09, 0.03], [s.bX - 0.006, cl + 0.09, 0.03], [s.bX - 0.006, belt - 0.006, 0.02], [df, belt - 0.006, 0.02]]);
  const D = new VEH_B();
  D.add(new THREE.ExtrudeGeometry(doorShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1, curveSegments: 2 }), VEH_xf(-df, 0, -0.015), '#fff');
  D.box(0.13, 0.03, 0.025, s.bX - 0.2 - df, belt - 0.1, 0.03, '#fff');
  const out = { paint, glass, trim, door: D.done(), hinge: [df, 0, dz], wheel: VEH_wheelGeo(wr, s.tw, !!s.steel),
    wheels: [[xf, wr, W / 2 - s.tw / 2 - 0.035, 0], [xr, wr, W / 2 - s.tw / 2 - 0.035, 0], [xf, wr, -(W / 2 - s.tw / 2 - 0.035), 1], [xr, wr, -(W / 2 - s.tw / 2 - 0.035), 1]],
    L: L + 2 * bsL, W, H: H + 0.03, wr, doorX: s.bX };
  VEH_GEO.set('car|' + kind, out); return out;
}

/* ======== vehicles: delivery truck ======== */
function VEH_truckGeo(stripe) {
  const key = 'truck|' + stripe; if (VEH_GEO.has(key)) return VEH_GEO.get(key);
  const L = 6.6, W = 2.3, H = 3.15, wr = 0.46, h = L / 2, xf = h - 1.2, xr = xf - 3.7, cl = 0.45, R = wr + 0.08, cx0 = h - 1.9, bs = 0.05;
  const P = new VEH_B();
  P.add(VEH_ext(VEH_shape([[cx0, cl + 0.12, 0], VEH_arch(xf, wr, cl, R), [h - 0.04, cl + 0.12, 0.05], [h + 0.02, 1.3, 0.12], [h - 0.12, 2.55, 0.22], [cx0, 2.62, 0.05]]), W, 0.08, bs, 2, 5), new THREE.Matrix4(), '#fff');
  for (const sd of [-1, 1]) P.box(0.08, 0.36, 0.2, h - 0.12, 2.0, sd * (W / 2 + 0.25), '#fff');
  const paint = P.done();
  const G = new VEH_B(), T = new VEH_B(), dC = W - 0.16;
  const ws = [[h + 0.02, 1.38], [h - 0.12, 2.48]];
  VEH_along(G, ws[0], ws[1], bs + 0.008, 0.01, dC - 0.1, '#fff', 0, 0, 0.04); VEH_along(T, ws[0], ws[1], bs + 0.003, 0.008, dC - 0.04, '#0E0F10', VEH_P.gloss, 0, 0.0);
  const sw = [[cx0 + 0.5, 1.48], [h - 0.12, 1.48], [h - 0.22, 2.4], [cx0 + 0.5, 2.4]];
  for (const sd of [-1, 1]) { G.add(VEH_pane(sw, 0.04, 0.008), VEH_xf(0, 0, sd * (W / 2 + 0.006)), '#fff'); T.add(VEH_pane(VEH_inset(sw, -0.03), 0.05, 0.006), VEH_xf(0, 0, sd * (W / 2 + 0.002)), '#0E0F10', VEH_P.gloss); }
  const glass = G.done();
  // box body, chassis, lamps, mirrors, steps, mudguards, bumper
  const bx0 = -h, bx1 = cx0 - 0.08, bl = bx1 - bx0;
  T.box(bl, 2.3, W, (bx0 + bx1) / 2, 0.85 + 1.15, 0, '#F1F1EC', VEH_P.enamel);
  for (const sd of [-1, 1]) {
    T.box(bl - 0.3, 0.32, 0.01, (bx0 + bx1) / 2, 1.25, sd * (W / 2 + 0.004), stripe, VEH_P.enamel);
    T.box(bl - 0.3, 0.06, 0.01, (bx0 + bx1) / 2, 1.5, sd * (W / 2 + 0.004), stripe, VEH_P.enamel);
    for (let x = bx0 + 0.1; x < bx1; x += 0.62) T.box(0.03, 2.3, 0.012, x, 2.0, sd * (W / 2 + 0.002), '#D9D9D3', VEH_P.enamel);
    T.box(bl + 0.02, 0.06, 0.03, (bx0 + bx1) / 2, 3.13, sd * (W / 2 + 0.01), '#C9CCD0', VEH_P.alloy);
    T.box(0.32, 0.03, 0.03, h - 0.12, 2.2, sd * (W / 2 + 0.1), '#18191B', VEH_P.plastic);
    T.box(0.02, 0.32, 0.17, h - 0.08, 2.0, sd * (W / 2 + 0.25), '#2A3036', VEH_P.chrome);
    T.box(0.36, 0.05, 0.22, cx0 + 0.6, 0.62, sd * (W / 2 - 0.08), '#1C1D1F', VEH_P.plastic);                     // step
    T.box(1.05, 0.06, 0.34, xr, wr + R + 0.02, sd * (W / 2 - 0.17), '#1C1D1F', VEH_P.plastic);                 // mudguard
    T.box(0.1, 0.14, 0.42, h + bs + 0.02, 0.82, sd * (W / 2 - 0.32), '#E9EEF2', VEH_P.head);
    T.box(0.06, 0.06, 0.14, h + bs + 0.01, 0.98, sd * (W / 2 - 0.2), '#E8A33A', VEH_P.amber);
    T.box(0.06, 0.24, 0.16, bx0 - 0.03, 0.72, sd * (W / 2 - 0.16), '#8E1414', VEH_P.tail);
    T.box(0.03, 0.03, 0.03, bx0 + 0.3, 3.1, sd * (W / 2 - 0.06), '#E8A33A', VEH_P.amber);
    T.box(0.008, 0.75, 0.006, cx0 + 0.46, 1.1, sd * (W / 2 + 0.002), '#26282B', VEH_P.plastic);
    T.box(0.012, 1.0, 0.04, h - 0.04 - 0.02, 1.9, sd * (W / 2 - 0.02), '#151617', VEH_P.plastic);
    T.box(2 * R - 0.06, wr + R - cl, 0.02, xf, (cl + wr + R) / 2, sd * (W / 2 - 0.2), '#0C0C0D', VEH_P.rubber);
  }
  T.box(2 * R - 0.08, wr + R - cl - 0.05, W - 0.42, xf, (cl + wr + R) / 2 - 0.03, 0, '#0C0C0D', VEH_P.rubber);
  T.box(L - 0.4, 0.26, 0.95, -0.1, 0.62, 0, '#1C1D1F', VEH_P.plastic);                                                    // chassis
  T.box(0.14, 0.26, W - 0.04, h + bs + 0.01, 0.6, 0, '#2A2C30', VEH_P.plastic);                                        // bumper
  T.box(0.06, 0.18, W - 0.8, h + bs + 0.005, 1.15, 0, '#0D0E10', VEH_P.gloss);                                         // grille
  T.box(0.012, 2.2, 0.02, bx0 - 0.006, 2.0, 0, '#9A9A94', VEH_P.enamel);                                               // rear door seam
  for (const z of [-0.35, 0.35]) T.box(0.03, 1.6, 0.03, bx0 - 0.02, 2.0, z, '#C9CCD0', VEH_P.chrome);
  T.box(0.02, 0.11, 0.5, bx0 - 0.05, 0.62, 0, '#F4F4F0', VEH_P.plate); T.box(0.02, 0.11, 0.5, h + bs + 0.08, 0.5, 0, '#F4F4F0', VEH_P.plate);
  T.box(0.5, 0.12, 0.25, cx0 + 0.6, 2.66, 0, '#E8A33A', VEH_P.amber);
  const trim = T.done();
  const df = cx0 + 0.5, dz = W / 2 - 0.028, D = new VEH_B();
  D.add(new THREE.ExtrudeGeometry(VEH_shape([[df, 1.0, 0.03], [h - 0.1, 1.0, 0.03], [h - 0.1, 1.44, 0.02], [df, 1.44, 0.02]]), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1, curveSegments: 2 }), VEH_xf(-df, 0, -0.015), '#fff');
  D.box(0.16, 0.035, 0.025, 0.12, 1.36, 0.03, '#fff');
  const zw = W / 2 - 0.2;
  const out = { paint, glass, trim, door: D.done(), hinge: [df, 0, dz], wheel: VEH_wheelGeo(wr, 0.3, true),
    wheels: [[xf, wr, zw, 0], [xr, wr, zw, 0], [xf, wr, -zw, 1], [xr, wr, -zw, 1]], L: L + 0.1, W, H, wr, doorX: h - 0.1 };
  VEH_GEO.set(key, out); return out;
}

/* ======== vehicles: city bus ======== */
function VEH_busGeo(li) {
  const key = 'bus|' + li; if (VEH_GEO.has(key)) return VEH_GEO.get(key);
  const band = VEH_LIVERY[li][1], L = 10.6, W = 2.5, H = 3.05, wr = 0.5, h = L / 2, xf = h - 2.55, xr = xf - 5.3, cl = 0.32, R = wr + 0.08, belt = 1.15, top = 2.62, bs = 0.06;
  const doors = [[xf + R + 0.14, h - 0.32], [-0.65, 0.65]];          // front door, middle door (x ranges, -z side)
  const P = new VEH_B();
  P.add(VEH_ext(VEH_shape([[-h + 0.05, cl + 0.02, 0.05], VEH_arch(xr, wr, cl, R), VEH_arch(xf, wr, cl, R), [h - 0.05, cl + 0.02, 0.05], [h + 0.02, cl + 0.45, 0.12], [h, belt, 0.03], [-h, belt, 0.03], [-h - 0.02, cl + 0.45, 0.12]]), W, 0.08, bs, 2, 5), new THREE.Matrix4(), '#fff');
  P.add(VEH_ext(VEH_shape([[-h + 0.01, top, 0], [h - 0.03, top, 0], [h - 0.06, H, 0.24], [-h + 0.02, H, 0.18]]), W, 0.08, bs, 2, 5), new THREE.Matrix4(), '#fff');
  const pil = []; for (let x = -h + 0.35; x <= h - 0.2; x += 1.32) pil.push(x);
  const inDoor = (x, pad = 0.1) => doors.some(([a, b]) => x > a - pad && x < b + pad);
  for (const sd of [-1, 1]) {
    for (const x of pil) if (!(sd < 0 && inDoor(x))) P.box(0.1, top - belt, 0.06, x, (top + belt) / 2, sd * (W / 2 - 0.02), '#fff');
    if (sd < 0) for (const [a, b] of doors) for (const x of [a - 0.05, b + 0.05]) P.box(0.1, top - belt, 0.06, x, (top + belt) / 2, sd * (W / 2 - 0.02), '#fff');
    P.box(0.12, top - belt, 0.12, h - 0.02, (top + belt) / 2, sd * (W / 2 - 0.07), '#fff');                 // front corner pillars
    P.box(0.1, top - belt, 0.12, -h + 0.03, (top + belt) / 2, sd * (W / 2 - 0.07), '#fff');
    P.box(0.16, 0.4, 0.1, h + 0.08, 2.35, sd * (W / 2 + 0.2), '#fff');                                       // mirror heads
  }
  P.box(0.06, top - belt, W - 0.2, -h - 0.0, (top + belt) / 2, 0, '#fff');                                  // rear panel
  P.box(1.6, 0.22, 1.3, -1.5, H + 0.1, 0, '#fff'); P.box(1.3, 0.18, 1.2, 2.2, H + 0.08, 0, '#fff');         // roof pods
  const paint = P.done();
  const G = new VEH_B(), T = new VEH_B();
  const gy0 = belt + 0.01, gy1 = top - 0.01, gh = gy1 - gy0, gyc = (gy0 + gy1) / 2;
  const segs = (sd) => { if (sd > 0) return [[-h + 0.1, h - 0.1]]; const out = []; let a = -h + 0.1; for (const [d0, d1] of doors.slice().sort((p, q) => p[0] - q[0])) { out.push([a, d0 - 0.1]); a = d1 + 0.1; } out.push([a, h - 0.1]); return out; };
  for (const sd of [-1, 1]) for (const [a, b] of segs(sd)) if (b - a > 0.2) {
    G.box(b - a, gh, 0.02, (a + b) / 2, gyc, sd * (W / 2 - 0.05), '#fff', 0);
    T.box(b - a, 0.05, 0.03, (a + b) / 2, gy0 + 0.02, sd * (W / 2 - 0.035), '#0E0F10', VEH_P.gloss);
    T.box(b - a, 0.05, 0.03, (a + b) / 2, gy1 - 0.02, sd * (W / 2 - 0.035), '#0E0F10', VEH_P.gloss);
  }
  G.box(0.03, gh + 0.1, W - 0.24, h + 0.04, gyc - 0.04, 0, '#fff', 0, 0, 0, -0.04);                           // windscreen
  G.box(0.02, 0.62, W - 0.9, -h - 0.04, 2.18, 0, '#fff', 0);                                                  // rear window
  const glass = G.done();
  // interior: floor, ceiling + light strips, seats, yellow poles (seen through the windows)
  T.box(L - 0.4, 0.012, W - 0.2, 0, belt + 0.008, 0, '#3A3C40', VEH_P.rubber);
  T.box(L - 0.3, 0.012, W - 0.16, 0, top - 0.008, 0, '#D9D9D4', VEH_P.plastic);
  for (const sd of [-1, 1]) T.box(L - 1.2, 0.03, 0.12, 0, top - 0.03, sd * 0.55, '#FFF6DE', VEH_P.cabin);
  for (let x = -h + 0.7; x < h - 1.0; x += 0.82) for (const sd of [-1, 1]) {
    if (sd < 0 && inDoor(x, 0.25)) continue; if (x > xf - 0.2) continue;
    T.box(0.08, 0.42, 0.85, x, belt + 0.21, sd * 0.68, '#3E5A8A', VEH_P.fabric);
    T.box(0.1, 0.06, 0.85, x - 0.03, belt + 0.44, sd * 0.68, '#2E3238', VEH_P.plastic);
  }
  for (const x of [doors[0][0] - 0.15, doors[1][0] - 0.15, doors[1][1] + 0.15, -h + 1.6, xf - 0.3]) T.add(new THREE.CylinderGeometry(0.025, 0.025, top - belt, 6), VEH_xf(x, (top + belt) / 2, x === -h + 1.6 ? 0.3 : -0.42), '#F2C230', VEH_P.enamel);
  for (const sd of [-1, 1]) T.add(new THREE.CylinderGeometry(0.02, 0.02, L - 1.5, 6), VEH_xf(-0.3, top - 0.18, sd * 0.42, 0, 0, Math.PI / 2), '#F2C230', VEH_P.enamel);
  T.box(0.6, 0.5, 0.5, xf + 0.4, belt + 0.25, 0.55, '#2E3238', VEH_P.plastic);                                     // driver's cab
  T.add(new THREE.TorusGeometry(0.2, 0.025, 4, 12), VEH_xf(xf + 0.65, belt + 0.65, 0.55, 0, Math.PI / 2, 0), '#141517', VEH_P.plastic);
  // livery band, bumpers, lamps, plates, mirrors arms, wheel wells, door openings
  for (const sd of [-1, 1]) {
    T.box(L - 0.2, 0.3, 0.01, 0, 0.74, sd * (W / 2 + 0.004), band, VEH_P.enamel);
    T.box(0.5, 0.04, 0.04, h + 0.0, 2.55, sd * (W / 2 + 0.0), '#18191B', VEH_P.plastic, 0, 0, 0);
    T.box(0.04, 0.3, 0.04, h + 0.18, 2.4, sd * (W / 2 + 0.14), '#18191B', VEH_P.plastic);
    T.box(0.02, 0.32, 0.08, h + 0.165, 2.35, sd * (W / 2 + 0.2), '#2A3036', VEH_P.chrome);
    T.box(0.08, 0.17, 0.38, h + bs + 0.02, 0.72, sd * (W / 2 - 0.34), '#E9EEF2', VEH_P.head);
    T.box(0.07, 0.06, 0.18, h + bs + 0.01, 0.9, sd * (W / 2 - 0.3), '#E8A33A', VEH_P.amber);
    T.box(0.07, 0.55, 0.15, -h - bs - 0.0, 0.95, sd * (W / 2 - 0.14), '#8E1414', VEH_P.tail);
    T.box(0.07, 0.2, 0.15, -h - bs - 0.0, 2.75, sd * (W / 2 - 0.14), '#8E1414', VEH_P.tail);
    for (const x of [xf, xr]) T.box(2 * R - 0.06, wr + R - cl - 0.03, 0.02, x, (cl + wr + R) / 2 - 0.02, sd * (W / 2 - 0.22), '#0C0C0D', VEH_P.rubber);
    for (const x of [h - 0.6, -h + 0.5]) T.box(0.1, 0.05, 0.04, x, H + 0.0, sd * (W / 2 - 0.15), '#E8A33A', VEH_P.amber);
  }
  for (const x of [xf, xr]) T.box(2 * R - 0.08, wr + R - cl - 0.05, W - 0.46, x, (cl + wr + R) / 2 - 0.03, 0, '#0C0C0D', VEH_P.rubber);
  T.box(0.12, 0.3, W - 0.02, h + bs + 0.02, cl + 0.16, 0, '#2A2C30', VEH_P.plastic); T.box(0.12, 0.3, W - 0.02, -h - bs - 0.02, cl + 0.16, 0, '#2A2C30', VEH_P.plastic);
  T.box(0.02, 0.11, 0.5, h + bs + 0.09, cl + 0.38, 0, '#F4F4F0', VEH_P.plate); T.box(0.02, 0.11, 0.5, -h - bs - 0.09, cl + 0.38, 0, '#F4F4F0', VEH_P.plate);
  T.box(0.06, 0.26, W - 0.36, h - 0.01 + bs, 2.79, 0, '#0B0C0D', VEH_P.gloss);                                    // sign housings
  T.box(0.05, 0.22, 0.7, -h - bs + 0.0, 2.85, 0, '#0B0C0D', VEH_P.gloss);
  for (const [a, b] of doors) {
    T.box(b - a, top - cl - 0.02, 0.02, (a + b) / 2, (top + cl) / 2, -(W / 2 + 0.008), '#16171A', VEH_P.plastic);    // dark doorway
    T.box(b - a - 0.06, 0.03, 0.03, (a + b) / 2, cl + 0.06, -(W / 2 + 0.02), '#FFF6DE', VEH_P.cabin);               // step light
  }
  const trim = T.done();
  // door leaves: A = the -x leaf of each door, B = the +x leaf
  const leaf = (sideK) => { const B = new VEH_B();
    for (const [a, b] of doors) { const w = (b - a) / 2 - 0.01, cx = sideK < 0 ? a + w / 2 : b - w / 2, y0 = cl + 0.04, y1 = top - 0.04, cy = (y0 + y1) / 2, hh = y1 - y0;
      B.box(w, hh, 0.035, cx, cy, 0, '#202326', VEH_P.glass);
      B.box(w, 0.06, 0.04, cx, y0 + 0.03, 0, '#141517', VEH_P.plastic); B.box(w, 0.06, 0.04, cx, y1 - 0.03, 0, '#141517', VEH_P.plastic); B.box(w, 0.05, 0.04, cx, cy - 0.15, 0, '#141517', VEH_P.plastic);
      B.box(0.05, hh, 0.04, sideK < 0 ? a + 0.025 : b - 0.025, cy, 0, '#141517', VEH_P.plastic); B.box(0.04, hh, 0.045, sideK < 0 ? a + w - 0.02 : b - w + 0.02, cy, 0, '#2A2C30', VEH_P.rubber);
      B.add(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), VEH_xf(sideK < 0 ? a + w - 0.12 : b - w + 0.12, cy + 0.1, -0.03), '#C9CCD0', VEH_P.chrome); }
    return B.done(); };
  const sg = []; const pl = (w, hh, x, y, z, ry) => sg.push(new THREE.PlaneGeometry(w, hh).rotateY(ry).translate(x, y, z));
  pl(W - 0.44, 0.22, h + bs + 0.035, 2.79, 0, Math.PI / 2); pl(0.66, 0.19, -h - bs - 0.03, 2.85, 0, -Math.PI / 2); pl(1.0, 0.22, h - 1.3, 2.45, W / 2 - 0.07, 0);
  const sign = mergeGeometries(sg, false); sg.forEach((g) => g.dispose());
  const zw = W / 2 - 0.24;
  const out = { paint, glass, trim, leafA: leaf(-1), leafB: leaf(1), leafZ: -(W / 2 + 0.035), sign, wheel: VEH_wheelGeo(wr, 0.32, true),
    wheels: [[xf, wr, zw, 0], [xr, wr, zw, 0], [xf, wr, -zw, 1], [xr, wr, -zw, 1]], L: L + 0.2, W, H: H + 0.2, wr, see: true, doorXs: doors.map(([a, b]) => (a + b) / 2) };
  VEH_GEO.set(key, out); return out;
}

/* ======== vehicles: build ======== */
function VEH_build(kind, seed = 1, opts = {}) {
  kind = VEH_KIND[kind] || String(kind).toLowerCase(); if (!VEH_SPEC[kind] && kind !== 'bus' && kind !== 'truck') kind = 'sedan';
  const r = VEH_rng((seed | 0) * 7919 + 13); r();
  let col, K, route = 0;
  if (kind === 'bus') { const li = (r() * VEH_LIVERY.length) | 0; col = VEH_LIVERY[li][0]; K = VEH_busGeo(li); route = [12, 24, 105, 175, 520, 7, 33][(r() * 7) | 0]; }
  else if (kind === 'truck') { col = ['#EEEEEA', '#A3242A', '#1F3560', '#2E4A3C', '#E0A030'][(r() * 5) | 0]; K = VEH_truckGeo(col === '#EEEEEA' ? '#2F6FE0' : col); }
  else { col = kind === 'taxi' ? '#F0B400' : opts.color || VEH_COLS[(r() * VEH_COLS.length) | 0]; K = VEH_carGeo(kind); }
  const sc = opts.scale || 1, group = new THREE.Group(); group.name = 'vehicle-' + kind; group.scale.setScalar(sc);
  const mk = (geo, mat, cast = true, parent = group) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const paint = mk(K.paint, VEH_paintMat(col)), glass = mk(K.glass, VEH_glassMat(0, !!K.see), !K.see), trim = mk(K.trim, VEH_trimMat(0, 0));
  if (K.see) glass.renderOrder = 2;
  const wheels = new THREE.InstancedMesh(K.wheel, VEH_trimMat(0, 0), K.wheels.length); wheels.castShadow = true; wheels.receiveShadow = true; group.add(wheels);
  let hinge = null, leafA = null, leafB = null, sign = null;
  if (K.door) { hinge = new THREE.Group(); hinge.position.set(K.hinge[0], K.hinge[1], K.hinge[2]); group.add(hinge); mk(K.door, VEH_paintMat(col), true, hinge); }
  if (K.leafA) { leafA = mk(K.leafA, VEH_trimMat(0, 0)); leafB = mk(K.leafB, VEH_trimMat(0, 0)); leafA.position.z = leafB.position.z = K.leafZ; }
  if (K.sign) sign = mk(K.sign, VEH_signMat(route), false);
  const shadow = new THREE.Mesh(VEH_plane(), VEH_shadowMat()); shadow.scale.set(K.L * 1.08, 1, K.W * 1.22); shadow.position.y = 0.012; shadow.renderOrder = 1; group.add(shadow);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'ZYX'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let lv = 0, brake = 0;
  const api = {
    group, info: { kind, color: col, L: K.L, W: K.W, H: K.H, wr: K.wr, doorX: K.doorX, doorXs: K.doorXs, route },
    setWheels(dist) {
      const a = -(dist / sc) / K.wr;
      K.wheels.forEach(([x, y, z, f], i) => { e.set(0, f ? Math.PI : 0, a, 'ZYX'); q.setFromEuler(e); wheels.setMatrixAt(i, m4.compose(v.set(x, y, z), q, one)); });
      wheels.instanceMatrix.needsUpdate = true;
    },
    setDoor(o) {
      o = Math.max(0, Math.min(1, o || 0));
      if (hinge) hinge.rotation.y = o * 1.1;
      if (leafA) { const out = Math.min(1, o / 0.3) * 0.13, sl = Math.max(0, (o - 0.25) / 0.75) * 0.58; leafA.position.set(-sl, 0, K.leafZ - out); leafB.position.set(sl, 0, K.leafZ - out); }
    },
    setLights(n) { lv = Math.round(Math.max(0, Math.min(1, n || 0)) * 4); api._mat(); },
    setBrake(on) { brake = on ? 1 : 0; api._mat(); },
    _mat() { trim.material = VEH_trimMat(lv, brake); if (K.see) glass.material = VEH_glassMat(lv, true); if (leafA) leafA.material = leafB.material = VEH_trimMat(lv, 0); },
    dispose() { group.removeFromParent(); wheels.dispose(); },
  };
  api.setWheels(0); wheels.computeBoundingSphere();
  return api;
}
