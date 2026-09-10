// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 훅 (도배 useWallpaperCalc.ts를 그대로 본떠 만듦)
//
// 하는 일:
//   화면 폼 상태(FlooringFormState) → 서버 계산 입력으로 변환(toEngineInput) → 400ms
//   디바운스 → 이전 요청 취소(AbortController) → 같은 입력이면 캐시에서 재사용 →
//   POST /api/calc/flooring
//
// 왜 이렇게 만드나: 도배와 같은 이유(useWallpaperCalc.ts 상단 설명 참고) —
//   토스식 "한 번에 하나" 화면은 값이 바뀔 때마다 실시간으로 결과를 보여줘야 해서
//   디바운스·취소·캐시가 다 필요하다.
//
// ⚠️ 이 파일은 클라이언트 훅이라 src/server/**를 import하지 않는다(단가 유출 금지 규칙).
//    서버 계산 결과(FlooringCalcResult)의 모양을 아래에 그대로 옮겨 적어 둔다 —
//    실제 서버 타입(src/server/calc/flooring.ts, E 에이전트 작업)이 바뀌면 같이 확인할 것.
//
// "폼 상태 → 엔진 요청" 변환(toEngineInput)은 순수 함수라 ./flooringEngineInput.ts에 있다.
//   그 파일은 'use client'가 없어 공유 링크 결과 화면(result/page.tsx, 서버 컴포넌트)도
//   같이 가져다 쓴다 — 즉답 화면과 공유 결과 화면이 같은 규칙으로 계산되게 하기 위해서다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import type { FlooringFormState, FlooringProductOption } from './flooringQuery';
import { toEngineInput, type FlooringCalcRequest } from './flooringEngineInput';

// ── 서버 응답 모양 (지시서 공통규칙 문서의 API 계약 FlooringCalcResult를 그대로 옮겨 적음) ──

/** 실별 물량 한 줄 */
export interface FlooringRoomQuantity {
  key: string;
  name: string;
  floorSqm: number;
  units: number;
}

/** 부자재 한 줄 */
export interface FlooringSubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  basis: string;
  grade: 'A' | 'B' | 'C';
}

/** 비용 구성 한 줄 */
export interface FlooringCostLine {
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

/** 바닥재 계산 결과 (서버 API 응답과 동일한 모양) */
export interface FlooringCalcResultDTO {
  quantity: {
    /** 구매 단위 — 박스형이면 '박스', 롤형(장판)이면 'm' */
    unit: '박스' | 'm';
    /** 구매 수량(올림) */
    units: number;
    /** 박스형이면 총 장 수 */
    pieces?: number;
    floorSqm: number;
    perimeterM: number;
    lossPct: number;
    lossMode: '실제' | '추정';
    inputMode: '평형' | '실측';
    byRoom: FlooringRoomQuantity[];
  };
  submaterials: FlooringSubmaterialLine[];
  cost: {
    min: number;
    mid: number;
    max: number;
    mode: '표본' | '산식';
    basisLine: string;
    breakdown: FlooringCostLine[];
  };
}

/** 금액 범위 (카드3 큰 숫자에 쓴다. 지금은 항상 result.cost.min~max와 같다) */
export interface FlooringRange {
  min: number;
  max: number;
}

// ── 훅이 밖으로 돌려주는 상태 ──

export interface UseFlooringCalcResult {
  /** 마지막으로 성공한 계산 결과 */
  result: FlooringCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위(= result.cost.min~max) */
  range: FlooringRange | null;
  loading: boolean;
  error: string | null;
  /** 다음 결과가 오기 전까지 화면에 남겨 둔 "이전" 값이라는 표시(깜빡임 방지용) */
  stale: boolean;
}

/** POST /api/calc/flooring 호출 한 번 */
async function fetchFlooring(request: FlooringCalcRequest, signal: AbortSignal): Promise<FlooringCalcResultDTO> {
  const res = await fetch('/api/calc/flooring', {
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
  result: FlooringCalcResultDTO;
  range: FlooringRange;
}

/**
 * 바닥재 계산기 메인 훅.
 * MaterialPicker·QuickAnswer·PreciseSection이 만든 폼 상태를 받아 결과를 돌려준다.
 */
export function useFlooringCalc(state: FlooringFormState, products: FlooringProductOption[]): UseFlooringCalcResult {
  const [result, setResult] = useState<FlooringCalcResultDTO | null>(null);
  const [range, setRange] = useState<FlooringRange | null>(null);
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

    // 새 값이 오기 전까지는 이전 결과를 화면에 남겨 두되 "예전 값"이라고 표시한다
    setStale(true);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      fetchFlooring(engineInput, controller.signal)
        .then((r) => {
          const rg: FlooringRange = { min: r.cost.min, max: r.cost.max };
          cacheRef.current.set(cacheKey, { result: r, range: rg });
          setResult(r);
          setRange(rg);
          setStale(false);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return; // 취소된 요청은 무시
          setError(e instanceof Error ? e.message : '계산 중 문제가 생겼습니다');
          // 검사관 2라운드 지적 N-4: 실패했을 때도 "예전 값을 보여주는 중"이라는 흐릿 표시
          // (stale)를 꺼야 한다 — 안 그러면 실패 뒤에도 카드가 계속 옅게 남아 있는다.
          setStale(false);
        })
        .finally(() => {
          // 취소된(옛) 요청의 finally가 나중에 도착해 방금 시작한 새 요청의 loading=true를
          // 꺼버리는 경쟁 상태를 막는다(도배 훅과 같은 방어). 이 컨트롤러가 여전히 "현재"
          // 요청일 때만 loading을 끈다.
          if (controller === abortRef.current) {
            setLoading(false);
          }
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
