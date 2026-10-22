# Contract notes from the coder (no new API functions)

- `ART` and `FLOOR_THEMES` are defined INSIDE the art chunk (between the `art` and `layout` banners), exactly as
  the contract code block shows. Game code does not define them, so art.js must define both (FLOOR_THEMES order/ids/
  colours/icons per BRIEF "Lead decisions").
- Game code uses only: ART.{FLOOR_H, SHAFT_W, ROOM_W, LANE_Z, CAR_Z, MAX_CAP, BUBBLE_SIZE}, FLOOR_THEMES[i].color,
  buildSky(scene).update(t), buildLights(scene, renderer).fit(layout), buildBuilding(scene, layout) ->
  {floors[i].setStairDoor/setRoomDoor/setGlow, shafts[s].setCarY, dispose}, buildCar(s, cap) ->
  {group, riderSpots, setDoors, setLoad, flashFull, setTarget, setMoving, dispose},
  buildPerson(kind, seed) -> {group, setMood, setAnim, setBubble, setBubbleScale, setOpacity, dispose}, animateArt(t, dt).
- Call frequency: setAnim(name, t) every rendered frame per person; setMood(stage, m01) every sim step (60-240/s),
  keep it cheap (no allocations); setOpacity only when alpha changes; setDoors every frame; setTarget/setMoving only on change.
- Riders are parented to car.group at riderSpots[k] (k < capacity; dog walker uses the first of its 2 spots), rotation.y = 0.
- Coder scales bubbles with setBubbleScale(k), k in 0.8..1.8 (aims at ~44 px on screen).
- Person dispose() is called while the person may be parented to a car group or the scene: remove from parent inside.

## SPEC2 (coder, 2026-10-21)
- `computeLayout(level)` takes a LEVELS entry (`level.floors` = theme ids bottom -> top, `level.cars`); the old
  `computeLayout(nFloors, nShafts)` call still works. New fields as in SPEC2.md, plus `ids` (theme ids),
  `bottomY` (= -nBasement*FLOOR_H), `topY` (= top of the top floor), `streetX` (lobby arrivals appear/leave here,
  left edge of the ground floor). `height` keeps its old meaning (nFloors*FLOOR_H, the total span).
- Game reads optional `ART.WING_L` / `WING_R` / `STAIR_W` (falls back to 8.0 / 7.0 / 1.4).
- `FLOOR_THEMES` is rewritten in place per level and PADDED to at least 8 entries with unused themes (so `% 8`
  lookups in older art don't crash). Use `layout.themes[i]` / `layout.labels[i]` for the level's real floors.
- Optional floor hooks the game calls if present: `floors[i].trainArrive?.()` (subway, ~1.4 s before people step out,
  every 20-30 s) and `floors[i].carArrive?.(x)` (parking: a person appears at world x on the lane).
- People appear at x = streetX (lobby), roomDoorXs[0|1] (upper floors; `setRoomDoor` still only animates the left
  door at `roomDoorX`), or anywhere in roomL/roomR on basement floors; they leave the same ways.

# Art notes (graphics designer, SPEC2 + realism pass)
- Optional floor-handle hooks from the art (check before use): `floors[i].trainArrive()` (subway floor: train pulls in,
  opens, leaves; returns `{ doorsOpenIn }` seconds), `floors[i].trainDoorXs` (Vector3 lane points by the train doors),
  `floors[i].spawnPoints` (parking: where people step out of parked cars, from rooms2).
- `floors[i].setRoomDoor(o)` opens both wing doors; basements have no room doors.
- Headless checks: with `?tick`/`?demo`, `<html data-art="calls=N tris=M">` holds renderer.info of the last frame.
- Room doors: rooms2 keeps a 1.3 m clear strip in front of each door, so a door close to the core can push out the hotel
  right-wing bed (door at coreX1 + 2.2); `roomDoorXs[1]` near the middle/right of the wing works best.

## SPEC3 (coder, 2026-10-21): how the game uses the life hooks
- Parking used only if the parking floor handle has `bays` (non-empty) + `carIn` + `carOut`; `carDoor`, `setParked`
  optional. Return values of carIn/come/doors/go are seconds (non-numbers fall back to 3 / 4 / 1 / 4 s).
- Train used only if the subway floor handle has `train.come/doors/go` and a non-empty `train.doorXs`; `platformXs`
  optional (falls back to doorXs). Game sequence: come() -> wait -> doors(true) -> wait -> 2-6 s open -> doors(false)
  -> wait -> go() -> wait -> 20-30 s gap (8 s when someone is on the platform). Without it: old trainArrive?.() flow.
- Street used only if `building.street` has finite leftX, rightX, entranceX, walkZ. Walkers on the pavement are drawn
  at the lobby floor's y (0), z = walkZ.
- `artSetTime(mode)` is called as `typeof artSetTime === 'function'` right after buildBuilding in setupLevel
  (so also for the map backdrop), mode = LEVELS[i].time.
- Test counters: `__game.G.debugLife` = { carIn, carOut, carBoard, carAlight, trains, trainAlight, trainBoard,
  streetIn, streetOut }; the ?tick/?demo data-dbg also shows `hooks=PTS` (which hooks were found).

# SPEC3 art hooks as built (graphics designer)
- Parking floor handle: `bays` (left to right, 3 in the left wing + 1 in the right wing = 4), `carIn(bay, seed)` -> s,
  `carOut(bay)` -> seconds until the car has backed out of the bay (it then drives off up the ramp and is removed),
  `carDoor(bay, o)`, `setParked(bay, seed|null)`. Deviation: cars enter/leave through the ramp in the right wing, which
  runs into the side wall at street level (the underground part is hidden behind the soil face); they do not drive along
  the visible road first.
- Subway floor handle: `train = { come(), doors(open), go(), doorXs }` (doorXs is a getter of x numbers), `platformXs`
  (kept clear of the lift queue). `trainArrive()` still exists and just calls `come()`; the train never leaves by itself.
- Building handle: `street = { y: 0, walkZ: 1.1, leftX: x0 - 34, rightX: x1 + 34, entranceX: x0 - wall - 0.6 }`; the lobby
  entrance is an opening in the left side wall at z -1.65..-0.15, so walk from (entranceX, walkZ) to (x0 + 0.3, LANE_Z).
- On levels with basements the road in front of the tower is not drawn (the section is cut open so the basements show);
  the near pavement (walkZ) stays. Traffic and the bus hide while crossing that stretch.
- `artSetTime('day' | 'dusk' | 'night')` is a top-level function in the art section; call it after buildBuilding.

## Numbering + door paths (coder, 2026-10-21)
- `layout.labels[i]` = String(i - nBasement): lobby '0', above '1', '2'…, below '-1', '-2'. No more '' labels:
  basement bubbles/badges now show their number (art: please draw '-1' / '-2' legibly, minus sign included).
- People now walk lane -> door point and fade there (and the reverse when arriving):
  room door (roomDoorXs[w], z = -DEPTH + 0.4), stair door (stairX, z = -2.6; door drawn at z -2.95),
  parking (bay.doorX, z = -2.3, between parked cars), train (train.doorXs[k], z = -0.15, platform edge; train at z 0.88),
  lobby entrance (street.entranceX at laneZ -0.8, inside the entrance opening z -1.65..-0.15, then out to walkZ).
- Art may override each door depth with a number on the floor handle: `roomDoorZ`, `stairDoorZ`, `carDoorZ`, `trainEdgeZ`.
  Requests: (1) keep x = bay.doorX clear of columns from the lane to z -2.3; (2) confirm the ground in front of the
  left wall (x = entranceX, z -0.8 .. walkZ) is walkable pavement/plaza; (3) `setRoomDoor` opens both wings' doors
  at once (fine), a per-wing `setRoomDoor(o, wing)` would be nicer.

## Two queues (coder, 2026-10-22)
- `layout.queueXR[k] = coreX1 + 0.7 + k*0.75` (k = 0..4): a second queue on the right of the lift core. People join
  the side they are standing on when they reach the lane. Needs x coreX1 .. coreX1+4 at LANE_Z (z -1.25 .. 0) free of
  props on every floor (the rooms2 contract already keeps z >= laneZ-0.45 free). The game no longer uses subway
  `platformXs` that fall inside either queue (x within coreX0-3.9 .. coreX1+3.9); art: please put platform spots
  outside that range (today's filter in buildBuilding only avoids the left queue).

## Building variety: variants, wing swaps, homes, toilets, two garages (coder + art, 2026-10-22)
- `THEME_LIB` entries have `kind` and `v` (set for every theme: `kind` defaults to the id, `v` to 0). Variants
  `home2`/`home3` (kind home, v 1/2), `office2`, `hotel2` (v 1) and `parking2` (kind parking, v 1, the -2 garage) have
  their own id, colour and icon, so every cache keyed by theme id + label (signs, bubbles, plaques, atlas) stays
  separate. Game rules use the kind: `NIGHT_WEIGHTS` (destinations, now with a `day` entry) and the new
  `ORIGIN_WEIGHTS` (where trips between floors start) are keyed by kind; `upper(not, asOrigin)`; `downDest(from)` sends
  people leaving a home floor by day to a basement `HOME_TO_BASEMENT` of the time. Lunch rush, parking, subway and
  train lookups still use the base ids (`restaurant`/`cafe`, `parking`, `subway`), which stay unique per level.
- Art: `artBuildFloor` draws a floor by `th.kind` and passes `variant`, `accent` (the floor colour), `parkLower`
  and `spotX` to the rooms2 ctx; the rng seed includes the variant. New rooms2 kind `home` (left wing living room,
  right wing kitchen-diner or, for v1, a kids' bedroom; v2 mirrored with a cat), `office` v1 swaps its wings' layouts,
  `hotel` v1 has its own palette. Positions shared by furniture and occupants come from `R2_homePlan`, `R2_toiletPlan`,
  `R2_playPlan`, `R2_deskUs`.
- `LEVELS[i].wings = { <theme id>: { L|R: room } }` swaps a wing's room (copied to `layout.wings`): `toilets`
  (right wing of a lobby, office or restaurant floor), `bikes` / `laundry` (parking2, left wing), `playground`
  (garden, right wing). The floor keeps its theme, colour and number.
- Room spots: rooms have no back-wall doors. Every rooms2 wing keeps the old 1.3 m strip clear at
  `spotX = layout.roomDoorXs[wing]` (`R2_doorClear` uses `doorX ?? spotX`) and pushes `{ x, z: -2.3, wing }` onto the
  floor handle's `roomSpots`, which the game's `roomSpotX` uses. Classic (artWing) rooms add none (their refurbishing is
  someone else's).
- Classic rooms (artWing: lobby, cafe, play, pool, library, garden, stars) use the same spot: x = `layout.roomDoorXs[wing]`
  (left wing rx0 + 2.2, right wing rx0 + 0.55 W), z -2.3. Kept clear: 0.9 m wide (spot ± 0.45) from the lane to z -2.75
  (only flat rugs/mats inside), and nothing stands at z > -1.75. artWing can't reach `hooks`, so it pushes
  `{ wing, x, z: -2.3 }` onto the floor group's `userData.roomSpots`; artBuildFloor should copy it onto the handle, e.g.
  after the wing loop: `if (fg.userData.roomSpots) (hooks.roomSpots = hooks.roomSpots || []).push(...fg.userData.roomSpots);`
  Props: each theme has its own layout per wing in artThemeProps (u = metres from rx0 at default widths 6.6 / 7.0),
  merged into the structure batch (no sun shadow, blob contact shadows); radiators only under windows nothing stands in
  front of; plant leaves stay inside [rx0 + 0.9, rx1 - 0.9].
- Toilets animate themselves: a builder may return `{ tick(t, dt) }` from rooms2 and add its own meshes to
  `ctx.group` (R2_buildRoom pushes the tick into the room's update). Occupants: `artOccupant(...)` now returns its tick
  with the person handle on `tick.h` (for fading / moving), and has a `wash` pose. Animated-part materials live in
  `R2_MAT` under `tl_*` keys so `artSetTime` dims them.
- Two garages (`parking2` directly under `parking`): the street ramp, the side-wall opening and `artRampOf` belong to
  `parking` (-1) only. The right wing holds a split-level ramp (`ART_PARK.in2`, `R2_parkInner`): -1 keeps one bay over
  the landing and its floor/slab is open over flight A (z < -2.75, u 1.6..4.1 from coreX1; kerbs and railings); -2 has
  flight A, the landing (1.5 above -2), flight B and one bay at the far end. Ramp slabs and sloped walls are extruded
  polygons (`R2_poly` / `R2_para`), ends cut vertically. -2's parking life gets `inner = { yU, x0, wall }` and drives its
  cars street -> -1 -> S-curve -> flight A -> landing U-turn -> flight B -> bay, and back out the same way (small cars,
  scale <= 0.68, so they clear the -1 slab over the landing). Bays may carry their own `doorX`.
- Game: `parkH(f)` takes a floor (default -1); `G.bays` lists `{ f, k, car, reserved, coming }` over every garage
  floor with drivable bays; `parkArrival(d)` picks a free bay on either floor; departures from a garage floor go back to
  a car on that floor. Without car hooks, garage arrivals appear in a wing (`basementStart`, `LOWER_PARK_SHARE`).
- Level map: `#levels` uses `--rows2` (2 columns, portrait) and `--rows3` (3 columns, wide screens) set by `renderMap`,
  and per button `--r2/--c2/--r3/--c3` (level 1 bottom left).
- Seats (art -> game, optional; game falls back to ROOM_SPOT_Z / ROOM_LINGER without them). Floors with seated or working
  occupants (diners, office workers, hotel2 guest, home sofa / kitchen / desk) get on their handle:
  `takeSeat(wing?, hold?)` -> `{ id, x, z, face, rise, kind, seed, look, opts, wing }` or null: the occupant fades out;
  the person appears at (x, z) (`rise`: right at the seat, play the `rise` anim there; else a stand point in front of the
  furniture), facing `face`, built with `buildPerson(kind, seed, opts)` to look the same. `hold` keeps the seat for that
  person (toilet trip): freeSeat skips it. `freeSeat(wing?)` -> `{ id, x, z, face, sit, wing }` or null, reserves the seat;
  walk lane -> (x, laneZ) -> (x, z), turn to `face`, play `sit` if `sit`, call `fillSeat(id)` and fade out (the
  occupant fades back in, 0.35 s). `fillSeat(id)` also frees a held seat. Hidden occupants are invisible, never removed.
  Paths from the lane straight back to (x, z) are clear of tall furniture.
- `buildPerson`: anims `rise` / `sit` (0.5 s, from / to a seated crouch with hips at ART_SEAT_HIP 0.44); `opts.luggage`
  (small suitcase in the free hand), `opts.bare` (no hand items). Seated occupants (type / read / sit poses, diners):
  hips at 0.44, thighs level, shins to the floor (`artSitLegs`).
- Toilets: the toilets floor handle has `occupyToilet(sec)` (a free cubicle closes for sec seconds) and `toiletWing`.
  Game: `looFloor()` / `looSpot()`; a trip is `p.trip = { home, loo, wing, seatId, x, z, face, sit, back }`; the way home
  is a new spawn from the toilets' spot (`spawnPerson(..., extra = { seed, opts, trip })`), retried every 4 s.
- Hotel reception (levels with a hotel floor, `artHotelLobby`): the lobby handle has `reception = { x, z }` (the guest's
  spot at the desk, reached along the back-door line street.entranceX) and `checkIn()` (the receptionist holds out a key
  for 2.6 s). Street arrivals for a hotel floor carry luggage, walk entrance -> (entranceX, z) -> (x, z), stand
  CHECKIN_TIME s (state `checkin`), then back to entranceX and the lane.
- Toilets (replaces occupyToilet): the toilets floor handle has `toiletVisit({ x, z, kid, stay, speed })` -> a visit `v`
  (call `v.update(dt)` each sim step, copy `v.x, v.z, v.rot, v.anim` ('walk' | 'idle' | 'wash' | 'dry'), hide the person
  while `v.hidden` (only behind a shut cubicle door), `v.done` = back on the CLZ line (-1.95) at the spot), `toiletLife`
  { visits, inNow, done } and `toiletWing`. Cubicles are busy only from visits. Game: state 'loo' (startLoo / looDone),
  riders on a loo trip carry on home as the same person; ambient visitors (spawnLooVisitor, LOO_EVERY) come from the
  floor's other wing and go back there; G.debugLife.looIn / looOut. The cleaner fades in and out only at the core-side
  end of the room (behind the core's divider wall line), cart kept on the room side of her, inside the room.
- Restaurant flow (dining wing + kitchen wing on one floor, ctx.otherRoom): `ART_REST` per floor; `R2_kitchenPlan(ctx)`
  (range, fridge, pass, board, sink + dish rack) shared by R2_restaurant and the cook; a plate pool (2 instanced meshes)
  moves rack -> cook -> pass -> tray -> table -> tray -> pass -> sink -> rack; tables: idle -> call -> ordering -> cooking
  -> ready -> delivering -> eating -> empty -> clearing -> idle, frozen while a diner's seat is taken. The floor handle has
  `restaurantLife` { ordersTaken, mealsServed, platesWashed } (summed into G.debugLife). Without a kitchen wing the old
  scripted waiter / chef run. R2 draws no table or pass plates when the flow runs.
- Pool: `artSwimmer` (lane pool, front crawl lengths, splash puffs, wake ring), `artPaddler` (pose 'splash'), the lifeguard's
  `opts.lookAt` ({ x, z }: an occupant whose head stays separate and turns to follow it now and then).

## Hotel floors rebuilt (art, 2026-10-22)
- `hotel` (v0): left wing a guest room, right wing the hotel's reception + lounge. `hotel2` (v1): left wing a breakfast
  room, right wing a suite. Every position (furniture, occupants, the housekeeper's cart round, the waiter, seats) comes
  from the pure `R2_hotelPlan(ctx, wing)` (u = metres from the wing's x0), which also lists prop footprints in `obs`
  ([u0, u1, z0, z1, tag]) for path checks. All hotel props go through `R2_noCast` (no sun shadow) with `R2_blob`
  contact shadows (new R2 material `blob`). No corridor and no stray suitcases any more.
- Floor handle (hotel v0): `frontDesk = { x, z, face }` (the guest's spot at the counter, straight in from the lane)
  and `checkIn()` (that floor's receptionist holds out a key for 2.6 s; per-floor via the occupant's `opts.keyRef`, the
  lobby's reception still uses the global `artKeyAt`). Game: `planDeparture` sends everyone delivered to a floor with
  `frontDesk` to the desk first (lane -> (x, laneZ) -> (x, z)), they stand `CHECKIN_TIME` s facing `face` (`p.desk`,
  checkIn() once, `G.debugLife.hotelDesk`), then go on along their normal path to a free seat or the room spot.
- Seats: v0 the unpacking guest (standing, at the luggage rack in the back of the clear strip, stand point 0.3 m in
  front), the lounge sofa reader (stand point in front of the coffee table) and the armchair reader (in place);
  v1 the three breakfast diners (in place, `artDiner` + `artSeatAdd`) and the suite's sofa reader. The suite's
  reader in bed is not a seat.
- Housekeeper: `artHotelMaid` runs `H.maid` (replaces artHotelMaidL/R): cart along z -1.55 in front of the bed (clear
  of the lane strip z > -1.25), towels, the duvet (guest room only), a bedside table wiped, vacuuming along z -2.1;
  she never enters the 1.3 m clear strip. The waiter is `artWaiter` with `H.waiter` (pick at the coffee station,
  along z -1.91 in front of the tables). A node check of all of this (maid + cart, waiter, seat and desk paths, strip,
  lane, prop overlaps) is `node handoff/hotelcheck.mjs`; it extracts R2_doorClear / R2_segs / R2_hotelPlan
  from index.html.

## Critters (ambient animator, 2026-10-22)
- `/* ======== art: critters ======== */` (before `art: time of day`): no game API. `artMole(parent, owned, o)` -> tick,
  called by buildBuilding in the underground block (soil x0-T-16 .. x0-T-9.6, under the grass left of the paved apron;
  `minY` = subway tunnel top or section bottom). `artStreetLife(group, owned, { traffic, strollers, lampXs, LZ })` ->
  `{ update(t, dt) }`, built and updated by buildSky. Roof perches: buildBuilding sets the global
  `artRoofPerch = { x0, x1, rail, ledge, id }` after the roof and clears it in dispose; the crows re-spread on a new id.
- Draw calls (extra): mole 4 (body, paws, instanced tunnel trail, molehill), cat 3-4 (+1 eyes at dusk/night), dog 3 +
  lead 1, birds 2-3 (instanced bodies, heads, wings only while one flies), squirrel 2, blobs 1 (instanced): ~16 by day.
  The dog's owner replaced the old `dogwalker` stroller, which saves that figure's 2 dog meshes.
- Strollers changed: the far pavement now has one lane by the kerb (z -11.3, all +x at 1.05 m/s, 110/3 m apart, so
  they never meet; each stroller keeps `x` for the cat) and the dog walker's inner lane (owner -11.84, dog -11.72).
- The cat (lane z -6.1, between the people's strip -5.6 and the street furniture) uses the zebra at x 7.6 only. It
  waits at the kerb until `crossClear()` (traffic outside 14 m in the first lane / 30 m in the second, no ramp car busy
  or on the road within 16 m, no stroller or dog walker within 7.5 m) and is an `artGuests` obstacle while on the road,
  so traffic stops for it; garage cars keep their paths, so it dashes if one comes near. Stone window ledges
  (0.95 x 0.3 m at y 1.1..1.16) were added on the plinth of the stone block at x 23.6 (windows x 21.8, 24.8).
- Tuning: `ART_MOLE` (size, speed, trail length/life, molehill trip interval), `ART_CAT` (lane, crossing, bench, bins,
  ledges), `ART_DOG` (speed, lead, lanes, sniff trees), `ART_SQ` (tree, size). Birds: 3 crows (roof), pigeons on the
  lamps at -14 / -27 and 14.5 / 27.5 (they only fly within one side, never across the tower). At night birds roost
  still and the squirrel sleeps in the crown; the cat's eyes glow (dusk half, night full).

## Tall towers and zoned lifts (coder + art, 2026-10-22)
- Levels 15-18 (12, 14, 16, 20 floors above the lobby). `LEVELS[i]` may carry, one entry per car left to right:
  `zones` (the floor LABELS the car stops at: lobby 0, basements -1, -2...; `span(a, b)` = a..b), `caps` (seats per car,
  else `cap`) and `wide` (true: the bigger express car in a wider shaft). No `zones` = every car stops everywhere; levels
  1-14 have none and play exactly as before (`node handoff/simtest.mjs <old index.html>` compares them seed by seed).
- Pure routing, section `/* ======== zones & routes ======== */` (node-tested by `handoff/zonetest.mjs`):
  `zoneServes(zones, labels, nCars)` -> `serves[s][f]`; `routeCosts(serves, dest)` (ROUTE_LEG per ride + 1 per floor,
  fewest rides first); `routeHop(serves, s, from, dest)` -> where car s should drop someone (-1: car s isn't on a best
  route); `routeCars(serves, from, dest)` -> the useful cars; `planRoute` -> [from, change..., dest]; `zoneLabel`
  ('0–6', '0·6·12'); `zoneColors` (locals green/blue/purple/orange from the lowest zone up, express gold).
- `computeLayout` adds: `shaftW[s]` (ART.SHAFT_W or ART.SHAFT_W_WIDE 3.0; `shaftX` are the centres, coreX1 = coreX0 +
  sum), `zoned`, `serves`, `carCap[s]`, `wide[s]`, `zoneLabel[s]`, `zoneColor[s]` (null unzoned), `queueSlots` (8 zoned,
  else 5; `queueX`/`queueXR` stay 5 long for the art, the game uses `queueSlotX(side, k)`), `labels`, `routeCost` (cache).
- Game: a person's `p.dest` is always the final floor (bubble, delivered, departure). On joining a queue `planHops`
  sets `p.elig` (useful car indices; null unzoned) and the side of the lifts nearest them; boarding only if
  `canBoard(p, c)`, which sets `p.hop` (where they get out). Cars stop for riders' `hopOf(p)`. Off at a hop that isn't
  the destination: `G.debugLife.transfers++`, waited -= TRANSFER_RELIEF * patience, back to 'arriving' and a new queue
  (bubble kept). `tap()` on a floor the car doesn't serve: `car.art.nope()`, sfx 'nope', `G.debugLife.refused++`,
  returns false (handleTap then draws no ripple). `nearestCar` only picks cars that stop there. `suggestMove` (hint +
  ?demo bot) has a zoned branch: the most impatient person no useful car is coming for -> the nearest free useful car.
  Cars start on the lobby or the served floor nearest to it.
- Art API: `buildCar(s, cap, { wide, zoneLabel, zoneColor })` (opts optional): wide = ART.CAR_W_WIDE 2.6 m, 1.4 m doors,
  8 riderSpots (normal car 6; `ART.MAX_CAP` is now 8 = the most of any car); a zone strip in the zone colour above the
  capacity sign (`artCapTex(..., zl, zc)`, sign bottom unchanged); handle `nope()` = 0.45 s sideways shake.
  `buildBuilding` reads `layout.shaftW / wide / zoned / serves / zoneColor` (global `artZones`): shaft back walls, rails,
  dividers and beams per shaft width; a zone stripe up the back of each shaft and on both landing jambs on every floor;
  on floors a car doesn't serve, no sill but a 1.05 m block parapet (zone band, red "no stop" disc) with glass above
  (car stays visible passing by).
- New themes: `sky` / `sky2` (kind `sky`, weight 0.5 as a destination or origin via `th.weight` in `upper()`): classic
  artWing room with tall glass (like the lobby): left wing a coffee kiosk (counter, espresso, pastries, awning, menu),
  bistro table, bench, suitcase, plants, barista + traveller; right wing the floor map board (`mapBoard`: every floor's
  colour chip, one column per lift with a dot on each served floor, in zone colours), two benches, suitcases, plants,
  a kid reading the map + a grandma. More variants so colours stay apart in tall levels (closest pair dE >= 23):
  `office3` (lime), `office4` (olive), `home4` (wine), `home5` (pale lime), `home6` (forest), `home7` (mint),
  `hotel3` (royal blue). They reuse their kind's rooms2 builder with `variant` (home: v % 3 layout, office/hotel: v>0).
- Draw calls: on buildings with more than 12 floors every other floor above the lobby keeps one occupant per wing
  (`artThinNow`; receptionists, maids, kitchen/dining staff and swimmers stay). The floor sign atlas is drawn smaller
  when 272 px x floors would pass 4096 px (`artSignAtlas`, same uvs), so 24 floors still fit a phone's texture limit.
- Level map: 18 buttons, 3 columns x 6 rows portrait, 4 x 5 wide screens (`--cols2/--cols3` from renderMap; 2 x 7 /
  3 x 5 while there are 14 or fewer). NUMBER_WORDS go to 'Twenty!'.
- Tuning by bot play (simtest, 6 seeds, average stairs): L14 2.2, L15 0.8, L16 2.0, L17 2.7, L18 3.8. A subway on a
  3-lift tower overloads its one low lift (L16 had 7 stairs per game with one), so L16 has two garages instead.

## Figure pools (rendering, 2026-10-22): every person drawn by ~4-6 shared draws
- Section `/* ======== art: figure pools ======== */` (just before `art: people`). No game API change: `buildPerson`,
  `artOccupant`, staff rigs, diners, swimmers, the cleaner and the street strollers keep their whole Object3D rig, and
  their meshes keep their geometry and material, but they're virtual: the first `artFigSync` that sees one copies its
  vertices into the pool for its material kind and moves it to layer `ART_FIG_LAYER` (31, the camera never draws it).
  Kinds by `material.userData.fig`: `body` (buildPerson's bodyMat: legs, torso, arms, dog, idle phone/book, merged
  occupant bodies), `head` (headMat), `face` (faceMat) and `prop` (`artPropMat()`: tray, plates, pad, ladle, pan,
  vacuum, cloth while they're under a figure). Props parented to the room (housekeeping cart, duvets, table food, flame,
  the cleaner's cart and mop), steam puffs and bubbles stay ordinary meshes.
- `artFigSync()` runs at the end of `animateArt` (after every tick): per registered figure it checks the figure is
  visible and in the scene, `updateWorldMatrix(true, true)`, then writes each part's `matrixWorld`, tint
  (`material.color`, so the head's red angry tint just works), opacity and face cell (`material.map.userData.figCell`)
  into a float texture (4 texels a slot, 256 slots a row). The pool shader (`artFigPatch`, onBeforeCompile on
  MeshStandardMaterial) moves each vertex by its slot (a rigid skin) with an exact inverse-transpose normal. Hidden,
  zero-opacity or detached parts collapse to a point; a geometry swapped by `artMergeInto` is re-copied; a mesh taken
  out of the rig is freed. Anything that poses a figure must do it before `animateArt` ends (all of today's code does).
- Fades: a part with opacity < 0.999 (setOpacity, seat fades, workers' `fade` steps, the cleaner) is skipped by the
  opaque pass and drawn by the pool's second, transparent pass (depthWrite on, like the old toggled materials), which
  only draws while something fades. Faces: one atlas `artFaceAtlas()` (4 moods x open/blink, `artFaceCell`), one
  transparent pass, renderOrder 1, polygon offset as before. Pools don't frustum-cull and don't cast or receive sun
  shadows (nor did people). Allocation: `ArtRange` (first-fit vertex / index / slot ranges), freed index ranges zeroed,
  `artPackParts` compacts a pool when less than half its index range is in use.
- `?legacyFigures`: the old per-mesh path (nothing is pooled; also the automatic fallback without WebGL2).
  `window.__figStats = { figures, pools (pool draws this frame), instances (slots in use), verts }`; `?artdbg` lists the
  pools as `fig:body`, `fig:body~` (fading pass) etc. instead of the virtual meshes.
- Tests: `node handoff/figtest.mjs` (pure parts: atlas cell mapping as the shader does it, allocator fuzz, compaction,
  slot rows). `node handoff/figrig.mjs <folder with three r160 files> [legacy] [building]` loads the real art code with
  three.js in Node (no WebGL) and checks that pool vertices + slot texture reproduce every virtual mesh's world vertices
  (people in all poses, occupants, a diner, a waiter, hide / re-parent / fork merge / dispose / 400-figure churn;
  `building`: every level's building after 90 animation steps). By that check the level-18 building has 73 occupant
  figures = 232 old draws, now 4 pool draws.
