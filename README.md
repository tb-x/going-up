# Going Up!

A lift game for young kids. The front of a tall, friendly building has been cut away so you can see every floor.
People come out of the rooms, wait by the lifts and show a bubble with the floor they want (its colour, a little
picture and a big number). Tap a floor to send a lift there. Get everyone where they're going before they get
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
- Ten levels: more floors, a second and third lift, slow grandmas, impatient pizza couriers, dog walkers (the dog
  takes a seat too), a morning rush at the lobby and a lunch rush to the café.
- On level 1 a pulsing hand shows what to tap if nothing has been tapped for a couple of seconds (later levels: 8 s).
- When the building is taller than the screen, drag up and down to look around; arrows at the edge show (with a
  face) that someone is waiting out of view. Tap an arrow to go there.
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
| `TRIP_MIX` | 40%, 35% | lobby to upstairs, upstairs to lobby; the rest go between upper floors |
| `FAST_MULT` | 4 | speed-up for `?fast` |
| `BUBBLE_PX` / `RIDER_BUBBLE` | 44 px / 0.7 | bubble size on screen, and how much smaller they are inside a lift |

The `LEVELS` list sets, per level: floors, lifts, seats per lift, seconds between arrivals, patience (seconds),
how many arrivals win, which special people appear and which rushes happen.
