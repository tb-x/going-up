# Code review: Going Up! (`elevator/index.html`)

Line numbers are for the current file (2181 lines, with the new art chunk at 235-1436). The game code from
`/* ======== layout ======== */` (1437) on was reviewed; the art chunk was only checked against the API contract.

The simulation core holds up well. I traced every car state (opening, open, closing, closed) and every person state,
and found no stuck riders, no double counting of `delivered`, no boarding into a full car, no doors that never close,
and no patience or stars changing after the win. Level setup resets everything and disposes people before cars, so
riders parented to a car are freed first. The findings below are ranked by severity.

## High

**1. Audio may never unlock on phones (1858).** `unlockAudio` runs only on `pointerdown`. For touch, Chrome counts
user activation on pointerup/touchend, not pointerdown, and iOS WebKit unlocks Web Audio on touchend or click.
- What goes wrong: the first touch creates a suspended `AudioContext` and `resume()` fails. Chrome recovers on a later
  tap through sticky activation, but on iPhone Safari it may stay suspended. `sfx()` returns early whenever
  `state !== 'running'`, so the game plays with no effects (only speech, which starts from a click).
- Fix: register `unlockAudio` in the capture phase for `pointerdown`, `pointerup`, `touchend` and `click`. Keep
  calling `resume()` until the state is `'running'`.

**2. iOS "interrupted" state is never resumed (2040).** `unlockAudio` resumes only when the state is `'suspended'`.
- What goes wrong: after a phone call, Siri, or switching apps, iOS Safari puts the context in `'interrupted'`, and the
  game is silent until reload.
- Fix: `if (SND.ctx.state !== 'running') SND.ctx.resume().catch(() => {});`

## Medium

**3. No `visibilitychange` handling, so the motor hum can stick (2075, main loop).** `updateMotor` sets the motor gain
only from rAF ticks. When the page is hidden, rAF stops, but the `AudioContext` keeps running on desktop and Android.
- What goes wrong: background the game while a lift is moving, and the sawtooth motor drones on at its last gain
  until the user comes back. Queued `speechSynthesis` lines also keep talking.
- Fix: when `document.hidden`, set the motor gain to 0, call `SND.ctx.suspend()` and `speechSynthesis.cancel()`. On
  visible, resume only if not muted.

**4. Multi-touch drops taps (1836-1857).** A second `pointerdown` overwrites the single `drag` object. The first
finger's `pointerup` then fails the `e.pointerId !== drag.id` check and is ignored.
- What goes wrong: a child taps shaft A with one finger and shaft B with another, or taps fast with alternating
  fingers, and the first tap is silently lost. This is very common at age 5.
- Fix: keep a `Map` of active pointers. Any pointer that lifts without moving calls `handleTap`. Only the first pointer
  (or none while two are down) drives the pan.

**5. Tapping the car's own floor cancels the trip just asked for (1790).** In `tap()`,
`carFloorAt(c) === floor && doorState !== 'closing'` sets `queuedTarget = null`. A room-area tap reaches this through
`nearestCar` pass 2, which picks the open car at that floor.
- What goes wrong: on L1 the car is open at the lobby. The child taps the shaft at floor 3, then taps the waiting
  people on the lobby ("get in!"). The floor-3 request is erased, the doors close, and the car stays put.
- Fix: make a same-floor tap a no-op for `queuedTarget`. At most, extend the dwell (`c.dwell = 0`).

**6. Game code depends on the art-internal `artRng` (1530).** `let rng = artRng(...)` drives every game random draw:
spawns, kinds, seeds, confetti. The contract (PLAN §6) says `art*` helpers are internal to the art chunk.
- What goes wrong: it works today because the new chunk happens to define `artRng(seed)`. Any later art drop that
  renames it or changes its sequence throws a ReferenceError at module load (blank game), or silently changes the
  meaning of `?seed`.
- Fix: put a local mulberry32 (`gameRng`) in the state section.

**7. Head-of-line blocking and a misleading "full" flash (1766-1772, idle open at 1724).** Only `queue[0]` is
considered for boarding.
- What goes wrong: a car with one free seat meets a dog walker (2 seats) at the front of the queue. The lamps flash
  red "full" while a lamp is visibly unlit, the 1-seat people behind can't board, and the idle auto-open never fires
  again for that floor. This is frequent on L6 (cap 3, dog walkers).
- Fix: board the first *waiting* person in the queue who fits (and let the idle auto-open check the same). Flash
  "full" only when nobody fits.

## Low

**8. A room tap can hijack a busy car (`nearestCar`, 1794).** Pass 1 accepts any car with closed doors, which includes
cars moving with riders on the way to another floor.
- What goes wrong: on 2-3 car levels, tapping a waiting person on floor 5 reroutes the nearest moving car away from its
  riders' target, even when another car is idle.
- Fix: rank the candidates: idle and empty (`target == null`, no riders), then closed with no riders, then any closed
  car, then nearest.

**9. Retargeting inside the braking distance overshoots and bounces (`moveCar`, 1718-1747).**
- What goes wrong: a car moving at 5.5 u/s needs about 1.7 u to stop. Tapping the floor it is about to pass makes it
  sail past by up to about 1.7 u, then reverse. While it reverses, `Math.sign(c.v) === dir` is false, so rider
  auto-stops are skipped. It looks like a wobble.
- Fix: in `tap()`, if the car is moving toward `floor` and `|goal - y| < v²/(2·CAR_ACCEL)`, keep the old target and
  hold the new floor as `queuedTarget`. Or accept the bounce but keep auto-stops during the reversal.

**10. Speech is never unlocked on iOS after starting muted (2095, 2082).** If the game loads muted, or with `?level=N`,
no `speak()` ever runs inside a user gesture.
- What goes wrong: after unmuting with the button, the number words and "Hooray!" are silent on iOS.
- Fix: in the unmute branch of the mute click handler, and on Play/Resume, call `speak('Going up!')` (or a
  zero-volume utterance) inside the handler.

**11. Star chimes leak into the next level (2006).** The `setTimeout(() => sfx('star', i))` calls are never cleared.
- What goes wrong: tap Replay or Next straight away, and the star chimes play over the new level's "Going up!".
- Fix: keep the timer ids and clear them in `setupLevel`.

## Checked and fine

- Home button markup and CSS match the reference. HUD and home taps can't reach the canvas handlers.
- `touch-action` is set: `none` on body and canvas, `manipulation` on buttons.
- The fonts stylesheet has `crossorigin="anonymous"`.
- The service worker is registered, and `sw.js` uses `PREFIX` `'going-up-'`. `manifest.webmanifest`, the icons and
  `.claude/launch.json` (port 5224) are present.
- The `/* Layout: */` comment, the banner comments and the tuning constants at the top are all in place.
- DPR is capped at 2.
- `?mute` is fully silent: no context is created, and `sfx` and `speak` are gated.
- localStorage access is wrapped in try/catch and namespaced `goingup.`.
- Hit-testing on the z=0 plane, using the view-offset camera, matches the slab lips on every aspect ratio and with
  panning.
- No secrets and no absolute paths. The only grep hit is the word "token" in a comment at 464.
- Outside `artRng`, the game code uses only contract API members, and the new art chunk provides all of them.
