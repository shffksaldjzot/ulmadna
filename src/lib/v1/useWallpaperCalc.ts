// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 훅
//
// 하는 일:
//   화면 폼 상태(WallpaperFormState) → 서버 계산 입력으로 변환 → 400ms 디바운스 →
//   이전 요청 취소(AbortController) → 같은 입력이면 캐시에서 재사용 → POST /api/calc/wallpaper
//
// 왜 이렇게 만드나:
//   - 토스식 "한 번에 하나" 화면은 사용자가 값을 계속 바꾸며 실시간으로 결과를 본다.
//     매 타이핑마다 서버를 때리면 낭비니 디바운스, 느린 응답이 먼저 온 옛 요청으로
//     최신 화면을 덮어쓰면 안 되니 취소, 같은 조건을 왔다갔다 할 때(칩 다시 누르기 등)
//     매번 다시 계산하지 않도록 캐시를 둔다.
//   - 벽지 종류(합지/실크)를 아직 안 고른 즉답 단계에서는 두 종류를 병렬로 계산해
//     "가장 넓은 범위"(최저=합지 최저, 최고=실크 최고)로 보여준다(형아 결정 1번 추천안).
//
// ⚠️ 이 파일은 클라이언트 훅이라 src/server/** 를 import 하지 않는다(단가 유출 금지 규칙).
//    서버 계산 결과(WallpaperCalcResult)와 입력(WallpaperCalcInput)의 모양을
//    아래에 그대로 옮겨 적어 둔다 — src/server/calc/wallpaper.ts가 바뀌면 이쪽도 같이 확인할 것.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import type { WallpaperFormState, WallpaperProductOption, WallpaperOpening } from './wallpaperQuery';
import { DEFAULT_CEILING_HEIGHT_M } from './wallpaperDefaults';

// ── 서버 응답 모양 (src/server/calc/wallpaper.ts WallpaperCalcResult를 그대로 옮겨 적음) ──

/** 실별 물량 한 줄 */
export interface WallpaperRoomQuantity {
  key: string;
  name: string;
  wallSqm: number;
  ceilingSqm: number;
  rolls: number;
}

/** 부자재 한 줄 */
export interface WallpaperSubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  basis: string;
  grade: 'A' | 'B' | 'C';
}

/** 비용 구성 한 줄 */
export interface WallpaperCostLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
  note: string;
}

/** 도배 계산 결과 (서버 API 응답과 동일한 모양) */
export interface WallpaperCalcResultDTO {
  quantity: {
    rolls: number;
    wallSqm: number;
    ceilingSqm: number;
    perimeterM: number;
    lossPct: number;
    lossMode: '실제' | '추정' | '면적';
    inputMode: '평형' | '실측' | '면적';
    byRoom: WallpaperRoomQuantity[];
  };
  submaterials: WallpaperSubmaterialLine[];
  cost: {
    min: number;
    mid: number;
    max: number;
    mode: '표본' | '산식';
    basisLine: string;
    breakdown: WallpaperCostLine[];
  };
}

/** 금액 범위 (즉답 단계 · 종류 병합용) */
export interface WallpaperRange {
  min: number;
  max: number;
}

// ── 서버 요청 모양 (src/server/calc/wallpaper.ts WallpaperCalcInput 중 이 훅이 실제로 쓰는 칸만) ──

interface WallpaperRoomRequest {
  name: string;
  widthM: number;
  depthM: number;
  heightM?: number;
  doors?: number;
  windows?: { widthCm: number; heightCm: number }[];
}

interface WallpaperAreasRequest {
  wallSqm?: number;
  ceilingSqm?: number;
  perimeterM?: number;
}

interface WallpaperProductRequest {
  rollPrice: number;
  widthCm: number;
  lengthM: number;
  repeatCm?: number;
}

interface WallpaperCalcRequest {
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
}

// ── 훅이 밖으로 돌려주는 상태 ──

export interface UseWallpaperCalcResult {
  /** 마지막으로 성공한 계산 결과. 종류 병합 호출이면 실크(상한) 쪽 상세를 대표로 담는다 */
  result: WallpaperCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위(단일 호출이면 result.cost.min~max와 같다) */
  range: WallpaperRange | null;
  loading: boolean;
  error: string | null;
  /** 다음 결과가 오기 전까지 화면에 남겨 둔 "이전" 값이라는 표시 (깜빡임 방지용) */
  stale: boolean;
}

/** 소수점 반올림 없이 그대로 두되 undefined는 걸러낸다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * 정밀 폼의 개구부 목록(door/window, 개수 포함)을 엔진이 받는 모양으로 편다.
 * 문은 규격을 따로 안 받는 엔진 규칙(표준 문 규격 고정)에 맞춰 개수만 합산하고,
 * 창은 count만큼 같은 규격의 창을 여러 개 나열한다.
 */
function flattenOpenings(openings: WallpaperOpening[]): { doors: number; windows: { widthCm: number; heightCm: number }[] } {
  let doors = 0;
  const windows: { widthCm: number; heightCm: number }[] = [];
  for (const o of openings) {
    if (o.kind === 'door') {
      doors += o.count;
    } else {
      for (let i = 0; i < o.count; i++) windows.push({ widthCm: o.w, heightCm: o.h });
    }
  }
  return { doors, windows };
}

/** 벽지 종류·제품 선택을 엔진 요청 칸(paperType/product)으로 정리한 결과 */
interface PaperSelection {
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
function resolvePaperSelection(state: WallpaperFormState, products: WallpaperProductOption[]): PaperSelection {
  if (state.productCode) {
    const found = products.find((p) => p.code === state.productCode);
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
 */
function toEngineInput(
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

  // 1) 정밀 폼 — 방별 실측
  if (state.entry === 'room' && state.preciseRooms && state.preciseRooms.length > 0) {
    const validRooms = state.preciseRooms.filter((r) => isPositive(r.w) && isPositive(r.d));
    if (validRooms.length === 0) return null;
    const rooms: WallpaperRoomRequest[] = validRooms.map((r, i) => {
      const { doors, windows } = flattenOpenings(r.openings);
      return {
        name: `방${i + 1}`,
        widthM: r.w,
        depthM: r.d,
        heightM: r.h,
        doors: doors || undefined,
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
      },
      paper,
    };
  }

  // 2) 정밀 폼 — 벽 길이(둘레) 직접 입력
  if (state.entry === 'length' && isPositive(state.wallLength)) {
    const height = state.heightM ?? DEFAULT_CEILING_HEIGHT_M;
    // 문·창 차감: 정밀 폼에 개구부 입력 칸이 아직 없어(이번 지시서 범위 밖) 0으로 둔다.
    // 나중에 벽 길이 모드에도 문·창 칸이 생기면 여기서 빼면 된다.
    const openingAreaM2 = 0;
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
      },
      paper,
    };
  }

  // 3) 즉답 — 평형
  if (isPositive(state.pyeong)) {
    return {
      base: {
        mode: '평형',
        pyeong: state.pyeong,
        bay: state.bay ?? 3,
        scope: '전체',
        ceiling,
        region,
      },
      paper,
    };
  }

  // 입력이 하나도 없다 — 계산하지 않는다
  return null;
}

/** POST /api/calc/wallpaper 호출 한 번 */
async function fetchWallpaper(request: WallpaperCalcRequest, signal: AbortSignal): Promise<WallpaperCalcResultDTO> {
  const res = await fetch('/api/calc/wallpaper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && typeof body.error === 'string' && body.error) || '계산 중 문제가 생겼습니다');
  }
  return res.json();
}

/** 캐시·상태 한 벌 (성공 결과만 저장) */
interface CacheEntry {
  result: WallpaperCalcResultDTO;
  range: WallpaperRange;
}

/**
 * 도배 계산기 메인 훅.
 * QuickAnswer·PreciseSection·PaperPicker가 만든 폼 상태를 받아 결과를 돌려준다.
 */
export function useWallpaperCalc(state: WallpaperFormState, products: WallpaperProductOption[]): UseWallpaperCalcResult {
  const [result, setResult] = useState<WallpaperCalcResultDTO | null>(null);
  const [range, setRange] = useState<WallpaperRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // 리렌더와 무관하게 값을 들고 있어야 하는 것들 — 전부 ref
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 폼 상태를 JSON 문자열로 비교해야 얕은 비교로 잡히지 않는 변화(방 배열 내용 등)도 감지한다
  const stateKey = JSON.stringify(state);

  useEffect(() => {
    const engineInput = toEngineInput(state, products);

    // 대기 중인 디바운스 타이머는 항상 정리
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!engineInput) {
      // 입력이 비어 있다 — 호출하지 않고 결과를 비운다(빈 상태 착시 방지 원칙)
      abortRef.current?.abort();
      setResult(null);
      setRange(null);
      setLoading(false);
      setError(null);
      setStale(false);
      return;
    }

    const cacheKey = JSON.stringify({
      base: engineInput.base,
      merge: engineInput.paper.mergeBoth,
      paperType: engineInput.paper.paperType,
      product: engineInput.paper.product,
    });

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      abortRef.current?.abort();
      setResult(cached.result);
      setRange(cached.range);
      setLoading(false);
      setError(null);
      setStale(false);
      return;
    }

    // 새 값이 오기 전까지는 이전 결과를 화면에 남겨 두되 "예전 값"이라고 표시한다
    setStale(true);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      const run = engineInput.paper.mergeBoth
        ? Promise.all([
            fetchWallpaper({ ...engineInput.base, paperType: '합지' }, controller.signal),
            fetchWallpaper({ ...engineInput.base, paperType: '실크' }, controller.signal),
          ]).then(([lo, hi]) => ({
            // 합지 쪽 최저 ~ 실크 쪽 최고로 범위를 넓게 잡는다(형아 결정 1번 추천안)
            result: hi,
            range: { min: lo.cost.min, max: hi.cost.max },
          }))
        : fetchWallpaper(
            { ...engineInput.base, paperType: engineInput.paper.paperType, product: engineInput.paper.product },
            controller.signal,
          ).then((r) => ({ result: r, range: { min: r.cost.min, max: r.cost.max } }));

      run
        .then(({ result: r, range: rg }) => {
          cacheRef.current.set(cacheKey, { result: r, range: rg });
          setResult(r);
          setRange(rg);
          setStale(false);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return; // 취소된 요청은 무시
          setError(e instanceof Error ? e.message : '계산 중 문제가 생겼습니다');
        })
        .finally(() => {
          setLoading(false);
        });
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // stateKey로 값 변화를 감지하고, products는 참조가 안정적이라고 가정한다(서버 props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, products]);

  // 언마운트 시 진행 중인 요청 정리
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { result, range, loading, error, stale };
}
