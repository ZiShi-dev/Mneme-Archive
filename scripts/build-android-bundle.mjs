import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");

const FLAVORS = {
  archive: {
    appName: "Mneme Archive",
    artifactPrefix: "Mneme-Archive",
  },
  chromebook: {
    appName: "CinéVault",
    artifactPrefix: "CineVault-Chromebook",
  },
};

const flavorArg = String(process.argv[2] || process.env.APP_FLAVOR || "archive").trim().toLowerCase();
const flavor = FLAVORS[flavorArg] ? flavorArg : "archive";
const config = FLAVORS[flavor];

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

function patchAndroidLabels() {
  const stringsPath = path.join(androidDir, "app", "src", "main", "res", "values", "strings.xml");
  const strings = fs.readFileSync(stringsPath, "utf8");
  const nextStrings = strings
    .replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${config.appName}</string>`)
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, `<string name="title_activity_main">${config.appName}</string>`);
  fs.writeFileSync(stringsPath, nextStrings, "utf8");

  const capacitorPath = path.join(root, "capacitor.config.json");
  const capacitor = JSON.parse(fs.readFileSync(capacitorPath, "utf8"));
  capacitor.appName = config.appName;
  fs.writeFileSync(capacitorPath, `${JSON.stringify(capacitor, null, 2)}\n`, "utf8");
}

function applyChromebookNativePatch() {
  if (flavor !== "chromebook") return;

  function stripPluginsFromGradle(filePath) {
    if (!fs.existsSync(filePath)) return;
    const original = fs.readFileSync(filePath, "utf8");
    const next = original.split("\n").filter((line) => !isRemovedPluginLine(line)).join("\n");
    if (next !== original) fs.writeFileSync(filePath, next, "utf8");
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
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

patchAndroidLabels();

const viteEnv = { ...process.env, VITE_APP_FLAVOR: flavor };
run("npx", ["vite", "build"], viteEnv);
run("npx", ["cap", "sync", "android"], viteEnv);
applyChromebookNativePatch();

fs.writeFileSync(
  path.join(androidDir, ".build-flavor"),
  `${flavor}\n${config.artifactPrefix}\n`,
  "utf8",
);

console.log(`\nBundle Android prêt (${flavor}) — ${config.appName}`);
