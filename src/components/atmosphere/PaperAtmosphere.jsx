import React, { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function createDust(count, width, height) {
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 8.2) * width,
    y: hash(i * 6.4 + 1) * height,
    r: 0.4 + hash(i * 3.3) * 1.9,
    speed: 0.04 + hash(i * 2.1) * 0.16,
    drift: (hash(i * 4.7) - 0.5) * 0.22,
    phase: hash(i * 7.9) * Math.PI * 2,
    alpha: 0.08 + hash(i * 1.5) * 0.32,
    warm: hash(i * 9.1) > 0.55,
  }));
}

function drawPaperBase(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, width * 0.15, height);
  bg.addColorStop(0, "#F8F4EC");
  bg.addColorStop(0.28, "#F3F0EA");
  bg.addColorStop(0.55, "#EFEAE2");
  bg.addColorStop(0.82, "#E9E3D8");
  bg.addColorStop(1, "#E2DACB");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Soft uneven pulp patches
  for (let i = 0; i < 12; i += 1) {
    const cx = hash(i * 2.1) * width;
    const cy = hash(i * 3.7 + 1) * height;
    const rx = width * (0.12 + hash(i * 1.4) * 0.22);
    const ry = height * (0.08 + hash(i * 2.8) * 0.16);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    const warm = hash(i) > 0.5;
    g.addColorStop(0, warm ? "rgba(232, 210, 170, 0.14)" : "rgba(210, 200, 185, 0.12)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, hash(i * 5) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFibers(ctx, width, height) {
  // Long kozo-like fibers
  ctx.save();
  for (let i = 0; i < 160; i += 1) {
    const x = hash(i * 1.13) * width;
    const y = hash(i * 2.71 + 2) * height;
    const len = 10 + hash(i * 4.2) * 36;
    const angle = hash(i * 6.5) * Math.PI * 2;
    const alpha = 0.025 + hash(i * 3.1) * 0.05;
    ctx.strokeStyle = hash(i) > 0.5
      ? `rgba(120, 105, 80, ${alpha})`
      : `rgba(170, 150, 120, ${alpha})`;
    ctx.lineWidth = 0.5 + hash(i * 1.9) * 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    const mx = x + Math.cos(angle) * len * 0.5 + (hash(i * 8) - 0.5) * 6;
    const my = y + Math.sin(angle) * len * 0.5 + (hash(i * 9) - 0.5) * 6;
    ctx.quadraticCurveTo(mx, my, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Fine flecks / inclusions
  for (let i = 0; i < 220; i += 1) {
    const x = hash(i * 11.3) * width;
    const y = hash(i * 7.7 + 3) * height;
    const a = 0.03 + hash(i * 2.2) * 0.07;
    ctx.fillStyle = hash(i * 4) > 0.7
      ? `rgba(150, 110, 70, ${a})`
      : `rgba(90, 80, 65, ${a})`;
    ctx.fillRect(x, y, 0.8 + hash(i) * 1.4, 0.8 + hash(i * 1.5) * 1.2);
  }

  // Subtle woven grain
  ctx.fillStyle = "rgba(110, 100, 80, 0.02)";
  for (let x = 0; x < width; x += 14) {
    for (let y = 0; y < height; y += 14) {
      if ((x / 14 + y / 14) % 3 === 0) ctx.fillRect(x, y, 1.1, 1.1);
    }
  }
}

function drawWindowLight(ctx, width, height) {
  const lx = width * 0.78;
  const ly = height * 0.06;

  const glow = ctx.createRadialGradient(lx, ly, 8, lx, ly, width * 0.62);
  glow.addColorStop(0, "rgba(255, 252, 240, 0.7)");
  glow.addColorStop(0.25, "rgba(255, 236, 200, 0.28)");
  glow.addColorStop(0.55, "rgba(232, 200, 140, 0.1)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Soft light shafts (shoji / window panes feel)
  ctx.save();
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 4; i += 1) {
    const ox = lx - width * 0.08 + i * width * 0.05;
    const shaft = ctx.createLinearGradient(ox, ly, ox - width * 0.12, height * 0.7);
    shaft.addColorStop(0, "rgba(255, 248, 230, 0.9)");
    shaft.addColorStop(0.45, "rgba(255, 230, 190, 0.25)");
    shaft.addColorStop(1, "transparent");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(ox - 4, ly);
    ctx.lineTo(ox + 10, ly);
    ctx.lineTo(ox - width * 0.08 + 18, height * 0.72);
    ctx.lineTo(ox - width * 0.14, height * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDeckleEdges(ctx, width, height) {
  const r = Math.min(width, height) * 0.42;
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  for (const [cx, cy] of corners) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(170, 130, 80, 0.09)");
    g.addColorStop(0.45, "rgba(150, 120, 70, 0.035)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const top = ctx.createLinearGradient(0, 0, 0, height * 0.08);
  top.addColorStop(0, "rgba(140, 120, 90, 0.06)");
  top.addColorStop(1, "transparent");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, height * 0.08);
}

function drawInkWashAccent(ctx, width, height) {
  // Very subtle sumi wash in a corner — washi calligraphy atmosphere
  ctx.save();
  ctx.globalAlpha = 0.07;
  const wx = width * 0.12;
  const wy = height * 0.78;
  const wash = ctx.createRadialGradient(wx, wy, 0, wx, wy, width * 0.28);
  wash.addColorStop(0, "rgba(70, 60, 50, 0.55)");
  wash.addColorStop(0.4, "rgba(90, 75, 60, 0.2)");
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.ellipse(wx, wy, width * 0.22, height * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBreathingLight(ctx, width, height, time) {
  ctx.save();
  ctx.globalAlpha = 0.2 + Math.sin(time * 0.35) * 0.05;
  const pulse = ctx.createRadialGradient(
    width * 0.78 + Math.sin(time * 0.12) * 8,
    height * 0.08,
    0,
    width * 0.7,
    height * 0.25,
    width * 0.4,
  );
  pulse.addColorStop(0, "rgba(255, 250, 230, 0.7)");
  pulse.addColorStop(1, "transparent");
  ctx.fillStyle = pulse;
  ctx.fillRect(0, 0, width, height * 0.55);
  ctx.restore();
}

function drawDust(ctx, width, height, time, dust) {
  const lx = width * 0.78;
  const ly = height * 0.08;
  const lightR = width * 0.5;

  for (const d of dust) {
    d.y -= d.speed;
    d.x += d.drift + Math.sin(time * 0.45 + d.phase) * 0.18;
    if (d.y < -8) { d.y = height + 8; d.x = Math.random() * width; }
    if (d.x < -8) d.x = width + 4;
    if (d.x > width + 8) d.x = -4;

    const dist = Math.hypot(d.x - lx, d.y - ly);
    const nearLight = Math.max(0, 1 - dist / lightR);
    const twinkle = 0.7 + Math.sin(time * 1.8 + d.phase) * 0.3;
    const alpha = d.alpha * (0.25 + nearLight * 1.1) * twinkle;

    if (nearLight > 0.15) {
      const halo = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3.5);
      halo.addColorStop(0, d.warm
        ? `rgba(255, 240, 200, ${alpha * 0.55})`
        : `rgba(255, 252, 245, ${alpha * 0.5})`);
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = d.warm
      ? `rgba(255, 245, 210, ${alpha})`
      : `rgba(255, 252, 245, ${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVignette(ctx, width, height) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.4,
    height * 0.2,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.8,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.7, "rgba(140, 120, 90, 0.04)");
  vignette.addColorStop(1, "rgba(100, 85, 60, 0.14)");
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
  drawPaperBase(ctx, width, height);
  drawFibers(ctx, width, height);
  drawWindowLight(ctx, width, height);
  drawDeckleEdges(ctx, width, height);
  drawInkWashAccent(ctx, width, height);
  return canvas;
}

function drawScene(ctx, width, height, time, dust, staticLayer) {
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, width, height);
  } else {
    drawPaperBase(ctx, width, height);
    drawFibers(ctx, width, height);
    drawWindowLight(ctx, width, height);
    drawDeckleEdges(ctx, width, height);
    drawInkWashAccent(ctx, width, height);
  }
  drawBreathingLight(ctx, width, height, time);
  drawDust(ctx, width, height, time, dust);
  drawVignette(ctx, width, height);
}

export function PaperAtmosphere({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dustRef = useRef([]);
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
      const count = variant === "stage" ? 55 : 42;
      dustRef.current = createDust(count, width, height);
      staticRef.current = buildStaticLayer(width, height);
      return { width, height };
    };

    let size = resize();
    const paint = (now) => {
      if (!running) return;
      const time = reduced ? 0 : (now - start) / 1000;
      drawScene(ctx, size.width, size.height, time, reduced ? [] : dustRef.current, staticRef.current);
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
    <div ref={wrapRef} className={`paper-atmosphere paper-atmosphere--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="paper-atmosphere__canvas" />
    </div>
  );
}
