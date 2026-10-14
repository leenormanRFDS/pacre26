/* Builds the web model: site/assets/port-augusta-centre.glb
   from the source model:  tools/model/source/port-augusta-ivory.glb

   1. Removes the interior rooms and wayfinding (not shown on the site).
   2. Runs the site's own repair functions, copied from site/model.js: the roof
      slab pieces modelled inside Level 02 move back into the roof, and Level 02
      gets a floor plate.
   3. Welds and simplifies the geometry (error 0.0002: removes triangles that lie
      flat on the same surface; the rounded bands stay smooth), then quantises and
      compresses it with meshopt. The site decodes it with
      site/assets/vendor/meshopt_decoder.module.js; CesiumJS decodes it natively.

   Run:  cd tools/model && npm install && npm run build                      */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(here, 'source/port-augusta-ivory.glb');
const OUTPUT = path.join(here, '../../site/assets/port-augusta-centre.glb');
const MODEL_JS = path.join(here, '../../site/model.js');
const SIMPLIFY_ERROR = 0.0002;

// GLTFExporter needs FileReader, which Node does not have.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:${blob.type || 'application/octet-stream'};base64,` + Buffer.from(b).toString('base64'); this.onloadend?.(); this.onload?.({ target: this }); }); }
};

// 1-2. Interiors out, repairs in (the repair code is taken from site/model.js so the two never drift apart).
const code = fs.readFileSync(MODEL_JS, 'utf8');
const repairs = code.slice(code.indexOf('/* ---------- Repairs'), code.indexOf('/* ---------- Model'));
const { repairFloors } = new Function('THREE', repairs + '\nreturn { repairFloors };')(THREE);
const src = fs.readFileSync(SOURCE);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength), '', res, rej));
const drop = []; gltf.scene.traverse(m => { if (m.isMesh && /^(WAYFIND_|GROUND_|UPPER_)/.test(m.name)) drop.push(m); });
drop.forEach(m => m.parent.remove(m));
repairFloors(gltf.scene);
const baked = await new Promise((res, rej) => new GLTFExporter().parse(gltf.scene, res, rej, { binary: true }));

// 3. Weld, simplify, compress.
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(baked));
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUTPUT, doc);
let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}: ${Math.round(tris)} triangles, ${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB`);
