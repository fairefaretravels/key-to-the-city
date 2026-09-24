# WOODWARD: DETROIT — v0.2

A browser-based, playable historical road trip, now spanning multiple
cities gated by an earned-credits progression system, with a genre-specific
quick-time-event concert at each city's performance venue.

This is still not a racing game or a GTA clone. The city is the classroom;
the concert is the reward for paying attention to it.

## Running it

No build step required:

1. Open `index.html` in a modern desktop browser, **or**
2. Push the folder to GitHub Pages / Vercel / Netlify and open the deployed
   URL.

Three.js loads from a CDN — nothing to install locally.

## Controls

**Driving — Desktop:** `W`/`↑` accelerate · `S`/`↓` brake-reverse ·
`A`/`←` steer left · `D`/`→` steer right.
**Driving — Mobile:** large on-screen thumb buttons, bottom of screen.

**Concert (QTE) — Desktop:** `D` `F` `J` `K`, one key per lane, left to
right.
**Concert (QTE) — Mobile:** four large tap zones along the bottom of the
screen, one per lane.

## What's new in v0.2

### Multiple cities, gated by credits
Detroit is always available. Atlanta, Chicago, and New York each require a
credit threshold (250 / 500 / 800) earned from discoveries and concerts
before they unlock. New Orleans is documented in the data but not yet
built — see "How future work slots in" below for exactly what adding it
takes. Tap the 🗺 button to open the map screen, see what's
locked/unlocked, and switch cities once you've earned your way in.

### NPCs, crowds, and traffic
Pedestrians walk the sidewalks back and forth in every city; stationary
crowds cluster around each performance venue. A handful of ambient traffic
archetypes (sedan, pickup, van, compact) drive the opposite lane. All of it
is placeholder geometry — capsules and boxes — meant to be swapped for real
rigged models later without touching the placement/movement logic.

### Lit buildings
Every building along the corridor now gets a randomized grid of lit and
dark windows per floor, on both street-facing sides, instead of a single
flat emissive strip.

### Concerts are now a real quick-time-event
Reaching a performance venue drops you into a 4-lane rhythm minigame:
notes fall toward a hit line, and you hit the matching lane/key as they
arrive. Each city's genre changes which instrument each lane represents
and the concert's color atmosphere:

| City | Genre | Lanes |
|---|---|---|
| Detroit | Rock | Guitar / Bass / Drums / Vocals |
| Chicago | Blues | Guitar / Harmonica / Bass / Drums |
| Atlanta | Rap | Vocal / Beat / Scratch / Hype |
| New York | Jazz | Sax / Piano / Bass / Drums |

Scoring tracks Perfect/Good/Miss counts and a combo multiplier; a results
screen rates the show (Rough Night → Legendary Set) and pays out credits
toward unlocking the next city.

**Important honesty note on audio:** I can't obtain music licensing or use
real songs/artists on your behalf. The concert's note pattern is generated
procedurally from each placeholder track's BPM (deterministic per song, so
a given track always plays the same pattern), so the minigame is fully
playable with zero audio dependency. When a real, licensed track is ready,
its `audioUrl` slot (see the song library below) is exactly where it goes,
and the note-generation function is the place to swap in a real beat map
synced to that track's timeline instead of the procedural pattern.

### A 30-plus-track song library, with weekly rotation
`SONG_LIBRARY` in `main.js` holds 32 original, unlicensed placeholder
tracks (8 per genre) so no single city loops the same 2-3 songs into the
ground. `getWeeklyFeaturedTrack(genre)` picks a different track each
calendar week using an ISO week-number index — a ready-made hook for
dropping in new licensed songs on a weekly cadence once rights are secured;
it requires no code changes beyond filling in `audioUrl` on new entries.

### Garage: vehicle type, paint, and a custom license plate
Tap the 🚗 button to open the garage: four vehicle silhouettes (muscle,
pickup, lowrider, van), six paint colors, and a license-plate text field
(8 characters, sanitized to letters/numbers/spaces). The plate is rendered
onto a real canvas texture and mounted on the front and back of the car
model, and everything is saved to `localStorage` so it persists between
sessions.

## Project structure

```
WOODWARD-DETROIT/
  index.html      canvas + every UI overlay (HUD, discovery, city select, garage, QTE concert, results)
  style.css       cinematic dark UI, mobile-first, safe-area aware
  main.js         everything else — 14 clearly-labeled sections, see the banner at the top of the file
  README.md       this file
  /assets/        placeholders for future models/audio/UI art (cars, buildings, detroit, music, ui)
```

## How future work slots in

**Add New Orleans (or any new city)** — add a full entry to the `CITIES`
object following the Atlanta/Chicago/New York pattern (`genre`,
`unlockCost`, `palette`, `road`, `landmarks`, `radioStations`, `cityKey`),
then add its id to `CITY_ORDER`. Everything else — NPCs, traffic, lit
buildings, discovery, the QTE concert, credits — works automatically from
that data.

**More landmarks per city** — add entries to that city's `landmarks`
array; give one `performanceLocation: true` to make it a concert venue.

**Real licensed songs** — add an entry to the right genre array in
`SONG_LIBRARY` with a real `audioUrl`, or fill in the URL on an existing
placeholder entry once you've cleared rights for that specific title.

**Real beat-synced QTE instead of procedural patterns** — replace the
body of `PerformanceSystem.generatePattern()` with a beat map tied to the
real track's timestamp, and swap the manual `requestAnimationFrame` clock
for the `<audio>` element's own `currentTime`.

**Rigged NPC/vehicle models** — swap the placeholder geometry inside
`NPCSystem.buildPerson()` / `TrafficSystem.buildCar()` / `Vehicle.buildCarMesh()`
for loaded GLTF models; the surrounding movement and placement code doesn't
care what mesh it's animating.

## Deliberately not included yet

No backend, no authentication, no multiplayer, no real audio/licensing, no
exact city geography, and New Orleans is data-only (not yet a playable
map). All are natural next steps once this loop is validated.
