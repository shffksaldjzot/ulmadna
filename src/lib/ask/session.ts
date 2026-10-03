// ──────────────────────────────────────────────
// 물어보기 API — 로그인 회원 번호 꺼내기 (서버 전용)
//
// NextAuth(카카오) 세션에서 회원 번호를 꺼낸다. 로그인 설정(비밀값)이 빠진 로컬 등에서
// auth()가 오류를 던져도 API가 영어 500으로 터지지 않게 "로그인 안 됨(null)"으로 처리한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/** 로그인한 회원 번호, 아니면 null */
export async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** 공통 오류 응답 — 화면에 그대로 보여 줄 한글 문장을 담는다 */
export function fail(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
