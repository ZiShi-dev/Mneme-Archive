import { t } from "../../i18n/runtime.js";
import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../../config/appFlavor.js";

const WIFI_TYPES = new Set(["wifi", "ethernet", "wimax"]);
const CELLULAR_TYPES = new Set(["cellular", "bluetooth", "none"]);

let cachedNetwork = {
  wifiLike: isChromebookApp || !Capacitor.isNativePlatform(),
  label: Capacitor.isNativePlatform() && !isChromebookApp ? t("network.unknown") : t("network.ethernet"),
  connectionType: "unknown",
  connected: true,
};

let networkListener = null;

export function mapConnectionType(connectionType, connected = true, saveData = false) {
  const type = String(connectionType || "").toLowerCase();

  if (!connected) {
    return { wifiLike: false, label: t("network.offline"), connectionType: type || "none" };
  }
  if (saveData) {
    return { wifiLike: false, label: t("network.saver"), connectionType: type || "cellular" };
  }
  if (WIFI_TYPES.has(type)) {
    return { wifiLike: true, label: type === "ethernet" ? "Ethernet" : "Wi-Fi", connectionType: type };
  }
  if (CELLULAR_TYPES.has(type)) {
    return { wifiLike: false, label: t("network.cellular"), connectionType: type };
  }
  if (Capacitor.isNativePlatform()) {
    if (isChromebookApp) {
      return { wifiLike: true, label: t("network.ethernet"), connectionType: type || "unknown" };
    }
    return { wifiLike: false, label: t("network.unknown"), connectionType: type || "unknown" };
  }
  return { wifiLike: true, label: t("network.ethernet"), connectionType: type || "unknown" };
}

function mapNavigatorConnection() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return mapConnectionType("unknown", true, false);
  }
  return mapConnectionType(connection.type, true, Boolean(connection.saveData));
}

export async function refreshNetworkStatus() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      cachedNetwork = {
        ...mapConnectionType(status.connectionType, status.connected),
        connected: status.connected,
      };
      return cachedNetwork;
    } catch {
      cachedNetwork = mapConnectionType("unknown", false);
      return cachedNetwork;
    }
  }

  cachedNetwork = { ...mapNavigatorConnection(), connected: navigator.onLine !== false };
  return cachedNetwork;
}

export function getNetworkStatus() {
  return cachedNetwork;
}

export function isWifiLikeConnection() {
  return cachedNetwork.wifiLike;
}

export async function initNetworkStatus() {
  await refreshNetworkStatus();

  if (networkListener) return;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      networkListener = await Network.addListener("networkStatusChange", () => {
        void refreshNetworkStatus();
      });
      return;
    } catch {
      return;
    }
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const handleChange = () => { void refreshNetworkStatus(); };
  connection?.addEventListener?.("change", handleChange);
  window.addEventListener("online", handleChange);
  window.addEventListener("offline", handleChange);
  networkListener = {
    remove: () => {
      connection?.removeEventListener?.("change", handleChange);
      window.removeEventListener("online", handleChange);
      window.removeEventListener("offline", handleChange);
    },
  };
}

export function getPreloadNetworkStatus() {
  const { wifiLike, label, connectionType } = cachedNetwork;
  return { wifiLike, label, type: connectionType };
}
