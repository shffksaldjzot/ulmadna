// 블로그 이미지 도우미 시험 — 실제 public 폴더 그림으로 확인 (2026년 10월 29일)
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { addImgDims, imageSize, smallThumb } from "./blog-image";

// public/blog 안에서 hero.jpg 와 svg 가 있는 글 폴더 하나를 고른다
const dir = path.join(process.cwd(), "public", "blog");
const slugs = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const heroSlug = slugs.find((s) => fs.existsSync(path.join(dir, s, "hero.jpg")));
const svgSlug = slugs.find((s) => fs.existsSync(path.join(dir, s, "cost-chart.svg")));

describe("blog-image", () => {
  it("hero.jpg 크기를 읽는다(가로 1080 안팎)", () => {
    if (!heroSlug) return;
    const s = imageSize(`/blog/${heroSlug}/hero.jpg`);
    expect(s).not.toBeNull();
    expect(s!.width).toBeGreaterThan(300);
    expect(s!.height).toBeGreaterThan(200);
  });

  it("svg 는 viewBox 로 크기를 읽는다", () => {
    if (!svgSlug) return;
    const s = imageSize(`/blog/${svgSlug}/cost-chart.svg`);
    expect(s).not.toBeNull();
    expect(s!.width).toBeGreaterThan(0);
  });

  it("없는 그림·바깥 주소는 null", () => {
    expect(imageSize("/blog/없는글/hero.jpg")).toBeNull();
    expect(imageSize("https://example.com/a.jpg")).toBeNull();
    expect(imageSize("/blog/../../package.json")).toBeNull();
  });

  it("작은 썸네일이 없으면 원래 주소를 돌려준다", () => {
    expect(smallThumb(null)).toBeNull();
    expect(smallThumb("/blog/없는글/hero.jpg")).toBe("/blog/없는글/hero.jpg");
    expect(smallThumb("/blog/a/cover.svg")).toBe("/blog/a/cover.svg");
  });

  it("본문 img 에 width/height·lazy 를 붙이고, 이미 width 가 있으면 그대로 둔다", () => {
    if (!svgSlug) return;
    const out = addImgDims(`<p><img src="/blog/${svgSlug}/cost-chart.svg" alt="표"></p>`);
    expect(out).toMatch(/width="\d+" height="\d+"/);
    expect(out).toContain('loading="lazy"');
    const kept = `<img src="/x.png" width="10">`;
    expect(addImgDims(kept)).toBe(kept);
  });
});
