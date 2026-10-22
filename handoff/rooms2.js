/* ======== rooms2: realistic wing rooms + underground (second graphics designer) ======== */
// Needs THREE and mergeGeometries in scope. Everything here is prefixed R2_. Deterministic: no Math.random.
//
// ctx (the integrator maps the layout to this, one ctx per wing room; the underground gets the same fields):
//   x0, x1      room interior extents in world x (layout.roomL or layout.roomR)
//   y           floor top of this floor (layout.floorY[i]); the room's clear height is floorH - slab
//   depth       ART.DEPTH (4.5); backZ = -depth is the back wall face, frontZ = 0 is the open cut face
//   floorH      ART.FLOOR_H (3.0);   slab: ART.SLAB (0.3)
//   backZ       -4.5   frontZ  0   laneZ  ART.LANE_Z (-0.8): z in [laneZ-0.45, frontZ] stays free of props
//   buildingX0, buildingX1   outer faces of the building's side walls (layout.x0 - wall, layout.x1 + wall)
//   coreX0, coreX1           lift core extents (optional, only used by the subway platform)
//   doorX       x of this wing's back-wall door (layout.roomDoorXs[0|1]) or null; a 1.3 wide corridor from the
//               door to the lane is kept clear. R2 draws no door: the integrator's door/frame goes there.
//   rng         seeded () => [0,1)            env  scene.environment texture or null (materials use scene env anyway)
//   nBasement   number of basement floors (underground only)   subwayY  floorY of the subway floor or null
//   treeXs      optional x positions of street trees (roots are drawn under them)
// R2 draws: floor finish, back-wall finish (+ skirting, windows), ceiling services, props. The integrator keeps
// the structural slab (with its cut edge), side walls, stair column, lift core, doors.
// Subway: the platform edge is the cut face z = 0; the track trench sits in FRONT of it (z 0..1.75, rails at
// y - 1.75) so the lane stays a platform; the train's roof is only 0.7 above the platform. The 'L' call builds
// the trench, the tunnel (full building width + 30 beyond each side) and the train; call trainArrive() on
// either wing's handle. The underground soil face is at z = 0; with a subway it leaves the tunnel band clear.

const R2_TEX = {}, R2_MAT = {}, R2_GEO = {};
function R2_hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function R2_prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ======== rooms2: canvas textures ======== */
function R2_canvas(key, w, h, draw, srgb = true) {
  if (R2_TEX[key]) return R2_TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h, R2_prng(R2_hash(key)));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (R2_TEX[key] = t);
}
function R2_noise(g, w, h, r, n, a, lo = 0, hi = 255, sz = 2) {
  for (let i = 0; i < n; i++) { const v = (lo + r() * (hi - lo)) | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(r() * w, r() * h, sz, sz); }
}
const R2_T = {
  paint: () => R2_canvas('paint', 256, 256, (g, w, h, r) => { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h); R2_noise(g, w, h, r, 9000, 0.05, 170, 255, 2); R2_noise(g, w, h, r, 300, 0.04, 150, 200, 8); }),
  wood: () => R2_canvas('wood', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#e9e1d6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 1) { const v = 200 + 40 * Math.sin(y * 0.21 + Math.sin(y * 0.05) * 3) + r() * 14; g.fillStyle = `rgba(${v | 0},${(v * 0.93) | 0},${(v * 0.85) | 0},0.55)`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 40; i++) { const y = r() * h; g.strokeStyle = 'rgba(90,60,40,0.18)'; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 6 - 3, w * 0.6, y + r() * 6 - 3, w, y); g.stroke(); }
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(90,55,30,0.25)'; g.beginPath(); g.ellipse(r() * w, r() * h, 6, 2.5, 0, 0, 7); g.fill(); }
  }),
  planks: () => R2_canvas('planks', 256, 256, (g, w, h, r) => {
    for (let row = 0; row < 8; row++) { const off = r() * w; const base = 185 + r() * 50;
      for (let x = -1; x < 3; x++) { const v = base + r() * 20 - 10; g.fillStyle = `rgb(${v | 0},${(v * 0.9) | 0},${(v * 0.8) | 0})`; g.fillRect(off + x * 128 - 128, row * 32, 128, 32);
        for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(80,50,30,0.12)'; g.fillRect(off + x * 128 - 128, row * 32 + r() * 32, 128, 1); } }
      g.fillStyle = 'rgba(40,25,15,0.55)'; g.fillRect(0, row * 32, w, 1.5);
      for (let x = -1; x < 3; x++) g.fillRect((off + x * 128) % w, row * 32, 1.5, 32);
    }
  }),
  carpet: () => R2_canvas('carpet', 256, 256, (g, w, h, r) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); R2_noise(g, w, h, r, 26000, 0.35, 120, 255, 1.5);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }),
  hotelcarpet: () => R2_canvas('hotelcarpet', 256, 256, (g, w, h, r) => { g.fillStyle = '#d0c8c0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,60,70,0.35)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(i * 64 + 32, j * 64 + 32, 22, 22, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(i * 64, j * 64 + 32); g.lineTo(i * 64 + 32, j * 64); g.stroke(); }
    R2_noise(g, w, h, r, 16000, 0.25, 100, 255, 1.5); }),
  concrete: () => R2_canvas('concrete', 256, 256, (g, w, h, r) => { g.fillStyle = '#d6d4d0'; g.fillRect(0, 0, w, h); R2_noise(g, w, h, r, 14000, 0.18, 120, 255, 2);
    for (let i = 0; i < 14; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30 + r() * 40); gr.addColorStop(0, 'rgba(90,85,75,0.16)'); gr.addColorStop(1, 'rgba(90,85,75,0)'); g.save(); g.translate(r() * w, r() * h); g.scale(1, 0.6 + r()); g.fillStyle = gr; g.fillRect(-80, -80, 160, 160); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 1.5);
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(50,50,50,0.25)'; g.beginPath(); g.arc(r() * w, r() * h, 1.5, 0, 7); g.fill(); } }),
  tile: () => R2_canvas('tile', 256, 256, (g, w, h, r) => { g.fillStyle = '#9a9690'; g.fillRect(0, 0, w, h);    // 8 x 16 brick-bond wall tiles
    for (let row = 0; row < 16; row++) for (let c = -1; c < 8; c++) { const x = c * 32 + (row % 2) * 16, v = 236 + r() * 14;
      const gr = g.createLinearGradient(0, row * 16, 0, row * 16 + 16); gr.addColorStop(0, `rgb(${v},${v},${v - 4})`); gr.addColorStop(1, `rgb(${v - 18},${v - 18},${v - 22})`);
      g.fillStyle = gr; g.fillRect(x + 1.5, row * 16 + 1.5, 29, 13); } }),
  floortile: () => R2_canvas('floortile', 256, 256, (g, w, h, r) => { g.fillStyle = '#8a8884'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 205 + r() * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61); }
    R2_noise(g, w, h, r, 9000, 0.35, 90, 255, 1.5); g.fillStyle = '#8a8884'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); } }),
  fabric: () => R2_canvas('fabric', 128, 128, (g, w, h, r) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y, w, 1); } for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x, 0, 1, h); }
    R2_noise(g, w, h, r, 2500, 0.15, 120, 255, 1); }),
  brushed: () => R2_canvas('brushed', 256, 64, (g, w, h, r) => { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = (150 + r() * 105) | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(r() * w, r() * h, 20 + r() * 80, 0.8); } }),
  tactile: () => R2_canvas('tactile', 64, 64, (g, w, h) => { g.fillStyle = '#e8c21e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const gr = g.createRadialGradient(i * 16 + 7, j * 16 + 7, 1, i * 16 + 8, j * 16 + 8, 6); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.6, '#f0cc2a'); gr.addColorStop(1, '#a88a10'); g.fillStyle = gr; g.beginPath(); g.arc(i * 16 + 8, j * 16 + 8, 5.5, 0, 7); g.fill(); } }),
  ballast: () => R2_canvas('ballast', 128, 128, (g, w, h, r) => { g.fillStyle = '#6d6a66'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = (70 + r() * 110) | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, 7); g.fill(); } }),
};

/* sign atlas: one 1024 canvas for every sign, screen, picture and painted number */
const R2_ATLAS = {
  roundel: [0, 0, 256, 256], station: [256, 0, 768, 128], board: [256, 128, 512, 128], exit: [768, 128, 256, 128],
  park: [0, 256, 128, 128], num: [128, 256, 64, 128] /* +k*64, k 0..7 */, hazard: [640, 256, 384, 64], redwhite: [640, 320, 384, 64],
  whiteboard: [0, 384, 384, 256], chart: [384, 384, 384, 256], art1: [768, 384, 256, 192], art2: [768, 576, 256, 192],
  menu: [0, 640, 256, 192], ad1: [256, 640, 192, 256], ad2: [448, 640, 192, 256], map: [640, 768, 384, 256],
  view: [0, 832, 256, 192], ticket: [256, 896, 128, 128], monitor: [384, 896, 128, 128], wayout: [512, 896, 128, 64],
  clock: [512, 960, 64, 64], art3: [576, 960, 64, 64], logo: [640, 704, 256, 64], hotelno: [896, 704, 128, 64],
};
function R2_atlasTex() {
  return R2_canvas('atlas', 1024, 1024, (g, W, H, r) => {
    const R = R2_ATLAS, font = (px, b = 'bold') => `${b} ${px}px Verdana, Tahoma, sans-serif`;
    const txt = (s, x, y, px, col, al = 'center') => { g.font = font(px); g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y); };
    g.fillStyle = '#777'; g.fillRect(0, 0, W, H);
    // metro roundel
    { const [x, y] = R.roundel; g.fillStyle = '#f2f2ee'; g.fillRect(x, y, 256, 256); g.strokeStyle = '#3A4150'; g.lineWidth = 34; g.beginPath(); g.arc(x + 128, y + 128, 92, 0, 7); g.stroke();
      g.fillStyle = '#1F4E9A'; g.fillRect(x + 10, y + 104, 236, 48); txt('METRO', x + 128, y + 129, 34, '#fff'); }
    { const [x, y, w, h] = R.station; g.fillStyle = '#2B3140'; g.fillRect(x, y, w, h); g.fillStyle = '#f2f2ee'; g.fillRect(x + 6, y + 6, w - 12, h - 12);
      g.fillStyle = '#3A4150'; g.fillRect(x + 6, y + h - 26, w - 12, 20); txt('CENTRAL TOWER', x + w / 2, y + 52, 64, '#2B3140'); }
    { const [x, y, w, h] = R.board; g.fillStyle = '#111317'; g.fillRect(x, y, w, h);
      const rows = [['1', 'Riverside', '2 min'], ['2', 'Airport', '6 min'], ['1', 'Old Town', '9 min']];
      rows.forEach((rw, i) => { const yy = y + 24 + i * 38; g.fillStyle = '#1F4E9A'; g.fillRect(x + 14, yy - 15, 30, 30); txt(rw[0], x + 29, yy, 22, '#fff');
        txt(rw[1], x + 60, yy, 26, '#FFB838', 'left'); txt(rw[2], x + w - 16, yy, 26, '#FFB838', 'right'); }); }
    { const [x, y, w, h] = R.exit; g.fillStyle = '#1E8E4E'; g.fillRect(x, y, w, h); g.fillStyle = '#fff';
      g.save(); g.translate(x + 60, y + 64); g.lineWidth = 9; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.beginPath(); g.arc(4, -34, 10, 0, 7); g.fill();
      g.beginPath(); g.moveTo(0, -20); g.lineTo(-6, 10); g.lineTo(-24, 34); g.moveTo(-6, 10); g.lineTo(14, 22); g.lineTo(18, 40); g.moveTo(-2, -14); g.lineTo(-22, -2); g.moveTo(-2, -14); g.lineTo(18, -4); g.stroke(); g.restore();
      txt('EXIT', x + 166, y + 66, 48, '#fff'); }
    { const [x, y] = R.park; g.fillStyle = '#2459B8'; g.fillRect(x, y, 128, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(x + 8, y + 8, 112, 112); txt('P', x + 64, y + 68, 92, '#fff'); }
    for (let k = 0; k < 8; k++) { const x = R.num[0] + k * 64, y = R.num[1]; g.fillStyle = '#3a3a3a'; g.fillRect(x, y, 64, 128); txt(String(k + 1), x + 32, y + 66, 84, '#F2C230'); }
    { const [x, y, w, h] = R.hazard; g.fillStyle = '#F2C230'; g.fillRect(x, y, w, h); g.fillStyle = '#1d1d1d'; for (let i = -2; i < 14; i++) { g.beginPath(); g.moveTo(x + i * 32, y + h); g.lineTo(x + i * 32 + 16, y + h); g.lineTo(x + i * 32 + 16 + h, y); g.lineTo(x + i * 32 + h, y); g.fill(); } }
    { const [x, y, w, h] = R.redwhite; g.fillStyle = '#f5f5f5'; g.fillRect(x, y, w, h); g.fillStyle = '#D23A2E'; for (let i = 0; i < 6; i++) g.fillRect(x + i * 64, y, 32, h); }
    { const [x, y, w, h] = R.whiteboard; g.fillStyle = '#f8f8f6'; g.fillRect(x, y, w, h); g.lineWidth = 4; g.lineCap = 'round';
      g.strokeStyle = '#2F6FE0'; g.beginPath(); g.moveTo(x + 30, y + 200); g.lineTo(x + 90, y + 150); g.lineTo(x + 150, y + 170); g.lineTo(x + 230, y + 80); g.stroke();
      g.strokeStyle = '#D23A2E'; g.strokeRect(x + 250, y + 40, 100, 60); g.strokeRect(x + 250, y + 140, 100, 60); g.beginPath(); g.moveTo(x + 300, y + 100); g.lineTo(x + 300, y + 140); g.stroke();
      g.strokeStyle = '#333'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 30, y + 40 + i * 22); g.lineTo(x + 120 + r() * 80, y + 40 + i * 22); g.stroke(); }
      for (const [c, xx, yy] of [['#F2C230', 300, 225], ['#7BC67E', 40, 226], ['#F29BB0', 80, 226]]) { g.fillStyle = c; g.fillRect(x + xx, y + yy - 20, 34, 30); } }
    { const [x, y, w, h] = R.chart; g.fillStyle = '#10151c'; g.fillRect(x, y, w, h); g.fillStyle = '#1c2633'; g.fillRect(x + 16, y + 16, w - 32, h - 32);
      [0.4, 0.65, 0.5, 0.85, 0.7].forEach((v, i) => { g.fillStyle = i === 3 ? '#2F6FE0' : '#6a8ab0'; g.fillRect(x + 50 + i * 60, y + h - 40 - v * 150, 40, v * 150); });
      txt('Q3', x + 50, y + 40, 22, '#cfe0f5', 'left'); g.strokeStyle = '#F2C230'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 60, y + 150); g.lineTo(x + 180, y + 110); g.lineTo(x + 340, y + 60); g.stroke(); }
    const painting = (key, sky, hill, extra) => { const [x, y, w, h] = R[key]; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = hill; g.beginPath(); g.moveTo(x, y + h * 0.7); g.bezierCurveTo(x + w * 0.3, y + h * 0.45, x + w * 0.6, y + h * 0.85, x + w, y + h * 0.6); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.fill(); extra(x, y, w, h); };
    painting('art1', ['#9cc4dc', '#f1e0c4'], '#6d8a5a', (x, y, w, h) => { g.fillStyle = '#f4d27a'; g.beginPath(); g.arc(x + w * 0.75, y + h * 0.3, 18, 0, 7); g.fill(); g.fillStyle = '#4f6a44'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.4, y + h * 0.75); g.lineTo(x + w, y + h); g.fill(); });
    painting('art2', ['#e9dfcf', '#e9dfcf'], 'rgba(0,0,0,0)', (x, y, w, h) => { for (const [c, cx, cy, rr] of [['#c2674a', 0.35, 0.5, 46], ['#3f5f7a', 0.62, 0.42, 36], ['#d7b25a', 0.55, 0.68, 26]]) { g.fillStyle = c; g.beginPath(); g.arc(x + w * cx, y + h * cy, rr, 0, 7); g.fill(); } });
    painting('art3', ['#c8d8e0', '#e8e0d0'], '#8a6a4a', () => {});
    { const [x, y, w, h] = R.menu; g.fillStyle = '#2a2c2a'; g.fillRect(x, y, w, h); R2_noise(g, w, h, r, 0, 0); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 300; i++) g.fillRect(x + r() * w, y + r() * h, 3, 1);
      txt('MENU', x + w / 2, y + 30, 30, '#f2eee4'); g.fillStyle = 'rgba(242,238,228,0.75)'; for (let i = 0; i < 6; i++) { g.fillRect(x + 24, y + 62 + i * 20, 120 + r() * 50, 4); g.fillRect(x + 210, y + 62 + i * 20, 22, 4); }
      g.fillStyle = '#FF8A1F'; g.fillRect(x + 24, y + 176, w - 48, 4); }
    { const [x, y, w, h] = R.ad1; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2f9ad0'); gr.addColorStop(1, '#f6d36a'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 96, y + 110, 40, 0, 7); g.fill(); g.fillStyle = '#e8843a'; g.fillRect(x, y + 190, w, 66); txt('SUMMER', x + w / 2, y + 222, 30, '#fff'); }
    { const [x, y, w, h] = R.ad2; g.fillStyle = '#efe6d8'; g.fillRect(x, y, w, h); g.fillStyle = '#7a3b2e'; g.beginPath(); g.ellipse(x + 96, y + 120, 50, 70, 0, 0, 7); g.fill();
      g.fillStyle = '#f3e3c3'; g.beginPath(); g.ellipse(x + 96, y + 110, 30, 18, 0, 0, 7); g.fill(); txt('COFFEE', x + w / 2, y + 222, 28, '#3a2a22'); }
    { const [x, y, w, h] = R.map; g.fillStyle = '#f6f4ee'; g.fillRect(x, y, w, h); g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
      const lines = [['#D23A2E', [[20, 60], [140, 60], [220, 140], [360, 140]]], ['#2459B8', [[40, 220], [140, 150], [220, 140], [300, 40]]], ['#3BA55C', [[20, 130], [120, 130], [200, 210], [360, 210]]]];
      for (const [c, pts] of lines) { g.strokeStyle = c; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py))); g.stroke();
        for (const [px, py] of pts) { g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(x + px, y + py, 7, 0, 7); g.fill(); g.stroke(); } g.lineWidth = 9; } }
    { const [x, y, w, h] = R.view; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#8fc0e4'); gr.addColorStop(1, '#e7eef2'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let i = 0; i < 9; i++) { const bw = 20 + r() * 30, bh = 40 + r() * 110, bx = x + i * 30 - 10; g.fillStyle = `rgba(${120 + r() * 40 | 0},${135 + r() * 40 | 0},${155 + r() * 30 | 0},0.85)`; g.fillRect(bx, y + h - bh, bw, bh);
        g.fillStyle = 'rgba(230,240,250,0.5)'; for (let yy = y + h - bh + 6; yy < y + h - 6; yy += 10) for (let xx = bx + 3; xx < bx + bw - 4; xx += 7) g.fillRect(xx, yy, 3, 5); } }
    { const [x, y] = R.ticket; g.fillStyle = '#0d2a4a'; g.fillRect(x, y, 128, 128); g.fillStyle = '#2f7fd0'; g.fillRect(x + 10, y + 10, 108, 30); txt('TICKETS', x + 64, y + 26, 16, '#fff');
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = '#e8eef5'; g.fillRect(x + 14 + i * 54, y + 52 + j * 36, 46, 28); } }
    { const [x, y] = R.monitor; g.fillStyle = '#1b2330'; g.fillRect(x, y, 128, 128); g.fillStyle = '#e9eef4'; g.fillRect(x + 6, y + 6, 116, 82); g.fillStyle = '#2F6FE0'; g.fillRect(x + 6, y + 6, 116, 12);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c8d4e2' : '#9fb4cc'; g.fillRect(x + 12, y + 26 + i * 10, 40 + r() * 60, 5); } g.fillStyle = '#2b3646'; g.fillRect(x, y + 94, 128, 34);
      g.fillStyle = '#7fd08a'; for (let i = 0; i < 3; i++) g.fillRect(x + 10 + i * 38, y + 102, 30, 18); }
    { const [x, y, w, h] = R.wayout; g.fillStyle = '#F2C230'; g.fillRect(x, y, w, h); txt('WAY OUT', x + w / 2, y + h / 2 + 2, 20, '#1d1d1d'); }
    { const [x, y] = R.clock; g.fillStyle = '#fbfbf8'; g.fillRect(x, y, 64, 64); g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(x + 32, y + 32, 28, 0, 7); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(x + 32, y + 32); g.lineTo(x + 32, y + 12); g.moveTo(x + 32, y + 32); g.lineTo(x + 46, y + 38); g.stroke(); }
    { const [x, y, w, h] = R.logo; g.fillStyle = '#2F6FE0'; g.fillRect(x, y, w, h); txt('BLUEDESK', x + w / 2, y + h / 2 + 2, 34, '#fff'); }
    { const [x, y, w, h] = R.hotelno; g.fillStyle = '#3a2f2a'; g.fillRect(x, y, w, h); txt('214  216', x + w / 2, y + h / 2 + 2, 22, '#e8d6a8'); }
  });
}

/* ======== rooms2: materials ======== */
// each material: uv mode 'world' (box-projected world uv, `tile` metres per texture repeat), 'atlas' or 'local'
function R2_m(key) {
  if (R2_MAT[key]) return R2_MAT[key];
  const S = (o, uv = 'world', tile = 1, cast = true) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); m.userData = { uv, tile, cast }; return m; };
  const T = R2_T, f = {
    paint: () => S({ map: T.paint(), bumpMap: T.paint(), bumpScale: 0.6, roughness: 0.88, envMapIntensity: 0.55 }, 'world', 2.5, false),
    wood: () => S({ map: T.wood(), bumpMap: T.wood(), bumpScale: 0.4, roughness: 0.55, envMapIntensity: 0.6 }, 'world', 1.2, true),
    planks: () => S({ map: T.planks(), bumpMap: T.planks(), bumpScale: 0.8, roughness: 0.5, envMapIntensity: 0.6 }, 'world', 2.4, false),
    carpet: () => S({ map: T.carpet(), bumpMap: T.carpet(), bumpScale: 1, roughness: 1, envMapIntensity: 0.3 }, 'world', 2.0, false),
    hcarpet: () => S({ map: T.hotelcarpet(), roughness: 1, envMapIntensity: 0.3 }, 'world', 1.6, false),
    concrete: () => S({ map: T.concrete(), bumpMap: T.concrete(), bumpScale: 1, roughness: 0.92, envMapIntensity: 0.45 }, 'world', 3.0, false),
    tile: () => S({ map: T.tile(), bumpMap: T.tile(), bumpScale: 1.2, roughness: 0.25, envMapIntensity: 0.8 }, 'world', 1.2, false),
    floortile: () => S({ map: T.floortile(), bumpMap: T.floortile(), bumpScale: 0.8, roughness: 0.45, envMapIntensity: 0.6 }, 'world', 2.4, false),
    tactile: () => S({ map: T.tactile(), bumpMap: T.tactile(), bumpScale: 2, roughness: 0.6 }, 'world', 0.3, false),
    ballast: () => S({ map: T.ballast(), bumpMap: T.ballast(), bumpScale: 3, roughness: 1 }, 'world', 0.8, false),
    fabric: () => S({ map: T.fabric(), bumpMap: T.fabric(), bumpScale: 0.5, roughness: 0.95, envMapIntensity: 0.4 }, 'world', 0.5, true),
    metal: () => S({ map: T.brushed(), roughness: 0.36, metalness: 0.65, envMapIntensity: 1.0 }, 'world', 0.8, true),
    metalNC: () => S({ map: T.brushed(), roughness: 0.4, metalness: 0.6, envMapIntensity: 1.0 }, 'world', 0.8, false),
    plastic: () => S({ roughness: 0.55, envMapIntensity: 0.7 }, 'local', 1, true),
    plasticNC: () => S({ roughness: 0.6, envMapIntensity: 0.7 }, 'local', 1, false),
    carpaint: () => S({ roughness: 0.28, metalness: 0.45, envMapIntensity: 1.1 }, 'local', 1, true),
    glass: () => { const m = S({ roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.2 }, 'local', 1, false); return m; },
    glow: () => { const m = new THREE.MeshBasicMaterial({ vertexColors: true }); m.userData = { uv: 'local', tile: 1, cast: false }; return m; },
    sign: () => { const t = R2_atlasTex(); return S({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.45, envMapIntensity: 0.5 }, 'atlas', 1, false); },
  };
  return (R2_MAT[key] = f[key]());
}

/* ======== rooms2: geometry + batching ======== */
const R2_box = (w, h, d) => R2_GEO['b' + w + ',' + h + ',' + d] || (R2_GEO['b' + w + ',' + h + ',' + d] = new THREE.BoxGeometry(w, h, d));
const R2_cyl = (rt, rb, h, s = 10) => R2_GEO['c' + [rt, rb, h, s]] || (R2_GEO['c' + [rt, rb, h, s]] = new THREE.CylinderGeometry(rt, rb, h, s));
const R2_cylX = (r, l, s = 10) => R2_GEO['cx' + [r, l, s]] || (R2_GEO['cx' + [r, l, s]] = new THREE.CylinderGeometry(r, r, l, s).rotateZ(Math.PI / 2));
const R2_cylZ = (r, l, s = 10) => R2_GEO['cz' + [r, l, s]] || (R2_GEO['cz' + [r, l, s]] = new THREE.CylinderGeometry(r, r, l, s).rotateX(Math.PI / 2));
const R2_sph = (r, ws = 10, hs = 8) => R2_GEO['s' + [r, ws, hs]] || (R2_GEO['s' + [r, ws, hs]] = new THREE.SphereGeometry(r, ws, hs));
const R2_pln = (w, h) => R2_GEO['p' + w + ',' + h] || (R2_GEO['p' + w + ',' + h] = new THREE.PlaneGeometry(w, h));
const R2_plnUp = (w, d) => R2_GEO['pu' + w + ',' + d] || (R2_GEO['pu' + w + ',' + d] = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2));
function R2_xf(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
class R2_Batch {
  constructor() { this.parts = new Map(); this.tris = 0; }
  add(geo, matKey, hex, m4, o = {}) {
    const mat = R2_m(matKey), ud = mat.userData, cast = o.cast ?? ud.cast, key = matKey + (cast ? '+' : '-');
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
    g.applyMatrix4(m4);
    const P = g.attributes.position, N = g.attributes.normal, n = P.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const UV = g.attributes.uv;
    if (ud.uv === 'world') {
      const s = 1 / ud.tile;
      for (let i = 0; i < n; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        if (ay >= ax && ay >= az) UV.setXY(i, x * s, z * s); else if (ax >= az) UV.setXY(i, z * s, y * s); else UV.setXY(i, x * s, y * s);
        if (o.rot90) UV.setXY(i, UV.getY(i), UV.getX(i)); }
    } else if (ud.uv === 'atlas' && o.rect) {
      const [rx, ry, rw, rh] = o.rect;
      for (let i = 0; i < n; i++) UV.setXY(i, (rx + UV.getX(i) * rw) / 1024, 1 - (ry + (1 - UV.getY(i)) * rh) / 1024);
    }
    const c = new THREE.Color(hex), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.parts.has(key)) this.parts.set(key, { mat, cast, list: [] });
    this.parts.get(key).list.push(g); this.tris += n / 3;
  }
  flush(group) {
    const out = [];
    for (const { mat, cast, list } of this.parts.values()) {
      const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = cast; m.receiveShadow = mat.userData.uv !== 'local' || !mat.transparent;
      if (mat.transparent) m.renderOrder = 2; group.add(m); out.push(m); list.forEach((g) => g.dispose());
    }
    this.parts.clear(); return out;
  }
}
// a placer bound to a room: P(geo, mat, hex, u, yy, z, ry, opts) with u = x offset from ctx.x0, yy from the floor
function R2_placer(B, ctx) {
  const P = (geo, mat, hex, u, yy, z, ry = 0, o = {}) => B.add(geo, mat, hex, R2_xf(ctx.x0 + u, ctx.y + yy, z, ry, o.rx || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1), o);
  // rotated group placement: L(ox, oz, ry) returns a placer in a local frame rotated about y at (ox, oz)
  P.local = (ou, oy, oz, ry, sc = 1) => (geo, mat, hex, lx, ly, lz, lry = 0, o = {}) => {
    lx *= sc; ly *= sc; lz *= sc;
    const c = Math.cos(ry), s = Math.sin(ry), wx = ou + lx * c + lz * s, wz = oz - lx * s + lz * c;
    if (sc !== 1) o = Object.assign({}, o, { sx: (o.sx || 1) * sc, sy: (o.sy || 1) * sc, sz: (o.sz || 1) * sc });
    P(geo, mat, hex, wx, oy + ly, wz, ry + lry, o);
  };
  return P;
}
function R2_doorClear(ctx) { return ctx.doorX == null ? null : [ctx.doorX - ctx.x0 - 0.65, ctx.doorX - ctx.x0 + 0.65]; }
// shift [u, u+w] out of the door corridor if needed (returns the new u, or null when nothing fits)
function R2_fit(ctx, u, w, W) {
  const d = R2_doorClear(ctx); if (!d || u + w <= d[0] || u >= d[1]) return u;
  const left = d[0] - w, right = d[1];
  const cand = [left, right].filter((v) => v >= 0.05 && v + w <= W - 0.05).sort((a, b) => Math.abs(a - u) - Math.abs(b - u));
  return cand.length ? cand[0] : null;
}

/* ======== rooms2: shared room parts ======== */
function R2_shell(P, ctx, o) {
  const W = ctx.x1 - ctx.x0, CH = ctx.floorH - (ctx.slab ?? 0.3), D = -ctx.backZ, bz = ctx.backZ;
  P(R2_plnUp(W, D), o.floor, o.floorCol, W / 2, 0.004, bz / 2, 0, { rot90: o.floorRot });
  P(R2_pln(W, CH), o.wall, o.wallCol, W / 2, CH / 2, bz + 0.005);
  if (o.dado) { P(R2_box(W, o.dado, 0.02), o.dadoMat || 'wood', o.dadoCol, W / 2, o.dado / 2, bz + 0.015); P(R2_box(W, 0.04, 0.04), o.dadoMat || 'wood', o.dadoCol, W / 2, o.dado, bz + 0.03); }
  if (o.stripe) P(R2_box(W, 0.12, 0.012), 'plasticNC', o.stripe, W / 2, o.stripeY ?? 1.25, bz + 0.012);
  P(R2_box(W, 0.1, 0.02), o.skirtMat || 'plasticNC', o.skirt || '#6E5F52', W / 2, 0.05, bz + 0.015);
  P(R2_box(W, 0.06, 0.05), 'plasticNC', o.cornice || '#E9E5DC', W / 2, CH - 0.03, bz + 0.025);
  return { W, CH };
}
function R2_ceilingServices(P, ctx, W, CH, o = {}) {
  // duct run, sprinkler heads, smoke detector, light fixtures (emissive) with a cable tray
  const dz = o.ductZ ?? -3.7;
  if (o.duct !== false) { P(R2_box(W - 0.2, 0.28, 0.5), 'metalNC', '#C9CCD0', W / 2, CH - 0.2, dz); for (let u = 0.6; u < W - 0.3; u += 1.2) P(R2_box(0.03, 0.3, 0.52), 'metalNC', '#A9ADB2', u, CH - 0.2, dz); }
  for (let u = 0.9; u < W - 0.4; u += 2.1) { P(R2_cyl(0.012, 0.012, 0.12, 6), 'metalNC', '#B8B8B8', u, CH - 0.06, -2.2); P(R2_cyl(0.04, 0.01, 0.03, 8), 'metalNC', '#C8A24A', u, CH - 0.13, -2.2); }
  P(R2_cyl(0.07, 0.07, 0.04, 12), 'plasticNC', '#F2F2EE', W * 0.5 + 0.3, CH - 0.02, -1.7);
  for (const u of o.lights || []) {
    if (o.lightType === 'tube') { P(R2_box(1.3, 0.05, 0.14), 'metalNC', '#D8DADC', u, CH - 0.03, -2.4); P(R2_box(1.2, 0.04, 0.06), 'glow', '#FFF8EC', u, CH - 0.07, -2.4); }
    else if (o.lightType === 'panel') { P(R2_box(0.6, 0.03, 0.6), 'metalNC', '#E8E8E8', u, CH - 0.015, -2.6); P(R2_box(0.56, 0.01, 0.56), 'glow', '#FFF6E6', u, CH - 0.035, -2.6); }
    else { P(R2_cyl(0.09, 0.09, 0.02, 12), 'glow', '#FFF1D6', u, CH - 0.012, -2.5); P(R2_cyl(0.11, 0.11, 0.015, 12), 'metalNC', '#E0E0E0', u, CH - 0.006, -2.5); }
  }
}
function R2_window(P, ctx, u, w, h, y0, o = {}) {           // window in the back wall: frame, mullion, view, sill, radiator
  const z = ctx.backZ;
  P(R2_pln(w - 0.08, h - 0.08), 'sign', '#ffffff', u, y0 + h / 2, z + 0.012, 0, { rect: R2_ATLAS.view });
  P(R2_pln(w - 0.08, h - 0.08), 'glass', '#CFE3EE', u, y0 + h / 2, z + 0.03);
  for (const [dx, dy, ww, hh] of [[0, h / 2 - 0.025, w, 0.05], [0, -h / 2 + 0.025, w, 0.05], [-w / 2 + 0.025, 0, 0.05, h], [w / 2 - 0.025, 0, 0.05, h], [0, 0.12, w, 0.035], [0, 0, 0.035, h]])
    P(R2_box(ww, hh, 0.06), 'plasticNC', o.frame || '#3B4148', u + dx, y0 + h / 2 + dy, z + 0.035);
  P(R2_box(w + 0.12, 0.04, 0.16), 'plasticNC', o.sill || '#D8D0C2', u, y0 - 0.02, z + 0.08);
  if (o.blinds) for (let k = 0; k < 9; k++) P(R2_box(w - 0.1, 0.012, 0.03), 'plasticNC', '#ECEBE6', u, y0 + h - 0.06 - k * 0.07, z + 0.07);
  if (o.curtains) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) P(R2_cyl(0.05, 0.06, h + 0.25, 8), 'fabric', o.curtains, u + s * (w / 2 + 0.05 + k * 0.08), y0 + h / 2 - 0.05, z + 0.12);
  if (o.curtains) P(R2_cylX(0.015, w + 0.9), 'metalNC', '#8A7A5A', u, y0 + h + 0.12, z + 0.12);
  if (o.radiator !== false) { for (let k = 0; k < Math.floor(w * 10); k++) P(R2_box(0.06, 0.5, 0.08), 'plasticNC', '#ECEBE6', u - w / 2 + 0.1 + k * 0.1, 0.42, z + 0.09); P(R2_cylX(0.015, w), 'metalNC', '#C0C0C0', u, 0.14, z + 0.1); }
}
function R2_socket(P, ctx, u, y = 0.3) { P(R2_box(0.08, 0.08, 0.015), 'plasticNC', '#F4F2EC', u, y, ctx.backZ + 0.012); P(R2_box(0.02, 0.03, 0.005), 'plasticNC', '#555', u, y, ctx.backZ + 0.02); }
function R2_frame(P, ctx, u, y, w, h, rect, col = '#3A2F28') {
  P(R2_box(w + 0.08, h + 0.08, 0.03), 'wood', col, u, y, ctx.backZ + 0.02, 0);
  P(R2_pln(w, h), 'sign', '#ffffff', u, y, ctx.backZ + 0.037, 0, { rect });
}
function R2_plant(P, u, yy, z, s = 1, potCol = '#B5673F', kind = 0) {
  P(R2_cyl(0.18 * s, 0.14 * s, 0.34 * s, 10), 'plastic', potCol, u, yy + 0.17 * s, z);
  P(R2_cyl(0.165 * s, 0.165 * s, 0.02, 10), 'plastic', '#4A3524', u, yy + 0.33 * s, z);
  if (kind === 0) { for (let k = 0; k < 7; k++) { const a = k * 2.4, rr = 0.12 * s * (k % 3); P(R2_sph(0.17 * s, 8, 6), 'plastic', k % 2 ? '#4F7A3A' : '#5E8C45', u + Math.cos(a) * rr, yy + (0.65 + 0.12 * k) * s, z + Math.sin(a) * rr, a, { sy: 0.8 }); }
    P(R2_cyl(0.02 * s, 0.025 * s, 0.6 * s, 6), 'wood', '#6B4A33', u, yy + 0.6 * s, z); }
  else for (let k = 0; k < 9; k++) { const a = k * 0.7; P(R2_box(0.05 * s, 0.7 * s, 0.015), 'plastic', k % 2 ? '#3F6A35' : '#5B8A3E', u + Math.cos(a) * 0.05, yy + 0.65 * s, z + Math.sin(a) * 0.05, a, { rz: Math.sin(k * 1.7) * 0.25, rx: Math.cos(k * 1.3) * 0.2 }); }
}
function R2_chair(L, col, back = true, wood = false) {           // L = local placer facing +z (seat front +z)
  const m = wood ? 'wood' : 'fabric';
  L(R2_box(0.46, 0.07, 0.44), m, col, 0, 0.46, 0); if (back) L(R2_box(0.44, 0.42, 0.06), m, col, 0, 0.78, -0.2, 0, { rx: -0.08 });
  if (wood) for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) L(R2_box(0.035, 0.45, 0.035), 'wood', col, x, 0.225, z);
  else { L(R2_cyl(0.025, 0.025, 0.36, 6), 'metal', '#2E3134', 0, 0.26, 0); for (let k = 0; k < 5; k++) { const a = k * 1.2566; L(R2_box(0.3, 0.03, 0.04), 'metal', '#2E3134', Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14, -a); L(R2_sph(0.03, 6, 4), 'plastic', '#222', Math.cos(a) * 0.27, 0.03, Math.sin(a) * 0.27); }
    if (back) L(R2_box(0.04, 0.3, 0.04), 'metal', '#2E3134', 0, 0.58, -0.2); }
}
function R2_suitcase(P, u, z, col, ry = 0, s = 1) {
  const L = P.local(u, 0, z, ry);
  L(R2_box(0.42 * s, 0.6 * s, 0.24 * s), 'plastic', col, 0, 0.36 * s, 0); for (const x of [-0.1, 0.1]) L(R2_box(0.02, 0.58 * s, 0.25 * s), 'plastic', '#3a3a3a', x * s, 0.36 * s, 0);
  L(R2_box(0.025, 0.22, 0.025), 'metal', '#888', -0.12 * s, 0.77 * s, 0); L(R2_box(0.025, 0.22, 0.025), 'metal', '#888', 0.12 * s, 0.77 * s, 0); L(R2_box(0.27 * s, 0.03, 0.035), 'plastic', '#222', 0, 0.88 * s, 0);
  for (const x of [-0.16, 0.16]) L(R2_cylX(0.035, 0.03, 8), 'plastic', '#222', x * s, 0.04, 0.09);
}

/* ======== rooms2: office ======== */
function R2_office(P, ctx, wing) {
  const { W, CH } = R2_shell(P, ctx, { floor: 'carpet', floorCol: '#7E858E', wall: 'paint', wallCol: '#E8E4DC', skirt: '#5C5F63', skirtMat: 'plasticNC', cornice: '#F1EEE8' });
  const bz = ctx.backZ, r = ctx.rng;
  R2_ceilingServices(P, ctx, W, CH, { lights: [W * 0.25, W * 0.5, W * 0.75], lightType: 'panel', duct: false });
  P(R2_box(W, 0.02, 4.5), 'paint', '#F3F1EC', W / 2, CH - 0.15, -2.25, 0, { cast: false }); // suspended ceiling with grid
  for (let u = 0.6; u < W; u += 0.6) P(R2_box(0.02, 0.025, 4.5), 'metalNC', '#D8D8D8', u, CH - 0.16, -2.25);
  const desk = (u, z, nMon) => {
    const L = P.local(u, 0, z, 0);
    L(R2_box(1.5, 0.03, 0.75), 'wood', '#D9C3A0', 0, 0.74, 0); L(R2_box(1.44, 0.4, 0.02), 'plastic', '#5E6368', 0, 0.48, -0.33);
    for (const x of [-0.7, 0.7]) { L(R2_box(0.05, 0.72, 0.05), 'metal', '#C9CCD0', x, 0.36, -0.3); L(R2_box(0.05, 0.72, 0.05), 'metal', '#C9CCD0', x, 0.36, 0.3); L(R2_box(0.05, 0.04, 0.65), 'metal', '#C9CCD0', x, 0.04, 0); }
    L(R2_box(1.5, 0.36, 0.035), 'fabric', ['#7C8B7A', '#8A8F98', '#9A8E7C'][(r() * 3) | 0], 0, 0.93, -0.38);           // screen divider
    for (let k = 0; k < nMon; k++) { const x = (k - (nMon - 1) / 2) * 0.58;
      L(R2_box(0.52, 0.32, 0.025), 'plastic', '#1B1E22', x, 1.08, -0.18, k ? -0.15 : 0.15 * (nMon - 1)); L(R2_pln(0.49, 0.29), 'sign', '#ffffff', x, 1.08, -0.166, k ? -0.15 : 0.15 * (nMon - 1), { rect: R2_ATLAS.monitor });
      L(R2_box(0.04, 0.2, 0.04), 'metal', '#9A9EA3', x, 0.86, -0.21); L(R2_box(0.2, 0.012, 0.16), 'metal', '#9A9EA3', x, 0.76, -0.2); }
    L(R2_box(0.42, 0.018, 0.14), 'plastic', '#2A2D31', -0.05, 0.765, 0.12); L(R2_box(0.06, 0.02, 0.09), 'plastic', '#2A2D31', 0.3, 0.765, 0.14);
    L(R2_cyl(0.04, 0.035, 0.09, 10), 'plastic', ['#F4F2EC', '#C84A3A', '#3A6EA8'][(r() * 3) | 0], 0.58, 0.8, 0.05);
    L(R2_box(0.22, 0.04, 0.3), 'plastic', '#F6F6F2', -0.55, 0.775, 0.0, 0.2);
    L(R2_box(0.4, 0.6, 0.55), 'plastic', '#8A8F96', 0.45, 0.31, -0.02);    // drawer pedestal
    for (let k = 0; k < 3; k++) L(R2_box(0.36, 0.01, 0.01), 'metal', '#C9CCD0', 0.45, 0.2 + k * 0.18, 0.26);
    const C = P.local(u + (r() - 0.5) * 0.2, 0, z + 0.62, Math.PI + (r() - 0.5) * 0.5); R2_chair(C, '#3B3F45');
  };
  if (wing === 'L') {
    const n = W > 6.2 ? 3 : 2, step = (W - 0.4) / n;
    for (let k = 0; k < n; k++) { const u = R2_fit(ctx, 0.2 + step * k + (step - 1.5) / 2, 1.5, W); if (u != null) desk(u + 0.75, -3.65, k === 1 ? 2 : 1); }
    // whiteboard + logo above it, printer, water cooler, plant, filing cabinet, clock
    const wbU = R2_fit(ctx, W * 0.5 - 0.7, 1.4, W);
    P(R2_box(1.6, 0.012, 0.02), 'plasticNC', '#2F6FE0', W / 2, CH - 0.34, bz + 0.012);
    P(R2_box(W, 0.012, 0.012), 'plasticNC', '#2F6FE0', W / 2, 0.11, bz + 0.03);
    if (wbU != null) { P(R2_box(1.44, 0.94, 0.03), 'metalNC', '#C9CCD0', wbU + 0.7, 1.75, bz + 0.02); P(R2_pln(1.38, 0.88), 'sign', '#ffffff', wbU + 0.7, 1.75, bz + 0.037, 0, { rect: R2_ATLAS.whiteboard }); P(R2_box(1.2, 0.03, 0.07), 'metalNC', '#B9BDC2', wbU + 0.7, 1.27, bz + 0.05);
      for (const [c, dx] of [['#2F6FE0', 0], ['#D23A2E', 0.12], ['#222', 0.24]]) P(R2_cylX(0.01, 0.12, 6), 'plastic', c, wbU + 0.4 + dx, 1.3, bz + 0.06); }
    P(R2_pln(1.2, 0.3), 'sign', '#ffffff', W / 2, 2.38, bz + 0.012, 0, { rect: R2_ATLAS.logo });
    const prU = R2_fit(ctx, W - 0.9, 0.7, W);
    if (prU != null) { const L = P.local(prU + 0.35, 0, -2.0, -Math.PI / 2);
      L(R2_box(0.7, 0.55, 0.5), 'plastic', '#5B6068', 0, 0.275, 0); L(R2_box(0.6, 0.36, 0.48), 'plastic', '#E9E9E6', 0, 0.73, 0); L(R2_box(0.6, 0.06, 0.4), 'plastic', '#3A3D42', 0, 0.94, -0.03);
      L(R2_box(0.3, 0.02, 0.22), 'plastic', '#F8F8F6', 0, 0.83, 0.25); L(R2_box(0.12, 0.06, 0.02), 'glow', '#7FD0FF', 0.2, 0.93, 0.24); }
    const wcU = R2_fit(ctx, 0.15, 0.4, W);
    if (wcU != null) { const u = wcU + 0.2; P(R2_box(0.34, 0.95, 0.34), 'plastic', '#EDEDEA', u, 0.475, bz + 0.25); P(R2_cyl(0.15, 0.15, 0.42, 12), 'glass', '#6FB2E8', u, 1.17, bz + 0.25);
      P(R2_cyl(0.15, 0.15, 0.4, 12), 'plastic', '#9CCBEF', u, 1.16, bz + 0.25, 0, { sx: 0.92, sz: 0.92 }); P(R2_box(0.04, 0.05, 0.04), 'plastic', '#3A6EA8', u - 0.06, 0.72, bz + 0.43); P(R2_box(0.04, 0.05, 0.04), 'plastic', '#C84A3A', u + 0.06, 0.72, bz + 0.43); }
    R2_plant(P, W - 0.35, 0, -1.55, 1.25, '#D8D4CC', 1);
    R2_plant(P, 0.45, 0, -1.6, 1.1, '#3F4348', 0);
    P(R2_pln(0.28, 0.28), 'sign', '#ffffff', W * 0.2, 2.25, bz + 0.012, 0, { rect: R2_ATLAS.clock });
    R2_socket(P, ctx, 0.9); R2_socket(P, ctx, W - 1.4); P(R2_box(0.08, 0.12, 0.015), 'plasticNC', '#F4F2EC', 0.25, 1.15, bz + 0.012);
  } else {
    // glass meeting room on the larger side of the door; a lounge corner with sofa on the other
    const d = R2_doorClear(ctx); let a = 0.15, b = W - 0.15;
    if (d) { if (d[0] - 0.15 > W - 0.15 - d[1]) b = d[0] - 0.05; else a = d[1] + 0.05; }
    const mw = Math.min(b - a, 4.6), m0 = a + (b === W - 0.15 ? 0 : (b - a - mw)), fz = -1.55, cu = m0 + mw / 2;
    // glass walls (front + two sides), aluminium frames, frosted band, door
    P(R2_box(mw, CH - 0.02, 0.02), 'glass', '#DCEAF0', cu, CH / 2, fz);
    P(R2_box(mw, 0.12, 0.025), 'plasticNC', '#E6EBEE', cu, 1.3, fz);
    for (const x of [m0, m0 + mw]) { P(R2_box(0.02, CH - 0.02, -fz + bz), 'glass', '#DCEAF0', x, CH / 2, (fz + bz) / 2); P(R2_box(0.05, CH, 0.06), 'metalNC', '#B7BCC1', x, CH / 2, fz); }
    for (let x = m0 + 1.1; x < m0 + mw - 0.2; x += 1.1) P(R2_box(0.035, CH, 0.05), 'metalNC', '#B7BCC1', x, CH / 2, fz);
    P(R2_box(mw, 0.05, 0.06), 'metalNC', '#B7BCC1', cu, 0.025, fz); P(R2_box(mw, 0.06, 0.06), 'metalNC', '#B7BCC1', cu, CH - 0.03, fz);
    P(R2_box(0.03, 0.35, 0.05), 'metalNC', '#8E949A', m0 + mw - 0.25, 1.05, fz + 0.04);
    // table + chairs
    const tw = Math.min(2.4, mw - 1.2), tz = -3.05;
    P(R2_box(tw, 0.04, 1.0), 'wood', '#6B4A33', cu, 0.74, tz); P(R2_box(tw - 0.6, 0.7, 0.12), 'metal', '#4C5157', cu, 0.37, tz); P(R2_box(tw - 0.4, 0.03, 0.6), 'metal', '#4C5157', cu, 0.015, tz);
    P(R2_cyl(0.09, 0.11, 0.03, 3), 'plastic', '#2A2D31', cu, 0.775, tz);
    const nc = Math.max(2, Math.floor(tw / 0.75));
    for (let k = 0; k < nc; k++) { const x = cu - tw / 2 + tw / nc * (k + 0.5); R2_chair(P.local(x, 0, tz - 0.78, 0), '#4B5560'); R2_chair(P.local(x, 0, tz + 0.75, Math.PI), '#4B5560');
      P(R2_box(0.22, 0.005, 0.3), 'plastic', '#F6F6F2', x, 0.765, tz - 0.25, 0.1); P(R2_box(0.22, 0.005, 0.3), 'plastic', '#F6F6F2', x, 0.765, tz + 0.25, -0.1); }
    P(R2_cyl(0.035, 0.03, 0.2, 8), 'glass', '#E8F0F2', cu + 0.2, 0.86, tz); P(R2_cyl(0.035, 0.03, 0.09, 8), 'glass', '#E8F0F2', cu - 0.3, 0.8, tz + 0.15);
    // wall screen, credenza, pendant, plant
    P(R2_box(1.5, 0.86, 0.04), 'plastic', '#15181C', cu, 1.65, bz + 0.03); P(R2_pln(1.44, 0.8), 'sign', '#ffffff', cu, 1.65, bz + 0.052, 0, { rect: R2_ATLAS.chart });
    P(R2_box(1.6, 0.5, 0.4), 'wood', '#C9B08A', cu, 0.25, bz + 0.22); P(R2_box(1.6, 0.02, 0.42), 'plastic', '#3A3D42', cu, 0.51, bz + 0.22);
    P(R2_box(tw - 0.2, 0.05, 0.12), 'metalNC', '#2E3134', cu, CH - 0.55, tz); P(R2_box(tw - 0.3, 0.01, 0.08), 'glow', '#FFF4E0', cu, CH - 0.58, tz);
    for (const s of [-1, 1]) P(R2_cyl(0.004, 0.004, 0.5, 4), 'metalNC', '#333', cu + s * (tw / 2 - 0.3), CH - 0.28, tz);
    R2_plant(P, m0 + mw - 0.35, 0, bz + 0.4, 1.2, '#E6E2DA', 1);
    P(R2_box(0.6, 0.012, 0.012), 'plasticNC', '#2F6FE0', cu, 2.3, bz + 0.012); P(R2_pln(0.9, 0.22), 'sign', '#ffffff', cu, 2.42, bz + 0.012, 0, { rect: R2_ATLAS.logo });
    // outside the meeting room: low sofa + coffee point (only if space)
    const oa = m0 > 1.8 ? [0.15, m0 - 0.15] : (W - (m0 + mw) > 1.8 ? [m0 + mw + 0.15, W - 0.15] : null);
    if (oa && R2_fit(ctx, oa[0], oa[1] - oa[0], W) === oa[0]) {
      const u = (oa[0] + oa[1]) / 2, sw = Math.min(1.6, oa[1] - oa[0] - 0.1);
      P(R2_box(sw, 0.25, 0.75), 'fabric', '#5B7A99', u, 0.3, bz + 0.5); P(R2_box(sw, 0.45, 0.2), 'fabric', '#56718D', u, 0.6, bz + 0.15);
      for (const s of [-1, 1]) P(R2_box(0.15, 0.4, 0.75), 'fabric', '#56718D', u + s * (sw / 2 - 0.075), 0.4, bz + 0.5);
      P(R2_box(sw * 0.6, 0.03, 0.5), 'wood', '#C9B08A', u, 0.42, bz + 1.25); for (const s of [-1, 1]) P(R2_box(0.03, 0.4, 0.45), 'metal', '#2E3134', u + s * sw * 0.28, 0.2, bz + 1.25);
      P(R2_cyl(0.04, 0.035, 0.09, 10), 'plastic', '#F4F2EC', u + 0.15, 0.48, bz + 1.25);
      R2_frame(P, ctx, u, 1.65, 0.8, 0.6, R2_ATLAS.art2, '#2E3134');
    }
    if (m0 > 1.0 && !oa) { R2_plant(P, 0.45, 0, -3.9, 1.3, '#E6E2DA', 0); const cs = R2_fit(ctx, 0.2, 0.5, W); if (cs != null && cs + 0.5 < m0) { P(R2_cyl(0.02, 0.02, 1.75, 6), 'wood', '#4A3424', cs + 0.25 + 0.6, 0.875, -2.3); P(R2_cyl(0.2, 0.22, 0.03, 10), 'wood', '#4A3424', cs + 0.85, 0.015, -2.3); P(R2_box(0.36, 0.5, 0.14), 'fabric', '#3E4B5E', cs + 0.85, 1.4, -2.22); } }
    R2_socket(P, ctx, cu - 1.1);
  }
}

/* ======== rooms2: hotel ======== */
function R2_bed(P, u, ctx, accent, flip, single = false) {
  const bz = ctx.backZ, L0 = P.local(u, 0, bz, 0), r = ctx.rng, k = single ? 0.6 : 1;
  const L = (geo, mat, hex, lx, ly, lz, lry, o = {}) => (Math.abs(lx) > 1 && single ? L0(geo, mat, hex, Math.sign(lx) * (Math.abs(lx) - 0.32), ly, lz, lry, o) : L0(geo, mat, hex, lx * k, ly, lz, lry, Object.assign({}, o, { sx: (o.sx || 1) * (Math.abs(lx) > 1 ? 1 : k) })));
  L(R2_box(1.7, 1.15, 0.08), 'fabric', '#7A6A5C', 0, 0.62, 0.06); L(R2_box(1.8, 0.06, 0.1), 'wood', '#5A4434', 0, 1.22, 0.06);
  L(R2_box(1.6, 0.25, 2.0), 'wood', '#5A4434', 0, 0.2, 1.1); L(R2_box(1.56, 0.22, 1.96), 'fabric', '#F2EFE8', 0, 0.42, 1.1);
  L(R2_box(1.62, 0.1, 1.45), 'fabric', '#F7F5F0', 0, 0.55, 1.36); L(R2_box(1.64, 0.3, 0.04), 'fabric', '#F7F5F0', 0, 0.42, 2.08);
  L(R2_box(1.66, 0.12, 0.42), 'fabric', accent, 0, 0.58, 1.7);                                            // runner in the theme colour
  for (const x of [-0.4, 0.4]) { L(R2_box(0.62, 0.16, 0.36), 'fabric', '#FBFAF6', x, 0.64, 0.33, 0, { rx: -0.35 }); }
  L(R2_box(0.36, 0.3, 0.12), 'fabric', '#B9A68C', 0, 0.68, 0.55, 0, { rx: -0.3 });
  for (const x of [-1.15, 1.15]) {                                                                           // bedside tables + lamps
    L(R2_box(0.45, 0.5, 0.4), 'wood', '#5A4434', x, 0.25, 0.25); L(R2_box(0.4, 0.01, 0.01), 'metal', '#B08A4A', x, 0.38, 0.455);
    L(R2_cyl(0.06, 0.09, 0.25, 10), 'plastic', '#D8CFC0', x, 0.63, 0.22); L(R2_cyl(0.13, 0.17, 0.22, 12), 'fabric', '#F1E6D0', x, 0.88, 0.22);
    L(R2_cyl(0.11, 0.15, 0.2, 12), 'glow', '#FFE2A8', x, 0.87, 0.22);
  }
  L(R2_box(0.14, 0.02, 0.2), 'plastic', '#2A2D31', flip ? -1.1 : 1.1, 0.51, 0.3); L(R2_cyl(0.035, 0.03, 0.1, 8), 'glass', '#EEF4F6', flip ? 1.1 : -1.1, 0.55, 0.32);
  R2_frame(P, ctx, u, 1.75, 1.1, 0.62, r() < 0.5 ? R2_ATLAS.art1 : R2_ATLAS.art2, '#C8A86A');
}
function R2_wardrobe(P, u, ctx, w = 1.0) {
  const bz = ctx.backZ; P(R2_box(w, 2.1, 0.6), 'wood', '#6E5440', u, 1.05, bz + 0.31);
  P(R2_box(0.008, 2.0, 0.005), 'plastic', '#2E2520', u, 1.05, bz + 0.612); for (const s of [-1, 1]) P(R2_box(0.02, 0.3, 0.03), 'metal', '#B08A4A', u + s * 0.06, 1.1, bz + 0.63);
  P(R2_box(w + 0.04, 0.05, 0.62), 'wood', '#5A4434', u, 2.12, bz + 0.31);
}
function R2_hotel(P, ctx, wing) {
  const acc = '#9A55E6', bz = ctx.backZ, r = ctx.rng;
  const { W, CH } = R2_shell(P, ctx, { floor: 'hcarpet', floorCol: '#8A7E8C', wall: 'paint', wallCol: '#DCD3C6', dado: 0.9, dadoMat: 'paint', dadoCol: '#C9BDAE', skirt: '#5A4434', cornice: '#EEE8DE' });
  R2_ceilingServices(P, ctx, W, CH, { lights: [W * 0.3, W * 0.72], duct: false });
  const d = R2_doorClear(ctx);
  const room = (a, b, k) => {                                // one bedroom between u = a and b
    const w = b - a, mid = (a + b) / 2;
    let placed = false;
    if (w > 2.6) { const bu = R2_fit(ctx, mid - 1.3 + (w > 3.6 ? 0.4 : 0), 2.6, W); if (bu != null && bu >= a - 0.01 && bu + 2.6 <= b + 0.01) { R2_bed(P, bu + 1.3, ctx, acc, k % 2); placed = true; } }
    if (!placed) for (const c of [a + 0.05, b - 1.75]) { const bu = R2_fit(ctx, c, 1.7, W); if (!placed && bu != null && bu >= a - 0.01 && bu + 1.7 <= b + 0.01) { R2_bed(P, bu + 0.85, ctx, acc, k % 2, true); placed = true; } }
    if (w > 3.7) { const wu = R2_fit(ctx, a + 0.1, 1.0, W); if (wu != null && wu + 1.0 < mid - 0.9) R2_wardrobe(P, wu + 0.5, ctx); }
    R2_suitcase(P, a + 0.45 + r() * 0.3, -1.75, ['#3E4B5E', '#8C5A4A', '#5B6E5A'][k % 3], 0.4 + r() * 0.5);
    if (k === 0) R2_suitcase(P, a + 0.95, -1.95, '#C9A46A', -0.3, 0.75);
    P(R2_box(0.5, 0.012, 0.012), 'plasticNC', '#B08A4A', mid, CH - 0.34, bz + 0.012);
    R2_socket(P, ctx, mid - 1.5 > a ? mid - 1.5 : mid + 1.5);
  };
  const part = (u) => { P(R2_box(0.12, CH, -bz - 1.35), 'paint', '#D4CABC', u, CH / 2, bz / 2 - 0.68); P(R2_box(0.14, 0.1, -bz - 1.35), 'wood', '#5A4434', u, 0.05, bz / 2 - 0.68); };
  if (wing === 'L') {
    let s = W / 2; if (d && s > d[0] - 0.1 && s < d[1] + 0.1) s = d[0] - 0.1 > W - d[1] ? d[0] - 0.1 : d[1] + 0.1;
    part(s); room(0.1, s - 0.1, 0); room(s + 0.1, W - 0.1, 1);
    R2_window(P, ctx, s < W / 2 ? 0.25 + 0.4 : W - 0.65, 0.7, 1.2, 0.95, { curtains: '#7A6A8E', radiator: false, frame: '#E8E6E0' });
  } else {
    // bedroom on the inner side, corridor with room doors, housekeeping cart and luggage trolley outside
    const rw = Math.min(3.4, W * 0.5); part(rw); room(0.1, rw - 0.1, 2);
    const c0 = rw + 0.1;
    P(R2_plnUp(W - c0, -bz - 0.05), 'carpet', '#6B4E5A', (c0 + W) / 2, 0.007, bz / 2);
    for (const du of [c0 + 0.7, W - 0.7]) { if (d && du + 0.5 > d[0] && du - 0.5 < d[1]) continue;
      P(R2_box(0.95, 2.15, 0.05), 'wood', '#5A4434', du, 1.075, bz + 0.03); P(R2_box(0.85, 2.05, 0.04), 'wood', '#7A5C44', du, 1.02, bz + 0.05);
      P(R2_box(0.05, 0.2, 0.06), 'metal', '#B08A4A', du + 0.3, 1.0, bz + 0.09); P(R2_box(0.07, 0.11, 0.02), 'plastic', '#2A2D31', du + 0.3, 1.25, bz + 0.08); P(R2_box(0.02, 0.02, 0.025), 'glow', '#5CFF8A', du + 0.3, 1.27, bz + 0.09); }
    P(R2_pln(0.4, 0.2), 'sign', '#ffffff', (c0 + W) / 2, 1.6, bz + 0.012, 0, { rect: R2_ATLAS.hotelno });
    for (const su of [c0 + 0.2, W - 0.2]) { P(R2_box(0.12, 0.2, 0.08), 'metal', '#B08A4A', su, 1.75, bz + 0.05); P(R2_cyl(0.06, 0.08, 0.14, 10), 'glow', '#FFE2A8', su, 1.92, bz + 0.07); }
    // housekeeping cart
    const cu = R2_fit(ctx, (c0 + W) / 2 - 0.55, 1.1, W);
    if (cu != null) { const L = P.local(cu + 0.55, 0, -2.25, 0);
      for (const y of [0.12, 0.55, 0.98]) L(R2_box(1.0, 0.03, 0.48), 'plastic', '#6A6E74', 0, y, 0);
      for (const x of [-0.5, 0.5]) for (const z of [-0.23, 0.23]) L(R2_box(0.03, 1.15, 0.03), 'metal', '#B7BCC1', x, 0.6, z);
      for (let k = 0; k < 3; k++) { L(R2_box(0.28, 0.07, 0.35), 'fabric', '#FBFAF6', -0.3 + k * 0.3, 0.6, 0); L(R2_box(0.28, 0.07, 0.35), 'fabric', '#F2EEE6', -0.3 + k * 0.3, 0.67, 0); L(R2_box(0.28, 0.06, 0.35), 'fabric', '#E8E0F0', -0.3 + k * 0.3, 1.03, 0); }
      L(R2_box(0.32, 0.36, 0.2), 'plastic', '#EDEDEA', 0.25, 0.32, 0.05); L(R2_cyl(0.05, 0.05, 0.25, 8), 'plastic', '#3A6EA8', -0.3, 0.27, 0.05); L(R2_cyl(0.05, 0.05, 0.22, 8), 'plastic', '#C84A3A', -0.15, 0.25, 0.05);
      L(R2_box(0.06, 0.65, 0.5), 'fabric', '#7A6A8E', 0.56, 0.72, 0, 0, { rz: 0.05 });
      for (const x of [-0.45, 0.45]) for (const z of [-0.2, 0.2]) L(R2_cylX(0.05, 0.03, 10), 'plastic', '#222', x, 0.05, z); }
    // brass luggage trolley
    const tu = R2_fit(ctx, W - 1.3, 1.0, W);
    if (tu != null && tu > c0) { const L = P.local(tu + 0.5, 0, -3.55, 0);
      L(R2_box(0.95, 0.06, 0.55), 'fabric', '#8A2E3A', 0, 0.18, 0); for (const x of [-0.45, 0.45]) { L(R2_cyl(0.02, 0.02, 1.6, 8), 'metal', '#B08A4A', x, 1.0, 0); L(R2_cylX(0.02, 0.0001 + 0.02, 6), 'metal', '#B08A4A', x, 1.8, 0); }
      L(R2_cylX(0.022, 0.95, 8), 'metal', '#B08A4A', 0, 1.8, 0); L(R2_cylX(0.015, 0.95, 8), 'metal', '#B08A4A', 0, 1.3, 0);
      for (const x of [-0.4, 0.4]) L(R2_cylZ(0.06, 0.04, 10), 'plastic', '#222', x, 0.07, 0.2);
      R2_suitcase(P, tu + 0.28, -3.55, '#2F3A4F', 0); R2_suitcase(P, tu + 0.72, -3.55, '#8C5A4A', 0.1, 0.8); }
    P(R2_box(0.8, 0.7, 0.35), 'wood', '#5A4434', c0 + 0.6, 0.35, -1.55 - 0.0001, 0);
    P(R2_cyl(0.08, 0.06, 0.25, 10), 'glass', '#D8E8EC', c0 + 0.6, 0.82, -1.55); for (let k = 0; k < 4; k++) P(R2_sph(0.06, 8, 6), 'plastic', ['#E8E2D6', '#C97A8A', '#9A55E6', '#E8E2D6'][k], c0 + 0.55 + k * 0.035, 1.03 + (k % 2) * 0.05, -1.55 + (k - 1.5) * 0.04);
  }
}

/* ======== rooms2: restaurant ======== */
function R2_restaurant(P, ctx, wing) {
  const acc = '#FF8A1F', bz = ctx.backZ, r = ctx.rng;
  if (wing === 'L') {
    const { W, CH } = R2_shell(P, ctx, { floor: 'planks', floorCol: '#8A6142', wall: 'paint', wallCol: '#E3D6C2', dado: 1.0, dadoCol: '#6E4E36', skirt: '#4A3424', cornice: '#EFE6D6' });
    R2_ceilingServices(P, ctx, W, CH, { lights: [], duct: false });
    // bar counter with stools and a wine wall behind, on the outer side
    const bw = Math.min(2.3, W * 0.36), bu = R2_fit(ctx, 0.1, bw, W) ?? 0.1;
    const bc = bu + bw / 2;
    for (let k = 0; k < 4; k++) for (let j = 0; j < Math.floor(bw / 0.22); j++) { const x = bu + 0.12 + j * 0.22, y = 1.15 + k * 0.3;
      if (j === 0) P(R2_box(bw, 0.025, 0.3), 'wood', '#4A3424', bc, y - 0.03, bz + 0.15);
      P(R2_cylZ(0.035, 0.26, 8), 'plastic', ['#2D3B24', '#4A1E22', '#3A3A22', '#2D3B24', '#5A2A2A'][(j + k * 2) % 5], x, y + 0.05, bz + 0.15); P(R2_cylZ(0.015, 0.06, 6), 'plastic', '#C8A24A', x, y + 0.05, bz + 0.3); }
    P(R2_box(bw + 0.06, 1.35, 0.32), 'wood', '#3A2A1E', bc, 1.75, bz + 0.13, 0, { sz: 0.3 }); // shelf back
    P(R2_box(bw, 0.9, 0.45), 'wood', '#5A3E2A', bc, 0.45, -2.55); P(R2_box(bw + 0.08, 0.05, 0.55), 'plastic', '#2E2B2A', bc, 0.92, -2.55);
    P(R2_box(bw, 0.03, 0.03), 'metal', '#B08A4A', bc, 0.15, -2.31); for (let k = 0; k < 5; k++) P(R2_box(0.02, 0.85, 0.01), 'wood', '#4A3424', bu + 0.15 + k * (bw - 0.3) / 4, 0.44, -2.322);
    P(R2_box(bw * 0.9, 0.9, 0.5), 'wood', '#4A3424', bc, 0.45, bz + 0.6); P(R2_box(bw * 0.9, 0.03, 0.52), 'metal', '#B7BCC1', bc, 0.91, bz + 0.6);
    for (let k = 0; k < 3; k++) { P(R2_box(0.05, 0.26, 0.05), 'metal', '#C9CCD0', bc - 0.3 + k * 0.15, 1.06, -2.65); P(R2_box(0.025, 0.08, 0.025), 'plastic', '#222', bc - 0.3 + k * 0.15, 1.24, -2.65); }
    P(R2_box(0.42, 0.38, 0.38), 'metal', '#B7BCC1', bc + bw / 2 - 0.3, 1.13, bz + 0.6); P(R2_box(0.3, 0.06, 0.02), 'plastic', '#222', bc + bw / 2 - 0.3, 1.2, bz + 0.79);
    for (let k = 0; k < 4; k++) P(R2_cyl(0.035, 0.028, 0.1, 8), 'glass', '#F0F4F4', bc - 0.5 + k * 0.12, 0.98, bz + 0.5);
    const ns = Math.floor(bw / 0.6);
    for (let k = 0; k < ns; k++) { const x = bu + 0.3 + k * (bw - 0.6) / Math.max(1, ns - 1); P(R2_cyl(0.19, 0.19, 0.06, 12), 'fabric', '#3A2A22', x, 0.78, -2.05); P(R2_cyl(0.025, 0.025, 0.75, 6), 'metal', '#2E3134', x, 0.38, -2.05); P(R2_cyl(0.16, 0.16, 0.02, 12), 'metal', '#2E3134', x, 0.01, -2.05); P(R2_torus(0.15), 'metal', '#2E3134', x, 0.28, -2.05); }
    // dining tables with cloths, plates, glasses, candles, flowers; bentwood chairs left/right of each table
    const t0 = bu + bw + 0.15, avail = W - 0.1 - t0, nt = Math.max(1, Math.floor(avail / 1.75)), step = avail / nt, used = [];
    for (let k = 0; k < nt; k++) {
      const tu = R2_fit(ctx, t0 + step * k + (step - 1.6) / 2, 1.6, W); if (tu == null || tu < t0 - 0.01 || used.some((v) => Math.abs(v - tu) < 1.6)) continue; used.push(tu); const u = tu + 0.8, z = -3.0 + (k % 2) * 0.25;
      P(R2_box(0.8, 0.04, 0.8), 'fabric', '#F6F3EC', u, 0.75, z); P(R2_box(0.84, 0.25, 0.84), 'fabric', '#F2EEE6', u, 0.62, z, 0, { sy: 1 });
      P(R2_cyl(0.04, 0.05, 0.5, 8), 'wood', '#3A2A1E', u, 0.25, z); P(R2_box(0.5, 0.03, 0.5), 'wood', '#3A2A1E', u, 0.015, z);
      for (const s of [-1, 1]) { P(R2_cyl(0.11, 0.09, 0.015, 14), 'plastic', '#FBFBF8', u + s * 0.24, 0.775, z); P(R2_box(0.12, 0.01, 0.09), 'fabric', acc, u + s * 0.24, 0.79, z + 0.15, 0.3);
        P(R2_box(0.012, 0.005, 0.17), 'metal', '#C9CCD0', u + s * 0.38, 0.775, z); P(R2_cyl(0.03, 0.02, 0.13, 8), 'glass', '#F0F4F4', u + s * 0.2, 0.84, z - 0.18);
        R2_chair(P.local(u + s * 0.62, 0, z, -s * Math.PI / 2), '#5A3E2A', true, true); }
      P(R2_cyl(0.025, 0.025, 0.08, 8), 'plastic', '#F4EEDC', u, 0.81, z + 0.05); P(R2_sph(0.015, 6, 4), 'glow', '#FFC870', u, 0.865, z + 0.05);
      P(R2_cyl(0.035, 0.03, 0.12, 8), 'glass', '#D8E8EC', u - 0.05, 0.83, z - 0.12); P(R2_sph(0.04, 8, 6), 'plastic', ['#D23A2E', '#F2C230', '#E8E2D6'][k % 3], u - 0.05, 0.93, z - 0.12);
      // pendant lamp
      P(R2_cyl(0.004, 0.004, CH - 1.75, 4), 'metalNC', '#222', u, (CH + 1.75) / 2, z); P(R2_cyl(0.05, 0.22, 0.18, 14), 'metal', '#B08A4A', u, 1.75, z); P(R2_cyl(0.06, 0.2, 0.02, 14), 'glow', '#FFE2A8', u, 1.665, z);
      R2_frame(P, ctx, u, 1.85, 0.7, 0.5, [R2_ATLAS.art1, R2_ATLAS.art2][k % 2], '#B08A4A');
    }
    P(R2_pln(0.72, 0.54), 'sign', '#ffffff', bc, 2.32, bz + 0.012, 0, { rect: R2_ATLAS.menu });
    P(R2_box(bw + 0.2, 0.06, 0.3), 'plastic', acc, bc, 2.0, -2.55);          // orange canopy rail over the bar
    for (let k = 0; k < 3; k++) { const x = bu + bw * (k + 0.5) / 3; P(R2_cyl(0.004, 0.004, CH - 2.05, 4), 'metalNC', '#222', x, (CH + 2.05) / 2, -2.55); }
    R2_plant(P, W - 0.35, 0, -1.65, 1.1, '#3F4348', 0);
    R2_socket(P, ctx, W - 0.6);
  } else {
    // open kitchen: white tile walls, quarry tile floor, steel line along the back, hood, pass at the front
    const { W, CH } = R2_shell(P, ctx, { floor: 'floortile', floorCol: '#A0624A', wall: 'tile', wallCol: '#F2F0EA', skirt: '#8A8884', skirtMat: 'plasticNC', cornice: '#EEEEEA' });
    R2_ceilingServices(P, ctx, W, CH, { lights: [W * 0.2, W * 0.8], lightType: 'tube', duct: false });
    const d = R2_doorClear(ctx), seg = [];
    { let a = 0.1; const ends = d ? [[0.1, d[0]], [d[1], W - 0.1]] : [[0.1, W - 0.1]]; for (const [s, e] of ends) if (e - s > 0.5) seg.push([s, e]); }
    for (const [s, e] of seg) { const w = e - s, c = (s + e) / 2;
      P(R2_box(w, 0.86, 0.65), 'metal', '#B9BEC3', c, 0.43, bz + 0.34); P(R2_box(w, 0.04, 0.68), 'metal', '#D0D4D8', c, 0.88, bz + 0.35);
      P(R2_box(w, 0.1, 0.6), 'plastic', '#2E3134', c, 0.05, bz + 0.33);
      for (let x = s + 0.3; x < e - 0.2; x += 0.6) P(R2_box(0.008, 0.7, 0.005), 'plastic', '#7E8489', x, 0.46, bz + 0.67);
      P(R2_box(w, 0.03, 0.3), 'metal', '#C9CCD0', c, 1.75, bz + 0.16); // wall shelf
      for (let x = s + 0.2; x < e - 0.1; x += 0.35) { const pk = ((x * 7) | 0) % 3; P(pk ? R2_cyl(0.09, 0.08, 0.14, 10) : R2_box(0.18, 0.1, 0.16), 'metal', pk ? '#A9ADB2' : '#D0D4D8', x, 1.84, bz + 0.16); }
    }
    // range with 4 burners, oven door, hood + duct
    const ru = R2_fit(ctx, W * 0.42 - 0.6, 1.2, W) ?? 0.2, rc = ru + 0.6;
    P(R2_box(1.2, 0.9, 0.7), 'metal', '#A9ADB2', rc, 0.45, bz + 0.36); P(R2_box(1.2, 0.04, 0.72), 'plastic', '#1E1F21', rc, 0.92, bz + 0.36);
    P(R2_box(0.9, 0.45, 0.02), 'plastic', '#1E1F21', rc, 0.42, bz + 0.72); P(R2_box(0.7, 0.03, 0.04), 'metal', '#D0D4D8', rc, 0.7, bz + 0.74);
    for (let k = 0; k < 5; k++) P(R2_cylZ(0.025, 0.04, 8), 'plastic', '#222', rc - 0.4 + k * 0.2, 0.82, bz + 0.73);
    for (const [dx, dz] of [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.17], [0.3, 0.17]]) { P(R2_torus(0.1), 'plastic', '#2A2A2A', rc + dx, 0.95, bz + 0.36 + dz, 0, { rx: Math.PI / 2 }); P(R2_cyl(0.04, 0.04, 0.01, 10), 'glow', '#4A7BFF', rc + dx, 0.945, bz + 0.36 + dz); }
    P(R2_cyl(0.16, 0.15, 0.24, 14), 'metal', '#C9CCD0', rc - 0.3, 1.08, bz + 0.21); P(R2_cyl(0.165, 0.165, 0.02, 14), 'metal', '#B9BEC3', rc - 0.3, 1.21, bz + 0.21);
    P(R2_cyl(0.15, 0.13, 0.06, 14), 'plastic', '#2A2A2A', rc + 0.3, 0.99, bz + 0.53); P(R2_box(0.3, 0.025, 0.04), 'plastic', '#2A2A2A', rc + 0.55, 1.0, bz + 0.62, -0.5);
    P(R2_cyl(0.11, 0.11, 0.01, 12), 'plastic', '#E8C84A', rc + 0.3, 1.02, bz + 0.53);
    P(R2_box(1.5, 0.45, 0.9), 'metalNC', '#C9CCD0', rc, 2.05, bz + 0.45, 0, { sx: 1 }); P(R2_box(1.4, 0.05, 0.85), 'metalNC', '#8E949A', rc, 1.82, bz + 0.45);
    P(R2_box(0.45, CH - 2.25, 0.45), 'metalNC', '#B9BEC3', rc, (CH + 2.25) / 2, bz + 0.3); P(R2_box(1.2, 0.02, 0.05), 'glow', '#FFF4E0', rc, 1.8, bz + 0.85);
    // fridge, double door, at the outer end
    const fu = R2_fit(ctx, W - 1.15, 1.05, W);
    if (fu != null) { P(R2_box(1.0, 2.05, 0.75), 'metal', '#C9CCD0', fu + 0.5, 1.025, bz + 0.4); P(R2_box(0.006, 1.95, 0.005), 'plastic', '#3A3D42', fu + 0.5, 1.03, bz + 0.776);
      for (const s of [-1, 1]) P(R2_box(0.03, 0.6, 0.05), 'metal', '#8E949A', fu + 0.5 + s * 0.06, 1.2, bz + 0.8); P(R2_box(0.2, 0.08, 0.01), 'glow', '#7FD0FF', fu + 0.8, 1.9, bz + 0.78); }
    // chef pass at the front: steel counter, heat lamps, plates waiting, ticket rail; cutting board with veg
    const pu = R2_fit(ctx, 0.3, Math.min(2.6, W * 0.45), W);
    if (pu != null) { const pw = Math.min(2.6, W * 0.45), pc = pu + pw / 2, pz = -1.95;
      P(R2_box(pw, 0.95, 0.55), 'metal', '#B9BEC3', pc, 0.475, pz); P(R2_box(pw + 0.04, 0.04, 0.6), 'metal', '#D0D4D8', pc, 0.97, pz);
      P(R2_box(pw, 0.03, 0.5), 'metal', '#D0D4D8', pc, 0.43, pz); for (const s of [-1, 1]) P(R2_box(0.04, 0.55, 0.04), 'metal', '#A9ADB2', pc + s * (pw / 2 - 0.05), 1.25, pz);
      P(R2_box(pw, 0.06, 0.4), 'metal', '#A9ADB2', pc, 1.55, pz); for (let k = 0; k < 3; k++) P(R2_box(0.3, 0.02, 0.1), 'glow', '#FFB070', pc - pw / 3 + k * pw / 3, 1.515, pz);
      for (let k = 0; k < 3; k++) { const x = pc - pw / 3 + k * pw / 3; P(R2_cyl(0.13, 0.1, 0.02, 14), 'plastic', '#FBFBF8', x, 1.0, pz); P(R2_sph(0.06, 8, 6), 'plastic', ['#D8A040', '#C84A3A', '#6F8A5E'][k], x, 1.03, pz, 0, { sy: 0.5 }); }
      P(R2_box(pw - 0.2, 0.02, 0.02), 'metal', '#8E949A', pc, 1.45, pz + 0.18); for (let k = 0; k < 5; k++) P(R2_box(0.08, 0.12, 0.003), 'plasticNC', '#FBFBF2', pc - 0.6 + k * 0.28, 1.38, pz + 0.19, (k - 2) * 0.05);
      P(R2_box(0.04, 0.25, 0.04), 'glow', '#FF5A3A', pc + pw / 2 - 0.15, 1.15, pz); }
    const bu = R2_fit(ctx, W * 0.72, 0.5, W); if (bu != null) { P(R2_box(0.45, 0.03, 0.3), 'wood', '#C9A46A', bu + 0.25, 0.915, bz + 0.4); for (let k = 0; k < 3; k++) P(R2_sph(0.045, 8, 6), 'plastic', '#D23A2E', bu + 0.12 + k * 0.09, 0.96, bz + 0.38);
      P(R2_sph(0.08, 8, 6), 'plastic', '#7AAE4E', bu + 0.38, 0.98, bz + 0.45); P(R2_box(0.2, 0.01, 0.03), 'metal', '#D0D4D8', bu + 0.2, 0.94, bz + 0.5, 0.4); }
    P(R2_cylX(0.012, Math.min(1.6, W * 0.3)), 'metal', '#8E949A', W * 0.75, 1.5, bz + 0.05); for (let k = 0; k < 4; k++) { P(R2_box(0.015, 0.3, 0.015), 'metal', '#B7BCC1', W * 0.75 - 0.45 + k * 0.3, 1.35, bz + 0.06); P(R2_sph(0.04, 8, 6), 'metal', '#B7BCC1', W * 0.75 - 0.45 + k * 0.3, 1.2, bz + 0.06, 0, { sy: 0.5 }); }
    P(R2_pln(0.5, 0.25), 'sign', '#ffffff', 0.5, 2.3, bz + 0.012, 0, { rect: R2_ATLAS.exit });
    return { steamAt: [ctx.x0 + rc - 0.3, ctx.y + 1.25, bz + 0.21] };
  }
}
function R2_torus(r) { return R2_GEO['t' + r] || (R2_GEO['t' + r] = new THREE.TorusGeometry(r, 0.012, 4, 14).rotateX(Math.PI / 2)); }

/* ======== rooms2: parking ======== */
const R2_CAR_COLS = ['#B9BEC4', '#2E3B55', '#F1F0EC', '#7A2A2E', '#24272B', '#5E6E66', '#8C7A62', '#3E5E7E'];
function R2_carShape(type) {    // side profile (x along the car, y up), returns { pts, glass, L, W, wheelX, wr }
  const T = {
    mini: { L: 2.9, W: 1.56, pts: [[-1.45, 0.22], [-1.47, 0.8], [-1.38, 1.5], [0.2, 1.52], [0.85, 1.0], [1.4, 0.88], [1.47, 0.6], [1.45, 0.22]], glass: [[-1.3, 1.02], [-1.25, 1.44], [0.18, 1.46], [0.75, 1.02]], wx: 0.98, wr: 0.28 },
    hatch: { L: 3.6, W: 1.62, pts: [[-1.8, 0.22], [-1.82, 0.72], [-1.72, 0.92], [-1.5, 1.38], [0.25, 1.42], [0.95, 0.98], [1.72, 0.84], [1.82, 0.6], [1.8, 0.22]], glass: [[-1.62, 0.96], [-1.42, 1.33], [0.22, 1.36], [0.85, 0.99]], wx: 1.18, wr: 0.3 },
    sedan: { L: 4.2, W: 1.72, pts: [[-2.1, 0.24], [-2.12, 0.75], [-2.0, 0.88], [-1.45, 0.92], [-0.95, 1.36], [0.45, 1.38], [1.05, 0.96], [2.0, 0.82], [2.12, 0.55], [2.1, 0.24]], glass: [[-1.35, 0.95], [-0.92, 1.31], [0.42, 1.32], [0.95, 0.97]], wx: 1.35, wr: 0.31 },
    suv: { L: 4.3, W: 1.82, pts: [[-2.15, 0.3], [-2.17, 0.95], [-2.08, 1.62], [0.55, 1.66], [1.25, 1.12], [2.1, 1.0], [2.2, 0.62], [2.15, 0.3]], glass: [[-1.98, 1.12], [-1.94, 1.57], [0.52, 1.6], [1.12, 1.14]], wx: 1.4, wr: 0.36 },
    van: { L: 4.6, W: 1.8, pts: [[-2.3, 0.3], [-2.32, 1.95], [1.2, 1.97], [1.95, 1.2], [2.3, 1.02], [2.32, 0.3]], glass: [[0.6, 1.25], [0.6, 1.88], [1.17, 1.88], [1.82, 1.25]], wx: 1.55, wr: 0.34 },
  };
  return T[type];
}
function R2_carGeo(type, glass) {
  const k = 'car' + type + glass; if (R2_GEO[k]) return R2_GEO[k];
  const t = R2_carShape(type), sh = new THREE.Shape(), pts = glass ? t.glass : t.pts;
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const w = glass ? t.W - 0.04 : t.W - 0.12;
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: glass ? 0.035 : 0.06, bevelSize: glass ? 0.0 : 0.05, bevelSegments: glass ? 1 : 2, curveSegments: 1 });
  g.translate(0, 0, -w / 2); return (R2_GEO[k] = g);
}
function R2_car(P, type, col, u, z, ry, yy = 0, sc = 1) {      // nose along local +x
  const t = R2_carShape(type), L = P.local(u, yy, z, ry, sc), hw = t.W / 2;
  L(R2_carGeo(type, false), 'carpaint', col, 0, 0, 0); L(R2_carGeo(type, true), 'carpaint', '#1A2129', 0, 0, 0);
  for (const [a, b] of [[0, 1], [2, 3]]) { const [ax, ay] = t.glass[a], [bx, by] = t.glass[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    L(R2_box(l * 0.9, 0.012, t.W - 0.36), 'carpaint', '#1A2129', (ax + bx) / 2 + nx * 0.1, (ay + by) / 2 + ny * 0.1, 0, 0, { rz: Math.atan2(dy, dx) }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { L(R2_cylZ(t.wr, 0.22, 14), 'plastic', '#1C1C1E', sx * t.wx, t.wr, sz * (hw - 0.1)); L(R2_cylZ(t.wr * 0.62, 0.23, 10), 'metal', '#C9CCD0', sx * t.wx, t.wr, sz * (hw - 0.1)); }
  const fx = t.L / 2, ly = type === 'suv' || type === 'van' ? 0.85 : 0.68;
  for (const sz of [-1, 1]) { L(R2_box(0.06, 0.12, 0.3), 'glow', '#FFF6E0', fx + 0.02, ly, sz * (hw - 0.25)); L(R2_box(0.06, 0.12, 0.28), 'glow', '#E0342A', -fx - 0.02, ly + 0.05, sz * (hw - 0.22));
    L(R2_box(0.14, 0.09, 0.08), 'carpaint', col, t.glass[3][0] - 0.05, t.glass[3][1] + 0.02, sz * (hw + 0.04)); }
  for (const s of [-1, 1]) { L(R2_box(0.05, 0.12, 0.42), 'plastic', '#F4F2E8', s * (fx + 0.04), 0.45, 0); L(R2_box(0.08, 0.14, t.W - 0.1), 'plastic', '#2A2D31', s * (fx + 0.01), 0.34, 0); }
  for (const sz of [-1, 1]) { L(R2_box(t.L - 1.3, 0.008, 0.01), 'plastic', '#333', -0.1, 0.62, sz * (hw + 0.005)); L(R2_box(0.008, 0.55, 0.01), 'plastic', '#333', t.glass[1][0] + 0.85, 0.7, sz * (hw + 0.005)); L(R2_box(0.1, 0.02, 0.012), 'metal', '#C9CCD0', t.glass[1][0] + 0.7, 0.85, sz * (hw + 0.01)); }
}
function R2_parking(P, ctx, wing) {
  const bz = ctx.backZ, r = ctx.rng;
  const { W, CH } = R2_shell(P, ctx, { floor: 'concrete', floorCol: '#8F8D88', wall: 'concrete', wallCol: '#B4B0A8', skirt: '#F2C230', skirtMat: 'plasticNC', cornice: '#A9A6A0', stripe: '#2459B8', stripeY: 1.1 });
  P(R2_box(W, 0.03, 0.02), 'plasticNC', '#F2C230', W / 2, 0.55, bz + 0.012);
  R2_ceilingServices(P, ctx, W, CH, { lights: [W * 0.2, W * 0.55, W * 0.88], lightType: 'tube', duct: false });
  // ceiling pipes: red sprinkler main, grey drain pipe, cable tray, small conduit
  P(R2_cylX(0.06, W), 'metalNC', '#B8322A', W / 2, CH - 0.12, -3.2); P(R2_cylX(0.09, W), 'plasticNC', '#8E949A', W / 2, CH - 0.22, -4.0);
  P(R2_box(W, 0.06, 0.32), 'metalNC', '#A9ADB2', W / 2, CH - 0.07, -1.9); for (let k = 0; k < 6; k++) P(R2_cylX(0.018, W, 6), 'plasticNC', ['#2E3134', '#3A3D42', '#5A4A3A'][k % 3], W / 2, CH - 0.03 - (k % 2) * 0.03, -2.0 + k * 0.04);
  for (let u = 0.5; u < W; u += 1.5) { P(R2_box(0.03, 0.2, 0.03), 'metalNC', '#8E949A', u, CH - 0.1, -3.2); P(R2_box(0.03, 0.3, 0.03), 'metalNC', '#8E949A', u, CH - 0.15, -4.0); }
  // tyre marks, oil stains (dark flat boxes)
  for (let k = 0; k < 7; k++) P(R2_box(0.5 + r() * 1.2, 0.002, 0.05 + r() * 0.15), 'plasticNC', '#55524E', r() * W, 0.008, -1.4 - r() * 2.8, r() * 0.6 - 0.3);
  const column = (u) => { P(R2_box(0.42, CH, 0.42), 'concrete', '#A9A6A0', u, CH / 2, -2.9); P(R2_box(0.44, 0.7, 0.44), 'plasticNC', '#F2C230', u, 0.35, -2.9);
    for (let k = 0; k < 3; k++) P(R2_box(0.445, 0.08, 0.445), 'plasticNC', '#1D1D1D', u, 0.12 + k * 0.22, -2.9); };
  const line = (u0, u1, z0, z1) => { const dx = u1 - u0, dz = z1 - z0, l = Math.hypot(dx, dz); P(R2_box(l, 0.004, 0.08), 'plasticNC', '#ECEAE2', (u0 + u1) / 2, 0.008, (z0 + z1) / 2, -Math.atan2(dz, dx)); };
  const spawn = [];
  if (wing === 'L') {
    // two cars parked slightly angled, side-on to the camera, slanted bay lines, a column between, bay numbers on the wall
    const ang = 0.2, pick = ['hatch', 'sedan', 'suv', 'mini'], types = [pick[(r() * 3) | 0], pick[(r() * 4) | 0]];
    const fp = types.map((ty) => { const t = R2_carShape(ty); return t.L * Math.cos(ang) + t.W * Math.sin(ang); });
    const sc = Math.min(1, (W - 0.9) / (fp[0] + fp[1])), gapU = 0.2 + fp[0] * sc + 0.25;
    let u = 0.2;
    types.forEach((ty, k) => {
      const t = R2_carShape(ty), cu = u + fp[k] * sc / 2;
      line(u - 0.12, u - 0.12 + 0.6, -1.4, -4.4);
      P(R2_pln(0.32, 0.6), 'sign', '#ffffff', cu, 0.95, bz + 0.012, 0, { rect: [R2_ATLAS.num[0] + (k % 8) * 64, R2_ATLAS.num[1], 64, 128] });
      P(R2_box(0.9, 0.1, 0.14), 'concrete', '#C9C6BF', cu, 0.05, bz + 0.3);
      R2_car(P, ty, R2_CAR_COLS[(k * 3 + ((r() * 8) | 0)) % 8], cu, -2.95, k ? -ang : ang, 0, sc);
      spawn.push(new THREE.Vector3(ctx.x0 + cu + 0.6, ctx.y, ctx.laneZ));
      u += fp[k] * sc + 0.5;
    });
    line(u - 0.37, u - 0.37 + 0.6, -1.4, -4.4);
    column(gapU - 0.02);
    P(R2_pln(0.45, 0.45), 'sign', '#ffffff', 0.4, 2.15, bz + 0.012, 0, { rect: R2_ATLAS.park });
    P(R2_box(0.35, 0.6, 0.18), 'plasticNC', '#C8322A', W - 0.4, 1.0, bz + 0.1); P(R2_cyl(0.07, 0.07, 0.4, 10), 'plastic', '#D23A2E', W - 0.4, 0.95, bz + 0.12);
  } else {
    // ramp up toward the street at the outer end: concrete deck, chevron kerb, low guard wall, arrows
    const rl = Math.min(3.6, W * 0.5), r0 = W - rl, rz0 = -2.7, rw = -bz + rz0 - 0.05, rc = (rz0 + bz) / 2, ang = Math.atan2(CH - 0.05, rl);
    const RL = Math.hypot(rl, CH - 0.05);
    P(R2_box(RL, 0.2, rw), 'concrete', '#9A968F', r0 + rl / 2, (CH - 0.05) / 2 - 0.08, rc, 0, { rz: ang });
    P(R2_box(RL, 0.004, 0.08), 'plasticNC', '#ECEAE2', r0 + rl / 2, (CH - 0.05) / 2 + 0.025, rc, 0, { rz: ang });
    P(R2_box(RL, 0.9, 0.15), 'concrete', '#A9A6A0', r0 + rl / 2, (CH - 0.05) / 2 + 0.35, rz0 + 0.07, 0, { rz: ang });
    P(R2_box(RL, 0.2, 0.152), 'sign', '#ffffff', r0 + rl / 2, (CH - 0.05) / 2 + 0.72, rz0 + 0.07, 0, { rz: ang, rect: R2_ATLAS.hazard });
    P(R2_cylX(0.03, RL), 'metal', '#C9CCD0', r0 + rl / 2, (CH - 0.05) / 2 + 1.0, rz0 + 0.07, 0, { rz: ang });
    for (let k = 0; k < 3; k++) P(R2_box(0.5, 0.004, 0.18), 'plasticNC', '#ECEAE2', r0 + 0.8 + k * 1.0, (0.8 + k * 1.0) * Math.tan(ang) + 0.03, rc, 0, { rz: ang });
    P(R2_pln(0.6, 0.3), 'sign', '#ffffff', r0 - 0.2, 2.25, bz + 0.012, 0, { rect: R2_ATLAS.exit });
    P(R2_box(0.05, CH, 0.05), 'plasticNC', '#F2C230', r0 - 0.05, CH / 2, rz0);
    // barrier: post, striped arm across the ramp lane, ticket machine
    const bu = r0 - 0.35;
    P(R2_box(0.3, 1.05, 0.3), 'plastic', '#D8DADC', bu, 0.525, rz0 + 0.25); P(R2_box(0.32, 0.12, 0.32), 'plastic', '#C8322A', bu, 1.1, rz0 + 0.25);
    P(R2_box(0.06, 0.08, rw + 0.2), 'sign', '#ffffff', bu, 0.95, rc - 0.1, 0, { rect: R2_ATLAS.redwhite });
    P(R2_cyl(0.05, 0.05, 0.02, 8), 'glow', '#FF5040', bu, 1.17, rz0 + 0.25);
    const tu = bu - 0.75;
    P(R2_box(0.45, 1.35, 0.35), 'metal', '#5A6068', tu, 0.675, -2.35); P(R2_box(0.47, 0.1, 0.4), 'plastic', '#2459B8', tu, 1.4, -2.35);
    P(R2_pln(0.32, 0.32), 'sign', '#ffffff', tu, 1.05, -2.17, 0, { rect: R2_ATLAS.ticket }); P(R2_box(0.12, 0.02, 0.03), 'plastic', '#111', tu, 0.75, -2.16);
    P(R2_box(0.2, 0.08, 0.04), 'plastic', '#111', tu, 0.55, -2.16);
    for (let k = 0; k < 3; k++) P(R2_box(0.12, 0.004, 0.6), 'plasticNC', '#ECEAE2', tu - 0.3 - k * 0.0, 0.008, -2.0 - k * 0.0, 0, { sx: 1 });
    // one car, nose-in, rear to the camera, and a bay
    const cu = Math.min(tu - 1.4, 1.2);
    if (cu > 0.85) { line(cu - 1.0, cu - 1.0, -1.35, -4.4); line(cu + 1.0, cu + 1.0, -1.35, -4.4);
      P(R2_pln(0.32, 0.6), 'sign', '#ffffff', cu, 0.95, bz + 0.012, 0, { rect: [R2_ATLAS.num[0] + 5 * 64, R2_ATLAS.num[1], 64, 128] });
      R2_car(P, 'mini', ['#B9BEC4', '#7A2A2E', '#3E5E7E', '#F1F0EC'][(r() * 4) | 0], cu, -2.88, Math.PI / 2 - 0.45, 0, 0.93); spawn.push(new THREE.Vector3(ctx.x0 + cu + 0.9, ctx.y, ctx.laneZ)); }
    P(R2_box(0.35, 0.6, 0.18), 'plasticNC', '#C8322A', tu + 0.0, 1.9, bz + 0.1, 0, { sx: 0.7, sy: 0.6 });
  }
  return { spawnPoints: spawn };
}

/* ======== rooms2: subway ======== */
const R2_SUB = { trenchZ0: 0, trenchZ1: 1.75, railY: -1.75, trainZ: 0.88, trainD: 1.5, carL: 6.6, nCars: 3 };
const R2_TRAINS = {};
function R2_subwayPlatform(P, ctx, wing) {
  const bz = ctx.backZ, r = ctx.rng;
  const { W, CH } = R2_shell(P, ctx, { floor: 'floortile', floorCol: '#B8B4AC', wall: 'tile', wallCol: '#EEE9DE', skirt: '#3A4150', skirtMat: 'plasticNC', cornice: '#D8D2C6' });
  // charcoal tile band (theme colour) with a thin yellow line, tactile strip + white line along the edge
  P(R2_box(W, 0.36, 0.012), 'tile', '#4A5262', W / 2, 1.05, bz + 0.012); P(R2_box(W, 0.03, 0.014), 'plasticNC', '#F2C230', W / 2, 0.86, bz + 0.013);
  P(R2_box(W, 0.02, 0.4), 'tactile', '#ffffff', W / 2, 0.01, -0.22); P(R2_box(W, 0.004, 0.06), 'plasticNC', '#F4F4F0', W / 2, 0.006, -0.48);
  P(R2_box(W, 0.06, 0.05), 'concrete', '#C9C6BF', W / 2, -0.03, -0.025);
  R2_ceilingServices(P, ctx, W, CH, { lights: [W * 0.18, W * 0.5, W * 0.82], lightType: 'tube', duct: false });
  P(R2_box(W, 0.08, 0.3), 'metalNC', '#8E949A', W / 2, CH - 0.06, -3.9);
  const bench = (u) => { P(R2_box(1.5, 0.04, 0.42), 'wood', '#9A6E47', u, 0.46, bz + 0.35); P(R2_box(1.5, 0.3, 0.04), 'wood', '#9A6E47', u, 0.72, bz + 0.13);
    for (const s of [-0.65, 0, 0.65]) { P(R2_box(0.04, 0.44, 0.4), 'metal', '#5A6068', u + s, 0.22, bz + 0.33); P(R2_box(0.04, 0.04, 0.4), 'metal', '#5A6068', u + s, 0.6, bz + 0.33); } };
  const board = (u, z) => { P(R2_box(1.3, 0.38, 0.12), 'plastic', '#222428', u, 2.05, z); P(R2_pln(1.22, 0.3), 'sign', '#ffffff', u, 2.05, z + 0.061, 0, { rect: R2_ATLAS.board }); for (const s of [-0.45, 0.45]) P(R2_cyl(0.012, 0.012, CH - 2.24, 6), 'metalNC', '#5A6068', u + s, (CH + 2.24) / 2, z); };
  if (wing === 'L') {
    P(R2_box(2.6, 0.5, 0.04), 'plasticNC', '#2B3140', W * 0.55, 1.58, bz + 0.03); P(R2_pln(2.5, 0.42), 'sign', '#ffffff', W * 0.55, 1.58, bz + 0.052, 0, { rect: R2_ATLAS.station });
    P(R2_pln(0.6, 0.6), 'sign', '#ffffff', 0.55, 1.85, bz + 0.03, 0, { rect: R2_ATLAS.roundel }); P(R2_cyl(0.32, 0.32, 0.03, 18), 'plasticNC', '#E8E8E4', 0.55, 1.85, bz + 0.015, 0, { rx: Math.PI / 2 });
    bench(W * 0.3); if (W > 5.5) R2_frame(P, ctx, W * 0.86, 1.7, 0.6, 0.8, R2_ATLAS.ad1, '#2E3134');
    board(W * 0.55, -2.4);
    P(R2_cyl(0.18, 0.16, 0.75, 12), 'metal', '#8E949A', W * 0.12, 0.375, bz + 0.25); P(R2_cyl(0.19, 0.19, 0.04, 12), 'plastic', '#3A4150', W * 0.12, 0.77, bz + 0.25);
    P(R2_pln(0.34, 0.34), 'sign', '#ffffff', W * 0.86, 2.4, bz + 0.012, 0, { rect: R2_ATLAS.clock });
    P(R2_box(0.12, 0.1, 0.18), 'plastic', '#E8E8E4', W - 0.3, CH - 0.25, bz + 0.15); P(R2_cylZ(0.03, 0.1, 8), 'plastic', '#111', W - 0.3, CH - 0.27, bz + 0.27);
  } else {
    // way-out stairs rising along the back wall, ticket machines, map, bench, board, CCTV
    const sw = Math.min(3.0, W * 0.42), s0 = W - sw - 0.05, n = 12, sh = (CH - 0.1) / n, sd = sw / n;
    for (let k = 0; k < n; k++) { P(R2_box(sd, sh * (k + 1), 1.2), 'concrete', '#B4B0A8', s0 + sd * (k + 0.5), sh * (k + 1) / 2, bz + 0.62); P(R2_box(sd, 0.02, 1.2), 'plasticNC', '#F2C230', s0 + sd * (k + 0.5) - sd * 0.42, sh * (k + 1), bz + 0.62); }
    const ang = Math.atan2(CH - 0.1, sw), RL = Math.hypot(sw, CH - 0.1);
    P(R2_box(RL, 0.05, 0.05), 'metal', '#C9CCD0', s0 + sw / 2, (CH - 0.1) / 2 + 0.9, bz + 1.25, 0, { rz: ang }); P(R2_box(RL, 0.75, 0.04), 'glass', '#DCEAF0', s0 + sw / 2, (CH - 0.1) / 2 + 0.5, bz + 1.25, 0, { rz: ang });
    for (let k = 0; k < 4; k++) P(R2_box(0.04, 0.9, 0.04), 'metal', '#C9CCD0', s0 + 0.2 + k * sw / 4, (0.2 + k * sw / 4) * Math.tan(ang) + 0.45, bz + 1.25);
    P(R2_pln(0.8, 0.4), 'sign', '#ffffff', s0 - 0.5, 2.25, bz + 0.012, 0, { rect: R2_ATLAS.wayout });
    for (let k = 0; k < 2; k++) { const u = 0.45 + k * 0.7; P(R2_box(0.55, 1.6, 0.4), 'metal', '#3A4150', u, 0.8, bz + 0.22); P(R2_pln(0.4, 0.4), 'sign', '#ffffff', u, 1.15, bz + 0.425, 0, { rect: R2_ATLAS.ticket });
      P(R2_box(0.2, 0.04, 0.05), 'plastic', '#111', u, 0.75, bz + 0.43); P(R2_box(0.57, 0.12, 0.42), 'plastic', '#2459B8', u, 1.55, bz + 0.22); }
    const mu = 1.9; if (mu + 1.2 < s0) { R2_frame(P, ctx, mu + 0.6, 1.65, 1.1, 0.72, R2_ATLAS.map, '#2E3134'); bench(mu + 0.6); }
    board(Math.max(1.0, s0 - 1.0), -2.1);
    if (s0 > 3.4) R2_frame(P, ctx, s0 - 0.6, 1.6, 0.55, 0.75, R2_ATLAS.ad2, '#2E3134');
  }
}
function R2_tunnelAndTrain(group, ctx, B) {
  const y = ctx.y, X0 = ctx.buildingX0 - 30, X1 = ctx.buildingX1 + 30, S = R2_SUB, ry = y + S.railY;
  const put = (geo, mat, hex, x, yy, z, o = {}) => B.add(geo, mat, hex, R2_xf(x, yy, z, o.ry || 0, o.rx || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1), o);
  const Wt = X1 - X0, cx = (X0 + X1) / 2, z0 = S.trenchZ0, z1 = S.trenchZ1, zc = (z0 + z1) / 2, dz = z1 - z0;
  // trench: invert slab, ballast, sleepers, rails, third rail; platform edge wall with cable trays; lining + roof outside the building
  put(R2_box(Wt, 0.3, dz + 0.1), 'concrete', '#8F8B84', cx, ry - 0.3, zc);
  put(R2_box(Wt, 0.12, dz - 0.1), 'ballast', '#ffffff', cx, ry - 0.1, zc);
  const sleeper = R2_box(0.22, 0.08, dz - 0.25);
  for (let x = X0 + 0.3; x < X1; x += 0.65) put(sleeper, 'concrete', '#A8A39A', x, ry - 0.02, zc);
  for (const rz of [S.trainZ - 0.42, S.trainZ + 0.42]) { put(R2_box(Wt, 0.07, 0.05), 'metalNC', '#6E747C', cx, ry + 0.055, z0 + rz); put(R2_box(Wt, 0.012, 0.03), 'metalNC', '#D6D8DA', cx, ry + 0.094, z0 + rz); }
  put(R2_box(Wt, 0.06, 0.08), 'plasticNC', '#E8C21E', cx, ry + 0.1, z1 - 0.12);
  put(R2_pln(Wt, -S.railY), 'concrete', '#9A968F', cx, ry - S.railY / -2 + 0, z0 + 0.005);
  put(R2_box(Wt, 0.05, 0.25), 'metalNC', '#8E949A', cx, ry + 0.7, z0 + 0.13); for (let k = 0; k < 3; k++) put(R2_cylX(0.02, Wt, 6), 'plasticNC', '#2E3134', cx, ry + 0.75, z0 + 0.06 + k * 0.07);
  put(R2_box(Wt, 0.04, 0.12), 'plasticNC', '#E8E2D6', cx, y - 0.02, z0 + 0.06);                    // platform nosing
  for (const [a, b] of [[X0, ctx.buildingX0], [ctx.buildingX1, X1]]) {
    const w = b - a, c = (a + b) / 2, top = y + 1.15;
    put(R2_box(w, 0.32, dz + 0.1), 'concrete', '#8F8B84', c, top + 0.16, zc);                     // tunnel roof (cut)
    put(R2_box(w, 0.04, dz + 0.1), 'plasticNC', '#6B4A36', c, top + 0.05, zc, { sy: 0.5 });
    put(R2_pln(w, top - ry + 0.2), 'concrete', '#7E7A74', c, (top + ry - 0.2) / 2, z0 + 0.006);
    put(R2_box(w, 0.08, 0.32), 'concrete', '#8F8B84', c, ry + 0.95, z0 + 0.16); put(R2_cylX(0.012, w, 4), 'metalNC', '#C9CCD0', c, ry + 1.6, z0 + 0.25);
    for (let k = 0; k < 4; k++) put(R2_cylX(0.025, w, 6), 'plasticNC', ['#2E3134', '#3A3D42', '#2E3134', '#B8322A'][k], c, top - 0.3 - k * 0.07, z0 + 0.05);
    for (let x = a + 3.2; x < b; x += 9) { put(R2_box(0.16, 0.42, 0.1), 'plasticNC', '#1E1F21', x, ry + 2.15, z0 + 0.08); put(R2_sph(0.045, 8, 6), 'glow', '#FF3A2A', x, ry + 2.26, z0 + 0.13); put(R2_sph(0.045, 8, 6), 'glow', '#3AE06A', x, ry + 2.06, z0 + 0.13); }
    for (let x = a + 2; x < b; x += 4.5) { put(R2_box(0.4, 0.08, 0.06), 'metalNC', '#8E949A', x, top - 0.08, z0 + 0.06); put(R2_box(0.36, 0.04, 0.04), 'glow', '#FFF1D0', x, top - 0.12, z0 + 0.08); }
    for (let x = a + 0.8; x < b; x += 3.0) put(R2_box(0.06, top - ry, 0.08), 'concrete', '#8F8B84', x, (top + ry) / 2, z0 + 0.04);
  }
  // ---- train: nCars cars along x, doors as two meshes (left leaves / right leaves) that slide
  const T = new THREE.Group(), TB = new R2_Batch(), DL = new R2_Batch(), DR = new R2_Batch();
  const L = S.carL, D = S.trainD, H = 2.25, by = S.railY + 0.18, n = S.nCars, gap = 0.35, total = n * L + (n - 1) * gap;
  const tp = (Bt, geo, mat, hex, x, yy, z, o = {}) => Bt.add(geo, mat, hex, R2_xf(x, yy, z, o.ry || 0, o.rx || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1), o);
  const doorXs = [];
  for (let c = 0; c < n; c++) {
    const cx0 = -total / 2 + c * (L + gap) + L / 2, end = c === 0 ? -1 : c === n - 1 ? 1 : 0;
    tp(TB, R2_box(L, H - 0.35, D), 'carpaint', '#DDE1E4', cx0, by + 0.35 + (H - 0.35) / 2, 0);
    tp(TB, R2_box(L - 0.1, 0.3, D - 0.12), 'plastic', '#3A3D42', cx0, by + 0.2, 0);
    tp(TB, R2_box(L, 0.14, D + 0.01), 'plastic', '#3A4150', cx0, by + 0.62, 0); tp(TB, R2_box(L, 0.05, D + 0.012), 'plastic', '#F2C230', cx0, by + 0.72, 0);
    tp(TB, R2_box(L - 0.2, 0.12, D - 0.2), 'metal', '#B7BCC1', cx0, by + H + 0.06, 0);
    for (const ax of [-L / 2 + 1.0, L / 2 - 1.0]) { tp(TB, R2_box(1.5, 0.22, D - 0.3), 'plastic', '#2A2D31', cx0 + ax, by + 0.08, 0);
      for (const wx of [-0.45, 0.45]) for (const wz of [-0.42, 0.42]) { tp(TB, R2_cylZ(0.17, 0.08, 12), 'plastic', '#2A2A2A', cx0 + ax + wx, by + 0.0, wz); tp(TB, R2_cylZ(0.1, 0.09, 8), 'metal', '#8E949A', cx0 + ax + wx, by + 0.0, wz); } }
    tp(TB, R2_box(1.0, 0.18, 0.7), 'metal', '#9AA0A6', cx0 + (c % 2 ? 1.2 : -1.2), by + H + 0.2, 0);
    // windows band with lit interior behind
    const wy = by + 1.35;
    tp(TB, R2_box(L - 0.3, 0.75, D - 0.06), 'glow', '#F4EEDC', cx0, wy + 0.02, 0);
    const winXs = [-L / 2 + 0.55, -0.0, L / 2 - 0.55], doorsAt = [-L / 4 - 0.1, L / 4 + 0.1];
    for (const s of [-1, 1]) {
      const zf = s * (D / 2 + 0.006);
      for (const wx of winXs) tp(TB, R2_box(0.95, 0.62, 0.01), 'plastic', '#2A3440', cx0 + wx, wy, zf);
      for (const dx of doorsAt) { // door frame (dark gap) on the body, leaves on the door batches
        tp(TB, R2_box(1.3, 1.76, 0.012), 'glow', '#B8B09C', cx0 + dx, by + 0.38 + 0.9, zf * 0.995); tp(TB, R2_box(1.38, 1.82, 0.01), 'plastic', '#2A2D31', cx0 + dx, by + 0.38 + 0.91, zf * 0.99);
        tp(TB, R2_cyl(0.02, 0.02, 1.76, 6), 'metal', '#C9CCD0', cx0 + dx, by + 1.28, s * (D / 2 - 0.15));
        if (s === 1) doorXs.push(cx0 + dx);
        for (const [Bd, lx] of [[DL, -0.33], [DR, 0.33]]) {
          tp(Bd, R2_box(0.66, 1.76, 0.03), 'carpaint', '#CDD2D6', cx0 + dx + lx, by + 0.38 + 0.9, s * (D / 2 + 0.025));
          tp(Bd, R2_box(0.4, 0.62, 0.01), 'plastic', '#2A3440', cx0 + dx + lx, wy, s * (D / 2 + 0.042));
          tp(Bd, R2_box(0.66, 0.05, 0.012), 'plastic', '#F2C230', cx0 + dx + lx, by + 0.72, s * (D / 2 + 0.042));
        }
        tp(TB, R2_box(0.12, 0.04, 0.02), 'glow', '#5CFF8A', cx0 + dx, by + 2.12, zf * 1.01);
      }
    }
    if (end) {             // cab nose: sloped dark windscreen, headlights, destination display
      const ex = cx0 + end * (L / 2 + 0.08);
      tp(TB, R2_box(0.18, H - 0.3, D - 0.08), 'carpaint', '#DDE1E4', ex, by + 0.35 + (H - 0.35) / 2, 0);
      tp(TB, R2_box(0.06, 0.8, D - 0.3), 'plastic', '#1E262E', ex + end * 0.08, by + 1.4, 0, { rz: end * 0.18 });
      tp(TB, R2_box(0.04, 0.16, D * 0.6), 'glow', '#FFB838', ex + end * 0.1, by + 1.98, 0);
      for (const s of [-1, 1]) tp(TB, R2_cylX(0.07, 0.05, 10), 'glow', '#FFF8E0', ex + end * 0.11, by + 0.82, s * (D / 2 - 0.22));
      tp(TB, R2_box(0.1, 0.18, D - 0.1), 'plastic', '#E0342A', ex + end * 0.06, by + 0.45, 0, { sy: 0.6 });
    } else if (c < n - 1 || true) {}
    if (c < n - 1) tp(TB, R2_box(gap + 0.1, H - 0.6, D - 0.4), 'plastic', '#2A2D31', cx0 + L / 2 + gap / 2, by + 0.45 + (H - 0.6) / 2, 0);
    tp(TB, R2_box(0.6, 0.12, 0.012), 'sign', '#ffffff', cx0 - L / 2 + 0.5, by + 1.95, D / 2 + 0.008, { rect: [R2_ATLAS.roundel[0], R2_ATLAS.roundel[1] + 104, 256, 48] });
  }
  const body = TB.flush(T), dl = DL.flush(T), dr = DR.flush(T);
  T.position.set(0, y, S.trainZ); T.visible = false; group.add(T);
  const stopX = (ctx.buildingX0 + ctx.buildingX1) / 2, farR = X1 + total / 2 + 2, farL = X0 - total / 2 - 2;
  const st = { phase: 'idle', t: 0, open: 0 };
  const ARR = 6.0, OPEN = 0.8, DWELL = 4.0, DEP = 5.0;
  const handle = {
    train: T, doorXs: doorXs.map((x) => new THREE.Vector3(stopX + x, y, ctx.laneZ)),
    trainArrive() { if (st.phase === 'idle') { st.phase = 'arrive'; st.t = 0; T.visible = true; } return { doorsOpenIn: st.phase === 'arrive' ? ARR - st.t + OPEN : 0 }; },
    get trainState() { return st.phase; },
    update(t, dt) {
      if (st.phase === 'idle') return; st.t += dt;
      const ez = (k) => 1 - Math.pow(1 - k, 3), ei = (k) => k * k * k;
      if (st.phase === 'arrive') { const k = Math.min(1, st.t / ARR); T.position.x = farR + (stopX - farR) * ez(k); if (k >= 1) { st.phase = 'open'; st.t = 0; } }
      else if (st.phase === 'open') { st.open = Math.min(1, st.t / OPEN); if (st.t > OPEN + DWELL) { st.phase = 'close'; st.t = 0; } }
      else if (st.phase === 'close') { st.open = Math.max(0, 1 - st.t / OPEN); if (st.t > OPEN + 0.3) { st.phase = 'depart'; st.t = 0; } }
      else if (st.phase === 'depart') { const k = Math.min(1, st.t / DEP); T.position.x = stopX + (farL - stopX) * ei(k); if (k >= 1) { st.phase = 'idle'; T.visible = false; } }
      const o = st.open * 0.6; for (const m of dl) m.position.x = -o; for (const m of dr) m.position.x = o;
    },
  };
  return { handle, trainTris: TB.tris + DL.tris + DR.tris };
}

/* ======== rooms2: entry point ======== */
function R2_buildRoom(themeId, wing, ctx) {
  const group = new THREE.Group(), B = new R2_Batch();
  ctx = Object.assign({ slab: 0.3, laneZ: -0.8, backZ: -ctx.depth, frontZ: 0, doorX: null }, ctx); const Pc = R2_placer(B, ctx);
  let extra = {}, ticks = [];
  if (themeId === 'office') R2_office(Pc, ctx, wing);
  else if (themeId === 'hotel') R2_hotel(Pc, ctx, wing);
  else if (themeId === 'restaurant') extra = R2_restaurant(Pc, ctx, wing) || {};
  else if (themeId === 'parking') extra = R2_parking(Pc, ctx, wing) || {};
  else if (themeId === 'subway') R2_subwayPlatform(Pc, ctx, wing);
  let tt = null;
  if (themeId === 'subway' && wing === 'L') tt = R2_tunnelAndTrain(group, ctx, B);
  const nTrain = group.children.length, meshes = B.flush(group), h = { group, update: () => {}, meshes: meshes.length, tris: B.tris };
  if (extra.spawnPoints) h.spawnPoints = extra.spawnPoints;
  if (extra.steamAt) {                                       // kitchen steam: one merged puff mesh that rises and fades
    const sm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false });
    const puffs = [0, 1, 2].map((k) => { const m = new THREE.Mesh(R2_sph(0.09, 8, 6), sm.clone()); m.position.set(...extra.steamAt); group.add(m); return m; });
    ticks.push((t) => puffs.forEach((m, k) => { const p = ((t * 0.5 + k / 3) % 1); m.position.y = extra.steamAt[1] + p * 0.6; m.position.x = extra.steamAt[0] + Math.sin(t * 2 + k) * 0.05 * p; m.scale.setScalar(0.6 + p * 1.4); m.material.opacity = 0.35 * Math.sin(p * Math.PI); }));
  }
  if (themeId === 'subway') {
    const key = ctx.y.toFixed(2);
    if (tt) { R2_TRAINS[key] = tt.handle; h.trainTris = tt.trainTris; h.trainMeshes = 3; h.doorXs = tt.handle.doorXs; ticks.push((t, dt) => tt.handle.update(t, dt)); }
    h.trainArrive = () => R2_TRAINS[key]?.trainArrive();
  }
  h.update = (t, dt) => { for (const f of ticks) f(t, dt); };
  return h;
}

/* ======== rooms2: underground section ======== */
function R2_soilTex(depth) {
  return R2_canvas('soil' + depth, 512, 512, (g, w, h, r) => {
    // vertical axis = 0 (top, y = 0) .. depth (bottom). Layers: paving, sand, sub-base, topsoil, clay, sand+gravel, rock
    const Y = (m) => (m / depth) * h, layers = [[0, 0.09, '#B9B6AF'], [0.09, 0.15, '#D8C08A'], [0.15, 0.45, '#8E8A82'], [0.45, 1.3, '#5E4632'], [1.3, 2.6, '#8A6440'], [2.6, 4.2, '#B58E5E'], [4.2, 99, '#77736C']];
    for (const [a, b, c] of layers) { g.fillStyle = c; g.fillRect(0, Y(a), w, Y(Math.min(b, depth)) - Y(a) + 1); }
    for (let i = 0; i < 26000; i++) { const yy = r() * h, m = yy / h * depth; const v = r(); g.fillStyle = m < 0.15 ? `rgba(0,0,0,${v * 0.08})` : `rgba(${v < 0.5 ? '20,12,6' : '255,240,210'},${0.06 + r() * 0.1})`; g.fillRect(r() * w, yy, 1.5, 1.5); }
    // pebbles in the sub-base and gravel layer, stones in the clay, cracks in the rock
    for (let i = 0; i < 260; i++) { const m = [0.2 + r() * 0.22, 2.7 + r() * 1.4, 1.4 + r() * 1.1][i % 3], v = 120 + r() * 80; g.fillStyle = `rgb(${v | 0},${(v * 0.95) | 0},${(v * 0.88) | 0})`; g.beginPath(); g.ellipse(r() * w, Y(m), 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { const v = 100 + r() * 70; g.fillStyle = `rgb(${v | 0},${v | 0},${(v * 0.95) | 0})`; g.beginPath(); g.ellipse(r() * w, Y(4.4 + r() * (depth - 4.4)), 10 + r() * 16, 6 + r() * 9, r() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(40,36,32,0.5)'; g.lineWidth = 1.2; for (let i = 0; i < 30; i++) { let x = r() * w, yy = Y(4.3 + r() * (depth - 4.3)); g.beginPath(); g.moveTo(x, yy); for (let k = 0; k < 5; k++) { x += r() * 18 - 6; yy += r() * 10 - 3; g.lineTo(x, yy); } g.stroke(); }
    for (const m of [0.09, 0.15, 0.45, 1.3, 2.6, 4.2]) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < w; x += 2) g.fillRect(x, Y(m) + Math.sin(x * 0.05) * 2 - 1, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.45)'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 1.5, Y(0.09));     // paving joints
  });
}
function R2_buildUnderground(ctx) {
  ctx = Object.assign({ floorH: 3, slab: 0.3, frontZ: 0, depth: 4.5, subwayY: null, treeXs: null }, ctx);
  const group = new THREE.Group(), B = new R2_Batch(), FH = ctx.floorH, nB = ctx.nBasement, bottom = -nB * FH - 2, depth = -bottom;
  const X0 = ctx.buildingX0 - 30, X1 = ctx.buildingX1 + 30, bx0 = ctx.buildingX0, bx1 = ctx.buildingX1, fz = ctx.frontZ, r = ctx.rng;
  const put = (geo, mat, hex, x, y, z, o = {}) => B.add(geo, mat, hex, R2_xf(x, y, z, o.ry || 0, o.rx || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1), o);
  // soil face: a local-uv material per depth (the texture spans 0 .. bottom vertically, repeats every 8 m sideways)
  const soilM = new THREE.MeshStandardMaterial({ map: R2_soilTex(depth), bumpMap: R2_soilTex(depth), bumpScale: 2, roughness: 0.97, envMapIntensity: 0.35 });
  const faces = [];
  const face = (a, b, y0, y1) => { if (b - a < 0.01 || y1 - y0 < 0.01) return; const g = new THREE.PlaneGeometry(b - a, y1 - y0); g.translate((a + b) / 2, (y0 + y1) / 2, fz);
    const P = g.attributes.position, UV = g.attributes.uv; for (let i = 0; i < P.count; i++) UV.setXY(i, P.getX(i) / 8, 1 + P.getY(i) / depth); faces.push(g); };
  const sub = ctx.subwayY, tb = sub != null ? [sub + R2_SUB.railY - 0.45, sub + 1.47] : null;
  for (const [a, b] of [[X0, bx0], [bx1, X1]]) { if (tb) { face(a, b, bottom, tb[0]); face(a, b, tb[1], 0); } else face(a, b, bottom, 0); }
  face(bx0, bx1, bottom, -nB * FH - ctx.slab - 0.6);                                   // under the raft
  const soil = new THREE.Mesh(mergeGeometries(faces), soilM); soil.receiveShadow = true; group.add(soil);
  // soil block behind the face so the sides never show through gaps (dark, plain)
  put(R2_box(X1 - X0, depth, 0.1), 'concrete', '#4A3A2C', (X0 + X1) / 2, bottom / 2, fz - ctx.depth - 1.5);
  // foundation: retaining walls at the building edges, raft under the lowest floor, piles below
  for (const x of [bx0, bx1]) { put(R2_box(0.45, depth - 1.4, 0.06), 'concrete', '#9A968F', x, (bottom + 1.4) / 2 - 0.7 + 0.7 - 0.0, fz + 0.03, { sy: 1 });
    put(R2_box(0.7, 0.5, 0.07), 'concrete', '#8F8B84', x, -nB * FH - ctx.slab - 0.35, fz + 0.035); }
  put(R2_box(bx1 - bx0 + 0.7, 0.6, 0.06), 'concrete', '#8F8B84', (bx0 + bx1) / 2, -nB * FH - ctx.slab - 0.3, fz + 0.03);
  for (let x = bx0 + 0.6; x < bx1; x += 2.6) put(R2_box(0.4, 1.0, 0.05), 'concrete', '#9A968F', x, -nB * FH - ctx.slab - 1.1, fz + 0.025);
  for (let x = bx0 + 0.8; x < bx1 - 0.3; x += 0.5) put(R2_cylZ(0.02, 0.07, 6), 'plasticNC', '#6B4A36', x, -nB * FH - ctx.slab - 0.3, fz + 0.06);
  // utilities: water main (blue), gas (yellow), cable duct bank (cut ends), district heating pair, all crossing the section
  const pipeEnd = (x, y, rr, col, inner = '#2A2A2A') => { put(R2_cylZ(rr, 0.12, 16), 'plastic', col, x, y, fz + 0.06); put(R2_cylZ(rr * 0.8, 0.125, 16), 'plasticNC', inner, x, y, fz + 0.062); };
  const pipeRun = (y, rr, col, a = X0, b = X1) => { put(R2_cylX(rr, b - a, 12), 'plastic', col, (a + b) / 2, y, fz - rr * 0.35, { cast: false }); };
  pipeRun(-0.95, 0.11, '#3E6E9E', X0, bx0 - 0.3); pipeRun(-0.95, 0.11, '#3E6E9E', bx1 + 0.3, X1);
  pipeRun(-0.7, 0.06, '#E8C21E', X0, bx0 - 0.3); pipeRun(-0.7, 0.06, '#E8C21E', bx1 + 0.3, X1);
  for (const cx of [bx0 - 4.5, bx1 + 6]) { put(R2_box(1.0, 0.55, 0.1), 'concrete', '#A39F98', cx, -0.75, fz + 0.04);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pipeEnd(cx - 0.3 + i * 0.3, -0.62 - j * 0.25, 0.09, ['#E8843A', '#3BA55C', '#E8843A'][i]); }
  for (const cx of [bx1 + 2.6]) { pipeEnd(cx, -1.55, 0.2, '#D8D4CC', '#B58E5E'); pipeEnd(cx + 0.5, -1.55, 0.2, '#D8D4CC', '#B58E5E'); put(R2_cylZ(0.13, 0.13, 12), 'metalNC', '#8E949A', cx, -1.55, fz + 0.07); put(R2_cylZ(0.13, 0.13, 12), 'metalNC', '#8E949A', cx + 0.5, -1.55, fz + 0.07); }
  // service connection into the building (water) and cables
  put(R2_cylX(0.05, 3.0, 8), 'plastic', '#3E6E9E', bx0 - 1.5, -1.25, fz - 0.01); put(R2_cylX(0.03, 3.0, 6), 'plastic', '#2E3134', bx1 + 1.5, -0.4, fz - 0.005);
  // sewer: big concrete pipe end with brown water inside, manhole shaft up to the street with rungs
  const swX = bx0 - 7.5, swY = -2.4, swR = 0.6;
  put(R2_cylZ(swR + 0.12, 0.14, 20), 'concrete', '#A8A39A', swX, swY, fz + 0.07); put(R2_cylZ(swR, 0.15, 20), 'plasticNC', '#2A2622', swX, swY, fz + 0.075);
  const waterG = new THREE.CircleGeometry(swR - 0.02, 20, Math.PI * 1.15, Math.PI * 0.7); const water = new THREE.Mesh(waterG, new THREE.MeshStandardMaterial({ color: '#6B5A3A', roughness: 0.15, metalness: 0.2, emissive: '#2A2214', emissiveIntensity: 0.3 }));
  water.position.set(swX, swY, fz + 0.16); group.add(water);
  put(R2_box(0.9, -swY - swR + 0.05, 0.1), 'concrete', '#9A6A4A', swX, (swY + swR) / 2, fz + 0.05); put(R2_box(0.62, -swY - swR + 0.05, 0.11), 'plasticNC', '#2A2622', swX, (swY + swR) / 2, fz + 0.055);
  for (let yy = swY + swR + 0.2; yy < -0.15; yy += 0.3) put(R2_box(0.36, 0.03, 0.04), 'metalNC', '#8E949A', swX, yy, fz + 0.12);
  put(R2_cyl(0.38, 0.38, 0.05, 18), 'metalNC', '#4C5157', swX, -0.025, fz - 0.3);
  put(R2_box(0.95, 0.05, 0.12), 'metalNC', '#4C5157', swX, -0.03, fz + 0.06);
  // drainage gully pipe sloping down into the sewer from the kerb
  put(R2_cylX(0.06, 3.2, 8), 'plastic', '#B5673F', swX + 1.9, -1.2, fz - 0.01, { rz: 0.42 });
  // tree roots under the street trees
  const trees = ctx.treeXs || [bx0 - 2.2, bx1 + 2.4, bx0 - 13, bx1 + 13];
  for (const tx of trees) { if (tx < X0 + 1 || tx > X1 - 1) continue;
    const rr = R2_prng(R2_hash('root' + tx.toFixed(1)));
    put(R2_cyl(0.13, 0.18, 0.5, 8), 'wood', '#6B4A33', tx, -0.25, fz - 0.05);
    const grow = (x, y, a, len, th, d) => { if (d > 3 || th < 0.012) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      put(R2_cyl(th * 0.7, th, len, 6), 'wood', '#7A5638', (x + x2) / 2, (y + y2) / 2, fz - 0.02, { rz: a - Math.PI / 2 });
      const n = d < 1 ? 3 : 2; for (let k = 0; k < n; k++) grow(x2, y2, a + (rr() - 0.5) * 1.1, len * (0.55 + rr() * 0.2), th * 0.6, d + 1); };
    for (let k = 0; k < 5; k++) grow(tx, -0.45, -Math.PI / 2 + (k - 2) * 0.45 + (rr() - 0.5) * 0.2, 0.55 + rr() * 0.3, 0.07, 0);
  }
  // cut edge of the pavement: kerb stones on top and a slim slab lip
  put(R2_box(X1 - X0, 0.05, 0.08), 'concrete', '#C9C6BF', (X0 + X1) / 2, -0.025, fz + 0.04, {});
  // little life: two earthworms and a mole tunnel (kids)
  const wormM = new THREE.MeshStandardMaterial({ color: '#C97A6A', roughness: 0.6 }), worms = [];
  const wormG = mergeGeometries([0, 1, 2, 3, 4, 5, 6].map((k) => R2_sph(0.05 - Math.abs(k - 3) * 0.004, 8, 6).clone().translate(k * 0.07, Math.sin(k * 1.1) * 0.03, 0)));
  for (const [wx, wy] of [[bx1 + 4.2, -1.0], [bx0 - 3.2, -1.8]]) { const g = new THREE.Mesh(wormG, wormM); g.position.set(wx, wy, fz + 0.06); group.add(g); worms.push(g); }
  put(R2_cylX(0.16, 2.2, 10), 'plasticNC', '#3A2A1E', bx1 + 9, -1.9, fz - 0.1, { cast: false }); put(R2_cylZ(0.16, 0.05, 12), 'plasticNC', '#2A1E14', bx1 + 10.1, -1.9, fz + 0.01);
  const meshes = B.flush(group);
  const handle = { group, meshes: meshes.length + 2 + worms.length, tris: B.tris,
    update(t) { water.material.emissiveIntensity = 0.3 + 0.08 * Math.sin(t * 3); worms.forEach((g, i) => { g.scale.x = 1 + 0.15 * Math.sin(t * 2 + i); g.rotation.z = 0.15 * Math.sin(t * 0.7 + i * 2); }); } };
  return handle;
}
