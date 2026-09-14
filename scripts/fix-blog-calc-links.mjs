#!/usr/bin/env node
// ──────────────────────────────────────────────
// 블로그 글 138편에 박혀 있던 "계산기" CTA 링크를 일괄 수리하는 스크립트.
//
// [문제]
// 본문 중간 CTA(예: **[얼마드나 무료 견적 계산기](https://ulmadna.com)**)가 전부
// 홈(https://ulmadna.com)으로만 가게 박혀 있었다. 계산기 화면이 아니라 그냥 메인
// 페이지로 떨어지니, "제목 클릭 → 계산기까지 한 번에" 전환이 끊긴다.
//
// [하는 일]
// content/blog/*.md 를 하나씩 열어서:
//   1) 앵커 텍스트에 "계산기"가 들어있고 주소가 https://ulmadna.com (경로 없는 홈)인
//      마크다운 링크만 찾는다 — 다른 링크(내부 글 링크 등)는 절대 안 건드림.
//   2) 그 글의 제목·태그를 src/lib/blog-calculators.ts의 detectCalculator와 같은
//      규칙(키워드 매칭)으로 판정해서 도배 글이면 /calc/wallpaper, 바닥재 글이면
//      /calc/flooring, 둘 다 걸리면(또는 둘 다 아니면) 허브 /calc로 주소만 바꾼다.
//   3) 프런트매터(---로 감싼 윗부분)는 원문 그대로 건드리지 않는다. 본문(body)만 손댄다.
//
// [사용법]
//   node scripts/fix-blog-calc-links.mjs --dry-run   → 바뀔 목록만 미리 보기(파일 수정 안 함)
//   node scripts/fix-blog-calc-links.mjs             → 실제로 파일에 적용
//
// ⚠️ src/lib/blog-calculators.ts를 직접 import하지 않고 같은 키워드 규칙을 그대로
//    복제해서 썼다(이 스크립트는 일반 node로 돌리는 .mjs라 TS 파일을 바로 못 불러온다).
//    저 파일의 키워드 목록이 바뀌면 이 스크립트도 같이 고쳐야 한다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const DRY_RUN = process.argv.includes("--dry-run");

// src/lib/blog-calculators.ts의 CALCULATORS.keywords를 그대로 복제(2026-09-11 기준)
const CALCULATORS = {
  wallpaper: {
    keywords: ["도배", "벽지", "실크", "합지", "디아망"],
    href: "https://ulmadna.com/calc/wallpaper",
  },
  flooring: {
    keywords: ["바닥재", "마루", "강마루", "강화마루", "장판", "데코타일", "LVT", "헤링본", "원목마루"],
    href: "https://ulmadna.com/calc/flooring",
  },
};
const HUB_HREF = "https://ulmadna.com/calc";

/**
 * src/lib/blog-calculators.ts의 detectCalculator를 그대로 복제.
 * 프런트매터 calculator 값(override)이 있으면 그걸 최우선, 없으면 제목+태그 키워드로 자동 판정.
 * @returns {"wallpaper"|"flooring"}[] — 매치되는 계산기 전부(없으면 빈 배열)
 */
function detectCalculator(title, tags, override) {
  if (typeof override === "string") {
    if (override === "none") return [];
    if (Object.prototype.hasOwnProperty.call(CALCULATORS, override)) return [override];
    // "none"도 아니고 유효한 키도 아니면(오타 등) → 자동 판정으로 넘어감
  } else if (Array.isArray(override)) {
    return override.filter((k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(CALCULATORS, k));
  }
  // "수도 배관"이 "도배"로 오탐되는 걸 막음(사이트 코드와 동일 규칙)
  const hay = [title, ...tags].join(" ").toLowerCase().replace(/수도\s*배관/g, " ");
  const matched = [];
  for (const [key, info] of Object.entries(CALCULATORS)) {
    if (info.keywords.some((k) => hay.includes(k.toLowerCase()))) matched.push(key);
  }
  return matched;
}

/** 판정된 계산기 키 목록 → 실제로 CTA 링크에 넣을 주소 하나 */
function pickTargetUrl(matched) {
  if (matched.length === 1) return CALCULATORS[matched[0]].href;
  // 0개(도배·바닥재 둘 다 아님) 또는 2개(둘 다 걸림) → 허브로
  return HUB_HREF;
}

// 앵커 텍스트에 "계산기"·"계산해보기"·"계산하기"·"견적 계산"이 들어있고, 주소가 경로 없는
// 홈(https://ulmadna.com 또는 끝에 / 하나)인 마크다운 링크만 찾는다. 다른 페이지로 가는
// 링크(예: /blog/xxx)는 이 정규식에 아예 안 걸림.
// 2026-09-14 검사관 지적: "계산기"만 찾으면 "👉 무료 샷시·인테리어 견적 계산해보기"처럼
// 동사형 CTA(계산기라는 명사가 없는 문구)를 놓친다 → 키워드 목록을 넓혔다.
const CTA_LINK_RE = /\[([^\]]*(?:계산기|계산해보기|계산하기|견적\s*계산)[^\]]*)\]\(https:\/\/ulmadna\.com\/?\)/g;

/** 파일 하나에서 프런트매터(---...---) 블록과 본문을 분리 — 프런트매터는 원문 그대로 보존 */
function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const fmBlock = m ? m[0] : "";
  return { fmBlock, body: raw.slice(fmBlock.length) };
}

function main() {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  const changes = []; // { file, before, after }[] — 앵커별 변경 내역(보고용)

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data } = matter(raw); // 프런트매터만 읽는 용도(본문 재구성엔 안 씀)
    const title = data.title ?? "";
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const matched = detectCalculator(title, tags, data.calculator);
    const targetUrl = pickTargetUrl(matched);

    const { fmBlock, body } = splitFrontmatter(raw);
    if (!CTA_LINK_RE.test(body)) continue; // 이 글엔 고칠 CTA 링크가 없음
    CTA_LINK_RE.lastIndex = 0; // test()가 옮겨놓은 커서 되돌리기(g 플래그 정규식 재사용 주의)

    let fileChanged = false;
    const newBody = body.replace(CTA_LINK_RE, (fullMatch, anchorText) => {
      const replaced = `[${anchorText}](${targetUrl})`;
      if (replaced !== fullMatch) {
        fileChanged = true;
        changes.push({ file, before: fullMatch, after: replaced });
      }
      return replaced;
    });

    if (fileChanged && !DRY_RUN) {
      fs.writeFileSync(filePath, fmBlock + newBody, "utf8");
    }
  }

  const byFile = new Set(changes.map((c) => c.file));
  console.log(`${DRY_RUN ? "[dry-run] " : ""}변경 파일 ${byFile.size}개 · 링크 ${changes.length}건`);
  console.log("");
  console.log("예시 5건:");
  for (const c of changes.slice(0, 5)) {
    console.log(`- ${c.file}`);
    console.log(`  전: ${c.before}`);
    console.log(`  후: ${c.after}`);
  }
}

main();
