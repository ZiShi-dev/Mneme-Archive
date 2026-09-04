import React, { useEffect, useState } from "react";

import { GalaxyAtmosphere } from "./GalaxyAtmosphere";
import { InkAtmosphere } from "./InkAtmosphere";
import { MoonSeaWater } from "./MoonSeaWater";
import { MoonSnowfall } from "./MoonSnowfall";
import { PaperAtmosphere } from "./PaperAtmosphere";
import { SakuraBranches } from "./SakuraBranches";
import { SakuraDay } from "./SakuraDay";
import { SakuraPetals } from "./SakuraPetals";
import { YozakuraNight } from "./YozakuraNight";
import {
  THEME_GALAXIE,
  THEME_INK,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  isGalaxyTheme,
  isSakuraTheme,
  isSnowTheme,
} from "../../lib/theme/appearance";

function useDeferredCanvas(enabled, delayMs = 160) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return undefined;
    }

    let active = true;
    const run = () => {
      if (active) setReady(true);
    };

    const handle = typeof requestIdleCallback === "function"
      ? requestIdleCallback(run, { timeout: 520 })
      : window.setTimeout(run, delayMs);

    return () => {
      active = false;
      if (typeof requestIdleCallback === "function") {
        cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [enabled, delayMs]);

  return ready;
}

function SakuraDecor({ appearance, variant }) {
  if (!isSakuraTheme(appearance) || appearance === THEME_YOZAKURA) return null;

  return (
    <>
      <SakuraBranches appearance={appearance} variant={variant} />
      <SakuraPetals appearance={appearance} variant={variant} />
    </>
  );
}

function DeferredCanvas({ enabled, children }) {
  const ready = useDeferredCanvas(enabled);
  if (!enabled || !ready) return null;
  return children;
}

function AtmosphereCanvases({ appearance, variant }) {
  const isYozakura = appearance === THEME_YOZAKURA;
  const isDaySakura = appearance === THEME_SAKURA;
  const isInk = appearance === THEME_INK;
  const isPaper = appearance === THEME_PAPER;
  const isGalaxy = isGalaxyTheme(appearance);
  const heavy = isYozakura || isDaySakura || isGalaxy || isInk || isPaper || isSnowTheme(appearance);

  return (
    <>
      <SakuraDecor appearance={appearance} variant={variant} />
      <DeferredCanvas enabled={heavy}>
        {isYozakura ? <YozakuraNight variant={variant} /> : null}
        {isDaySakura ? <SakuraDay variant={variant} /> : null}
        {isInk ? <InkAtmosphere variant={variant} /> : null}
        {isPaper ? <PaperAtmosphere variant={variant} /> : null}
        {isGalaxy ? <GalaxyAtmosphere variant={variant} /> : null}
        {isSnowTheme(appearance) ? <MoonSeaWater variant={variant} /> : null}
        {isSnowTheme(appearance) ? <MoonSnowfall variant={variant} /> : null}
      </DeferredCanvas>
    </>
  );
}

export function ShellStageAtmosphere({ appearance, enabled }) {
  if (!enabled) return null;
  return <AtmosphereCanvases appearance={appearance} variant="stage" />;
}

export function FrameAtmosphere({ appearance, enabled }) {
  if (!enabled) return null;
  return <AtmosphereCanvases appearance={appearance} variant="frame" />;
}
