import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const localPropertiesPath = path.join(androidDir, "local.properties");
const isWindows = process.platform === "win32";
const gradle = isWindows ? "gradlew.bat" : "./gradlew";

function toGradlePath(targetPath) {
  return targetPath.replace(/\\/g, "\\\\");
}

function resolveAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    isWindows ? path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk") : path.join(process.env.HOME || "", "Android", "Sdk"),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function ensureLocalProperties() {
  const sdkDir = resolveAndroidSdk();
  if (!sdkDir) return false;

  const content = `sdk.dir=${toGradlePath(path.resolve(sdkDir))}\n`;
  const existing = fs.existsSync(localPropertiesPath) ? fs.readFileSync(localPropertiesPath, "utf8") : "";

  if (!existing.includes("sdk.dir=")) {
    fs.writeFileSync(localPropertiesPath, content, "utf8");
  }

  return true;
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const candidates = isWindows
    ? [
        "C:\\Program Files\\Android\\Android Studio\\jbr",
        path.join(process.env.LOCALAPPDATA || "", "Programs", "Android", "Android Studio", "jbr"),
      ]
    : [
        "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
        path.join(process.env.HOME || "", "android-studio", "jbr"),
      ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

const javaHome = resolveJavaHome();
const env = { ...process.env };

if (!ensureLocalProperties()) {
  console.error("\nSDK Android introuvable. Ouvre Android Studio une fois ou définis ANDROID_HOME.");
  process.exit(1);
}

if (javaHome) {
  env.JAVA_HOME = javaHome;
  const javaBin = path.join(javaHome, "bin");
  env.PATH = env.PATH ? `${javaBin}${path.delimiter}${env.PATH}` : javaBin;
}

const result = spawnSync(gradle, ["assembleDebug", "--no-daemon"], {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: isWindows,
});

if (result.status !== 0) {
  if (!javaHome) {
    console.error("\nJAVA_HOME introuvable. Installe Android Studio ou définis JAVA_HOME.");
  }
  process.exit(result.status ?? 1);
}

const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const rootApkPath = path.join(root, "app-debug.apk");
if (!fs.existsSync(apkPath)) {
  console.error(`APK introuvable: ${apkPath}`);
  process.exit(1);
}

fs.copyFileSync(apkPath, rootApkPath);
console.log(`\nAPK prêt: ${apkPath}`);
console.log(`Copie locale: ${rootApkPath}`);
