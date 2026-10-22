
/* ---- harness body (runs inside the art scope) ---- */
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 25) console.log('  FAIL', m); } };
const scene = new THREE.Scene();
artBlobPools(scene); artFigPools(scene);
artRenderer = { capabilities: { isWebGL2: true } };
const room = new THREE.Group(); room.position.set(2, 3, 0); scene.add(room);
const car = new THREE.Group(); car.position.set(-1, 6, -2.4); scene.add(car);
const P = [];
for (const [k, sd, o] of [['adult', 1], ['adult', 2], ['kid', 3], ['grandma', 4], ['dogwalker', 5], ['courier', 6], ['adult', 7, { luggage: true }], ['adult', 8, { look: 'dress', luggage: true }]]) {
  const h = buildPerson(k, sd, o || null); scene.add(h.group); h.group.position.set(sd * 0.8, 0, -0.8); h.group.rotation.y = sd * 0.4; P.push(h);
}
car.add(P[1].group); P[1].group.position.set(0.3, 0, 0.2);
P[0].setAnim('walk', 0.37); P[2].setAnim('cheer', 0.2); P[3].setAnim('idle', 3.3); P[5].setAnim('stomp', 0.5);
P[3].setMood(3, 1); P[4].setOpacity(0.5); P[6].setOpacity(0.001);
for (let t = 0; t < 40; t += 0.7) P[7].setAnim('idle', t);           // gestures: phone / book props get made
const occ = [artOccupant(room, 'adult', 11, null, 'type', 0, 0, -3, 0.2), artOccupant(room, 'adult', 12, null, 'recept', 1, 0, -3, 0),
  artOccupant(room, 'kid', 13, { look: 'casual' }, 'swim', 2, 0, -3, 0), artOccupant(room, 'adult', 14, { lookAt: { x: 0, z: 0 } }, 'guard', 3, 0, -3, 0),
  artDiner(room, 'adult', 15, { look: 'dress' }, 4, 0, -3, 0.5, null)];
const waiter = artWaiter(room, 16, 0, [{ a: 'walk', x: 1, z: -2 }, { a: 'order', d: 2 }, { a: 'walk', x: 0, z: -2, tray: 1 }, { a: 'pick', d: 2 }], 0, -2, []);
for (const tk of occ) tk(1.3); waiter(2.5);
const figMeshes = () => { const out = []; for (const f of ART_FIG.figs) f.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material.userData.fig) out.push([f, o]); }); return out; };
const effVis = (o) => { let v = true; while (o) { if (!o.visible) v = false; if (o.isScene) return v; o = o.parent; } return false; };
let D = null;
function verify(label) {
  scene.updateMatrixWorld(true); D = ART_FIG.data;
  let n = 0;
  for (const [f, m] of figMeshes()) {
    const s = m.userData.figSlot;
    if (legacy) { ok(!s && m.layers.mask === 1, label + ' legacy: mesh not pooled'); continue; }
    if (!s && !effVis(f.group)) { ok(m.layers.mask === 1, label + ' hidden, unclaimed figure draws normally if shown'); continue; }
    ok(s && m.layers.mask === 2 ** ART_FIG_LAYER, label + ' claimed + hidden layer ' + m.material.userData.fig + ' ' + m.geometry.attributes.position?.count + ' ' + (m.parent && m.parent.type) + ' inScene ' + effVis(m));
    if (!s) continue; n++;
    const g = m.geometry, pa = g.attributes.position, A = s.P.geo.attributes, o = s.slot * 16, vis = effVis(m);
    const kind = m.material.userData.fig, alpha = kind === 'face' || m.material.transparent ? m.material.opacity : 1;
    const shown = vis && alpha >= 0.004;
    if (!shown) { ok(D.slice(o, o + 16).every((v) => v === 0), label + ' hidden slot zero'); continue; }
    ok(Math.abs(D[o + 15] - alpha) < 1e-6, label + ' alpha');
    if (kind === 'face') ok(D[o + 12] === artFaceCell(...(m.material.map.userData.figCell != null ? [m.material.map.userData.figCell % 4, m.material.map.userData.figCell >= 4] : [0, false])), label + ' face cell');
    else ok(Math.abs(D[o + 12] - m.material.color.r) < 1e-6 && Math.abs(D[o + 13] - m.material.color.g) < 1e-6, label + ' tint');
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i += 7) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
      const j = (s.v0 + i) * 3, p = [A.position.array[j], A.position.array[j + 1], A.position.array[j + 2]];
      ok(A.aSlot.array[s.v0 + i] === s.slot, label + ' slot attr');
      const w = [0, 1, 2].map((r) => D[o + r * 4] * p[0] + D[o + r * 4 + 1] * p[1] + D[o + r * 4 + 2] * p[2] + D[o + r * 4 + 3]);
      ok(Math.abs(w[0] - v.x) + Math.abs(w[1] - v.y) + Math.abs(w[2] - v.z) < 1e-4, `${label} vertex ${i} of ${m.parent?.type}: ${w.map((q) => q.toFixed(3))} vs ${v.toArray().map((q) => q.toFixed(3))}`);
    }
    const idx = s.P.geo.index.array, ix = g.index;
    for (let k = 0; k < s.ni; k += 5) ok(idx[s.i0 + k] === (ix ? ix.getX(k) : k) + s.v0, label + ' index');
    ok(s.i0 + s.ni <= s.P.geo.drawRange.count, label + ' inside draw range');
  }
  return n;
}
artFigSync(); let n = verify('first');
console.log(legacy ? 'legacy' : 'pooled', 'stats', JSON.stringify(window.__figStats), 'parts', n);
if (!legacy) {
  const stats = window.__figStats; ok(stats.figures === ART_FIG.figs.size && stats.pools >= 4 && stats.pools <= 7, 'stats sane');
  ok(ART_FIG.pools.body.fading > 0, 'a fading figure turns on the transparent pass');
  ok(ART_FIG.pools.body.meshes[1].visible, 'fading mesh visible');
  // animate, hide, re-parent, merge a fork in, dispose
  P[0].setAnim('run', 1.1); P[4].setOpacity(1); P[2].group.visible = false; scene.add(P[1].group); P[5].group.removeFromParent();
  const arm = P[3]._p.arms[1].children.find((o) => o.isMesh); const oldSlot = arm.userData.figSlot;
  artMergeInto(arm, [[artBox(0.02, 0.1, 0.02), '#ff0000', 0, -0.5, 0]], P[3]._p.owned);
  artFigSync(); verify('second');
  ok(arm.userData.figSlot && arm.userData.figSlot !== oldSlot && !oldSlot.P.parts.has(oldSlot), 're-claimed after the geometry changed');
  ok(!ART_FIG.pools.body.meshes[1].visible || ART_FIG.pools.body.fading > 0, 'fading pass off when nothing fades');
  const usedBefore = ART_FIG.slots.used; P[7].dispose(); artFigSync(); verify('dispose');
  ok(ART_FIG.slots.used < usedBefore, 'dispose frees slots');
  // a frozen occupant: the meshes it took out of the rig are never pooled
  ok(figMeshes().every(([f, m]) => m.parent), 'no orphans');
  // churn: lots of people come and go -> compaction, then everything checks out again
  const churn = [];
  for (let k = 0; k < 400; k++) { const h = buildPerson(['adult', 'kid', 'grandma'][k % 3], 100 + k); scene.add(h.group); h.group.position.x = k * 0.1; churn.push(h); if (k % 20 === 19) artFigSync(); }
  artFigSync(); const top0 = ART_FIG.pools.body.ia.top;
  for (let k = 0; k < churn.length; k++) if (k % 5) churn[k].dispose();
  artFigSync(); verify('churn');
  console.log('body pool index top', top0, '->', ART_FIG.pools.body.ia.top, 'used', ART_FIG.pools.body.ia.used, 'cap', ART_FIG.pools.body.icap);
  ok(ART_FIG.pools.body.ia.top <= ART_FIG.pools.body.ia.used * 2 + 49152, 'compacted');
  for (const h of [...P, ...churn]) h.dispose(); for (const f of [...ART_FIG.figs]) artFigRemove(f);
  artFigSync();
  ok(ART_FIG.slots.used === 0 && Object.values(ART_FIG.pools).every((p) => p.ia.top === 0 && p.va.top === 0), 'all freed');
  console.log('final', JSON.stringify(window.__figStats));
} else ok(n === 0, 'legacy: nothing pooled');
// per-figure draw estimate (legacy): meshes that would draw
let legacyDraws = 0; for (const [, m] of (legacy ? figMeshes() : [])) legacyDraws++;
if (legacy) console.log('legacy meshes per figure ~', (legacyDraws / ART_FIG.figs.size).toFixed(1));
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks passed`);
