/**
 * 실제 견적서 총액 범위 상수 (결과 화면 "내 결과의 위치" 막대용)
 *
 * 근거: 실제 견적서 판독 집계(2026년 3~10월 견적서, 올수리만) — 02 집계 표 1-1.
 * 작성일: 2026년 10월 28일. 금액 단위 만원, 부가세 별도 기준.
 * 하위25 = 아래에서 25% 지점, 상위25 = 위에서 25% 지점(가운데 절반이 이 사이에 들어옴).
 * 주의: 표본 수·출처 이름은 화면에 공개하지 않는다(외부 표기 규칙). 이 파일 안에서만 기록.
 *   - 20평대 올수리: 83건 / 30평대 올수리: 92건
 */

export interface RealRange {
  /** 구간 이름(내부용) */
  key: '20s' | '30s';
  /** 하위 25% 지점 총액(만원) */
  low: number;
  /** 중앙값(만원) */
  mid: number;
  /** 상위 25% 지점 총액(만원) */
  high: number;
}

export const REAL_RANGES: Record<RealRange['key'], RealRange> = {
  '20s': { key: '20s', low: 3243, mid: 4082, high: 4941 },
  '30s': { key: '30s', low: 4510, mid: 5489, high: 6349 },
};

/** 공급평 → 구간. 20~29평=20평대, 30~39평=30평대, 그 밖은 표시 안 함(null) */
export function pickRealRange(area: number): RealRange | null {
  if (area >= 20 && area < 30) return REAL_RANGES['20s'];
  if (area >= 30 && area < 40) return REAL_RANGES['30s'];
  return null;
}

/** "올수리"로 보는 기준 공정: 이 공정이 모두 켜져 있어야 막대를 보여 준다 */
export const FULL_REMODEL_PROCESS_IDS = ['demolition', 'wallpaper', 'flooring', 'bathroom', 'kitchen'];
