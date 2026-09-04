import React, { useEffect, useRef } from "react";
import {
  yozakuraMoonPosition,
  yozakuraMotionBudget,
  yozakuraTreeAnchors,
  yozakuraTreeUnit,
} from "../../lib/theme/yozakuraScene.js";

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** Générateur déterministe : la scène est identique à chaque rendu. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TAU = Math.PI * 2;

const BARK = {
  near: { deep: "#100a0f", mid: "#241620", lite: "#4e3541", shadow: "rgba(0,0,0,0.35)" },
  far: { deep: "#1a1219", mid: "#2a1c26", lite: "#3a2832", shadow: "rgba(0,0,0,0.2)" },
};

function mix(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/* ───────────── Ciel ───────────── */

function drawSky(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#040309");
  sky.addColorStop(0.28, "#0b0812");
  sky.addColorStop(0.58, "#150f1a");
  sky.addColorStop(0.82, "#1d1420");
  sky.addColorStop(1, "#261828");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Lueur d'horizon (lanternes de hanami au loin)
  const horizon = ctx.createLinearGradient(0, h * 0.55, 0, h);
  horizon.addColorStop(0, "rgba(150, 70, 110, 0)");
  horizon.addColorStop(0.7, "rgba(150, 70, 110, 0.12)");
  horizon.addColorStop(1, "rgba(190, 100, 130, 0.26)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // Résidu de crépuscule en haut à gauche
  const dusk = ctx.createRadialGradient(w * 0.12, h * 0.04, 0, w * 0.12, h * 0.04, w * 0.75);
  dusk.addColorStop(0, "rgba(120, 45, 80, 0.26)");
  dusk.addColorStop(0.45, "rgba(80, 30, 60, 0.08)");
  dusk.addColorStop(1, "transparent");
  ctx.fillStyle = dusk;
  ctx.fillRect(0, 0, w, h);
}

function drawMilkyWay(ctx, w, h, rng) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.32);
  ctx.rotate(-0.62);
  const bandH = h * 0.26;
  const band = ctx.createLinearGradient(0, -bandH, 0, bandH);
  band.addColorStop(0, "rgba(180, 150, 200, 0)");
  band.addColorStop(0.3, "rgba(190, 160, 210, 0.05)");
  band.addColorStop(0.47, "rgba(225, 200, 230, 0.11)");
  band.addColorStop(0.53, "rgba(225, 200, 230, 0.11)");
  band.addColorStop(0.7, "rgba(190, 160, 210, 0.05)");
  band.addColorStop(1, "rgba(180, 150, 200, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(-w * 1.6, -bandH, w * 3.2, bandH * 2);

  // Nuages de poussière sombres dans la bande
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 6; i += 1) {
    const x = (rng() - 0.5) * w * 2.2;
    const y = (rng() - 0.5) * bandH * 0.6;
    const rx = w * (0.08 + rng() * 0.14);
    const ry = bandH * (0.1 + rng() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, "rgba(40, 20, 45, 0.22)");
    g.addColorStop(0.6, "rgba(40, 20, 45, 0.1)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = "lighter";

  // Poussière d'étoiles dense le long de la bande
  for (let i = 0; i < 520; i += 1) {
    const x = (rng() - 0.5) * w * 2.4;
    const gauss = (rng() + rng() + rng() - 1.5) / 1.5;
    const y = gauss * bandH * 0.8;
    const a = 0.08 + rng() * 0.3;
    const r = 0.25 + rng() * 0.55;
    ctx.fillStyle = `rgba(240, 225, 245, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Grain fin qui casse le banding des dégradés sombres. */
function drawGrain(ctx, w, h, rng) {
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + rng() * 64;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawStaticStars(ctx, w, h, rng, count) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i += 1) {
    const x = rng() * w;
    // Densité plus forte en haut du ciel
    const y = Math.pow(rng(), 1.6) * h * 0.78;
    const mag = rng();
    const r = 0.25 + mag * mag * 1.1;
    const a = 0.18 + mag * 0.5;
    const temp = rng();
    const color = temp > 0.86
      ? `rgba(255, 214, 190, ${a})`
      : temp > 0.7
        ? `rgba(200, 215, 255, ${a})`
        : `rgba(245, 240, 250, ${a})`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────── Lune ───────────── */

function moonPosition(w, h, variant) {
  return yozakuraMoonPosition(w, h, variant);
}

function drawMoon(ctx, moon, rng) {
  const { x, y, r } = moon;

  // Halo atmosphérique large, teinté par les fleurs
  const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 8);
  glow.addColorStop(0, "rgba(255, 240, 244, 0.32)");
  glow.addColorStop(0.12, "rgba(255, 222, 234, 0.16)");
  glow.addColorStop(0.35, "rgba(220, 150, 185, 0.07)");
  glow.addColorStop(0.7, "rgba(160, 90, 130, 0.025)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 8, 0, TAU);
  ctx.fill();

  // Disque avec assombrissement du limbe
  const body = ctx.createRadialGradient(x - r * 0.22, y - r * 0.24, r * 0.05, x, y, r);
  body.addColorStop(0, "#fffdf9");
  body.addColorStop(0.5, "#f6efe9");
  body.addColorStop(0.82, "#ddd0cc");
  body.addColorStop(1, "#a99ba3");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();

  // Mers lunaires : taches sombres irrégulières
  const maria = [
    [-0.28, -0.32, 0.34, 0.26, 0.16],
    [0.12, -0.18, 0.3, 0.22, 0.14],
    [0.32, 0.12, 0.22, 0.18, 0.12],
    [-0.1, 0.22, 0.26, 0.2, 0.13],
    [-0.42, 0.1, 0.16, 0.14, 0.1],
    [0.05, 0.5, 0.18, 0.12, 0.09],
  ];
  for (const [ox, oy, rx, ry, a] of maria) {
    const mx = x + ox * r;
    const my = y + oy * r;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(rng() * TAU);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * rx);
    g.addColorStop(0, `rgba(120, 100, 118, ${a})`);
    g.addColorStop(0.6, `rgba(130, 110, 128, ${a * 0.6})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Cratères : petit disque sombre + bord clair côté lumière
  for (let i = 0; i < 14; i += 1) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r * 0.9;
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    const cr = r * (0.025 + rng() * 0.06);
    ctx.fillStyle = `rgba(110, 92, 108, ${0.1 + rng() * 0.12})`;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 252, 248, 0.22)";
    ctx.lineWidth = Math.max(0.4, cr * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.restore();
}

/* ───────────── Branches (croissance fractale) ───────────── */

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

function growBranch(rng, x, y, angle, length, width, depth, tree) {
  const segs = 5 + Math.floor(rng() * 4);
  const pts = [[x, y]];
  let a = angle;
  let cx = x;
  let cy = y;
  const step = length / segs;

  for (let i = 0; i < segs; i += 1) {
    // Courbure naturelle + léger affaissement vers le bas en bout de branche
    a += (rng() - 0.5) * 0.5 + (depth === 0 ? 0.04 : 0.015);
    cx += Math.cos(a) * step;
    cy += Math.sin(a) * step;
    pts.push([cx, cy]);

    if (depth > 0 && i >= 1 && rng() < 0.62) {
      const side = rng() < 0.5 ? -1 : 1;
      growBranch(
        rng,
        cx,
        cy,
        a + side * (0.45 + rng() * 0.7),
        length * (0.42 + rng() * 0.28),
        width * (0.5 + rng() * 0.12),
        depth - 1,
        tree,
      );
    }

    // Grappes de fleurs sur les rameaux fins
    if (depth <= 1 && i >= segs - 3 && rng() < 0.8) {
      tree.blooms.push({
        x: cx + (rng() - 0.5) * step * 0.4,
        y: cy + (rng() - 0.5) * step * 0.4,
        size: (depth === 0 ? 1 : 0.85) * (0.8 + rng() * 0.5),
        seed: Math.floor(rng() * 1e6),
      });
    }
  }

  tree.branches.push({ pts, w0: width, w1: Math.max(0.6, width * 0.3), depth });

  if (depth === 0 && rng() < 0.9) {
    tree.blooms.push({ x: cx, y: cy, size: 1.05 + rng() * 0.4, seed: Math.floor(rng() * 1e6) });
  }
}

function drawBranch(ctx, branch, bark, moon, rng) {
  const { pts, w0, w1 } = branch;
  const steps = Math.max(12, pts.length * 7);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let prev = sampleCurve(pts, 0);

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const p = sampleCurve(pts, t);
    const rough = 1 + (rng() - 0.5) * 0.18;
    const w = mix(w0, w1, t) * rough;

    // Ombre portée légère côté opposé à la lune
    const dx = moon.x - p[0];
    const dy = moon.y - p[1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;

    ctx.strokeStyle = bark.shadow;
    ctx.lineWidth = w * 1.25;
    ctx.beginPath();
    ctx.moveTo(prev[0] - nx * w * 0.35, prev[1] - ny * w * 0.35);
    ctx.lineTo(p[0] - nx * w * 0.35, p[1] - ny * w * 0.35);
    ctx.stroke();

    ctx.strokeStyle = bark.deep;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();

    ctx.strokeStyle = bark.mid;
    ctx.lineWidth = Math.max(0.5, w * 0.55);
    ctx.beginPath();
    ctx.moveTo(prev[0] + nx * w * 0.12, prev[1] + ny * w * 0.12);
    ctx.lineTo(p[0] + nx * w * 0.12, p[1] + ny * w * 0.12);
    ctx.stroke();

    // Reflet lunaire fin sur l'arête éclairée
    ctx.strokeStyle = bark.lite;
    ctx.lineWidth = Math.max(0.35, w * 0.2);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(prev[0] + nx * w * 0.3, prev[1] + ny * w * 0.3);
    ctx.lineTo(p[0] + nx * w * 0.3, p[1] + ny * w * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    prev = p;
  }
}

/* ───────────── Fleurs ───────────── */

function petalPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.58, -s * 0.12, s * 0.66, -s * 0.72, s * 0.22, -s * 1.02);
  ctx.lineTo(0, -s * 0.84);
  ctx.lineTo(-s * 0.22, -s * 1.02);
  ctx.bezierCurveTo(-s * 0.66, -s * 0.72, -s * 0.58, -s * 0.12, 0, 0);
  ctx.closePath();
}

function petalColors(lit) {
  const l = clamp01(lit);
  const base = [mix(150, 235, l), mix(95, 175, l), mix(120, 195, l)];
  const tip = [mix(200, 255, l), mix(150, 242, l), mix(170, 246, l)];
  return {
    base: `rgb(${base[0] | 0}, ${base[1] | 0}, ${base[2] | 0})`,
    tip: `rgb(${tip[0] | 0}, ${tip[1] | 0}, ${tip[2] | 0})`,
  };
}

function drawFlower(ctx, x, y, s, rot, lit) {
  const colors = petalColors(lit);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.rotate((i / 5) * TAU);
    const g = ctx.createLinearGradient(0, 0, 0, -s);
    g.addColorStop(0, colors.base);
    g.addColorStop(0.55, colors.tip);
    g.addColorStop(1, colors.tip);
    ctx.fillStyle = g;
    petalPath(ctx, s);
    ctx.fill();
    // Nervure centrale
    ctx.strokeStyle = `rgba(255, 250, 252, ${0.18 + lit * 0.25})`;
    ctx.lineWidth = Math.max(0.3, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.15);
    ctx.lineTo(0, -s * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  // Cœur : base rougeâtre + étamines
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.3);
  core.addColorStop(0, `rgba(200, 70, 95, ${0.55 + lit * 0.3})`);
  core.addColorStop(1, "transparent");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.3, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 236, 200, ${0.3 + lit * 0.4})`;
  ctx.lineWidth = Math.max(0.25, s * 0.035);
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TAU + 0.3;
    const len = s * (0.22 + (i % 3) * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 224, 170, ${0.5 + lit * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * len, Math.sin(a) * len, s * 0.045, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBud(ctx, x, y, s, lit) {
  const g = ctx.createRadialGradient(x - s * 0.2, y - s * 0.2, 0, x, y, s);
  g.addColorStop(0, `rgba(${mix(190, 240, lit) | 0}, ${mix(110, 160, lit) | 0}, ${mix(140, 190, lit) | 0}, 0.95)`);
  g.addColorStop(1, `rgba(${mix(110, 160, lit) | 0}, ${mix(55, 80, lit) | 0}, ${mix(80, 110, lit) | 0}, 0.9)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.7, s, 0.4, 0, TAU);
  ctx.fill();
}

function drawCluster(ctx, bloom, scale, moon, layer, w, h) {
  const rng = makeRng(bloom.seed);
  const baseSize = bloom.size * scale * (layer === "far" ? 5.2 : 8.2);
  const dist = Math.hypot(bloom.x - moon.x, bloom.y - moon.y);
  const diag = Math.hypot(w, h) * 0.85;
  const litBase = clamp01(0.42 + 0.58 * (1 - dist / diag)) * (layer === "far" ? 0.55 : 1);

  // Halo de floraison nocturne
  if (layer !== "far" && litBase > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, baseSize * 2.6);
    halo.addColorStop(0, `rgba(255, 190, 212, ${0.14 * litBase})`);
    halo.addColorStop(0.5, `rgba(220, 120, 160, ${0.05 * litBase})`);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(bloom.x, bloom.y, baseSize * 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const count = 3 + Math.floor(rng() * 4);
  const flowers = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng() * TAU;
    const d = rng() * baseSize * 0.85;
    flowers.push({
      x: bloom.x + Math.cos(a) * d,
      y: bloom.y + Math.sin(a) * d,
      s: baseSize * (0.5 + rng() * 0.5),
      rot: rng() * TAU,
    });
  }

  // Pédoncules : fines tiges reliant chaque fleur au rameau
  ctx.strokeStyle = layer === "far" ? "rgba(46, 30, 40, 0.7)" : "rgba(38, 22, 32, 0.9)";
  ctx.lineWidth = Math.max(0.5, baseSize * 0.07);
  ctx.lineCap = "round";
  for (const f of flowers) {
    ctx.beginPath();
    ctx.moveTo(bloom.x, bloom.y);
    ctx.quadraticCurveTo(
      (bloom.x + f.x) * 0.5 + (rng() - 0.5) * baseSize * 0.3,
      (bloom.y + f.y) * 0.5 + (rng() - 0.5) * baseSize * 0.3,
      f.x,
      f.y,
    );
    ctx.stroke();
  }

  for (const f of flowers) {
    const lit = clamp01(litBase * (0.72 + rng() * 0.38) - (f.y > bloom.y ? 0.08 : 0));
    drawFlower(ctx, f.x, f.y, f.s, f.rot, lit);
  }

  const buds = Math.floor(rng() * 3);
  for (let i = 0; i < buds; i += 1) {
    const a = rng() * TAU;
    const d = baseSize * (0.6 + rng() * 0.5);
    drawBud(ctx, bloom.x + Math.cos(a) * d, bloom.y + Math.sin(a) * d, baseSize * 0.22, litBase);
  }
}

function buildTree(rng, w, h, anchors, unit = yozakuraTreeUnit(w, h)) {
  const tree = { branches: [], blooms: [] };
  for (const a of anchors) {
    growBranch(rng, a.x * w, a.y * h, a.angle, a.len * unit, a.w * (unit / 420), a.depth ?? 2, tree);
  }
  // Les grosses branches d'abord pour que les rameaux passent devant
  tree.branches.sort((p, q) => q.w0 - p.w0);
  return tree;
}

function drawTreeLayer(ctx, tree, w, h, moon, layer, rng, unit = yozakuraTreeUnit(w, h)) {
  const scale = unit / 420;
  const bark = BARK[layer];
  for (const branch of tree.branches) {
    drawBranch(ctx, branch, bark, moon, rng);
  }
  for (const bloom of tree.blooms) {
    drawCluster(ctx, bloom, scale, moon, layer, w, h);
  }
}

/* ───────────── Éléments dynamiques ───────────── */

function createPetals(rng, count, w, h) {
  return Array.from({ length: count }, (_, i) => {
    const layer = i % 3; // 0 = proche, 2 = lointain
    return {
      x: rng() * w,
      y: rng() * h,
      size: (layer === 0 ? 7 : layer === 1 ? 5 : 3.4) * (0.7 + rng() * 0.6),
      rot: rng() * TAU,
      spin: (rng() - 0.5) * 1.6,
      speed: (layer === 0 ? 0.85 : layer === 1 ? 0.6 : 0.4) * (0.7 + rng() * 0.6),
      drift: (rng() - 0.5) * 0.5,
      sway: 0.6 + rng() * 1.4,
      flutter: 1.2 + rng() * 2.2,
      phase: rng() * TAU,
      lit: 0.55 + rng() * 0.45,
      alpha: layer === 2 ? 0.35 + rng() * 0.25 : 0.7 + rng() * 0.3,
      layer,
    };
  });
}

function createBokehPetals(rng, count, w, h) {
  return Array.from({ length: count }, () => ({
    x: rng() * w,
    y: rng() * h,
    r: 4 + rng() * 7,
    speed: 0.22 + rng() * 0.25,
    drift: (rng() - 0.5) * 0.3,
    phase: rng() * TAU,
    alpha: 0.08 + rng() * 0.12,
  }));
}

function createTwinkleStars(rng, count, w, h) {
  return Array.from({ length: count }, () => {
    const mag = rng();
    return {
      x: rng() * w,
      y: Math.pow(rng(), 1.4) * h * 0.7,
      r: 0.7 + mag * mag * 1.7,
      twinkle: 0.5 + rng() * 2.2,
      phase: rng() * TAU,
      warm: rng() > 0.8,
      cool: rng() > 0.72,
    };
  });
}

function createMist(rng, w, h) {
  const layers = [];
  for (let l = 0; l < 3; l += 1) {
    const blobs = [];
    const count = 7 + l * 2;
    for (let i = 0; i < count; i += 1) {
      blobs.push({
        x: rng() * w * 1.4 - w * 0.2,
        y: h * (0.66 + l * 0.11) + (rng() - 0.5) * h * 0.06,
        rx: w * (0.14 + rng() * 0.2),
        ry: h * (0.035 + rng() * 0.03),
        a: 0.045 + rng() * 0.05 + l * 0.015,
        speed: (0.06 + rng() * 0.08) * (l === 1 ? -1 : 1),
      });
    }
    layers.push(blobs);
  }
  return layers;
}

function createLanterns(rng, count, w, h) {
  return Array.from({ length: count }, () => ({
    x: rng() * w,
    y: h * (0.74 + rng() * 0.2),
    r: 5 + rng() * 9,
    phase: rng() * TAU,
    flicker: 1.5 + rng() * 3,
    a: 0.08 + rng() * 0.1,
  }));
}

function windAt(time) {
  return Math.sin(time * 0.11) * 0.8 + Math.sin(time * 0.31 + 1.3) * 0.45 + Math.sin(time * 0.73) * 0.15;
}

function drawTwinkleStars(ctx, stars, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of stars) {
    const pulse = 0.45 + (Math.sin(time * s.twinkle + s.phase) * 0.5 + 0.5) * 0.55;
    const color = s.warm
      ? `rgba(255, 216, 190, ${pulse * 0.8})`
      : s.cool
        ? `rgba(205, 220, 255, ${pulse * 0.85})`
        : `rgba(250, 245, 250, ${pulse * 0.9})`;
    if (s.r > 1.5) {
      const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
      halo.addColorStop(0, color);
      halo.addColorStop(0.35, color.replace(/[\d.]+\)$/, `${pulse * 0.18})`));
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 5, 0, TAU);
      ctx.fill();
      // Scintillement en croix
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${pulse * 0.3})`);
      ctx.lineWidth = 0.6;
      const len = s.r * 4 * pulse;
      ctx.beginPath();
      ctx.moveTo(s.x - len, s.y);
      ctx.lineTo(s.x + len, s.y);
      ctx.moveTo(s.x, s.y - len);
      ctx.lineTo(s.x, s.y + len);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMeteor(ctx, meteor) {
  if (!meteor.active) return;
  const t = meteor.life;
  const x = meteor.x + meteor.vx * t;
  const y = meteor.y + meteor.vy * t;
  const fade = Math.sin(Math.min(1, t / meteor.duration) * Math.PI);
  const len = 70;
  const d = Math.hypot(meteor.vx, meteor.vy) || 1;
  const tx = x - (meteor.vx / d) * len;
  const ty = y - (meteor.vy / d) * len;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(tx, ty, x, y);
  g.addColorStop(0, "transparent");
  g.addColorStop(1, `rgba(255, 245, 250, ${0.75 * fade})`);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function drawMist(ctx, mist, w, h, time) {
  ctx.save();
  for (const blobs of mist) {
    for (const b of blobs) {
      let x = b.x + time * b.speed * 18;
      const span = w * 1.4;
      x = ((((x + w * 0.2) % span) + span) % span) - w * 0.2;
      const y = b.y + Math.sin(time * 0.12 + b.x * 0.01) * 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, b.ry / b.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
      g.addColorStop(0, `rgba(165, 90, 130, ${b.a})`);
      g.addColorStop(0.55, `rgba(120, 60, 100, ${b.a * 0.55})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, b.rx, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  // Voile de brume au sol
  const ground = ctx.createLinearGradient(0, h * 0.62, 0, h);
  ground.addColorStop(0, "transparent");
  ground.addColorStop(0.6, "rgba(40, 18, 34, 0.22)");
  ground.addColorStop(1, "rgba(18, 8, 16, 0.5)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.restore();
}

function drawLanterns(ctx, lanterns, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const l of lanterns) {
    const a = l.a * (0.75 + Math.sin(time * l.flicker + l.phase) * 0.25);
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, `rgba(255, 200, 140, ${a})`);
    g.addColorStop(0.5, `rgba(255, 160, 120, ${a * 0.45})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBokehPetals(ctx, petals, w, h, time, wind) {
  ctx.save();
  for (const p of petals) {
    p.y += p.speed;
    p.x += p.drift + wind * 0.35 + Math.sin(time * 0.5 + p.phase) * 0.2;
    if (p.y > h + 20) {
      p.y = -20;
      p.x = Math.random() * w;
    }
    if (p.x < -20) p.x = w + 10;
    if (p.x > w + 20) p.x = -10;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, `rgba(255, 205, 222, ${p.alpha})`);
    g.addColorStop(0.7, `rgba(240, 170, 195, ${p.alpha * 0.5})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawFallingPetal(ctx, p, time) {
  const flutter = Math.cos(time * p.flutter + p.phase);
  const squash = 0.28 + 0.72 * Math.abs(flutter);
  const colors = petalColors(p.lit * (0.75 + 0.25 * Math.abs(flutter)));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(squash, 1);
  ctx.globalAlpha = p.alpha;

  if (p.layer === 0) {
    const glow = ctx.createRadialGradient(0, -p.size * 0.5, 0, 0, -p.size * 0.5, p.size * 1.5);
    glow.addColorStop(0, "rgba(255, 205, 222, 0.22)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -p.size * 0.5, p.size * 1.5, 0, TAU);
    ctx.fill();
  }

  const g = ctx.createLinearGradient(0, 0, 0, -p.size);
  g.addColorStop(0, colors.base);
  g.addColorStop(0.6, colors.tip);
  g.addColorStop(1, colors.tip);
  ctx.fillStyle = g;
  petalPath(ctx, p.size);
  ctx.fill();

  // Face ombrée quand le pétale se retourne
  if (flutter < 0) {
    ctx.fillStyle = `rgba(90, 40, 65, ${0.28 * Math.min(1, -flutter)})`;
    petalPath(ctx, p.size);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 250, 252, 0.35)";
  ctx.lineWidth = Math.max(0.3, p.size * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -p.size * 0.12);
  ctx.lineTo(0, -p.size * 0.7);
  ctx.stroke();
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.4, h * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(0.65, "rgba(6, 3, 8, 0.18)");
  vignette.addColorStop(1, "rgba(3, 1, 5, 0.6)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/* ───────────── Assemblage ───────────── */

function isNativeAppShell() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("native-app");
}

function buildStaticLayer(w, h, variant) {
  const canvas = document.createElement("canvas");
  const native = isNativeAppShell();
  const saveData = Boolean(navigator.connection?.saveData);
  const budget = yozakuraMotionBudget({
    w,
    h,
    variant,
    native,
    saveData,
    devicePixelRatio: window.devicePixelRatio || 1,
  });
  const dpr = budget.dpr;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const rng = makeRng(20240407);
  const moon = moonPosition(w, h, variant);
  const supportsFilter = typeof ctx.filter === "string";
  const unit = yozakuraTreeUnit(w, h);
  const anchors = yozakuraTreeAnchors(w, h);

  drawSky(ctx, w, h);
  drawGrain(ctx, w, h, rng);
  drawMilkyWay(ctx, w, h, rng);
  drawStaticStars(ctx, w, h, rng, budget.staticStars);
  drawMoon(ctx, moon, rng);

  if (budget.farTrees) {
    const farTree = buildTree(makeRng(777), w, h, anchors.far, unit);
    ctx.save();
    if (supportsFilter) ctx.filter = "blur(1.6px)";
    ctx.globalAlpha = 0.62;
    drawTreeLayer(ctx, farTree, w, h, moon, "far", makeRng(778), unit);
    ctx.restore();
  }

  const nearTree = buildTree(makeRng(4242), w, h, anchors.near, unit);
  drawTreeLayer(ctx, nearTree, w, h, moon, "near", makeRng(4243), unit);

  // Lumière lunaire diffuse sur la canopée
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const shimmer = ctx.createRadialGradient(moon.x, moon.y, 0, w * 0.55, h * 0.3, w * 0.6);
  shimmer.addColorStop(0, "rgba(255, 230, 240, 0.07)");
  shimmer.addColorStop(1, "transparent");
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, w, h * 0.6);
  ctx.restore();

  return canvas;
}

function drawScene(ctx, state, time) {
  const { w, h, staticLayer, variant, petals, bokeh, stars, mist, lanterns, meteor } = state;

  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, w, h);
  } else {
    drawSky(ctx, w, h);
    drawMoon(ctx, moonPosition(w, h, variant), makeRng(1));
  }

  drawTwinkleStars(ctx, stars, time);
  drawMeteor(ctx, meteor);
  drawLanterns(ctx, lanterns, time);
  drawMist(ctx, mist, w, h, time);

  const wind = windAt(time);
  drawBokehPetals(ctx, bokeh, w, h, time, wind);

  // Pétales lointains d'abord, proches ensuite
  for (let layer = 2; layer >= 0; layer -= 1) {
    for (const p of petals) {
      if (p.layer !== layer) continue;
      const depth = 1 + p.layer * 0.35;
      const flutter = Math.cos(time * p.flutter + p.phase);
      p.y += (p.speed * (0.7 + 0.5 * Math.abs(flutter))) / depth;
      p.x += (p.drift + wind * 1.2 + Math.sin(time * p.sway + p.phase) * 0.55) / depth;
      p.rot += p.spin * 0.02 + wind * 0.004;
      if (p.y > h + 30) {
        p.y = -30;
        p.x = Math.random() * w;
      }
      if (p.x < -30) p.x = w + 15;
      if (p.x > w + 30) p.x = -15;
      drawFallingPetal(ctx, p, time);
    }
  }

  drawVignette(ctx, w, h);
}

function updateMeteor(meteor, dt, w, h) {
  if (meteor.active) {
    meteor.life += dt;
    if (meteor.life >= meteor.duration) {
      meteor.active = false;
      meteor.next = 16 + Math.random() * 30;
    }
    return;
  }
  meteor.next -= dt;
  if (meteor.next <= 0) {
    meteor.active = true;
    meteor.life = 0;
    meteor.duration = 0.7 + Math.random() * 0.5;
    meteor.x = w * (0.1 + Math.random() * 0.8);
    meteor.y = h * (0.04 + Math.random() * 0.25);
    const angle = Math.PI * (0.62 + Math.random() * 0.22);
    const speed = 380 + Math.random() * 220;
    meteor.vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1);
    meteor.vy = Math.abs(Math.sin(angle)) * speed * 0.55;
  }
}

export function YozakuraNight({ variant = "frame" }) {
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
    let last = start;
    const state = {
      w: 1,
      h: 1,
      variant,
      staticLayer: null,
      petals: [],
      bokeh: [],
      stars: [],
      mist: [],
      lanterns: [],
      meteor: { active: false, next: 12 + Math.random() * 20, life: 0, duration: 1, x: 0, y: 0, vx: 0, vy: 0 },
    };
    let staticBuildToken = 0;

    const scheduleStaticLayer = (width, height) => {
      const token = ++staticBuildToken;
      state.staticLayer = null;
      const build = () => {
        if (!running || token !== staticBuildToken) return;
        state.staticLayer = buildStaticLayer(width, height, variant);
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(build);
      });
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      let width = Math.max(1, Math.floor(rect.width));
      let height = Math.max(1, Math.floor(rect.height));
      if (width < 8 || height < 8) {
        const parent = wrap.parentElement;
        width = Math.max(1, parent?.clientWidth || window.innerWidth);
        height = Math.max(1, parent?.clientHeight || window.innerHeight);
      }
      const saveData = Boolean(navigator.connection?.saveData);
      const native = isNativeAppShell();
      const budget = yozakuraMotionBudget({
        w: width,
        h: height,
        variant,
        native,
        saveData,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
      const dpr = budget.dpr;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rng = makeRng(Math.floor(width * 31 + height * 17));
      state.w = width;
      state.h = height;
      state.petals = createPetals(rng, budget.petals, width, height);
      state.bokeh = createBokehPetals(rng, budget.bokeh, width, height);
      state.stars = createTwinkleStars(rng, budget.twinkles, width, height);
      state.mist = createMist(rng, width, height);
      state.lanterns = createLanterns(rng, budget.lanterns, width, height);
      scheduleStaticLayer(width, height);
    };

    resize();

    const paint = (now) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = reduced ? 0 : (now - start) / 1000;
      if (!reduced) updateMeteor(state.meteor, dt, state.w, state.h);
      drawScene(ctx, reduced ? { ...state, petals: [], bokeh: [], meteor: { active: false } } : state, time);
      if (!reduced) raf = requestAnimationFrame(paint);
    };

    const onResize = () => {
      resize();
      if (reduced) paint(performance.now());
    };

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = prefersReducedMotion();
      cancelAnimationFrame(raf);
      last = performance.now();
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
