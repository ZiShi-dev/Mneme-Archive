import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "pwa", "icon.svg");
const publicDir = path.join(root, "public");
const pwaDir = path.join(publicDir, "pwa");

async function writePng(svg, size, target, padding = 0) {
  const inner = size - padding * 2;
  const buffer = await sharp(svg)
    .resize(inner, inner, { fit: "contain", background: { r: 9, g: 10, b: 18, alpha: 1 } })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 9, g: 10, b: 18, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(target, buffer);
}

async function main() {
  const svg = await fs.readFile(svgPath);
  await fs.mkdir(pwaDir, { recursive: true });

  await writePng(svg, 192, path.join(pwaDir, "icon-192.png"));
  await writePng(svg, 512, path.join(pwaDir, "icon-512.png"));
  await writePng(svg, 512, path.join(pwaDir, "icon-maskable-512.png"), 64);

  await writePng(svg, 32, path.join(publicDir, "favicon.png"));
  await writePng(svg, 180, path.join(publicDir, "apple-touch-icon.png"));

  console.log("PWA icons generated in public/pwa/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
