// ──────────────────────────────────────────────
// 횟수 제한(같은 IP 가입 하루 5회, 아이디당 로그인 실패 10분 5회 등) — 서버 전용
//
// Supabase 표 rate_limits + 함수 rate_limit_hit(원자적 +1)에 센다
// (서버가 여러 대로 나뉘어 돌아도 숫자가 하나로 모임). 표가 없거나 열쇠가 없거나
// 네트워크가 끊기면 이 서버 메모리에 센다 — 로그인을 막지 않는다.
// 작성일: 2026년 10월 03일 / 2026-10-28 Upstash → Supabase
// ──────────────────────────────────────────────
import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';

// 메모리 예비 저장소: 이름 → { 횟수, 끝나는 시각 }
const mem = new Map<string, { n: number; until: number }>();

/** 지금 몇 번인지만 본다(늘리지 않음) */
export async function peek(key: string): Promise<number> {
  const k = `rl:${key}`;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('rate_limits')
      .select('n, expires_at')
      .eq('key', k)
      .maybeSingle();
    if (!error) {
      if (!data || new Date(data.expires_at).getTime() <= Date.now()) return 0;
      return Number(data.n) || 0;
    }
  } catch {
    // 아래 메모리로 대체
  }
  const m = mem.get(k);
  return m && m.until > Date.now() ? m.n : 0;
}

/** 한 번 센다 → 센 뒤 횟수 */
export async function hit(key: string, windowSec: number): Promise<number> {
  const k = `rl:${key}`;
  try {
    const { data, error } = await getSupabaseAdmin().rpc('rate_limit_hit', {
      p_key: k,
      p_window_sec: windowSec,
    });
    if (!error && data != null) return Number(data) || 1;
  } catch {
    // 아래 메모리로 대체
  }
  const now = Date.now();
  const m = mem.get(k);
  if (!m || m.until <= now) {
    mem.set(k, { n: 1, until: now + windowSec * 1000 });
    return 1;
  }
  m.n += 1;
  return m.n;
}

/** 지운다(로그인 성공 시 실패 횟수 초기화 등) */
export async function clear(key: string): Promise<void> {
  const k = `rl:${key}`;
  mem.delete(k);
  try {
    await getSupabaseAdmin().from('rate_limits').delete().eq('key', k);
  } catch {
    // 지우기 실패는 무시(창이 지나면 저절로 풀림)
  }
}

/** 요청한 사람의 IP(프록시 뒤 첫 번째 값) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

/** 잠깐 쉬기(로그인 실패 때 일부러 늦게 답해 마구 맞혀 보기를 어렵게) */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
