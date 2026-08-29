import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderMnemeMarkSvgForTheme } from "./render-mneme-mark-svg.mjs";
import { THEME_INK } from "../src/lib/theme/appearance.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resDir = path.join(root, "android", "app", "src", "main", "res");

const DENSITIES = [
  { folder: "mipmap-mdpi", launcher: 48, foreground: 108 },
  { folder: "mipmap-hdpi", launcher: 72, foreground: 162 },
  { folder: "mipmap-xhdpi", launcher: 96, foreground: 216 },
  { folder: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
  { folder: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
];

const BACKGROUND = { r: 9, g: 10, b: 18, alpha: 1 };

async function writePng(svg, size, target, padding = 0) {
  const inner = size - padding * 2;
  const buffer = await sharp(Buffer.from(svg))
    .resize(inner, inner, { fit: "contain", background: BACKGROUND })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: BACKGROUND,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(target, buffer);
}

async function main() {
  const svg = renderMnemeMarkSvgForTheme(THEME_INK, 512);

  for (const { folder, launcher, foreground } of DENSITIES) {
    const dir = path.join(resDir, folder);
    await fs.mkdir(dir, { recursive: true });

    const launcherPadding = Math.round(launcher * 0.08);
    await writePng(svg, launcher, path.join(dir, "ic_launcher.png"), launcherPadding);
    await writePng(svg, launcher, path.join(dir, "ic_launcher_round.png"), launcherPadding);

    const foregroundPadding = Math.round(foreground * 0.18);
    await writePng(svg, foreground, path.join(dir, "ic_launcher_foreground.png"), foregroundPadding);
  }

  console.log("Android launcher icons generated from themed Mneme mark SVG (ink)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
