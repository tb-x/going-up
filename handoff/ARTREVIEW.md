# Art review: Going Up! (art director, 2026-10-21)

Looked at: gd/p8b.png, gd/p8.png, gd/l3.png, tester/t-390x844-l10.png, tester/t-844x390-l10.png, gd/raw-l1land.png.

## Verdict

Yes, it reads as a detailed, toy-like doll's-house skyscraper. The rooms are a real step up: telescope dome, greenhouse,
piano and drums, life-ring pool, playroom, library, café and lobby are each recognisable, the roof (water tower, bunting,
"GOING UP!" sign) and the park/city setting are charming, and the colour-coded floor stripes work. What stops it reading
well **for a 5-year-old on a phone** is the game layer on top: the destination bubbles and mood cues are far too small, and
the empty shafts take up half the building in dark grey. Fix notes 1-3 and it's there.

## Notes (ranked by impact)

1. **Destination bubbles are half the spec size.** At 390x844 they are ~22-24 px tall (spec: 48 px, range 40-56); the
   floor icon next to the digit is missing or sub-pixel. Change: size the bubble sprite so it is 46 px tall on screen
   (scale by `46 / canvasPxPerWorldUnit` from the camera distance, not a fixed world size), digit 30 px Verdana bold white
   with a 4 px `#2B2B3A` outline, and the floor icon (cup, book, block, wave, note, leaf, star) at 16 px inside the bubble
   right of the digit. Keep the 3 px white border.

2. **Mood is unreadable at phone size.** The mood ring is a ~4 px dot at the bubble's top-right corner, and faces on the
   ~28 px people can't be read. Change: draw the mood as a full ring round the bubble, 5 px wide, draining green `#35C24A`
   -> amber `#FFB020` -> red `#FF5A4A`; on the face canvas (256x256) double eye size and mouth stroke (mouth line >= 18 px);
   scale people's heads x1.25. When angry, tint the whole bubble border red too, not just the head.

3. **Empty shafts are a dark wall over half the building.** With 3 shafts the right half is `#4A5468`-grey with no cars in
   it (p8b, t-390x844-l10), which makes the tower look gloomy and hides the rooms. Change: back wall `#4A5468` -> `#7A869C`,
   landing doors `#D8DEE6` -> `#EEF1F5` at 85% opacity so the shaft reads as glass, and add a warm vertical light strip
   (`#FFE7A8`, emissive 0.4, 0.08 units wide) on each shaft's back wall.

4. **Rooms look alike (white).** Pool, playroom and lobby back walls are near-white, so floors are told apart only by the
   thin 3 px stripe. Change: tint each back wall to its accent at ~25% over white (pool `#C6F0F5`, play `#FFE2C7`, lobby
   `#FFF1BF`, café `#F9D0CE`, library `#CBDBF7`, music `#E6D5F9`, garden `#CDEFD2`), and make the slab-edge accent stripe
   6 px on screen (about 0.12 units thick). The number badge by each shaft door is ~8 px: make it 18 px.

5. **Landscape framing crops the top.** At 844x390 (t-844x390-l10) the top floors and roof are cut off and a mood/bubble
   popup is clipped under the screen top. Change: fit the camera to the full tower height including the roof with a 56 px
   top margin (HUD height) and 12 px bottom; clamp every bubble's screen y to >= 64 px and x inside 12 px of the edges.

6. **Flat, hazy lighting and dead space at the bottom (portrait).** Everything is a bit washed out, and there are ~100 px
   of empty road under the tower at 390x844. Change: hemisphere light intensity -15%, key directional light +20% from the
   upper left, fog start pushed back so the tower is fog-free; lift the camera target ~0.6 floor heights so the road is a
   ~40 px strip and the tower grows to fill the space.
