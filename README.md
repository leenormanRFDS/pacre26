# RFDS Port Augusta Centre for Rural Health and Education

Photography-integrated architectural scrollytelling preview, based on the PACRE ivory GLB, optimised for the web (see Performance).

## Preview locally

No installation or build is required. Serve the `site` folder over HTTP:

```sh
python3 -m http.server 8080 --directory site
```

Open `http://localhost:8080`. File URLs may prevent the model from loading. The Three.js dependencies, model, images and logo are packaged locally.

- The 3D model the site loads (`site/assets/port-augusta-centre.glb`, about 230 KB over the network) is built from the source model in `tools/model/source/` by `tools/model/build-model.mjs`: interiors removed, the roof and Level 02 repairs baked in, flat areas simplified and the geometry compressed (meshopt). The original was about 1.9 MB over the network and was downloaded twice (once by the map). To rebuild after changing the source model or the repair code: `cd tools/model && npm install && npm run build`.
- The model starts loading after the first screen has painted (or as soon as the reader scrolls). Museo Sans loads without blocking the first paint.
- The map is a single still image (about 300 KB) that loads during Training; there is no map library.
- The story's scroll loop does nothing while the page is still and never reads layout mid-frame.
- `site/vercel.json` lets browsers cache images, the model and libraries for a day.

`previews/` and `VALIDATION.md` describe the earlier version and have not been regenerated.

## Package contents

- `site/`: complete runnable website, model, web images, logo and browser-readable audit.
- `photography/`: all original supplied images, every-file visual audit, image inventory, masks and contact sheet.
- `previews/`: desktop and mobile browser captures, including the updated logo.
- `VALIDATION.md`: checks performed and remaining limitations.
