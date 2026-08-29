import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderMnemeMarkSvgForTheme } from "./render-mneme-mark-svg.mjs";
import { THEME_INK } from "../src/lib/theme/appearance.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const pwaDir = path.join(publicDir, "pwa");

function parseBackground(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
    alpha: 1,
  };
}

async function writePng(svg, size, target, padding = 0, backgroundHex = "#090A12") {
  const inner = size - padding * 2;
  const background = parseBackground(backgroundHex);
  const buffer = await sharp(Buffer.from(svg))
    .resize(inner, inner, { fit: "contain", background })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(target, buffer);
}

async function main() {
  const svg512 = renderMnemeMarkSvgForTheme(THEME_INK, 512);
  const svg = renderMnemeMarkSvgForTheme(THEME_INK, 512);

  await fs.mkdir(pwaDir, { recursive: true });
  await fs.writeFile(path.join(pwaDir, "icon.svg"), svg512);

  await writePng(svg, 192, path.join(pwaDir, "icon-192.png"), 0, "#090A12");
  await writePng(svg, 512, path.join(pwaDir, "icon-512.png"), 0, "#090A12");
  await writePng(svg, 512, path.join(pwaDir, "icon-maskable-512.png"), 64, "#090A12");

  await writePng(svg, 32, path.join(publicDir, "favicon.png"), 0, "#090A12");
  await writePng(svg, 180, path.join(publicDir, "apple-touch-icon.png"), 0, "#090A12");

  console.log("PWA icons generated from themed Mneme mark SVG (ink)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
