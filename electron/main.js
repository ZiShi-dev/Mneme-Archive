import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startProductionServer, stopProductionServer } from "../server/productionServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const SERVER_PORT = Number(process.env.PORT) || 4173;
const SERVER_HOST = "127.0.0.1";
const SERVER_PORT_FALLBACKS = [SERVER_PORT, 4174, 4175, 4176, 4177, 4178];

/** @type {import("node:http").Server | null} */
let httpServer = null;
/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;
/** @type {import("electron").Tray | null} */
let tray = null;
let isQuitting = false;
let appUrl = "";

function resolveAppRoot() {
  return isDev
    ? path.resolve(__dirname, "..")
    : app.getAppPath();
}

function resolveDistRoot() {
  return path.join(resolveAppRoot(), "dist");
}

function resolveTrayIcon() {
  const iconPath = path.join(resolveAppRoot(), "public", "pwa", "icon-512.png");
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return image;
  return image.resize({ width: 16, height: 16 });
}

async function startEmbeddedServer() {
  let lastError = null;
  for (const port of SERVER_PORT_FALLBACKS) {
    try {
      const started = await startProductionServer({
        root: resolveDistRoot(),
        port,
        host: SERVER_HOST,
      });
      httpServer = started.server;
      return started.url;
    } catch (error) {
      if (error?.code === "EADDRINUSE") {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("Impossible de démarrer le serveur local CinéVault.");
}

function showStartupError(error) {
  const detail = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox(
    "CineVault — erreur de démarrage",
    `L'application n'a pas pu démarrer.\n\n${detail}\n\nSi le problème persiste, fermez les autres instances ou redémarrez le PC.`,
  );
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = resolveTrayIcon();
  if (icon.isEmpty()) return;

  tray = new Tray(icon);
  tray.setToolTip("CineVault");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir CinéVault", click: showMainWindow },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on("double-click", showMainWindow);
}

function createMainWindow(url) {
  appUrl = url;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: "CineVault",
    backgroundColor: "#090A12",
    icon: path.join(resolveAppRoot(), "public", "pwa", "icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const currentOrigin = new URL(url).origin;
    if (!targetUrl.startsWith(currentOrigin)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(url);
}

async function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      showMainWindow();
      return;
    }
    if (appUrl) {
      void createMainWindow(appUrl);
    }
  });

  await app.whenReady();
  app.setName("CineVault");

  const url = await startEmbeddedServer();
  createTray();
  await createMainWindow(url);

  ipcMain.on("cinevault:focus", showMainWindow);

  app.on("activate", async () => {
    if (mainWindow) {
      showMainWindow();
      return;
    }
    await createMainWindow(appUrl || url);
  });
}

app.on("window-all-closed", () => {
  // Laisse l'app active dans la barre des tâches pour les notifications.
});

app.on("before-quit", (event) => {
  isQuitting = true;
  if (!httpServer) return;
  event.preventDefault();
  const server = httpServer;
  httpServer = null;
  stopProductionServer(server)
    .then(() => {
      tray?.destroy();
      tray = null;
      app.exit(0);
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
});

bootstrap().catch((error) => {
  console.error(error);
  showStartupError(error);
  app.exit(1);
});
