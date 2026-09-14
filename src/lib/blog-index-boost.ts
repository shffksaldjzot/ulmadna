// ──────────────────────────────────────────────
// 색인 우선 목록 — 구글에 아직 안 잡힌(또는 훑고도 안 실린) 글을
// 사이트 안에서 일부러 더 자주 보여주기 위한 목록
//
// [왜 필요한가]
// 구글 서치콘솔에서 "발견됨 - 현재 색인이 생성되지 않음"(구글이 존재는 알지만 아직 안 훑음)
// 또는 "크롤링됨 - 현재 색인이 생성되지 않음"(훑긴 했지만 검색 결과엔 안 실음) 상태인 글은,
// 사이트 안에서 이 글로 들어오는 링크(내부 링크)가 적어서 구글이 "덜 중요한 페이지"로
// 보는 경우가 많습니다. 그래서 ①인기 글의 "관련 글" 슬롯 일부, ②홈/블로그 목록의
// 작은 로테이션 배너에 이 목록의 글을 우선 배치해서 내부 링크를 인위적으로 더 붙여줍니다.
//
// [출처] 구글 서치콘솔 URL 검사(urlInspection.index.inspect)로 사이트맵의 183개 URL을
// 전수 조회한 결과, 2026년 09월 14일 확인. 아래 세 상태였던 블로그 글만 담았습니다
// (카테고리 허브는 8장 중 prep 1장만 미색인이라 이 배열엔 안 넣고 별도로 챙김,
//  정적 페이지·계산기 페이지는 전부 "Submitted and indexed"라 제외):
//  · crawled  = "Crawled - currently not indexed"   (구글이 훑었지만 검색엔 안 실음, 6편)
//  · unknown  = "URL is unknown to Google"           (구글이 존재 자체를 모름, 15편)
//  · discovered = "Discovered - currently not indexed" (존재는 알지만 아직 안 훑음, 20편)
// 상태별로 급한 정도가 달라 배열 안에서 순서도 crawled → unknown → discovered로 뒀습니다
// (로테이션 앞쪽일수록 더 자주 노출되게, pickIndexBoostRotation은 순서를 그대로 씀).
//
// [유지보수] 시간이 지나 색인되면(서치콘솔에서 "색인 생성됨"으로 바뀌면) 이 배열에서
// 빼주세요. 계속 남아 있어도 사이트가 깨지진 않지만, 이미 색인된 글까지 우대할 필요는
// 없어서 목록이 오래될수록 효과가 흐려집니다.
// ──────────────────────────────────────────────

export const INDEX_BOOST_SLUGS: string[] = [
  // 크롤링됨 - 현재 색인이 생성되지 않음 (6편 — 구글이 이미 훑고도 뺀 글이라 가장 급함)
  "bathroom-grout-vs-retile-cost",
  "diamant-kitchen-pet-color",
  "lighting-replacement-cost",
  "plumbing-cost",
  "system-aircon-1way-vs-4way-indoor-unit",
  "system-aircon-old-apartment-retrofit-cost",
  // 구글에 알려지지 않음 (15편 — 존재 자체를 모르니 내부 링크로 찾아가게 해야 함)
  "59-type-interior-cost",
  "bathroom-tile-construction-process-timeline",
  "curtain-blind-cleaning-cost",
  "induction-dedicated-line-cost",
  "movein-schedule-delay-buffer-cost",
  "smart-curtain-blind",
  "smart-doorlock-guide",
  "smart-heating-boiler",
  "smart-lighting-guide",
  "smart-switch-neutral-wire",
  "smarthome-app-ecosystem",
  "smarthome-during-renovation",
  "smarthome-guide-hub",
  "smarthome-hub-wireless-guide",
  "tile-type-size-price-comparison",
  // 발견됨 - 현재 색인이 생성되지 않음 (20편 — 이미 크롤 대기열엔 들어간 상태)
  "acquisition-tax-card-payment",
  "bathroom-tile-overlay-vs-demolition-cost",
  "construction-order-mistakes-rework-cost",
  "curtain-box-vs-rail-cost",
  "custom-vs-readymade-curtain-cost",
  "diamant-alternative-wallpaper",
  "diamant-wallpaper-color",
  "diamant-wallpaper-flooring-match",
  "electrical-work-without-interior",
  "interior-construction-notice-etiquette",
  "interior-cost-difference",
  "interior-film-brand-grade-price",
  "outlet-add-embedded-vs-exposed-cost",
  "partial-jangpan-repair-cost",
  "system-aircon-electricity-bill",
  "system-aircon-vs-wall-aircon-cost",
  "tile-selection-guide",
  "tv-wall-mount-wall-type-cost",
  "window-construction-period",
  "window-replacement-cost",
];

/** 이 슬러그가 색인 우선 목록에 있는지 */
export function isIndexBoosted(slug: string): boolean {
  return INDEX_BOOST_SLUGS.includes(slug);
}

/**
 * 날짜 기반 로테이션 — 목록 중 count개를 골라 돌려줍니다.
 * Math.random을 안 쓰는 이유: 이 사이트는 정적 생성(SSG)이라 랜덤을 쓰면
 * "빌드 시점의 우연"으로 고정돼 버립니다. 대신 "오늘 날짜"를 시드로 써서
 * 하루 단위로는 같은 결과, 날짜가 바뀌면(=다시 빌드하면) 다른 조합이 나오게 합니다.
 */
export function pickIndexBoostRotation<T extends { slug: string }>(
  candidates: T[],
  count = 4
): T[] {
  const pool = candidates.filter((p) => INDEX_BOOST_SLUGS.includes(p.slug));
  if (pool.length === 0) return [];
  const dayIndex = Math.floor(Date.now() / 86400000); // 1970년부터 며칠째인지
  const start = dayIndex % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, Math.min(count, rotated.length));
}
