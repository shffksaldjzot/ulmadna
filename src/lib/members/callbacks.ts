// ──────────────────────────────────────────────
// 회원 명부 — 로그인 콜백(jwt·session)에 끼우는 작은 함수들 (순수 함수, 시험용으로 분리)
//
// [흐름]
//   로그인 성공 → Auth.js 가 jwt 콜백을 trigger 'signIn'(또는 'signUp')으로 한 번 부른다
//   → onJwt 가 명부 기록 함수(record)를 한 번 부르고, 돌려받은 회원 번호를 token.mid 에 담는다
//   → 그 뒤 요청마다 session 콜백이 token.mid 를 session.user.memberId 로 옮긴다
//     (물어보기 닉네임 정하기·탈퇴 때 "명부의 어느 줄인지" 찾는 데 쓴다. 의미 없는 무작위 번호라 노출돼도 괜찮다)
//
// [원칙] 명부 기록이 실패하거나 늦어도 로그인은 절대 막지 않는다.
//   - record 가 오류를 던지면 삼킨다.
//   - record 가 timeoutMs 안에 안 끝나면 기다리지 않고 로그인을 계속한다.
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import { loginRecordFrom, type LoginCallbackInput, type LoginRecord } from './key';

/** 명부 기록 함수 모양 — 성공하면 회원 번호(uuid), 기록 안 했으면 null */
export type RecordLogin = (rec: LoginRecord) => Promise<string | null>;

/** jwt 콜백이 받는 값 중 우리가 보는 것만 */
export interface JwtInput extends LoginCallbackInput {
  token: Record<string, unknown>;
  trigger?: string;
}

/** 명부 기록을 기다리는 최대 시간(밀리초) — 이보다 늦으면 로그인부터 끝낸다 */
export const RECORD_TIMEOUT_MS = 2500;

/** 프라미스를 정해진 시간까지만 기다린다(늦으면 null) */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null); // 실패도 null — 로그인은 계속
      },
    );
  });
}

/**
 * jwt 콜백 본체. 로그인 순간(trigger 'signIn'·'signUp')에만 명부에 기록한다.
 * 그 밖의 요청(세션 확인 등)에서는 아무것도 안 하고 token 을 그대로 돌려준다.
 */
export async function onJwt(input: JwtInput, record: RecordLogin, timeoutMs = RECORD_TIMEOUT_MS): Promise<Record<string, unknown>> {
  const { token, trigger } = input;
  if (trigger !== 'signIn' && trigger !== 'signUp') return token;
  try {
    const rec = loginRecordFrom(input);
    if (!rec) return token;
    const memberId = await withTimeout(record(rec), timeoutMs);
    if (memberId) token.mid = memberId;
  } catch {
    // 어떤 오류든 로그인은 계속(명부 한 줄 빠지는 것보다 로그인이 막히는 게 훨씬 나쁨)
  }
  return token;
}

/** session 콜백에서 token.mid → session.user.memberId 로 옮긴다(uuid 모양일 때만) */
export function memberIdFromToken(token: Record<string, unknown> | null | undefined): string | null {
  const v = token?.mid;
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
