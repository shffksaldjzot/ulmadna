// ──────────────────────────────────────────────
// 관리자 API 공용 확인 함수 — 2026-10-28
//
// [무슨 기능인가]
//   /api 경로는 미들웨어 보호를 안 거치므로, 관리자 전용 API 는 요청 쿠키(admin-auth)가
//   로그인 때 심은 값과 같은지 여기서 직접 확인한다(기존 admin-users 와 같은 방식).
//   글자 길이가 달라도 시간 차이로 값이 새지 않게 timingSafeEqual 로 비교한다.
// ──────────────────────────────────────────────
import crypto from 'crypto';

/** 요청이 관리자 로그인 쿠키를 가졌는지. 환경변수가 없으면 무조건 false */
export function isAdminRequest(req: Request): boolean {
  const token = process.env.NEXTAUTH_SECRET;
  if (!token) return false;
  const cookie = (req.headers.get('cookie') || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('admin-auth='));
  // 2026-10-29: 쿠키 값은 저장될 때 특수문자가 %인코딩되므로 풀어서 비교한다(미들웨어 request.cookies.get 과 같은 결과).
  const raw = cookie?.slice('admin-auth='.length);
  let value = raw;
  try { value = raw ? decodeURIComponent(raw) : raw; } catch { /* 잘못된 인코딩이면 원래 값 그대로 */ }
  if (!value) return false;
  const a = crypto.createHash('sha256').update(value).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}
