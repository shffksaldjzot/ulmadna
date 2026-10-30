// ─────────────────────────────────────────────────────────────
// 광고주 가입 — POST /api/partner/signup (2026년 10월 31일)
//   받는 값: { name(상호), bizNo, region, email, password, agree }
//   순서: 같은 IP 15분 5회 제한 → 칸 검사 → 비밀번호 해시 → 계정 저장 → 바로 로그인 쿠키
//   사업자번호는 형식 + 국세청 상태조회(2026-10-30). 휴업·폐업·미등록이면 막고, 국세청 장애면 통과시켜 biz_status 에 'unchecked' 기록
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isBizNo, isEmail, isPartnerRegion, normalizeBizNo, normalizeEmail, passwordProblem } from '@/lib/partner/rules';
import { hashPassword, lockedFor, newSession, recordFail, SESSION_COOKIE } from '@/server/partner/crypto';
import { checkBizNo } from '@/server/partner/ntsVerify';
import { createAccount, saveSession } from '@/server/partner/store';
import { clientIp, sessionCookieOptions } from '@/server/partner/session';
import { fail } from '../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcryptjs·crypto 는 Node 런타임에서만

export async function POST(req: Request) {
  const key = `su:${clientIp(req)}`;
  if (lockedFor(key)) return fail(429, '잠시 뒤에 다시 시도해 주세요');
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return fail(400, '보낸 내용을 읽지 못했어요');
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  const bizNo = normalizeBizNo(raw.bizNo);
  const email = normalizeEmail(raw.email);
  // 칸 검사(화면에도 같은 검사가 있지만 서버에서 다시 본다)
  if (!name) return fail(400, '상호를 적어 주세요');
  if (!isBizNo(bizNo)) return fail(400, '사업자번호를 다시 확인해 주세요(10자리, 하이픈 없이)');
  if (!isPartnerRegion(raw.region)) return fail(400, '주로 시공하는 지역을 골라 주세요');
  if (!isEmail(email)) return fail(400, '이메일을 다시 확인해 주세요');
  const pw = passwordProblem(raw.password);
  if (pw) return fail(400, pw);
  if (raw.agree !== true) return fail(400, '약관에 동의해 주세요');

  // 국세청 상태조회 한 번 더(화면의 [확인]을 건너뛴 요청 대비). 장애면 막지 않고 'unchecked' 로 기록
  const nts = await checkBizNo(bizNo);
  if (nts.ok && nts.kind === 'closed') return fail(400, '휴업·폐업 사업자예요');
  if (nts.ok && nts.kind === 'unknown') return fail(400, '등록되지 않은 사업자번호예요');
  const bizStatus = nts.ok ? 'active' : 'unchecked';

  recordFail(key); // 가입 시도 횟수 기록(같은 IP 15분 5회)
  const r = await createAccount({ name, bizNo, region: raw.region, email, passwordHash: await hashPassword(String(raw.password)), bizStatus });
  if (!r.ok) return fail(r.code === 'dup' ? 409 : 503, r.error);

  // 가입하자마자 로그인 상태로
  const s = newSession();
  const res = NextResponse.json({ ok: true });
  if (await saveSession(r.data.advertiserId, s.hash, s.expiresAt)) res.cookies.set(SESSION_COOKIE, s.token, sessionCookieOptions());
  return res;
}
