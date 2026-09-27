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
// 2026년 09월 15일: GA4 calc_run 이벤트 추가(도배·바닥재와 같은 사용량 추적, 누락 발견돼 보강)
// 2026년 09월 27일: 좁혀가기 — 세 번째 인자 options.touched(usage·area·thickness·method), 돌려주는 값에
//   assumed·resultKey 추가, 지금 입력과 보이는 금액의 입력이 다르면 stale=true, 실측 입력 중 직전 결과 유지.
//   기존 돌려주는 값(result·range·loading·error·stale)은 이름 그대로다.
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MortarFormState } from './mortarQuery';
import type { MortarProductOption } from './mortarProductOptions';
import {
  toEngineInputWithAssumed,
  resolveView,
  resolveMode,
  mortarRequestKey,
  nonDimensionKey,
  canHoldWhileMeasuring,
  mortarCostOutOfSync,
  type MortarCalcRequest,
  type MortarAssumption,
  type MortarEngineOptions,
} from './mortarEngineInput';
// GA4에 "계산이 실제로 실행됐다"는 이벤트를 보낸다(개인정보 없이 모드만 — 도배·바닥재와 같은 방식).
// 미장은 평형이 아니라 면적(㎡) 입력이라 pyeongBucket은 안 쓴다.
import { track } from '@/lib/analytics';

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

/** 5층 비용 구성 — 결과 화면이 이 값으로 층별 소계를 묶어 보여준다(06_미장.md §11-9) */
export type MortarCostLayer = '자재' | '부자재' | '운송·하차' | '양중' | '인건' | '경비';

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
  layer: MortarCostLayer;
  grade: 'A' | 'B' | 'C';
}

/** 레미탈 모드 전용 — 현장 배합(시멘트+모래) 대안 */
export interface MortarAltMix {
  mixRatio: '1:2' | '1:3';
  cementKg: number;
  cementBags: number;
  sandM3: number;
}

/**
 * 인건 요약 — 셀프레벨링 모드는 계산 자체를 안 해서 result.labor가 null이다.
 * 2026-09-15 운영자 현장 기준 지시로 "품(인-일)" 대신 "오늘 몇 명"으로 바뀌었다 — days는 항상 1
 * (연속 타설 하루 완료 제약).
 */
export interface MortarLaborSummary {
  /** 기공(미장공) 인원 */
  crewPlasterer: number;
  /** 조공(보통인부) 인원 */
  crewHelper: number;
  /** 일반기계운전사 인원 — 장비 타설일 때만 0보다 크다 */
  crewMechanic: number;
  /** 완료 일수 — 항상 1 */
  days: 1;
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
  /** 장비 타설일 때만: 장비대 관련 안내(비용은 breakdown의 "장비대" 줄에 이미 반영됨) */
  equipmentNote?: string;
  /** 양중비 참고값(원) — 입력칸 옆 "참고" 버튼이 채우는 값 */
  liftingReferenceWon: number;
  /** 운송·양중·장비대처럼 현장 확인이 필요한 항목 이름 목록 */
  siteConfirmItems: string[];
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
  /**
   * 다음 결과가 오기 전까지 화면에 남겨 둔 "이전" 값이라는 표시(깜빡임 방지용).
   * 2026-09-27부터 **지금 입력과 보이는 금액의 입력이 다르면 무조건 true**다 — 즉시 포수는 입력 즉시
   * 바뀌고 금액은 400ms+서버 왕복 뒤에 따라오므로, 그 사이(첫 렌더 한 번 포함)에 "새 수량 + 옛 금액"이
   * 선명하게 같이 보이지 않게 한다. (실측 입력 중 직전 결과 유지는 의도된 것이라 이때는 false)
   */
  stale: boolean;
  /**
   * (2026-09-27 추가) 지금 보이는 result가 어떤 가정값으로 계산됐는지. result와 같은 순간에 바뀐다.
   * 'measuring'(실측 입력 중)만 입력 즉시 반영. result가 null이면 빈 배열.
   */
  assumed: MortarAssumption[];
  /**
   * (2026-09-27 추가) 지금 보이는 result를 만든 요청의 열쇠. 즉시 포수 결과의 inputKey와 같으면
   * 수량과 금액이 같은 입력에서 나온 것이다. result가 null이면 null.
   */
  resultKey: string | null;
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
export function useMortarCalc(
  state: MortarFormState,
  products: MortarProductOption[],
  options?: MortarEngineOptions,
): UseMortarCalcResult {
  const [result, setResult] = useState<MortarCalcResultDTO | null>(null);
  const [range, setRange] = useState<MortarRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  // 지금 보이는 result와 한 벌로 움직이는 값들 — result를 바꿀 때 반드시 같이 바꾼다
  //   assumed: 그 결과의 가정 목록 / requestKey: 그 결과를 만든 요청 열쇠 / restKey: 면적 뺀 나머지 열쇠
  const [shown, setShown] = useState<{ assumed: MortarAssumption[]; requestKey: string; restKey: string } | null>(null);

  // 리렌더와 무관하게 값을 들고 있어야 하는 것들 — 전부 ref
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 지금 화면에 결과가 있는지 + 그 결과의 나머지 열쇠(실측 입력 중 "직전 결과 유지" 판단용, 효과 안에서 읽는다)
  const resultRef = useRef<MortarCalcResultDTO | null>(null);
  const shownRestKeyRef = useRef<string | null>(null);

  // 폼 상태 + 건드림 표시를 JSON 문자열로 비교해야 얕은 비교로 잡히지 않는 변화(방 배열 내용 등)도 감지한다
  const stateKey = JSON.stringify({ state, touched: options?.touched ?? null });

  // 지금 입력의 요청·가정(렌더 중에 계산 — 아래 stale 보정과 효과가 같이 쓴다)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => toEngineInputWithAssumed(state, products, options), [stateKey, products]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!built) {
      // 용도를 아직 안 골랐다 — 호출하지 않고 결과를 비운다(빈 상태 착시 방지 원칙)
      abortRef.current?.abort();
      resultRef.current = null;
      shownRestKeyRef.current = null;
      setResult(null);
      setRange(null);
      setShown(null);
      setLoading(false);
      setError(null);
      setStale(false);
      return;
    }

    const engineInput = built.request;
    // 결과와 같이 기억해 둘 값들('measuring'은 결과가 아니라 입력 상태라 빼 둔다)
    const nextShown = {
      assumed: built.assumed.filter((a) => a !== 'measuring'),
      requestKey: mortarRequestKey(engineInput),
      restKey: nonDimensionKey(built),
    };

    // 실측 입력 중(면적 빈 구역 카드)이고 면적만 바뀌는 중이면 새로 계산하지 않고 직전 결과를 둔다.
    // 용도·두께·공법·제품 등 나머지가 바뀌었으면 아래로 내려가 채운 구역만으로(없으면 10평 가정) 다시 계산한다.
    if (canHoldWhileMeasuring(built, resultRef.current ? shownRestKeyRef.current : null)) {
      abortRef.current?.abort();
      setLoading(false);
      setStale(false);
      setError(null);
      return;
    }

    const cacheKey = nextShown.requestKey;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      abortRef.current?.abort();
      resultRef.current = cached.result;
      shownRestKeyRef.current = nextShown.restKey;
      setResult(cached.result);
      setRange(cached.range);
      setShown(nextShown);
      setLoading(false);
      setError(null);
      setStale(false);
      // GA4: 캐시에서 바로 보여준 것도 사용자 입장에선 "계산 결과를 봤다"이므로 같이 센다
      track('calc_run', {
        process: 'mortar',
        mode: resolveView(state) === 'precise' ? 'precise' : 'quick',
        mortar_mode: resolveMode(state),
      });
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
          resultRef.current = r;
          shownRestKeyRef.current = nextShown.restKey;
          setResult(r);
          setRange(rg);
          setShown(nextShown); // 결과와 같은 순간에 가정 목록·열쇠도 바꾼다
          setStale(false);
          // GA4: 서버 계산이 실제로 성공했을 때 1번 기록(입력 원문 없이 모드만)
          track('calc_run', {
            process: 'mortar',
            mode: resolveView(state) === 'precise' ? 'precise' : 'quick',
            mortar_mode: resolveMode(state),
          });
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
  }, [built]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── 수량·금액 어긋남 표시 (지휘관 지시: 새 수량과 옛 금액이 한 화면에 선명하게 같이 보이지 않게) ──
  // 지금 입력의 요청 열쇠가 보이는 금액의 열쇠와 다르면, 효과가 아직 안 돌았거나(첫 렌더) 계산 중이다 → stale.
  // 단, 실측 입력 중 면적만 바뀌는 "직전 결과 유지" 상태는 의도된 것이라 stale로 보지 않는다.
  const measuring = built?.assumed.includes('measuring') ?? false;
  const outOfSync = result != null && mortarCostOutOfSync(built, shown);

  // 돌려줄 가정 목록: 보이는 결과의 가정 + (지금 실측 입력 중이면) 'measuring'
  const assumed: MortarAssumption[] = result && shown ? (measuring ? [...shown.assumed, 'measuring'] : shown.assumed) : [];

  return {
    result,
    range,
    loading,
    error,
    stale: stale || outOfSync,
    assumed,
    resultKey: result && shown ? shown.requestKey : null,
  };
}
