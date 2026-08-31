import React, { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawPetal(ctx, x, y, size, rotation, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;

  const shadow = ctx.createRadialGradient(size * 0.15, size * 0.2, 0, 0, 0, size * 1.4);
  shadow.addColorStop(0, "rgba(180, 90, 120, 0.12)");
  shadow.addColorStop(1, "transparent");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(size * 0.1, size * 0.15, size * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.72, -size * 0.55, size * 0.88, size * 0.12, 0, size);
  ctx.bezierCurveTo(-size * 0.88, size * 0.12, -size * 0.72, -size * 0.55, 0, -size);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(0.4, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.65);
  ctx.quadraticCurveTo(size * 0.06, 0, 0, size * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawBlossom(ctx, x, y, size, lit) {
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size * 0.42;
    const py = y + Math.sin(angle) * size * 0.42;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    const pg = ctx.createRadialGradient(-size * 0.12, 0, 0, 0, 0, size * 0.5);
    if (lit) {
      pg.addColorStop(0, "rgba(255, 252, 253, 0.98)");
      pg.addColorStop(0.35, "rgba(255, 220, 230, 0.95)");
      pg.addColorStop(0.75, "rgba(244, 179, 194, 0.9)");
      pg.addColorStop(1, "rgba(229, 140, 165, 0.7)");
    } else {
      pg.addColorStop(0, "rgba(255, 236, 242, 0.88)");
      pg.addColorStop(0.5, "rgba(236, 170, 190, 0.8)");
      pg.addColorStop(1, "rgba(200, 120, 150, 0.55)");
    }
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.44, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (lit) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
    halo.addColorStop(0, "rgba(255, 200, 215, 0.2)");
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const core = ctx.createRadialGradient(x, y, 0, x, y, size * 0.22);
  core.addColorStop(0, "#fff8fa");
  core.addColorStop(0.45, "#f0a8bc");
  core.addColorStop(1, "#c94f6d");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 210, 120, 0.9)";
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.15;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(a) * size * 0.11,
      y + Math.sin(a) * size * 0.11,
      size * 0.032,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function sampleCurve(points, t) {
  if (points.length === 2) {
    return [
      points[0][0] + (points[1][0] - points[0][0]) * t,
      points[0][1] + (points[1][1] - points[0][1]) * t,
    ];
  }
  const segs = points.length - 1;
  const f = t * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const u = f - i;
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const c = points[Math.min(i + 2, points.length - 1)];
  const m1 = i === 0 ? a : [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
  const m2 = i >= segs - 1 ? b : [(b[0] + c[0]) * 0.5, (b[1] + c[1]) * 0.5];
  const omu = 1 - u;
  return [
    omu * omu * m1[0] + 2 * omu * u * b[0] + u * u * m2[0],
    omu * omu * m1[1] + 2 * omu * u * b[1] + u * u * m2[1],
  ];
}

function drawTaperedBranch(ctx, points, startW, endW, colorDeep, colorLite) {
  if (points.length < 2) return;
  const steps = 26;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const p0 = sampleCurve(points, t0);
    const p1 = sampleCurve(points, t1);
    const w = startW + (endW - startW) * t0;
    ctx.strokeStyle = colorDeep;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
    ctx.strokeStyle = colorLite;
    ctx.lineWidth = Math.max(0.5, w * 0.32);
    ctx.beginPath();
    ctx.moveTo(p0[0] - w * 0.1, p0[1] - w * 0.08);
    ctx.lineTo(p1[0] - w * 0.1, p1[1] - w * 0.08);
    ctx.stroke();
  }
}

function createPetals(count, width, height) {
  const colors = ["#F8C8D4", "#F4B3C2", "#E597B2", "#FFD6E0", "#F09199", "#FFE8EE"];
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 3.1) * width,
    y: hash(i * 5.7) * height,
    size: 4 + hash(i * 2.2) * 11,
    rot: hash(i * 8.1) * Math.PI * 2,
    spin: (hash(i * 4.4) - 0.5) * 2,
    speed: 0.22 + hash(i * 1.9) * 0.8,
    drift: (hash(i * 6.3) - 0.5) * 0.8,
    sway: 0.4 + hash(i * 7.1) * 1.3,
    phase: hash(i * 9.2) * Math.PI * 2,
    color: colors[Math.floor(hash(i * 11.4) * colors.length)],
    alpha: 0.35 + hash(i * 1.5) * 0.5,
    layer: i % 3,
  }));
}

function drawSky(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#FFF9FB");
  sky.addColorStop(0.25, "#FDEEF2");
  sky.addColorStop(0.55, "#FFF8F9");
  sky.addColorStop(0.8, "#F8E8EC");
  sky.addColorStop(1, "#F0DCE4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Soft spring blue wash near top
  const blue = ctx.createRadialGradient(width * 0.45, height * -0.05, 0, width * 0.45, 0, width * 0.7);
  blue.addColorStop(0, "rgba(210, 230, 245, 0.35)");
  blue.addColorStop(1, "transparent");
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, width, height * 0.45);

  // Pink blossom haze
  const mistL = ctx.createRadialGradient(width * 0.08, height * 0.08, 0, width * 0.08, height * 0.08, width * 0.55);
  mistL.addColorStop(0, "rgba(244, 179, 194, 0.32)");
  mistL.addColorStop(0.5, "rgba(244, 179, 194, 0.1)");
  mistL.addColorStop(1, "transparent");
  ctx.fillStyle = mistL;
  ctx.fillRect(0, 0, width, height);

  const mistR = ctx.createRadialGradient(width * 0.92, height * 0.75, 0, width * 0.92, height * 0.75, width * 0.45);
  mistR.addColorStop(0, "rgba(229, 151, 178, 0.2)");
  mistR.addColorStop(1, "transparent");
  ctx.fillStyle = mistR;
  ctx.fillRect(0, 0, width, height);
}

function drawSun(ctx, width, height, variant) {
  const sunX = width * 0.8;
  const sunY = height * 0.11;
  const sunR = Math.min(width, height) * (variant === "stage" ? 0.055 : 0.068);

  const outer = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 5.5);
  outer.addColorStop(0, "rgba(255, 252, 245, 0.9)");
  outer.addColorStop(0.25, "rgba(255, 230, 210, 0.35)");
  outer.addColorStop(0.5, "rgba(244, 179, 194, 0.14)");
  outer.addColorStop(1, "transparent");
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 5.5, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0, sunX, sunY, sunR);
  body.addColorStop(0, "#fffef8");
  body.addColorStop(0.55, "#ffe8d0");
  body.addColorStop(1, "#f5c8a8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, width, height, time) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  const clouds = [
    { x: 0.22, y: 0.16, s: 0.14, drift: 0.004 },
    { x: 0.55, y: 0.1, s: 0.1, drift: -0.003 },
    { x: 0.38, y: 0.22, s: 0.08, drift: 0.005 },
  ];
  for (const c of clouds) {
    const cx = width * (c.x + Math.sin(time * c.drift * 20) * 0.01);
    const cy = height * c.y;
    const r = width * c.s;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    g.addColorStop(0.55, "rgba(255, 245, 248, 0.35)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy + r * 0.05, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.3, cy + r * 0.02, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBranchesAndBlossoms(ctx, width, height, variant) {
  const deep = "#4a2e2a";
  const mid = "#6b4540";
  const lite = "#8a6258";
  const scale = Math.min(width, height) / 420;

  // Soft canopy arches at top
  drawTaperedBranch(ctx, [
    [0, height * 0.04],
    [width * 0.15, height * 0.02],
    [width * 0.3, height * 0.07],
    [width * 0.44, height * 0.16],
  ], 5, 1.3, deep, mid);
  drawTaperedBranch(ctx, [
    [width, height * 0.035],
    [width * 0.85, height * 0.02],
    [width * 0.7, height * 0.075],
    [width * 0.56, height * 0.16],
  ], 5, 1.3, deep, mid);

  const canopy = [
    [0.1, 0.05, 8, true], [0.18, 0.035, 7, true], [0.26, 0.07, 9, true],
    [0.34, 0.11, 7, true], [0.42, 0.14, 8, true], [0.58, 0.14, 8, true],
    [0.66, 0.1, 9, true], [0.74, 0.06, 7, true], [0.82, 0.035, 8, true],
    [0.9, 0.05, 6, true], [0.22, 0.12, 5, false], [0.78, 0.12, 5, false],
  ];
  for (const [nx, ny, s, lit] of canopy) {
    drawBlossom(ctx, width * nx, height * ny, s * (variant === "stage" ? 1.15 : 1) * Math.max(0.9, scale), lit);
  }

  const corners = [
    { ox: 0, oy: 0, sx: 1, sy: 1 },
    { ox: width, oy: 0, sx: -1, sy: 1 },
    { ox: 0, oy: height, sx: 1, sy: -1 },
    { ox: width, oy: height, sx: -1, sy: -1 },
  ];

  for (const c of corners) {
    ctx.save();
    ctx.translate(c.ox, c.oy);
    ctx.scale(c.sx, c.sy);
    const span = Math.min(width, height) * 0.44;

    drawTaperedBranch(ctx, [
      [0, 0],
      [span * 0.16, span * 0.1],
      [span * 0.3, span * 0.3],
      [span * 0.4, span * 0.52],
      [span * 0.48, span * 0.8],
    ], 6.2, 1.2, deep, lite);

    drawTaperedBranch(ctx, [
      [span * 0.18, span * 0.14],
      [span * 0.36, span * 0.12],
      [span * 0.5, span * 0.22],
      [span * 0.58, span * 0.34],
    ], 2.6, 0.85, mid, lite);

    drawTaperedBranch(ctx, [
      [span * 0.28, span * 0.34],
      [span * 0.46, span * 0.32],
      [span * 0.58, span * 0.44],
      [span * 0.64, span * 0.55],
    ], 2.2, 0.75, mid, lite);

    drawTaperedBranch(ctx, [
      [span * 0.22, span * 0.48],
      [span * 0.12, span * 0.58],
      [span * 0.08, span * 0.7],
    ], 1.9, 0.65, mid, lite);

    const blooms = [
      [0.14, 0.1, 9, true], [0.24, 0.08, 7, true], [0.32, 0.18, 10, true],
      [0.4, 0.26, 8, true], [0.22, 0.26, 6, false], [0.34, 0.36, 9, true],
      [0.46, 0.4, 7, true], [0.28, 0.46, 6, false], [0.42, 0.52, 8, true],
      [0.5, 0.6, 6, false], [0.18, 0.38, 5, false], [0.54, 0.32, 6, true],
      [0.12, 0.2, 5, true], [0.38, 0.14, 6, true], [0.48, 0.48, 7, true],
      [0.56, 0.54, 5, false], [0.3, 0.58, 6, true], [0.08, 0.32, 4, false],
    ];
    for (const [nx, ny, s, lit] of blooms) {
      drawBlossom(ctx, span * nx, span * ny, s * scale, lit);
    }
    ctx.restore();
  }
}

function drawGroundHaze(ctx, width, height, time) {
  const mist = ctx.createLinearGradient(0, height * 0.62, 0, height);
  mist.addColorStop(0, "transparent");
  mist.addColorStop(0.45, "rgba(255, 235, 240, 0.25)");
  mist.addColorStop(1, "rgba(240, 210, 220, 0.4)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, height * 0.62, width, height * 0.38);

  ctx.save();
  ctx.globalAlpha = 0.3 + Math.sin(time * 0.25) * 0.05;
  for (let i = 0; i < 3; i += 1) {
    const y = height * (0.7 + i * 0.08) + Math.sin(time * 0.18 + i) * 6;
    const g = ctx.createLinearGradient(0, y, width, y);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.4, `rgba(255, 220, 230, ${0.08 + i * 0.02})`);
    g.addColorStop(0.7, `rgba(244, 190, 210, ${0.06 + i * 0.015})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - height * 0.035, width, height * 0.07);
  }
  ctx.restore();
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
  vignette.addColorStop(0.75, "rgba(180, 100, 130, 0.04)");
  vignette.addColorStop(1, "rgba(120, 60, 90, 0.12)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function buildStaticLayer(width, height, variant) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(ctx, width, height);
  drawSun(ctx, width, height, variant);
  drawBranchesAndBlossoms(ctx, width, height, variant);
  return canvas;
}

function drawScene(ctx, width, height, time, petals, staticLayer) {
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, width, height);
  } else {
    drawSky(ctx, width, height);
    drawSun(ctx, width, height, "frame");
    drawBranchesAndBlossoms(ctx, width, height, "frame");
  }

  drawClouds(ctx, width, height, time);
  drawGroundHaze(ctx, width, height, time);

  // Soft sun shafts
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.25 + Math.sin(time * 0.2) * 0.04;
  const shaft = ctx.createRadialGradient(width * 0.8, height * 0.11, 0, width * 0.55, height * 0.4, width * 0.55);
  shaft.addColorStop(0, "rgba(255, 245, 230, 0.8)");
  shaft.addColorStop(1, "transparent");
  ctx.fillStyle = shaft;
  ctx.fillRect(0, 0, width, height * 0.65);
  ctx.restore();

  for (const p of petals) {
    const layerSlow = 1 + p.layer * 0.28;
    p.y += p.speed / layerSlow;
    p.x += (p.drift + Math.sin(time * p.sway + p.phase) * 0.6) / layerSlow;
    p.rot += p.spin * 0.018;
    if (p.y > height + 24) {
      p.y = -24;
      p.x = Math.random() * width;
    }
    if (p.x < -24) p.x = width + 12;
    if (p.x > width + 24) p.x = -12;
    drawPetal(ctx, p.x, p.y, p.size, p.rot, p.color, p.alpha * (0.78 + p.layer * 0.07));
  }

  drawVignette(ctx, width, height);
}

export function SakuraDay({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const petalsRef = useRef([]);
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
      const count = variant === "stage" ? 62 : 48;
      petalsRef.current = createPetals(count, width, height);
      staticRef.current = buildStaticLayer(width, height, variant);
      return { width, height };
    };

    let size = resize();
    const paint = (now) => {
      if (!running) return;
      const time = reduced ? 0 : (now - start) / 1000;
      drawScene(ctx, size.width, size.height, time, reduced ? [] : petalsRef.current, staticRef.current);
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
    <div ref={wrapRef} className={`sakura-day sakura-day--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="sakura-day__canvas" />
    </div>
  );
}
