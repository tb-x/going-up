// Node check of the zoned lifts (levels 15-18): pure routing and layout functions taken straight from index.html.
// Run: node handoff/zonetest.mjs   (no browser; exits 1 on a failure)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('section not found: ' + a); return src.slice(i, j); };
const tuning = cut('/* ======== tuning ======== */', '/* ======== levels & themes data ======== */');
const data = cut('/* ======== levels & themes data ======== */', '/* ======== art ======== */');
const artObj = src.match(/const ART = \{[\s\S]*?\n\};/)[0];
const logic = cut('/* ======== zones & routes ======== */', '/* ======== renderer & camera ======== */');
const env = `const location = { search: '' }; let G = { layout: null }; const clamp = (v, a, b) => Math.max(a, Math.min(b, v));\n`;
const api = new Function(env + tuning + data + artObj + '\n' + logic + `
  return { LEVELS, THEME_LIB, LEVEL_TIMES, ART, computeLayout, zoneServes, routeCosts, routeHop, routeCars, planRoute, zoneLabel, zoneColors,
    queueSlotX, routeCostTo, carServes, setLayout: (L) => { G.layout = L; }, ROUTE_LEG, EXPRESS_COLOR, QUEUE_SLOTS_ZONED };`)();
const { LEVELS, THEME_LIB, LEVEL_TIMES, ART, computeLayout, routeCosts, routeHop, routeCars, planRoute, zoneLabel, ROUTE_LEG, EXPRESS_COLOR } = api;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const lab = (L, f) => +L.labels[f], idx = (L, label) => L.labels.indexOf(String(label));

// ---- 1. the 14 old levels are untouched: every lift stops everywhere, same shafts and seats as before
LEVELS.slice(0, 14).forEach((lv, i) => {
  const L = computeLayout(lv), n = `L${i + 1}`;
  ok(!L.zoned, n + ' not zoned');
  ok(L.serves.every((row) => row.length === L.nFloors && row.every(Boolean)), n + ' every car serves every floor');
  ok(L.shaftX.every((x, s) => Math.abs(x - (L.coreX0 + (s + 0.5) * ART.SHAFT_W)) < 1e-9), n + ' shafts as before');
  ok(Math.abs(L.width - (8 + lv.cars * ART.SHAFT_W + 7)) < 1e-9, n + ' width as before');
  ok(L.carCap.every((c) => c === lv.cap), n + ' seats as before');
  ok(L.queueSlots === 5 && L.zoneLabel.every((z) => z === '') && L.zoneColor.every((z) => z === null), n + ' queues / signs as before');
  for (let o = 0; o < L.nFloors; o++) for (let d = 0; d < L.nFloors; d++) if (o !== d) {
    const r = planRoute(L.serves, o, d); if (!r || r.length !== 2) { ok(false, `${n} ${o}->${d} direct, got ${JSON.stringify(r)}`); continue; }
    if (routeCars(L.serves, o, d).length !== lv.cars) ok(false, `${n} ${o}->${d}: every car is useful`);
    for (let s = 0; s < lv.cars; s++) if (routeHop(L.serves, s, o, d) !== d) ok(false, `${n} car ${s} ${o}->${d} goes straight there`);
  }
});
eq(LEVEL_TIMES.length, LEVELS.length, 'a time of day per level');

// ---- 2. the tall towers
const want = [{ up: 12, cars: 3 }, { up: 14, cars: 3 }, { up: 16, cars: 4 }, { up: 20, cars: 4 }];
LEVELS.slice(14).forEach((lv, k) => {
  const i = 14 + k, n = `L${i + 1}`, L = computeLayout(lv);
  ok(L.zoned, n + ' zoned');
  eq(L.nFloors - L.nBasement - 1, want[k].up, n + ' floors above the lobby');
  eq(L.nShafts, want[k].cars, n + ' lifts');
  ok(lv.floors.every((id) => THEME_LIB[id]), n + ' every theme exists');
  eq(new Set(lv.floors).size, lv.floors.length, n + ' no floor theme twice');
  for (const id of Object.keys(lv.wings || {})) ok(lv.floors.includes(id), `${n} wing swap ${id} is a floor of the level`);
  ok(lv.zones.length === lv.cars && lv.zones.every((z) => z.every((label) => idx(L, label) >= 0)), n + ' zones name real floors');
  for (let f = 0; f < L.nFloors; f++) ok(L.serves.some((row) => row[f]), `${n} floor ${L.labels[f]} has a lift`);
  ok(L.serves.every((row) => row.filter(Boolean).length >= 2), n + ' each lift stops at 2+ floors');
  // the express: wide, bigger, skips floors, gold; it stops at the lobby
  const ex = L.serves.map((row, s) => s).filter((s) => !/–/.test(L.zoneLabel[s]));
  eq(ex.length, 1, n + ' one express');
  const e = ex[0];
  ok(L.wide[e] && L.shaftW[e] > ART.SHAFT_W && L.carCap[e] > Math.max(...L.carCap.filter((_, s) => s !== e)), n + ' express is wider and has more seats');
  ok(L.carCap[e] <= 8, n + ' express fits the 8-place car');
  ok(L.serves[e][L.groundIndex], n + ' express stops at the lobby');
  eq(L.zoneColor[e], EXPRESS_COLOR, n + ' express is gold');
  eq(new Set(L.zoneColor).size, L.nShafts, n + ' zone colours differ');
  // sky lobbies: where zones meet (3+ lifts stop there)
  lv.floors.forEach((id, f) => { if (THEME_LIB[id].kind === 'sky') ok(L.serves.filter((row) => row[f]).length >= 3, `${n} sky lobby ${L.labels[f]} is where zones meet`); });
  // every trip can be made, with at most 3 rides; some need changes
  let maxLegs = 0, changes = 0, pairs = 0;
  for (let o = 0; o < L.nFloors; o++) {
    for (let d = 0; d < L.nFloors; d++) {
      if (o === d) continue; pairs++;
      const r = planRoute(L.serves, o, d);
      if (!r) { ok(false, `${n} ${L.labels[o]}->${L.labels[d]} reachable`); continue; }
      maxLegs = Math.max(maxLegs, r.length - 1); if (r.length > 2) changes++;
      // every leg is a ride on a car that stops at both ends
      for (let q = 0; q + 1 < r.length; q++) if (!L.serves.some((row) => row[r[q]] && row[r[q + 1]])) ok(false, `${n} leg ${r[q]}->${r[q + 1]} has a car`);
      // whichever useful car someone takes, they end up at d at the best cost, never stopping at a floor that car skips
      const cost = routeCosts(L.serves, d);
      const walk = (f, spent, depth) => {
        if (f === d) { if (Math.abs(spent - cost[o]) > 1e-6) ok(false, `${n} ${o}->${d} cost ${spent} vs best ${cost[o]}`); return; }
        if (depth > 4) { ok(false, `${n} ${o}->${d} loops`); return; }
        const cars = routeCars(L.serves, f, d, cost);
        if (!cars.length) { ok(false, `${n} ${o}->${d} stuck at ${f}`); return; }
        for (const s of cars) { const h = routeHop(L.serves, s, f, d, cost);
          if (h < 0 || h === f || !L.serves[s][h] || !L.serves[s][f]) { ok(false, `${n} car ${s} ${f}->${h} bad hop`); continue; }
          walk(h, spent + ROUTE_LEG + Math.abs(h - f), depth + 1); }
      };
      walk(o, 0, 0);
    }
  }
  ok(maxLegs <= 3, `${n} at most 3 rides (got ${maxLegs})`);
  ok(changes > 0, n + ' some trips change lifts');
  console.log(`${n}: ${L.nFloors} floors (${L.nBasement} below), lifts ${L.zoneLabel.join(' | ')}, seats ${L.carCap.join('/')}, ` +
    `${changes}/${pairs} trips change lifts, most rides ${maxLegs}, every ${lv.every}s, patience ${lv.patience}s, target ${lv.target}, ${lv.time}`);
  // queue places stay on the lane inside the wing rooms
  api.setLayout(L);
  for (const side of [0, 1]) for (let q = 0; q < api.QUEUE_SLOTS_ZONED + 2; q++) { const x = api.queueSlotX(side, q); ok(x > L.roomL[0] + 0.3 && x < L.roomR[1] - 0.3, `${n} queue place ${side}/${q} in the wing (${x.toFixed(2)})`); }
  ok(api.routeCostTo(L.groundIndex) === api.routeCostTo(L.groundIndex), n + ' route costs cached');
  ok(api.carServes(e, L.groundIndex) && !api.carServes(e, L.groundIndex + 1), n + ' carServes');
});

// ---- 3. a few trips by hand (level 15: low -1..6, express 0·6·12, high 6..12)
{
  const L = computeLayout(LEVELS[14]), F = (label) => idx(L, label), R = (a, b) => (planRoute(L.serves, F(a), F(b)) || []).map((f) => lab(L, f));
  eq(L.zoneLabel, ['-1–6', '0·6·12', '6–12'], 'L15 lift signs');
  eq(R(0, 12), [0, 12], 'L15 lobby to the top: express');
  eq(R(0, 9), [0, 6, 9], 'L15 lobby to 9: change at the sky lobby');
  eq(R(3, 10), [3, 6, 10], 'L15 3 to 10: change at 6');
  eq(R(12, 0), [12, 0], 'L15 top to the lobby: express');
  eq(R(9, -1), [9, 6, -1], 'L15 9 to the car park: change at 6');
  eq(R(2, 5), [2, 5], 'L15 2 to 5: low lift straight there');
  eq(routeCars(L.serves, F(0), F(9)).sort(), [0, 1], 'L15 lobby to 9: low or express, not high');
  eq(routeCars(L.serves, F(0), F(12)), [1], 'L15 lobby to 12: only the express');
  eq(lab(L, routeHop(L.serves, 1, F(0), F(9))), 6, 'L15 express from the lobby to 9 drops off at 6');
  eq(routeHop(L.serves, 2, F(0), F(9)), -1, 'L15 the high lift is no use at the lobby');
  eq(routeCars(L.serves, F(6), F(12)).sort(), [1, 2], 'L15 6 to 12: express or high');
}
{
  const L = computeLayout(LEVELS[17]), F = (label) => idx(L, label), R = (a, b) => (planRoute(L.serves, F(a), F(b)) || []).map((f) => lab(L, f));
  eq(R(0, 20), [0, 14, 20], 'L18 lobby to the top: express then the high lift');
  eq(R(0, 10), [0, 7, 10], 'L18 lobby to 10: change at 7');
  eq(R(-3, 20).length, 4, 'L18 subway to the top: three rides');
  eq(R(20, 1), [20, 14, 7, 1], 'L18 20 to 1: three rides, the shortest way down (high, mid, low)');
}

// ---- 4. floor colours stay apart within each tall level (CIE76 delta E)
const labC = (hex) => { const n = parseInt(hex.slice(1), 16); let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  let X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); X = f(X); Y = f(Y); Z = f(Z); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
LEVELS.slice(14).forEach((lv, k) => {
  let min = Infinity, pair = '';
  for (let a = 0; a < lv.floors.length; a++) for (let b = a + 1; b < lv.floors.length; b++) {
    const p = labC(THEME_LIB[lv.floors[a]].color), q = labC(THEME_LIB[lv.floors[b]].color), d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d < min) { min = d; pair = lv.floors[a] + '/' + lv.floors[b]; }
  }
  ok(min >= 20, `L${15 + k} floor colours apart (closest ${pair} ${min.toFixed(0)})`);
});
const colours = Object.values(THEME_LIB).map((t) => t.color.toUpperCase());
eq(new Set(colours).size, colours.length, 'every theme has its own colour');

console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
