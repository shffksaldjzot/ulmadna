// ──────────────────────────────────────────────
// 블로그 작은 썸네일 만들기 (빌드 직전에 자동 실행 — package.json "prebuild")
//
// 왜: 목록 카드(약 350px)·관련 글(약 94px)에 1080px 원본(hero.jpg, 평균 약 110KB)을 그대로
//     내려보내고 있었다. 각 글 폴더에 가로 480px webp(약 12KB)를 하나 더 만들어 둔다.
// 어떻게:
//  - public/blog/<글>/hero.jpg 마다 같은 폴더에 thumb.webp 를 만든다.
//  - 이미 있고 원본보다 새것이면 건너뛴다(두 번째부터는 금방 끝남).
//  - 어떤 이유로든 실패해도 빌드는 멈추지 않는다(화면은 thumb.webp 가 없으면 원본을 씀 —
//    src/lib/blog-image.ts smallThumb).
//
// 손으로 돌릴 때: node scripts/gen-blog-thumbs.mjs
// 작성일: 2026년 10월 29일 (폴리싱 묶음 C)
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";

const WIDTH = 480; // 썸네일 가로 픽셀
const QUALITY = 72; // webp 화질(0~100)

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("[thumbs] sharp 없음 — 건너뜀(원본 이미지로 표시됨)");
    return;
  }
  const dir = path.join(process.cwd(), "public", "blog");
  if (!fs.existsSync(dir)) return;
  let made = 0;
  let skipped = 0;
  for (const slug of fs.readdirSync(dir)) {
    const src = path.join(dir, slug, "hero.jpg");
    const out = path.join(dir, slug, "thumb.webp");
    try {
      if (!fs.existsSync(src)) continue;
      // 이미 만들어져 있고 원본보다 새것이면 다시 안 만듦
      if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
        skipped++;
        continue;
      }
      await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
      made++;
    } catch (e) {
      console.log(`[thumbs] ${slug} 실패(원본으로 표시됨): ${e?.message ?? e}`);
    }
  }
  console.log(`[thumbs] 새로 만듦 ${made} · 그대로 ${skipped}`);
}

main().catch((e) => {
  // 무슨 일이 있어도 빌드를 막지 않는다
  console.log("[thumbs] 오류 — 건너뜀:", e?.message ?? e);
});
