// 구글 애드센스 설정 — 게시자 ID + 광고단위 슬롯
// 슬롯ID는 AdSense 대시보드 → 광고 → 광고 단위별 → '디스플레이 광고' 만들면 나옴(숫자).
// 비어있으면 해당 위치 광고 안 뜸(안전). 받으면 여기 채우면 즉시 게재.
export const ADSENSE_CLIENT = "ca-pub-9736248258361709";

export const ADSENSE_SLOTS: Record<string, string> = {
  blogInArticle: "3703296078", // 블로그 글 본문 (인아티클 fluid)
  blogList: "4721853953",      // 블로그 목록 하단 (멀티플렉스 autorelaxed)
  // ── v1 계산기 광고 슬롯 (AdSense 디스플레이 광고단위 슬롯ID) ──
  "AD-H": "3177672140", // 히어로 하단 (헤더 광고, 가로형 디스플레이)
  "AD-R": "", // 결과부 사이드 (세로/정사각 광고단위 만들면 채우기)
  "AD-F": "", // 하단 푸터 영역
  "AD-P": "", // 공정별 사이
};
