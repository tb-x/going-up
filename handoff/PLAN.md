# PLAN: "Going Up!" (elevator game, `D:\tb-x\elevator\`, port 5224)

Single `index.html`, three.js 0.160.0 via importmap, everything built in code. Coder and graphics designer work in
parallel; **section 6 is the contract**. Coder writes a placeholder art section with exactly that API first.

## 1. Game design (age 5, zero instructions)

**Core loop.** A skyscraper cut open at the front. People walk out of a room door on a floor and queue by the lifts.
Over their head floats a **bubble**: the destination floor's colour + icon + big number (numbers are 1-based: lobby = 1).
A car arrives, doors open, riders for this floor step out and **celebrate** (jump, hearts, chirp), then waiting people
board in queue order until the car is full. Riders keep their bubbles inside the car, so the child sees "3 🏊" and taps
floor 3.

**Controls (one gesture).** Tap a floor anywhere in a **shaft column** -> that car goes to that floor. Tap a floor in
the **room area** (left of the shafts) -> the nearest car that isn't mid door-cycle goes there. Retargetable any time
(the car eases to a stop and turns round). Tapping during a door cycle queues the target; doors close, then it goes.
Vertical drag (> 10 px) pans the camera instead of tapping (only when the building is taller than the view).
**Helpers that make it forgiving:**
- A moving car **auto-stops** at any floor it passes where a rider wants to get out (riders out, waiting people board,
  then it carries on to its target). It does NOT auto-stop just for waiting people.
- An **idle car with closed doors** opens automatically when someone is waiting on its floor (and boards them).
- Capacity: a row of lamps on the car's top (one per seat, lit = taken). Full car: lamps flash, the next person in the
  queue shakes their head and stays (no penalty).

**Mood.** `m = waited / patience` (0..1). Stages: 0 happy (`m<0.35`), 1 ok (`<0.6`), 2 grumpy (`<0.8`), 3 angry
(`<1`: red face, steam puffs, foot tapping, grumble once on entry), 4 = leaves: stomps to the **staircase door** on
the left, door opens, gone (stomp sound, a small stairs icon appears in the HUD "left" tally). Inside a car patience
ticks at **0.3x** and the stage is capped at 2 (nobody ever leaves from a car). Delivering resets nothing; it just counts.

**Winning.** No game over, no timer. Level ends when `delivered >= target`. Stars: 3 if nobody took the stairs,
2 if <= 2 did, else 1. End card: big stars pop in one by one, confetti, fanfare, buttons ↻ replay, ▶ next,
🗺 map (icons only). Spoken "Hooray!" via speechSynthesis.

**Teaching.** Level 1: a pulsing hand (CSS/DOM, over the canvas) points at the cell (shaft column x floor row) of
`suggestMove()`. It shows whenever the player is idle for `HINT_DELAY` (L1: 2 s, later levels 8 s) and a move exists.
First rider of L1 boards automatically (idle car at lobby opens), so the first hand points at their floor.

**Level map.** A vertical tower of level buttons (1 bottom, 10 top), each showing its stars; next level unlocks on
any win. Opens at start (title "Going Up!" + big ▶ that starts the highest unlocked level).

**HUD** (DOM over canvas): home top-left (house icon, `../index.html`), progress top-centre (target little person
icons that fill green as people arrive; on short screens a bar with "7/10" in Verdana), stairs tally (🚶‍♂️ + number,
only shows once > 0), top-right: map 🗺 and mute 🔊/🔇. Off-screen arrows (see 4).

## 2. Levels (`LEVELS` array; times are seconds at normal speed)

| # | floors | cars | cap | arrive every | patience | target | special |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 1 | 4 | 7.0 | 45 | 5  | hint always, first arrival at lobby |
| 2 | 4 | 1 | 4 | 6.0 | 40 | 8  | - |
| 3 | 5 | 1 | 4 | 5.5 | 36 | 10 | grandma (walks 0.5x, patience 1.5x) |
| 4 | 5 | 2 | 4 | 5.0 | 34 | 12 | second lift |
| 5 | 6 | 2 | 4 | 4.5 | 32 | 14 | pizza courier (patience 0.6x, runs 1.4x) |
| 6 | 6 | 2 | 3 | 4.2 | 32 | 15 | dog walker (dog takes 2 seats) |
| 7 | 7 | 2 | 4 | 4.0 | 30 | 16 | morning rush: 5 at lobby at once every 45 s |
| 8 | 7 | 3 | 4 | 3.6 | 30 | 18 | third lift |
| 9 | 8 | 3 | 5 | 3.2 | 28 | 20 | lunch wave: 5 people to café every 50 s |
| 10| 8 | 3 | 5 | 3.0 | 26 | 24 | all specials, both waves |

Specials chance per arrival once unlocked: 12% each. Trip mix: 40% lobby -> random upper, 35% upper -> lobby, 25%
random upper -> other upper. A floor whose queue is full (`QUEUE_MAX`) gets no new arrivals. Arrival interval has
±30% jitter. Also cap total people alive at `MAX_PEOPLE = 30`.

## 3. Floor themes (`FLOOR_THEMES`, index = floor index, level with N floors uses 0..N-1)

| i | id | name | colour | icon | decor idea |
|---|---|---|---|---|---|
| 0 | lobby | Lobby | `#FFC928` yellow | 🛎️ | revolving door, plant pots, reception desk, glass front |
| 1 | cafe | Café | `#E8413A` red | ☕ | counter, cake stand, little round tables |
| 2 | library | Library | `#2F6FE0` blue | 📚 | bookshelves (merged), reading lamp, beanbag |
| 3 | play | Playroom | `#FF8A1F` orange | 🧸 | ball pit, slide, blocks |
| 4 | pool | Pool | `#19C2D6` cyan | 🏊 | water strip with animated ripples, ladder, duck |
| 5 | music | Music room | `#9A55E6` purple | 🎵 | piano, drum, music notes floating |
| 6 | garden | Greenhouse | `#35C24A` green | 🌻 | plant beds, swaying flowers, watering can |
| 7 | stars | Star dome | `#FF5FAE` pink | 🔭 | telescope, planets mobile, dark-blue wall with stars |

The top floor always gets the roof on top (art: rooftop with antenna, water tower, sign "GOING UP" is optional).
Wall tint of each floor = theme colour lightened ~70% so the bubble colour reads against it.

## 4. Layout and camera

- **View:** PerspectiveCamera, `fov 30`, looking at the building front (cut plane z = 0) with a small yaw (~6°, from
  the right) and slight top-down (~4°) so floor depth and shaft walls show. Camera distance is computed to fit
  `layout.width + 1` horizontally and `visibleFloors * FLOOR_H + 1` vertically (whichever is tighter).
- **Min floor height on screen:** `MIN_FLOOR_PX = 64`. `visibleFloors = min(nFloors, floor(availH / 64))`; if it is
  < nFloors, the camera pans vertically (drag, with inertia, clamped) and starts on the lowest floors.
- **Off-screen arrows:** when people wait on floors outside the view, a DOM arrow at the top/bottom edge shows the
  worst mood face (😀🙂😐😠) and pulses when angry; tap it to scroll there.
- **Phone portrait (390x844):** whole building fits (8 floors x 3 = 24 units, width <= 13 -> ~95 px a floor).
  HUD as a 56 px top bar.
- **Phone landscape (844x390):** height-limited, ~5 floors visible, pans. HUD moves to a slim **left column**
  (home, progress vertical, stairs tally) and **right column** (map, mute) so the building gets full height.
  Rule: if `innerWidth/innerHeight > 1.3` use side columns.
- **Tablet:** fits everything; same as portrait/landscape rules.
- Safe areas: HUD padded with `env(safe-area-inset-*)`; the fit computation subtracts the HUD and insets.
- **Hit-testing:** no mesh raycasting. Unproject the tap to a ray, intersect the plane `z = 0`, get world (x, y).
  `floor = floor(y / FLOOR_H)` (clamped, reject outside building ± 0.5 unit). If `|x - shaftX[s]| < SHAFT_W/2` ->
  car s; else if x is in the room area -> nearest car. A white ring flashes on the target cell (coder-owned DOM/mesh).
- `touch-action: none` on the canvas, `manipulation` on buttons. Home/HUD taps `stopPropagation`.

## 5. Tech architecture (`index.html`)

Head tags copied from blast-off (viewport-fit=cover, manifest, icons, apple meta, theme-color, Google Fonts
`Luckiest Guy` for titles with `crossorigin="anonymous"`; digits in Verdana). Importmap:
`"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"`,
`"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"`. sw.js registration `<script>` before
`</body>` as in choo-choo (copy `blast-off/sw.js`, `PREFIX = 'goingup-'`).

Module script sections (banner `/* ======== name ======== */`):
`imports` · `tuning` · `levels & themes data` · `art` (replaceable chunk) · `layout` · `renderer & camera` ·
`state` · `people` · `cars` · `simulation` · `input` · `hint & bot` · `hud & screens` · `sound` · `persistence` ·
`test hooks` · `main loop`.

**Tuning constants (top):** `FIXED_DT = 1/60`, `CAR_SPEED = 5.5` (units/s), `CAR_ACCEL = 9`, `DOOR_TIME = 0.45`,
`DWELL_MIN = 0.9`, `WALK_SPEED = 1.6`, `BOARD_TIME` (implicit by walking), `QUEUE_MAX = 5`, `MAX_PEOPLE = 30`,
`RIDE_PATIENCE_RATE = 0.3`, `MOOD_T = [0.35, 0.6, 0.8, 1.0]`, `HINT_DELAY_L1 = 2`, `HINT_DELAY = 8`,
`MIN_FLOOR_PX = 64`, `CELEBRATE_TIME = 1.2`, `FAST_MULT = 4` (`?fast`). All listed in README.

**State:** `G = { levelIdx, level, layout, time, delivered, leftStairs, spawnTimer, waveTimers, cars[], people[],
floors[], phase: 'map'|'play'|'won', lastInputTime }`.
Car: `{ idx, y, v, target|null, queuedTarget|null, door: 0..1, doorState: 'closed'|'opening'|'open'|'closing',
dwell, riders[], cap, art }`. "At floor f" = `|y - f*FLOOR_H| < 0.02` with v = 0.
Person: `{ id, kind, seed, floor, dest, x, z, state, waited, stage, seats (1 or 2), carIdx, queueSlot, art }`, states:
`arriving` (room door -> queue slot) · `waiting` · `boarding` (lane -> car shaftX -> seat) · `riding` (parented to the
car group) · `exiting` (seat -> lane, unparented from the car) · `celebrating` (CELEBRATE_TIME
in place, then walk to room door and vanish) · `leavingStairs` (stomp to stair door, vanish). Queue slots close up
as people board.
Simulation runs in fixed steps of `FIXED_DT` (x4 with `?fast`), render once per rAF, `animateArt(time, dt)` per frame.

**Hint & bot:** one `suggestMove()` -> `{car, floor}|null`: per free car, nearest rider destination; else the floor
with the angriest unclaimed waiting person. Hint hand points at it; `?demo` calls it every 0.7 s and taps.

**Test hooks:** `window.__game = { G, LEVELS, FLOOR_THEMES, tap(car, floor), suggestMove, startLevel(i), win(),
step(sec) }`; URL `?level=N` (1-based, skips map), `?demo`, `?fast`, `?mute`, `?seed=N` (seeded RNG for repeatable
tests).

**Sound (Web Audio, synthesized; nothing plays when muted or `?mute`):** `ding` (car arrives, two-tone bell),
`doorOpen`/`doorClose` (soft filtered whoosh), `motor` (low hum while any car moves, gain follows speed), `chirp`
(happy delivery, rising blips), `grumble` (low wobbling saw on entering stage 3), `stomp` (two thuds + stair door
creak), `full` (soft "bonk"), `tap` (tick), `fanfare` (win), `star` (each star pop). speechSynthesis (en-GB, rate 1,
pitch 1.2, max 1 line / 1.5 s): car arrival says the floor number ("Three!") only when a rider gets out there;
"Going up!" at level start; "Hooray!" on win. Audio unlocked on first tap.

**Persistence:** `goingup.stars` = JSON `{ "1": 3, "2": 2 }` (best per level), `goingup.muted` = `"1"|"0"`.
All in try/catch.

## 6. ART API CONTRACT (graphics designer -> `art.js`, pasted verbatim at `/* ======== art ======== */`)

**Available in scope before the chunk:** `import * as THREE from 'three';`
`import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';`
`import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';`
No other imports, no `export` keyword (plain top-level consts/functions in module scope), no globals on `window`,
no network, no `Math.random()` (use the `seed` passed in, e.g. a mulberry32 inside art). Name internal helpers with
an `art` prefix (`artMat`, `artRng`, ...) to avoid clashes with game code.

**Coordinates.** 1 unit ≈ 1 metre. Y up, X right, +Z toward the camera. Cut plane (missing front wall) is `z = 0`;
back wall inner face at `z = -ART.DEPTH`. Floor `i` walking surface at `y = i * ART.FLOOR_H`; slab of thickness
`ART.SLAB` sits below it (from `y - SLAB` to `y`); ceiling of floor i = `(i+1)*FLOOR_H - SLAB`. Ground/street at
`y = 0` outside (`z > 0`), lobby surface also at 0. Building spans `layout.x0 .. layout.x1`, centred on x = 0.
People walk on the **lane** `z = ART.LANE_Z`; decor must stay at `z < -1.8` and must not hide the lane or a
standing person (keep decor in front of `z = -2.6` below 1.0 high). Models face **+Z at rotation.y = 0**
(coder sets `group.rotation.y = +PI/2` to walk right, `-PI/2` left, `PI` into the car).

```js
const ART = {
  FLOOR_H: 3.0, SLAB: 0.3, DEPTH: 4.5, ROOM_W: 6.4, SHAFT_W: 2.2,
  LANE_Z: -0.8,                 // people walk/queue here
  CAR_W: 1.8, CAR_H: 2.4, CAR_D: 2.2, CAR_Z: -2.4,   // car box centre z; front face at CAR_Z + CAR_D/2 = -1.3
  MAX_CAP: 6,                   // riderSpots length
  BUBBLE_Y: 0.55,               // bubble centre above person height
  BUBBLE_SIZE: 1.25,            // sprite world size (square)
};
const FLOOR_THEMES = [ // exactly section 3, same order
  { id: 'lobby', name: 'Lobby', color: '#FFC928', icon: '🛎️' }, /* ... cafe, library, play, pool, music, garden, stars */ ];
```

**Layout object (coder computes it with this exact code, in the `layout` section, and passes it to art):**
```js
function computeLayout(nFloors, nShafts) {
  const width = ART.ROOM_W + nShafts * ART.SHAFT_W, x0 = -width / 2;
  return { nFloors, nShafts, width, height: nFloors * ART.FLOOR_H, x0, x1: x0 + width,
    floorY: Array.from({ length: nFloors }, (_, i) => i * ART.FLOOR_H),
    shaftX: Array.from({ length: nShafts }, (_, s) => x0 + ART.ROOM_W + (s + 0.5) * ART.SHAFT_W),
    stairX: x0 + 0.7, roomDoorX: x0 + 2.2,
    queueX: Array.from({ length: 5 }, (_, k) => x0 + ART.ROOM_W - 0.7 - k * 0.75), // k=0 nearest the lifts
    laneZ: ART.LANE_Z, carZ: ART.CAR_Z };
}
```
Room zone per floor: x0 .. x0+ROOM_W (stair door at stairX on the back wall, room door at roomDoorX on the back wall,
decor between/behind). Shaft s occupies `shaftX[s] ± SHAFT_W/2`, full height, front open so the car is visible;
landing ledge in front of shafts (lane continues across, z from -1.2 to 0).

**Functions (all return handles; all world positions are THREE.Vector3):**
```js
buildSky(scene)                       // background (gradient/sky dome), sun, clouds, distant city, street & trees at y=0, z>0
                                      // -> { group, update(t) }  (update may be a no-op; animateArt also covers it)
buildLights(scene, renderer)          // hemisphere + one directional sun with shadows (mapSize 1024, frustum fit to
                                      // the tallest building 13 x 24); sets renderer.shadowMap.enabled/type,
                                      // toneMapping (ACESFilmic ok), exposure -> { sun, fit(layout) } fit() re-aims shadow camera
buildBuilding(scene, layout)          // adds and returns { group, floors: FloorHandle[], shafts: ShaftHandle[], dispose() }
                                      // includes side walls, slabs with front lip, back walls, roof on top, all floors+shafts
  FloorHandle = { group, index, theme, y,
    stairDoor: Vector3,               // world point on lane in front of the stair door (person walks here, then vanishes)
    roomDoor: Vector3,                // same for the room door (arrivals appear here, celebrating riders leave here)
    setStairDoor(open01), setRoomDoor(open01),
    setGlow(on) }                     // subtle highlight of the row (hint / tap feedback)
  ShaftHandle = { group, index, setCarY(y) }  // cables / counterweight follow car; floor-number lamps per landing optional
buildCar(shaftIndex, capacity)        // NOT added to scene; coder adds group and sets group.position = (shaftX, y, CAR_Z)
                                      // origin = centre of car floor (bottom centre)
  -> { group,
    riderSpots: Vector3[],            // LOCAL positions (y=0 on car floor), length ART.MAX_CAP, front row first
    setDoors(open01),                 // 0 closed, 1 fully open; doors on the front face, slide sideways
    setLoad(used, cap),               // seat lamps on top: cap lamps, `used` lit (dog walker counts 2)
    flashFull(),                      // short red flash of the lamps (art animates via animateArt)
    setTarget(floorIndex|null),       // lamp/arrow sign above the car in theme colour with the number
    setMoving(dir),                   // -1 down, 0 stopped, +1 up (arrow light, maybe slight sway)
    dispose() }
buildPerson(kind, seed)               // kind: 'adult'|'kid'|'grandma'|'courier'|'dogwalker'; seed: int -> look variety
                                      // NOT added to scene. Origin = between the feet, on the floor. Faces +Z.
  -> { group, height,                 // height in units (adult ~1.7, kid ~1.15, grandma ~1.5); dog walker includes a dog
    setMood(stage, m01),              // stage 0..3 (face/colour/steam at 3); m01 for smooth redness between stages
    setAnim(name, t),                 // name: 'idle'|'walk'|'run'|'stomp'|'cheer'|'shake' ; t = seconds since it began
    setBubble(floorIndex|null),       // sprite above the head: rounded badge in theme colour, icon, big number (index+1)
    setBubbleScale(k),                // coder may enlarge bubbles on small screens (default 1)
    setOpacity(a),                    // 0..1 for fade in/out at doors
    dispose() }                       // frees per-person resources (shared materials/textures stay cached)
makeBubbleTexture(floorIndex)         // cached CanvasTexture used by setBubble (art-internal use; coder doesn't call it)
animateArt(time, dt)                  // ambient: clouds, pool ripples, swaying plants, music notes, steam puffs,
                                      // lamp flashes, cheer hearts. Must handle disposed handles safely.
```
Coder calls per level: `building?.dispose(); building = buildBuilding(scene, layout); lights.fit(layout);` then
`buildCar` per shaft. Sky and lights are built once. Bubbles must render on top (`depthTest: false`,
`renderOrder: 10`) and be readable at ~40 px: number >= 55% of badge height, Verdana bold, white with dark outline.

**Performance budget (mid-range phone):** coder caps `pixelRatio` at `min(dpr, 2)`; antialias on. Static building:
merge per floor by material (`mergeGeometries`), target <= 12 draw calls per floor, <= 130 total static. Person
<= 8 meshes + 1 sprite, car <= 10 meshes. Peak ~350 draw calls. Shared material cache keyed by colour
(MeshStandardMaterial, roughness ~0.7; no transmission/physical, no env maps heavier than a small PMREM of a gradient).
Only people, cars and big decor cast shadows; floors receive. One shadow-casting light, 1024 map. No post-processing.
Geometry segments low (capsules 4/8, spheres 12x8).

**Placeholder (coder):** same names and signatures; boxes for floors (theme-tinted), capsule people with a sphere
head tinted by mood (green -> yellow -> orange -> red), box cars with two door planes, canvas bubble. Replacement is
wholesale: the art chunk overwrites everything between `/* ======== art ======== */` and `/* ======== layout ======== */`.

## 7. Coder milestones

1. Skeleton: head tags, importmap, HUD DOM, home/mute/map buttons, `/* Layout: */` style, renderer, resize, loop.
2. Placeholder art section (exact contract), `computeLayout`, building for `?level=N`, camera fit + pan + arrows.
3. Cars: movement with accel, retarget, door cycle, auto-stop for riders, idle auto-open, load lamps.
4. People: spawning (mix, waves, specials, seeded RNG), queue slots, board/ride/exit/celebrate, mood + stairs.
5. Input: plane hit-test -> tap(car, floor), drag vs tap, tap ring; `suggestMove`, hint hand, `?demo` bot.
6. Win flow: progress HUD, end card with stars, level map, persistence (`goingup.stars`, `goingup.muted`).
7. Sound (all synthesized, muted by `?mute`), speech lines, unlock on tap.
8. Test hooks (`window.__game`, `?fast`, `?seed`), headless screenshots 390x844 / 844x390 / 1024x768 (silent).
9. Paste art.js, check budget/fps and readability; manifest, sw.js, icons, README (knobs), `.claude/launch.json` (5224).
