# Going Up! — handoff

Updated 2026-10-23. Published: public repo `tb-x/going-up`, live at https://tb-x.github.io/going-up/ and on the
landing page. Every commit is public now, so run the leak checks before each push. Everything listed under
"Done" is committed; nothing is half-finished in the working tree.

## How to run and test
- Serve the folder: `python -m http.server 5224` (or the root server on 5200, which serves it at `/elevator/`).
- Test hooks: `?level=N` (1–18), `?demo` (the bot plays), `?fast` (4× time), `?tick` (timer-driven ticks for
  background tabs), `?mute` (no audio at all), `?seed=N`, `?legacyFigures` (old per-mesh figure drawing).
  `window.__game.G` has the state; `G.debugLife` counts cars, trains, buses, loo visits, transfers, meals and so on;
  `window.__figStats` and `window.__tbxRenderer.info.render.calls` show the draw cost; `<html data-phase / data-err>`.
- The service worker serves the old page first: unregister it and clear caches in the browser, or reload twice.
- Always test silently (`?mute`); prefer the browser pane over headless Chrome (headless renders on the CPU and
  overloaded the machine before).
- Node tests in `handoff/`: `zonetest.mjs` (zoned lifts and routing), `simtest.mjs` (the bot plays every level, seed by
  seed), `figtest.mjs` and `figrig.mjs` (figure pools; `figrig.mjs` needs a path to a three r160 folder).
- Telemetry (root `_telemetry/`): run its server on 5200, play on a phone or tablet over Wi-Fi at
  `http://<pc-ip>:5200/elevator/`, then `python _telemetry/report.py elevator` for frame times per device.

## Done (high level)
- 18 levels: apartment blocks, offices, hotel, mixed towers; basements with one or two garages and a subway; levels
  15–18 are tall towers (12–20 floors) with zoned lifts, an express car, a sky lobby and automatic transfers.
- Building life: parking cars (one car at a time on the ramps), trains, a bus that drops off and picks up, street
  walkers, right-hand traffic; room figures become passengers and take their seats back; visitors stay in rooms
  without seats; loo trips with real cubicle visits; hotel check-in; a restaurant order–cook–serve–clear–wash cycle;
  busy staff; swimmers; critters (mole, cat, dog walker, crows, pigeons, squirrel); day, dusk and night.
- Realistic cut-away art with real see-through windows, a sloped ramp roof, one floor plaque per floor, solid walls
  with a glass slot on floors a zoned lift skips.
- Performance: figures drawn from 4 shared pools, pooled contact shadows, shadow map every 5 s, adaptive sharpness:
  level 18 is about 200 draw calls (was about 790).
- Contract notes between game and art are in `handoff/EXTENSIONS.md` (read it before changing hooks).

## Open items
1. **Sound and music (done 2026-10-23, see the README's Audio credits; what follows is the original note).** Today: synthesized Web Audio effects (ding, doors, chirp, grumble, stomp, fanfare, star,
   tap, "full", "nope") and the browser's own voice for floor numbers. No music. Missing sounds for the newer life:
   - train in and out and its doors; the bus (brakes, doors); car engines on the ramp;
   - a gentle street ambience (beware: the user found a noise-based hiss loop annoying in Robot Spy, so keep it sparse);
   - toilets (flush, hand dryer), restaurant (plates, the bell at the pass), animals (cat, crow), a light lift motor hum.
   Options:
   - (a) more synthesized sounds plus a synthesized music loop, with Robot Spy's `Music` note scheduler as the reference;
   - (b) Eleven Music or ElevenLabs clips. Allowed only when the user asks, and with a cost estimate first: about
     750 credits a minute for music. Credits were low until 2026-11-09. Follow the licence rules in the root
     CLAUDE.md (README credits and a clip list).
   - The voice is done (2026-10-23): 87 Will clips in `assets/voice/` (floors -5 to 30, 29 floor names, 22 phrases,
     listed in the README). The game uses floors, names, "Going up!" and "Hooray!" so far; the rest are spares for new
     levels and features. `review/voice.html` (not committed) plays them all for listening.
2. **Real-device performance test** through the telemetry report, especially levels 15–18 and an older phone. If it
   still stutters, simplify figures when they're tiny on screen (option 2 from the perf notes), or lower the shadow map size.
3. **Visual checks never done by eye:**
   - the mole popping up;
   - a cabin seen passing through a no-stop slot;
   - the toilet cleaner's round;
   - the restaurant cycle start to finish;
   - the sky lobby queues on a phone (places 6–8 may sit off-screen);
   - readability of white numbers on the palest floor colours (sky lobby lilac, pale lime).
4. **Known quirks:**
   - the toilet cleaner fades in and out at the core end (the user accepted this);
   - a ramp car that starts while the cat is crossing could come close;
   - transparent fading figures in the pools draw in a fixed order rather than sorted.
5. **Published (2026-10-23):** the repo is public with Pages on main / root, the landing card is live, and the root
   CLAUDE.md table row is updated. The whole history was leak-scanned first. The only hit was the local folder name
   `D:\tb-x\elevator\` in an old copy of `handoff/PLAN.md`; it holds no username or secret and is gone from the current files.
6. **Housekeeping:** the root CLAUDE.md telemetry section still says "proposed, not built yet". The telemetry is
   built in `_telemetry/`, so update that section.
