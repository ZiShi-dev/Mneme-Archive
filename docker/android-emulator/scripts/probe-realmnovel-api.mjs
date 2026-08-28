#!/usr/bin/env node
/** Sonde locale des routes API realmnovel.com (liste fixe, pas du fuzzing). */
const NOVEL = "690f7c85419b78c5ab0ef3d0";
const CH = 51;

const paths = [
  `/api/novels`,
  `/api/novels/${NOVEL}`,
  `/api/novels/${NOVEL}/chapters`,
  `/api/novels/${NOVEL}/chapters/${CH}`,
  `/api/novel/${NOVEL}`,
  `/api/novel/${NOVEL}/chapters`,
  `/api/novel/${NOVEL}/chapter/${CH}`,
  `/api/chapter/${NOVEL}/${CH}`,
  `/api/chapters/${NOVEL}/${CH}`,
  `/api/read/${NOVEL}/${CH}`,
  `/api/content/${NOVEL}/${CH}`,
  `/api/v1/novels/${NOVEL}/chapters/${CH}`,
  `/api/app/novel/${NOVEL}/chapter/${CH}`,
  `/api/mobile/novel/${NOVEL}/chapter/${CH}`,
  `/_more/chapters?novelId=${NOVEL}`,
  `/_chapter?novelId=${NOVEL}&chapter=${CH}`,
];

const headers = {
  accept: "application/json",
  "user-agent": "RealmNovel/1.1.8 (Android 11)",
  "x-app-package": "com.realmnovel.novel_app",
};

async function probe(path) {
  const url = `https://realmnovel.com${path}`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    const preview = text.slice(0, 120).replace(/\s+/g, " ");
    const hit = res.status !== 404 || !text.includes("المسار غير موجود");
    if (hit || res.status === 200) {
      console.log(`${res.status} ${path}`);
      console.log(`  ${preview}`);
    }
  } catch (err) {
    console.log(`ERR ${path}: ${err.message}`);
  }
}

for (const path of paths) await probe(path);
console.log("Done.");
