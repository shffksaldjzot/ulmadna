// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기 훅 (도배·바닥재 useXxxCalc.ts를 그대로 본떠 만듦)
//
// 하는 일:
//   화면 폼 상태(MortarFormState) → 서버 계산 입력으로 변환(toEngineInput) → 400ms
//   디바운스 → 이전 요청 취소(AbortController) → 같은 입력이면 캐시에서 재사용 →
//   POST /api/calc/mortar
//
// ⚠️ 이 파일은 클라이언트 훅이라 src/server/**를 import하지 않는다(단가 유출 금지 규칙).
//    서버 계산 결과(MortarCalcResult)의 모양을 아래에 그대로 옮겨 적어 둔다 — 실제 서버
//    타입(src/server/calc/mortar.ts)이 바뀌면 같이 확인할 것.
//
// "폼 상태 → 엔진 요청" 변환(toEngineInput)은 순수 함수라 ./mortarEngineInput.ts에 있다.
//   그 파일은 'use client'가 없어 공유 링크 결과 화면(result/page.tsx, 서버 컴포넌트)도
//   같이 가져다 쓴다 — 즉답 화면과 공유 결과 화면이 같은 규칙으로 계산되게 하기 위해서다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import type { MortarFormState } from './mortarQuery';
import type { MortarProductOption } from './mortarProductOptions';
import { toEngineInput, type MortarCalcRequest } from './mortarEngineInput';

// ── 서버 응답 모양 (src/server/calc/mortar.ts MortarCalcResult를 그대로 옮겨 적음) ──

/** 실별 물량 한 줄 */
export interface MortarRoomQuantity {
  key: string;
  name: string;
  areaSqm: number;
  bags: number;
}

/** 부자재 한 줄 */
export interface MortarSubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  basis: string;
  grade: 'A' | 'B' | 'C';
}

/** 비용 구성 한 줄 */
export interface MortarCostLine {
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

/** 레미탈 모드 전용 — 현장 배합(시멘트+모래) 대안 */
export interface MortarAltMix {
  mixRatio: '1:2' | '1:3';
  cementKg: number;
  cementBags: number;
  sandM3: number;
}

/** 인건 요약 — 셀프레벨링 모드는 계산 자체를 안 해서 result.labor가 null이다 */
export interface MortarLaborSummary {
  manDaysPlasterer: number;
  manDaysHelper: number;
  /** 장비 타설일 때만 0보다 크다 */
  manDaysMechanic: number;
  manDaysTotal: number;
  teamDays: number;
  method: '장비타설' | '손미장';
  /** 일반기계운전사 노임이 추정치(등급 C)라 화면에 "추정" 표시가 필요한지 */
  mechanicWageIsEstimate: boolean;
}

/** 미장 계산 결과 (서버 API 응답과 동일한 모양) */
export interface MortarCalcResultDTO {
  mode: '레미탈' | '셀프레벨링';
  quantity: {
    areaSqm: number;
    thicknessMm: number;
    usageLabel?: string;
    method?: '장비타설' | '손미장';
    volumeM3: number;
    volumeWithLossM3: number;
    lossPct: number;
    unit: '포';
    bags: number;
    bagKg: number;
    altMix?: MortarAltMix;
    primerLiters?: number;
    byRoom: MortarRoomQuantity[];
  };
  submaterials: MortarSubmaterialLine[];
  /** 셀프레벨링 모드는 인건을 계산하지 않아 null이다(06_미장.md §6-4) */
  labor: MortarLaborSummary | null;
  /** 셀프레벨링 모드에서만: "시공비는 현장 견적 별도" 안내 */
  laborAdvisoryNote?: string;
  /** 장비 타설일 때만: "장비비 별도" 안내 */
  equipmentNote?: string;
  cost: {
    min: number;
    mid: number;
    max: number;
    mode: '산식';
    basisLine: string;
    breakdown: MortarCostLine[];
  };
}

/** 금액 범위 (결과 카드 큰 숫자에 쓴다. 지금은 항상 result.cost.min~max와 같다) */
export interface MortarRange {
  min: number;
  max: number;
}

// ── 훅이 밖으로 돌려주는 상태 ──

export interface UseMortarCalcResult {
  result: MortarCalcResultDTO | null;
  range: MortarRange | null;
  loading: boolean;
  error: string | null;
  /** 다음 결과가 오기 전까지 화면에 남겨 둔 "이전" 값이라는 표시(깜빡임 방지용) */
  stale: boolean;
}

/** POST /api/calc/mortar 호출 한 번 */
async function fetchMortar(request: MortarCalcRequest, signal: AbortSignal): Promise<MortarCalcResultDTO> {
  const res = await fetch('/api/calc/mortar', {
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
  result: MortarCalcResultDTO;
  range: MortarRange;
}

/**
 * 미장 계산기 메인 훅.
 * MortarCalculator(오케스트레이터)가 만든 폼 상태를 받아 결과를 돌려준다.
 */
export function useMortarCalc(state: MortarFormState, products: MortarProductOption[]): UseMortarCalcResult {
  const [result, setResult] = useState<MortarCalcResultDTO | null>(null);
  const [range, setRange] = useState<MortarRange | null>(null);
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

    const cacheKey = JSON.stringify(engineInput);

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

    setStale(true);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      fetchMortar(engineInput, controller.signal)
        .then((r) => {
          const rg: MortarRange = { min: r.cost.min, max: r.cost.max };
          cacheRef.current.set(cacheKey, { result: r, range: rg });
          setResult(r);
          setRange(rg);
          setStale(false);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setError(e instanceof Error ? e.message : '계산 중 문제가 생겼습니다');
          setStale(false);
        })
        .finally(() => {
          if (controller === abortRef.current) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, products]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { result, range, loading, error, stale };
}
