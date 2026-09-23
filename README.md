# WOODWARD: DETROIT — Chapter 01: The First Drive

A browser-based, playable historical road trip through Detroit. This is the
first vertical slice: **Woodward Ave → Penobscot Building → Hart Plaza →
Concert**. It proves the core gameplay loop — drive, discover, learn,
listen, perform, unlock — before any more of Detroit (or any other city)
gets built out.

This is **not** a racing game or a GTA clone. The city itself is the
classroom.

## Running it

No build step, no server required for local testing:

1. Download/clone this folder.
2. Open `index.html` in a modern desktop browser, **or**
3. Push it to GitHub Pages / Vercel / Netlify as a static site and open the
   deployed URL.

Everything (Three.js) loads from a CDN, so there's nothing to install.

## Controls

**Desktop:** `W` / `↑` accelerate · `S` / `↓` brake-reverse · `A` / `←` steer
left · `D` / `→` steer right.

**Mobile:** Large on-screen thumb buttons (bottom of screen). Landscape
orientation is recommended and prompted for automatically.

## What's in this slice

- A placeholder 1973-Chevy-inspired vehicle with acceleration, braking,
  reverse, steering, boundary collision, and a cinematic chase camera.
- A procedurally-dressed Woodward Avenue corridor (road, sidewalks,
  streetlights, placeholder buildings) — geometry, not final art.
- The **Penobscot Building**, with a discovery zone that pauses the drive
  and opens an information panel. Historical-fact copy is a clear
  placeholder, structured so real research can be dropped in later.
  Its personal-connection story (the creator worked in this building; a
  WJLB radio connection) is kept in its own separate, clearly-labeled
  section — never mixed into the historical record.
- **Hart Plaza**, unlocked after the Penobscot discovery, which triggers a
  concert unlock and a reusable performance/reward screen.
- A visible Detroit progress tracker (Woodward / Penobscot / Hart Plaza /
  Concert / City Key), persisted to `localStorage`.
- The **architecture** for an in-game radio system with multiple stations
  (Island Spice Radio, WJLB-inspired historical content, STV, H4H, Brass
  Earthling) — station identities exist now, but no stream URLs are wired
  up. Island Spice Radio's existing site
  (https://islandspiceradio.github.io/isr/site/) was not touched or scraped;
  only its name/link are referenced.
- A `cityKey` data structure (`{ city: 'Detroit', unlocked: false }`) that
  the full chapter will eventually flip to `true` once there are enough
  discoveries, radio visits, and performances. It intentionally never
  unlocks in this slice.

## Project structure

```
WOODWARD-DETROIT/
  index.html      canvas + all UI overlays (HUD, discovery, radio, performance, touch controls)
  style.css       cinematic dark UI, mobile-first, safe-area aware
  main.js         everything else — see the section map at the top of the file
  README.md       this file
  /assets/
    /cars/        future vehicle models
    /buildings/   future landmark models
    /detroit/     future city-specific geometry/textures
    /music/       future station audio / performance assets
    /ui/          future UI art
```

`main.js` is organized into 9 clearly-labeled sections (search for the
`====` banners): **City Data, Save/Progress, Scene Setup, Vehicle, Input,
Discovery System, Radio System, Performance System, Game Loop.** Nothing
about the discovery, progress, or performance systems is Detroit-specific —
they all read from the `currentCity` object, which is how new cities and
new landmarks get added without touching the engine.

## How future work slots in

**New landmarks in Detroit** — add an entry to
`CITIES.detroit.landmarks`, and (if you want a custom model instead of the
generic placeholder box) add a `buildX()` method next to `buildPenobscot()`
/ `buildHartPlaza()` in `Scene3D`. The discovery system, progress tracker,
and personal-connection separation all work automatically from the data.

**New cities (Atlanta, New York, Chicago, New Orleans, ...)** — add a new
key to the `CITIES` object with its own `start`, `road`, `landmarks`,
`radioStations`, and `cityKey`. Swap `currentCity = CITIES.atlanta` (or
build a city-select screen) and the rest of the engine — vehicle, input,
discovery, radio, performance, camera — needs no changes.

**Real radio streams** — set `streamUrl` on a station entry in
`radioStations`; `RadioSystem.play()` already knows how to use it.

**Fox Theatre / other performance venues** — mark a landmark
`performanceLocation: true` and it will automatically trigger
`PerformanceSystem`, the same reusable concert flow Hart Plaza uses.

**Walk mode (Fisher Building, etc.)** — the discovery system already
separates "enter radius" from "what happens next"; a future landmark can
set a flag like `mode: 'park-and-walk'` and branch in
`DiscoverySystem.continueDrive()` without disturbing drive-by landmarks.

**Sourced historical research** — each landmark object already has slots
for `historicalFacts`, `radioConnection`, and (separately)
`personalConnection`. Replace the placeholder strings; nothing else needs
to change.

## Deliberately not included yet (per the v0.1 scope)

No backend, no authentication, no multiplayer, no Firebase, no payments,
no full concert/rhythm-game system, no final Key to Detroit award, and no
exact-geography Woodward Avenue. All of that is future work once this
loop is proven out.
