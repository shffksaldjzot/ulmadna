// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 훅(다른 계산기 useXxxCalc와 같은 방식)
//
// 폼 상태 → 서버 요청(buildTileRequest) → 350ms 디바운스 → 이전 요청 취소 → 같은 요청이면 캐시 →
// POST /api/calc/tile. 단가·계수는 서버에만 있어서 수량도 금액도 전부 서버 응답에서 받는다.
//
// ⚠️ 클라이언트 훅이라 src/server/**를 import하지 않는다 — 서버 응답 모양을 아래에 옮겨 적었다.
//    (실제 서버 타입: src/server/calc/tile.ts TileCalcResult — 바뀌면 같이 고칠 것)
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TileFormState } from './tileQuery';
import { buildTileRequest, tileRequestKey, type TileCalcRequest } from './tileEngineInput';
import type { TileGrade, TileMethod, TilePattern, TileScope, TileService, TileSetting } from './tilePresets';
import { track } from '@/lib/analytics';

// ── 서버 응답 모양 ──

/** 벽 또는 바닥 수량 */
export interface TileSurfaceQuantityDTO {
  sizeLabel: string;
  netSqm: number;
  lossPct: number;
  grossSqm: number;
  pieces: number;
  boxes: number;
  piecesPerBox: number;
  sqmPerBox: number;
}

/** 비용 층 */
export type TileCostLayer = '자재' | '부자재' | '철거' | '방수' | '인건' | '경비';

/** 비용 한 줄(단가 칸 없음 — 금액 범위만) */
export interface TileCostLineDTO {
  key: string;
  name: string;
  qty: number;
  unit: string;
  amountMin: number;
  amountMax: number;
  layer: TileCostLayer;
  grade: 'A' | 'B' | 'C';
  note: string;
}

/** 가정 종류 */
export type TileAssumption = 'method' | 'size' | 'pyeong' | 'pattern' | 'grade' | 'dims' | 'rooms';
/** 현장 확인 키 */
export type TileCheck = 'overlayConditions' | 'largeOverlay' | 'lot';

/** 타일 계산 결과(서버 응답과 같은 모양) */
export interface TileCalcResultDTO {
  resolved: {
    mode: 'simple' | 'precise';
    scope?: TileScope;
    method: TileMethod;
    methodLabel: string;
    service: TileService;
    pattern: TilePattern;
    grade: TileGrade;
    groutMm: number;
    setting: TileSetting;
    pyeong?: number;
  };
  quantity: {
    wall: TileSurfaceQuantityDTO | null;
    floor: TileSurfaceQuantityDTO | null;
    grout: { lengthM: number; kg: number; bags: number; bagKg: number; grade: 'A' | 'B' | 'C' };
    adhesive: { name: string; kg: number; bags: number; bagKg: number; grade: 'A' | 'B' | 'C' };
    mandays: number;
    byRoom: { key: string; name: string; wallSqm: number; floorSqm: number; wallBoxes: number; floorBoxes: number }[];
  };
  cost: { min: number; mid: number; max: number; basisLine: string; breakdown: TileCostLineDTO[] };
  assumed: TileAssumption[];
  checks: TileCheck[];
  marketRef: { label: string; n: number; p25: number; p75: number } | null;
}

/** 훅이 돌려주는 값 */
export interface UseTileCalcResult {
  result: TileCalcResultDTO | null;
  loading: boolean;
  error: string | null;
  /** 지금 입력과 보이는 결과의 입력이 다르면 true(옛 값을 흐리게 보여 준다) */
  stale: boolean;
}

/** POST /api/calc/tile 한 번 */
async function fetchTile(req: TileCalcRequest, signal: AbortSignal): Promise<TileCalcResultDTO> {
  const res = await fetch('/api/calc/tile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && typeof body.error === 'string' && body.error) || '계산 중 문제가 생겼습니다');
  }
  return res.json();
}

/** 타일 계산기 메인 훅 */
export function useTileCalc(form: TileFormState): UseTileCalcResult {
  const [result, setResult] = useState<TileCalcResultDTO | null>(null);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, TileCalcResultDTO>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 폼을 문자열로 비교해야 배열 안쪽(실 카드) 변화도 잡힌다
  const formKey = JSON.stringify(form);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const request = useMemo(() => buildTileRequest(form), [formKey]);
  const requestKey = request ? tileRequestKey(request) : null;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!request || !requestKey) {
      // 아직 계산할 게 없다(공간 미선택) — 결과를 비운다
      abortRef.current?.abort();
      setResult(null);
      setShownKey(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = cacheRef.current.get(requestKey);
    if (cached) {
      abortRef.current?.abort();
      setResult(cached);
      setShownKey(requestKey);
      setLoading(false);
      setError(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      fetchTile(request, controller.signal)
        .then((r) => {
          cacheRef.current.set(requestKey, r);
          setResult(r);
          setShownKey(requestKey);
          // GA4: 계산이 실제로 성공했을 때 1번(입력 원문 없이 모드·공간만)
          track('calc_run', { process: 'tile', mode: request.mode === 'precise' ? 'precise' : 'quick', tile_scope: request.scope ?? 'rooms' });
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setError(e instanceof Error ? e.message : '계산 중 문제가 생겼습니다');
        })
        .finally(() => {
          if (controller === abortRef.current) setLoading(false);
        });
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // 화면을 떠나면 진행 중 요청 취소
  useEffect(() => () => abortRef.current?.abort(), []);

  return { result, loading, error, stale: !!result && shownKey !== requestKey };
}
