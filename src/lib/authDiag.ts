// ─────────────────────────────────────────────────────────────
// 카카오 로그인 오류 진단 기록기 (authDiag)
//
// 왜 필요한가:
//   NextAuth는 로그인 도중 무슨 일이 나든 사용자를 전부 똑같은
//   "error=Configuration" 화면으로 보내버린다. 그래서 화면만 봐서는
//   (1) 카카오가 열쇠(client_secret)를 거부한 건지
//   (2) 동의항목이 막힌 건지
//   (3) 우리 코드가 터진 건지 구분이 안 된다.
//
//   그래서 진짜 원인(카카오가 보내준 오류코드 KOE0xx 등)을
//   Upstash Redis에 짧게 남겨두고 운영자가 나중에 꺼내볼 수 있게 한다.
//
// 안전장치:
//   - 실패해도 절대 로그인 흐름을 막지 않는다 (try/catch로 전부 삼킴)
//   - 최근 20건만 보관, 7일 뒤 자동 삭제
//   - 인증코드/토큰처럼 민감한 값은 지우고 저장
// ─────────────────────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis에 쌓이는 목록 이름
const KEY = 'authdiag:errors';
// 보관 개수 / 보관 기간(초) = 7일
const KEEP = 20;
const TTL_SEC = 60 * 60 * 24 * 7;

// 이번 요청에서 붙잡은 오류를 잠깐 담아두는 상자
// (NextAuth의 logger는 "기다려주지 않기" 때문에, 여기 담아뒀다가
//  라우트에서 응답 직전에 확실히 저장한다)
let pending: Record<string, unknown> | null = null;

// 민감 정보 지우기 — 인증코드/토큰/시크릿 값이 문자열에 섞여 있으면 마스킹
function mask(text: string): string {
  return text
    .replace(/(code=)[^\s&"']+/gi, '$1***')
    .replace(/(access_token|refresh_token|client_secret|id_token)["'=:\s]+[^\s&"',}]+/gi, '$1=***')
    .slice(0, 500); // 너무 길면 자르기
}

// 오류 객체에서 "쓸모 있는 정보"만 골라 평평한 객체로 만든다
function summarize(error: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!(error instanceof Error)) {
    out.raw = mask(String(error));
    return out;
  }

  // 오류 이름 — NextAuth 오류는 .type에 진짜 종류가 들어있다
  const type = (error as Error & { type?: string }).type;
  out.name = type || error.name;
  out.message = mask(error.message);

  // cause 안에 카카오가 돌려준 실제 오류코드(KOE320 등)가 들어있다
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    for (const [k, v] of Object.entries(cause as Record<string, unknown>)) {
      if (v instanceof Error) {
        // 중첩된 오류 — 이름과 메시지만
        out[`${k}_name`] = (v as Error & { type?: string }).type || v.name;
        out[`${k}_message`] = mask(v.message);
        // oauth4webapi의 ResponseBodyError는 여기에 카카오 응답을 담고 있다
        const inner = v as Error & { cause?: unknown; error?: unknown; error_description?: unknown };
        if (typeof inner.error === 'string') out.kakao_error = inner.error;
        if (typeof inner.error_description === 'string') out.kakao_error_description = mask(inner.error_description);
        const innerCause = inner.cause;
        if (innerCause && typeof innerCause === 'object') {
          for (const [ik, iv] of Object.entries(innerCause as Record<string, unknown>)) {
            if (typeof iv === 'string' || typeof iv === 'number' || typeof iv === 'boolean') {
              out[`kakao_${ik}`] = typeof iv === 'string' ? mask(iv) : iv;
            }
          }
        }
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = typeof v === 'string' ? mask(v) : v;
      }
    }
  }
  return out;
}

/** NextAuth logger가 오류를 던질 때 호출 — 저장은 안 하고 상자에만 담아둔다 */
export function captureAuthError(error: unknown): void {
  try {
    pending = { at: new Date().toISOString(), ...summarize(error) };
  } catch {
    // 진단 코드가 로그인을 막으면 안 되므로 조용히 무시
  }
}

/** 요청이 끝나기 직전 호출 — 담아둔 오류가 있으면 Upstash에 확실히 저장 */
export async function flushAuthError(): Promise<void> {
  const item = pending;
  pending = null;
  if (!item || !UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // 최신 항목을 맨 앞에 넣고(LPUSH), 20건만 남기고(LTRIM), 7일 뒤 삭제(EXPIRE)
      body: JSON.stringify([
        ['LPUSH', KEY, JSON.stringify(item)],
        ['LTRIM', KEY, 0, KEEP - 1],
        ['EXPIRE', KEY, TTL_SEC],
      ]),
      cache: 'no-store',
    });
  } catch {
    // 저장 실패해도 로그인 흐름에는 영향 없음
  }
}
