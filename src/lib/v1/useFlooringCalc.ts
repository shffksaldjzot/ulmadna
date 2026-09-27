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
// 2026년 09월 27일: 좁혀가기(도배와 같은 약속) — 자재만 골라도 계산, 돌려주는 값에 assumed 추가,
//   세 번째 인자 options.touched(area·bay·scope), 실측 입력 중엔 치수만 바뀌는 동안 직전 결과 유지.
//   기존 돌려주는 값(result·range·loading·error·stale)은 이름·뜻 그대로다.
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import type { FlooringFormState, FlooringProductOption } from './flooringQuery';
import {
  toEngineInputWithAssumed,
  nonDimensionKey,
  canHoldWhileMeasuring,
  type FlooringCalcRequest,
  type FlooringAssumption,
  type FlooringEngineOptions,
} from './flooringEngineInput';
// GA4에 "계산이 실제로 실행됐다"는 이벤트를 보낸다(개인정보 없이 모드·평형대만)
import { track, pyeongBucket } from '@/lib/analytics';

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
    /**
     * (2026-09-27 추가) 제품 미정으로 "자재 전체 범위"를 계산했을 때만 온다.
     * 제품 규격(박스당 ㎡·롤 폭)에 따라 수량이 달라서 최소~최대 수량(단위는 unit과 같음)을 따로 준다.
     * 이때 위 units는 그 자재의 대표 규격 기준 수량이다.
     */
    unitsRange?: { min: number; max: number };
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
  /**
   * (2026-09-27 추가) 지금 보이는 result가 어떤 가정값으로 계산됐는지(도배와 같은 약속).
   * result와 같은 순간에 바뀐다. 'measuring'(실측 입력 중)만 입력 즉시 반영. result가 null이면 빈 배열.
   */
  assumed: FlooringAssumption[];
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
export function useFlooringCalc(
  state: FlooringFormState,
  products: FlooringProductOption[],
  options?: FlooringEngineOptions,
): UseFlooringCalcResult {
  const [result, setResult] = useState<FlooringCalcResultDTO | null>(null);
  const [range, setRange] = useState<FlooringRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  // 지금 보이는 result를 계산할 때 쓴 가정 목록 — result와 반드시 함께 바꾼다
  const [shownAssumed, setShownAssumed] = useState<FlooringAssumption[]>([]);
  // 지금 입력이 "실측 입력 중"(방 카드 치수가 덜 참)인지 — 입력 즉시 반영
  const [measuring, setMeasuring] = useState(false);

  // 리렌더와 무관하게 값을 들고 있어야 하는 것들 — 전부 ref
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 지금 화면에 결과가 있는지(실측 입력 중 "직전 결과 유지" 판단용)
  const resultRef = useRef<FlooringCalcResultDTO | null>(null);
  // 지금 보이는 결과를 계산할 때 쓴 "치수 뺀 나머지" 열쇠 — 실측 입력 중에 자재·제품 등이 바뀌었는지 알아본다
  const shownRestKeyRef = useRef<string | null>(null);

  // 폼 상태 + 건드림 표시를 JSON 문자열로 비교해야 얕은 비교로 잡히지 않는 변화(방 배열 내용 등)도 감지한다.
  // options는 화면이 매번 새 객체로 넘길 수 있으니 참조가 아니라 내용(touched)으로 비교한다.
  const stateKey = JSON.stringify({ state, touched: options?.touched ?? null });

  useEffect(() => {
    const built = toEngineInputWithAssumed(state, products, options);

    // 대기 중인 디바운스 타이머는 항상 정리
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!built) {
      // 자재를 아직 안 골랐다 — 호출하지 않고 결과를 비운다(빈 상태 착시 방지 원칙)
      abortRef.current?.abort();
      resultRef.current = null;
      shownRestKeyRef.current = null;
      setResult(null);
      setRange(null);
      setLoading(false);
      setError(null);
      setStale(false);
      setShownAssumed([]);
      setMeasuring(false);
      return;
    }

    const engineInput = built.request;
    // 이번 입력의 가정 목록('measuring'은 따로 떼어 즉시 반영하고, 나머지는 결과와 함께 바꾼다)
    const nextAssumed = built.assumed.filter((a) => a !== 'measuring');
    setMeasuring(built.assumed.includes('measuring'));
    // 이번 요청의 "치수 뺀 나머지" 열쇠 — 결과를 화면에 올릴 때 같이 기억해 둔다
    const restKey = nonDimensionKey(built);

    // 실측 입력 중(덜 찬 방 카드)이고 치수만 바뀌는 중이면 새로 계산하지 않고 직전 결과를 둔다.
    // 자재·제품·철거·걸레받이 등 나머지가 바뀌었으면 아래로 내려가 유효한 방만으로(없으면 34평 가정) 다시 계산한다.
    if (canHoldWhileMeasuring(built, resultRef.current ? shownRestKeyRef.current : null)) {
      abortRef.current?.abort();
      setLoading(false);
      setStale(false);
      setError(null);
      return;
    }

    // 캐시 열쇠 = 서버에 실제로 보내는 요청 그대로(제품이 없으면 product 칸이 빠져 다른 열쇠가 된다)
    const cacheKey = JSON.stringify(engineInput);

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      abortRef.current?.abort();
      resultRef.current = cached.result;
      shownRestKeyRef.current = restKey;
      setResult(cached.result);
      setRange(cached.range);
      setShownAssumed(nextAssumed);
      setLoading(false);
      setError(null);
      setStale(false);
      // GA4: 캐시에서 바로 보여준 것도 사용자 입장에선 "계산 결과를 봤다"이므로 같이 센다
      track('calc_run', {
        process: 'flooring',
        mode: state.view === 'precise' ? 'precise' : 'quick',
        pyeong_bucket: pyeongBucket(state.pyeong),
      });
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
          resultRef.current = r;
          shownRestKeyRef.current = restKey; // 화면에 올린 결과의 나머지 열쇠
          setResult(r);
          setRange(rg);
          // 이 결과를 계산할 때 쓴 가정 목록 — 결과와 같은 순간에 바꾼다
          setShownAssumed(nextAssumed);
          setStale(false);
          // GA4: 서버 계산이 실제로 성공했을 때 1번 기록(입력 원문 없이 모드·평형대만)
          track('calc_run', {
            process: 'flooring',
            mode: state.view === 'precise' ? 'precise' : 'quick',
            pyeong_bucket: pyeongBucket(state.pyeong),
          });
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

  // 돌려줄 가정 목록: 보이는 결과의 가정 + (지금 실측 입력 중이면) 'measuring'. 결과가 없으면 빈 배열
  const assumed: FlooringAssumption[] = result ? (measuring ? [...shownAssumed, 'measuring'] : shownAssumed) : [];

  return { result, range, loading, error, stale, assumed };
}
