export function compassRosePath(cx, cy, rLong, rShort) {
  const points = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    const radius = i % 2 === 0 ? rLong : rShort;
    points.push([
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
    ]);
  }
  return `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`;
}

export function sparklePath(cx, cy, size) {
  return [
    `M ${cx.toFixed(2)} ${(cy - size).toFixed(2)}`,
    `L ${(cx + size * 0.28).toFixed(2)} ${(cy - size * 0.28).toFixed(2)}`,
    `L ${(cx + size).toFixed(2)} ${cy.toFixed(2)}`,
    `L ${(cx + size * 0.28).toFixed(2)} ${(cy + size * 0.28).toFixed(2)}`,
    `L ${cx.toFixed(2)} ${(cy + size).toFixed(2)}`,
    `L ${(cx - size * 0.28).toFixed(2)} ${(cy + size * 0.28).toFixed(2)}`,
    `L ${(cx - size).toFixed(2)} ${cy.toFixed(2)}`,
    `L ${(cx - size * 0.28).toFixed(2)} ${(cy - size * 0.28).toFixed(2)}`,
    "Z",
  ].join(" ");
}
