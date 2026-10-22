# SPEC2: wider building, real-city floors, basements (lead's spec, authoritative)

User, verbatim: "I don't like that the elevators take so much space in the building; extend it and show offices,
hotels, restaurants, underground parking, subway etc (depending on level)".
This comes on top of the realism pass (ART-REALISM.md), the shadow fix and the capacity sign that are in progress.

## Layout: lift core in the middle, two wings
Left to right: LEFT WING (stairwell column + room) | LIFT CORE (nShafts × SHAFT_W) | RIGHT WING (room).
- New ART constants (in the art chunk): `WING_L = 8.0` (incl. the 1.4-wide stair column at its far left),
  `WING_R = 7.0`, `STAIR_W = 1.4`. `ROOM_W` is no longer used for layout (keep it defined = WING_L so nothing breaks).
  1 lift: lifts use 2.2 of 17.2 (13%); 3 lifts: 6.6 of 21.6 (31%).
- `computeLayout(level)` (coder) returns, in addition to the existing fields:
  `coreX0, coreX1` (core extents), `wingL: [x0, coreX0]`, `wingR: [coreX1, x1]`,
  `roomL: [x0 + STAIR_W, coreX0]`, `roomR: [coreX1, x1]` (room interiors), `stairX` (in the stair column),
  `roomDoorXs: [xL, xR]` (a door in each wing's back wall; keep the old `roomDoorX` number = xL so current art works),
  `queueX[k] = coreX0 - 0.7 - k*0.75` (queue stands in the left wing next to the core, k=0 nearest),
  `nBasement`, `floorY[i] = (i - nBasement) * FLOOR_H` (ground/street level y = 0 is the lobby floor),
  `themes[i]` (theme object of floor i), `labels[i]` (string shown on bubbles/badges, see numbering),
  `groundIndex = nBasement` (lobby).
- People cross in front of the lift doors along the lane (LANE_Z) to reach the right wing. Fine.
- Camera (coder): the core and the queue must always be on screen; on narrow portrait screens the outer parts of
  the wings may be cropped (or allow horizontal pan as well as vertical). Floors still ≥ 64 px tall, vertical pan when
  needed, including down into the basements. Start the view on the lobby area.

## Floor themes
`THEME_LIB` (all themes, data section, coder) and `FLOOR_THEMES` = the current level's floors (index = floor index),
rewritten **in place** by `startLevel` (`FLOOR_THEMES.length = 0; FLOOR_THEMES.push(...)`), so existing
`FLOOR_THEMES[i]` lookups keep working. **Art must key every cache (bubble textures, badges) by theme id + label,
never by floor index**, because the same index is a different floor in another level.

| id | name | colour | icon | where |
|---|---|---|---|---|
| subway | Subway | `#3A4150` charcoal | 🚇 | basement (always lowest) |
| parking | Parking | `#8C97A8` grey | 🚗 | basement |
| lobby | Lobby | `#FFC928` yellow | 🛎️ | ground |
| cafe | Café | `#E8413A` red | ☕ | |
| office | Offices | `#2F6FE0` blue | 💼 | |
| hotel | Hotel | `#9A55E6` purple | 🛏️ | |
| restaurant | Restaurant | `#FF8A1F` orange | 🍝 | |
| pool | Pool | `#19C2D6` cyan | 🏊 | |
| play | Playroom | `#FF5FAE` pink | 🧸 | |
| library | Library | `#8B5A2B` brown | 📚 | |
| garden | Roof garden | `#35C24A` green | 🌻 | top |
| stars | Observatory | `#1F2F7A` navy | 🔭 | top |
(music room dropped.)

Numbering: lobby = 1, the floors above 2, 3, 4…; basements have **no number**: their bubble/badge shows the icon
large in place of the number (🚗, 🚇). `labels[i]` is '1'…'9' or '' for basements.

## Levels (floors bottom → top; coder keeps the tuned cars/cap/every/patience/target numbers, adjusting a little)
1. lobby, cafe, office — 1 lift
2. lobby, cafe, office, play — 1
3. parking, lobby, cafe, office, hotel — 1 (first basement)
4. parking, lobby, restaurant, office, hotel, pool — 2
5. parking, lobby, cafe, office, library, hotel, garden — 2
6. subway, parking, lobby, restaurant, office, hotel, pool — 2 (subway arrives)
7. subway, parking, lobby, cafe, office, play, hotel, garden — 2
8. subway, parking, lobby, restaurant, office, library, hotel, pool, stars — 3
9. subway, parking, lobby, cafe, office, play, restaurant, hotel, pool, garden — 3
10. subway, parking, lobby, cafe, office, library, restaurant, hotel, pool, stars — 3

## Where people come from (coder)
- Lobby: from the street door (walk in from the left edge of the ground floor). Most arrivals early on.
- Parking: people get out of a parked car (art hook optional), walk to the queue.
- Subway: arrivals come in groups of 2–4 when a train pulls in (`floorHandle.trainArrive?.()` art hook, call it
  if present; the game owns the timing, every ~20–30 s on subway levels). Many want the offices/hotel; going home
  people on upper floors often want the subway or parking.
- Upper floors: from the room doors in either wing.

## Art (graphics designers)
- Each floor builds a room in each wing from `layout.roomL` / `layout.roomR` extents (no hard-coded widths). Same theme
  both wings, different props per wing (e.g. office: open-plan desks left, meeting room right; hotel: two bedrooms or
  bedroom + corridor with housekeeping cart; restaurant: dining room left, kitchen right).
- Basements: below y = 0 the street and pavement become a soil/rock cross-section (layers, pipes, roots near the top,
  foundations, a sewer pipe). Parking: concrete columns, painted bays, cars, ramp towards the street, barrier, ticket
  machine, fluorescent tubes. Subway: platform with tactile edge strip, tracks in a tunnel running across the full
  width (and beyond the building), tiled walls, station sign, benches, a train that slides in, stops, opens and leaves
  (`trainArrive()`), departure board.
- Lift shafts and the stairwell continue down through the basements.
- `buildBuilding(scene, layout)` reads `layout.themes`, `layout.labels`, `layout.nBasement`, `layout.roomL/roomR`.
