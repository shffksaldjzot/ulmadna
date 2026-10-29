// ─────────────────────────────────────────────────────────────
// 광고주 계정 — 비밀번호 해시·세션 토큰·로그인 잠금 (서버 전용, 2026년 10월 31일)
//
// [무슨 기능인가]
//   - 비밀번호: bcryptjs(이미 쓰는 패키지)로 해시만 저장·비교한다. 원문은 저장도 로그도 안 함.
//   - 세션: 랜덤 32바이트 값을 쿠키에 주고, DB 에는 그 값의 sha256 만 둔다
//     (DB 가 새도 쿠키 값을 되살릴 수 없게).
//   - 잠금: 관리자 로그인과 같은 방식 — 서버 메모리에서 같은 IP·이메일이 15분 안에 5번 틀리면 잠근다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/** 세션 쿠키 이름(미들웨어도 같은 이름을 본다) */
export const SESSION_COOKIE = 'partner-session';
/** 세션 유지 기간: 30일 */
export const SESSION_DAYS = 30;

/** 비밀번호 → bcrypt 해시(강도 10) */
export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

/** 비밀번호가 해시와 맞는가 */
export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash).catch(() => false);
}

/** 세션 쿠키 값 → DB 에 둘 해시(sha256 16진수 64자) */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** 새 세션: 쿠키에 줄 값(token)과 DB 에 둘 해시(hash), 만료 시각 */
export function newSession(now = Date.now()): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token), expiresAt: new Date(now + SESSION_DAYS * 86400000) };
}

/** 쿠키 값 모양 검사(base64url 43자) — 이상한 값은 DB 까지 가지 않게 */
export function isTokenShape(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
}

// ── 로그인 잠금(메모리) ───────────────────────
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MAX_FAIL = 5;
const fails = new Map<string, { count: number; start: number }>();

/** 잠겼으면 남은 초, 아니면 0 */
export function lockedFor(key: string, now = Date.now()): number {
  const e = fails.get(key);
  if (!e) return 0;
  if (now - e.start > LOCK_WINDOW_MS) {
    fails.delete(key);
    return 0;
  }
  return e.count >= LOCK_MAX_FAIL ? Math.ceil((LOCK_WINDOW_MS - (now - e.start)) / 1000) : 0;
}

/** 실패 1회 기록 */
export function recordFail(key: string, now = Date.now()): void {
  const e = fails.get(key);
  if (!e || now - e.start > LOCK_WINDOW_MS) fails.set(key, { count: 1, start: now });
  else e.count += 1;
  if (fails.size > 5000) fails.clear(); // 메모리 보호
}

/** 성공하면 기록 지움 */
export function clearFails(key: string): void {
  fails.delete(key);
}
