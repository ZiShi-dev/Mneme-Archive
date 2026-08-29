import fs from "node:fs";
import path from "node:path";

export function readBuildFlavorMeta(androidDir) {
  const flavorMetaPath = path.join(androidDir, ".build-flavor");
  if (!fs.existsSync(flavorMetaPath)) {
    return { flavor: "archive", artifactPrefix: "Mneme-Archive" };
  }

  const [flavor = "archive", artifactPrefix = "Mneme-Archive"] = fs
    .readFileSync(flavorMetaPath, "utf8")
    .trim()
    .split("\n");

  return { flavor, artifactPrefix };
}

export function resolveAndroidArtifactDir(root, kind, flavor) {
  const folder = ["chromebook", "user", "archive"].includes(flavor) ? flavor : "archive";
  return path.join(root, kind, folder);
}

export function copyAndroidArtifact({ sourcePath, root, kind, flavor, fileName }) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Artifact introuvable: ${sourcePath}`);
  }

  const outputDir = resolveAndroidArtifactDir(root, kind, flavor);
  fs.mkdirSync(outputDir, { recursive: true });
  const destinationPath = path.join(outputDir, fileName);
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}
