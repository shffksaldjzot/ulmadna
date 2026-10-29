// 블로그 글 → 공정 판정(blog-process.ts) 시험 — 2026년 10월 29일
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESS_LABELS, detectPostProcess, splitAfterFirstH2 } from "./blog-process";

describe("detectPostProcess — 판정 순서", () => {
  it("1) sponsor 라벨이 있으면 무엇보다 먼저 쓴다", () => {
    const r = detectPostProcess("도배 비용 — 합지 vs 실크", ["도배 비용"], "욕실", "wallpaper");
    expect(r).toEqual({ process: "욕실", basis: "sponsor" });
  });

  it("1) sponsor: none 이면 키워드가 있어도 없음", () => {
    const r = detectPostProcess("도배 비용", ["도배"], "none");
    expect(r).toEqual({ process: null, basis: "sponsor" });
  });

  it("1) sponsor 오타는 무시하고 다음 단계로", () => {
    const r = detectPostProcess("도배 비용", [], "도배");
    expect(r).toEqual({ process: "도배·바닥", basis: "keyword" });
  });

  it("2) calculator 배열은 첫 번째 유효한 값 — [tile, mortar] → 타일", () => {
    const r = detectPostProcess("욕실 타일 덧방 비용", ["욕실 덧방"], undefined, ["tile", "mortar"]);
    expect(r).toEqual({ process: "타일", basis: "calculator" });
  });

  it("2) calculator mortar → 확장·설비, flooring → 도배·바닥", () => {
    expect(detectPostProcess("발코니 확장 비용", [], undefined, "mortar").process).toBe("확장·설비");
    expect(detectPostProcess("강마루 장판 가격", [], undefined, ["flooring", "mortar"]).process).toBe("도배·바닥");
  });

  it("3) 키워드 — 예시 글들", () => {
    const cases: Array<[string, string[], string]> = [
      ["시스템 에어컨 설치 비용 — 1대·3대·4대 평형별 가격", ["시스템 에어컨"], "에어컨"],
      ["냉장고장 가격 — 양문형·4도어", ["냉장고장 가격", "냉장고장 제작 비용"], "가구"],
      ["싱크대 상판 가격 2026", ["싱크대 상판", "인조대리석"], "주방"],
      ["방충망 교체 비용 2026", ["방충망 교체", "미세방충망"], "창호"],
      ["줄눈 시공 비용 — 욕실·화장실 줄눈", ["줄눈 시공 비용", "케라폭시 줄눈"], "타일"],
      ["탄성코트 곰팡이, 정말 안 생길까 (베란다)", ["탄성코트 곰팡이", "베란다 곰팡이 탄성코트"], "도장·필름"],
      ["공틀도어 가격 — 세트 단가표", ["공틀도어 가격", "방문 교체 가격"], "목공"],
      ["입주청소 비용 — 평형별 실제 가격표", ["입주청소 비용"], "부대비용"],
    ];
    for (const [title, tags, want] of cases) {
      expect(detectPostProcess(title, tags).process, title).toBe(want);
    }
  });

  it("3) 태그 점수가 제목 앞자리보다 우선 — 인덕션 전용선 글은 전기·조명", () => {
    const r = detectPostProcess("인덕션 전용선 설치 비용 — 분전반 차단기 증설", [
      "인덕션 전용선 설치 비용",
      "인덕션 전기공사 비용",
      "분전반 차단기 증설",
    ]);
    expect(r.process).toBe("전기·조명");
  });

  it("3) '수도배관'은 도배로 잡지 않는다", () => {
    expect(detectPostProcess("수도배관 교체 비용", []).process).toBe("확장·설비");
  });

  it("4) 총론 글·커튼 글은 없음", () => {
    expect(detectPostProcess("인테리어 업체 고르는 법", ["인테리어 견적", "34평"])).toEqual({ process: null, basis: "none" });
    expect(detectPostProcess("암막커튼 가격 2026", ["암막커튼 가격"]).process).toBeNull();
  });
});

describe("PROCESS_LABELS — 홈 공정 묶음과 글자 일치", () => {
  it("ProcessToggles.tsx 의 라벨 13개와 같다", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/calculator/inputs/ProcessToggles.tsx"),
      "utf8",
    );
    const block = src.slice(src.indexOf("PROCESS_GROUPS"), src.indexOf("];", src.indexOf("PROCESS_GROUPS")));
    const labels = [...block.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(labels).toEqual([...PROCESS_LABELS]);
  });
});

describe("splitAfterFirstH2 — 첫 소제목 뒤에서 나누기", () => {
  it("첫 </h2> 바로 뒤에서 나눈다", () => {
    const html = '<p>들어가는 말</p><h2 id="h-0">첫째</h2><p>본문</p><h2 id="h-1">둘째</h2>';
    expect(splitAfterFirstH2(html)).toEqual(['<p>들어가는 말</p><h2 id="h-0">첫째</h2>', '<p>본문</p><h2 id="h-1">둘째</h2>']);
  });

  it("스포일러 상자 안 소제목은 건너뛴다", () => {
    const html =
      '<div class="blog-spoiler"><div class="blog-spoiler-inner"><h2 id="h-0">안</h2></div><label>x</label></div>' +
      '<h2 id="h-1">밖</h2><p>뒤</p>';
    const r = splitAfterFirstH2(html);
    expect(r?.[0].endsWith('<h2 id="h-1">밖</h2>')).toBe(true);
    expect(r?.[1]).toBe("<p>뒤</p>");
  });

  it("소제목이 없으면 null", () => {
    expect(splitAfterFirstH2("<p>소제목 없음</p>")).toBeNull();
  });
});
