// ──────────────────────────────────────────────
// 회원 명부 — "같은 사람" 판별값 만들기와 로그인 정보 정리 (순수 함수)
//
// [무슨 기능인가]
//   1) memberKeyOf: 카카오 고유 번호(또는 아이디 회원 번호)를 원문 그대로 저장하지 않으려고,
//      사이트 서버만 아는 비밀값(MEMBER_HASH_SECRET)을 섞어 64글자 값으로 바꾼다(HMAC-SHA256).
//      같은 사람이면 늘 같은 값 → 같은 사람인지 알아볼 수 있다.
//      비밀값 없이 "숫자 하나하나 넣어 보기"로는 원래 번호를 되찾을 수 없다
//      (카카오 번호는 10자리 남짓 숫자라, 비밀값 없는 그냥 해시는 금방 풀린다 → 비밀값 필수).
//   2) loginRecordFrom: 로그인 콜백이 받은 값(user·account)에서 명부에 넣을 것만 고른다.
//
// [왜 카카오는 account.providerAccountId 를 쓰나]
//   지금 쓰는 로그인 라이브러리(Auth.js 5, DB 연결 없이 쓰는 방식)는 카카오 로그인 때
//   세션 회원 번호(user.id)를 "매번 새로 뽑는 무작위 번호"로 준다. 그래서 같은 사람도
//   로그인할 때마다 세션 번호가 달라진다. 변하지 않는 카카오 고유 번호는
//   account.providerAccountId 에만 들어 있어서 그걸로 판별값을 만든다.
//
// 이 파일은 'server-only' 표식을 달지 않는다(시험에서 그대로 불러 쓰려고).
// 비밀값은 인자로만 받고, 파일 안에서 환경변수를 읽지 않는다.
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import { createHmac } from 'node:crypto';

/** 로그인 수단: 카카오 / 아이디(+비밀번호) */
export type MemberProvider = 'kakao' | 'id';

/** 아이디 회원 세션 번호 앞머리("user:<uuid>") — src/lib/account/validate.ts 의 USER_ID_PREFIX 와 같은 값 */
const ID_PREFIX = 'user:';

/**
 * 같은 사람 판별값 만들기.
 * @param stableId 변하지 않는 회원 고유값(카카오 = 카카오 고유 번호, 아이디 회원 = "user:<uuid>")
 * @param secret   MEMBER_HASH_SECRET(16글자 이상). 없거나 짧으면 null(= 기록하지 않음)
 * @returns 소문자 16진수 64글자, 또는 null
 */
export function memberKeyOf(stableId: string | null | undefined, secret: string | null | undefined): string | null {
  const id = (stableId ?? '').trim();
  const s = (secret ?? '').trim();
  if (!id || s.length < 16) return null;
  // 앞에 "ulmadna-member:" 를 붙여 다른 용도의 해시와 절대 같은 값이 안 나오게 한다
  return createHmac('sha256', s).update(`ulmadna-member:${id}`).digest('hex');
}

/** 명부에 넣을 로그인 정보(판별값 만들기 전 단계) */
export interface LoginRecord {
  provider: MemberProvider;
  /** 변하지 않는 고유값(판별값 재료) — 카카오 고유 번호 또는 "user:<uuid>" */
  stableId: string;
  /** 세션 회원 번호(token.sub) — 물어보기 닉네임(ask_profiles) 찾을 때 씀 */
  sessionId: string | null;
  /** 아이디 회원이면 ask_users 줄 번호(uuid), 카카오면 null */
  askUserId: string | null;
  /** 닉네임(아이디 회원 = 사이트 닉네임, 카카오 = 카카오 닉네임). 없으면 null */
  nickname: string | null;
}

/** 로그인 콜백이 넘겨주는 값 중 우리가 보는 것만(라이브러리 타입에 묶이지 않게 느슨하게) */
export interface LoginCallbackInput {
  user?: { id?: string | null; name?: string | null } | null;
  account?: { provider?: string | null; providerAccountId?: string | null } | null;
}

/**
 * 로그인 콜백 값 → 명부용 정보. 우리가 아는 로그인 수단이 아니거나 고유값이 없으면 null.
 * 이메일·사진은 일부러 받지 않는다(개인정보 최소).
 */
export function loginRecordFrom(input: LoginCallbackInput): LoginRecord | null {
  const provider = input.account?.provider ?? '';
  const nickname = cleanNickname(input.user?.name);
  const sessionId = input.user?.id ? String(input.user.id) : null;

  if (provider === 'kakao') {
    const kakaoId = String(input.account?.providerAccountId ?? '').trim();
    // 카카오 고유 번호는 숫자만 — 아니면 이상한 값이라 기록하지 않는다
    if (!/^\d{1,20}$/.test(kakaoId)) return null;
    return { provider: 'kakao', stableId: kakaoId, sessionId, askUserId: null, nickname };
  }

  if (provider === 'credentials') {
    // 아이디 회원의 세션 번호는 "user:<uuid>" (src/lib/auth.ts 의 authorize 가 그렇게 만든다)
    const sid = sessionId ?? String(input.account?.providerAccountId ?? '');
    if (!sid.startsWith(ID_PREFIX)) return null;
    const uuid = sid.slice(ID_PREFIX.length);
    if (!/^[0-9a-f-]{36}$/i.test(uuid)) return null;
    return { provider: 'id', stableId: sid, sessionId: sid, askUserId: uuid.toLowerCase(), nickname };
  }

  return null;
}

/** 닉네임 정리 — 앞뒤 공백 제거, 40글자까지, 비면 null */
export function cleanNickname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 40);
  return t ? t : null;
}

/**
 * 세션 회원 번호(물어보기·탈퇴 화면에서 아는 값)로 판별값 재료 고르기.
 * - 아이디 회원 "user:<uuid>" → 그대로(로그인 때와 같은 재료)
 * - 카카오: 세션 번호가 무작위라 판별값을 만들 수 없음 → null
 *   (이때는 세션에 담아 둔 회원 번호 memberId 로 찾는다)
 */
export function stableIdFromSession(sessionId: string | null | undefined): string | null {
  const sid = (sessionId ?? '').trim();
  return sid.startsWith(ID_PREFIX) ? sid : null;
}
