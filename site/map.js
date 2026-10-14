/* ======================================================================
   RFDS Port Augusta Centre: satellite map for the last two chapters

   "Supporting our regions to thrive"   the model on the map, then the whole
                                        of Port Augusta
   "Our community. Our partners."       out to outback South Australia, with
                                        the remote towns the centre supports

   CesiumJS and the Mapbox satellite imagery load only once the reader gets
   to Training, so nobody who stops early downloads them. If either fails,
   story.js keeps showing the original photographs for these chapters.

   SITE places the GLB on the map. Its position is 38 Mackay Street (the
   footings are visible in recent aerial imagery). The heading lines the
   model up with the street grid; if the building faces the wrong way, turn
   it by 90 or 180 degrees here. Scale 0.6 m per model unit gives roughly
   46 x 53 m and 12 m to the roof.
   ====================================================================== */

const SITE = {lon: 137.76586, lat: -32.48980, heading: -30.7, scale: 0.6};

// Mapbox public token (a pk. token is designed to sit in browser code). Restrict
// it to your domain in your Mapbox account (Tokens > URL restrictions). Define
// window.RFDS_MAPBOX_TOKEN before this file loads to override it.
const MAPBOX_TOKEN = window.RFDS_MAPBOX_TOKEN || 'pk.eyJ1IjoiYW9zYSIsImEiOiJjbXJmbGlpYTQwem9lMnhva2NhMDBpeGRkIn0.6uqXCOuAxWyw0seiHayhiA';

const CESIUM_URL = 'https://cdn.jsdelivr.net/npm/cesium@1.120.0/Build/Cesium/';

// Remote communities served from the region (shown in the outback view).
const TOWNS = [
  ['Coober Pedy', 134.755, -29.013], ['Roxby Downs', 136.897, -30.562], ['Andamooka', 137.166, -30.448],
  ['Woomera', 136.833, -31.199], ['Leigh Creek', 138.403, -30.590], ['Marree', 138.063, -29.648],
  ['Oodnadatta', 135.447, -27.549], ['Whyalla', 137.584, -33.033], ['Port Pirie', 138.017, -33.185],
  ['Ceduna', 133.677, -32.126], ['Hawker', 138.418, -31.889], ['Quorn', 138.041, -32.347]
];

// The drone photo's camera, in model terms (see DRONE in model.js), so the map
// opens from the same side of the building as the photo it follows.
const DRONE_AZ = 40.62;

/* Camera keyframes along the story. s = beat + progress within the beat.
   target: [lon, lat]; heading/pitch in degrees; range in metres.          */
function keyframes() {
  const azr = DRONE_AZ * Math.PI / 180;
  const bearing = SITE.heading + Math.atan2(Math.cos(azr), Math.sin(azr)) * 180 / Math.PI;   // model +x = north, +z = east
  const facing = bearing + 180;
  return [
    {s: 5.86, target: [SITE.lon, SITE.lat], heading: facing,      pitch: -28, range: 150},
    {s: 6.12, target: [SITE.lon, SITE.lat], heading: facing + 14, pitch: -38, range: 380},
    {s: 6.55, target: [137.7790, -32.4930], heading: facing + 40, pitch: -52, range: 9500},
    {s: 6.90, target: [137.7790, -32.4930], heading: facing + 46, pitch: -56, range: 11000},
    {s: 7.45, target: [136.60, -30.35],     heading: 360,         pitch: -88, range: 1700000},
    {s: 7.99, target: [136.60, -30.40],     heading: 360,         pitch: -89, range: 1780000}
  ];
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const mixAngle = (a, b, t) => a + (((b - a) % 360 + 540) % 360 - 180) * t;

function cameraAt(s, frames) {
  if (s <= frames[0].s) return frames[0];
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (s <= b.s) {
      const t = smooth((s - a.s) / (b.s - a.s));
      return {
        target: [mix(a.target[0], b.target[0], t), mix(a.target[1], b.target[1], t)],
        heading: mixAngle(a.heading, b.heading, t),
        pitch: mix(a.pitch, b.pitch, t),
        range: Math.exp(mix(Math.log(a.range), Math.log(b.range), t))
      };
    }
  }
  return frames[frames.length - 1];
}

let widget = null, frames = null, started = false, lastKey = '';
const container = document.querySelector('#map');
const credits = document.querySelector('#map-credits');

// Download CesiumJS in the background (no running it yet) while the reader is
// still in the model chapters.
let prefetched = false;
function prefetchCesium() {
  if (prefetched || !container || !MAPBOX_TOKEN) return;
  prefetched = true;
  for (const href of [CESIUM_URL + 'Cesium.js', CESIUM_URL + 'Widgets/widgets.css']) {
    const link = document.createElement('link');
    link.rel = 'prefetch'; link.href = href; link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

// Running CesiumJS and creating the globe takes a second or two of main-thread
// work on a phone, so it happens while the drone photo is holding still.
function loadCesium() {
  if (started || !container || !MAPBOX_TOKEN) return;
  started = true;
  window.CESIUM_BASE_URL = CESIUM_URL;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = CESIUM_URL + 'Widgets/widgets.css'; css.crossOrigin = 'anonymous';
  document.head.appendChild(css);
  const script = document.createElement('script');
  script.src = CESIUM_URL + 'Cesium.js'; script.crossOrigin = 'anonymous';
  script.onload = () => init().catch(fail);
  script.onerror = () => fail('Cesium did not load');
  document.head.appendChild(script);
}

function fail(error) {
  window.rfdsMapError = String(error);
  console.warn('Map unavailable', error);
}

async function init() {
  const C = window.Cesium;
  // Phones get standard-resolution satellite tiles: the globe is drawn at screen-pixel
  // resolution, so double-resolution tiles would mostly be thrown away.
  const imagery = new C.ImageryLayer(new C.MapboxStyleImageryProvider(Object.assign({styleId: 'satellite-v9', accessToken: MAPBOX_TOKEN, tilesize: 512},
    container.clientWidth >= 600 ? {scaleFactor: true} : {})));   // Cesium adds @2x whenever scaleFactor is present, even if false
  imagery.saturation = 0.82;
  imagery.brightness = 1.04;

  widget = new C.CesiumWidget(container, {
    baseLayer: imagery,
    terrainProvider: new C.EllipsoidTerrainProvider(),
    creditContainer: credits,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    skyBox: false,
    skyAtmosphere: false,
    contextOptions: {webgl: {alpha: true}},
    useBrowserRecommendedResolution: true
  });
  const scene = widget.scene;
  scene.backgroundColor = C.Color.fromCssColorString('#F7F4EE');
  scene.globe.baseColor = C.Color.fromCssColorString('#cdb89a');
  scene.globe.showGroundAtmosphere = false;
  if (container.clientWidth < 600) scene.globe.maximumScreenSpaceError = 3;   // fewer, coarser tiles on phones
  scene.globe.enableLighting = false;
  scene.fog.enabled = true;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.screenSpaceCameraController.enableInputs = false;   // scroll drives the camera, never touch
  scene.light = new C.DirectionalLight({direction: C.Cartesian3.normalize(new C.Cartesian3(0.35, -0.55, -0.75), new C.Cartesian3())});

  const origin = C.Cartesian3.fromDegrees(SITE.lon, SITE.lat, 0);
  const placement = C.Transforms.headingPitchRollToFixedFrame(origin, new C.HeadingPitchRoll(C.Math.toRadians(SITE.heading), 0, 0));

  // A pale site pad under the building, so older imagery of the lot does not show through.
  const pad = [];
  const hx = 77.4 / 2 * SITE.scale + 6, hz = 87.8 / 2 * SITE.scale + 6;
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) {
    pad.push(C.Matrix4.multiplyByPoint(placement, new C.Cartesian3(z, x, 0.4), new C.Cartesian3()));   // local frame is east, north, up; model x runs north, z east
  }
  scene.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({
      geometry: new C.PolygonGeometry({polygonHierarchy: new C.PolygonHierarchy(pad), perPositionHeight: true}),
      attributes: {color: C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#e9e2d6'))}
    }),
    appearance: new C.PerInstanceColorAppearance({flat: true, translucent: false}),
    asynchronous: false
  }));

  // The building.
  const model = await C.Model.fromGltfAsync({url: 'assets/port-augusta-centre.glb', modelMatrix: placement, scale: SITE.scale, shadows: C.ShadowMode.DISABLED});
  scene.primitives.add(model);

  // Labels, the centre's marker and flight arcs out to the towns.
  const font = '600 13px "museo-sans", "Museo Sans", "Avenir Next", Arial, sans-serif';
  const labels = scene.primitives.add(new C.LabelCollection());
  const points = scene.primitives.add(new C.PointPrimitiveCollection());
  const near = new C.DistanceDisplayCondition(600, 60000), far = new C.DistanceDisplayCondition(150000, 1e8);
  points.add({position: origin, pixelSize: 9, color: C.Color.fromCssColorString('#008dc7'), outlineColor: C.Color.WHITE, outlineWidth: 2, distanceDisplayCondition: new C.DistanceDisplayCondition(400, 1e8), disableDepthTestDistance: Number.POSITIVE_INFINITY});
  labels.add({position: origin, text: 'RFDS PORT AUGUSTA CENTRE', font, fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#00284d').withAlpha(0.75), outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(12, -12), horizontalOrigin: C.HorizontalOrigin.LEFT, distanceDisplayCondition: near, disableDepthTestDistance: Number.POSITIVE_INFINITY});
  labels.add({position: origin, text: 'PORT AUGUSTA', font: '700 14px "museo-sans", "Museo Sans", "Avenir Next", Arial, sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#00284d').withAlpha(0.8), outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(12, -12), horizontalOrigin: C.HorizontalOrigin.LEFT, distanceDisplayCondition: far, disableDepthTestDistance: Number.POSITIVE_INFINITY});

  const arcs = scene.primitives.add(new C.PolylineCollection());
  const geodesic = new C.EllipsoidGeodesic();
  const start = C.Cartographic.fromDegrees(SITE.lon, SITE.lat);
  // On narrow screens, fewer towns so the names do not pile up.
  const FEW = ['Coober Pedy', 'Roxby Downs', 'Woomera', 'Marree', 'Oodnadatta', 'Whyalla', 'Ceduna'];
  const towns = container.clientWidth < 560 ? TOWNS.filter(t => FEW.includes(t[0])) : TOWNS;
  for (const [name, lon, lat] of towns) {
    const end = C.Cartographic.fromDegrees(lon, lat);
    const position = C.Cartesian3.fromDegrees(lon, lat);
    points.add({position, pixelSize: 5, color: C.Color.WHITE, distanceDisplayCondition: far});
    labels.add({position, text: name.toUpperCase(), font: '600 11px "museo-sans", "Museo Sans", "Avenir Next", Arial, sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#00284d').withAlpha(0.7), outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(8, -6), horizontalOrigin: C.HorizontalOrigin.LEFT, distanceDisplayCondition: far});
    geodesic.setEndPoints(start, end);
    const lift = geodesic.surfaceDistance * 0.12, path = [];
    for (let i = 0; i <= 48; i++) {
      const f = i / 48, c = geodesic.interpolateUsingFraction(f);
      path.push(C.Cartesian3.fromRadians(c.longitude, c.latitude, Math.sin(Math.PI * f) * lift));
    }
    arcs.add({positions: path, width: 1.6, material: C.Material.fromType('Color', {color: C.Color.WHITE.withAlpha(0.7)}), distanceDisplayCondition: far});
  }

  frames = keyframes();
  new ResizeObserver(() => scene.requestRender()).observe(container);
  window.rfdsMapReady = true;
  scene.globe.tileLoadProgressEvent.addEventListener(() => scene.requestRender());
}

function tick() {
  requestAnimationFrame(tick);
  const story = window.rfdsStory;
  if (!story) return;
  if (story.beat >= 4) prefetchCesium();
  if ((story.beat === 5 && story.local >= 0.62) || story.beat >= 6) loadCesium();
  if (!widget || !frames || story.beat < 5) return;
  const s = story.paused ? Math.floor(story.beat + story.local) + 0.6 : story.beat + story.local;
  const key = s.toFixed(4) + '|' + container.clientWidth + 'x' + container.clientHeight;
  if (key === lastKey) return;
  lastKey = key;
  const C = window.Cesium, cam = cameraAt(s, frames);
  widget.scene.camera.lookAt(
    C.Cartesian3.fromDegrees(cam.target[0], cam.target[1], 0),
    new C.HeadingPitchRange(C.Math.toRadians(cam.heading), C.Math.toRadians(cam.pitch), cam.range)
  );
  widget.scene.requestRender();
  window.rfdsMapDiagnostics = {s, cam};
}
tick();
