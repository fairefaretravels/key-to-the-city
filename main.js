/* ============================================================================
   WOODWARD: DETROIT — Chapter 01: The First Drive
   ----------------------------------------------------------------------------
   Vertical slice: Woodward Ave -> Penobscot Building -> Hart Plaza -> Concert.

   ARCHITECTURE NOTE:
   This file is intentionally organized into clearly separated sections so
   that future work (more landmarks, more cities, real radio streams, a
   walk-mode, etc.) can be dropped in without rewriting the engine:

     1. CITY DATA            - all Detroit-specific content lives in one object
     2. SAVE / PROGRESS       - localStorage-backed progress + city key
     3. SCENE SETUP           - Three.js renderer, lights, road, city dressing
     4. VEHICLE               - the 1973-Chevy-inspired placeholder car
     5. INPUT                 - keyboard + mobile touch controls
     6. DISCOVERY SYSTEM      - reusable "enter radius -> show info" system
     7. RADIO SYSTEM          - placeholder architecture for future stations
     8. PERFORMANCE SYSTEM    - reusable concert/reward screen
     9. GAME LOOP             - ties it all together

   When a new city is added later, everything in section 1 becomes
   CITIES.atlanta / CITIES.newyork / etc., and sections 3-9 read from
   `currentCity` instead of a hard-coded Detroit reference.
============================================================================ */

/* ============================================================================
   1. CITY DATA
============================================================================ */

const CITIES = {
  detroit: {
    id: 'detroit',
    name: 'Detroit',

    // Where the player's car starts, in world units.
    start: { x: 0, z: 0, heading: 0 },

    // The road is a simple straight corridor for v0.1. Real Detroit geometry
    // (Woodward's actual curve, cross streets, etc.) can replace this later
    // without touching the discovery/progress/radio systems.
    road: { width: 14, length: 900 },

    landmarks: [
      {
        id: 'penobscot',
        name: 'PENOBSCOT BUILDING',
        position: { x: 2, z: -280 },
        discoveryRadius: 26,
        unlocksProgressKey: 'penobscot',
        meta: 'Downtown Detroit · Art Deco skyscraper',
        // Placeholder copy. Structure kept ready for sourced research:
        // address / dates / architect / style / facts[] / radioConnections / images / sources
        historicalFacts:
          'The full game will contain researched historical information about ' +
          'the Penobscot Building here — its architecture, its place on the ' +
          'Detroit skyline, and its radio history. This is placeholder copy ' +
          'until sourced facts are added.',
        radioConnection: 'WJLB',
        // Personal stories are always kept separate from historical fact.
        personalConnection:
          'Placeholder: the creator of this game worked in the Penobscot ' +
          'Building. Their personal story — and its WJLB radio connection — ' +
          'will go here, clearly separated from the historical record above.',
      },
      {
        id: 'hart-plaza',
        name: 'HART PLAZA',
        position: { x: 2, z: -560 },
        discoveryRadius: 30,
        unlocksProgressKey: 'hartPlaza',
        meta: 'Detroit riverfront · public gathering space',
        historicalFacts:
          'The full game will contain researched historical information about ' +
          'Hart Plaza here — its role as a civic and performance space along ' +
          'the Detroit River. This is placeholder copy until sourced facts ' +
          'are added.',
        radioConnection: null,
        personalConnection: null,
        // Hart Plaza is also a performance location.
        performanceLocation: true,
      },
    ],

    // Radio is architected to support many stations; only Island Spice Radio
    // has a real (external) identity in v0.1, and even that has no stream
    // wired up yet — just the slot for one.
    radioStations: [
      {
        id: 'island-spice-radio',
        name: 'ISLAND SPICE RADIO',
        streamUrl: null, // supply a real, licensed stream URL here later
        infoUrl: 'https://islandspiceradio.github.io/isr/site/',
        historyBlurb: 'An existing independent station in the Saneca network.',
      },
      { id: 'wjlb-historical', name: 'WJLB (HISTORICAL)', streamUrl: null, historyBlurb: 'Placeholder for historical WJLB content.' },
      { id: 'stv', name: 'STV', streamUrl: null, historyBlurb: 'Placeholder for STV content.' },
      { id: 'h4h', name: 'H4H', streamUrl: null, historyBlurb: 'Placeholder for H4H content.' },
      { id: 'brass-earthling', name: 'BRASS EARTHLING', streamUrl: null, historyBlurb: 'Placeholder for Brass Earthling content.' },
    ],

    // The full chapter requires more than one discovery/performance before
    // the key can ever unlock. v0.1 never sets unlocked to true — the
    // framework just needs to exist.
    cityKey: { city: 'Detroit', unlocked: false },
  },
};

let currentCity = CITIES.detroit;

/* ============================================================================
   2. SAVE / PROGRESS
============================================================================ */

const SAVE_KEY = 'woodward-detroit-save-v1';

const ProgressManager = {
  state: null,

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
      } catch (e) {
        this.state = this.defaultState();
      }
    } else {
      this.state = this.defaultState();
    }
    this.render();
    return this.state;
  },

  defaultState() {
    return {
      woodward: true, // starting the drive counts as step one
      penobscot: false,
      hartPlaza: false,
      concert: false,
      cityKey: false,
    };
  },

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    this.render();
  },

  markDiscovered(key) {
    if (!this.state[key]) {
      this.state[key] = true;
      this.save();
    }
  },

  markConcertComplete() {
    this.state.concert = true;
    this.save();
  },

  render() {
    const list = document.getElementById('progress-list');
    if (!list) return;
    const rows = [
      ['Woodward', this.state.woodward],
      ['Penobscot', this.state.penobscot],
      ['Hart Plaza', this.state.hartPlaza],
      ['Concert', this.state.concert],
      ['City Key', this.state.cityKey],
    ];
    list.innerHTML = rows
      .map(([label, done]) => {
        const cls = done ? 'status-done' : 'status-locked';
        const icon = done ? '✓' : '🔒';
        return `<li><span>${label}</span><span class="${cls}">${icon}</span></li>`;
      })
      .join('');
  },
};

/* ============================================================================
   3. SCENE SETUP
============================================================================ */

const Scene3D = {
  renderer: null,
  scene: null,
  camera: null,
  clock: new THREE.Clock(),

  init() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d13);
    this.scene.fog = new THREE.Fog(0x0a0d13, 60, 420);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      1500
    );

    this.buildLights();
    this.buildRoad();
    this.buildCityDressing();

    window.addEventListener('resize', () => this.onResize());
  },

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x0a0a0a, 0.55);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xbcd4ff, 0.7);
    moon.position.set(-60, 120, -40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -200;
    moon.shadow.camera.right = 200;
    moon.shadow.camera.top = 200;
    moon.shadow.camera.bottom = -200;
    this.scene.add(moon);

    const amber = new THREE.PointLight(0xffb15c, 0.6, 80);
    amber.position.set(0, 12, 0);
    this.scene.add(amber);
  },

  buildRoad() {
    const { width, length } = currentCity.road;

    // Ground / sidewalks
    const groundGeo = new THREE.PlaneGeometry(400, length + 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -length / 2 + 100);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Road surface
    const roadGeo = new THREE.PlaneGeometry(width, length);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -length / 2 + 50);
    road.receiveShadow = true;
    this.scene.add(road);

    // Lane markings (dashed center line)
    const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd9c98a });
    for (let z = 30; z > -length + 40; z -= 10) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.01, z);
      this.scene.add(dash);
    }

    // Sidewalk curbs
    const curbGeo = new THREE.BoxGeometry(1, 0.25, length);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33 });
    [-(width / 2 + 0.5), width / 2 + 0.5].forEach((x) => {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(x, 0.1, -length / 2 + 50);
      curb.receiveShadow = true;
      this.scene.add(curb);
    });

    // Streetlights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffdca0,
      emissive: 0xffb15c,
      emissiveIntensity: 1.4,
    });
    const sideOffset = width / 2 + 2.5;
    for (let z = 20; z > -length + 40; z -= 24) {
      [-sideOffset, sideOffset].forEach((x) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8), poleMat);
        pole.position.set(x, 3.5, z);
        this.scene.add(pole);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
        lamp.position.set(x, 7, z);
        this.scene.add(lamp);
      });
    }
  },

  buildCityDressing() {
    // Procedural placeholder buildings lining the corridor, per the brief:
    // "recognizable and grounded," not photoreal, replaceable later.
    const { width, length } = currentCity.road;
    const baseColors = [0x23262c, 0x2a2d33, 0x1c1f24, 0x30333a];

    for (let z = 10; z > -length + 30; z -= 22) {
      [-1, 1].forEach((side) => {
        const h = 10 + Math.random() * 40;
        const w = 8 + Math.random() * 6;
        const d = 8 + Math.random() * 6;
        const mat = new THREE.MeshStandardMaterial({
          color: baseColors[Math.floor(Math.random() * baseColors.length)],
          roughness: 0.85,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        const x = side * (width / 2 + 8 + w / 2);
        building.position.set(x, h / 2, z + (Math.random() * 6 - 3));
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);

        // A handful of lit windows via emissive strips (cheap + atmospheric)
        if (Math.random() > 0.4) {
          const winMat = new THREE.MeshStandardMaterial({
            color: 0x2c2c2c,
            emissive: 0xffdf9e,
            emissiveIntensity: 0.5,
          });
          const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.5), winMat);
          win.position.set(x + side * (w / 2 + 0.01), h * 0.5, z);
          win.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
          this.scene.add(win);
        }
      });
    }

    this.buildLandmarks();
  },

  buildLandmarks() {
    currentCity.landmarks.forEach((lm) => {
      let mesh;
      if (lm.id === 'penobscot') {
        mesh = this.buildPenobscot();
      } else if (lm.id === 'hart-plaza') {
        mesh = this.buildHartPlaza();
      } else {
        // Generic placeholder for any future landmark not yet given a
        // custom model — keeps the discovery system fully data-driven.
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(10, 20, 10),
          new THREE.MeshStandardMaterial({ color: 0x33363c })
        );
      }
      mesh.position.set(lm.position.x, mesh.position.y, lm.position.z);
      mesh.userData.landmarkId = lm.id;
      this.scene.add(mesh);
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

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff5533,
      emissive: 0xff3311,
      emissiveIntensity: 1.6,
    });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), beaconMat);
    beacon.position.y = baseHeight + towerHeight + 1.5;
    group.add(beacon);

    // Simple landmark signage plane (placeholder text handled via UI, not 3D text)
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: 0xd9a441,
      emissiveIntensity: 0.4,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), signMat);
    sign.position.set(0, baseHeight * 0.55, 7.01);
    group.add(sign);

    group.position.set(0, 0, 0);
    return group;
  },

  buildHartPlaza() {
    const group = new THREE.Group();

    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 });
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.3, 24), plazaMat);
    plaza.position.y = 0.15;
    plaza.receiveShadow = true;
    group.add(plaza);

    // Stage / performance platform
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f });
    const stage = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 6), stageMat);
    stage.position.set(0, 0.9, -10);
    stage.castShadow = true;
    group.add(stage);

    // Simple monument spire, evocative of the plaza's riverfront landmarks
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.4, roughness: 0.4 });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1, 20, 10), spireMat);
    spire.position.set(0, 10, 6);
    spire.castShadow = true;
    group.add(spire);

    // Stage lighting
    const stageLight = new THREE.PointLight(0x8fd0ff, 1.1, 30);
    stageLight.position.set(0, 6, -10);
    group.add(stageLight);

    group.position.set(0, 0, 0);
    return group;
  },

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
};

/* ============================================================================
   4. VEHICLE
============================================================================ */

const Vehicle = {
  mesh: null,
  position: new THREE.Vector3(0, 0, 0),
  heading: 0, // radians
  speed: 0,

  maxSpeed: 26,
  reverseMaxSpeed: -10,
  acceleration: 14,
  brakeStrength: 22,
  drag: 8,
  turnRate: 1.9, // radians/sec at low speed

  init() {
    const { x, z, heading } = currentCity.start;
    this.position.set(x, 0, z);
    this.heading = heading;

    this.mesh = this.buildCarMesh();
    Scene3D.scene.add(this.mesh);
    this.syncMesh();
  },

  buildCarMesh() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a1f2b, metalness: 0.4, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1218, metalness: 0.6, roughness: 0.15 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 0.9, roughness: 0.2 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Long, low 1970s-muscle-car-inspired silhouette
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 1.6), bodyMat);
    hood.position.set(0, 0.92, 1.6);
    group.add(hood);

    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.25), chromeMat);
    bumperFront.position.set(0, 0.45, 2.4);
    group.add(bumperFront);

    const bumperBack = bumperFront.clone();
    bumperBack.position.z = -2.4;
    group.add(bumperBack);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14);
    const wheelPositions = [
      [-1.05, 0.42, 1.55],
      [1.05, 0.42, 1.55],
      [-1.05, 0.42, -1.55],
      [1.05, 0.42, -1.55],
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff6df,
      emissive: 0xfff0c0,
      emissiveIntensity: 1.2,
    });
    [-0.65, 0.65].forEach((hx) => {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), headlightMat);
      headlight.position.set(hx, 0.55, 2.35);
      group.add(headlight);
    });

    const headlamp = new THREE.SpotLight(0xfff0c0, 1.2, 40, Math.PI / 6, 0.4);
    headlamp.position.set(0, 1, 2.5);
    headlamp.target.position.set(0, 0, 10);
    group.add(headlamp);
    group.add(headlamp.target);

    return group;
  },

  update(dt, input) {
    // Acceleration / braking
    if (input.accel) {
      this.speed += this.acceleration * dt;
    } else if (input.brake) {
      this.speed -= this.brakeStrength * dt;
    } else {
      // Natural drag toward zero
      const dragAmount = this.drag * dt;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - dragAmount);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + dragAmount);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, this.reverseMaxSpeed, this.maxSpeed);

    // Steering — scaled down at very low speed so the car doesn't spin in place
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0.15, 1);
    if (input.left) this.heading += this.turnRate * speedFactor * dt * (this.speed < 0 ? -1 : 1);
    if (input.right) this.heading -= this.turnRate * speedFactor * dt * (this.speed < 0 ? -1 : 1);

    // Move forward along heading
    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    this.position.x += dx;
    this.position.z += dz;

    // Simple boundary collision: keep the car on the road corridor
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
   5. INPUT
============================================================================ */

const Input = {
  state: { accel: false, brake: false, left: false, right: false },

  init() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));
    this.bindTouchButton('btn-accel', 'accel');
    this.bindTouchButton('btn-brake', 'brake');
    this.bindTouchButton('btn-left', 'left');
    this.bindTouchButton('btn-right', 'right');
  },

  handleKey(e, isDown) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.accel = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.brake = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = isDown;
        break;
    }
  },

  bindTouchButton(elId, key) {
    const el = document.getElementById(elId);
    if (!el) return;
    const setOn = (ev) => {
      ev.preventDefault();
      this.state[key] = true;
    };
    const setOff = (ev) => {
      ev.preventDefault();
      this.state[key] = false;
    };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointerleave', setOff);
    el.addEventListener('pointercancel', setOff);
  },
};

/* ============================================================================
   6. DISCOVERY SYSTEM
============================================================================ */

const DiscoverySystem = {
  active: false,
  discoveredIds: new Set(),

  checkProximity() {
    if (this.active) return;
    for (const lm of currentCity.landmarks) {
      if (this.discoveredIds.has(lm.id)) continue;
      const dist = Vehicle.position.distanceTo(lm._worldPosition);
      if (dist <= lm.discoveryRadius) {
        this.trigger(lm);
        break;
      }
    }
  },

  trigger(landmark) {
    this.active = true;
    this.discoveredIds.add(landmark.id);
    Vehicle.frozen = true;

    document.getElementById('discovery-title').textContent = landmark.name;
    document.getElementById('discovery-meta').textContent = landmark.meta || '';
    document.getElementById('discovery-body').textContent = landmark.historicalFacts;

    const personalWrap = document.getElementById('discovery-personal');
    const personalText = document.getElementById('discovery-personal-text');
    if (landmark.personalConnection) {
      personalWrap.classList.remove('hidden');
      personalText.textContent = landmark.personalConnection;
    } else {
      personalWrap.classList.add('hidden');
    }

    document.getElementById('discovery-overlay').classList.remove('hidden');

    ProgressManager.markDiscovered(landmark.unlocksProgressKey);

    this._pendingLandmark = landmark;
  },

  continueDrive() {
    document.getElementById('discovery-overlay').classList.add('hidden');
    this.active = false;
    Vehicle.frozen = false;

    const landmark = this._pendingLandmark;
    this._pendingLandmark = null;

    // Chain the next unlock notification, per the brief's flow:
    // Penobscot discovery -> "Hart Plaza unlocked" toast.
    if (landmark && landmark.id === 'penobscot') {
      UI.showToast('DESTINATION UNLOCKED', 'HART PLAZA — your first Detroit performance has been unlocked.');
    }

    if (landmark && landmark.performanceLocation) {
      PerformanceSystem.trigger(landmark);
    }
  },
};

/* ============================================================================
   7. RADIO SYSTEM
============================================================================ */

const RadioSystem = {
  currentStation: null,
  audioEl: null,

  init() {
    this.currentStation = currentCity.radioStations[0];
    this.audioEl = new Audio();
    document.getElementById('radio-station-name').textContent = this.currentStation.name;
  },

  play() {
    const statusEl = document.getElementById('radio-status');
    if (!this.currentStation.streamUrl) {
      statusEl.textContent =
        'No stream source configured yet for ' +
        this.currentStation.name +
        '. This slot is ready for a licensed stream URL.';
      return;
    }
    this.audioEl.src = this.currentStation.streamUrl;
    this.audioEl.play();
    statusEl.textContent = 'Now playing: ' + this.currentStation.name;
  },

  // Future hook: visiting an in-world radio station landmark will call this
  // to walk the player through history -> music -> performance unlock,
  // reusing PerformanceSystem exactly as Hart Plaza does.
  visitStation(stationId) {
    const station = currentCity.radioStations.find((s) => s.id === stationId);
    if (!station) return;
    this.currentStation = station;
    document.getElementById('radio-station-name').textContent = station.name;
  },
};

/* ============================================================================
   8. PERFORMANCE SYSTEM (reusable — Hart Plaza today, Fox Theatre etc. later)
============================================================================ */

const PerformanceSystem = {
  active: false,
  currentLandmark: null,

  trigger(landmark) {
    this.active = true;
    this.currentLandmark = landmark;
    Vehicle.frozen = true;

    document.getElementById('performance-location').textContent = landmark.name;
    document.getElementById('performance-copy').textContent = 'Detroit is listening.';
    document.getElementById('performance-btn').textContent = 'PERFORM';
    document.getElementById('performance-btn').disabled = false;
    document.getElementById('performance-overlay').classList.remove('hidden');
  },

  perform() {
    document.getElementById('performance-copy').textContent = 'PERFORMANCE COMPLETE — DETROIT PROGRESS SAVED';
    document.getElementById('performance-btn').disabled = true;

    ProgressManager.markConcertComplete();

    setTimeout(() => {
      document.getElementById('performance-overlay').classList.add('hidden');
      this.active = false;
      Vehicle.frozen = false;
    }, 1800);
  },
};

/* ============================================================================
   9. UI GLUE
============================================================================ */

const UI = {
  init() {
    document.getElementById('progress-toggle').addEventListener('click', () => {
      document.getElementById('progress-panel').classList.toggle('hidden');
    });
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.close).classList.add('hidden');
      });
    });
    document.getElementById('discovery-continue').addEventListener('click', () => {
      DiscoverySystem.continueDrive();
    });
    document.getElementById('radio-toggle').addEventListener('click', () => {
      document.getElementById('radio-panel').classList.toggle('hidden');
    });
    document.getElementById('radio-play-btn').addEventListener('click', () => {
      RadioSystem.play();
    });
    document.getElementById('performance-btn').addEventListener('click', () => {
      PerformanceSystem.perform();
    });

    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
  },

  checkOrientation() {
    const hint = document.getElementById('rotate-hint');
    const isPortrait = window.innerHeight > window.innerWidth;
    const isSmallScreen = window.innerWidth < 900;
    if (isPortrait && isSmallScreen) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
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
   GAME LOOP
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

    if (!Vehicle.frozen) {
      Vehicle.update(dt, Input.state);
      DiscoverySystem.checkProximity();
    }

    this.updateCamera();
    Scene3D.renderer.render(Scene3D.scene, Scene3D.camera);
    requestAnimationFrame(() => this.loop());
  },

  updateCamera() {
    // Cinematic chase camera: behind and slightly above the car.
    const behind = new THREE.Vector3(
      -Math.sin(Vehicle.heading) * 8,
      4.2,
      -Math.cos(Vehicle.heading) * 8
    );
    const desired = Vehicle.position.clone().add(behind);
    Scene3D.camera.position.lerp(desired, 0.08);

    const lookTarget = Vehicle.position.clone();
    lookTarget.y += 1.2;
    Scene3D.camera.lookAt(lookTarget);
  },
};

window.addEventListener('load', () => Game.init());
