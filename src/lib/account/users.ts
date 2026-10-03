// ──────────────────────────────────────────────
// 아이디 회원 — DB 읽기·쓰기와 암호화 (서버 전용)
//
// - 비밀번호는 bcryptjs 로 암호화한 값만 저장·비교한다(원문은 저장도 로그 출력도 안 함).
// - 재설정 열쇠는 무작위 32바이트 → 메일에는 원문, DB에는 sha256 값만.
// - 표: ask_users, ask_password_resets (supabase/migrations/20261003_ask_users.sql)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { adminOrNull } from '@/lib/ask/server';
import { normalizeEmail, normalizeUsername, USER_ID_PREFIX } from './validate';

export interface AskUser {
  id: string;
  username: string;
  password_hash: string;
  hint: string;
  email: string | null;
  nickname: string;
  status: 'active' | 'blocked';
}

/** 비밀번호 → 암호화 값(10단계) */
export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

/** 비밀번호가 암호화 값과 맞는지 */
export function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** 세션 회원 번호 "user:<uuid>" ↔ uuid */
export const sessionIdOf = (uuid: string) => `${USER_ID_PREFIX}${uuid}`;
export const uuidOf = (sessionId: string) => (sessionId.startsWith(USER_ID_PREFIX) ? sessionId.slice(USER_ID_PREFIX.length) : null);

/**
 * 로그인 칸 값으로 회원 찾기 — "@"가 있으면 이메일로, 없으면 아이디로.
 * 표가 없거나 연결이 안 되면 null.
 */
export async function findUserByLogin(login: string): Promise<AskUser | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const isEmail = login.includes('@');
  const v = isEmail ? normalizeEmail(login) : normalizeUsername(login);
  if (!v) return null;
  const { data, error } = await sb
    .from('ask_users')
    .select('id,username,password_hash,hint,email,nickname,status')
    .eq(isEmail ? 'email' : 'username', v)
    .maybeSingle();
  if (error || !data) return null;
  return data as AskUser;
}

/** uuid로 회원 찾기 */
export async function findUserById(uuid: string): Promise<AskUser | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from('ask_users')
    .select('id,username,password_hash,hint,email,nickname,status')
    .eq('id', uuid)
    .maybeSingle();
  if (error || !data) return null;
  return data as AskUser;
}

/** 재설정 열쇠 만들기 → { token(원문, 메일용), hash(DB용) } */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}
