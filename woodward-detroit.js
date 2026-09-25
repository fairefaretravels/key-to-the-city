/* ============================================================================
   WOODWARD: DETROIT — v0.2
   ----------------------------------------------------------------------------
   Builds on the Chapter 01 vertical slice with:
     - Multiple playable city maps, gated behind an earned-credits system
     - Walking NPCs + pedestrian groups, ambient traffic with car variety
     - Lit building windows
     - A lane-based quick-time-event concert system, one genre per city
       (rock / blues / rap / jazz), each with its own instrument mapping
       and lighting atmosphere
     - A 30-track placeholder song library with a weekly-rotation hook,
       ready for real licensed audio later
     - A garage: vehicle type, paint color, and a custom license plate
       rendered onto the car itself

   SECTION MAP:
     1. SONG LIBRARY
     2. CITY DATA
     3. SAVE / PROGRESS  (credits, unlocked cities, garage choices)
     4. SCENE SETUP      (per-city palette, lit buildings, landmarks)
     5. NPCS & TRAFFIC
     6. VEHICLE           (type/color/plate texture)
     7. INPUT              (driving + QTE key bindings)
     8. DISCOVERY SYSTEM
     9. RADIO SYSTEM
    10. PERFORMANCE / QTE SYSTEM
    11. CITY PROGRESSION / SELECT
    12. GARAGE
    13. UI GLUE
    14. GAME LOOP
============================================================================ */

/* ============================================================================
   1. SONG LIBRARY
   ----------------------------------------------------------------------------
   Placeholder track metadata only — original titles, no real artists, no
   lyrics. `audioUrl` is the slot for a real, licensed track later; until
   then the QTE note pattern is generated procedurally from `bpm` + `seed`
   so the minigame is fully playable without audio.
   A 30-track library keeps any one city from looping the same 2-3 songs
   into the ground. `getWeeklyRotation()` reshuffles which tracks are
   "featured" based on the calendar week, as a hook for dropping in new
   licensed songs on a cadence without touching game code.
============================================================================ */

const SONG_LIBRARY = {
  alternative: [
    {
      id: 'alternative-0',
      title: 'Collect The Vibe',
      artist: 'Lavelle feat The Switchblades',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/Lavelle feat The Switchblades - Collect The Vibe .mp3'
    },
    {
      id: 'alternative-1',
      title: '4-X-4',
      artist: '',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/4-x-4.mp3'
    },
    {
      id: 'alternative-2',
      title: 'Throwback',
      artist: 'AL LUV FT SWITCHBLADES',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/AL LUV FT SWITCHBLADES - THROWBACK.mp3'
    },
    {
      id: 'alternative-3',
      title: 'All Dat Ass',
      artist: '',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/ALL DAT ASS.mp3'
    },
    {
      id: 'alternative-4',
      title: 'Alexa',
      artist: '',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/Alexa (Remastered).mp3'
    },
    {
      id: 'alternative-5',
      title: 'All I Have In This World',
      artist: '',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/All I have In This World.mp3'
    },
    {
      id: 'alternative-6',
      title: 'Disclaimer',
      artist: '',
      genre: 'alternative',
      bpm: null,
      audioUrl: '/assets/music/Disclaimer.mp3'
    }
  ],

  rock: [
    'Midnight Overdrive', 'Steel City Static', 'Chrome Horizon', 'Woodward Thunder',
    'Ignition Line', 'Neon Exhaust', 'Riverfront Riot', 'Eight Cylinder Heart',
  ].map((t, i) => ({
    id: `rock-${i}`,
    title: t,
    genre: 'rock',
    bpm: 128 + (i % 4) * 6,
    audioUrl: null
  })),

  blues: [
    'Backseat Confession', 'Low Water Blues', 'Gravel Road Sermon', 'Copper Line',
    'Twelve Bar Sundown', 'Rust Belt Lullaby', 'Slow Burn Avenue', 'Delta to Detroit',
  ].map((t, i) => ({
    id: `blues-${i}`,
    title: t,
    genre: 'blues',
    bpm: 78 + (i % 4) * 4,
    audioUrl: null
  })),

  rap: [
    'City Key Cypher', 'Concrete Kingdom', 'Corner Store Legend', 'Skyline Flow',
    'Downbeat District', 'Motor City Motive', 'Trap Plaza', 'First Gear Anthem',
  ].map((t, i) => ({
    id: `rap-${i}`,
    title: t,
    genre: 'rap',
    bpm: 90 + (i % 4) * 8,
    audioUrl: null
  })),

  jazz: [
    'Late Set at Hart Plaza', 'Blue Hour Sax', 'Riverside Standard', 'After Hours Avenue',
    'Brushed Cymbal Nights', 'Uptown Interlude', 'Velvet Downtown', 'Quiet Storm Detroit',
  ].map((t, i) => ({
    id: `jazz-${i}`,
    title: t,
    genre: 'jazz',
    bpm: 92 + (i % 4) * 4,
    audioUrl: null
  }))
};

const ALL_SONGS = Object.values(SONG_LIBRARY).flat();

function getIsoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Picks this week's "featured" track for a genre, so repeat players hear a
// different song each week even before any real licensed tracks are added.
function getWeeklyFeaturedTrack(genre) {
  const pool = SONG_LIBRARY[genre] || SONG_LIBRARY.rock;
  const week = getIsoWeekNumber();
  return pool[week % pool.length];
}

/* ============================================================================
   2. CITY DATA
============================================================================ */

const CITIES = {
  detroit: {
    id: 'detroit',
    name: 'Detroit',
    genre: 'rock',
    unlockCost: 0, // always available
    palette: { fog: 0x0a0d13, ground: 0x14171c, accent: 0xff5533 },
    start: { x: 0, z: 0, heading: 0 },
    road: { width: 14, length: 900 },
    landmarks: [
      {
        id: 'penobscot', name: 'PENOBSCOT BUILDING', position: { x: 2, z: -280 },
        discoveryRadius: 26, unlocksProgressKey: 'penobscot', rewardPoints: 100,
        meta: 'Downtown Detroit · Art Deco skyscraper',
        historicalFacts: 'The full game will contain researched historical information about the Penobscot Building here — its architecture, its place on the Detroit skyline, and its radio history. This is placeholder copy until sourced facts are added.',
        radioConnection: 'WJLB',
        personalConnection: 'Placeholder: the creator of this game worked in the Penobscot Building. Their personal story — and its WJLB radio connection — will go here, clearly separated from the historical record above.',
      },
      {
        id: 'hart-plaza', name: 'HART PLAZA', position: { x: 2, z: -560 },
        discoveryRadius: 30, unlocksProgressKey: 'hartPlaza', rewardPoints: 100,
        meta: 'Detroit riverfront · public gathering space',
        historicalFacts: 'The full game will contain researched historical information about Hart Plaza here — its role as a civic and performance space along the Detroit River. This is placeholder copy until sourced facts are added.',
        radioConnection: null, personalConnection: null,
        performanceLocation: true, performanceVenueName: 'HART PLAZA',
      },
    ],
    // NOTE: "8 Mile Radio" is added FIRST so it is the default station the
    // player hears when the radio panel is opened. Its `genre: 'alternative'`
    // field is what routes it to the SONG_LIBRARY.alternative playlist (the
    // seven real MP3s) — see RadioSystem.getStationGenre() below. All five
    // original stations are preserved unchanged, just shifted down one slot.
    radioStations: [
      { id: '8-mile-radio', name: '8 MILE RADIO', streamUrl: null, genre: 'alternative', historyBlurb: 'Detroit alternative mix — original tracks, rotating weekly.' },
      { id: 'island-spice-radio', name: 'ISLAND SPICE RADIO', streamUrl: null, infoUrl: 'https://islandspiceradio.github.io/isr/site/', historyBlurb: 'An existing independent station in the Saneca network.' },
      { id: 'wjlb-historical', name: 'WJLB (HISTORICAL)', streamUrl: null, historyBlurb: 'Placeholder for historical WJLB content.' },
      { id: 'stv', name: 'STV', streamUrl: null, historyBlurb: 'Placeholder for STV content.' },
      { id: 'h4h', name: 'H4H', streamUrl: null, historyBlurb: 'Placeholder for H4H content.' },
      { id: 'brass-earthling', name: 'BRASS EARTHLING', streamUrl: null, historyBlurb: 'Placeholder for Brass Earthling content.' },
    ],
    cityKey: { city: 'Detroit', unlocked: false },
  },

  atlanta: {
    id: 'atlanta', name: 'Atlanta', genre: 'rap', unlockCost: 250,
    palette: { fog: 0x120c14, ground: 0x1a1418, accent: 0xff3fa4 },
    start: { x: 0, z: 0, heading: 0 },
    road: { width: 14, length: 700 },
    landmarks: [
      {
        id: 'centennial-park', name: 'CENTENNIAL OLYMPIC PARK', position: { x: 2, z: -320 },
        discoveryRadius: 28, unlocksProgressKey: 'atlLandmark1', rewardPoints: 100,
        meta: 'Downtown Atlanta · public gathering space',
        historicalFacts: 'Placeholder — sourced history of Centennial Olympic Park goes here.',
        radioConnection: null, personalConnection: null,
        performanceLocation: true, performanceVenueName: 'CENTENNIAL OLYMPIC PARK',
      },
    ],
    radioStations: [{ id: 'atl-local', name: 'ATL LOCAL', streamUrl: null, historyBlurb: 'Placeholder Atlanta station.' }],
    cityKey: { city: 'Atlanta', unlocked: false },
  },

  chicago: {
    id: 'chicago', name: 'Chicago', genre: 'blues', unlockCost: 500,
    palette: { fog: 0x0c1016, ground: 0x161a1f, accent: 0x4fa8ff },
    start: { x: 0, z: 0, heading: 0 },
    road: { width: 14, length: 700 },
    landmarks: [
      {
        id: 'buddy-guys-corner', name: 'BLUES CORNER', position: { x: 2, z: -320 },
        discoveryRadius: 28, unlocksProgressKey: 'chiLandmark1', rewardPoints: 100,
        meta: 'South Loop · historic blues district',
        historicalFacts: 'Placeholder — sourced history of Chicago\u2019s blues clubs goes here.',
        radioConnection: null, personalConnection: null,
        performanceLocation: true, performanceVenueName: 'BLUES CORNER',
      },
    ],
    radioStations: [{ id: 'chi-local', name: 'CHI LOCAL', streamUrl: null, historyBlurb: 'Placeholder Chicago station.' }],
    cityKey: { city: 'Chicago', unlocked: false },
  },

  newyork: {
    id: 'newyork', name: 'New York', genre: 'jazz', unlockCost: 800,
    palette: { fog: 0x0a0c12, ground: 0x14161c, accent: 0xd9c98a },
    start: { x: 0, z: 0, heading: 0 },
    road: { width: 14, length: 700 },
    landmarks: [
      {
        id: 'harlem-stage', name: 'HARLEM STAGE', position: { x: 2, z: -320 },
        discoveryRadius: 28, unlocksProgressKey: 'nycLandmark1', rewardPoints: 100,
        meta: 'Harlem · historic jazz venue district',
        historicalFacts: 'Placeholder — sourced history of Harlem\u2019s jazz stages goes here.',
        radioConnection: null, personalConnection: null,
        performanceLocation: true, performanceVenueName: 'HARLEM STAGE',
      },
    ],
    radioStations: [{ id: 'nyc-local', name: 'NYC LOCAL', streamUrl: null, historyBlurb: 'Placeholder New York station.' }],
    cityKey: { city: 'New York', unlocked: false },
  },

  // Documented but not yet built — following this exact pattern is all
  // that's needed to bring it online (see README "How future work slots in").
  neworleans: { id: 'neworleans', name: 'New Orleans', comingSoon: true, unlockCost: 1200 },
};

const CITY_ORDER = ['detroit', 'atlanta', 'chicago', 'newyork', 'neworleans'];

// Genre -> instrument-per-lane + atmosphere mapping for the QTE system.
const GENRE_CONFIG = {
  rock: { lanes: ['GUITAR', 'BASS', 'DRUMS', 'VOCALS'], hitColor: '#ff5533', label: 'ROCK' },
  blues: { lanes: ['GUITAR', 'HARMONICA', 'BASS', 'DRUMS'], hitColor: '#4fa8ff', label: 'BLUES' },
  rap: { lanes: ['VOCAL', 'BEAT', 'SCRATCH', 'HYPE'], hitColor: '#ff3fa4', label: 'RAP' },
  jazz: { lanes: ['SAX', 'PIANO', 'BASS', 'DRUMS'], hitColor: '#d9c98a', label: 'JAZZ' },
};

let currentCity = CITIES.detroit;

/* ============================================================================
   3. SAVE / PROGRESS
============================================================================ */

const SAVE_KEY = 'woodward-detroit-save-v2';

const ProgressManager = {
  state: null,

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    this.state = Object.assign(this.defaultState(), parsed || {});
    this.render();
    return this.state;
  },

  defaultState() {
    return {
      woodward: true,
      penobscot: false,
      hartPlaza: false,
      concert: false,
      cityKey: false,
      credits: 0,
      unlockedCities: ['detroit'],
      landmarksDiscovered: {},
      garage: { vehicleType: 'muscle', color: '#8a1f2b', plate: 'DETROIT' },
    };
  },

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    this.render();
  },

  addCredits(amount) {
    this.state.credits += amount;
    document.getElementById('credits-count').textContent = this.state.credits;
    this.save();
  },

  markDiscovered(landmarkId, progressKey, points) {
    if (!this.state.landmarksDiscovered[landmarkId]) {
      this.state.landmarksDiscovered[landmarkId] = true;
      this.state[progressKey] = true;
      this.addCredits(points);
    }
  },

  markConcertComplete(creditsEarned) {
    this.state.concert = true;
    this.addCredits(creditsEarned);
  },

  isCityUnlocked(cityId) {
    return this.state.unlockedCities.includes(cityId);
  },

  unlockCity(cityId) {
    if (!this.state.unlockedCities.includes(cityId)) {
      this.state.unlockedCities.push(cityId);
      this.save();
    }
  },

  render() {
    document.getElementById('credits-count').textContent = this.state.credits;
    const list = document.getElementById('progress-list');
    if (!list) return;
    const rows = [
      ['Woodward', this.state.woodward],
      ['Penobscot', this.state.penobscot],
      ['Hart Plaza', this.state.hartPlaza],
      ['Concert', this.state.concert],
      ['City Key', this.state.cityKey],
    ];
    list.innerHTML = rows.map(([label, done]) => {
      const cls = done ? 'status-done' : 'status-locked';
      const icon = done ? '✓' : '🔒';
      return `<li><span>${label}</span><span class="${cls}">${icon}</span></li>`;
    }).join('');
  },
};

/* ============================================================================
   4. SCENE SETUP
============================================================================ */

const Scene3D = {
  renderer: null, scene: null, camera: null, clock: new THREE.Clock(),
  dynamicGroup: null, // cleared/rebuilt when switching cities

  init() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);

    this.buildLights();
    this.loadCity(currentCity);

    window.addEventListener('resize', () => this.onResize());
  },

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9fb4d8, 0x0a0a0a, 0.55);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xbcd4ff, 0.7);
    this.moon.position.set(-60, 120, -40);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    this.moon.shadow.camera.left = -200;
    this.moon.shadow.camera.right = 200;
    this.moon.shadow.camera.top = 200;
    this.moon.shadow.camera.bottom = -200;
    this.scene.add(this.moon);
  },

  // Rebuilds the whole static+dynamic city environment. Called on load and
  // whenever the player switches maps.
  loadCity(city) {
    currentCity = city;
    if (this.dynamicGroup) {
      this.scene.remove(this.dynamicGroup);
    }
    this.dynamicGroup = new THREE.Group();
    this.scene.add(this.dynamicGroup);

    this.scene.background = new THREE.Color(city.palette.fog);
    this.scene.fog = new THREE.Fog(city.palette.fog, 60, 420);

    this.buildRoad(city);
    this.buildCityDressing(city);
    NPCSystem.rebuild(city);
    TrafficSystem.rebuild(city);

    document.getElementById('hud-city-name').textContent = 'WOODWARD: ' + city.name.toUpperCase();
    if (Vehicle.mesh) {
      Vehicle.position.set(city.start.x, 0, city.start.z);
      Vehicle.heading = city.start.heading;
      Vehicle.speed = 0;
      Vehicle.syncMesh();
    }
    DiscoverySystem.discoveredIds = new Set(
      Object.keys(ProgressManager.state.landmarksDiscovered).filter((id) =>
        city.landmarks.some((lm) => lm.id === id)
      )
    );
  },

  buildRoad(city) {
    const { width, length } = city.road;
    const groundGeo = new THREE.PlaneGeometry(400, length + 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: city.palette.ground, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -length / 2 + 100);
    ground.receiveShadow = true;
    this.dynamicGroup.add(ground);

    const roadGeo = new THREE.PlaneGeometry(width, length);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -length / 2 + 50);
    road.receiveShadow = true;
    this.dynamicGroup.add(road);

    const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd9c98a });
    for (let z = 30; z > -length + 40; z -= 10) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.01, z);
      this.dynamicGroup.add(dash);
    }

    const curbGeo = new THREE.BoxGeometry(1, 0.25, length);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33 });
    [-(width / 2 + 0.5), width / 2 + 0.5].forEach((x) => {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(x, 0.1, -length / 2 + 50);
      curb.receiveShadow = true;
      this.dynamicGroup.add(curb);
    });

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffb15c, emissiveIntensity: 1.4 });
    const sideOffset = width / 2 + 2.5;
    for (let z = 20; z > -length + 40; z -= 24) {
      [-sideOffset, sideOffset].forEach((x) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8), poleMat);
        pole.position.set(x, 3.5, z);
        this.dynamicGroup.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
        lamp.position.set(x, 7, z);
        this.dynamicGroup.add(lamp);
      });
    }
  },

  // Buildings now carry multiple lit windows per face (randomized on/off),
  // per the "put lights in the buildings" request.
  buildCityDressing(city) {
    const { width, length } = city.road;
    const baseColors = [0x23262c, 0x2a2d33, 0x1c1f24, 0x30333a];

    for (let z = 10; z > -length + 30; z -= 22) {
      [-1, 1].forEach((side) => {
        const h = 10 + Math.random() * 40;
        const w = 8 + Math.random() * 6;
        const d = 8 + Math.random() * 6;
        const mat = new THREE.MeshStandardMaterial({
          color: baseColors[Math.floor(Math.random() * baseColors.length)], roughness: 0.85,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        const x = side * (width / 2 + 8 + w / 2);
        building.position.set(x, h / 2, z + (Math.random() * 6 - 3));
        building.castShadow = true;
        building.receiveShadow = true;
        this.dynamicGroup.add(building);
        this.addBuildingWindows(building, x, h, w, side);
      });
    }

    this.buildLandmarks(city);
  },

  addBuildingWindows(building, x, h, w, side) {
    const floors = Math.max(2, Math.floor(h / 3.2));
    const cols = Math.max(2, Math.floor(w / 2.2));
    const winW = (w / cols) * 0.55;
    const winH = (h / floors) * 0.5;
    const winGeo = new THREE.PlaneGeometry(winW, winH);
    const litMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, emissive: 0xffdf9e, emissiveIntensity: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14151a, emissive: 0x000000 });

    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.45;
        const win = new THREE.Mesh(winGeo, lit ? litMat : darkMat);
        const wx = x + side * (w / 2 + 0.02);
        const wy = (f + 0.6) * (h / floors);
        const wz = building.position.z - w / 2 + (c + 0.5) * (w / cols);
        win.position.set(wx, wy, wz);
        win.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
        this.dynamicGroup.add(win);
      }
    }
  },

  buildLandmarks(city) {
    city.landmarks.forEach((lm) => {
      let mesh;
      if (lm.id === 'penobscot') mesh = this.buildPenobscot();
      else if (lm.id === 'hart-plaza' || lm.performanceLocation) mesh = this.buildPerformanceVenue(city);
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 10), new THREE.MeshStandardMaterial({ color: 0x33363c }));
      mesh.position.set(lm.position.x, mesh.position.y, lm.position.z);
      mesh.userData.landmarkId = lm.id;
      this.dynamicGroup.add(mesh);
      lm._worldPosition = new THREE.Vector3(lm.position.x, 0, lm.position.z);
    });
  },

  buildPenobscot() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.7, metalness: 0.15 });
    const baseHeight = 18;
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, baseHeight, 14), stoneMat);
    base.position.y = baseHeight / 2;
    base.castShadow = true;
    group.add(base);
    const towerHeight = 46;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(9, towerHeight, 9), stoneMat);
    tower.position.y = baseHeight + towerHeight / 2;
    tower.castShadow = true;
    group.add(tower);
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff3311, emissiveIntensity: 1.6 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), beaconMat);
    beacon.position.y = baseHeight + towerHeight + 1.5;
    group.add(beacon);
    return group;
  },

  // Generic performance-venue model reused across cities (Hart Plaza,
  // Centennial Park, Blues Corner, Harlem Stage) — same reusable
  // architecture the PerformanceSystem uses for the concert itself.
  buildPerformanceVenue(city) {
    const group = new THREE.Group();
    const accentColor = city.palette.accent;

    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 });
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.3, 24), plazaMat);
    plaza.position.y = 0.15;
    plaza.receiveShadow = true;
    group.add(plaza);

    const stageMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f });
    const stage = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 6), stageMat);
    stage.position.set(0, 0.9, -10);
    stage.castShadow = true;
    group.add(stage);

    const spireMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.4, roughness: 0.4, emissive: accentColor, emissiveIntensity: 0.3 });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1, 20, 10), spireMat);
    spire.position.set(0, 10, 6);
    spire.castShadow = true;
    group.add(spire);

    const stageLight = new THREE.PointLight(accentColor, 1.2, 30);
    stageLight.position.set(0, 6, -10);
    group.add(stageLight);

    return group;
  },

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
};

/* ============================================================================
   5. NPCS & TRAFFIC
============================================================================ */

// Simple low-poly placeholder pedestrians: a body + head, walking back and
// forth along the sidewalk line, plus stationary clusters ("groups of
// people") near performance venues. Replace with real rigged models later —
// the movement/placement logic doesn't care what mesh it's animating.
const NPCSystem = {
  group: null,
  walkers: [],

  rebuild(city) {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.walkers = [];

    const sideOffset = city.road.width / 2 + 3.2;
    const walkerCount = 14;
    for (let i = 0; i < walkerCount; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const z = -Math.random() * (city.road.length - 80) + 10;
      const npc = this.buildPerson();
      npc.position.set(side * sideOffset + (Math.random() * 1.4 - 0.7), 0, z);
      this.group.add(npc);
      this.walkers.push({
        mesh: npc, side, baseX: side * sideOffset,
        z, speed: 1.2 + Math.random() * 1.4,
        dir: Math.random() > 0.5 ? 1 : -1,
        range: city.road.length - 80,
      });
    }

    // Stationary clusters near each performance venue ("groups of people")
    city.landmarks.filter((lm) => lm.performanceLocation).forEach((lm) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const person = this.buildPerson();
        person.position.set(
          lm.position.x + Math.cos(angle) * (14 + Math.random() * 6),
          0,
          lm.position.z + Math.sin(angle) * (14 + Math.random() * 6)
        );
        person.rotation.y = -angle;
        this.group.add(person);
      }
    });
  },

  buildPerson() {
    const group = new THREE.Group();
    const shirtColors = [0x3a5a8a, 0x8a3a3a, 0x3a8a5a, 0x8a7a3a, 0x555555];
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColors[Math.floor(Math.random() * shirtColors.length)] });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a17a });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x24262b });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.7, 4, 8), shirtMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 8), pantsMat);
    legs.position.y = 0.35;
    group.add(legs);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), skinMat);
    head.position.y = 1.6;
    group.add(head);

    return group;
  },

  update(dt) {
    this.walkers.forEach((w) => {
      w.z += w.speed * w.dir * dt;
      if (w.z < -w.range + 10 || w.z > 10) w.dir *= -1;
      w.mesh.position.z = w.z;
      // Slight bob for a "walking" feel without full animation rigging
      w.mesh.position.y = Math.abs(Math.sin(w.z * 1.5)) * 0.03;
      w.mesh.rotation.y = w.dir > 0 ? Math.PI : 0;
    });
  },
};

// Ambient oncoming traffic in the opposite lane, with a few visually
// distinct archetypes ("different types of cars").
const TrafficSystem = {
  group: null,
  cars: [],

  archetypes: [
    { name: 'sedan', size: [1.9, 0.6, 4.2], color: 0x37414d },
    { name: 'pickup', size: [2.0, 0.8, 5.0], color: 0x4a4238 },
    { name: 'van', size: [2.1, 1.1, 4.8], color: 0x2f3336 },
    { name: 'compact', size: [1.7, 0.55, 3.6], color: 0x5a2f2f },
  ],

  rebuild(city) {
    if (this.group) Scene3D.scene.remove(this.group);
    this.group = new THREE.Group();
    Scene3D.scene.add(this.group);
    this.cars = [];

    const laneX = -(city.road.width / 4); // opposite lane from the player
    const count = 6;
    for (let i = 0; i < count; i++) {
      const archetype = this.archetypes[i % this.archetypes.length];
      const car = this.buildCar(archetype);
      const z = -Math.random() * city.road.length;
      car.position.set(laneX, archetype.size[1] / 2 + 0.05, z);
      car.rotation.y = Math.PI; // facing toward the player start
      this.group.add(car);
      this.cars.push({ mesh: car, z, speed: 8 + Math.random() * 6, range: city.road.length });
    }
  },

  buildCar(archetype) {
    const [w, h, d] = archetype.size;
    const mat = new THREE.MeshStandardMaterial({ color: archetype.color, metalness: 0.3, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.castShadow = true;
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffdca0, emissiveIntensity: 1 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.2, 0.05), lightMat);
    tail.position.set(0, 0, -d / 2 - 0.02);
    body.add(tail);
    return body;
  },

  update(dt) {
    this.cars.forEach((c) => {
      c.z += c.speed * dt;
      if (c.z > 30) c.z = -c.range + 10;
      c.mesh.position.z = c.z;
    });
  },
};

/* ============================================================================
   6. VEHICLE
============================================================================ */

const VEHICLE_TYPES = {
  muscle: { label: 'MUSCLE', size: [2.1, 0.7, 4.6] },
  pickup: { label: 'PICKUP', size: [2.2, 0.85, 5.0] },
  lowrider: { label: 'LOWRIDER', size: [2.0, 0.5, 4.4] },
  van: { label: 'VAN', size: [2.15, 1.0, 4.8] },
};

const VEHICLE_COLORS = ['#8a1f2b', '#1f4a8a', '#1f8a4d', '#d9a441', '#1a1a1a', '#e8e6df'];

const Vehicle = {
  mesh: null, position: new THREE.Vector3(0, 0, 0), heading: 0, speed: 0,
  maxSpeed: 26, reverseMaxSpeed: -10, acceleration: 14, brakeStrength: 22,
  drag: 8, turnRate: 1.9, frozen: false,

  init() {
    const { x, z, heading } = currentCity.start;
    this.position.set(x, 0, z);
    this.heading = heading;
    this.rebuildMesh();
  },

  rebuildMesh() {
    if (this.mesh) Scene3D.scene.remove(this.mesh);
    const g = ProgressManager.state.garage;
    this.mesh = this.buildCarMesh(g.vehicleType, g.color, g.plate);
    Scene3D.scene.add(this.mesh);
    this.syncMesh();
  },

  buildCarMesh(typeId, colorHex, plateText) {
    const type = VEHICLE_TYPES[typeId] || VEHICLE_TYPES.muscle;
    const [bw, bh, bd] = type.size;
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.4, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1218, metalness: 0.6, roughness: 0.15 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 0.9, roughness: 0.2 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bodyMat);
    body.position.y = bh * 0.8;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.86, bh * 0.8, bd * 0.48), glassMat);
    cabin.position.set(0, bh * 1.5, -bd * 0.04);
    cabin.castShadow = true;
    group.add(cabin);

    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.05, 0.3, 0.25), chromeMat);
    bumperFront.position.set(0, 0.45, bd / 2);
    group.add(bumperFront);
    const bumperBack = bumperFront.clone();
    bumperBack.position.z = -bd / 2;
    group.add(bumperBack);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14);
    const wheelPositions = [
      [-bw / 2 + 0.1, 0.42, bd / 2 - 0.9], [bw / 2 - 0.1, 0.42, bd / 2 - 0.9],
      [-bw / 2 + 0.1, 0.42, -bd / 2 + 0.9], [bw / 2 - 0.1, 0.42, -bd / 2 + 0.9],
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xfff0c0, emissiveIntensity: 1.2 });
    [-bw * 0.3, bw * 0.3].forEach((hx) => {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), headlightMat);
      headlight.position.set(hx, 0.55, bd / 2 - 0.1);
      group.add(headlight);
    });

    const headlamp = new THREE.SpotLight(0xfff0c0, 1.2, 40, Math.PI / 6, 0.4);
    headlamp.position.set(0, 1, bd / 2);
    headlamp.target.position.set(0, 0, bd / 2 + 10);
    group.add(headlamp);
    group.add(headlamp.target);

    // Custom license plate, rendered via canvas texture, front and back.
    const plateTexture = this.buildPlateTexture(plateText);
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture });
    const plateGeo = new THREE.PlaneGeometry(0.7, 0.32);
    const platePositions = [
      { z: bd / 2 + 0.13, ry: 0 },
      { z: -bd / 2 - 0.13, ry: Math.PI },
    ];
    platePositions.forEach((p) => {
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(0, 0.45, p.z);
      plate.rotation.y = p.ry;
      group.add(plate);
    });

    return group;
  },

  buildPlateTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eae6d8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#14171c';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = '#14171c';
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((text || 'DETROIT').toUpperCase().slice(0, 8), 128, 68);
    ctx.font = '14px sans-serif';
    ctx.fillText('WOODWARD', 128, 104);
    return new THREE.CanvasTexture(canvas);
  },

  update(dt, input) {
    if (input.accel) this.speed += this.acceleration * dt;
    else if (input.brake) this.speed -= this.brakeStrength * dt;
    else {
      const dragAmount = this.drag * dt;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - dragAmount);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + dragAmount);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, this.reverseMaxSpeed, this.maxSpeed);

    // Steering comes from Input.steering: a normalized value (-1 = full left,
    // 0 = centered, 1 = full right) sourced from keyboard, the touch steering
    // wheel, or a mouse dragging that wheel. The existing turn-rate physics
    // below just consumes that value instead of discrete left/right flags.
    const steering = THREE.MathUtils.clamp(input.steering || 0, -1, 1);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0.15, 1);
    if (steering !== 0) {
      this.heading -= steering * this.turnRate * speedFactor * dt * (this.speed < 0 ? -1 : 1);
    }

    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;

    const halfWidth = currentCity.road.width / 2 - 1.2;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -halfWidth, halfWidth);
    const minZ = -(currentCity.road.length - 60);
    this.position.z = THREE.MathUtils.clamp(this.position.z, minZ, 40);

    this.syncMesh();
  },

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
  },
};

/* ============================================================================
   7. INPUT
============================================================================ */

const Input = {
  // `left`/`right` remain as discrete keyboard flags (unchanged behavior).
  // `wheelSteering` is the continuous -1..1 value driven by the steering wheel.
  state: { accel: false, brake: false, left: false, right: false },
  wheelSteering: 0,
  qteKeys: { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 },

  // Input.steering is the single source of truth Vehicle.update() reads:
  // -1 = full left, 0 = centered, 1 = full right. Keyboard input (discrete)
  // takes priority when a steer key is held; otherwise the wheel's
  // continuous value (from touch or mouse dragging) is used.
  get steering() {
    if (this.state.left || this.state.right) {
      return (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    }
    return this.wheelSteering;
  },

  init() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));
    this.bindTouchButton('btn-accel', 'accel');
    this.bindTouchButton('btn-brake', 'brake');
    SteeringWheel.init();

    document.querySelectorAll('.qte-touch-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        PerformanceSystem.hitLane(parseInt(btn.dataset.lane, 10));
      });
    });
  },

  handleKey(e, isDown) {
    if (PerformanceSystem.active) {
      if (isDown && this.qteKeys[e.code] !== undefined) {
        PerformanceSystem.hitLane(this.qteKeys[e.code]);
      }
      return;
    }
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.state.accel = isDown; break;
      case 'KeyS': case 'ArrowDown': this.state.brake = isDown; break;
      case 'KeyA': case 'ArrowLeft': this.state.left = isDown; break;
      case 'KeyD': case 'ArrowRight': this.state.right = isDown; break;
    }
  },

  bindTouchButton(elId, key) {
    const el = document.getElementById(elId);
    if (!el) return;
    const setOn = (ev) => { ev.preventDefault(); this.state[key] = true; };
    const setOff = (ev) => { ev.preventDefault(); this.state[key] = false; };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointerleave', setOff);
    el.addEventListener('pointercancel', setOff);
  },
};

/* ---------------------------------------------------------------------
   Virtual steering wheel (mobile-first, also usable with a mouse).
   Rotating the wheel writes a normalized value into Input.wheelSteering,
   which Input.steering exposes to Vehicle.update(). The wheel eases back
   toward center on release rather than snapping.
--------------------------------------------------------------------- */
const SteeringWheel = {
  wrapper: null,
  wheelEl: null,
  center: { x: 0, y: 0 },
  dragging: false,
  activePointerId: null,
  startAngle: 0,
  rotation: 0, // radians, current visual rotation
  maxRotation: Math.PI * 0.75, // ~135 degrees of wheel travel to each side
  returnFrame: null,

  init() {
    this.wrapper = document.getElementById('steering-wheel-wrapper');
    this.wheelEl = document.getElementById('steering-wheel');
    if (!this.wrapper || !this.wheelEl) return;

    this.wrapper.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.wrapper.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.wrapper.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.wrapper.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Belt-and-suspenders against iOS text selection / callout / scrolling:
    // touch-action + user-select CSS handles most of it, these stop the rest.
    this.wrapper.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.wrapper.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.wrapper.addEventListener('contextmenu', (e) => e.preventDefault());
    this.wrapper.addEventListener('selectstart', (e) => e.preventDefault());
  },

  angleFromCenter(clientX, clientY) {
    const dx = clientX - this.center.x;
    const dy = clientY - this.center.y;
    return Math.atan2(dx, -dy); // 0 = straight up, positive = clockwise/right
  },

  onPointerDown(e) {
    e.preventDefault();
    const rect = this.wrapper.getBoundingClientRect();
    this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.dragging = true;
    this.activePointerId = e.pointerId;
    if (this.returnFrame) { cancelAnimationFrame(this.returnFrame); this.returnFrame = null; }

    try { this.wrapper.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }

    const angle = this.angleFromCenter(e.clientX, e.clientY);
    // Preserve current rotation as a baseline so the wheel doesn't jump.
    this.startAngle = angle - this.rotation;
  },

  onPointerMove(e) {
    if (!this.dragging || e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    const angle = this.angleFromCenter(e.clientX, e.clientY);
    let rotation = angle - this.startAngle;
    // Normalize into -PI..PI so fast drags don't wrap around oddly.
    while (rotation > Math.PI) rotation -= Math.PI * 2;
    while (rotation < -Math.PI) rotation += Math.PI * 2;
    rotation = THREE.MathUtils.clamp(rotation, -this.maxRotation, this.maxRotation);
    this.setRotation(rotation);
  },

  onPointerUp(e) {
    if (e.pointerId !== undefined && e.pointerId !== this.activePointerId) return;
    this.dragging = false;
    try { this.wrapper.releasePointerCapture(e.pointerId); } catch (err) { /* no-op */ }
    this.activePointerId = null;
    this.animateReturn();
  },

  setRotation(rotation) {
    this.rotation = rotation;
    this.wheelEl.style.transform = `rotate(${rotation}rad)`;
    Input.wheelSteering = THREE.MathUtils.clamp(rotation / this.maxRotation, -1, 1);
    this.wrapper.setAttribute('aria-valuenow', Input.wheelSteering.toFixed(2));
  },

  // Eases the wheel (and steering value) back toward center after release.
  animateReturn() {
    const step = () => {
      if (this.dragging) { this.returnFrame = null; return; }
      this.rotation *= 0.8;
      if (Math.abs(this.rotation) < 0.01) {
        this.setRotation(0);
        this.returnFrame = null;
        return;
      }
      this.setRotation(this.rotation);
      this.returnFrame = requestAnimationFrame(step);
    };
    this.returnFrame = requestAnimationFrame(step);
  },
};

/* ============================================================================
   8. DISCOVERY SYSTEM
============================================================================ */

const DiscoverySystem = {
  active: false,
  discoveredIds: new Set(),

  checkProximity() {
    if (this.active || PerformanceSystem.active) return;
    for (const lm of currentCity.landmarks) {
      if (this.discoveredIds.has(lm.id)) continue;
      const dist = Vehicle.position.distanceTo(lm._worldPosition);
      if (dist <= lm.discoveryRadius) { this.trigger(lm); break; }
    }
  },

  trigger(landmark) {
    this.active = true;
    this.discoveredIds.add(landmark.id);
    Vehicle.frozen = true;

    document.getElementById('discovery-title').textContent = landmark.name;
    document.getElementById('discovery-meta').textContent = landmark.meta || '';
    document.getElementById('discovery-body').textContent = landmark.historicalFacts;
    document.getElementById('discovery-reward').textContent = `+${landmark.rewardPoints} CREDITS`;

    const personalWrap = document.getElementById('discovery-personal');
    const personalText = document.getElementById('discovery-personal-text');
    if (landmark.personalConnection) {
      personalWrap.classList.remove('hidden');
      personalText.textContent = landmark.personalConnection;
    } else {
      personalWrap.classList.add('hidden');
    }

    document.getElementById('discovery-overlay').classList.remove('hidden');
    ProgressManager.markDiscovered(landmark.id, landmark.unlocksProgressKey, landmark.rewardPoints);
    this._pendingLandmark = landmark;
  },

  continueDrive() {
    document.getElementById('discovery-overlay').classList.add('hidden');
    this.active = false;
    Vehicle.frozen = false;

    const landmark = this._pendingLandmark;
    this._pendingLandmark = null;

    if (landmark && landmark.id === 'penobscot') {
      UI.showToast('DESTINATION UNLOCKED', 'HART PLAZA — your first Detroit performance has been unlocked.');
    }
    if (landmark && landmark.performanceLocation) {
      PerformanceSystem.trigger(landmark);
    }
  },
};

/* ============================================================================
   9. RADIO SYSTEM
   ----------------------------------------------------------------------------
   Station -> genre -> SONG_LIBRARY playlist mapping. Each station may
   declare its own `genre`; if it doesn't, it falls back to the current
   city's genre (the original behavior for rock/blues/rap/jazz stations).
   "8 Mile Radio" declares `genre: 'alternative'` in CITIES.detroit, which
   is the connection that routes it to the seven real MP3s.
============================================================================ */

const RadioSystem = {
  currentStation: null, audioEl: null, currentTrack: null,

  init() {
    this.currentStation = currentCity.radioStations[0];
    this.audioEl = new Audio();
    this.currentTrack = getWeeklyFeaturedTrack(this.getStationGenre(this.currentStation));
    document.getElementById('radio-station-name').textContent = this.currentStation.name;
    this.renderNowPlaying();

    // Continuous playback: once the current track finishes, automatically
    // advance to the next track in this station's playlist and keep playing,
    // looping back to the start of the playlist indefinitely.
    this.audioEl.addEventListener('ended', () => this.nextTrack(true));
  },

  // Resolves which SONG_LIBRARY genre a station plays. A station's own
  // `genre` field wins (this is how "8 Mile Radio" -> 'alternative' is
  // wired); stations without one keep the original city-genre behavior.
  getStationGenre(station) {
    return (station && station.genre) || currentCity.genre;
  },

  getStationPlaylist(station) {
    return SONG_LIBRARY[this.getStationGenre(station)] || SONG_LIBRARY[currentCity.genre];
  },

  renderNowPlaying() {
    document.getElementById('radio-now-playing').textContent =
      `This week: "${this.currentTrack.title}" (${this.currentTrack.genre})`;
  },

  play() {
    const statusEl = document.getElementById('radio-status');
    if (!this.currentTrack.audioUrl) {
      statusEl.textContent = `No licensed audio configured yet for "${this.currentTrack.title}". This slot is ready for a real stream/track URL.`;
      return;
    }
    // encodeURI so filenames with spaces, parentheses, hyphens, and a
    // trailing space before the extension (e.g. "...Collect The Vibe .mp3")
    // resolve to a valid, correctly percent-encoded request path.
    this.audioEl.src = encodeURI(this.currentTrack.audioUrl);
    this.audioEl.play();
    statusEl.textContent = 'Now playing: ' + this.currentTrack.title;
  },

  // `autoplay` is true when called from the 'ended' handler above, so the
  // continuous-playback chain keeps going without the player pressing Play.
  nextTrack(autoplay) {
    const pool = this.getStationPlaylist(this.currentStation);
    const idx = pool.findIndex((t) => t.id === this.currentTrack.id);
    this.currentTrack = pool[(idx + 1) % pool.length];
    this.renderNowPlaying();
    if (autoplay) this.play();
  },
};

/* ============================================================================
   10. PERFORMANCE / QTE SYSTEM
   ----------------------------------------------------------------------------
   A 4-lane rhythm minigame. Lanes/labels/hit-color come from GENRE_CONFIG,
   so a rock show plays as guitar/bass/drums/vocals while a rap show plays
   as vocal/beat/scratch/hype, etc. Notes are generated procedurally from
   the current track's bpm (deterministic per song) since there's no
   licensed audio to sync against yet — swapping in a real track later just
   means syncing this same lane system to its beat map/audio timeline.
============================================================================ */

const PerformanceSystem = {
  active: false,
  currentLandmark: null,
  genreConfig: null,
  track: null,
  notes: [],
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: { perfect: 0, good: 0, miss: 0 },
  startTime: 0,
  travelTime: 1.7, // seconds for a note to fall from spawn to hit line
  duration: 32, // seconds per performance
  spawnedCount: 0,
  rafId: null,

  trigger(landmark) {
    this.currentLandmark = landmark;
    this.genreConfig = GENRE_CONFIG[currentCity.genre];
    this.track = getWeeklyFeaturedTrack(currentCity.genre);
    Vehicle.frozen = true;

    document.getElementById('performance-location').textContent = landmark.performanceVenueName || landmark.name;
    document.getElementById('performance-genre').textContent = this.genreConfig.label;
    document.getElementById('performance-song').textContent = `Tonight's set: "${this.track.title}"`;
    document.getElementById('performance-copy').textContent = 'Detroit is listening. Hit the notes as they reach the line.';
    document.getElementById('performance-overlay').classList.remove('hidden');
  },

  start() {
    document.getElementById('performance-overlay').classList.add('hidden');
    this.active = true;
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = { perfect: 0, good: 0, miss: 0 };
    this.notes = [];
    this.spawnedCount = 0;

    const lanesEl = document.getElementById('qte-lanes');
    lanesEl.innerHTML = '';
    this.genreConfig.lanes.forEach((label, i) => {
      const lane = document.createElement('div');
      lane.className = 'qte-lane';
      lane.dataset.lane = i;
      lane.innerHTML = `<div class="qte-lane-label">${label}</div>`;
      lanesEl.appendChild(lane);
    });

    document.getElementById('qte-song-title').textContent = this.track.title.toUpperCase();
    document.documentElement.style.setProperty('--accent', this.genreConfig.hitColor);
    document.getElementById('qte-overlay').classList.remove('hidden');
    document.getElementById('qte-touch-lanes').classList.remove('hidden');
    document.getElementById('touch-controls').classList.add('hidden');

    // Deterministic pattern generated from bpm: one beat = one possible
    // note, roughly 60% density, seeded by track id so a given song always
    // plays the same pattern.
    this.pattern = this.generatePattern(this.track);
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  },

  generatePattern(track) {
    const beatInterval = 60 / track.bpm;
    const totalBeats = Math.floor(this.duration / beatInterval);
    let seed = 0;
    for (let i = 0; i < track.id.length; i++) seed += track.id.charCodeAt(i);
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const events = [];
    for (let b = 2; b < totalBeats; b++) {
      if (rand() > 0.4) {
        events.push({ time: b * beatInterval, lane: Math.floor(rand() * 4), hit: false });
      }
    }
    return events;
  },

  loop(now) {
    if (!this.active) return;
    const elapsed = (now - this.startTime) / 1000;

    // Spawn notes whose travel window has begun
    while (this.spawnedCount < this.pattern.length &&
           this.pattern[this.spawnedCount].time - this.travelTime <= elapsed) {
      this.spawnNote(this.pattern[this.spawnedCount]);
      this.spawnedCount++;
    }

    // Update note positions; auto-miss ones that passed the hit window
    const lanesEl = document.querySelectorAll('.qte-lane');
    this.notes = this.notes.filter((n) => {
      const progress = (elapsed - (n.event.time - this.travelTime)) / this.travelTime;
      if (progress > 1.15 && !n.event.hit) {
        this.registerMiss();
        n.el.remove();
        return false;
      }
      if (progress > 1.15) { n.el.remove(); return false; }
      const laneHeight = lanesEl[n.event.lane]?.clientHeight || 400;
      n.el.style.top = `${Math.max(-40, progress * laneHeight * 0.78 - 34)}px`;
      return true;
    });

    if (elapsed >= this.duration && this.notes.length === 0 && this.spawnedCount >= this.pattern.length) {
      this.finish();
      return;
    }

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  },

  spawnNote(event) {
    const lanesEl = document.querySelectorAll('.qte-lane');
    const lane = lanesEl[event.lane];
    if (!lane) return;
    const el = document.createElement('div');
    el.className = 'qte-note';
    el.style.top = '-40px';
    lane.appendChild(el);
    this.notes.push({ event, el });
  },

  hitLane(laneIndex) {
    if (!this.active) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    // Find the closest un-hit note in this lane within a timing window
    let best = null; let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.event.lane !== laneIndex || n.event.hit) continue;
      const delta = Math.abs(n.event.time - elapsed);
      if (delta < bestDelta) { bestDelta = delta; best = n; }
    }
    if (best && bestDelta < 0.32) {
      best.event.hit = true;
      best.el.remove();
      this.notes = this.notes.filter((n) => n !== best);
      if (bestDelta < 0.12) this.registerHit('perfect', 100);
      else this.registerHit('good', 50);
    } else {
      this.flashLane(laneIndex, false);
    }
  },

  registerHit(quality, basePoints) {
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const comboMultiplier = 1 + Math.min(this.combo, 20) * 0.05;
    this.score += Math.round(basePoints * comboMultiplier);
    this.hits[quality]++;
    this.updateHud(quality === 'perfect' ? 'PERFECT!' : 'GOOD');
  },

  registerMiss() {
    this.combo = 0;
    this.hits.miss++;
    this.updateHud('MISS');
  },

  updateHud(judgment) {
    document.getElementById('qte-score-val').textContent = this.score;
    document.getElementById('qte-combo-val').textContent = this.combo;
    const el = document.getElementById('qte-judgment');
    el.textContent = judgment;
    el.style.opacity = 1;
    clearTimeout(this._judgmentTimer);
    this._judgmentTimer = setTimeout(() => { el.style.opacity = 0; }, 400);
  },

  flashLane() { /* reserved for future visual feedback on a whiff */ },

  finish() {
    this.active = false;
    cancelAnimationFrame(this.rafId);
    document.getElementById('qte-overlay').classList.add('hidden');
    document.getElementById('qte-touch-lanes').classList.add('hidden');
    document.getElementById('touch-controls').classList.remove('hidden');

    const totalNotes = this.hits.perfect + this.hits.good + this.hits.miss;
    const accuracy = totalNotes > 0 ? (this.hits.perfect + this.hits.good * 0.6) / totalNotes : 0;
    let rating = 'ROUGH NIGHT';
    if (accuracy > 0.9) rating = 'LEGENDARY SET';
    else if (accuracy > 0.7) rating = 'GREAT SHOW';
    else if (accuracy > 0.45) rating = 'SOLID SET';

    const creditsEarned = Math.round(150 + this.score * 0.4);

    document.getElementById('results-rating').textContent = rating;
    document.getElementById('results-breakdown').innerHTML = `
      <div><b>${this.hits.perfect}</b>PERFECT</div>
      <div><b>${this.hits.good}</b>GOOD</div>
      <div><b>${this.hits.miss}</b>MISS</div>
      <div><b>${this.maxCombo}</b>MAX COMBO</div>
    `;
    document.getElementById('results-credits').textContent = `+${creditsEarned} CREDITS EARNED`;
    document.getElementById('results-overlay').classList.remove('hidden');

    ProgressManager.markConcertComplete(creditsEarned);
    this._pendingCreditsResult = creditsEarned;
  },

  closeResults() {
    document.getElementById('results-overlay').classList.add('hidden');
    Vehicle.frozen = false;
  },
};

/* ============================================================================
   11. CITY PROGRESSION / SELECT
============================================================================ */

const CityProgression = {
  render() {
    const list = document.getElementById('city-select-list');
    list.innerHTML = '';
    CITY_ORDER.forEach((id) => {
      const city = CITIES[id];
      const unlocked = ProgressManager.isCityUnlocked(id);
      const card = document.createElement('div');
      card.className = 'city-card' + (unlocked ? '' : ' locked') + (currentCity.id === id ? ' active' : '');

      if (city.comingSoon) {
        card.innerHTML = `
          <div>
            <div class="city-card-name">${city.name}</div>
            <div class="city-card-genre">COMING SOON</div>
          </div>
          <div class="city-card-btn">SOON</div>`;
        list.appendChild(card);
        return;
      }

      const reqText = unlocked ? 'UNLOCKED' : `NEEDS ${city.unlockCost} CREDITS`;
      card.innerHTML = `
        <div>
          <div class="city-card-name">${city.name}</div>
          <div class="city-card-genre">${city.genre}</div>
          <div class="city-card-req">${reqText}</div>
        </div>
        <button class="city-card-btn">${unlocked ? (currentCity.id === id ? 'HERE' : 'DRIVE') : 'LOCKED'}</button>`;

      const btn = card.querySelector('.city-card-btn');
      btn.addEventListener('click', () => this.selectCity(id));
      list.appendChild(card);
    });
  },

  selectCity(id) {
    const city = CITIES[id];
    if (city.comingSoon) return;
    if (!ProgressManager.isCityUnlocked(id)) {
      if (ProgressManager.state.credits >= city.unlockCost) {
        ProgressManager.unlockCity(id);
      } else {
        UI.showToast('NOT ENOUGH CREDITS', `Earn ${city.unlockCost - ProgressManager.state.credits} more credits to unlock ${city.name}.`);
        return;
      }
    }
    Scene3D.loadCity(city);
    RadioSystem.init();
    document.getElementById('city-select-overlay').classList.add('hidden');
    this.render();
  },
};

/* ============================================================================
   12. GARAGE
============================================================================ */

const Garage = {
  render() {
    const typeList = document.getElementById('vehicle-type-list');
    typeList.innerHTML = '';
    Object.entries(VEHICLE_TYPES).forEach(([id, def]) => {
      const btn = document.createElement('button');
      btn.className = 'chip-btn' + (ProgressManager.state.garage.vehicleType === id ? ' selected' : '');
      btn.textContent = def.label;
      btn.addEventListener('click', () => {
        ProgressManager.state.garage.vehicleType = id;
        this.render();
      });
      typeList.appendChild(btn);
    });

    const colorList = document.getElementById('vehicle-color-list');
    colorList.innerHTML = '';
    VEHICLE_COLORS.forEach((hex) => {
      const btn = document.createElement('button');
      btn.className = 'chip-btn color-chip' + (ProgressManager.state.garage.color === hex ? ' selected' : '');
      btn.style.background = hex;
      btn.addEventListener('click', () => {
        ProgressManager.state.garage.color = hex;
        this.render();
      });
      colorList.appendChild(btn);
    });

    document.getElementById('plate-preview').textContent = ProgressManager.state.garage.plate;
    document.getElementById('plate-input').value = ProgressManager.state.garage.plate;
  },

  save() {
    const raw = document.getElementById('plate-input').value || 'DETROIT';
    const sanitized = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8).trim() || 'DETROIT';
    ProgressManager.state.garage.plate = sanitized;
    ProgressManager.save();
    Vehicle.rebuildMesh();
    document.getElementById('garage-overlay').classList.add('hidden');
  },
};

/* ============================================================================
   13. UI GLUE
============================================================================ */

const UI = {
  init() {
    document.getElementById('progress-toggle').addEventListener('click', () =>
      document.getElementById('progress-panel').classList.toggle('hidden'));
    document.querySelectorAll('[data-close]').forEach((btn) =>
      btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.add('hidden')));

    document.getElementById('discovery-continue').addEventListener('click', () => DiscoverySystem.continueDrive());

    document.getElementById('radio-toggle').addEventListener('click', () =>
      document.getElementById('radio-panel').classList.toggle('hidden'));
    document.getElementById('radio-play-btn').addEventListener('click', () => RadioSystem.play());
    document.getElementById('radio-next-btn').addEventListener('click', () => RadioSystem.nextTrack());

    document.getElementById('performance-btn').addEventListener('click', () => PerformanceSystem.start());
    document.getElementById('results-continue').addEventListener('click', () => PerformanceSystem.closeResults());

    document.getElementById('map-toggle').addEventListener('click', () => {
      CityProgression.render();
      document.getElementById('city-select-overlay').classList.remove('hidden');
    });
    document.getElementById('garage-toggle').addEventListener('click', () => {
      Garage.render();
      document.getElementById('garage-overlay').classList.remove('hidden');
    });
    document.getElementById('garage-save-btn').addEventListener('click', () => Garage.save());
    document.getElementById('plate-input').addEventListener('input', (e) => {
      document.getElementById('plate-preview').textContent =
        (e.target.value || 'DETROIT').toUpperCase().slice(0, 8);
    });

    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
  },

  checkOrientation() {
    const hint = document.getElementById('rotate-hint');
    const isPortrait = window.innerHeight > window.innerWidth;
    const isSmallScreen = window.innerWidth < 900;
    if (isPortrait && isSmallScreen) hint.classList.remove('hidden');
    else hint.classList.add('hidden');
  },

  showToast(kicker, title) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<span class="toast-kicker">${kicker}</span><span class="toast-title">${title}</span>`;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3600);
  },
};

/* ============================================================================
   14. GAME LOOP
============================================================================ */

const Game = {
  init() {
    ProgressManager.load();
    Scene3D.init();
    Vehicle.init();
    Input.init();
    RadioSystem.init();
    UI.init();

    document.getElementById('loading-screen').classList.add('hidden');
    requestAnimationFrame(() => this.loop());
  },

  loop() {
    const dt = Math.min(Scene3D.clock.getDelta(), 0.05);

    if (!Vehicle.frozen && !PerformanceSystem.active) {
      // Input.steering resolves keyboard vs. steering-wheel input into one
      // normalized value; mirror it onto state so Vehicle.update sees it
      // alongside accel/brake in a single object, as before.
      Input.state.steering = Input.steering;
      Vehicle.update(dt, Input.state);
      DiscoverySystem.checkProximity();
    }
    NPCSystem.update(dt);
    TrafficSystem.update(dt);

    this.updateCamera();
    Scene3D.renderer.render(Scene3D.scene, Scene3D.camera);
    requestAnimationFrame(() => this.loop());
  },

  updateCamera() {
    const behind = new THREE.Vector3(
      -Math.sin(Vehicle.heading) * 8, 4.2, -Math.cos(Vehicle.heading) * 8
    );
    const desired = Vehicle.position.clone().add(behind);
    Scene3D.camera.position.lerp(desired, 0.08);
    const lookTarget = Vehicle.position.clone();
    lookTarget.y += 1.2;
    Scene3D.camera.lookAt(lookTarget);
  },
};

window.addEventListener('load', () => Game.init());
