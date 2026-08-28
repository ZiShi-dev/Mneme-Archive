import { isSakuraTheme } from "../theme/appearance";

export function burstSakuraFrom(target) {
  if (!target || typeof document === "undefined") return;
  if (!isSakuraTheme(document.body?.dataset?.theme)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const host = document.querySelector(".phone-frame") || document.body;
  const origin = target.getBoundingClientRect();
  const frame = host.getBoundingClientRect();
  const layer = document.createElement("span");
  layer.className = "sakura-burst";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${origin.left + origin.width / 2 - frame.left}px`;
  layer.style.top = `${origin.top + origin.height / 2 - frame.top}px`;
  layer.innerHTML = "<i></i><i></i><i></i>";
  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 720);
}
