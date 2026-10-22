# SPEC3: building life (lead's spec, authoritative)

User, verbatim: "make sure the building life is nicely animated: people enter cars that drive away; sub arrives and
people go to platform, then to elevator etc".

Principle: every person's whole trip is visible. They arrive by car, train or on foot, walk to the lifts, ride, then
walk to where they're going and leave by car, train, on foot or into a room. Nobody pops in or out of thin air,
except fading as they get into a car or train or go through a door. Patience only ticks while someone waits for a
lift (or rides one, as now). Walking, travelling and waiting for a train never make anyone cross.

## Art hooks (graphics designer). All optional for the game (`?.`), with times in seconds and positions in world units
Floor handle of the **parking** floor (`building.floors[i]`):
- `bays`: array of `{ x, z, doorX }`. `x, z` is the parked car's centre; `doorX` is the point on the walking lane
  (LANE_Z) beside the driver's door. At least 4 bays over both wings, ordered left to right.
- `carIn(bay, colorSeed)` → seconds until parked. A car appears on the street, drives down the ramp and parks in the bay.
- `carOut(bay)` → seconds until it has left the bay; it then drives up the ramp and away along the road off-screen.
- `carDoor(bay, open01)`: driver door. Optional; a short open/close is enough.
- `setParked(bay, colorSeed | null)` places or removes a parked car instantly (for the level start).

Floor handle of the **subway** floor:
- `train`: `{ come() → seconds until stopped, doors(open: bool) → seconds, go() → seconds until gone, doorXs: [x…] }`.
  `doorXs` are lane points in front of the train doors. The train waits as long as the game wants, so the art never
  leaves on its own timer.
- `platformXs`: 4–6 lane x positions where people wait for a train.

Building handle:
- `street`: `{ y: 0, walkZ, leftX, rightX, entranceX }`. `walkZ` is the pavement in front of the building (z > 0);
  `leftX` and `rightX` are off-screen ends; `entranceX` is the lobby door on the pavement side. People walking in from
  the street use this, and the game can walk a person along x at walkZ and then in to the lobby lane.
- Ambient life, art only, in animateArt: traffic both ways on the road (cars, a bus that stops at the bus stop),
  2–4 pedestrians strolling on the far pavement (not game people), birds, and the antenna light. Lift motors and
  counterweights move with the cars (already there?). Room details: the office monitors flicker, the hotel and
  restaurant lamps are on, the café coffee machine steams, the pool water ripples.

## Game logic (coder)
- **Parking arrivals:** pick a free bay and call `carIn`. When the car is parked, its door opens, the person fades in at
  `doorX`, walks to the queue, and the door closes. The car stays parked.
- **Parking departures:** a rider delivered to the parking floor walks to a bay with a parked car (one not reserved by
  someone else). If there's none, a car is called with carIn first and the person waits by the bay, happy. They reach
  doorX, the door opens, they fade into the car, and `carOut(bay)` drives it away. Keep 1–3 cars parked at the start
  (`setParked`).
- **Subway:** the game owns a train cycle: come, doors open, unload and load, doors close, go, then a gap. The gap is
  20–30 s, shorter (about 8 s) when someone is waiting on the platform. Arrivals step out at `doorXs` once the doors
  are open (2–4 people), walk to the queue and press for the lift. A rider delivered to the subway walks to a free
  `platformXs` spot and waits, happy and not counted against patience. When the doors open they walk to the nearest
  door and fade in. The doors stay open until everyone in reach has boarded (cap the wait at about 6 s), then close,
  and the train goes.
- **Street:** lobby arrivals walk in along the pavement from `leftX` or `rightX` to `entranceX`, then into the lobby to
  the queue. A rider delivered to the lobby walks out the entrance and along the pavement off-screen, then fades out.
- **Delivered counter and stars:** "delivered" still counts when the rider steps out of the lift on the right floor,
  so the travel animation never delays the win. After the win, the people still walking finish their trips.
- **Fallbacks:** without the hooks (old art), keep today's behaviour.
- `G.debugLife` (or similar) counts carIn, carOut, train cycles, boardings and street walkers for tests.

## Night levels (user: "also include some night levels")
- **Game (coder):** each LEVELS entry gets `time: 'day' | 'dusk' | 'night'`. Use: 1-3 day, 4 dusk, 5 night, 6 day,
  7 night, 8 dusk, 9 day, 10 night. The level map shows a small sun, sunset or moon on each level button.
  `startLevel` calls `artSetTime?.(level.time)` after building the scene. Night arrivals lean towards the
  hotel and restaurant, and fewer go to the offices. Optional: the spoken line "Good night!" on a night win.
- **Art (graphics designer):** a top-level `artSetTime(mode)` in the art section switches, without rebuilding:
  - the sky gradient (dusk is orange to purple; night is deep navy) with a moon and twinkling stars at night;
  - sun to moonlight: a cool, dim key light whose shadow stays on;
  - lower hemisphere and IBL intensity, and the fog colour;
  - skyline windows lit in a random pattern (some flicker off over time);
  - street lamps glowing with light pools, car headlights and tail lights, a lit bus interior;
  - interiors: ceiling lamps brighter and warmer, back-wall windows showing the night sky, office monitors glowing,
    the hotel's bedside lamps on.
  The building must glow warmly, like a doll's house at night, and the destination bubbles and faces must stay as
  readable as by day: they're toneMapped false already, so keep them unlit. Dusk sits halfway between day and night.
