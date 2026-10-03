// ──────────────────────────────────────────────
// 아이디 회원 — 가입·로그인 칸 검사 (React 없음, 화면·서버 공용, 테스트 대상)
//
// 실명·전화번호는 받지 않는 익명 가입이다. 칸: 아이디·비밀번호·비밀번호 확인·힌트·
// (선택) 이메일·닉네임·약관 동의. 문제가 있으면 화면에 그대로 보여 줄 한글 문장을 돌려준다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { nicknameProblem } from '@/lib/ask/format';

/** 아이디 다듬기: 앞뒤 공백 제거 + 소문자 (저장·비교는 항상 이 값으로) */
export function normalizeUsername(v: string): string {
  return v.trim().toLowerCase();
}

/** 이메일 다듬기: 앞뒤 공백 제거 + 소문자 */
export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

/** 아이디 검사 — 영문·숫자 4~16자 */
export function usernameProblem(v: string): string | null {
  const s = normalizeUsername(v);
  if (s.length < 4 || s.length > 16) return '아이디는 4~16자로 지어 주세요';
  if (!/^[a-z0-9]+$/.test(s)) return '아이디는 영문 · 숫자만 쓸 수 있어요';
  if (/^(admin|root|ulmadna|manager|system)/.test(s)) return '쓸 수 없는 아이디예요';
  return null;
}

/** 비밀번호 검사 — 영문과 숫자를 섞어 8자 이상(너무 긴 것도 막음: 암호화 도구가 72바이트까지만 봄) */
export function passwordProblem(v: string): string | null {
  if (v.length < 8) return '비밀번호는 8자 이상이에요';
  if (v.length > 64) return '비밀번호는 64자까지예요';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return '영문과 숫자를 섞어 주세요';
  return null;
}

/** 힌트 검사 — 2~30자, 비밀번호를 그대로 적으면 안 됨 */
export function hintProblem(hint: string, password?: string): string | null {
  const s = hint.trim();
  if (s.length < 2 || s.length > 30) return '힌트는 2~30자로 적어 주세요';
  if (password && s.includes(password)) return '힌트에 비밀번호를 적으면 안 돼요';
  return null;
}

/** 이메일 검사 — 선택 칸이라 비어 있으면 문제없음 */
export function emailProblem(v: string): string | null {
  const s = normalizeEmail(v);
  if (!s) return null;
  if (s.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return '이메일 형식을 확인해 주세요';
  return null;
}

export interface SignupInput {
  username: string;
  password: string;
  password2: string;
  hint: string;
  email: string;
  nickname: string;
  agree: boolean;
}

/** 가입 칸 전체 검사 — 첫 번째 문제(칸 이름 + 문장), 없으면 null */
export function signupProblem(i: SignupInput): { field: keyof SignupInput; message: string } | null {
  const checks: [keyof SignupInput, string | null][] = [
    ['username', usernameProblem(i.username)],
    ['password', passwordProblem(i.password)],
    ['password2', i.password === i.password2 ? null : '비밀번호가 서로 달라요'],
    ['hint', hintProblem(i.hint, i.password)],
    ['email', emailProblem(i.email)],
    ['nickname', nicknameProblem(i.nickname)],
    ['agree', i.agree ? null : '약관과 개인정보처리방침에 동의해 주세요'],
  ];
  for (const [field, message] of checks) if (message) return { field, message };
  return null;
}

/** 세션 회원 번호 접두사 — 아이디 회원은 "user:<uuid>", 카카오는 숫자 그대로 */
export const USER_ID_PREFIX = 'user:';
export function isIdUser(sessionUserId: string | null | undefined): boolean {
  return !!sessionUserId && sessionUserId.startsWith(USER_ID_PREFIX);
}
