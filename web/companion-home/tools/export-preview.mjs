import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [stateFile, characterFile, referenceFile, outputFile] =
  process.argv.slice(2);
if (!stateFile || !characterFile || !referenceFile || !outputFile) {
  throw new Error(
    "Usage: node tools/export-preview.mjs STATE_JSON CHARACTER_GLB REFERENCE_JPG OUTPUT_HTML",
  );
}
const assets = await readdir(path.join(root, "dist/assets"));
const js = await readFile(
  path.join(
    root,
    "dist/assets",
    assets.find((file) => file.endsWith(".js")),
  ),
  "utf8",
);
const css = await readFile(
  path.join(
    root,
    "dist/assets",
    assets.find((file) => file.endsWith(".css")),
  ),
  "utf8",
);
const state = JSON.parse(await readFile(stateFile, "utf8"));
state.preview = true;
const model = await readFile(characterFile);
const reference = await readFile(referenceFile);
const config = {
  offline: true,
  characterUrl: "data:model/gltf-binary;base64," + model.toString("base64"),
  referenceUrl: "data:image/jpeg;base64," + reference.toString("base64"),
};
function json(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace(
  "</head>",
  () =>
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; connect-src data: blob:; base-uri 'none'; form-action 'none'"><style>${css}</style></head>`,
);
html = html.replace(
  /<script type="module" src="\/src\/main.mjs"><\/script>/,
  () =>
    `<script type="application/json" id="home-config">${json(config)}</script><script type="application/json" id="initial-state">${json(state)}</script><script type="module">${js.replaceAll("</script", "<\\/script")}</script>`,
);
await writeFile(outputFile, html, "utf8");
console.log(
  JSON.stringify({
    output: outputFile,
    html_bytes: Buffer.byteLength(html),
    model_bytes: model.length,
  }),
);
