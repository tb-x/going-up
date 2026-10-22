# Going Up!

A lift game for young kids. The front of a tall city building has been cut away so you can see every floor: the
lifts run up the middle, with rooms on both sides (offices, a hotel, a café, a restaurant, a pool, a playroom, a
library, a roof garden or an observatory), and under the street an underground car park and a subway station.
People walk in from the street, get out of their cars, step off subway trains or come out of the rooms, wait by the
lifts and show a bubble with the floor they want (its colour, a little picture and a big number). Floors are numbered
like a real lift: the lobby at street level is 0, the floors above are 1, 2, 3…, and the ones underground are -1, -2. Tap a floor to send a lift there. Get everyone where they're going before they get
cross and stomp off down the stairs.

Play it at <https://tb-x.github.io/going-up/> (once published).

## How it plays

- Tap a floor in a lift shaft and that lift goes there. Tap a floor in the rooms and the nearest free lift goes.
- The doors open by themselves: people for that floor step out and cheer, then the people waiting get in.
- A moving lift stops on the way wherever someone inside wants to get out, and a lift standing still opens for anyone
  waiting on its floor.
- The lamps on top of a lift show how full it is. When it's full the lamps flash and the next person waits.
- Faces go from happy to grumpy to red and steaming the longer people wait. Waiting inside a lift is much less
  annoying. A red, steaming person gives up and takes the stairs (counted next to the walking man at the top).
- Each level needs a number of happy arrivals (the little people at the top fill in green). Three stars if nobody
  took the stairs, two if one or two did, otherwise one. There's no losing and no timer.
- Ten levels, each with its own floors: levels 1-2 have a lobby, café, offices (and a playroom); level 3 adds the
  car park under the street, level 6 the subway, where a train pulls in every 20-30 seconds and a few people get
  off at once. The lobby is floor 0, the car park -1 and the subway -2. Later levels add a second and third lift, slow grandmas, impatient pizza
  couriers, dog walkers (the dog takes a seat too), a morning rush at the lobby and a lunch rush to the restaurant.
- Lots of people want the offices and the hotel; people heading home often want the car park or the subway.
- People only come and go through real openings: the lobby entrance, room doors, the stair door, car doors and
  train doors. Every trip is shown: people stroll in along the pavement and through the lobby door, drive into the car park and
  climb out of their car, or step off a subway train. After the lift they walk on: out to the street, into a room,
  back to a parked car that then drives away, or to the platform to wait for the next train (which comes sooner when
  someone is waiting). Only waiting for a lift makes people cross; walking, driving and waiting for a train don't.
- Some levels are at dusk or at night (a sun, sunset or moon on each level button). At night more people head for
  the hotel and the restaurant and fewer for the offices, and the win ends with "Good night!".
- On level 1 a pulsing hand shows what to tap if nothing has been tapped for a couple of seconds (later levels: 8 s).
- When the building is taller than the screen, drag up and down to look around (down into the basements too);
  on a narrow phone the outer rooms may be cut off, so drag sideways as well. The lifts and the queue always stay
  on screen. Arrows at the edge show (with a face) that someone is waiting out of view. Tap an arrow to go there.
- Sounds are synthesized in the browser (Web Audio), and the spoken words use the browser's own voice. The speaker
  button turns them off and is remembered.

## Running it

Serve the folder and open it in a browser:

```
python -m http.server 5224
```

then go to <http://localhost:5224/>. Opening `index.html` straight from disk mostly works too.

Handy URL options: `?level=3` starts level 3 straight away, `?demo` lets the computer play, `?fast` runs four
times faster, `?mute` keeps it completely silent, `?seed=7` makes the arrivals repeatable.

Stars are kept in the browser (`goingup.stars`), as is the sound setting (`goingup.muted`).

## Tuning knobs

At the top of the script in `index.html`:

| Name | Default | What it does |
| --- | --- | --- |
| `CAR_SPEED` | 5.5 | lift top speed (a floor is 3 units) |
| `CAR_ACCEL` | 9 | how quickly a lift speeds up and slows down |
| `DOOR_TIME` | 0.45 s | doors opening or closing |
| `DWELL_MIN` | 0.9 s | doors stay open at least this long |
| `BOARD_GAP` | 0.3 s | gap between two people stepping in |
| `WALK_SPEED` | 1.6 | how fast people walk |
| `QUEUE_MAX` | 5 | most people waiting on one floor |
| `MAX_PEOPLE` | 30 | most people in the building |
| `RIDE_PATIENCE_RATE` | 0.3 | patience runs out this much slower inside a lift |
| `MOOD_T` | 0.35, 0.6, 0.8, 1.0 | share of patience used up before each mood step (the last one means the stairs) |
| `HINT_DELAY_L1` / `HINT_DELAY` | 2 s / 8 s | idle time before the hand hint shows |
| `MIN_FLOOR_PX` | 64 | a floor is never drawn shorter than this; taller buildings scroll |
| `CELEBRATE_TIME` | 1.2 s | how long delivered people cheer |
| `SPECIAL_CHANCE` | 12% | chance of each special person (grandma, courier, dog walker) once a level has them |
| `ARRIVE_JITTER` | 30% | randomness in the time between arrivals |
| `TRIP_MIX` | 40%, 35% | lobby to upstairs, upstairs going down; the rest go between upper floors |
| `PARK_SHARE` | 18% | share of arrivals that come out of a parked car (levels with a car park) |
| `DOWN_TO_BASEMENT` | 40% | how often people going down want the car park or subway instead of the lobby |
| `TRAIN_EVERY` / `TRAIN_GROUP` | 20-30 s / 2-4 | how often a subway train arrives, and how many get off |
| `TRAIN_DOOR_DELAY` | 1.4 s | train stops and opens before people step out |
| `QUEUE_ROOM` | 4.2 | width left of the lifts that is always kept on screen for the queue |
| `TRAIN_GAP_WAITING` | 8 s | the next train comes within this time when someone waits on the platform |
| `TRAIN_OPEN_MIN` / `TRAIN_OPEN_MAX` | 2 s / 6 s | how long the train doors stay open |
| `PARKED_AT_START` | 1-3 | cars already parked when a level starts |
| `CAR_DOOR_TIME` | 0.6 s | how long a car door stays open while someone climbs out |
| `NIGHT_WEIGHTS` | | how much more (or less) popular each floor is at dusk and at night |
| `LEVEL_TIMES` | | day, dusk or night for each level |
| `ROOM_DOOR_Z`, `STAIR_DOOR_Z`, `PARK_DOOR_Z`, `TRAIN_EDGE_Z`, `PAVEMENT_Z` | | where people stand when they go through a room door, the stair door, into a car or a train, and the line they walk along the pavement |
| `FAST_MULT` | 4 | speed-up for `?fast` |
| `BUBBLE_PX` / `RIDER_BUBBLE` | 44 px / 0.7 | bubble size on screen, and how much smaller they are inside a lift |

The `LEVELS` list sets, per level: the floors from bottom to top (from `THEME_LIB`), lifts, seats per lift, seconds between arrivals, patience (seconds),
how many arrivals win, which special people appear and which rushes happen.
