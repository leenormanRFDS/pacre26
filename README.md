# RFDS Port Augusta Centre for Rural Health and Education

Photography-integrated architectural scrollytelling preview, based on the unchanged PACRE ivory GLB MESH.

## Preview locally

No installation or build is required. Serve the `site` folder over HTTP:

```sh
python3 -m http.server 8080 --directory site
```

Open `http://localhost:8080`. File URLs may prevent the model from loading. The Three.js dependencies, model, images and logo are packaged locally.

The map chapters need an internet connection: CesiumJS 1.120 loads from the jsDelivr CDN and the satellite imagery from Mapbox, using the public token in `site/map.js` (restrict it to your domain in your Mapbox account). Both load only once a reader reaches the Training chapter; if either fails, the original photographs show instead. The model's position on the map (`SITE` at the top of `map.js`) is set from the street address and recent aerial imagery; check the heading against the real building.

**Typeface.** Museo Sans loads from the RFDS Adobe Fonts web project (`https://use.typekit.net/woa6nwj.css`, weights 100 to 900). Adobe Fonts only serves a kit to the domains listed in that project, so every domain the site runs on (the Vercel URL, any custom domain) must be added under the project's Domains setting. Until a domain is listed, that site falls back to Avenir Next, then Arial. `localhost` works for local previews.

**FAQ.** The questions at the end of the page are a plain accordion in `site/index.html` (one `<details>` per question). Each question has its own link, e.g. `/#faq-when-open`, which opens that answer; `site/faq.js` handles this. The same questions and answers also sit in the `application/ld+json` block in the page head, which search engines and AI assistants read. When you edit a question or answer, change it in both places so they match.

`previews/` and `VALIDATION.md` describe the earlier version and have not been regenerated.

## Package contents

- `site/`: complete runnable website, model, web images, logo and browser-readable audit.
- `photography/`: all original supplied images, every-file visual audit, image inventory, masks and contact sheet.
- `previews/`: desktop and mobile browser captures, including the updated logo.
- `VALIDATION.md`: checks performed and remaining limitations.
