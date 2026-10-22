/* ---- harness body: every level's building (all room occupants, staff, swimmers, the toilets' cleaner) ---- */
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 25) console.log('  FAIL', m); } };
const scene = new THREE.Scene();
artBlobPools(scene); artFigPools(scene);
artRenderer = { capabilities: { isWebGL2: true } };
const effVis = (o) => { let v = true; while (o) { if (!o.visible) v = false; if (o.isScene) return v; o = o.parent; } return false; };
const lv = process.env.FIG_LEVELS ? process.env.FIG_LEVELS.split(',').map(Number) : LEVELS.map((_, i) => i);
for (const i of lv) {
  const L = computeLayout(LEVELS[i]);
  FLOOR_THEMES.length = 0; FLOOR_THEMES.push(...L.themes);
  for (const t of Object.values(THEME_LIB)) if (FLOOR_THEMES.length < 8 && !FLOOR_THEMES.includes(t)) FLOOR_THEMES.push(t);
  const b = buildBuilding(scene, L); artSetTime(LEVELS[i].time || 'day');
  let t = 0; for (let k = 0; k < 90; k++) { t += 0.37; animateArt(t, 0.37); }   // long steps: scripts, fades, the cleaner
  scene.updateMatrixWorld(true);
  let n = 0, bad = 0, unpooled = 0, legacyDraws = 0;
  const D = ART_FIG.data;
  for (const f of ART_FIG.figs) f.group.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh) return;
    if (!m.material.userData.fig) { if (effVis(m)) unpooled++; return; }
    if (effVis(m)) legacyDraws++;
    const s = m.userData.figSlot; if (!s) { if (effVis(f.group)) bad++; return; }
    n++;
    const o = s.slot * 16, kind = m.material.userData.fig, a = kind === 'face' || m.material.transparent ? m.material.opacity : 1;
    if (!effVis(m) || a < 0.004) { if (!D.slice(o, o + 16).every((v) => v === 0)) bad++; return; }
    const pa = m.geometry.attributes.position, A = s.P.geo.attributes, v = new THREE.Vector3();
    for (let q = 0; q < pa.count; q += 11) {
      v.fromBufferAttribute(pa, q).applyMatrix4(m.matrixWorld);
      const j = (s.v0 + q) * 3, p = [A.position.array[j], A.position.array[j + 1], A.position.array[j + 2]];
      const w = [0, 1, 2].map((r) => D[o + r * 4] * p[0] + D[o + r * 4 + 1] * p[1] + D[o + r * 4 + 2] * p[2] + D[o + r * 4 + 3]);
      if (Math.abs(w[0] - v.x) + Math.abs(w[1] - v.y) + Math.abs(w[2] - v.z) > 1e-4) bad++;
    }
  });
  ok(bad === 0, `level ${i + 1}: ${bad} bad parts`);
  console.log(`level ${i + 1}: ${ART_FIG.figs.size} figures, ${n} parts pooled, ${legacyDraws} visible figure meshes (old draws), ${unpooled} other visible meshes under figures, stats ${JSON.stringify(window.__figStats)}`);
  b.dispose();
  ok(ART_FIG.figs.size === 0 || [...ART_FIG.figs].every((f) => !f.group.parent || !effVis(f.group)), `level ${i + 1}: figures left after dispose ${ART_FIG.figs.size}`);
}
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks passed`);
