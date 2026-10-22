# Art final: Going Up! (art director, 2026-10-22)

Looked at t-real10 / t-real6 (vehicle designer), gd/q-l10, gd/q-apron, gd/n2-l10p, gd/n2-l4w. No fresh renders
(the newest shots are under 20 minutes old).

## Verdict

Ship-worthy and a clear step up: the cut-away now reads as a real building (slabs, stair core, garage, metro box,
soil section with pipes), rooms are distinct and furnished, shafts have rails and lit indicators, vehicles are
proportioned and grounded. What still breaks the illusion is a handful of intersections and the night city, which
still looks like a flat cut-out with every window lit the same cream. Fix 1-4 and it holds up.

## Notes (ranked by visual impact)

1. **Night neighbours: every window lit, same flat cream.** (t-real10, n2-l4w) Black slab facades with a perfect
   grid of `#F3E3C0`-ish rectangles read as a stencil, not a city. Exact change: at night, light ~35% of neighbour
   windows (seeded random per window), and pick each lit one from 3 warm tints (`#FFD9A0`, `#FFE9C8`, `#CFE3FF` for
   TV-blue) at 0.6-1.0 brightness; unlit ones dark glass `#1C2230` with a faint sky reflection. Give the facades a
   dark-brick/concrete colour (`#2A2622`, `#33302E`) instead of near-black so they have form.
2. **Bushes poking through the side walls.** (t-real6 floor 4 at x~380 and x~1050; t-real10 floor 2 at x~468 and
   x~960; q-l10 right edge at y~555) Round green canopies sit inside the facade envelope at mid-height. Either they
   are street trees placed too close/too tall, or planters too wide. Exact change: keep exterior tree crowns at least
   0.5 m outside the facade plane and below the floor-1 slab, or clamp crown radius so it can't cross the wall.
3. **Pool floor: swimmers are heads lying on the floor.** (t-real6 and q-l10 top floor) With no visible water
   surface the heads read as severed. Exact change: add a translucent water box (`#3FA7C9`, opacity 0.55, slight
   emissive) with its top at chin height and a tiled pool rim in front, so bodies are hidden under water, not under
   the floor.
4. **Bus clips the garage-ramp box.** (t-real6 left, t-real10 left) The bus nose runs into the grey block with the
   red/white striped barrier. Exact change: stop/park the bus at least one bus length left of the ramp box, or move
   the bus stop so the bus never overlaps that box's x-range.
5. **Night interiors don't glow.** (n2-l10p, t-real10) Rooms are dimmer at night than by day, so the cut-away sinks
   into the dark city; only the kitchen is bright. Exact change: at night raise interior lamp/point-light intensity
   ~1.5x and add a warm emissive (`#FFB868`, 0.25) on lamp shades and ceiling fixtures; keep the kitchen at the same
   level as the rest so it doesn't pop.
6. **Unlit signs and metro at night.** The roof "GOING UP" sign and the metro train windows stay dark. Exact change:
   emissive sign letters (`#FFE08A`, 1.0) and train window panes (`#FFF1D0`, 0.8) when night is on; a beacon on the
   mast is already there and works.
7. **Lollipop trees.** (t-real6 left, t-real10) Street trees are saturated sphere clusters, the most candy-like thing
   left. Exact change: darken/desaturate leaves to `#4F6B3A`/`#5E7A45` with per-cluster variation, make the clusters
   flatter/irregular and add 2-3 bare branches between trunk and crown.
8. **Close-up apron camera: tree crown through the canopy, giant octagonal wheel.** (q-apron) If this view is used in
   game, the tree crown passes through the floor-1 slab overhang, and the truck's front wheel is a 8-sided low-poly
   disc far bigger than its body suggests. Exact change: move the tree 1 m out from the facade (same fix as 2), and
   raise the wheel segment count to 16+ with a hub disc; scale it to ~0.9 m diameter.
