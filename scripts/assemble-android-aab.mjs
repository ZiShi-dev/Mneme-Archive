import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyAndroidArtifact,
  readBuildFlavorMeta,
} from "./lib/android-artifacts.mjs";
import { createAndroidBuildEnv, ensureLocalProperties, resolveGradle } from "./lib/android-build-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const gradle = resolveGradle();

if (!ensureLocalProperties(androidDir)) {
  console.error("\nSDK Android introuvable. Ouvre Android Studio une fois ou définis ANDROID_HOME.");
  process.exit(1);
}

if (!process.env.KEYSTORE_PATH) {
  console.error("\nSignature release requise. Définis KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS et KEY_PASSWORD.");
  process.exit(1);
}

const env = createAndroidBuildEnv();
const result = spawnSync(gradle, ["bundleRelease", "--no-daemon"], {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const aabPath = path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const gradleText = fs.readFileSync(path.join(androidDir, "app", "build.gradle"), "utf8");
const versionName = gradleText.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0.0";
const { flavor, artifactPrefix } = readBuildFlavorMeta(androidDir);
const artifactName = `${artifactPrefix}-${versionName}-release.aab`;

const outputPath = copyAndroidArtifact({
  sourcePath: aabPath,
  root,
  kind: "aab",
  flavor,
  fileName: artifactName,
});

console.log(`\nAAB prêt: ${aabPath}`);
console.log(`Copie locale: ${outputPath}`);
