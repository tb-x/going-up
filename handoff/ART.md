# Going Up! - Art direction

## 1. Mood & references
A warm, toy-like doll's-house skyscraper: Richard Scarry's Busytown crossed with Tiny Tower, rendered as soft
clay / vinyl toys. Everything is chunky and rounded (RoundedBoxGeometry radius 6-15% of the smallest side, no
sharp corners anywhere a child looks), with slightly oversized props, saturated but creamy colours, and gentle
lighting with no harsh blacks. Readability at phone size beats realism: big, simple shapes, one strong
colour per floor, a face visible on every person, and no fine detail that turns into noise below about 8 px. Calm and
cosy, never frantic.

## 2. Palette (sRGB hex; set `THREE.Color` from these, renderer outputs sRGB)
**Sky & world**
- Sky gradient: top `#7EC8F2`, bottom/horizon `#FFE7C7` (big inverted sphere or a canvas-gradient `scene.background`)
- Sun disc `#FFD45C`, halo `#FFF1B8` (additive sprite); clouds `#FFFFFF` with shading to `#E6EEF7`
- Skyline layers (near to far): `#8FA8C8`, `#A9BEDA`, `#C4D3E8`; hills `#9ED08A` / `#B9DFA0`
- Ground: grass `#8CCB6E`, street `#5E6672`, lane dashes `#FFF4D6`, sidewalk `#D9D2C5`, kerb `#BFB6A6`

**Building**
- Facade `#F2A88B` (terracotta pink), facade shade band `#E58F73`
- Trim / cornices / ledges `#FFF3E0`; cut-edge slabs & wall sections `#FFF6E5` (cream, see §4)
- Window frames `#FFFFFF`, glass `#BFE6FF` (slight emissive `#9FD4FF` at 0.15)
- Roof `#7C8A99`, water tower wood `#B97A4C`, metal bands `#6B5B4E`

**Shaft & elevator**
- Shaft interior back wall `#4A5468`, rails `#8C96A8`, cables `#2E333D`, counterweight `#6E7787`
- Shaft door frame per floor `#C9A24A` (brass), landing doors `#D8DEE6`
- Car body `#E8473F` (shaft 1), `#2F8FE0` (shaft 2), `#2FB37A` (shaft 3): one colour per car so a child can say "the red one"
- Car trim: brass `#D9A93F` (metalness 0.6, roughness 0.35); chrome handrail `#E3E8EE` (metalness 0.7, roughness 0.3)
- Car doors `#F4F1EA` with a brass edge strip; interior wall `#FFF1D6`, interior light emissive `#FFE2A0` intensity 0.9
- Floor indicator lamp: off `#5A4A2A`, on `#FFC93C` emissive; ding bell lamp `#FFB020`

**Floor colours** (destination colours; fill of bubbles, floor's accent stripe, and the number badge by its shaft door)
| # | Theme | Accent (bubble fill) | Back wall base | Floor material |
|---|---|---|---|---|
| 1 | Lobby | `#E53935` red | `#FCE3DF` | checker tiles `#F5EFE6`/`#D9CFC0` |
| 2 | Café | `#FB8C00` orange | `#FFE9CC` | warm wood planks `#C98B55` |
| 3 | Playroom / kindergarten | `#FDD835` yellow | `#FFF7C2` | soft foam mats in mixed colours |
| 4 | Garden greenhouse | `#43A047` green | `#E1F3D8` | terracotta tiles `#D98A5E` |
| 5 | Pool / gym | `#00ACC1` teal | `#D3F3F7` | pool tiles `#BFEAF0` with grout |
| 6 | Office | `#1E66D0` blue | `#DCE8FA` | blue-grey carpet `#9DAFC9` |
| 7 | Music room | `#8E44D0` purple | `#EBDDF7` | dark wood stage `#8A5A3C` |
| 8 | Art studio | `#EC4C9A` pink | `#FCE0EE` | paint-splattered boards `#E8D8C0` |
| 9 | Library | `#7A4E2D` brown | `#F2E4D3` | rug `#B5553F` on wood `#A87148` |

Order bottom-to-top follows the rainbow so the building reads as a gradient (red at the bottom, brown at the top).
Bubbles: white number with a 4 px `#2B2B3A` outline so it stays readable on yellow.

**People**
- Skin tones: `#FFE0C4`, `#F6C9A0`, `#E0A878`, `#C68A5A`, `#9C6440`, `#6E4228`
- Hair: `#2B1E16`, `#5A3825`, `#C8782E`, `#E8C468`, `#D9D9D9` (grandparents), `#3A3A48`
- Clothing (bright, distinct from any one floor accent; no clothing in pure floor reds): `#FF7A7A`, `#FFB347`,
  `#7FD1B9`, `#6FA8FF`, `#B68CFF`, `#FF9ECF`, `#F4F4F4`, `#3B4A6B`, `#8BC34A`, `#FFDD57`
- Outline-free; separate pieces with colour contrast and a tiny 1-2 px darker contact-shadow disc under feet.

## 3. Lighting & materials
- `renderer.outputColorSpace = THREE.SRGBColorSpace`; `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.1`.
  Canvas textures: `tex.colorSpace = THREE.SRGBColorSpace`, `anisotropy = 4`.
- `HemisphereLight(sky #CFE8FF, ground #F3D9B8, 1.1)`: provides most of the fill, so shadows never go black.
- One warm key `DirectionalLight(#FFE2B8, 1.6)` from front-left-top (e.g. `(-6, 14, 10)` relative to building centre),
  `castShadow`, `shadow.mapSize 2048` (1024 on low-end / dpr<1.5), tight ortho shadow camera fitted to the building
  only, `shadow.bias -0.0005`, `normalBias 0.02`, `shadowMap.type = PCFSoftShadowMap`, `shadow.radius 4`.
- Optional cool rim `DirectionalLight(#BFD9FF, 0.35)` from back-right, no shadow.
- Per-floor ceiling lights are **fake**: emissive rounded panels / lamp shades (`emissive #FFE7B0`, intensity 0.8)
  plus a soft additive radial-gradient sprite (canvas texture) under each lamp for a pool of light on the floor. No point lights per floor.
- Elevator car interior: emissive wall panel; when doors open, fade an additive "glow" plane in the doorway (§7).
- `scene.fog = new THREE.Fog('#FFE7C7', 40, 140)` so the skyline melts into the horizon colour; building stays crisp.
- Materials: `MeshStandardMaterial`, roughness 0.6-0.9 (vinyl/clay), metalness 0 except brass/chrome trims (0.6-0.7).
  Faces/eyes: `MeshBasicMaterial` or a canvas texture on a Standard material with roughness 0.5.
- Optional: a cheap `onBeforeCompile` hook adding a subtle vertical gradient (+8% brighter at top) and a fresnel rim
  (`#FFFFFF`, 0.15) to people and the cars. Nice to have, not required.

## 4. Building & scene composition
**Camera**: perspective, FOV ~35 (flat-ish, doll's-house look), looking straight at the cut face, slightly from above.
Portrait phone: frame about 4-5 floors at once and pan/scroll vertically; landscape/tablet: the whole building if it fits.

**Behind the building** (all unlit or low-cost, no shadows): 3 layers of extruded low-poly skyline silhouettes (boxes
with a few lit windows as emissive dots), 2 rolling hills (flattened spheres), 4-6 puffy clouds (5-7 merged spheres
each) drifting slowly sideways and wrapping around, 2-3 birds (two-triangle "V" wings flapping by scale.y) crossing now and then.

**Ground**: street in front with lane dashes, sidewalk, 3-4 lollipop trees (cylinder trunk + 2-3 sphere crowns
`#6BBF59`/`#58A848`), a parked rounded car (`#FFB347` body, cream roof, black tyres), a bus stop (roof, bench, sign
pole with a round blue sign), a fire hydrant `#E53935`, a striped awning over the lobby entrance.

**Roof**: rooftop garden fringe (hedges, 2 planters with flowers), a wooden water tower on stilts with a cone roof,
an antenna mast with a red blinking light (`#FF4040` emissive pulsing at 1 Hz), a little flag, and a
fluttering rope of bunting in the floor colours.

**The cut**: the front wall is removed. Every slab and the side walls show a thick (0.25-0.35 floor height)
cross-section in cream `#FFF6E5`, with a slightly darker inner edge `#EAD9BE` (rounded edge), so it reads as "sliced
like a cake". The outside facade, in terracotta with its windows, stays visible on the two side faces (about 15-20° of side visible).

**Layout of each floor (left to right)**: staircase column | elevator shaft(s) | room. Floor height ~3 units, room
depth ~4. Each floor has:
- Back wall: a canvas wallpaper texture (stripes, polka dots, tiles, leaves...) on the floor's wall-base colour,
  an accent-colour skirting strip, and 2 windows showing sky (glass panel + gradient canvas: sky blue to cream).
- The floor's number badge (rounded square, accent fill, white digit + icon) on the wall by each shaft door.
- Floor material as in the table (canvas texture, repeat).
- Props, built from primitives and placed toward the back so people can walk in front of them:

| Floor | Props |
|---|---|
| 1 Lobby | revolving-door hint, reception desk with a bell, potted palm, red rope posts, wall clock, mailboxes, welcome mat |
| 2 Café | counter with a coffee machine, cake dome with a pink cake, 2 round tables + chairs, menu chalkboard, hanging lamps, cups |
| 3 Playroom | toy blocks stack, small slide, ball pit (many small spheres, instanced), rocking horse, alphabet bunting, teddy bear |
| 4 Greenhouse | glass-roof hint, flower pots in rows, watering can, sunflower, tomato plants with red spheres, wheelbarrow, butterfly |
| 5 Pool / gym | small pool (animated water plane `#5FD3E8`), ladder, rubber duck, life ring, dumbbells, exercise ball, towel rack |
| 6 Office | 2 desks with monitors (emissive blue screens), swivel chairs, water cooler, filing cabinet, plant, wall chart |
| 7 Music room | piano (black + white keys), drum kit, guitar on stand, music stand, stage spotlight cone, floating notes |
| 8 Art studio | easel with canvas, paint pots, giant crayons, wall of kids' drawings (canvas), splattered smock on hook, clay pot |
| 9 Library | 2-3 tall bookshelves (books = coloured boxes, instanced), reading armchair, globe, ladder, lamp, stack of books |

**Staircase**: its own cut-away column at the far left, zig-zag flights between floors (steps = merged boxes, cream
treads, accent-coloured handrail), a glowing green exit sign `#2ECC71` with a white running-person icon on each
landing. Angry people stomp across to it and climb out of view.

## 5. Characters
- Proportions: total height ~1.1 (adult) / 0.8 (kid) units against a 3-unit floor; head ~45% of height (sphere,
  slightly squashed), pill/capsule body, stubby capsule legs, mitten arms (small capsules) that swing when walking.
- Face on a canvas texture mapped to the front of the head (one 256x256 canvas per mood, shared by everyone via
  a texture atlas or cached textures): two big black oval eyes with white highlights, eyebrows, mouth, rosy
  cheeks (`#FF9E9E` at 50%). Blink by scaling eyes on y every 3-5 s (or swapping texture).
- Mood stages (wait-time thresholds come from PLAN.md):
  1. **Happy**: big smile, eyebrows up, gentle idle bounce.
  2. **OK**: flat little smile, eyebrows level, taps a foot.
  3. **Grumpy**: frown, eyebrows angled down, arms crossed (arms rotated in), a small grey cloud puff above.
  4. **Angry**: face and head tinted toward `#FF5A4A` (lerp material colour), steam puffs (white spheres rising
     and fading) from the top of the head, small fast shake (±0.03), a little "!" in their bubble.
  5. **Leaving**: stomps (exaggerated knee lift, stomp dust) to the staircase; the bubble pops and becomes a faint grey.
  Mood is also shown by a ring/rim around the bubble that drains from green to red as the wait goes on.
- Varieties (accessories make each one readable):
  - **Kid**: short, oversized head, backpack or balloon on a string
  - **Grown-up**: shirt/dress, bag or briefcase
  - **Grandparent**: grey hair bun or bald with moustache, glasses (torus rings), cane, slower walk
  - **Worker**: yellow hard hat `#FFC83D`, orange hi-vis vest with cream stripes, toolbox
  - **Chef**: tall white toque, white jacket, holds a cake
  - **Doctor**: white coat, stethoscope (torus + small disc), head mirror
  - **Pizza courier**: red cap, holds a flat pizza box stack
  - **Dog**: four stubby legs, floppy ears, wagging tail, collar in the destination colour; barks instead of talking
- Walk cycle: body bob (sin), leg swing ±25°, arm swing opposite; turn to face direction. Idle: breathing scale 1-2%.

## 6. Elevator
- Shaft: dark back wall, two vertical rails, cables from the car roof up to a pulley wheel at the top (rotates as the
  car moves), a counterweight sliding the opposite way on the side rails.
- Car: rounded box frame in its car colour, brass trim on the roof edge and the kick plate, a window band, a chrome handrail
  inside, warm emissive interior, a little round "ding" bell lamp on top that flashes on arrival.
- Doors: two sliding panels on the car (and two landing panels on each floor's shaft opening, sliding with them);
  open over 0.35 s with ease-out.
- Each floor, above each shaft door: a brass half-moon indicator with an arrow lamp (up/down glow) plus a small
  dot that lights `#FFC93C` when the car is here.
- Capacity shown by seats/spots on the car floor (dim footprints that fill as people step in).

**Destination bubble** (HTML overlay or a sprite; a sprite is fine and stays aligned with the camera):
rounded speech bubble 48 px tall on screen (40-56 range), fill = destination floor accent, 3 px white border, soft
drop shadow, big white number (Verdana bold) with a dark outline, and a tiny white floor icon (cup, block, leaf,
duck, briefcase, note, brush, book; house for the lobby) next to it. Tail points to the person's head. Wait ring around it (§5).

## 7. Juice & feedback (calm, pleasant)
- Arrival: person hops (squash 0.85 then stretch 1.1), 6-10 confetti pieces / little stars in the floor accent +
  gold, 2-3 hearts float up and fade, bubble pops into a sparkle. Delivered counter icon does a bounce.
- Doors open: warm glow plane fades in (additive, `#FFE2A0`, 0.6 opacity), ding lamp flashes, indicator lights.
- Tap: a white ring ripple expanding and fading where the player tapped (screen-space DOM or a world-space ring),
  and the tapped floor's badge pulses.
- Car moving: tiny ease-in/out, cable wheel spin, slight 1-2% sway of the car on stop.
- Camera: very gentle idle bob (±0.03 units, 6 s period); smooth follow when a car leaves the view. No screen shake.
- Level complete: bunting wiggles, fireworks of stars over the roof, the windows in the skyline twinkle.

## 8. UI (HTML overlay)
- Title / big words: "Fredoka" (Google Fonts, 600/700) or "Baloo 2". Digits that a child reads (counters,
  floor numbers in the UI): Verdana / Tahoma bold.
- Buttons: chunky rounded pills / circles, min 56 px (home and mute 44 px), cream `#FFF6E5` fill, 4 px darker
  bottom "lip" `#E3CFA8` for a pressable toy look, pressed = translateY(3px) and lip gone. `touch-action: manipulation`.
- Top bar: home (top-left, house icon), progress meter in the middle: a row of little people icons (grey outline
  silhouettes that fill with colour as people are delivered; per floor when the goal is per floor, using each floor's
  accent), mute toggle (speaker icon) top-right. Respect `env(safe-area-inset-*)`.
- Stars (1-3) on the level-end card, big and gold `#FFC93C` with a `#E59A00` edge. Gentle end card if people left:
  "Nice try!" with a smiling elevator.
- Floor call buttons (if the control scheme uses them): a vertical column of round buttons in the floor accent colours
  with white digits, the active one glowing.

## 9. Performance (mid-range phones)
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; `antialias: true`; `powerPreference: 'high-performance'`.
- Exactly one shadow-casting light, map ≤ 2048 (1024 fallback). Only the building interior, people and cars cast shadows;
  skyline, clouds, ground props far away: `castShadow = false`. Static shadow: set `shadowMap.autoUpdate = false`
  and call `needsUpdate` each frame only if people/cars move (they will, so keep the shadow camera tight).
- Share geometries and materials through small caches (`geo('box', w,h,d,r)`, `mat(hex)`); never create
  them per frame. Faces: one canvas texture per mood, shared.
- Merge each floor's static props into one or a few meshes per material (`BufferGeometryUtils.mergeGeometries`),
  and use `InstancedMesh` for repeated things (books, ball-pit balls, steps, skyline windows, confetti).
- Budget: < 250 draw calls, < 150k triangles. Rounded boxes with 2-3 segments; spheres 16x12 for heads, 8x6 for small bits.
- Cull: floors far outside the view can be `visible = false`. Pause the render loop when the tab is hidden.
