import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { flushAuthError } from '@/lib/authDiag';

// NextAuth 기본 핸들러를 한 겹 감싼다.
// 이유: 로그인 도중 오류가 나면 그 원인을 응답 보내기 "직전에" 확실히 저장하기 위함.
// (서버리스 환경에서는 응답 후에 시작한 작업이 잘려나갈 수 있다)

export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  await flushAuthError(); // 붙잡아둔 오류가 있으면 기록
  return res;
}

export async function POST(req: NextRequest) {
  const res = await handlers.POST(req);
  await flushAuthError();
  return res;
}
