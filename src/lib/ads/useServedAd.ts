'use client';
// ─────────────────────────────────────────────────────────────
// 광고 자리용 배너 조회 훅 — 2026년 10월 29일
//
// [무슨 기능인가]
//   화면의 광고 자리(AdSlot)가 "내 지역에 게재 중인 유료 배너가 있나?"를 서버에 묻는다.
//   - 같은 화면의 여러 자리(공정 스폰서 13개 등)는 한 번의 요청으로 묶어서 보낸다(setTimeout 0 모음).
//   - 같은 자리는 한 번만 묻고 결과를 기억한다(화면 이동 후에도 새로고침 전까진 재사용).
//   - 광고가 없으면 null 이고 화면은 아무 변화가 없다. 네트워크가 실패해도 null.
//   - 주소에 ?ad_preview=<주문번호> 가 있으면 시험용 미리보기로 그 주문 배너를 보여 준다.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ADS_ENABLED } from './config';

export interface ServedBanner {
  id: number;
  imageUrl: string;
  /** PC 전용 그림 주소(AD-H·AD-F, 선택). 없으면 null — 화면이 휴대폰 그림을 가운데 보여 준다 */
  desktopImageUrl?: string | null;
  href: string;
  name: string;
  /** 주문 전화 번호(없으면 null) — 견적서 PDF 추천 줄에 쓴다 */
  phone?: string | null;
}

/** 이미 받은 결과(키 → 배너 또는 null) */
const done = new Map<string, ServedBanner | null>();
/** 아직 응답을 기다리는 키들의 콜백 */
const waiting = new Map<string, Array<(b: ServedBanner | null) => void>>();
/** 이번 묶음에 모인 키 */
let batch: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** 주소의 미리보기 주문번호(없으면 null) */
function previewId(): string | null {
  try {
    const v = new URLSearchParams(window.location.search).get('ad_preview');
    return v && /^\d{1,9}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** 모인 키를 한 번에 서버로 보내고 결과를 나눠 준다 */
async function flush() {
  const keys = batch;
  batch = [];
  timer = null;
  let ads: Record<string, ServedBanner | null> = {};
  try {
    const p = previewId();
    const res = await fetch(`/api/ads/serve?q=${encodeURIComponent(keys.join(';'))}${p ? `&preview=${p}` : ''}`);
    if (res.ok) ads = ((await res.json()) as { ads?: Record<string, ServedBanner | null> }).ads ?? {};
  } catch {
    // 실패하면 광고 없음으로 처리
  }
  for (const k of keys) {
    const b = ads[k] ?? null;
    done.set(k, b);
    (waiting.get(k) ?? []).forEach((cb) => cb(b));
    waiting.delete(k);
  }
}

/**
 * 화면 밖(버튼 눌렀을 때 등)에서 한 번 묻는 함수 — 견적서 PDF 추천 줄(AD-T)용 (2026-10-29)
 *  - 훅과 같은 규칙: 광고 스위치가 꺼져 있으면 미리보기(?ad_preview=<주문번호>)일 때만 묻고, 아니면 바로 null.
 *  - 같은 화면에서 이미 받은 결과가 있으면 그것을 쓴다.
 */
export function fetchServedAd(slot: string, process?: string): Promise<ServedBanner | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!ADS_ENABLED && previewId() === null) return Promise.resolve(null);
  const key = slot === 'AD-P' ? `AD-P:${process ?? ''}` : slot;
  if (done.has(key)) return Promise.resolve(done.get(key) ?? null);
  return new Promise((resolve) => {
    const list = waiting.get(key);
    if (list) list.push(resolve);
    else {
      waiting.set(key, [resolve]);
      batch.push(key);
      if (!timer) timer = setTimeout(flush, 0);
    }
  });
}

/** 자리 키: AD-H / AD-R / AD-F, 공정 스폰서는 AD-P:공정이름 */
export function useServedAd(slot: string, process?: string, enabledIn = true): ServedBanner | null {
  // 광고 전역 스위치(ADS_ENABLED, config.ts 상수)가 꺼져 있으면 미리보기(?ad_preview=)일 때만 서버에 묻는다 → 평소 요청 0
  const enabled = enabledIn && (ADS_ENABLED || (typeof window !== 'undefined' && previewId() !== null));
  const key = slot === 'AD-P' ? `AD-P:${process ?? ''}` : slot;
  const [banner, setBanner] = useState<ServedBanner | null>(() => done.get(key) ?? null);

  useEffect(() => {
    // 노출 한도 밖 자리 등 조회가 필요 없으면 아무것도 묻지 않는다
    if (!enabled) return;
    if (done.has(key)) {
      setBanner(done.get(key) ?? null);
      return;
    }
    let alive = true;
    const cb = (b: ServedBanner | null) => {
      if (alive) setBanner(b);
    };
    const list = waiting.get(key);
    if (list) list.push(cb);
    else {
      waiting.set(key, [cb]);
      batch.push(key);
      if (!timer) timer = setTimeout(flush, 0);
    }
    return () => {
      alive = false;
    };
  }, [key, enabled]);

  return enabled ? banner : null;
}

// ─────────────────────────────────────────────────────────────
// 광고 자리 전체 표시 모드 — 2026년 10월 29일
//   주소에 ?ad_preview=all 이 있으면 서버에 "관리자냐"고 묻고, 관리자일 때만 true.
//   true 이면 AdSlot 이 모든 자리를 점선 "표시판"으로 그린다(노출 집계 없음).
//   관리자가 아니거나 주소에 없으면 항상 false → 일반 방문자는 아무 변화 없음.
// ─────────────────────────────────────────────────────────────
let mapPromise: Promise<boolean> | null = null;

/** 주소가 ?ad_preview=all 인지 */
function isMapQuery(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('ad_preview') === 'all';
  } catch {
    return false;
  }
}

export function useAdMapMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!isMapQuery()) return;
    // 한 화면의 모든 자리가 같은 질문을 한 번만 하도록 약속을 공유
    if (!mapPromise) {
      mapPromise = fetch('/api/ads/serve?q=AD-H&preview=all')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => !!(j && (j as { map?: boolean }).map))
        .catch(() => false);
    }
    let alive = true;
    mapPromise.then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
