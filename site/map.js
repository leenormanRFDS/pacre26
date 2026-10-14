/* ======================================================================
   RFDS Port Augusta Centre: map for the last two chapters

   A still satellite image of Port Augusta at town scale, centred on the
   centre at 38 Mackay Street. No map controls and no scroll handling, so it
   never gets in the way of the story. Tapping it opens Google Maps at the
   address. It loads once the reader reaches Training; if it fails, story.js
   keeps showing the original photographs for these chapters.

   The image comes from the Mapbox Static Images API using the public token
   below (restrict it to your domain in your Mapbox account). Attribution is
   shown as text beside the map (#map-credits), as Mapbox requires when the
   image's own attribution is turned off.
   ====================================================================== */

const SITE = {lon: 137.76586, lat: -32.48980};
const ZOOM = {wide: 12.9, phone: 12.5};   // town scale: Port Augusta and the head of the gulf
const MAPBOX_TOKEN = window.RFDS_MAPBOX_TOKEN || 'pk.eyJ1IjoiYW9zYSIsImEiOiJjbXJmbGlpYTQwem9lMnhva2NhMDBpeGRkIn0.6uqXCOuAxWyw0seiHayhiA';
const GOOGLE_MAPS = 'https://www.google.com/maps/search/?api=1&query=38%20Mackay%20Street%2C%20Port%20Augusta%20SA%205700';

const container = document.querySelector('#map');
const credits = document.querySelector('#map-credits');
let started = false;

function load() {
  if (started || !container || !MAPBOX_TOKEN) return;
  started = true;
  const phone = matchMedia('(max-width:800px)').matches;
  const [w, h] = phone ? [440, 600] : [900, 760];
  const zoom = phone ? ZOOM.phone : ZOOM.wide;

  const link = document.createElement('a');
  link.className = 'map-link';
  link.href = GOOGLE_MAPS; link.target = '_blank'; link.rel = 'noopener';
  link.setAttribute('aria-label', 'RFDS Port Augusta Centre, 38 Mackay Street, Port Augusta. Open in Google Maps');

  const img = new Image();
  img.alt = ''; img.decoding = 'async';
  img.src = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${SITE.lon},${SITE.lat},${zoom},0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
  img.onload = () => { window.rfdsMapReady = true; };
  img.onerror = () => { window.rfdsMapError = 'Map image did not load'; };

  // The site is at the centre of the image, and the image is centred in its frame.
  const marker = document.createElement('span');
  marker.className = 'map-marker';
  marker.innerHTML = '<i></i><b>RFDS Port Augusta Centre</b>';

  link.append(img, marker);
  container.append(link);
  if (credits) credits.innerHTML = '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © Maxar';
}

function tick() {
  const story = window.rfdsStory;
  if (story && story.beat >= 4) { load(); return; }
  requestAnimationFrame(tick);
}
tick();
