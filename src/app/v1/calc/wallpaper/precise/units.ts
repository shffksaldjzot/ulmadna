// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 정밀 폼: 화면 표시 단위 변환 (순수 함수 모음)
//
// 이 파일이 하는 일:
//   정밀 폼은 길이를 "항상 m로 저장"하지만, 화면에서는 집사가 고른 단위(m 또는 mm)로
//   보여 줘야 한다. 그 사이를 오가는 변환만 여기 모아 둔다(React 없음 → 테스트하기 쉬움).
//
//   저장값(m)  --toDisplay-->  화면에 보이는 숫자(m 또는 mm)
//   화면 입력값 --toMeters-->  저장값(m)
//
//   단위를 바꿔도 저장값은 그대로고, 화면에 보이는 숫자만 환산돼 보이는 이유가 이것이다.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import { mmToM, mToMm } from '@/lib/v1/wallpaperDefaults';

/** 정밀 폼 화면에서 쓰는 길이 단위 (저장값은 이것과 무관하게 항상 m) */
export type LengthUnit = 'mm' | 'm';

/**
 * 저장값(m) → 화면 입력칸에 보여 줄 숫자.
 * - 값이 비어 있으면(빈 칸·undefined·숫자 아님) 빈 문자열을 돌려준다(NumberField가 빈 칸으로 그린다).
 * - mm로 볼 때는 소수점 첫째 자리까지만 남긴다(2.3m → 2300).
 * - m로 볼 때는 소수점 셋째 자리까지만 남긴다(부동소수 찌꺼기 0.30000000000000004 방지).
 */
export function toDisplay(meters: number | '' | undefined | null, unit: LengthUnit): number | '' {
  // 빈 값은 변환하지 않고 그대로 빈 칸으로 둔다
  if (meters === '' || meters === undefined || meters === null) return '';
  if (!Number.isFinite(meters)) return '';
  if (unit === 'mm') return Math.round(mToMm(meters) * 10) / 10;
  return Math.round(meters * 1000) / 1000;
}

/**
 * 화면 입력칸의 숫자 → 저장값(m).
 * - 빈 칸이면 빈 문자열 그대로(= 값 없음). 상위에서 undefined로 바꿔 상태에 넣는다.
 * - mm로 입력했으면 1000으로 나눈다(2300 → 2.3). 나눈 뒤 부동소수 찌꺼기를 털어 낸다.
 */
export function toMeters(shown: number | '' | undefined | null, unit: LengthUnit): number | '' {
  // 빈 값은 그대로 빈 값
  if (shown === '' || shown === undefined || shown === null) return '';
  if (!Number.isFinite(shown)) return '';
  if (unit === 'mm') return Math.round(mmToM(shown) * 1_000_000) / 1_000_000;
  return Math.round(shown * 1_000_000) / 1_000_000;
}

/**
 * 개구부(문·창)는 항상 cm로 저장한다. 0은 "아직 안 적음"으로 보고 빈 칸으로 그린다.
 * (WallpaperOpening의 w·h가 숫자만 받는 자리라 빈 칸을 0으로 담아 두기 때문)
 */
export function cmToDisplay(cm: number | undefined): number | '' {
  if (cm === undefined || cm === null || !Number.isFinite(cm) || cm === 0) return '';
  return cm;
}

/** 화면 입력칸 → 개구부 저장값(cm). 빈 칸은 0으로 담는다. */
export function displayToCm(shown: number | ''): number {
  if (shown === '' || !Number.isFinite(shown)) return 0;
  return shown;
}

/** 단위에 맞는 높이 입력칸 안내 숫자(placeholder). 기본 천장 높이 2.3m를 단위만 바꿔 보여 준다 */
export function heightPlaceholder(unit: LengthUnit): string {
  return unit === 'mm' ? '2300' : '2.3';
}
