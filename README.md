# RFDS Port Augusta Centre for Rural Health and Education

Photography-integrated architectural scrollytelling preview, based on the PACRE ivory GLB, optimised for the web (see Performance).

## Preview locally

No installation or build is required. Serve the `site` folder over HTTP:

```sh
python3 -m http.server 8080 --directory site
```

Open `http://localhost:8080`. File URLs may prevent the model from loading. The Three.js dependencies, model, images and logo are packaged locally.

The map chapters need an internet connection: CesiumJS 1.120 loads from the jsDelivr CDN and the satellite imagery from Mapbox, using the public token in `site/map.js` (restrict it to your domain in your Mapbox account). Both load only once a reader reaches the Training chapter; if either fails, the original photographs show instead. The model's position on the map (`SITE` at the top of `map.js`) is set from the street address and recent aerial imagery; check the heading against the real building.

**Typeface.** Museo Sans loads from the RFDS Adobe Fonts web project (`https://use.typekit.net/woa6nwj.css`, weights 100 to 900). Adobe Fonts only serves a kit to the domains listed in that project, so every domain the site runs on (the Vercel URL, any custom domain) must be added under the project's Domains setting. Until a domain is listed, that site falls back to Avenir Next, then Arial. `localhost` works for local previews.

**FAQ.** The questions at the end of the page are a plain accordion in `site/index.html` (one `<details>` per question). Each question has its own link, e.g. `/#faq-when-open`, which opens that answer; `site/faq.js` handles this. The same questions and answers also sit in the `application/ld+json` block in the page head, which search engines and AI assistants read. When you edit a question or answer, change it in both places so they match.

**Performance.** The site is built to stay light on phones and regional mobile networks:

- The 3D model the site loads (`site/assets/port-augusta-centre.glb`, about 230 KB over the network) is built from the source model in `tools/model/source/` by `tools/model/build-model.mjs`: interiors removed, the roof and Level 02 repairs baked in, flat areas simplified and the geometry compressed (meshopt). The original was about 1.9 MB over the network and was downloaded twice (once by the map). To rebuild after changing the source model or the repair code: `cd tools/model && npm install && npm run build`.
- The model starts loading after the first screen has painted (or as soon as the reader scrolls). Museo Sans loads without blocking the first paint.
- The satellite map library downloads in the background during Training and starts up while the drone photo holds still in Together, so the set-up pause never lands on a moving scene. Phones get standard-resolution satellite tiles.
- The story's scroll loop does nothing while the page is still and never reads layout mid-frame.
- `site/vercel.json` lets browsers cache images, the model and libraries for a day.

`previews/` and `VALIDATION.md` describe the earlier version and have not been regenerated.

## Package contents

- `site/`: complete runnable website, model, web images, logo and browser-readable audit.
- `photography/`: all original supplied images, every-file visual audit, image inventory, masks and contact sheet.
- `previews/`: desktop and mobile browser captures, including the updated logo.
- `VALIDATION.md`: checks performed and remaining limitations.
