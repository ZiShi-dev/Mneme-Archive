#!/usr/bin/env node
/**
 * Extrait les endpoints API depuis libapp.so (Flutter AOT).
 * Usage: node scripts/extract-apk-api.mjs [path-to-libapp.so]
 */
import fs from "node:fs";
import path from "node:path";

const libPath =
  process.argv[2] ||
  path.join(import.meta.dirname, "../apk/extracted-realm-arm64/lib/arm64-v8a/libapp.so");

if (!fs.existsSync(libPath)) {
  console.error("libapp.so introuvable:", libPath);
  process.exit(1);
}

function extractStrings(buf, min = 5) {
  const out = [];
  let cur = "";
  for (let i = 0; i < buf.length; i += 1) {
    const c = buf[i];
    if (c >= 32 && c < 127) cur += String.fromCharCode(c);
    else if (cur.length >= min) {
      out.push(cur);
      cur = "";
    } else cur = "";
  }
  if (cur.length >= min) out.push(cur);
  return out;
}

const strs = extractStrings(fs.readFileSync(libPath));
const urls = [...new Set(strs.filter((s) => /^https?:\/\//.test(s) && s.length < 100))].sort();
const paths = [...new Set(strs.filter((s) => s.startsWith("/") && /^\/[a-z][a-z0-9/_?=&-]*$/i.test(s) && s.length < 100))].sort();
const domains = [...new Set(strs.filter((s) => /^[a-z0-9][a-z0-9.-]+\.(com|app|tech|io)$/i.test(s)))];

console.log("=== URLs ===");
urls.forEach((u) => console.log(u));
console.log("\n=== Domains ===");
domains.forEach((d) => console.log(d));
console.log("\n=== API paths ===");
paths.forEach((p) => console.log(p));
