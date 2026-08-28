import fs from "fs";

const android = fs.readFileSync("android/app/src/main/assets/public/assets/mangaSourcesPlugin-D_jxTzaZ.js", "utf8");
const dist = fs.readFileSync("dist/assets/mangaSourcesPlugin-BQdJvF-H.js", "utf8");

console.log("Android has public upload fix:", android.includes("public/)?upload"));
console.log("Dist has public upload fix:", dist.includes("public/)?upload"));
console.log("Android has extractAzoraChapterPages:", android.includes("extractAzoraChapterPages"));
console.log("Dist has extractAzoraChapterPages:", dist.includes("extractAzoraChapterPages"));
