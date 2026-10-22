# SPEC4: street behind the tower, ground alignment, floor markings (lead's spec, authoritative)

User, verbatim: "there is still some misalignment ground level and street; the road should be either in front of or behind
the building so there is a clear separation of pedestrian traffic on the street and in the building; floors should be
marked better (now barely visible in the lower levels) - also duplicated on each elevator shaft".

## Decision: the street goes BEHIND the tower
In front of the cut face (z > 0) there is only the ground's cut edge, so the basements, subway and soil section stay
visible. The city lives behind: the building occupies z 0 … -4.5 (ART.DEPTH).

## Coordinates (world units, y = 0 is the lobby floor top = the pavement top = the road top; nothing at a different height)
- Front, z 0 … +0.6: a clean section through the ground: a paving/kerb edge flush at y = 0 with the soil, rock and
  foundation cross-section below it. No pedestrians, cars, trees, benches or lamps at z > -4.6.
  Only the cut edge, plus grass or planters at most 0.4 tall beside the tower that don't hide the lobby.
- Back pavement z -4.9 … -7.0, top at y = 0 (flush with the lobby floor and the entrance), with a 0.12 kerb at
  z -7.0 down to the road. The prop-free walking strip is at **z -5.6** (`street.clearZ = -5.6`,
  `street.walkZ = -5.6`). Lamps, trees, benches, the bike rack and the bus shelter stand at z -6.4 … -6.9
  (between the strip and the kerb) or behind the road.
- Road z -7.0 … -11.0 (two lanes, centre line at -9.0, lanes at z -8.0 and -10.0), surface y = -0.12.
- Far pavement z -11.0 … -12.5 for the strolling pedestrians; neighbour buildings start at z -13 or further.
- Lobby **back entrance**: a glass double door in the lobby's back wall (left wing), centred at
  `street.entranceX`, with a small canopy over it on the outside. People walk along z -5.6, turn at entranceX, walk
  through the door (it opens) and on to the lane (LANE_Z). The game already walks `[[entranceX, clearZ], [entranceX, laneZ]]`.
- The left wing's lobby props stay clear of the strip from that door to the lane (x ±0.7).
- Parking ramp: comes out of the building's right side wall, rises to y = -0.12 beside the tower, and turns onto
  the back road. carIn leaves the road and goes down the ramp to the bay; carOut does the reverse and joins the traffic.
- Bus stop: on the back pavement at least a bus length clear of the ramp mouth; the bus stops in the near lane (z -8.0).

## Floor markings (all floors, including the basements, and at night)
- A big floor number plaque at the cut edge of every floor, on the left facade column: the number in white Verdana
  bold on the floor's colour, with the icon. Readable on a 390-wide phone (≥ 28 px tall). Self-lit (MeshBasic or
  `toneMapped: false`), so it reads in dark basements and at night.
- **On every lift shaft, on every floor:** a lit sign above the landing with that floor's number and colour (like
  a real lift lobby indicator), same style, ≥ 20 px tall on a phone. The existing small badges get replaced by these.
- Basement floors have the same signs (−1, −2 with the 🚗 and 🚇 icons), not dimmer.
