// ──────────────────────────────────────────────
// 자체 집계 저장소 — Supabase 일별 표에 숫자 +1 / 읽기 (2026-10-27 Upstash → Supabase 이전)
//
// [무슨 기능인가]
//   글 조회수·계산기 실행·문의 클릭·좋아요를 Supabase 의 더하기 함수(metrics_bump_*)
//   한 번 호출로 센다. 표·함수 정의는 supabase/migrations/20261027_metrics.sql.
//
// [안전장치]
//   - 쓰기(+1)는 응답을 늦추지 않게 Next.js after() 로 "응답을 다 보낸 뒤" 실행한다.
//     요청 바깥(스크립트 등)이라 after() 가 안 되면 기다리지 않고 바로 던져 둔다.
//   - Supabase 열쇠가 없거나(로컬 개발), 표가 아직 없거나(SQL 적용 전), 네트워크가 끊겨도
//     예외를 밖으로 던지지 않는다 — 숫자 하나 빠질 뿐 화면·계산은 그대로 동작한다.
//   - 봇(검색 수집기 등)은 호출하는 쪽에서 isBotUA 로 먼저 걸러서 여기까지 오지 않는다.
//
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import 'server-only';
import { after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DeviceKind, RegionCode, TrafficSource } from './requestInfo';

/** 더하기 함수 하나를 부른다. 실패하면 조용히 null (절대 예외 안 던짐) */
async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc(name, args);
    if (error) return null;
    return data;
  } catch {
    return null; // 열쇠 없음·네트워크 실패 등
  }
}

/** 응답 뒤에 실행(after) — 안 되면 바로 실행. 어느 쪽이든 결과는 기다리지 않는다 */
function runLater(job: () => Promise<unknown>): void {
  try {
    after(job);
  } catch {
    void job().catch(() => {});
  }
}

/** 시험에서 바꿔 끼울 수 있게 내보내는 내부 도구 */
export const __internal = { callRpc, runLater };

// ── 쓰기 (+1) ──────────────────────────────────

/** 글·계산기 결과 화면 조회 +1 */
export function bumpPageView(
  slug: string,
  region: RegionCode,
  device: DeviceKind,
  src: TrafficSource,
): void {
  runLater(() =>
    callRpc('metrics_bump_view', { p_slug: slug, p_region: region, p_device: device, p_src: src }),
  );
}

/** 계산기 실행 +1 */
export function bumpCalcRun(args: {
  process: 'wallpaper' | 'flooring' | 'mortar' | 'tile';
  mode: 'quick' | 'precise';
  pyeongBucket: string;
  region: RegionCode;
  device: DeviceKind;
  src: TrafficSource;
}): void {
  runLater(() =>
    callRpc('metrics_bump_calc', {
      p_process: args.process,
      p_mode: args.mode,
      p_pyeong_bucket: args.pyeongBucket,
      p_region: args.region,
      p_device: args.device,
      p_src: args.src,
    }),
  );
}

/** 문의 클릭 +1 */
export function bumpContactClick(kind: 'phone' | 'kakao', page: string, region: RegionCode): void {
  runLater(() => callRpc('metrics_bump_contact', { p_kind: kind, p_page: page, p_region: region }));
}

/**
 * 좋아요 +1 / -1 — 누른 사람에게 바뀐 숫자를 바로 보여줘야 해서 이것만은 결과를 기다린다.
 * 실패하면 null(화면은 낙관적으로 바꿔 둔 숫자를 그대로 씀).
 */
export async function bumpLike(slug: string, on: boolean): Promise<number | null> {
  const r = await callRpc('metrics_bump_like', { p_slug: slug, p_delta: on ? 1 : -1 });
  const n = Number(r);
  return r !== null && Number.isFinite(n) ? Math.max(0, n) : null;
}

// ── 읽기 ───────────────────────────────────────

/** 글 하나의 누적 조회수·좋아요. 실패하면 null (화면에서 숫자 숨김) */
export async function readPostTotals(slug: string): Promise<{ views: number; likes: number } | null> {
  const r = await callRpc('metrics_post_totals', { p_slug: slug });
  // 표를 돌려주는 함수라 배열 [{views, likes}] 로 온다
  const row = Array.isArray(r) ? r[0] : null;
  if (!row) return null;
  const views = Number((row as { views?: unknown }).views);
  const likes = Number((row as { likes?: unknown }).likes);
  return {
    views: Number.isFinite(views) ? views : 0,
    likes: Number.isFinite(likes) ? likes : 0,
  };
}
