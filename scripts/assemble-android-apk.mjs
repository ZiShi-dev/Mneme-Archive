import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

const env = createAndroidBuildEnv();
const result = spawnSync(gradle, ["assembleDebug", "--no-daemon"], {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  if (!env.JAVA_HOME) {
    console.error("\nJAVA_HOME introuvable. Installe Android Studio ou définis JAVA_HOME.");
  }
  process.exit(result.status ?? 1);
}

const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const gradleText = fs.readFileSync(path.join(androidDir, "app", "build.gradle"), "utf8");
const versionName = gradleText.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0.0";
const { flavor, artifactPrefix } = readBuildFlavorMeta(androidDir);
const artifactName = `${artifactPrefix}-${versionName}-debug.apk`;

const outputPath = copyAndroidArtifact({
  sourcePath: apkPath,
  root,
  kind: "apk",
  flavor,
  fileName: artifactName,
});

console.log(`\nAPK prêt: ${apkPath}`);
console.log(`Copie locale: ${outputPath}`);
