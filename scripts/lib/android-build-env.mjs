import fs from "node:fs";
import path from "node:path";

const isWindows = process.platform === "win32";

export function resolveGradle() {
  return isWindows ? "gradlew.bat" : "./gradlew";
}

function toGradlePath(targetPath) {
  return targetPath.replace(/\\/g, "\\\\");
}

export function resolveAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    isWindows
      ? path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
      : path.join(process.env.HOME || "", "Android", "Sdk"),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function ensureLocalProperties(androidDir) {
  const localPropertiesPath = path.join(androidDir, "local.properties");
  const sdkDir = resolveAndroidSdk();
  if (!sdkDir) return false;

  const content = `sdk.dir=${toGradlePath(path.resolve(sdkDir))}\n`;
  const existing = fs.existsSync(localPropertiesPath) ? fs.readFileSync(localPropertiesPath, "utf8") : "";

  if (!existing.includes("sdk.dir=")) {
    fs.writeFileSync(localPropertiesPath, content, "utf8");
  }

  return true;
}

export function resolveJavaHome() {
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

export function createAndroidBuildEnv() {
  const env = { ...process.env };
  const javaHome = resolveJavaHome();

  if (javaHome) {
    env.JAVA_HOME = javaHome;
    const javaBin = path.join(javaHome, "bin");
    env.PATH = env.PATH ? `${javaBin}${path.delimiter}${env.PATH}` : javaBin;
  }

  return env;
}
