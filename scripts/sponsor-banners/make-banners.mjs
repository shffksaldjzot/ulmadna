// ──────────────────────────────────────────────
// 광고 견본 배너 그림 만들기 — 2026년 10월 30일
//
// [무슨 기능인가]
//   /sponsor 페이지 견본 배너 7장(public/sponsor/banner-ad-*.png)을 가상 업체 이름·전화로 다시 만든다.
//   같은 폴더의 banners.html 을 플레이라이트(크로미움)로 열어 장마다 정확한 픽셀 크기로 캡처한다.
//
// [사용법]  node scripts/sponsor-banners/make-banners.mjs
// [바꾸는 법] 아래 상수만 고치면 된다. 전화는 반드시 010-0 으로 시작(실제 가입자에게 배정되지 않는 번호)
// ──────────────────────────────────────────────
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/** 가상 업체 이름 (그림에 들어감) */
const NAME = '한결도배';
/** 가상 전화번호 — 010-0xxx 블록(미배정 번호) */
const PHONE = '010-0234-5678';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../public/sponsor');
// 플레이라이트는 모이다공구 쪽에 깔려 있는 것을 빌려 쓴다
const require = createRequire('C:/dotori/09_moida09/package.json');
const { chromium } = require('playwright');

/** 만들 그림: 요소 id → 파일 이름 · 최종 픽셀 크기(1배 크기의 2배) */
const JOBS = [
  { id: 'h',   file: 'banner-ad-h.png',    w: 640,  h: 200 },
  { id: 'hpc', file: 'banner-ad-h-pc.png', w: 1456, h: 180 },
  { id: 'r',   file: 'banner-ad-r.png',    w: 600,  h: 500 },
  { id: 'p',   file: 'banner-ad-p.png',    w: 640,  h: 100 },
  { id: 't',   file: 'banner-ad-t.png',    w: 640,  h: 100 },
  { id: 'f',   file: 'banner-ad-f.png',    w: 640,  h: 100 },
  { id: 'fpc', file: 'banner-ad-f-pc.png', w: 1456, h: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'banners.html')).href);
// 상호·전화 채우기
await page.evaluate(([n, p]) => {
  document.querySelectorAll('[data-fill=name]').forEach((e) => (e.textContent = n));
  document.querySelectorAll('[data-fill=phone]').forEach((e) => (e.textContent = p));
}, [NAME, PHONE]);
await page.evaluate(() => document.fonts.ready);
for (const j of JOBS) {
  await page.setViewportSize({ width: j.w, height: j.h });
  // 이 장만 보이게
  await page.evaluate((id) => document.querySelectorAll('.b').forEach((e) => e.classList.toggle('on', e.id === id)), j.id);
  await page.screenshot({ path: path.join(outDir, j.file), clip: { x: 0, y: 0, width: j.w, height: j.h } });
  console.log('만듦', j.file, `${j.w}x${j.h}`);
}
await browser.close();
