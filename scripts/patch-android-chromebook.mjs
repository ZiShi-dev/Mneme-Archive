import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const flavorArg = process.argv[2];
const flavor = String(flavorArg || process.env.APP_FLAVOR || "archive").trim().toLowerCase();
if (flavor !== "chromebook") {
  console.log(`Android Chromebook patch skipped (APP_FLAVOR=${flavor}).`);
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");

const REMOVED_PLUGIN_MARKERS = [
  "@capacitor-community/sqlite",
  "capacitor-community-sqlite",
  "@capgo/capacitor-background-task",
  "capgo-capacitor-background-task",
];

function isRemovedPluginLine(line = "") {
  return REMOVED_PLUGIN_MARKERS.some((marker) => line.includes(marker));
}

function isRemovedPluginEntry(plugin = {}) {
  const pkg = plugin.pkg ?? "";
  return REMOVED_PLUGIN_MARKERS.some((marker) => pkg.includes(marker));
}

function stripPluginsFromGradle(filePath) {
  if (!fs.existsSync(filePath)) return;
  const original = fs.readFileSync(filePath, "utf8");
  const next = original
    .split("\n")
    .filter((line) => !isRemovedPluginLine(line))
    .join("\n");
  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function stripPluginsFromRegistry(filePath) {
  if (!fs.existsSync(filePath)) return;
  const plugins = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const filtered = plugins.filter((plugin) => !isRemovedPluginEntry(plugin));
  fs.writeFileSync(filePath, `${JSON.stringify(filtered, null, "\t")}\n`, "utf8");
}

stripPluginsFromGradle(path.join(androidDir, "capacitor.settings.gradle"));
stripPluginsFromGradle(path.join(androidDir, "app", "capacitor.build.gradle"));
stripPluginsFromRegistry(path.join(androidDir, "app", "src", "main", "assets", "capacitor.plugins.json"));

console.log("Android Chromebook patch applied (SQLite + background task removed).");
