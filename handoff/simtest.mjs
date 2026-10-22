// Node simulation of the game logic with the art stubbed out (no three.js, no browser): the ?demo bot plays each level
// for a while. Checks the tall towers get people to their floors by changing lifts, cars only stop where they serve,
// and (with a git checkout of the previous index.html as argument) that levels 1-14 play exactly as before.
// Run: node handoff/simtest.mjs [old-index.html]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('section not found: ' + a); return src.slice(i, j); };
  const zStart = src.includes('/* ======== zones & routes ======== */') ? '/* ======== zones & routes ======== */' : '/* ======== layout ======== */';
  const code = cut('/* ======== tuning ======== */', '/* ======== art ======== */') + src.match(/const ART = \{[\s\S]*?\n\};/)[0] + '\n'
    + cut(zStart, '/* ======== renderer & camera ======== */') + cut('/* ======== state ======== */', '/* ======== input ======== */')
    + cut('function suggestMove()', 'const handEl');
  const stubs = `
    const V = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this; }, clone() { return V().copy(this); } });
    const grp = () => ({ position: V(), rotation: { y: 0 }, children: [], add() {}, remove() {} });
    const scene = { add() {}, remove() {} }, lights = { fit() {} }, view = { camX: 0, camY: 0 }, FLOOR_THEMES = [], window = {};
    const T = { nopes: 0 };
    function buildBuilding(sc, L) { return { floors: L.floorY.map(() => ({ setStairDoor() {}, setRoomDoor() {}, setGlow() {} })), shafts: L.shaftX.map(() => ({ setCarY() {} })), street: null, dispose() {} }; }
    function buildCar(s, cap, o) { const n = o && o.wide ? 8 : 6; return { group: grp(), riderSpots: Array.from({ length: n }, (_, k) => V().set((k % 4) * 0.4 - 0.6, 0, k < 4 ? 0.3 : -0.5)),
      setDoors() {}, setLoad() {}, flashFull() {}, setTarget() {}, setMoving() {}, nope() { T.nopes++; }, dispose() {} }; }
    function buildPerson() { return { group: grp(), setMood() {}, setAnim() {}, setBubble() {}, setBubbleScale() {}, setOpacity() {}, dispose() {} }; }
    const fitCamera = () => {}, renderProgress = () => {}, updateStairs = () => {}, saveStars = () => {}, sfx = () => {}, speak = () => {}, showWinCard = () => {};
  `;
  return (search) => new Function('location', stubs + code + `
    return { G, LEVELS, setupLevel, simStep, tap, FIXED_DT, T, fy: (f) => G.layout.floorY[f] };`)({ search });
};

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const run = (mk, level, seed, secs) => {
  const g = mk(`?demo&seed=${seed}`), { G } = g;
  g.setupLevel(level); G.phase = 'play';
  const stops = [];                                   // every floor a car came to rest at with its doors opening
  const n = Math.round(secs / g.FIXED_DT);
  let wonAt = null;
  for (let i = 0; i < n; i++) {
    const before = G.cars.map((c) => c.doorState);
    g.simStep(g.FIXED_DT);
    G.cars.forEach((c, s) => { if (before[s] === 'closed' && c.doorState === 'opening') stops.push([s, Math.round(c.y / 3) + G.layout.nBasement]); });
    if (G.phase === 'won' && wonAt == null) wonAt = G.time;
  }
  return { G, g, stops, wonAt };
};

const mk = load(path.join(here, '..', 'index.html'));
// ---- the tall towers: the bot wins them, people change lifts, no car stops where it doesn't serve
for (const level of [14, 15, 16, 17]) for (const seed of [3, 11]) {
  const { G, g, stops, wonAt } = run(mk, level, seed, 900);
  const L = G.layout, n = `L${level + 1} seed ${seed}`;
  ok(L.zoned, n + ' zoned');
  ok(wonAt != null, `${n} won by the bot (delivered ${G.delivered}/${G.level.target}, stairs ${G.leftStairs})`);
  ok(G.debugLife.transfers > 0, n + ' people changed lifts');
  ok(stops.every(([s, f]) => L.serves[s][f]), n + ' cars only stop at floors they serve: ' + JSON.stringify(stops.filter(([s, f]) => !L.serves[s][f]).slice(0, 5)));
  for (const p of G.people) if (p.state === 'riding') ok(L.serves[p.carIdx][p.hop], `${n} rider ${p.id} gets out where the car stops`);
  // a tap on a floor the lift skips is refused: nothing moves
  const c = G.cars.find((cc) => cc.target == null && L.serves[cc.idx].some((on) => !on));
  if (c) {
    const f = L.serves[c.idx].indexOf(false), before = g.T.nopes; G.phase = 'play';
    ok(g.tap(c.idx, f) === false && c.target == null && c.queuedTarget == null && g.T.nopes === before + 1, n + ' refused tap');
  }
  console.log(`${n}: won at ${wonAt == null ? '-' : wonAt.toFixed(0) + ' s'}, delivered ${G.delivered}, stairs ${G.leftStairs}, transfers ${G.debugLife.transfers}, refused taps ${G.debugLife.refused}`);
}
// ---- levels 1-14 against the previous version: same seed, same result
const oldFile = process.argv[2];
if (oldFile) {
  const mkOld = load(oldFile);
  for (let level = 0; level < 14; level++) for (const seed of [5]) {
    const a = run(mk, level, seed, 400), b = run(mkOld, level, seed, 400);
    const sig = (r) => [r.G.delivered, r.G.leftStairs, r.wonAt == null ? null : +r.wonAt.toFixed(3), r.G.people.length, r.G.nextId, r.stops.length].join(',');
    ok(sig(a) === sig(b), `L${level + 1} plays as before: new ${sig(a)} old ${sig(b)}`);
    ok(a.G.debugLife.transfers === 0, `L${level + 1} no transfers`);
  }
  console.log('levels 1-14 compared with', path.basename(oldFile));
}
console.log(fails ? fails + ' failures' : 'all simulation checks passed');
process.exit(fails ? 1 : 0);
