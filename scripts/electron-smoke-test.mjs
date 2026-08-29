import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronBin = path.join(
  root,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);
const port = Number(process.env.PORT) || 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const timeoutMs = 90_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, { attempts = 60, delayMs = 1000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(delayMs);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

async function main() {
  const checks = [];
  const child = spawn(electronBin, ["."], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  const timer = setTimeout(() => {
    killProcessTree(child);
  }, timeoutMs);

  try {
    const indexResponse = await waitForHttp(`${baseUrl}/`);
    const indexHtml = await indexResponse.text();
    checks.push(["index.html", indexHtml.includes("<html")]);

    const apiResponse = await waitForHttp(`${baseUrl}/api/sources/frenchstream/catalog?page=1`);
    const apiJson = await apiResponse.json();
    checks.push(["frenchstream catalog API", Array.isArray(apiJson.items)]);

    const manifestResponse = await waitForHttp(`${baseUrl}/manifest.webmanifest`);
    checks.push(["manifest.webmanifest", manifestResponse.headers.get("content-type")?.includes("json")]);

    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error("Electron smoke test failed:");
      for (const [name] of failed) console.error(` - ${name}`);
      console.error(output.slice(-4000));
      process.exitCode = 1;
      return;
    }

    console.log("Electron smoke test passed:");
    for (const [name] of checks) console.log(` ✓ ${name}`);
  } catch (error) {
    console.error("Electron smoke test error:", error);
    console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    killProcessTree(child);
    await sleep(1500);
  }
}

main();
