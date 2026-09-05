import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderMnemeMarkSvgForTheme } from "./render-mneme-mark-svg.mjs";
import { THEME_IDS, THEME_INK, THEME_META_COLOR } from "../src/lib/theme/appearance.js";

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

async function writeThemeIcons(themeId) {
  const background = THEME_META_COLOR[themeId] || THEME_META_COLOR[THEME_INK];
  const svg = renderMnemeMarkSvgForTheme(themeId, 512);
  const themeDir = path.join(pwaDir, "themes", themeId);
  await fs.mkdir(themeDir, { recursive: true });

  await writePng(svg, 32, path.join(themeDir, "favicon.png"), 0, background);
  await writePng(svg, 180, path.join(themeDir, "apple-touch-icon.png"), 0, background);
  await writePng(svg, 192, path.join(themeDir, "icon-192.png"), 0, background);
  await writePng(svg, 512, path.join(themeDir, "icon-512.png"), 0, background);
  await writePng(svg, 512, path.join(themeDir, "icon-maskable-512.png"), 64, background);
}

async function main() {
  await fs.mkdir(pwaDir, { recursive: true });

  for (const themeId of THEME_IDS) {
    await writeThemeIcons(themeId);
  }

  const defaultSvg = renderMnemeMarkSvgForTheme(THEME_INK, 512);
  await fs.writeFile(path.join(pwaDir, "icon.svg"), defaultSvg);
  await writePng(defaultSvg, 192, path.join(pwaDir, "icon-192.png"), 0, THEME_META_COLOR[THEME_INK]);
  await writePng(defaultSvg, 512, path.join(pwaDir, "icon-512.png"), 0, THEME_META_COLOR[THEME_INK]);
  await writePng(defaultSvg, 512, path.join(pwaDir, "icon-maskable-512.png"), 64, THEME_META_COLOR[THEME_INK]);
  await writePng(defaultSvg, 32, path.join(publicDir, "favicon.png"), 0, THEME_META_COLOR[THEME_INK]);
  await writePng(defaultSvg, 180, path.join(publicDir, "apple-touch-icon.png"), 0, THEME_META_COLOR[THEME_INK]);

  console.log(`PWA icons generated for ${THEME_IDS.length} themes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
