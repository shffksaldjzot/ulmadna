// ──────────────────────────────────────────────
// 블로그 글 → 공정 그룹 판정 (공정 스폰서 광고 AD-P 매칭용)
//
// [무슨 기능인가]
//   글 하나를 보고 "이 글은 홈 계산기의 어느 공정 묶음(도배·바닥, 욕실 …) 글인가"를 하나로 정한다.
//   정해진 공정 이름(라벨)은 글 화면의 공정 스폰서 광고 자리(AD-P)에 넘겨져,
//   그 공정 광고주 배너와 짝지어진다. 공정을 못 정한 글에는 AD-P 자리를 아예 그리지 않는다.
//
// [판정 순서] — 위에서 걸리면 거기서 끝
//   1) 머리말 `sponsor:` 값 — 사람이 직접 덮어쓴다. 라벨 글자 그대로(예: "도배·바닥") 또는 "none"(없음).
//      라벨 표에 없는 글자(오타 등)는 무시하고 다음 단계로 넘어간다.
//   2) 머리말 `calculator:` 값 — 글에 붙은 계산기 종류로 공정을 정한다(배열이면 첫 번째 유효한 값).
//   3) 제목·태그 신호 단어 표 — 공정 묶음마다 10개 안팎. 제목에 걸리면 3점, 태그에 걸리면 1점씩 더해
//      점수가 가장 높은 묶음을 고른다. 같은 점수면 제목에서 더 앞에 나온 묶음, 그다음은 표 순서.
//   4) 공정 묶음이 안 걸린 글 중 인테리어 총론 글(예산·견적·계약·평형별 비용 …)은 "토탈"(total=true).
//      토탈 글 본문 중간에는 공정 스폰서 대신 토탈 인테리어 스폰서(AD-T) 자리가 들어간다(2026-10-29).
//      단 커튼·블라인드·취득세·선반·TV 벽걸이처럼 총론이 아닌 글은 제외 단어 표로 걸러 계속 없음.
//   5) 그래도 아니면 없음(null).
//
// 작성일: 2026년 10월 29일 (토탈 판정 추가 2026년 10월 29일)
// ──────────────────────────────────────────────

/**
 * 홈 계산기 공정 묶음 라벨 13개.
 * ⚠️ src/components/calculator/inputs/ProcessToggles.tsx 의 PROCESS_GROUPS 라벨과 글자가 정확히 같아야 한다
 *    (광고주는 이 라벨로 매칭된다). 저 파일은 내보내지 않는 상수라 여기 그대로 옮겨 적었고,
 *    두 곳이 어긋나면 시험(blog-process.test.ts)이 실패하도록 묶어 두었다.
 */
export const PROCESS_LABELS = [
  "철거",
  "확장·설비",
  "전기·조명",
  "에어컨",
  "목공",
  "창호",
  "도배·바닥",
  "도장·필름",
  "타일",
  "욕실",
  "주방",
  "가구",
  "부대비용",
] as const;

/** 공정 묶음 라벨 하나 */
export type ProcessLabel = (typeof PROCESS_LABELS)[number];

/** 판정 근거 — 관리자 표에서 "왜 이 공정이 됐나"를 보여 주는 데 쓴다 */
export type ProcessBasis = "sponsor" | "calculator" | "keyword" | "total" | "none";

/** 판정 결과 */
export interface ProcessDecision {
  /** 공정 라벨(없으면 null → AD-P 자리를 안 그린다) */
  process: ProcessLabel | null;
  /** 어느 단계에서 정해졌나 */
  basis: ProcessBasis;
  /**
   * 토탈 인테리어 총론 글인가(true 일 때만 붙는다, process 는 null).
   * 글 화면은 이 값이 true 면 본문 중간에 AD-P 대신 토탈 인테리어 스폰서(AD-T) 자리를 그린다.
   */
  total?: boolean;
}

/** 머리말 sponsor: 로 토탈을 직접 지정할 때 쓰는 값 */
export const SPONSOR_TOTAL = "total";

/**
 * 토탈 판정 — 인테리어 총론 신호 단어(제목·태그 어디든 하나라도 걸리면 후보).
 * 공정 묶음이 정해지지 않은 글에만 쓴다.
 */
export const TOTAL_KEYWORDS = ["인테리어", "리모델링", "올수리", "턴키", "반셀프", "준공검수", "하자점검"];

/**
 * 토탈 제외 단어 — 제목에 있으면 총론이 아니라 따로 노는 품목·세금 글이라 없음으로 둔다.
 *  (커튼·블라인드 글이 "인테리어" 태그 때문에 토탈로 끌려가는 것을 막는다)
 */
export const TOTAL_EXCLUDE = ["커튼", "블라인드", "취득세", "선반", "벽걸이", "tv", "나노코팅", "원상복구"];

/** 공정이 안 정해진 글이 인테리어 총론(토탈) 글인지 — 제외 단어(제목) 먼저, 그다음 총론 단어(제목·태그) */
export function isTotalPost(title: string, tags: string[]): boolean {
  const t = title.toLowerCase();
  if (TOTAL_EXCLUDE.some((k) => t.includes(k))) return false;
  const hay = [t, ...tags.map((x) => String(x).toLowerCase())];
  return TOTAL_KEYWORDS.some((k) => hay.some((h) => h.includes(k)));
}

/**
 * 계산기 종류 → 공정 라벨
 *  - wallpaper(도배), flooring(바닥재) → "도배·바닥" (홈에서 한 묶음)
 *  - tile → "타일" (홈에 타일 묶음이 따로 있다)
 *  - mortar(레미탈·방통 몰탈) → "확장·설비"
 *    판단 근거: 홈에 "미장" 묶음이 없다. 몰탈 계산기를 단 글은 발코니 확장·바닥 방통(난방 배관 뒤 미장)이
 *    중심이고, 이 일은 홈의 확장(expansion)·설비(plumbing) 공정에 딸려 들어간다.
 *    욕실·타일 글에 붙은 몰탈은 보통 tile 이 먼저 적혀 있어 "타일"로 간다(배열이면 첫 값 우선).
 */
const CALC_TO_PROCESS: Record<string, ProcessLabel> = {
  wallpaper: "도배·바닥",
  flooring: "도배·바닥",
  tile: "타일",
  mortar: "확장·설비",
};

/**
 * 공정 묶음별 신호 단어(제목·태그에서 찾는다, 대소문자 무시).
 * ⚠️ 너무 넓은 말은 넣지 않는다 — "천장"(천장형 제습기·천장 도배까지 목공으로 끌림),
 *    "베란다"·"발코니"(탄성코트·줄눈 글이 확장으로 끌림), "문"(창문·현관문 구분 불가) 등.
 */
export const PROCESS_KEYWORDS: Record<ProcessLabel, string[]> = {
  철거: ["철거", "폐기물", "올철거", "철거비", "해체"],
  "확장·설비": ["확장", "보일러", "난방", "배관", "설비", "단열", "결로", "분배기", "누수", "수도", "방통"],
  "전기·조명": ["전기", "콘센트", "차단기", "분전반", "조명", "스위치", "배선", "전용선", "접지", "실링팬", "누전", "간접등"],
  에어컨: ["에어컨", "시스템에어컨", "냉난방기", "제습기", "실외기", "에어컨 배관"],
  목공: ["목공", "몰딩", "걸레받이", "아트월", "가벽", "중문", "도어", "문틀", "방문", "우물천장", "평탄화", "현관문"],
  창호: ["창호", "샷시", "샤시", "이중창", "시스템창", "방충망", "단열필름", "창문", "유리"],
  "도배·바닥": ["도배", "벽지", "실크", "합지", "디아망", "바닥재", "마루", "장판", "데코타일", "lvt", "헤링본", "차음재", "층간소음"],
  "도장·필름": ["도장", "페인트", "필름", "시트지", "탄성코트", "우레탄"],
  타일: ["타일", "줄눈", "그라우트", "포세린", "케라폭시", "폴리우레아"],
  욕실: ["욕실", "화장실", "욕조", "수전", "세면대", "변기", "환풍기", "ubr", "젠다이", "샤워"],
  주방: ["주방", "싱크대", "상판", "인덕션", "식기세척기", "음식물처리기", "후드", "가스레인지", "아일랜드"],
  가구: ["붙박이장", "냉장고장", "드레스룸", "시스템장", "책장", "신발장", "수납장", "키큰장", "옷장", "가구"],
  부대비용: ["입주청소", "준공청소", "보양", "관리사무소", "공사 안내문", "주민동의서", "동의서"],
};

/** 문자열이 13개 라벨 중 하나인지 */
export function isProcessLabel(v: unknown): v is ProcessLabel {
  return typeof v === "string" && (PROCESS_LABELS as readonly string[]).includes(v);
}

/** 신호 단어 검사용으로 글자를 다듬는다(소문자 + "수도배관"이 "도배"로 잡히는 사고 방지) */
function norm(s: string): string {
  return s.toLowerCase().replace(/수도\s*배관/g, "수도 _ 배관");
}

/**
 * 제목·태그 신호 단어로 공정을 고른다(판정 3단계). 못 고르면 null.
 *  - 제목에 걸린 신호 단어 하나당 3점, 태그 하나에 걸린 신호 단어 하나당 1점
 *  - 동점이면 제목에서 먼저 나온 묶음 → 그래도 같으면 PROCESS_LABELS 순서
 *  - 제목에 안 걸리고 태그 점수도 3점 미만인 묶음은 후보에서 뺀다(총론 글 오판 방지)
 */
export function detectProcessByKeywords(title: string, tags: string[]): ProcessLabel | null {
  const t = norm(title);
  const tagList = tags.map((x) => norm(String(x)));
  let best: { label: ProcessLabel; score: number; pos: number; order: number } | null = null;
  PROCESS_LABELS.forEach((label, order) => {
    let score = 0;
    let pos = Infinity; // 제목에서 이 묶음 신호 단어가 처음 나온 위치
    for (const kw of PROCESS_KEYWORDS[label]) {
      const k = kw.toLowerCase();
      const at = t.indexOf(k);
      if (at >= 0) {
        score += 3;
        pos = Math.min(pos, at);
      }
      for (const tag of tagList) if (tag.includes(k)) score += 1;
    }
    if (score === 0) return;
    // 제목에 하나도 안 걸리고 태그에서만 조금(3점 미만) 걸린 묶음은 버린다
    //  — "인테리어 추가비용"처럼 총론 글이 태그 한두 개 때문에 엉뚱한 공정으로 가는 것을 막는다
    if (pos === Infinity && score < 3) return;
    // 점수 높은 쪽 → 제목에서 앞선 쪽 → 표 순서(order 작은 쪽, forEach 순서상 먼저 온 것이 유지됨)
    if (!best || score > best.score || (score === best.score && pos < best.pos)) {
      best = { label, score, pos, order };
    }
  });
  return best ? (best as { label: ProcessLabel }).label : null;
}

/**
 * 글 하나의 공정을 정한다(위 판정 순서 1→4).
 * @param title 글 제목
 * @param tags 글 태그
 * @param sponsor 머리말 `sponsor:` 값(없으면 undefined)
 * @param calculator 머리말 `calculator:` 값(문자열·배열·없음)
 */
export function detectPostProcess(
  title: string,
  tags: string[],
  sponsor?: unknown,
  calculator?: unknown,
): ProcessDecision {
  // 1) 사람이 적은 sponsor 값이 최우선 — "none"이면 없음으로 확정
  if (typeof sponsor === "string") {
    const s = sponsor.trim();
    if (s === "none") return { process: null, basis: "sponsor" };
    // sponsor: total → 토탈 인테리어 스폰서 글로 확정
    if (s === SPONSOR_TOTAL) return { process: null, basis: "sponsor", total: true };
    if (isProcessLabel(s)) return { process: s, basis: "sponsor" };
    // 표에 없는 글자(오타 등)는 무시하고 다음 단계로
  }

  // 2) 머리말 calculator 값 — 문자열 하나 또는 배열의 첫 번째 유효한 값("none"은 건너뜀)
  const calcList = typeof calculator === "string" ? [calculator] : Array.isArray(calculator) ? calculator : [];
  for (const c of calcList) {
    if (typeof c === "string" && Object.prototype.hasOwnProperty.call(CALC_TO_PROCESS, c)) {
      return { process: CALC_TO_PROCESS[c], basis: "calculator" };
    }
  }

  // 3) 제목·태그 신호 단어
  const byKw = detectProcessByKeywords(title, tags);
  if (byKw) return { process: byKw, basis: "keyword" };

  // 4) 인테리어 총론 글이면 토탈
  if (isTotalPost(title, tags)) return { process: null, basis: "total", total: true };

  // 5) 없음
  return { process: null, basis: "none" };
}

// ──────────────────────────────────────────────
// 본문을 "첫 소제목(h2) 뒤"에서 둘로 나누기 — 그 사이에 AD-P 광고 자리를 끼운다
// ──────────────────────────────────────────────

/**
 * 본문 HTML 을 첫 번째 `</h2>` 바로 뒤에서 [앞, 뒤] 두 덩어리로 나눈다.
 *  - 스포일러 상자(.blog-spoiler) 안에 있는 소제목은 건너뛴다(상자를 반으로 쪼개면 화면이 깨진다).
 *  - 알맞은 소제목이 없으면 null → 나누지 않고 광고 자리도 안 넣는다.
 */
export function splitAfterFirstH2(html: string): [string, string] | null {
  let from = 0;
  for (;;) {
    const at = html.indexOf("</h2>", from);
    if (at < 0) return null;
    const cut = at + "</h2>".length;
    const before = html.slice(0, cut);
    // 열린 스포일러 상자 수와 닫힌 수가 같아야 "상자 밖" (blog-recommend.ts 와 같은 방식)
    const opened = before.split('<div class="blog-spoiler">').length - 1;
    const closed = before.split("</label></div>").length - 1;
    if (opened === closed) return [before, html.slice(cut)];
    from = cut;
  }
}
