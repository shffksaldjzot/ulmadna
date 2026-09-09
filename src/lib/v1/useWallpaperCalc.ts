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
//   - 2026-09-09 화면 재배치: 벽지 종류를 안 고르면 애초에 계산을 안 한다(toEngineInput이
//     null을 돌려줌). 예전엔 종류 미선택 시 합지·실크를 둘 다 계산해 범위를 합치는
//     "병합 즉답"이 있었지만, 벽지가 1번 카드로 맨 위에 오면서 폐기했다 — 이제 한 번에
//     한 종류만 계산한다.
//
// ⚠️ 이 파일은 클라이언트 훅이라 src/server/** 를 import 하지 않는다(단가 유출 금지 규칙).
//    서버 계산 결과(WallpaperCalcResult)의 모양을 아래에 그대로 옮겨 적어 둔다 —
//    src/server/calc/wallpaper.ts가 바뀌면 이쪽도 같이 확인할 것.
//
// "폼 상태 → 엔진 요청" 변환(toEngineInput)은 순수 함수라 ./wallpaperEngineInput.ts로 옮겼다.
//   그 파일은 'use client'가 없어 공유 링크 결과 화면(result/page.tsx, 서버 컴포넌트)도 같이
//   가져다 쓴다 — 즉답 화면과 공유 결과 화면이 같은 규칙으로 계산되게 하기 위해서다.
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: toEngineInput 등을 wallpaperEngineInput.ts로 분리
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import type { WallpaperFormState, WallpaperProductOption } from './wallpaperQuery';
// 폼 상태 → 엔진 요청 변환은 순수 함수라 서버 결과 페이지(result/page.tsx)와 공유한다.
// (그 파일은 'use client' 훅을 못 쓰는 서버 컴포넌트라 이 로직만 따로 뺐다)
import { toEngineInput, type WallpaperCalcRequest } from './wallpaperEngineInput';

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

/** 금액 범위 (카드3 큰 숫자에 쓴다. 지금은 항상 result.cost.min~max와 같다) */
export interface WallpaperRange {
  min: number;
  max: number;
}

// ── 훅이 밖으로 돌려주는 상태 ──

export interface UseWallpaperCalcResult {
  /** 마지막으로 성공한 계산 결과 */
  result: WallpaperCalcResultDTO | null;
  /** 결과 화면 큰 숫자에 쓰는 금액 범위(= result.cost.min~max) */
  range: WallpaperRange | null;
  loading: boolean;
  error: string | null;
  /** 다음 결과가 오기 전까지 화면에 남겨 둔 "이전" 값이라는 표시 (깜빡임 방지용) */
  stale: boolean;
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

      fetchWallpaper(
        { ...engineInput.base, paperType: engineInput.paper.paperType, product: engineInput.paper.product },
        controller.signal,
      )
        .then((r) => {
          const rg: WallpaperRange = { min: r.cost.min, max: r.cost.max };
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
          // 검사관 지적 11번: 취소된(옛) 요청의 finally가 나중에 도착해 방금 시작한 새 요청의
          // loading=true를 꺼버리는 경쟁 상태가 있었다. 지금 이 컨트롤러가 여전히 "현재" 요청일
          // 때만 loading을 끈다 — 이미 새 요청이 시작돼 abortRef가 바뀌었으면 손대지 않는다.
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
