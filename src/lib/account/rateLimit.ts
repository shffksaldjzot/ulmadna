// ──────────────────────────────────────────────
// 횟수 제한(같은 IP 가입 하루 5회, 아이디당 로그인 실패 10분 5회 등) — 서버 전용
//
// Upstash Redis 열쇠(UPSTASH_REDIS_REST_URL·TOKEN)가 있으면 거기에 센다
// (서버가 여러 대로 나뉘어 돌아도 숫자가 하나로 모임). 없으면 이 서버 메모리에 센다
// (로컬·열쇠 없는 환경용 — 서버가 다시 뜨면 0으로 돌아감).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 메모리 예비 저장소: 이름 → { 횟수, 끝나는 시각 }
const mem = new Map<string, { n: number; until: number }>();

/** Upstash에 명령 묶음 보내기 */
async function redis(cmds: (string | number)[][]): Promise<{ result: unknown }[] | null> {
  if (!URL || !TOKEN) return null;
  try {
    const r = await fetch(`${URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as { result: unknown }[];
  } catch {
    return null;
  }
}

/** 지금 몇 번인지만 본다(늘리지 않음) */
export async function peek(key: string): Promise<number> {
  const k = `rl:${key}`;
  const r = await redis([['GET', k]]);
  if (r) return Number(r[0]?.result ?? 0) || 0;
  const m = mem.get(k);
  return m && m.until > Date.now() ? m.n : 0;
}

/** 한 번 센다 → 센 뒤 횟수 */
export async function hit(key: string, windowSec: number): Promise<number> {
  const k = `rl:${key}`;
  const r = await redis([
    ['INCR', k],
    ['EXPIRE', k, windowSec, 'NX'],
  ]);
  if (r) return Number(r[0]?.result ?? 1) || 1;
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
  const r = await redis([['DEL', k]]);
  if (!r) mem.delete(k);
}

/** 요청한 사람의 IP(프록시 뒤 첫 번째 값) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

/** 잠깐 쉬기(로그인 실패 때 일부러 늦게 답해 마구 맞혀 보기를 어렵게) */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
