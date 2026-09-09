// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 폼 상태 → 엔진 요청 변환 (순수 함수 모음)
//
// 왜 따로 파일을 팠나:
//   이 로직(toEngineInput 등)은 원래 useWallpaperCalc.ts(클라이언트 훅) 안에 있었다.
//   그런데 공유 링크 결과 화면(result/page.tsx)은 서버 컴포넌트라서 'use client' 훅 파일을
//   직접 import할 수 없다. 이 파일은 React도, 'use client'도, fetch도 없는 순수 변환
//   함수만 모아 둬서 클라이언트 훅과 서버 결과 페이지 양쪽이 똑같이 가져다 쓸 수 있게 한다.
//   (같은 규칙으로 두 번 계산하지 않으면 즉답 화면과 공유 결과 화면의 금액이 어긋난다)
//
// ⚠️ 이 파일은 src/server/**를 import하지 않는다(단가 유출 금지 규칙과 무관하게 그냥 필요가 없다).
//    서버 계산 입력(WallpaperCalcInput)의 모양을 아래에 그대로 옮겨 적어 둔다 — 실제 서버 타입
//    (src/server/calc/wallpaper.ts)이 바뀌면 이쪽도 같이 확인할 것.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import type { WallpaperFormState, WallpaperProductOption, WallpaperOpening, PreciseRoomInput } from './wallpaperQuery';
import { DEFAULT_CEILING_HEIGHT_M } from './wallpaperDefaults';

/** 평형 직접 입력의 최소값. 이보다 작은 값은 서버가 거부하므로(route.ts min:5) 아예 호출하지 않는다 */
export const MIN_PYEONG = 5;

// ── 서버 요청 모양 (src/server/calc/wallpaper.ts WallpaperCalcInput 중 이 화면들이 실제로 쓰는 칸만) ──

/** 실측 모드에서 방 하나 (서버 RoomInput과 같은 모양) */
export interface WallpaperRoomRequest {
  name: string;
  widthM: number;
  depthM: number;
  heightM?: number;
  doors?: number;
  windows?: { widthCm: number; heightCm: number }[];
}

/** 면적 모드에서 바로 넣는 값 (서버 AreaInput과 같은 모양) */
export interface WallpaperAreasRequest {
  wallSqm?: number;
  ceilingSqm?: number;
  perimeterM?: number;
}

/** 제품 직접 입력 (서버 DirectProduct와 같은 모양) */
export interface WallpaperProductRequest {
  rollPrice: number;
  widthCm: number;
  lengthM: number;
  repeatCm?: number;
  /** 화면 표기용 출처 문구(예: "LX 지인 ○○ · 웹 조사 기준 · 2026.9"). 없으면 서버가 "사용자 직접 입력"으로 표시 */
  sourceLabel?: string;
}

/** 서버 계산 API가 받는 요청 모양 (POST /api/calc/wallpaper 바디 및 calcWallpaper() 입력과 같은 모양) */
export interface WallpaperCalcRequest {
  mode: '평형' | '실측' | '면적';
  pyeong?: number;
  bay?: 2 | 3 | 4;
  rooms?: WallpaperRoomRequest[];
  heightM?: number;
  areas?: WallpaperAreasRequest;
  scope?: '전체' | '거실주방' | string[];
  ceiling?: boolean;
  paperType?: '합지' | '실크';
  product?: WallpaperProductRequest;
  region?: string;
  /** 구축(재도배) 여부. 기본 false(신축·빈집) */
  isOld?: boolean;
}

/** 소수점 반올림 없이 그대로 두되 undefined는 걸러낸다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 방별 실측 목록 중 실제로 계산에 쓸 수 있는(가로·세로 다 채운) 방만 골라낸다 */
function validPreciseRooms(state: WallpaperFormState): PreciseRoomInput[] {
  return (state.preciseRooms ?? []).filter((r) => isPositive(r.w) && isPositive(r.d));
}

/**
 * describePreciseInput()의 반환 모양 — 정밀 폼(방별 실측 / 벽 길이)이 지금 유효한
 * 입력을 갖고 있는지, 있다면 어떤 방식인지. 없으면(둘 다 비었거나 전부 빈 값) null.
 */
export type PreciseInputInfo = { kind: 'room'; count: number } | { kind: 'length' } | null;

/**
 * 정밀 폼이 지금 유효한지 하나로 판정한다.
 * → 시그니처: describePreciseInput(state: WallpaperFormState): PreciseInputInfo
 *   ({ kind: 'room', count: number } | { kind: 'length' } | null)
 *
 * QuickAnswer(평형·베이 칩 잠금 여부)·PreciseSection(펼침 배지)·buildSummary(요약줄)가
 * 전부 이 함수 하나로 판정한다 — 각자 따로 세면 판정이 어긋난다(검사관 지적 N4: 예전엔
 * result/page.tsx의 buildSummary가 빈 방 카드까지 방 개수로 세는 버그가 있었다).
 * toEngineInput도 "방별 실측이 유효한가"를 이 함수와 같은 규칙(validPreciseRooms)으로 판정한다.
 */
export function describePreciseInput(state: WallpaperFormState): PreciseInputInfo {
  if (state.entry === 'room' && state.preciseRooms && state.preciseRooms.length > 0) {
    const count = validPreciseRooms(state).length;
    if (count > 0) return { kind: 'room', count };
  }
  if (state.entry === 'length' && isPositive(state.wallLength)) {
    return { kind: 'length' };
  }
  return null;
}

/**
 * 벽 길이(둘레) 모드 전용 — 문·창 목록의 면적 합을 ㎡로 구한다.
 * 2026-09-09 검사관 지적 수리: 예전엔 문을 표준 규격(0.9×2.1m)으로 고정해서 뺐지만,
 * 사용자가 문 규격을 직접 입력할 수 있는데 그 값을 무시하는 버그였다. 문·창 구분 없이
 * 입력받은 실제 폭·높이(cm)를 m로 바꿔 개수만큼 곱해 합산한다.
 */
export function sumOpeningAreaM2(openings: WallpaperOpening[] | undefined): number {
  if (!openings || openings.length === 0) return 0;
  let total = 0;
  for (const o of openings) {
    total += (o.w / 100) * (o.h / 100) * o.count;
  }
  return total;
}

/**
 * 정밀 폼의 개구부 목록(door/window, 개수 포함)을 엔진이 받는 창 목록으로 편다.
 * 2026-09-09 검사관 지적 수리: 예전엔 문을 엔진의 doors 칸(항상 표준 규격 0.9×2.1m로
 * 차감)에 넣어서, 사용자가 실제 문 규격을 입력해도 계산에 반영되지 않았다.
 * 엔진의 windows[] 차감 산수는 문/창 구분 없이 "폭×높이를 벽 면적에서 뺀다"라서, 문도
 * 창 목록에 실제 규격 그대로 넣고 doors 칸은 항상 0(표준 규격 차감 안 씀)으로 둔다.
 */
function flattenOpenings(openings: WallpaperOpening[]): { widthCm: number; heightCm: number }[] {
  const windows: { widthCm: number; heightCm: number }[] = [];
  for (const o of openings) {
    for (let i = 0; i < o.count; i++) windows.push({ widthCm: o.w, heightCm: o.h });
  }
  return windows;
}

/** 벽지 종류·제품 선택을 엔진 요청 칸(paperType/product)으로 정리한 결과 */
export interface PaperSelection {
  /** 두 종류를 병렬로 불러 범위를 합칠지 (벽지 종류를 아직 안 골랐을 때) */
  mergeBoth: boolean;
  paperType?: '합지' | '실크';
  product?: WallpaperProductRequest;
}

/**
 * 벽지 종류/제품 선택 상태를 정리한다.
 *   1) productCode가 있고 목록에서 찾아지면 그 제품 규격으로 (규격·가격 중 하나라도 없으면
 *      규격 없이 종류만 넘겨 평균가로 대체 — 조사 미완료 제품 대응)
 *   2) 아니면 paperType이 골라져 있으면 그대로
 *   3) 둘 다 없으면(즉답 단계, 아직 종류를 안 고른 상태) 병합 호출
 */
export function resolvePaperSelection(state: WallpaperFormState, products: WallpaperProductOption[]): PaperSelection {
  if (state.productCode) {
    const found = products.find((p) => p.code === state.productCode);
    // 안전장치(검사관 지적): 종류를 바꿨는데 예전 제품 코드가 안 지워진 채로 남아 있으면
    // (화면 쪽 버그·공유 링크 손상 등) 여기서 한 번 더 막는다 — 고른 종류와 제품 종류가
    // 다르면 그 제품은 무시하고 방금 고른 종류(paperType)로 계산한다.
    if (found && state.paperType && found.kind !== state.paperType) {
      return { mergeBoth: false, paperType: state.paperType };
    }
    if (found) {
      const hasFullSpec = isPositive(found.widthCm ?? undefined) && isPositive(found.lengthM ?? undefined) && isPositive(found.price ?? undefined);
      return {
        mergeBoth: false,
        paperType: found.kind,
        product: hasFullSpec
          ? {
              rollPrice: found.price as number,
              widthCm: found.widthCm as number,
              lengthM: found.lengthM as number,
              repeatCm: found.repeatCm ?? undefined,
              // 제품 마스터에서 고른 제품이면 "브랜드 이름 · 웹 조사 기준 · 2026.9" 형태로 출처를 밝힌다
              sourceLabel: `${found.brand} ${found.name} · ${found.sourceLabel}`,
            }
          : undefined,
      };
    }
    // 목록에 없는 코드면(캐시 어긋남 등) 아래 일반 로직으로 폴백
  }

  if (state.product) {
    // 옛 화면의 "직접 입력" 필드가 채워져 있으면 그대로 사용
    return { mergeBoth: false, paperType: state.paperType ?? '실크', product: state.product };
  }

  if (state.paperType) {
    return { mergeBoth: false, paperType: state.paperType };
  }

  // 종류를 아직 하나도 안 골랐다 — 즉답 단계, 합지·실크 병합
  return { mergeBoth: true };
}

/**
 * 폼 상태 → 엔진 요청.
 * 우선순위: 정밀 폼(방별 실측 또는 벽 길이)이 유효하면 그 값, 아니면 즉답 평형.
 * 둘 다 비어 있으면 null(호출하지 않음 — 빈 상태 착시 방지).
 *
 * useWallpaperCalc(클라이언트 훅)와 result/page.tsx(공유 링크 결과, 서버 컴포넌트) 둘 다
 * 이 함수 하나로 계산 규칙을 맞춘다 — 두 곳이 각자 변환 로직을 두면 즉답 화면과 공유 결과
 * 화면의 금액이 어긋날 수 있다.
 */
export function toEngineInput(
  state: WallpaperFormState,
  products: WallpaperProductOption[],
): { base: Omit<WallpaperCalcRequest, 'paperType' | 'product'>; paper: PaperSelection } | null {
  const target = state.target ?? 'both';
  // ceiling 플래그는 대상이 '벽만'이 아니면 켠다.
  // ⚠️ target==='ceiling'(천장만)도 지금은 'both'와 같게 취급한다 — 엔진이 "천장만" 물량을
  //    따로 뽑는 모드를 아직 안 갖고 있어서(치수 모듈이 항상 벽 면적도 같이 계산),
  //    완전한 "천장만" 지원은 엔진 쪽 후속 작업이 필요하다(README 위험 3 참고).
  const ceiling = target !== 'wall';
  const region = state.region;
  const paper = resolvePaperSelection(state, products);
  // 구축(재도배) 여부 — 세 입력 방식(실측/면적/평형) 모두에 동일하게 실어 보낸다
  const isOld = state.isOld ?? false;

  // 1) 정밀 폼 — 방별 실측
  // 2026-09-09 검사관 지적 수리: 방 카드가 있어도 전부 빈 값(가로·세로 미입력)이면
  // 예전엔 여기서 null을 돌려줘 즉답(평형)까지 같이 사라졌다. 이제는 유효한 방이 하나도
  // 없으면 이 블록을 건너뛰고 아래 벽 길이·평형 즉답으로 자연스럽게 넘어간다.
  if (state.entry === 'room' && state.preciseRooms && state.preciseRooms.length > 0) {
    const validRooms = validPreciseRooms(state);
    if (validRooms.length > 0) {
      const rooms: WallpaperRoomRequest[] = validRooms.map((r, i) => {
        // 문도 창과 함께 실제 규격으로 windows[]에 넣는다(위 flattenOpenings 설명 참고) — doors는 항상 안 씀
        const windows = flattenOpenings(r.openings);
        return {
          name: `방${i + 1}`,
          widthM: r.w,
          depthM: r.d,
          heightM: r.h,
          doors: undefined,
          windows: windows.length > 0 ? windows : undefined,
        };
      });
      return {
        base: {
          mode: '실측',
          rooms,
          heightM: state.heightM ?? DEFAULT_CEILING_HEIGHT_M,
          scope: '전체',
          ceiling,
          region,
          isOld,
        },
        paper,
      };
    }
    // 유효한 방이 없다 — 아래로 흘러 벽 길이·평형 즉답을 시도한다
  }

  // 2) 정밀 폼 — 벽 길이(둘레) 직접 입력
  if (state.entry === 'length' && isPositive(state.wallLength)) {
    const height = state.heightM ?? DEFAULT_CEILING_HEIGHT_M;
    // 문·창 차감: 벽 길이 모드의 개구부 목록(lengthOpenings)을 면적으로 환산해 뺀다
    const openingAreaM2 = sumOpeningAreaM2(state.lengthOpenings);
    const wallSqm = Math.max(0, state.wallLength * height - openingAreaM2);
    return {
      base: {
        mode: '면적',
        areas: {
          wallSqm,
          ceilingSqm: target !== 'wall' ? state.directCeilingSqm : undefined,
          perimeterM: state.wallLength,
        },
        ceiling,
        region,
        isOld,
      },
      paper,
    };
  }

  // 3) 즉답 — 평형
  // 2026-09-09 검사관 지적 수리: 서버가 5평 미만은 거부한다(route.ts min:5). 1~4평처럼
  // 애매한 값을 그대로 보내면 매번 "계산에 실패했어요"만 뜨니, 여기서 아예 걸러 null로
  // 돌려준다 — 화면(QuickAnswer)이 그 범위를 알아채 "5평부터 계산해요" 안내로 바꿔 보여준다.
  if (isPositive(state.pyeong) && state.pyeong >= MIN_PYEONG) {
    return {
      base: {
        mode: '평형',
        pyeong: state.pyeong,
        bay: state.bay ?? 3,
        scope: '전체',
        ceiling,
        region,
        isOld,
      },
      paper,
    };
  }

  // 입력이 하나도 없다 — 계산하지 않는다
  return null;
}
