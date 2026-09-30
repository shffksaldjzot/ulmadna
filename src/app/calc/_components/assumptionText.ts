// ──────────────────────────────────────────────
// v1 허브 — 계산기 3종 공용: 가정 목록(assumed) → 화면 문구
//
// 원래 도배 계산기 전용 파일(wallpaper/assumptionText.ts)이었다. 2026-09-27 지시서 9장
// (바닥재·미장을 새 틀로) 작업 중 세 계산기가 같은 규칙(면적 가정 · 실측 입력 중 표시)을
// 써야 해서 세 계산기가 같이 쓰는 이 자리(_components/)로 옮겼다.
//
// 도배 전용 함수(describeWallpaperBottomBarAssumption·describeWallpaperAreaAssumptionLine)는
// 이름·동작을 그대로 유지한다 — 매개변수 타입만 WallpaperAssumption[]에서 string[]로
// 느슨해졌을 뿐(문자열 배열에 .includes만 쓰므로 동작은 완전히 같다), 도배 화면은 import
// 경로만 바뀌었을 뿐 모습이 하나도 안 바뀐다.
//
// 바닥재는 가정 이름이 도배와 완전히 같다('area'·'product'·'measuring'만 가정 줄에 씀,
// 'bay'·'scope'는 조정 칩이 이미 보여주므로 제외) — 그래서 도배 함수를 그대로 별명
// (alias)만 붙여서 재사용한다.
//
// 미장은 가정 이름이 다르다('area'·'thickness'·'measuring', 제품 개념이 없다) + 면적
// 가정값이 용도(방통/셀프레벨링)에 따라 "34평 가정"/"33㎡ 가정"으로 갈린다 — 그래서
// 미장 전용 함수(describeMortarBottomBarAssumption·describeMortarAreaAssumptionLine)를
// 새로 추가한다.
//
// 작성일: 2026년 09월 27일 (도배 계산기 담당)
// 공용 자리로 이동 + 바닥재 별명·미장 전용 함수 추가: 2026년 09월 27일 (바닥재·미장 2차 작업)
// ──────────────────────────────────────────────

/**
 * 하단 고정 바 전용 — 지시서 3-9절 검수 지적 1번: 하단 바는 자리가 좁으니 'area' 가정이
 * 있을 때 "34평 가정" 하나만 붙이고, 그 외(제품 미정 등)는 하단 바에 안 보여준다(결과
 * 카드에는 이미 다 나와 있다). 가정이 없으면 null(바에 아무것도 안 붙인다).
 *
 * 2026-09-30 지휘관 긴급 전달(가정 표시 통일) — 'measuring'(정확 모드에서 범위 밖 값이
 * 있어 일부를 빼고 계산 중)은 결과 카드(describeWallpaperAreaAssumptionLine)와 똑같이
 * 하단 바에도 "실측 입력 중"을 보여준다 — 예전엔 이 함수가 'area'만 봐서, 방 일부만
 * 빠진 경우(전체 가정은 아니라 'area' 태그가 안 붙음) 하단 바에 아무 표시도 안 됐다.
 * 결과 카드와 같은 우선순위(측정 중이 최우선)를 그대로 맞춘다.
 */
export function describeWallpaperBottomBarAssumption(assumed: readonly string[]): string | null {
  if (assumed.includes('measuring')) return '실측 입력 중';
  return assumed.includes('area') ? '34평 가정' : null;
}

/**
 * 결과 카드 "면적·가정" 한 줄 — 2026-09-27 지휘관 3차 검수 지적 4번: 예전엔 "34평 · 84㎡"
 * (실제 면적 병기)와 "가정 줄"(34평 가정 등)을 따로 두 줄로 그렸는데, area가 가정일 때
 * 둘 다 "34평" 얘기를 하는 게 겹쳐 보였다. 이제 한 줄로 합친다:
 *   - area가 가정이면 → "34평 가정"으로 시작(areaPairText는 안 쓴다 — 실제 값이 아니라
 *     가정값이므로 "34평 · 84㎡"처럼 실측인 척하는 표기를 쓰면 안 된다)
 *   - area를 직접 골랐으면(안 가정) → areaPairText 그대로("34평 · 84㎡")
 *   - 'product'가 가정이면 뒤에 "제품 미정"을 가운뎃점으로 이어 붙인다
 *   - 'measuring'(실측 입력 중)이 섞여 있으면 다른 건 다 무시하고 이것 하나만 단독으로
 * 아무 조각도 없으면(가정도 없고 areaPairText도 없으면, 예: 정확 모드 실측 입력 완료 상태) null.
 *
 * @param areaPairText 간단 모드일 때만 의미 있는 "34평 · 84㎡" 문구(describeAreaPair(form)
 *   결과). 정확 모드 등 뜻이 없으면 null로 넘긴다.
 */
export function describeWallpaperAreaAssumptionLine(
  areaPairText: string | null,
  assumed: readonly string[],
): string | null {
  if (assumed.includes('measuring')) return '실측 입력 중';
  const parts: string[] = [];
  if (assumed.includes('area')) {
    parts.push('34평 가정');
  } else if (areaPairText) {
    parts.push(areaPairText);
  }
  if (assumed.includes('product')) parts.push('제품 미정');
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** 바닥재는 도배와 가정 이름·규칙이 완전히 같아 그대로 별명만 붙여 쓴다 */
export const describeFlooringBottomBarAssumption = describeWallpaperBottomBarAssumption;
export const describeFlooringAreaAssumptionLine = describeWallpaperAreaAssumptionLine;

/**
 * 미장 전용 — 하단 고정 바. 미장은 면적 가정값이 용도에 따라 "34평 가정"(방통)과
 * "33㎡ 가정"(셀프레벨링 등)으로 갈려서, 부르는 쪽(ResultPanel 등)이 그 문구를 직접
 * 계산해 areaAssumedText로 넘긴다(usesSupplyAreaConvention(form)로 이미 알 수 있는 값).
 */
export function describeMortarBottomBarAssumption(
  assumed: readonly string[],
  areaAssumedText: string,
): string | null {
  // 2026-09-30 지휘관 긴급 전달(가정 표시 통일) — 도배·바닥재와 같은 우선순위로 맞춘다
  // ('measuring'이 최우선). 예전엔 이 함수가 'area'만 봐서, 구역 일부만 빼고 계산하는
  // 중(전체 가정은 아님)에는 하단 바에 아무 표시도 안 됐다.
  if (assumed.includes('measuring')) return '실측 입력 중';
  return assumed.includes('area') ? areaAssumedText : null;
}

/**
 * 미장 전용 — 결과 카드 "면적·가정" 한 줄. 도배와 같은 순서 규칙(측정 중 > 면적 > 제품류)을
 * 따르되, 미장은 제품 대신 두께 가정을 추가로 보여준다(9-3절: "화면 가정 줄에는 area·
 * thickness·measuring만 쓴다 — 공법은 조정 칩이 보여 준다").
 *
 * @param areaPairText 방통(공급 평형 규칙) + 간단(area 입력) 모드일 때만 의미 있는
 *   "34평 · 84㎡" 문구(describeAreaPair(state) 결과). 그 외엔 null.
 * @param areaAssumedText 면적이 가정일 때 보여줄 문구 — "34평 가정" 또는 "33㎡ 가정"
 * @param thicknessAssumedText 두께가 가정일 때 보여줄 문구 — 예: "45mm 가정"
 */
export function describeMortarAreaAssumptionLine(
  areaPairText: string | null,
  assumed: readonly string[],
  areaAssumedText: string,
  thicknessAssumedText: string,
): string | null {
  if (assumed.includes('measuring')) return '실측 입력 중';
  const parts: string[] = [];
  if (assumed.includes('area')) {
    parts.push(areaAssumedText);
  } else if (areaPairText) {
    parts.push(areaPairText);
  }
  if (assumed.includes('thickness')) parts.push(thicknessAssumedText);
  return parts.length > 0 ? parts.join(' · ') : null;
}
