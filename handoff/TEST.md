# Going Up! test report (game tester, 2026-10-21)

Tooling: `tester/h.html` (same-origin harness, served by `tester/serve_t.py 5230`, which serves the game at `/` and the
harness at `/__t/`). It drives `__game.step()`, `suggestMove()`, `tap()` and synthetic PointerEvents on the canvas.
Screenshots are in `tester/t-*.png`. All runs silent (`--mute-audio`, `?mute`). Times are game seconds at normal speed.

## Levels (3 seeds each, 1, 2, 3)

- **demo**: the built-in `?demo` bot (taps every 0.7 s).
- **slow2 / slow4**: the hint move (`suggestMove`) tapped once every 2 s or 4 s, like a slower player.
  This is still a "perfect choice" player, so a real child will do worse.

| Lv | floors / cars / cap | target | demo: time to win, stairs, stars | slow2: time, stairs, stars | slow4: time, stairs, stars |
| --- | --- | --- | --- | --- | --- |
| 1 | 3/1/4 | 5 | 40-46 s, 0, ★★★ | 40-48 s, 0, ★★★ | 42-45 s, 0, ★★★ |
| 2 | 4/1/4 | 8 | 56-62 s, 0, ★★★ | 57-64 s, 0, ★★★ | 59-66 s, 0, ★★★ |
| 3 | 5/1/4 | 10 | 65-86 s, 0, ★★★ | 67-78 s, 0, ★★★ | 69-79 s, 0, ★★★ |
| 4 | 5/2/4 | 12 | 68-73 s, 0, ★★★ | 69-77 s, 0, ★★★ | 69-78 s, 0, ★★★ |
| 5 | 6/2/4 | 14 | 73-77 s, 0, ★★★ | 75-82 s, 0, ★★★ | 86-94 s, 0, ★★★ |
| 6 | 6/2/3 | 15 | 75-83 s, 0, ★★★ | 81-87 s, 0, ★★★ | 78-87 s, 0-1, ★★-★★★ |
| 7 | 7/2/4 +rush | 16 | 64-75 s, 0, ★★★ | 66-67 s, 0, ★★★ | 69-85 s, 1-3, ★-★★ |
| 8 | 7/3/4 | 18 | 79-86 s, 0, ★★★ | 77-87 s, 0, ★★★ | 87-99 s, 1, ★★ |
| 9 | 8/3/5 +lunch | 20 | 66-68 s, 0, ★★★ | 67-76 s, 0-1, ★★-★★★ | 85-96 s, 3-6, ★ |
| 10 | 8/3/5 +rush+lunch | 24 | 70-75 s, 0-3, ★-★★★ | 70-81 s, 1-3, ★-★★ | 86-96 s, 7-9, ★ |

All 90 runs reached the win card; there were no `data-err` errors in any run. The curve is gradual and nothing is
unwinnable. Because a level can't be lost, even a slow player always wins, only with fewer stars, which suits age 5.
Levels 1-5 are a flat 3 stars for every player style. Level 7 (2 cars plus a rush) is harder than level 8 (3 cars) for
a slow player, a small bump in the curve. Each level takes about 40-95 s, and from level 3 on they are all about
70-90 s long, so later levels feel harder but not longer.

## Other checks

- **Tap flow, level 1 at 390x844: pass.** A tap on the floor-2 row in the shaft sets `target=2`; after 4 s the car is
  at y=6 and its doors are working. A tap in the room area of floor 1 sends the nearest car there. Playing a whole
  level with synthetic canvas taps placed by the hint: 9 taps, 0 landed on the wrong car or floor, won at 44.8 s
  with 3 stars.
- **HUD: pass.** `elementFromPoint` on home, map and mute hits the button, not the canvas. Mute pointer and click
  events left the car target `null`. The floor rows hit the canvas.
- **Pan: pass.** 390x844 never needs to pan (8 floors at 81 px each). At 844x390, levels 8 and 10 pan: a 200 px drag
  moves the camera from the bottom to the top with no car tapped, a tap on the top floor after panning targets it
  correctly, and the edge arrow switches to "down".
- **Idle on level 1: pass.** The hint hand is showing by t=30 s. People turn grumpy, then leave by the stairs
  (1 by 60 s, 31 by 300 s). The phase stays `play`, the floors cap at about 10 people, and there are no errors.
- **Win, next, map, replay: pass.** After `bNext`, level 2 starts at t=0 with 0 delivered, 0 left, 0 people, empty
  queues and the car at y=0. Stars are saved (`goingup.stars={"1":3}`). The map shows levels 1-2 with ★★★ and level 3
  unlocked. Level 1 from the map resets cleanly. The map button mid-level, then Play, resumes the same level with its
  time and people kept. Replay resets.
- **Layout: pass.** Floor heights in px (level 1 / 4 / 8 / 10):

  | Size | Level 1 | Level 4 | Level 8 | Level 10 | Layout |
  | --- | --- | --- | --- | --- | --- |
  | 390x844 | 116 | 95 | 81 | 81 | top bar |
  | 844x390 | 101 | 66 | 73 | 73 | side columns, pans on 8 and 10 |
  | 1024x768 | 199 | 131 | 98 | 87 | side |
  | 768x1024 | 228 | 165 | 123 | 109 | top |
  | 360x640 | 107 | 88 | 74 | 66 | top |

  Every floor is at least 64 px. The HUD sits in its own 56 px band or 64 px columns and never covers the building.
  Nothing is cut off in the screenshots.

## Bugs

1. **A long swipe on a building that doesn't pan counts as a tap where the finger lifts** (low). Steps: level 10 at
   390x844 (no pan), pointerdown in the middle of the screen, move 200 px down, pointerup. Expected: nothing happens,
   since it was a swipe. Actual: car 0 is sent to floor 1, under the point where the finger lifted. The cause is that
   `drag.moved` only becomes true when `view.pan` is true. Children often swipe, so a lift can be sent by accident.
   Fix: mark the drag as moved past about 10-15 px even without pan, and ignore taps that moved.
2. **Confetti from the win card is still on screen in the next level** (cosmetic). Right after `bNext`, `#fx` still
   holds 40 confetti pieces for up to 4.5 s, falling over the new level. Fix: clear `#fx` in `startLevel`.
3. **The map and mute buttons stay in the corner on the map screen** (cosmetic; `t-map.png`, 360x640). The map button
   does nothing there. Hide `#mapBtn` while the phase is `map`.
4. **Level 7 is harder than level 8 for a slower player** (low, balance). Level 7 (2 cars plus a rush of 5) gave 1-3
   stair-leavers, against 1 on level 8. Give level 7 a later first rush or `patience: 32`, or move the rush to level 8.
5. **Levels 1-5 give every player 3 stars, even one tapping every 4 s** (low, balance). That's fine for learning, but
   stars carry no meaning until level 6. Optionally lower patience a little on levels 4-5.

## Kid-UX suggestions

1. Ignore swipes as taps (bug 1). This is the most likely source of "it went the wrong way!" moments.
2. The hand hint on level 1 comes back after 30 s of idling and keeps showing, which is good. On later levels
   (8 s delay) it may pop up while the child is still watching a lift move; consider only showing it when a car is
   idle and someone has waited more than about 35% of their patience.
3. In landscape on a phone (844x390), the building with 8 floors pans. Snap the camera to the floor where someone has
   just turned red, so a child who doesn't know about dragging still sees the problem. The edge arrow helps, but it
   is small.
4. Level lengths are flat (about 70-90 s from level 3 on). That's good for a 5-year-old's attention span; keep later
   targets from growing much further.
5. On the win card, make Next the biggest button. Replay and Map are fine smaller.
