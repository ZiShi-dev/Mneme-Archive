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
  // Soft night glow behind petal
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
  glow.addColorStop(0, "rgba(255, 210, 225, 0.28)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.72, -size * 0.55, size * 0.88, size * 0.12, 0, size);
  ctx.bezierCurveTo(-size * 0.88, size * 0.12, -size * 0.72, -size * 0.55, 0, -size);
  ctx.fill();

  // Vein / highlight
  ctx.globalAlpha = alpha * 0.45;
  ctx.strokeStyle = "rgba(255, 248, 250, 0.65)";
  ctx.lineWidth = Math.max(0.4, size * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.quadraticCurveTo(size * 0.08, 0, 0, size * 0.65);
  ctx.stroke();
  ctx.restore();
}

function drawBlossom(ctx, x, y, size, lit) {
  const petalCount = 5;
  for (let i = 0; i < petalCount; i += 1) {
    const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size * 0.42;
    const py = y + Math.sin(angle) * size * 0.42;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    const pg = ctx.createRadialGradient(-size * 0.1, 0, 0, 0, 0, size * 0.5);
    if (lit) {
      pg.addColorStop(0, "rgba(255, 248, 250, 0.95)");
      pg.addColorStop(0.45, "rgba(255, 214, 228, 0.88)");
      pg.addColorStop(1, "rgba(220, 140, 168, 0.55)");
    } else {
      pg.addColorStop(0, "rgba(245, 220, 230, 0.72)");
      pg.addColorStop(0.5, "rgba(210, 150, 175, 0.55)");
      pg.addColorStop(1, "rgba(120, 70, 95, 0.35)");
    }
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.44, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Night bloom halo
  if (lit) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 2.2);
    halo.addColorStop(0, "rgba(255, 190, 210, 0.22)");
    halo.addColorStop(0.5, "rgba(200, 100, 140, 0.08)");
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const core = ctx.createRadialGradient(x, y, 0, x, y, size * 0.22);
  core.addColorStop(0, lit ? "#fff6f8" : "#e8c4d0");
  core.addColorStop(0.55, lit ? "#f0b8c8" : "#c48aa0");
  core.addColorStop(1, lit ? "#d488a0" : "#8a5068");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Stamens
  ctx.fillStyle = lit ? "rgba(255, 220, 160, 0.85)" : "rgba(200, 160, 120, 0.45)";
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 0.12, y + Math.sin(a) * size * 0.12, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTaperedBranch(ctx, points, startW, endW, colorDeep, colorLite) {
  if (points.length < 2) return;
  const steps = 28;
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
    ctx.lineWidth = Math.max(0.6, w * 0.35);
    ctx.beginPath();
    ctx.moveTo(p0[0] - w * 0.08, p0[1] - w * 0.08);
    ctx.lineTo(p1[0] - w * 0.08, p1[1] - w * 0.08);
    ctx.stroke();
  }
}

function sampleCurve(points, t) {
  if (points.length === 2) {
    return [
      points[0][0] + (points[1][0] - points[0][0]) * t,
      points[0][1] + (points[1][1] - points[0][1]) * t,
    ];
  }
  // Piecewise quadratic through midpoints
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

function createPetals(count, width, height) {
  const colors = ["#F8D4DE", "#FFF0F5", "#E8A8BA", "#FFD6E4", "#F0C0D0"];
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 3.1) * width,
    y: hash(i * 5.7) * height,
    size: 3.5 + hash(i * 2.2) * 10,
    rot: hash(i * 8.1) * Math.PI * 2,
    spin: (hash(i * 4.4) - 0.5) * 2.2,
    speed: 0.18 + hash(i * 1.9) * 0.75,
    drift: (hash(i * 6.3) - 0.5) * 0.85,
    sway: 0.35 + hash(i * 7.1) * 1.4,
    phase: hash(i * 9.2) * Math.PI * 2,
    color: colors[Math.floor(hash(i * 11.4) * colors.length)],
    alpha: 0.3 + hash(i * 1.5) * 0.55,
    layer: i % 3,
  }));
}

function createStars(count, width, height) {
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 1.7) * width,
    y: hash(i * 3.3 + 1) * height * 0.62,
    r: 0.35 + hash(i * 2.1) * (hash(i) > 0.9 ? 1.8 : 1.1),
    twinkle: 0.4 + hash(i * 5.2) * 1.8,
    phase: hash(i * 8.8) * Math.PI * 2,
    warm: hash(i * 4.1) > 0.78,
  }));
}

function drawSky(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#08060c");
  sky.addColorStop(0.22, "#121018");
  sky.addColorStop(0.5, "#1a1218");
  sky.addColorStop(0.78, "#161016");
  sky.addColorStop(1, "#0c080e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Magenta dusk residual
  const wash = ctx.createRadialGradient(width * 0.15, height * 0.05, 0, width * 0.15, height * 0.05, width * 0.7);
  wash.addColorStop(0, "rgba(160, 55, 90, 0.32)");
  wash.addColorStop(0.4, "rgba(100, 40, 70, 0.12)");
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const wash2 = ctx.createRadialGradient(width * 0.85, height * 0.9, 0, width * 0.85, height * 0.9, width * 0.55);
  wash2.addColorStop(0, "rgba(120, 60, 100, 0.2)");
  wash2.addColorStop(1, "transparent");
  ctx.fillStyle = wash2;
  ctx.fillRect(0, 0, width, height);
}

function drawMoon(ctx, width, height, variant) {
  const moonX = width * 0.76;
  const moonY = height * 0.13;
  const moonR = Math.min(width, height) * (variant === "stage" ? 0.048 : 0.062);

  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.15, moonX, moonY, moonR * 5.2);
  glow.addColorStop(0, "rgba(255, 244, 247, 0.5)");
  glow.addColorStop(0.25, "rgba(255, 210, 225, 0.18)");
  glow.addColorStop(0.55, "rgba(180, 100, 130, 0.07)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 5.2, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(
    moonX - moonR * 0.32,
    moonY - moonR * 0.28,
    moonR * 0.08,
    moonX + moonR * 0.1,
    moonY + moonR * 0.15,
    moonR,
  );
  body.addColorStop(0, "#fffafc");
  body.addColorStop(0.4, "#f5e6ec");
  body.addColorStop(0.75, "#dcc4ce");
  body.addColorStop(1, "#b898a8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // Soft maria
  ctx.save();
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.clip();
  const maria = [
    [0.2, -0.1, 0.28, 0.1],
    [-0.25, 0.2, 0.22, 0.09],
    [0.05, 0.35, 0.18, 0.07],
  ];
  for (const [ox, oy, rr, a] of maria) {
    const mx = moonX + ox * moonR;
    const my = moonY + oy * moonR;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, moonR * rr);
    g.addColorStop(0, `rgba(150, 125, 145, ${a})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, moonR * rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBranchesAndBlossoms(ctx, width, height, variant) {
  const deep = "#1e1218";
  const mid = "#3a2530";
  const lite = "#5a3a48";
  const scale = Math.min(width, height) / 420;

  // Upper canopy arches
  drawTaperedBranch(ctx, [
    [0, height * 0.05],
    [width * 0.16, height * 0.03],
    [width * 0.32, height * 0.08],
    [width * 0.46, height * 0.18],
  ], 5.5, 1.4, deep, mid);
  drawTaperedBranch(ctx, [
    [width, height * 0.04],
    [width * 0.84, height * 0.03],
    [width * 0.68, height * 0.09],
    [width * 0.54, height * 0.18],
  ], 5.5, 1.4, deep, mid);

  const canopy = [
    [0.1, 0.06, 8, true], [0.18, 0.04, 7, true], [0.26, 0.08, 9, true],
    [0.34, 0.12, 7, true], [0.42, 0.16, 8, true], [0.58, 0.16, 8, true],
    [0.66, 0.11, 9, true], [0.74, 0.07, 7, true], [0.82, 0.04, 8, true],
    [0.9, 0.06, 6, true], [0.22, 0.13, 5, false], [0.78, 0.13, 5, false],
  ];
  for (const [nx, ny, s, lit] of canopy) {
    drawBlossom(ctx, width * nx, height * ny, s * (variant === "stage" ? 1.2 : 1) * Math.max(0.9, scale), lit);
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
    const span = Math.min(width, height) * 0.46;

    drawTaperedBranch(ctx, [
      [0, 0],
      [span * 0.16, span * 0.1],
      [span * 0.3, span * 0.3],
      [span * 0.4, span * 0.52],
      [span * 0.46, span * 0.78],
    ], 6.5, 1.2, deep, lite);

    drawTaperedBranch(ctx, [
      [span * 0.18, span * 0.14],
      [span * 0.36, span * 0.12],
      [span * 0.5, span * 0.22],
      [span * 0.58, span * 0.34],
    ], 2.8, 0.9, mid, lite);

    drawTaperedBranch(ctx, [
      [span * 0.28, span * 0.34],
      [span * 0.46, span * 0.32],
      [span * 0.58, span * 0.44],
      [span * 0.64, span * 0.56],
    ], 2.4, 0.8, mid, lite);

    drawTaperedBranch(ctx, [
      [span * 0.22, span * 0.48],
      [span * 0.12, span * 0.58],
      [span * 0.08, span * 0.72],
    ], 2, 0.7, mid, lite);

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

function drawMist(ctx, width, height, time) {
  const mist = ctx.createLinearGradient(0, height * 0.5, 0, height);
  mist.addColorStop(0, "transparent");
  mist.addColorStop(0.4, "rgba(40, 18, 28, 0.18)");
  mist.addColorStop(0.75, "rgba(28, 12, 20, 0.38)");
  mist.addColorStop(1, "rgba(12, 6, 10, 0.55)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  // Floating pink fog bands
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(time * 0.2) * 0.06;
  for (let i = 0; i < 3; i += 1) {
    const y = height * (0.62 + i * 0.1) + Math.sin(time * 0.15 + i) * 8;
    const g = ctx.createLinearGradient(0, y, width, y);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.35, `rgba(180, 90, 120, ${0.06 + i * 0.02})`);
    g.addColorStop(0.65, `rgba(140, 70, 100, ${0.05 + i * 0.015})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - height * 0.04, width, height * 0.08);
  }
  ctx.restore();
}

function drawStars(ctx, width, height, time, stars) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of stars) {
    const pulse = 0.4 + (Math.sin(time * s.twinkle + s.phase) * 0.5 + 0.5) * 0.6;
    const color = s.warm
      ? `rgba(255, 220, 200, ${pulse * 0.75})`
      : `rgba(255, 244, 247, ${pulse * 0.85})`;
    if (s.r > 1.3) {
      const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      halo.addColorStop(0, color);
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    height * 0.18,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.7, "rgba(8, 4, 8, 0.2)");
  vignette.addColorStop(1, "rgba(4, 2, 6, 0.55)");
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
  drawMoon(ctx, width, height, variant);
  drawBranchesAndBlossoms(ctx, width, height, variant);
  return canvas;
}

function drawScene(ctx, width, height, time, petals, stars, staticLayer) {
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, width, height);
  } else {
    drawSky(ctx, width, height);
    drawMoon(ctx, width, height, "frame");
    drawBranchesAndBlossoms(ctx, width, height, "frame");
  }

  drawStars(ctx, width, height, time, stars);
  drawMist(ctx, width, height, time);

  // Subtle moon shimmer on blossoms area
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.08 + Math.sin(time * 0.3) * 0.03;
  const shimmer = ctx.createRadialGradient(width * 0.76, height * 0.13, 0, width * 0.5, height * 0.35, width * 0.55);
  shimmer.addColorStop(0, "rgba(255, 230, 240, 0.5)");
  shimmer.addColorStop(1, "transparent");
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, width, height * 0.55);
  ctx.restore();

  for (const p of petals) {
    const layerSlow = 1 + p.layer * 0.25;
    p.y += p.speed / layerSlow;
    p.x += (p.drift + Math.sin(time * p.sway + p.phase) * 0.65) / layerSlow;
    p.rot += p.spin * 0.018;
    if (p.y > height + 24) {
      p.y = -24;
      p.x = Math.random() * width;
    }
    if (p.x < -24) p.x = width + 12;
    if (p.x > width + 24) p.x = -12;
    drawPetal(ctx, p.x, p.y, p.size, p.rot, p.color, p.alpha * (0.75 + p.layer * 0.08));
  }

  drawVignette(ctx, width, height);
}

export function YozakuraNight({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const petalsRef = useRef([]);
  const starsRef = useRef([]);
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
      const petalCount = variant === "stage" ? 68 : 52;
      const starCount = variant === "stage" ? 90 : 70;
      petalsRef.current = createPetals(petalCount, width, height);
      starsRef.current = createStars(starCount, width, height);
      staticRef.current = buildStaticLayer(width, height, variant);
      return { width, height };
    };

    let size = resize();

    const paint = (now) => {
      if (!running) return;
      const time = reduced ? 0 : (now - start) / 1000;
      drawScene(
        ctx,
        size.width,
        size.height,
        time,
        reduced ? [] : petalsRef.current,
        starsRef.current,
        staticRef.current,
      );
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
    <div ref={wrapRef} className={`yozakura-night yozakura-night--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="yozakura-night__canvas" />
    </div>
  );
}
