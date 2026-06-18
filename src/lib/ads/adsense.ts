// 구글 애드센스 설정 — 게시자 ID + 광고단위 슬롯
// 슬롯ID는 AdSense 대시보드 → 광고 → 광고 단위별 → '디스플레이 광고' 만들면 나옴(숫자).
// 비어있으면 해당 위치 광고 안 뜸(안전). 받으면 여기 채우면 즉시 게재.
export const ADSENSE_CLIENT = "ca-pub-9736248258361709";

export const ADSENSE_SLOTS = {
  blogInArticle: "", // 블로그 글 본문 하단 배너
  blogList: "",      // 블로그 목록 배너
} as const;
