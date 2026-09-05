import React, { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** Superposition type Gerstner pour un relief plus naturel. */
function heightField(x, time, scale = 1) {
  const t = time;
  return (
    Math.sin(x * 0.0085 * scale + t * 0.72) * 1.0
    + Math.sin(x * 0.015 * scale + t * 1.15 + 1.2) * 0.55
    + Math.sin(x * 0.027 * scale - t * 0.9 + 2.4) * 0.32
    + Math.sin(x * 0.0042 * scale + t * 0.38 + 0.6) * 0.7
    + Math.sin(x * 0.041 * scale + t * 1.8 + 3.1) * 0.14
  );
}

function slopeField(x, time, scale = 1) {
  const t = time;
  return (
    Math.cos(x * 0.0085 * scale + t * 0.72) * 0.0085 * scale
    + Math.cos(x * 0.015 * scale + t * 1.15 + 1.2) * 0.015 * scale * 0.55
    + Math.cos(x * 0.027 * scale - t * 0.9 + 2.4) * 0.027 * scale * 0.32
    + Math.cos(x * 0.0042 * scale + t * 0.38 + 0.6) * 0.0042 * scale * 0.7
    + Math.cos(x * 0.041 * scale + t * 1.8 + 3.1) * 0.041 * scale * 0.14
  );
}

function drawStars(ctx, width, height, horizon, time) {
  const count = 48;
  for (let i = 0; i < count; i += 1) {
    const seed = i * 97.13;
    const x = (Math.sin(seed) * 0.5 + 0.5) * width;
    const y = (Math.cos(seed * 1.7) * 0.5 + 0.5) * horizon * 0.92;
    const twinkle = 0.35 + (Math.sin(time * 1.6 + seed) * 0.5 + 0.5) * 0.55;
    const r = 0.4 + (i % 5) * 0.22;
    ctx.fillStyle = `rgba(230, 240, 255, ${twinkle * 0.75})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMoon(ctx, moonX, moonY, moonR) {
  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, moonR * 5.5);
  glow.addColorStop(0, "rgba(245, 248, 255, 0.55)");
  glow.addColorStop(0.22, "rgba(190, 215, 245, 0.22)");
  glow.addColorStop(0.55, "rgba(120, 160, 210, 0.08)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 5.5, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    moonX - moonR * 0.32,
    moonY - moonR * 0.28,
    moonR * 0.08,
    moonX,
    moonY,
    moonR,
  );
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.35, "#f0f4ff");
  body.addColorStop(0.7, "#d4e0f2");
  body.addColorStop(1, "#a8bcd8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(150, 165, 190, 0.18)";
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.22, moonY - moonR * 0.12, moonR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX - moonR * 0.18, moonY + moonR * 0.25, moonR * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.05, moonY + moonR * 0.08, moonR * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoonPath(ctx, moonX, moonY, moonR, horizon, height, time) {
  const top = horizon + 4;
  const bottom = height - 4;
  const bands = 56;

  ctx.save();
  for (let i = 0; i < bands; i += 1) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const y0 = top + (bottom - top) * t0;
    const y1 = top + (bottom - top) * t1;
    const mid = (y0 + y1) * 0.5;
    const depth = t0;
    const sway = Math.sin(time * 1.35 + mid * 0.055) * (4 + depth * 28)
      + Math.sin(time * 0.7 + mid * 0.12) * (2 + depth * 10);
    const half = moonR * (0.22 + depth * 1.85) * (1 + Math.sin(time * 2.1 + mid * 0.08) * 0.08);
    const alpha = (0.42 - depth * 0.34) * (0.75 + Math.sin(time * 1.5 + i * 0.3) * 0.15);
    if (alpha <= 0.02) continue;

    ctx.fillStyle = `rgba(230, 240, 255, ${alpha})`;
    ctx.fillRect(moonX + sway - half, y0, half * 2, Math.max(1.2, y1 - y0 + 0.5));
  }

  // Cœur plus dense du reflet
  for (let i = 0; i < bands; i += 2) {
    const t0 = i / bands;
    const y0 = top + (bottom - top) * t0;
    const y1 = top + (bottom - top) * Math.min(1, (i + 2) / bands);
    const mid = (y0 + y1) * 0.5;
    const depth = t0;
    const sway = Math.sin(time * 1.35 + mid * 0.055) * (4 + depth * 28);
    const half = moonR * (0.08 + depth * 0.55);
    const alpha = (0.28 - depth * 0.22) * (0.8 + Math.sin(time * 2 + i) * 0.2);
    if (alpha <= 0.02) continue;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(moonX + sway - half, y0, half * 2, Math.max(1, y1 - y0));
  }
  ctx.restore();
}

function drawSea(ctx, width, height, time, variant) {
  const horizon = height * 0.28;
  const moonX = width * 0.78;
  const moonY = height * 0.11;
  const moonR = Math.min(width, height) * (variant === "stage" ? 0.052 : 0.064);
  const step = width > 900 ? 3 : 2;

  // Ciel nocturne
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#050a14");
  sky.addColorStop(0.35, "#0a1528");
  sky.addColorStop(0.72, "#123048");
  sky.addColorStop(1, "#1a3a5e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 2);

  drawStars(ctx, width, horizon, horizon, time);
  drawMoon(ctx, moonX, moonY, moonR);

  // Brume d'horizon
  const mist = ctx.createLinearGradient(0, horizon - height * 0.08, 0, horizon + height * 0.06);
  mist.addColorStop(0, "transparent");
  mist.addColorStop(0.45, "rgba(140, 175, 215, 0.14)");
  mist.addColorStop(1, "transparent");
  ctx.fillStyle = mist;
  ctx.fillRect(0, horizon - height * 0.08, width, height * 0.14);

  // Fond océan (profondeur)
  const ocean = ctx.createLinearGradient(0, horizon, 0, height);
  ocean.addColorStop(0, "#245a82");
  ocean.addColorStop(0.18, "#1a4568");
  ocean.addColorStop(0.42, "#123550");
  ocean.addColorStop(0.7, "#0a2238");
  ocean.addColorStop(1, "#040c16");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Teinte sous-surface près de la lune
  const lit = ctx.createRadialGradient(moonX, horizon, 10, moonX, horizon + height * 0.35, width * 0.55);
  lit.addColorStop(0, "rgba(120, 175, 220, 0.22)");
  lit.addColorStop(0.45, "rgba(60, 110, 160, 0.1)");
  lit.addColorStop(1, "transparent");
  ctx.fillStyle = lit;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Bandes de vagues en perspective
  const rows = variant === "stage" ? 28 : 22;
  for (let row = 0; row < rows; row += 1) {
    const depth = row / (rows - 1);
    // Perspective : loin = haut, près = bas
    const baseY = horizon + (height - horizon) * (0.02 + depth * 0.96);
    const amp = (2.2 + depth * depth * 18) * (variant === "stage" ? 1.15 : 1);
    const scale = 0.55 + depth * 1.35;
    const alphaFill = 0.04 + depth * 0.1;
    const crestAlpha = 0.08 + depth * 0.28;

    ctx.beginPath();
    ctx.moveTo(0, height);
    let firstY = baseY + heightField(0, time + row * 0.15, scale) * amp;
    ctx.lineTo(0, firstY);
    for (let x = step; x <= width; x += step) {
      const y = baseY + heightField(x, time + row * 0.15, scale) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `rgba(8, 30, 55, ${alphaFill})`;
    ctx.fill();

    // Crêtes / écume
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const y = baseY + heightField(x, time + row * 0.15, scale) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const slopeBoost = 0.55 + depth * 0.45;
    ctx.strokeStyle = `rgba(200, 225, 250, ${crestAlpha * slopeBoost})`;
    ctx.lineWidth = 0.8 + depth * 1.4;
    ctx.stroke();

    // Specular sur les pentes face à la lune
    if (row % 2 === 0 && depth > 0.15) {
      ctx.beginPath();
      let drawing = false;
      for (let x = 0; x <= width; x += step * 2) {
        const slope = slopeField(x, time + row * 0.15, scale);
        const facingMoon = Math.max(0, -slope * (x < moonX ? 1 : -0.35) + 0.002);
        const y = baseY + heightField(x, time + row * 0.15, scale) * amp;
        if (facingMoon > 0.0018) {
          if (!drawing) {
            ctx.moveTo(x, y);
            drawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else if (drawing) {
          drawing = false;
        }
      }
      ctx.strokeStyle = `rgba(235, 245, 255, ${0.06 + depth * 0.18})`;
      ctx.lineWidth = 1 + depth;
      ctx.stroke();
    }
  }

  // Ligne d'horizon scintillante
  ctx.beginPath();
  for (let x = 0; x <= width; x += step) {
    const y = horizon + heightField(x, time * 1.1, 0.7) * 1.8;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(180, 210, 240, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 3;
  ctx.stroke();

  drawMoonPath(ctx, moonX, moonY + moonR, moonR, horizon, height, time);

  // Reflets / glints sur l'eau
  const glints = variant === "stage" ? 70 : 52;
  for (let i = 0; i < glints; i += 1) {
    const seed = i * 19.7;
    const x = ((Math.sin(seed * 1.1) * 0.5 + 0.5) * width + Math.sin(time * 0.55 + seed) * 18) % width;
    const depth = Math.cos(seed * 0.9) * 0.5 + 0.5;
    const y = horizon + 8 + depth * (height - horizon - 16);
    const pulse = Math.sin(time * 2.4 + seed) * 0.5 + 0.5;
    if (pulse < 0.35) continue;
    const nearMoon = 1 - Math.min(1, Math.abs(x - moonX) / (width * 0.45));
    const alpha = pulse * (0.15 + nearMoon * 0.45) * (0.4 + depth * 0.6);
    const w = 1.2 + depth * 4 + nearMoon * 3;
    const h = 0.6 + depth * 1.2;
    ctx.fillStyle = `rgba(230, 242, 255, ${alpha})`;
    ctx.fillRect(x - w * 0.5, y, w, h);
  }

  // Caustiques douces (réseau de lumière sous la surface)
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 7; i += 1) {
    const y = horizon + height * (0.12 + i * 0.1);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 6) {
      const yy = y
        + Math.sin(x * 0.012 + time * 0.8 + i) * 10
        + Math.sin(x * 0.03 - time * 1.1 + i * 1.3) * 5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = i % 2 === 0 ? "rgba(160, 210, 255, 1)" : "rgba(100, 160, 210, 1)";
    ctx.lineWidth = 8 - i * 0.6;
    ctx.stroke();
  }
  ctx.restore();

  // Vignette douce pour ancrer la scène
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.35,
    height * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(2, 6, 12, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function MoonSeaWater({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return undefined;

    let raf = 0;
    let running = true;
    let reduced = prefersReducedMotion();
    const start = performance.now();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      let width = Math.max(1, Math.floor(rect.width));
      let height = Math.max(1, Math.floor(rect.height));
      if (width < 8 || height < 8) {
        const parent = wrap.parentElement;
        width = Math.max(1, parent?.clientWidth || window.innerWidth);
        height = Math.max(1, parent?.clientHeight || window.innerHeight);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    let size = resize();

    const paint = (now) => {
      if (!running) return;
      const time = reduced ? 0 : (now - start) / 1000;
      drawSea(ctx, size.width, size.height, time, variant);
      if (!reduced) raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      size = resize();
      if (reduced) paint(performance.now());
    };

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = prefersReducedMotion();
      cancelAnimationFrame(raf);
      if (reduced) paint(performance.now());
      else raf = requestAnimationFrame(paint);
    };

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(onResize)
      : null;
    observer?.observe(wrap);
    if (wrap.parentElement) observer?.observe(wrap.parentElement);

    window.addEventListener("resize", onResize);
    media?.addEventListener?.("change", onMotion);
    raf = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      media?.removeEventListener?.("change", onMotion);
    };
  }, [variant]);

  return (
    <div ref={wrapRef} className={`moon-sea-water moon-sea-water--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="moon-sea-water__canvas" />
    </div>
  );
}
