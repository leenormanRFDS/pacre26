import * as THREE from 'three';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';

/* ======================================================================
   RFDS Port Augusta Centre: scroll-driven model

   The GLB is split into three floors by mesh name:

     roof          ROOF_*         roof slab and plant housing
     upperShell    EDUCATION_*    Level 02 (the three bands) plus a floor
                                  plate built here, because the GLB has none
     groundShell   CLINICAL_*     Level 01 floor tray

   The interior rooms (GROUND_*, UPPER_*) are not shown. The floor in focus
   in each chapter turns light blue; the others stay white.

   Two repairs are made to the GLB as it loads, without editing the file:
     - part of the roof slab near the front was modelled inside the Level 02
       mesh, so lifting the roof left a hole in it. Those pieces are moved
       into the roof.
     - Level 02 is only a ring of walls, so a floor plate is made for it from
       the roof's outline.

   Every chapter is described by a VIEW: the camera angle, which layers the
   camera frames, how far each layer is lifted, how visible each layer is,
   and which layer carries the brand tint. Scrolling blends from the previous
   chapter's view to this chapter's view. To change what a chapter shows,
   edit its VIEW below.

   Two views are PINNED to photographs instead of being framed freely:

     OPENING   the camera stands where photo PACRE-198 was taken
     DRONE     the camera hovers where the drone photo was taken

   Their camera positions were solved by matching the model's silhouette to
   each photo's transparent cut-out (97% overlap for the drone shot, 98% for
   198). Each photo also carries ANCHORS: model points and where those points
   fall in the photo. On every screen size this file projects the anchors
   through the camera and places the photo so they coincide, which is what
   lets the model dissolve into the real building and back.

   story.js publishes window.rfdsStory every frame:
   { beat, local, paused, visible, photoAlpha, modelAlpha }.
   ====================================================================== */

const canvas = document.querySelector('#model-canvas');
let renderer, model;

const DEG = Math.PI / 180;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const span = (x, start, end) => clamp((x - start) / (end - start), 0, 1);

/* ---------- Layers ---------------------------------------------------- */

const LAYER_BY_PREFIX = {
  CLINICAL_: 'groundShell',
  GROUND_: 'groundRooms',
  EDUCATION_: 'upperShell',
  UPPER_: 'upperRooms',
  ROOF_: 'roof'
};
const LAYER_NAMES = ['groundShell', 'groundRooms', 'upperShell', 'upperRooms', 'roof'];
const layers = Object.fromEntries(LAYER_NAMES.map(name => [name, {meshes: [], materials: []}]));

// The layers that are tinted when their floor is the subject of the chapter.
const TINTED = ['groundShell', 'upperShell'];
const ACCENT = new THREE.Color('#5ea6dc');   // light RFDS blue, solid
const TINT_STRENGTH = 1;

// When the building opens, the roof lifts off first and the floors follow.
// When it closes, the floors settle first and the roof goes back on last.
const OPEN_STAGGER  = {roof: 0, groundShell: 0.04, upperRooms: 0.06, upperShell: 0.10, groundRooms: 0.16};
const CLOSE_STAGGER = {upperRooms: 0, groundRooms: 0, upperShell: 0.04, groundShell: 0.04, roof: 0.30};
const LAYER_MOVE = 0.70;   // share of the blend each layer spends moving

/* ---------- Views ----------------------------------------------------- */
/* cam.az / cam.el   degrees around the building (0 = looking from +z,
                     90 = from +x) and degrees above the horizon
   camNarrow         az / el used instead on tall, narrow canvases (phones),
                     where a squarer angle fills the screen better
   frame             layers the camera must fit entirely inside the canvas
   frameNarrow       (optional) layers to fit when the canvas runs the full
                     width of the screen (phones held upright). Fitting only
                     the rooms lets the shell run off the screen edges, which
                     makes the part being talked about much larger
   fillNarrow        (optional) how much of the canvas those layers fill
   pose              (pinned views) fixed camera: az, el, dist, target, fov
   photo             (pinned views) the <img> to register and its anchors
   lift              how far each layer is raised from its resting position
   alpha             0 hidden, 1 solid, in between ghosted
   tint              0 ivory, 1 brand blue                                   */

const CLOSED_LAYERS = {
  lift:  {upperShell: 0, upperRooms: 0, roof: 0},
  alpha: {groundShell: 1, groundRooms: 0, upperShell: 1, upperRooms: 0, roof: 1},
  tint:  {groundShell: 0, upperShell: 0}
};

// Standing where PACRE-198 was taken: low, close, looking up at the corner.
const OPENING = {
  ...CLOSED_LAYERS,
  frame: ['groundShell', 'upperShell', 'roof'],
  fillBleed: 1.04,            // on phones the ends may run just off the screen
  anchorBottom: true,         // on phones, sit just above the headline rather than float mid-box
  pose: {az: 53.05, el: -6.67, dist: 90.77, target: [-0.02, 12.5, -0.01], fov: 100},
  photo: {id: 'photo-open', anchors: [
    [[-38.7, 0, -44], [0.6766, 0.4518]], [[-38.7, 0, 44], [0.0073, 0.4556]],
    [[-38.7, 20, -44], [0.6760, 0.3230]], [[-38.7, 20, 44], [0.0226, 0.2564]],
    [[38.7, 0, -44], [1.2534, 0.4638]], [[38.7, 0, 44], [0.2493, 0.4947]],
    [[38.7, 20, -44], [1.2371, 0.2440]], [[38.7, 20, 44], [0.2754, -0.0606]]
  ]}
};

// Health, Education and Training share the opening's camera direction (the
// PACRE-198 pose, az 53, low and looking up). The camera stays near the ground
// (lifting just enough to keep each floor readable), so that Together is a real
// climb from the ground up to the drone photo's viewpoint.
// Health: the ground floor in blue; Level 02 and the roof hover above it.
const HEALTH = {
  cam:       {az: 53.05, el: 5},
  camNarrow: {az: 53.05, el: 7},
  frame:     ['groundShell', 'upperShell'],
  fillNarrow:  0.94,
  lift:      {upperShell: 30, upperRooms: 30, roof: 60},
  alpha:     {groundShell: 1, groundRooms: 0, upperShell: 1, upperRooms: 0, roof: 1},
  tint:      {groundShell: 1, upperShell: 0}
};

// Education (School of the Air): Level 02 in blue, between the ground floor and the roof.
const EDUCATION = {
  cam:       {az: 53.05, el: -11},
  camNarrow: {az: 53.05, el: -6},
  frame:     ['groundShell', 'upperShell'],
  fillNarrow:  0.94,
  lift:      {upperShell: 26, upperRooms: 26, roof: 56},
  alpha:     {groundShell: 1, groundRooms: 0, upperShell: 1, upperRooms: 0, roof: 1},
  tint:      {groundShell: 0, upperShell: 1}
};

// Training: the same floor from the opposite corner.
const TRAINING = {
  cam:       {az: 53.05, el: -13},
  camNarrow: {az: 53.05, el: -7},
  frame:     ['groundShell', 'upperShell'],
  fillNarrow:  0.94,
  lift:      {upperShell: 26, upperRooms: 26, roof: 56},
  alpha:     {groundShell: 1, groundRooms: 0, upperShell: 1, upperRooms: 0, roof: 1},
  tint:      {groundShell: 0, upperShell: 1}
};

// Together under one roof: the floors settle, the roof goes on, and the camera
// arrives exactly where the drone photo was taken.
const DRONE = {
  ...CLOSED_LAYERS,
  frame: ['groundShell', 'upperShell', 'roof'],
  fillBleed: 0.97,
  pose: {az: 40.62, el: 14, dist: 144.4, target: [-0.02, 12.5, -0.01], fov: 50.62},
  photo: {id: 'photo-drone', anchors: [
    [[-38.7, 0, -44], [0.6223, 0.1582]], [[-38.7, 0, 44], [0.0246, 0.3322]],
    [[-38.7, 20, -44], [0.6194, 0.0160]], [[-38.7, 20, 44], [-0.0012, 0.1278]],
    [[38.7, 0, -44], [1.1737, 0.2573]], [[38.7, 0, 44], [0.6478, 0.5961]],
    [[38.7, 20, -44], [1.1876, 0.0720]], [[38.7, 20, 44], [0.6425, 0.2898]]
  ]}
};

// Index = story beat: 0 opening, 1 construction, 2 health, 3 education,
// 4 training, 5 together under one roof, 6 community, 7 partners.
const VIEW_FOR_BEAT = [OPENING, OPENING, HEALTH, EDUCATION, TRAINING, DRONE, DRONE, DRONE];
const BLEND_LENGTH = {5: 0.45};   // share of the chapter spent moving; default below
const DEFAULT_BLEND_LENGTH = 0.32;

// Within Health, Education and Training the camera keeps turning slowly after
// it arrives, so the model is never quite still.
const DRIFT_BEATS = [2, 3, 4];
const DRIFT_DEGREES = 4;

// How much of the canvas the framed layers may fill (1 = edge to edge).
const FILL = {wide: 0.88, narrow: 0.92};
const NARROW_BELOW_ASPECT = 1.25;
const BASE_FOV = 39;

/* ---------- Scene ----------------------------------------------------- */

try {
  renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.15, 1200);
  const probe = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.15, 1200);   // for maths only
  world.add(new THREE.HemisphereLight(0xffffff, 0xd0ccc5, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3.15);
  sun.position.set(-80, 150, 110);
  world.add(sun);
  const fill = new THREE.DirectionalLight(0xcddde8, 1.25);
  fill.position.set(90, 95, -110);
  world.add(fill);

  // A soft contact shadow, so the model sits on the page instead of floating.
  const shadow = (() => {
    const size = 256, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(40,30,20,0.30)');
    grad.addColorStop(0.55, 'rgba(40,30,20,0.16)');
    grad.addColorStop(1, 'rgba(40,30,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const material = new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.05, 0);
    mesh.scale.set(77.4 * 1.35, 87.8 * 1.35, 1);
    mesh.renderOrder = -1;
    world.add(mesh);
    return mesh;
  })();

  /* ---------- Framing ---------------------------------------------------
     For each free view, find the camera target and distance at which every
     sampled vertex of the framed layers sits inside the canvas, centred.
     For each pinned view, keep the photo's camera and only zoom and shift
     the picture (which does not change the perspective).                   */

  const framePoints = {};   // layer name -> flat [x, y, z, ...] of sampled vertices
  const fits = new Map();   // view -> {az, el, target, dist, fov, ox, oy}
  const POINTS_PER_LAYER = 4000;

  const centroids = {};   // layer name -> [x, y, z] average of its sampled vertices
  function collectFramePoints() {
    const v = new THREE.Vector3();
    for (const name of LAYER_NAMES) {
      let total = 0;
      for (const mesh of layers[name].meshes) total += mesh.geometry.attributes.position.count;
      const stride = Math.max(1, Math.floor(total / POINTS_PER_LAYER));
      const out = [];
      for (const mesh of layers[name].meshes) {
        mesh.updateWorldMatrix(true, false);
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i += stride) {
          v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
          out.push(v.x, v.y, v.z);
        }
      }
      framePoints[name] = Float32Array.from(out);
      const c = [0, 0, 0], n = out.length / 3 || 1;
      for (let i = 0; i < out.length; i += 3) { c[0] += out[i] / n; c[1] += out[i + 1] / n; c[2] += out[i + 2] / n; }
      centroids[name] = c;
    }
  }

  function fitView(view, narrow, bleed) {
    const angles = narrow ? {...view.cam, ...view.camNarrow} : view.cam;
    const az = angles.az * DEG, el = angles.el * DEG;
    const toCamera = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const forward = toCamera.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const tanV = Math.tan(BASE_FOV * DEG / 2);
    const tanH = tanV * camera.aspect;
    const limit = bleed ? (view.fillNarrow || FILL.narrow) : narrow ? FILL.narrow : FILL.wide;
    const frameLayers = (bleed && view.frameNarrow) || view.frame;

    // Express every framed vertex in camera space (x right, y up, z away).
    let count = 0;
    for (const name of frameLayers) count += framePoints[name].length / 3;
    const xs = new Float32Array(count), ys = new Float32Array(count), zs = new Float32Array(count);
    let n = 0;
    for (const name of frameLayers) {
      const points = framePoints[name], lift = view.lift[name] || 0;
      for (let i = 0; i < points.length; i += 3, n++) {
        const px = points[i], py = points[i + 1] + lift, pz = points[i + 2];
        xs[n] = px * right.x + py * right.y + pz * right.z;
        ys[n] = px * up.x + py * up.y + pz * up.z;
        zs[n] = px * forward.x + py * forward.y + pz * forward.z;
      }
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sumZ = 0;
    for (let i = 0; i < count; i++) {
      minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]);
      minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]);
      sumZ += zs[i];
    }
    let tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    const tz = sumZ / count;

    // Perspective shifts the visual centre, so settle the distance and the
    // centring together over a few passes.
    let dist = 1;
    for (let pass = 0; pass < 4; pass++) {
      dist = 1;
      for (let i = 0; i < count; i++) {
        const x = xs[i] - tx, y = ys[i] - ty, z = zs[i] - tz;
        dist = Math.max(dist, Math.abs(x) / (limit * tanH) - z, Math.abs(y) / (limit * tanV) - z);
      }
      let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
      for (let i = 0; i < count; i++) {
        const depth = dist + zs[i] - tz;
        const nx = (xs[i] - tx) / (depth * tanH), ny = (ys[i] - ty) / (depth * tanV);
        loX = Math.min(loX, nx); hiX = Math.max(hiX, nx);
        loY = Math.min(loY, ny); hiY = Math.max(hiY, ny);
      }
      tx += (loX + hiX) / 2 * dist * tanH;
      ty += (loY + hiY) / 2 * dist * tanV;
    }

    const target = right.clone().multiplyScalar(tx).addScaledVector(up, ty).addScaledVector(forward, tz);
    return {az: angles.az, el: angles.el, target: target.toArray(), dist, fov: BASE_FOV, ox: 0, oy: 0};
  }

  // Pinned view: the photo's camera, zoomed (by narrowing the field of view)
  // and shifted on screen so the building sits centred in the canvas.
  function fitPinned(view, narrow, bleed) {
    const p = view.pose;
    applyCamera(probe, {...p, ox: 0, oy: 0});
    const v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const name of view.frame) {
      const points = framePoints[name];
      for (let i = 0; i < points.length; i += 3) {
        v.set(points[i], points[i + 1], points[i + 2]).project(probe);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
    }
    const fillX = bleed ? view.fillBleed : narrow ? FILL.narrow : FILL.wide;
    const fillY = bleed ? Math.min(0.94, FILL.narrow) : narrow ? FILL.narrow : FILL.wide;
    const k = Math.min(2 * fillX / (x1 - x0), 2 * fillY / (y1 - y0));
    const fov = 2 * Math.atan(Math.tan(p.fov * DEG / 2) / k) / DEG;
    let oy = -k * (y0 + y1) / 2;
    if (bleed && view.anchorBottom) oy = -0.97 - k * y0;   // bottom of the building near the bottom of the canvas
    return {az: p.az, el: p.el, dist: p.dist, target: p.target.slice(), fov, ox: -k * (x0 + x1) / 2, oy};
  }

  // A canvas that spans the whole screen width is the phone-held-upright layout:
  // there is no page edge to hide a cropped model against, because the screen is it.
  function runsFullWidth() {
    return canvas.getBoundingClientRect().width >= innerWidth * 0.99;
  }

  function refit() {
    if (!model) return;
    probe.aspect = camera.aspect;
    const bleed = runsFullWidth();
    const narrow = bleed || camera.aspect < NARROW_BELOW_ASPECT;
    fits.clear();
    for (const view of new Set(VIEW_FOR_BEAT)) fits.set(view, view.pose ? fitPinned(view, narrow, bleed) : fitView(view, narrow, bleed));
    placePhotos();
  }

  /* ---------- Camera ---------------------------------------------------- */

  const shift = new THREE.Matrix4();
  function applyCamera(cam, c) {
    const az = c.az * DEG, el = c.el * DEG;
    cam.position.set(
      c.target[0] + c.dist * Math.sin(az) * Math.cos(el),
      c.target[1] + c.dist * Math.sin(el),
      c.target[2] + c.dist * Math.cos(az) * Math.cos(el)
    );
    cam.lookAt(c.target[0], c.target[1], c.target[2]);
    cam.updateMatrixWorld();
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    if (c.ox || c.oy) {
      // Shift the finished picture on screen (applied after projection).
      shift.set(1, 0, 0, c.ox, 0, 1, 0, c.oy, 0, 0, 1, 0, 0, 0, 0, 1);
      cam.projectionMatrix.premultiply(shift);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
  }

  /* ---------- Photo registration ----------------------------------------
     Least-squares similarity (scale, rotation, offset) that carries each
     anchor's photo position onto where the pinned camera draws it.        */

  function placePhotos() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const v = new THREE.Vector3();
    for (const view of new Set(VIEW_FOR_BEAT)) {
      if (!view.photo) continue;
      const img = document.getElementById(view.photo.id);
      const fit = fits.get(view);
      if (!img || !fit) continue;
      applyCamera(probe, fit);
      const src = [], dst = [];
      for (const [world, photo] of view.photo.anchors) {
        v.set(world[0], world[1], world[2]).project(probe);
        dst.push([(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]);
        src.push([photo[0] * 1000, photo[1] * 1000]);   // the <img> is laid out 1000px wide
      }
      const n = src.length;
      const su = src.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
      const sd = dst.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
      let num1 = 0, num2 = 0, den = 0;
      for (let i = 0; i < n; i++) {
        const u = src[i][0] - su[0], w = src[i][1] - su[1], X = dst[i][0] - sd[0], Y = dst[i][1] - sd[1];
        num1 += u * X + w * Y; num2 += u * Y - w * X; den += u * u + w * w;
      }
      const A = num1 / den, B = num2 / den;
      const tx = sd[0] - A * su[0] + B * su[1], ty = sd[1] - B * su[0] - A * su[1];
      img.style.transform = `matrix(${A}, ${B}, ${-B}, ${A}, ${tx}, ${ty})`;
      img.classList.add('registered');
    }
  }

  /* ---------- Repairs ---------------------------------------------------- */

  // Triangles of a mesh as flat world-space positions.
  function worldTriangles(mesh) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = g.attributes.position.array.slice();
    const v = new THREE.Vector3();
    for (let i = 0; i < p.length; i += 3) { v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(mesh.matrixWorld); p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z; }
    return p;
  }
  function flatness(p, i) {   // |normal.y| of triangle starting at float index i
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    return Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
  }
  function meshFrom(positions, like, name) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, like.material);
    m.name = name;
    return m;
  }

  function repairFloors(root) {
    let level2 = null;
    const roofs = [];
    root.traverse(m => { if (!m.isMesh) return; if (m.name.startsWith('EDUCATION_')) level2 = m; if (m.name.startsWith('ROOF_')) roofs.push(m); });
    if (!level2 || !roofs.length) return;

    // 1. Flat triangles at roof height inside the Level 02 mesh belong to the roof.
    const tri = worldTriangles(level2), keep = [], roofPiece = [];
    for (let i = 0; i < tri.length; i += 9) {
      const top = Math.min(tri[i + 1], tri[i + 4], tri[i + 7]) > 16.4;
      (top && flatness(tri, i) > 0.9 ? roofPiece : keep).push(...tri.subarray(i, i + 9));
    }
    const parent = level2.parent;
    const newLevel2 = meshFrom(keep, level2, level2.name);
    parent.remove(level2); parent.add(newLevel2);
    if (roofPiece.length) parent.add(meshFrom(roofPiece, roofs[0], 'ROOF_RepairedSlab'));

    // 2. A floor plate for Level 02, the shape of the roof's outline. The roof
    //    surfaces are drawn into a fine grid, holes in it are filled, and the
    //    result is laid at floor level as one solid plate (its stepped edge is
    //    hidden inside the walls).
    const CELL = 0.5, FLOOR_Y = 5.6;
    const box = new THREE.Box3();
    for (const r of roofs) box.expandByObject(r);
    const x0 = box.min.x - 1, z0 = box.min.z - 1;
    const nx = Math.ceil((box.max.x - x0 + 1) / CELL), nz = Math.ceil((box.max.z - z0 + 1) / CELL);
    const grid = new Uint8Array(nx * nz);
    const fillTriangle = (ax, az, bx, bz, cx, cz) => {
      const minI = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / CELL)), maxI = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / CELL));
      const minJ = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / CELL)), maxJ = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) - z0) / CELL));
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) return;
      for (let j = minJ; j <= maxJ; j++) for (let i = minI; i <= maxI; i++) {
        const px = x0 + (i + 0.5) * CELL, pz = z0 + (j + 0.5) * CELL;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) grid[j * nx + i] = 1;
      }
    };
    for (const t of [...roofs.map(worldTriangles), Float32Array.from(roofPiece)]) for (let i = 0; i < t.length; i += 9) {
      if (Math.min(t[i + 1], t[i + 4], t[i + 7]) < 16.4) continue;
      fillTriangle(t[i], t[i + 2], t[i + 3], t[i + 5], t[i + 6], t[i + 8]);
    }
    // Fill holes: anything not reachable from the border is inside.
    const outside = new Uint8Array(nx * nz), stack = [];
    for (let i = 0; i < nx; i++) stack.push(i, (nz - 1) * nx + i);
    for (let j = 0; j < nz; j++) stack.push(j * nx, j * nx + nx - 1);
    while (stack.length) {
      const k = stack.pop();
      if (outside[k] || grid[k]) continue;
      outside[k] = 1;
      const i = k % nx, j = (k - i) / nx;
      if (i > 0) stack.push(k - 1); if (i < nx - 1) stack.push(k + 1); if (j > 0) stack.push(k - nx); if (j < nz - 1) stack.push(k + nx);
    }
    const plate = [];
    for (let j = 0; j < nz; j++) {
      let i = 0;
      while (i < nx) {
        if (outside[j * nx + i]) { i++; continue; }
        const start = i;
        while (i < nx && !outside[j * nx + i]) i++;
        const ax = x0 + start * CELL, bx = x0 + i * CELL, az = z0 + j * CELL, bz = az + CELL;
        plate.push(ax, FLOOR_Y, az, bx, FLOOR_Y, bz, bx, FLOOR_Y, az, ax, FLOOR_Y, az, ax, FLOOR_Y, bz, bx, FLOOR_Y, bz);
      }
    }
    if (plate.length) parent.add(meshFrom(plate, newLevel2, 'EDUCATION_FloorPlate'));
    level2.geometry.dispose();
  }

  /* ---------- Model ----------------------------------------------------- */

  new GLTFLoader().load('assets/port-augusta-ivory.glb', gltf => {
    model = gltf.scene;
    const materialCache = new Map();   // one material per (source material, layer)

    // Interior rooms and wayfinding are not shown: take them out of the scene.
    const drop = [];
    model.traverse(mesh => { if (mesh.isMesh && /^(WAYFIND_|GROUND_|UPPER_)/.test(mesh.name)) drop.push(mesh); });
    for (const mesh of drop) { mesh.parent.remove(mesh); mesh.geometry.dispose(); }
    repairFloors(model);

    model.traverse(mesh => {
      if (!mesh.isMesh) return;

      const prefix = Object.keys(LAYER_BY_PREFIX).find(p => mesh.name.startsWith(p));
      const layerName = LAYER_BY_PREFIX[prefix] || 'groundShell';
      const layer = layers[layerName];

      const cacheKey = mesh.material.uuid + '|' + layerName;
      let material = materialCache.get(cacheKey);
      if (!material) {
        material = mesh.material.clone();       // keeps flatShading set by the loader
        material.side = THREE.DoubleSide;
        material.roughness = 0.95;
        material.metalness = 0;
        // Always transparent: switching this flag later does not recompile the
        // shader, so a layer that starts opaque could never fade.
        material.transparent = true;
        material.userData.base = material.color.clone();
        materialCache.set(cacheKey, material);
        layer.materials.push(material);
      }

      mesh.material = material;
      mesh.userData.baseY = mesh.position.y;
      layer.meshes.push(mesh);
    });

    world.add(model);
    collectFramePoints();
    refit();
    needsRender = true;

    window.rfdsModelReady = true;
    window.rfdsModelDiagnostics = {
      roofMeshes: layers.roof.meshes.length,
      upperMeshes: layers.upperShell.meshes.length,
      interiorMeshes: 0,
      version: 'V4, rooms hidden, roof repaired'
    };
  }, undefined, error => {
    window.rfdsModelError = String(error);
    console.warn('Schematic model unavailable', error);
  });

  let needsRender = true;
  let lastAspect = 0, lastBleed = null;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    const bleed = runsFullWidth();
    if (camera.aspect !== lastAspect || bleed !== lastBleed) { lastAspect = camera.aspect; lastBleed = bleed; refit(); }
    else placePhotos();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const liftTotal = view => Object.values(view.lift).reduce((s, v) => s + v, 0);

  let lastKey = '';
  function frame() {
    requestAnimationFrame(frame);
    const story = window.rfdsStory;
    if (!model || !story || !fits.size) return;

    // Nothing to redraw while the scroll position has not moved.
    const key = [story.beat, story.local.toFixed(4), story.paused, story.visible, canvas.width, canvas.height].join('|');
    if (key === lastKey && !needsRender) return;
    lastKey = key;
    needsRender = false;

    const beat = clamp(story.beat, 0, VIEW_FOR_BEAT.length - 1);
    const from = VIEW_FOR_BEAT[Math.max(0, beat - 1)];
    const to = VIEW_FOR_BEAT[beat];
    const blendLength = BLEND_LENGTH[beat] || DEFAULT_BLEND_LENGTH;
    const progress = story.paused ? 1 : span(story.local, 0, blendLength);

    // Camera: flies across the whole move, easing in a moment after the layers start.
    // The drift carries over between chapters, so there is no jump at the join.
    const tCam = smooth(span(progress, 0.04, 1));
    const a = fits.get(from), b = fits.get(to);
    const driftIn = DRIFT_BEATS.includes(beat - 1) ? DRIFT_DEGREES : 0;
    const driftNow = DRIFT_BEATS.includes(beat) && !story.paused ? DRIFT_DEGREES * smooth(span(story.local, blendLength, 1)) : 0;
    const cam = {
      az: mix(a.az + driftIn, b.az, tCam) + driftNow,
      el: mix(a.el, b.el, tCam),
      dist: mix(a.dist, b.dist, tCam),
      target: a.target.map((v, i) => mix(v, b.target[i], tCam)),
      fov: mix(a.fov, b.fov, tCam),
      ox: mix(a.ox, b.ox, tCam),
      oy: mix(a.oy, b.oy, tCam)
    };
    // Never below ground: keep the eye at least 2 units up (lift the angle if needed).
    const eyeY = cam.target[1] + cam.dist * Math.sin(cam.el * DEG);
    if (eyeY < 2) cam.el = Math.asin(clamp((2 - cam.target[1]) / cam.dist, -1, 1)) / DEG;
    applyCamera(camera, cam);

    // Layers: lift, visibility and tint, each on its own staggered clock.
    const stagger = liftTotal(to) < liftTotal(from) ? CLOSE_STAGGER : OPEN_STAGGER;
    const lift = {}, alpha = {}, tint = {};
    for (const name of LAYER_NAMES) {
      const t = smooth(span(progress, stagger[name], stagger[name] + LAYER_MOVE));
      alpha[name] = mix(from.alpha[name], to.alpha[name], t);
      if (name in from.lift) lift[name] = mix(from.lift[name], to.lift[name], t);
      if (name in from.tint) tint[name] = mix(from.tint[name], to.tint[name], t);

      const layer = layers[name];
      const solid = alpha[name] > 0.98;
      const shown = alpha[name] > 0.01;
      for (const mesh of layer.meshes) {
        mesh.visible = shown;
        if (name in lift) mesh.position.y = mesh.userData.baseY + lift[name];
        mesh.renderOrder = solid ? 0 : 10;   // ghosted layers draw after solid ones
      }
      for (const material of layer.materials) {
        material.opacity = alpha[name];
        material.depthWrite = solid;
        if (TINTED.includes(name)) material.color.copy(material.userData.base).lerp(ACCENT, tint[name] * TINT_STRENGTH);
        // Seen from below, the blue floor would fall into shadow; a little glow keeps it light blue.
        if (TINTED.includes(name) && material.emissive) material.emissive.copy(ACCENT).multiplyScalar(0.32 * tint[name]);
      }
    }
    // Flights to and from the photo-matched views pass through framings neither
    // end was fitted for. If the building would spill off the canvas mid-flight,
    // widen the view just enough to keep it in.
    if ((to.pose || from.pose) && tCam > 0 && tCam < 1) {
      const v = new THREE.Vector3();
      let reach = 0;
      for (const name of to.frame) {   // only what the destination view needs to keep in frame
        if (alpha[name] < 0.05) continue;
        const points = framePoints[name], step = Math.max(3, Math.floor(points.length / 3 / 400) * 3), dy = lift[name] || 0;
        for (let i = 0; i < points.length; i += step) {
          v.set(points[i], points[i + 1] + dy, points[i + 2]).project(camera);
          reach = Math.max(reach, Math.abs(v.x), Math.abs(v.y));
        }
      }
      const limit = runsFullWidth() ? 0.98 : 0.94;
      if (reach > limit) {
        // Ease the correction in, so the first frames of the flight do not jump.
        const k = mix(1, limit / reach, smooth(tCam / 0.35));
        applyCamera(camera, {...cam, fov: 2 * Math.atan(Math.tan(cam.fov * DEG / 2) / k) / DEG, ox: cam.ox * k, oy: cam.oy * k});
      }
    }
    // Where the photo cards grow from (the focus floor) and fly back into (the
    // middle of the building), in canvas pixels, for story.js.
    const focus = tint.groundShell > 0.5 ? 'groundShell' : tint.upperShell > 0.5 ? 'upperShell' : null;
    const toScreen = (p, dy = 0) => { const v = new THREE.Vector3(p[0], p[1] + dy, p[2]).project(camera); return [(v.x + 1) / 2 * canvas.clientWidth, (1 - v.y) / 2 * canvas.clientHeight]; };
    const core = [0, 0, 0].map((_, i) => (centroids.groundShell[i] + centroids.upperShell[i] + centroids.roof[i]) / 3);
    core[1] = (centroids.groundShell[1] + (centroids.upperShell[1] + (lift.upperShell || 0)) + (centroids.roof[1] + (lift.roof || 0))) / 3;
    window.rfdsAnchors = {floor: focus ? toScreen(centroids[focus], lift[focus] || 0) : null, core: toScreen(core)};

    shadow.material.opacity = alpha.groundShell;
    shadow.visible = alpha.groundShell > 0.01;

    // Read-outs used by QA scripts and the browser console.
    window.rfdsModelDiagnostics = {...window.rfdsModelDiagnostics, beat, roofLift: lift.roof, upperLift: lift.upperShell, alpha, tint, cam};
    canvas.dataset.roofLift = lift.roof.toFixed(3);
    canvas.dataset.upperLift = lift.upperShell.toFixed(3);
    canvas.dataset.focus = tint.groundShell > 0.5 ? 'ground floor' : tint.upperShell > 0.5 ? 'second floor' : 'whole building';
    canvas.dataset.modelVersion = 'V4, rooms hidden, roof repaired';

    // Nothing to draw while the canvas is hidden.
    const modelAlpha = story.modelAlpha ?? (1 - story.photoAlpha);
    if (story.visible && modelAlpha > 0.001) renderer.render(world, camera);
  }
  frame();
} catch (error) {
  window.rfdsModelError = String(error);
  console.warn('WebGL unavailable', error);
}
