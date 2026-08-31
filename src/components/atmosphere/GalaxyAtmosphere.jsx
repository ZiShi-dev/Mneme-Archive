import React, { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function starColor(temp, alpha) {
  if (temp < 0.22) return `rgba(255, 198, 140, ${alpha})`;
  if (temp < 0.4) return `rgba(255, 228, 190, ${alpha})`;
  if (temp < 0.72) return `rgba(236, 242, 255, ${alpha})`;
  if (temp < 0.9) return `rgba(180, 210, 255, ${alpha})`;
  return `rgba(150, 190, 255, ${alpha})`;
}

function createStars(count, width, height) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const layer = i % 4;
    const bright = hash(i * 13.7) > 0.94;
    const mag = bright ? 1.6 + hash(i) * 2.2 : layer === 0
      ? 0.25 + hash(i) * 0.45
      : layer === 1
        ? 0.45 + hash(i) * 0.7
        : 0.75 + hash(i) * 1.15;
    stars.push({
      x: hash(i * 1.7) * width,
      y: hash(i * 3.1 + 2) * height,
      r: mag,
      twinkle: 0.35 + hash(i * 5.3) * 1.8,
      phase: hash(i * 9.1) * Math.PI * 2,
      temp: hash(i * 2.4),
      parallax: 0.08 + layer * 0.16,
      spike: bright && hash(i * 17.2) > 0.35,
      glow: bright || mag > 1.35,
    });
  }
  return stars;
}

function createDust(count, width, height) {
  return Array.from({ length: count }, (_, i) => ({
    x: hash(i * 8.2) * width,
    y: hash(i * 6.4 + 1) * height,
    r: 0.35 + hash(i * 3.3) * 1.4,
    speed: 0.03 + hash(i * 2.1) * 0.09,
    drift: (hash(i * 4.7) - 0.5) * 0.14,
    phase: hash(i * 7.9) * Math.PI * 2,
    alpha: 0.05 + hash(i * 1.5) * 0.16,
  }));
}

function paintBlob(ctx, cx, cy, rx, ry, rot, stops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, ry / Math.max(rx, 1));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDeepField(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, width * 0.2, height);
  sky.addColorStop(0, "#03020c");
  sky.addColorStop(0.28, "#07061a");
  sky.addColorStop(0.55, "#0b0a28");
  sky.addColorStop(0.82, "#08061c");
  sky.addColorStop(1, "#02010a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Subtle large-scale color wash (interstellar medium)
  paintBlob(ctx, width * 0.2, height * 0.25, width * 0.7, height * 0.55, -0.4, [
    [0, "rgba(45, 30, 95, 0.22)"],
    [0.45, "rgba(25, 20, 60, 0.1)"],
    [1, "transparent"],
  ]);
  paintBlob(ctx, width * 0.78, height * 0.55, width * 0.55, height * 0.5, 0.55, [
    [0, "rgba(20, 55, 110, 0.18)"],
    [0.5, "rgba(15, 30, 70, 0.08)"],
    [1, "transparent"],
  ]);
}

function drawNebulae(ctx, width, height, time, animated) {
  const t = animated ? time * 0.04 : 0;
  const layers = [
    {
      x: 0.22 + Math.sin(t) * 0.008, y: 0.3, rx: 0.42, ry: 0.32, rot: -0.35 + t * 0.15,
      stops: [[0, "rgba(110, 45, 170, 0.34)"], [0.35, "rgba(70, 30, 130, 0.16)"], [1, "transparent"]],
    },
    {
      x: 0.68 + Math.cos(t * 0.8) * 0.006, y: 0.26, rx: 0.38, ry: 0.28, rot: 0.5,
      stops: [[0, "rgba(35, 95, 190, 0.3)"], [0.4, "rgba(25, 55, 130, 0.14)"], [1, "transparent"]],
    },
    {
      x: 0.5, y: 0.58 + Math.sin(t * 0.7) * 0.006, rx: 0.5, ry: 0.34, rot: 0.15,
      stops: [[0, "rgba(170, 55, 120, 0.22)"], [0.4, "rgba(90, 30, 90, 0.12)"], [1, "transparent"]],
    },
    {
      x: 0.34, y: 0.72, rx: 0.28, ry: 0.22, rot: -0.7,
      stops: [[0, "rgba(40, 150, 165, 0.16)"], [0.5, "rgba(25, 80, 110, 0.07)"], [1, "transparent"]],
    },
    {
      x: 0.82, y: 0.7, rx: 0.26, ry: 0.24, rot: 0.9,
      stops: [[0, "rgba(130, 70, 210, 0.2)"], [0.45, "rgba(60, 35, 120, 0.08)"], [1, "transparent"]],
    },
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const layer of layers) {
    paintBlob(
      ctx,
      width * layer.x,
      height * layer.y,
      width * layer.rx,
      height * layer.ry,
      layer.rot,
      layer.stops,
    );
  }

  paintBlob(ctx, width * 0.3, height * 0.34, width * 0.12, height * 0.09, -0.2, [
    [0, "rgba(255, 140, 200, 0.18)"],
    [0.55, "rgba(140, 80, 200, 0.08)"],
    [1, "transparent"],
  ]);
  paintBlob(ctx, width * 0.64, height * 0.3, width * 0.1, height * 0.08, 0.4, [
    [0, "rgba(120, 200, 255, 0.16)"],
    [0.55, "rgba(60, 120, 220, 0.07)"],
    [1, "transparent"],
  ]);
  ctx.restore();

  if (!animated) {
    ctx.save();
    for (let i = 0; i < 18; i += 1) {
      const fx = width * (0.15 + hash(i * 4.1) * 0.7);
      const fy = height * (0.2 + hash(i * 6.2) * 0.55);
      const len = width * (0.08 + hash(i * 2.2) * 0.18);
      const ang = hash(i * 3.3) * Math.PI * 2;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(ang);
      const dust = ctx.createLinearGradient(-len, 0, len, 0);
      dust.addColorStop(0, "transparent");
      dust.addColorStop(0.5, `rgba(4, 3, 12, ${0.08 + hash(i) * 0.12})`);
      dust.addColorStop(1, "transparent");
      ctx.fillStyle = dust;
      ctx.fillRect(-len, -height * 0.01, len * 2, height * (0.015 + hash(i * 1.4) * 0.025));
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawMilkyWay(ctx, width, height, time) {
  ctx.save();
  ctx.translate(width * 0.48, height * 0.5);
  ctx.rotate(-0.58);

  const glow = ctx.createLinearGradient(0, -height * 0.22, 0, height * 0.22);
  glow.addColorStop(0, "transparent");
  glow.addColorStop(0.3, "rgba(140, 150, 220, 0.04)");
  glow.addColorStop(0.48, "rgba(210, 205, 255, 0.16)");
  glow.addColorStop(0.52, "rgba(230, 220, 255, 0.2)");
  glow.addColorStop(0.7, "rgba(150, 165, 230, 0.05)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(-width * 0.95, -height * 0.22, width * 1.9, height * 0.44);

  paintBlob(ctx, width * 0.08, 0, width * 0.22, height * 0.1, 0, [
    [0, "rgba(255, 210, 170, 0.14)"],
    [0.4, "rgba(180, 140, 200, 0.07)"],
    [1, "transparent"],
  ]);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 520; i += 1) {
    const u = hash(i * 1.13);
    const x = (u - 0.5) * width * 1.75;
    const spread = Math.pow(hash(i * 7.7), 1.8);
    const y = (hash(i * 3.9) - 0.5) * height * (0.04 + spread * 0.14)
      + Math.sin(u * Math.PI * 2.4) * height * 0.012;
    const a = (0.05 + hash(i * 5.1) * 0.35) * (1 - spread * 0.55);
    const r = 0.25 + hash(i * 2.8) * (hash(i) > 0.92 ? 1.6 : 0.9);
    ctx.fillStyle = starColor(hash(i * 9.2), a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < 7; i += 1) {
    const y = (i - 3) * height * 0.018;
    const lane = ctx.createLinearGradient(-width, y, width, y);
    lane.addColorStop(0, "transparent");
    lane.addColorStop(0.25, `rgba(3, 2, 10, ${0.1 + i * 0.015})`);
    lane.addColorStop(0.5, `rgba(2, 1, 8, ${0.18 + (i % 2) * 0.05})`);
    lane.addColorStop(0.75, `rgba(3, 2, 10, ${0.1 + i * 0.015})`);
    lane.addColorStop(1, "transparent");
    ctx.fillStyle = lane;
    ctx.fillRect(-width, y - height * 0.008, width * 2, height * (0.01 + hash(i * 2) * 0.012));
  }

  ctx.restore();
}

function buildStaticLayer(width, height) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawDeepField(ctx, width, height);
  drawNebulae(ctx, width, height, 0, false);
  drawMilkyWay(ctx, width, height, 0);
  drawDistantGalaxy(ctx, width, height, 0);
  return canvas;
}

function drawBreathingNebula(ctx, width, height, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.45 + Math.sin(time * 0.15) * 0.08;
  paintBlob(ctx, width * (0.3 + Math.sin(time * 0.05) * 0.01), height * 0.34, width * 0.14, height * 0.1, -0.2, [
    [0, "rgba(255, 140, 200, 0.14)"],
    [1, "transparent"],
  ]);
  paintBlob(ctx, width * (0.64 + Math.cos(time * 0.04) * 0.01), height * 0.3, width * 0.12, height * 0.09, 0.4, [
    [0, "rgba(120, 200, 255, 0.12)"],
    [1, "transparent"],
  ]);
  ctx.restore();
}

function drawDistantGalaxy(ctx, width, height, time) {
  const x = width * 0.16;
  const y = height * 0.16;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.7);
  ctx.globalAlpha = 0.55;
  paintBlob(ctx, 0, 0, width * 0.055, height * 0.018, 0, [
    [0, "rgba(200, 190, 255, 0.45)"],
    [0.35, "rgba(140, 150, 230, 0.18)"],
    [1, "transparent"],
  ]);
  ctx.globalCompositeOperation = "lighter";
  paintBlob(ctx, 0, 0, width * 0.018, height * 0.01, 0, [
    [0, "rgba(255, 235, 210, 0.5)"],
    [1, "transparent"],
  ]);
  ctx.restore();
}

function drawStarSpike(ctx, x, y, len, alpha) {
  const g = ctx.createLinearGradient(x - len, y, x + len, y);
  g.addColorStop(0, "transparent");
  g.addColorStop(0.5, `rgba(230, 238, 255, ${alpha})`);
  g.addColorStop(1, "transparent");
  ctx.strokeStyle = g;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - len, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  const g2 = ctx.createLinearGradient(x, y - len * 0.7, x, y + len * 0.7);
  g2.addColorStop(0, "transparent");
  g2.addColorStop(0.5, `rgba(230, 238, 255, ${alpha * 0.85})`);
  g2.addColorStop(1, "transparent");
  ctx.strokeStyle = g2;
  ctx.beginPath();
  ctx.moveTo(x, y - len * 0.7);
  ctx.lineTo(x, y + len * 0.7);
  ctx.stroke();
}

function drawStars(ctx, width, height, time, stars) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of stars) {
    const pulse = 0.45 + (Math.sin(time * s.twinkle + s.phase) * 0.5 + 0.5) * 0.55;
    const px = (s.x + Math.sin(time * 0.035 * s.parallax + s.phase) * 3.5 * s.parallax + width) % width;
    const py = (s.y + Math.cos(time * 0.028 * s.parallax + s.phase) * 2.5 * s.parallax + height) % height;
    const alpha = Math.min(1, pulse * (0.55 + s.r * 0.18));

    if (s.glow) {
      const halo = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4.5);
      halo.addColorStop(0, starColor(s.temp, alpha * 0.35));
      halo.addColorStop(0.4, starColor(s.temp, alpha * 0.1));
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, s.r * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = starColor(s.temp, alpha);
    ctx.beginPath();
    ctx.arc(px, py, s.r, 0, Math.PI * 2);
    ctx.fill();

    if (s.spike) {
      drawStarSpike(ctx, px, py, s.r * 7 + 6, alpha * 0.35);
    }
  }
  ctx.restore();
}

function drawPlanet(ctx, width, height, time) {
  const x = width * 0.8;
  const y = height * 0.17;
  const r = Math.min(width, height) * 0.075;

  // Atmospheric glow
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 4.8);
  glow.addColorStop(0, "rgba(150, 185, 255, 0.32)");
  glow.addColorStop(0.35, "rgba(70, 95, 190, 0.1)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 4.8, 0, Math.PI * 2);
  ctx.fill();

  // Back half of rings (behind planet)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.38 + Math.sin(time * 0.1) * 0.02);
  ctx.scale(1, 0.26);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.85, Math.PI, Math.PI * 2);
  ctx.strokeStyle = "rgba(170, 185, 240, 0.22)";
  ctx.lineWidth = r * 0.16;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.15, Math.PI, Math.PI * 2);
  ctx.strokeStyle = "rgba(140, 160, 230, 0.12)";
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
  ctx.restore();

  // Planet body with terminator
  const body = ctx.createRadialGradient(x - r * 0.4, y - r * 0.35, r * 0.08, x + r * 0.15, y + r * 0.1, r * 1.15);
  body.addColorStop(0, "#e8efff");
  body.addColorStop(0.25, "#a8b8ef");
  body.addColorStop(0.55, "#5a6bb8");
  body.addColorStop(0.82, "#243068");
  body.addColorStop(1, "#0c1235");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Subtle cloud bands
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 5; i += 1) {
    const by = y - r * 0.55 + i * r * 0.28;
    const band = ctx.createLinearGradient(x - r, by, x + r, by);
    band.addColorStop(0, "transparent");
    band.addColorStop(0.5, `rgba(255, 255, 255, ${0.04 + (i % 2) * 0.03})`);
    band.addColorStop(1, "transparent");
    ctx.fillStyle = band;
    ctx.fillRect(x - r, by - r * 0.04, r * 2, r * 0.08);
  }
  // Limb darkening / atmosphere rim
  const rim = ctx.createRadialGradient(x, y, r * 0.72, x, y, r);
  rim.addColorStop(0, "transparent");
  rim.addColorStop(1, "rgba(180, 210, 255, 0.22)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Front half of rings
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.38 + Math.sin(time * 0.1) * 0.02);
  ctx.scale(1, 0.26);
  const ringGrad = ctx.createLinearGradient(-r * 2.3, 0, r * 2.3, 0);
  ringGrad.addColorStop(0, "transparent");
  ringGrad.addColorStop(0.2, "rgba(190, 205, 255, 0.15)");
  ringGrad.addColorStop(0.5, "rgba(220, 230, 255, 0.42)");
  ringGrad.addColorStop(0.8, "rgba(190, 205, 255, 0.15)");
  ringGrad.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.85, 0, Math.PI);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = r * 0.18;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.15, 0, Math.PI);
  ctx.strokeStyle = "rgba(150, 170, 240, 0.16)";
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
  // Cassini-like gap hint
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.98, 0, Math.PI);
  ctx.strokeStyle = "rgba(8, 8, 24, 0.35)";
  ctx.lineWidth = r * 0.04;
  ctx.stroke();
  ctx.restore();
}

function drawShootingStar(ctx, width, height, time) {
  const cycle = (time * 0.12) % 11;
  if (cycle > 0.7) return;
  const t = cycle / 0.7;
  const sx = width * (0.08 + t * 0.62);
  const sy = height * (0.1 + t * 0.2);
  const fade = Math.sin(t * Math.PI);
  const trail = ctx.createLinearGradient(sx - 70, sy - 32, sx, sy);
  trail.addColorStop(0, "transparent");
  trail.addColorStop(0.7, `rgba(200, 220, 255, ${0.25 * fade})`);
  trail.addColorStop(1, `rgba(255, 255, 255, ${0.85 * fade})`);
  ctx.strokeStyle = trail;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 72, sy - 34);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
  ctx.beginPath();
  ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
  ctx.fill();
  const head = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
  head.addColorStop(0, `rgba(220, 235, 255, ${0.45 * fade})`);
  head.addColorStop(1, "transparent");
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(sx, sy, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawVignette(ctx, width, height) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    Math.min(width, height) * 0.18,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.82,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.65, "rgba(2, 2, 12, 0.18)");
  vignette.addColorStop(1, "rgba(1, 1, 8, 0.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawScene(ctx, width, height, time, stars, dust, staticLayer) {
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, width, height);
  } else {
    drawDeepField(ctx, width, height);
    drawNebulae(ctx, width, height, time, false);
    drawMilkyWay(ctx, width, height, 0);
    drawDistantGalaxy(ctx, width, height, 0);
  }
  drawBreathingNebula(ctx, width, height, time);
  drawStars(ctx, width, height, time, stars);
  drawPlanet(ctx, width, height, time);

  for (const d of dust) {
    d.y -= d.speed;
    d.x += d.drift + Math.sin(time * 0.35 + d.phase) * 0.1;
    if (d.y < -8) { d.y = height + 8; d.x = Math.random() * width; }
    if (d.x < -8) d.x = width + 4;
    if (d.x > width + 8) d.x = -4;
    ctx.fillStyle = `rgba(190, 205, 255, ${d.alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShootingStar(ctx, width, height, time);
  drawVignette(ctx, width, height);
}

export function GalaxyAtmosphere({ variant = "frame" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const starsRef = useRef([]);
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
      const starCount = variant === "stage" ? 380 : 300;
      const dustCount = variant === "stage" ? 42 : 32;
      starsRef.current = createStars(starCount, width, height);
      dustRef.current = createDust(dustCount, width, height);
      staticRef.current = buildStaticLayer(width, height);
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
        starsRef.current,
        reduced ? [] : dustRef.current,
        staticRef.current,
      );
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
    <div ref={wrapRef} className={`galaxy-atmosphere galaxy-atmosphere--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="galaxy-atmosphere__canvas" />
    </div>
  );
}

export function GalaxyThemePreview() {
  return (
    <div className="galaxy-preview" aria-hidden="true">
      <div className="galaxy-preview__sky" />
      <div className="galaxy-preview__nebula galaxy-preview__nebula--a" />
      <div className="galaxy-preview__nebula galaxy-preview__nebula--b" />
      <div className="galaxy-preview__nebula galaxy-preview__nebula--c" />
      <div className="galaxy-preview__band" />
      <div className="galaxy-preview__dust" />
      <div className="galaxy-preview__stars" />
      <div className="galaxy-preview__galaxy" />
      <div className="galaxy-preview__planet">
        <span className="galaxy-preview__planet-ring galaxy-preview__planet-ring--back" />
        <span className="galaxy-preview__planet-disc" />
        <span className="galaxy-preview__planet-ring galaxy-preview__planet-ring--front" />
      </div>
      <span className="galaxy-preview__shoot" />
    </div>
  );
}
