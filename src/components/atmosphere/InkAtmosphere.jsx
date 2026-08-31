import React, { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function createMotes(count, width, height) {
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 8.2) * width,
    y: hash(i * 6.4 + 1) * height,
    r: 0.5 + hash(i * 3.3) * 2.6,
    speed: 0.06 + hash(i * 2.1) * 0.26,
    drift: (hash(i * 4.7) - 0.5) * 0.28,
    phase: hash(i * 7.9) * Math.PI * 2,
    alpha: 0.1 + hash(i * 1.5) * 0.4,
    hue: hash(i * 9.1) > 0.65 ? "violet" : hash(i * 5.2) > 0.5 ? "blue" : "white",
  }));
}

function paintBlob(ctx, cx, cy, rx, ry, rot, stops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, Math.max(0.2, ry / Math.max(rx, 1)));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNightBase(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, width * 0.1, height);
  bg.addColorStop(0, "#05060e");
  bg.addColorStop(0.3, "#0a0c18");
  bg.addColorStop(0.6, "#0f1222");
  bg.addColorStop(0.85, "#0c0e1a");
  bg.addColorStop(1, "#070812");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
}

function drawInkWashes(ctx, width, height) {
  // Deep sumi pools
  const washes = [
    { x: 0.2, y: 0.24, rx: 0.48, ry: 0.32, rot: -0.35, stops: [["0", "rgba(45, 60, 140, 0.28)"], ["0.45", "rgba(25, 35, 90, 0.12)"], ["1", "transparent"]] },
    { x: 0.76, y: 0.2, rx: 0.4, ry: 0.28, rot: 0.5, stops: [["0", "rgba(100, 70, 180, 0.22)"], ["0.5", "rgba(50, 40, 110, 0.1)"], ["1", "transparent"]] },
    { x: 0.52, y: 0.68, rx: 0.55, ry: 0.36, rot: 0.15, stops: [["0", "rgba(30, 45, 110, 0.26)"], ["0.4", "rgba(20, 28, 70, 0.12)"], ["1", "transparent"]] },
    { x: 0.14, y: 0.78, rx: 0.34, ry: 0.24, rot: -0.7, stops: [["0", "rgba(80, 55, 150, 0.18)"], ["1", "transparent"]] },
    { x: 0.88, y: 0.72, rx: 0.3, ry: 0.26, rot: 0.9, stops: [["0", "rgba(55, 80, 170, 0.16)"], ["1", "transparent"]] },
  ];

  for (const w of washes) {
    paintBlob(
      ctx,
      width * w.x,
      height * w.y,
      width * w.rx,
      height * w.ry,
      w.rot,
      w.stops.map(([t, c]) => [Number(t), c]),
    );
  }

  // Darker ink bleeds (sumi concentration)
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 8; i += 1) {
    const cx = width * (0.1 + hash(i * 3.2) * 0.8);
    const cy = height * (0.15 + hash(i * 5.1) * 0.7);
    const r = width * (0.04 + hash(i * 2.4) * 0.1);
    paintBlob(ctx, cx, cy, r, r * (0.5 + hash(i) * 0.6), hash(i * 7) * Math.PI, [
      [0, `rgba(8, 10, 22, ${0.18 + hash(i * 1.3) * 0.2})`],
      [0.55, `rgba(12, 14, 28, ${0.06 + hash(i) * 0.08})`],
      [1, "transparent"],
    ]);
  }
  ctx.restore();
}

function drawBrushStrokes(ctx, width, height) {
  // Soft calligraphic arcs — night ink night atmosphere
  const strokes = [
    { points: [[0.02, 0.12], [0.18, 0.08], [0.32, 0.18], [0.4, 0.35]], w: 3.5 },
    { points: [[0.98, 0.15], [0.82, 0.1], [0.68, 0.22], [0.58, 0.4]], w: 3.2 },
    { points: [[0.05, 0.88], [0.2, 0.82], [0.35, 0.9], [0.48, 0.78]], w: 2.8 },
    { points: [[0.95, 0.9], [0.8, 0.84], [0.66, 0.92], [0.55, 0.8]], w: 2.6 },
  ];

  for (const s of strokes) {
    const pts = s.points.map(([nx, ny]) => [width * nx, height * ny]);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Soft bleed under stroke
    ctx.strokeStyle = "rgba(20, 25, 50, 0.35)";
    ctx.lineWidth = s.w * 2.2;
    ctx.filter = "blur(2px)";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) * 0.5, (y + ny) * 0.5);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
    ctx.filter = "none";

    ctx.strokeStyle = "rgba(55, 65, 110, 0.45)";
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) * 0.5, (y + ny) * 0.5);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();

    // Thin highlight edge
    ctx.strokeStyle = "rgba(140, 155, 220, 0.12)";
    ctx.lineWidth = Math.max(0.6, s.w * 0.28);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPaperGrain(ctx, width, height) {
  for (let i = 0; i < 280; i += 1) {
    const x = hash(i * 11.3) * width;
    const y = hash(i * 7.7 + 3) * height;
    const a = 0.015 + hash(i * 2.2) * 0.04;
    ctx.fillStyle = hash(i * 4) > 0.6
      ? `rgba(160, 175, 230, ${a})`
      : `rgba(40, 45, 70, ${a})`;
    ctx.fillRect(x, y, 0.7 + hash(i) * 1.3, 0.7 + hash(i * 1.5) * 1.1);
  }

  // Fine fiber scratches
  ctx.save();
  for (let i = 0; i < 50; i += 1) {
    const x = hash(i * 1.9) * width;
    const y = hash(i * 3.4 + 1) * height;
    const len = 6 + hash(i * 2.2) * 18;
    const ang = hash(i * 5.5) * Math.PI * 2;
    ctx.strokeStyle = `rgba(130, 145, 200, ${0.015 + hash(i) * 0.03})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIndigoMoon(ctx, width, height) {
  const gx = width * 0.74;
  const gy = height * 0.14;
  const r = Math.min(width, height) * 0.045;

  const aura = ctx.createRadialGradient(gx, gy, r * 0.2, gx, gy, r * 7);
  aura.addColorStop(0, "rgba(170, 185, 255, 0.28)");
  aura.addColorStop(0.3, "rgba(110, 120, 220, 0.12)");
  aura.addColorStop(0.6, "rgba(70, 50, 160, 0.06)");
  aura.addColorStop(1, "transparent");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(gx, gy, r * 7, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.25, 0, gx, gy, r);
  body.addColorStop(0, "#e8ecff");
  body.addColorStop(0.45, "#b0bae8");
  body.addColorStop(0.8, "#6a78c0");
  body.addColorStop(1, "#3a4480");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(gx, gy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawBreathingWash(ctx, width, height, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + Math.sin(time * 0.25) * 0.08;
  paintBlob(
    ctx,
    width * (0.22 + Math.sin(time * 0.08) * 0.015),
    height * 0.26,
    width * 0.2,
    height * 0.14,
    -0.3,
    [[0, "rgba(90, 110, 220, 0.2)"], [1, "transparent"]],
  );
  paintBlob(
    ctx,
    width * (0.74 + Math.cos(time * 0.07) * 0.012),
    height * 0.22,
    width * 0.16,
    height * 0.12,
    0.4,
    [[0, "rgba(140, 100, 220, 0.16)"], [1, "transparent"]],
  );
  ctx.restore();
}

function moteColor(hue, alpha) {
  if (hue === "violet") return `rgba(190, 160, 255, ${alpha})`;
  if (hue === "blue") return `rgba(140, 175, 255, ${alpha})`;
  return `rgba(210, 220, 255, ${alpha})`;
}

function drawMotes(ctx, width, height, time, motes) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const m of motes) {
    m.y -= m.speed;
    m.x += m.drift + Math.sin(time * 0.55 + m.phase) * 0.22;
    if (m.y < -12) { m.y = height + 12; m.x = Math.random() * width; }
    if (m.x < -12) m.x = width + 6;
    if (m.x > width + 12) m.x = -6;

    const twinkle = 0.65 + Math.sin(time * 1.6 + m.phase) * 0.35;
    const alpha = m.alpha * twinkle;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.5);
    g.addColorStop(0, moteColor(m.hue, alpha));
    g.addColorStop(0.4, moteColor(m.hue, alpha * 0.35));
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = moteColor(m.hue, Math.min(1, alpha * 1.2));
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.4,
    height * 0.15,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.65, "rgba(2, 3, 10, 0.2)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function buildStaticLayer(width, height) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawNightBase(ctx, width, height);
  drawInkWashes(ctx, width, height);
  drawBrushStrokes(ctx, width, height);
  drawPaperGrain(ctx, width, height);
  drawIndigoMoon(ctx, width, height);
  return canvas;
}

function drawScene(ctx, width, height, time, motes, staticLayer) {
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, width, height);
  } else {
    drawNightBase(ctx, width, height);
    drawInkWashes(ctx, width, height);
    drawBrushStrokes(ctx, width, height);
    drawPaperGrain(ctx, width, height);
    drawIndigoMoon(ctx, width, height);
  }
  drawBreathingWash(ctx, width, height, time);
  drawMotes(ctx, width, height, time, motes);
  drawVignette(ctx, width, height);
}

export function InkAtmosphere({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const motesRef = useRef([]);
  const staticRef = useRef(null);

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
        width = Math.max(1, wrap.parentElement?.clientWidth || window.innerWidth);
        height = Math.max(1, wrap.parentElement?.clientHeight || window.innerHeight);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = variant === "stage" ? 60 : 46;
      motesRef.current = createMotes(count, width, height);
      staticRef.current = buildStaticLayer(width, height);
      return { width, height };
    };

    let size = resize();
    const paint = (now) => {
      if (!running) return;
      const time = reduced ? 0 : (now - start) / 1000;
      drawScene(ctx, size.width, size.height, time, reduced ? [] : motesRef.current, staticRef.current);
      if (!reduced) raf = requestAnimationFrame(paint);
    };
    const onResize = () => { size = resize(); if (reduced) paint(performance.now()); };
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = prefersReducedMotion();
      cancelAnimationFrame(raf);
      if (reduced) paint(performance.now());
      else raf = requestAnimationFrame(paint);
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
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
    <div ref={wrapRef} className={`ink-atmosphere ink-atmosphere--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="ink-atmosphere__canvas" />
    </div>
  );
}
