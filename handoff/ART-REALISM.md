# Going Up! — Art direction v2: "architect's cut-away model in daylight"

User verdict on gd/final-p8.png: *too candy-like; more realistic; more detail inside and out.*
Rework the art section in place (between `/* ======== art ======== */` and `/* ======== layout ======== */`).
Same API, same ART dimensions, same FLOOR_THEMES ids/colours/icons, same bubble/mood signals.
Target: a finely detailed museum-quality architectural section model / miniature diorama, natural
materials, believable proportions, warm daylight. Friendly, never gloomy. Gameplay signals stay loudest.

## 1. Why it reads as candy now, and the fix
| Now (final-p8) | Replace with |
| --- | --- |
| `artTint` mixes floor colour 62% toward white: every room is a pastel of its theme | Neutral painted walls (warm off-whites, greige, sage); theme colour only as an accent (see 2) |
| `ART_CREAM` slabs + cream walls + white frames: white-on-white, no depth cues | Grey concrete slabs with a visible layered cut edge; darker skirting and door frames |
| `artClay` roughness 0.78 for everything, vertex colours, no maps: uniform plastic | Per-material roughness/metalness + noisy canvas maps (wood 0.55, paint 0.85, concrete 0.9, steel 0.35/0.9 metal, glass 0.05) |
| `artRB` rounded boxes everywhere (r 0.06) | Hard edges with a tiny bevel (r ≤ 0.015) on furniture; rounding only on soft things (sofas, cushions, people) |
| Salmon facade `#F2A88B`, rainbow bunting, giant rooftop sign | Brick/stone facade with mullioned windows; bunting removed; small neat backlit sign "GOING UP" |
| Primary-colour cars (`ART_CAR_COLORS`) | Brushed-steel cars; floor colour lives only in the hall lantern / indicator |
| Toy proportions: huge heads, stubby props, big chunky door frames | Real ratios: door 2.1 x 0.9 m-ish vs 3.0 floor, head ~1/3 of a person, thin frames (0.05) |
| Flat even light, near-white shadows | IBL + sun + low ambient, darker contact shadows, slight fog on far city |
| `ART_TOYS` / `ART_CLOTHES` saturated pastels | Muted fabric colours (see 5); saturated colour reserved for bubbles, signage, toys in playroom |

## 2. Palette (sRGB hex)
**Facade:** brick `#9C5A3C`, brick shade `#7E4630`, mortar `#C9BFB0`, stone sills/cornice `#D8D0C2`,
stone shade `#B9AF9F`, glass curtain wall on the shaft side `#5F7F94` (env-reflective), mullions `#3B4148`.
**Concrete & cut edge:** slab face `#A9A6A0`, cut concrete `#8F8B84` (noise), screed `#B8B2A8`,
insulation band `#E2C25A` (mineral wool, thin, fluffy noise), steel I-beam ends `#5A6068`, rebar dots
`#6B4A36` rusty, ceiling plaster `#E9E5DC`. Cut-edge order top→bottom: floor finish 0.03, screed 0.04,
insulation 0.03, concrete 0.16 with rebar dots, ceiling plaster 0.02; I-beam profile every ~2 units.
**Shafts:** concrete block `#9A968F` with block joints `#85817A`, steel guide rails `#6E747C`,
counterweight `#4C5157`, cables `#2E3134`, hall doors stainless `#B7BCC1`, sill `#8E949A`.
**Cars:** brushed steel exterior `#AEB4BA` (metal 0.9, rough 0.38, anisotropic-looking stripe texture),
walnut panel interior `#6B4A33`, handrail brass `#B08A4A` (toned down from `ART_BRASS`), floor
granite `#4F4F52`, ceiling light panel warm white, glass back panel tint `#9FB3BF`.
**Floors per room** (floor / walls / accent use of theme colour):
- Lobby: travertine/marble tiles `#D9D2C5` veins `#B8AE9E` / stone wall `#CFC6B6` / yellow `#FFC928` reception sign strip, door banner.
- Café: oak herringbone `#A87B52` / plaster `#E6DCCB`, lower half subway tile `#EDEAE3` / red `#E8413A` awning over counter, menu board frame.
- Library: dark oak planks `#7A5638` + rug `#6E4A3E` / sage paint `#B9C2AE` / blue `#2F6FE0` feature wall behind shelves.
- Playroom: rubber/vinyl floor `#C9C1B0` + play mat squares (the only multicolour) / warm white `#EEE8DC` / orange `#FF8A1F` feature wall.
- Pool: wet ceramic tile `#E4E8E6` grout `#B9C1BF`, water `#3E9FB0`→`#7CC7CF` / tile wall `#D7E2E1` / cyan `#19C2D6` lane ropes + depth signs.
- Music room: parquet `#9B6E47` / acoustic panels `#7F7468` on `#DCD3C4` / purple `#9A55E6` curtain on the stage.
- Greenhouse: terracotta tiles `#B5673F` / glass + white steel frame `#E8E6E0` / green `#35C24A` sign; plants carry the colour.
- Star dome: charcoal carpet `#3C3F4A` / deep blue-grey `#2D3446` / pink `#FF5FAE` door and seat-row lights.
Every wall gets a skirting board (0.1 high, a shade darker than the wall) and a ceiling cornice line.

## 3. Lighting & rendering
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1.05`, sRGB output.
- IBL: `import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'` (pin 0.160.0 in the
  import map), `scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture`;
  dispose the generator. `envMapIntensity` ~0.6 on walls/wood, 1.0 on steel/glass.
- Sun: one DirectionalLight from `ART_SUN_DIR`, intensity ~2.2, colour `#FFF1DE`, `castShadow`, mapSize 2048
  (1024 when DPR < 1.5 or width < 500), `shadow.radius` 3 with PCFSoft, bias -0.0004, normalBias 0.02;
  fit the shadow camera tightly to the visible building.
- Fill: HemisphereLight sky `#CFE3F5` ground `#8C7F6E` ~0.35. Drop any AmbientLight to ≤0.15.
- Interior warmth: no extra real lights; ceiling fixtures are emissive (`artGlow`) plus a faint additive
  light-pool decal on the floor below them (reuse `artPoolM`).
- Fog: `THREE.Fog('#CFDCE6', 40, 120)` so neighbouring buildings fade, building stays crisp.
- Contact shadows: a shared radial-gradient plane (dark centre, alpha 0.35) under every person, sofa,
  table, plant, car on the street. Cheap, merged per floor.
- Procedural canvas textures (one cached canvas each, 256 px, repeat via `artTexOf(c, rep)`): wood grain
  (stripes + noise + plank seams), herringbone, marble veins, tile + grout, carpet speckle, concrete noise
  + formwork lines, brick + mortar, brushed-metal streaks, acoustic panel fabric. Use the same canvas
  (greyscale) as `bumpMap` (scale 0.02) and as `roughnessMap` where it matters (tile grout, wood).
- Glass: MeshStandardMaterial roughness 0.05, metalness 0.1, opacity 0.25–0.35, env reflections;
  no `transmission`, no MeshPhysicalMaterial on phones.

## 4. Details
Each room gets 8–12 props, plus common to every floor: ceiling duct run or bulkhead, sprinkler heads
(tiny cylinders), 2–3 recessed/pendant lights, smoke detector, a wall socket and light switch,
radiator under a window, a framed picture, exit sign over the stairs door, floor number plaque by the lift.
- **Lobby:** reception desk (stone top, wood front), office chair, two sofas + coffee table, potted
  fig, directory board with 8 coloured rows, revolving or glass entry doors, doormat, rope barriers on
  posts, wall clock, letterboxes.
- **Café:** counter with glass pastry case, espresso machine, menu board, 3 bistro tables + chairs,
  pendant lamps, bar stools, cake stand, coffee cups, bin, small plant on the counter.
- **Library:** 3 tall shelves with varied book spines (muted colours), rolling ladder, reading
  armchair, floor lamp, desk with green banker's lamp, globe, rug, kick stool, notice board.
- **Playroom:** play mat, toy shelf with bins, small table + kid chairs, block tower, rocking horse,
  ball pit or tent, easel with drawing, bean bag, alphabet wall frieze, coat hooks.
- **Pool:** pool with tiled edge and ladder, lane ropes, diving board or steps, lifeguard chair,
  life ring on wall, loungers, towels on rail, depth markings, "no running" pictogram, shower.
- **Music room:** upright piano + stool, drum kit, guitar on stand, music stands, small stage
  riser with curtain, speaker cabinets, acoustic panels, spot lights on a truss, sheet-music frame.
- **Greenhouse:** potting benches with pots, tall plants in planters, hanging baskets, sunflowers,
  watering can, hose reel, wheelbarrow, glazing bars overhead, seed trays, small fountain.
- **Star dome:** telescope on tripod, tiered seats, dome ribs and slit, star field ceiling (emissive
  points), planet mobile, star map on wall, step lights, console with buttons.
- **Exterior street:** neighbouring buildings (3–5 simple blocks with window grids, varied heights,
  stone/brick/glass, fogged), pavement slabs, kerbs, road with dashed centre line, zebra crossing,
  traffic light, 3 street lamps, 3–4 varied parked cars + a city bus, trees with 3 layered foliage
  clumps and a trunk, benches, bins, bike rack with a bike, shop awning on the ground floor neighbour,
  bollards, a manhole cover.
- **Roof:** parapet with metal railing, HVAC units with fan grilles, ducts, solar panel rows (dark
  blue-grey with cell grid), water tower (keep, more weathered wood `#8A6A4C`), antenna mast,
  satellite dish, lift motor room box, roof hatch.
- **Facade:** window mullions + transoms, stone sills and lintels, ledge/string course per floor,
  cornice at the top, downpipe, ground-floor plinth in darker stone.

## 5. Characters
Head ~33% of height (now ~45%), neck hint, torso box with slight taper, separate arms (upper/lower in one
capsule) and legs, shoes (dark, slightly forward), hands as small spheres. Hair as shapes: bob, ponytail,
short crop, bun, curly cluster, cap. Skin: `#F3D3B8 #E5B994 #C99068 #A8714C #7E5236 #5A3A26`.
Clothes matte (rough 0.9): `#5B7A99 #8C5A4A #6F8A5E #C9A46A #7A6A8E #B5655A #E8E2D6 #3E4B5E #A88C6A`;
trousers `#2F3A4F #4A4F57 #6B5442 #3B3B42`. Faces stay big-eyed and expressive: dark eyes with white
highlight, eyebrows that move with mood, mouth shape per mood; cheeks blush only when happy.
Specials keep their props (grandma's stick, courier box, dog) at realistic scale.

## 6. Bubbles
Signage style: rounded rectangle (r 18% of height), solid floor colour, 2 px darker border, white big
number in a plain bold sans (Verdana/Tahoma) with a thin dark outline, icon in a white circle tab
beside it, small pointer tail, soft drop shadow (blur 6, alpha 0.3). No gloss, gradient highlights or
thick white strokes. Mood ring stays (`ART_RING`) as a thin outer stroke or a progress bar under it.
Keep `BUBBLE_PX` target size and `MOOD_FACES` legibility; bubbles are `depthTest: false`, never fogged.

## 7. Performance guardrails
- Merge all static props per floor into one mesh per material (existing merge helper); street, roof
  and neighbours merged likewise. Target < 300 draw calls total, check `renderer.info.render.calls`.
- Share materials and textures via `artMatC`/`artTexCache`; ≤ 12 distinct textures, 256 px (512 for brick/facade).
- One shadow light, 2048 max; static props `castShadow` only if taller than 0.4; people cast, receive off.
- `setPixelRatio(Math.min(devicePixelRatio, 2))`. Instanced or merged books, chairs, tiles, solar cells.
- Keep low segment counts (cylinders 8–12, spheres 10x8); detail comes from textures, not polygons.
- Measure on a mid phone: 60 fps idle, never below 45 with 30 people.
