// ──────────────────────────────────────────────
// GA4(구글 애널리틱스4) 실시간 활성 사용자 수 조회
//
// [왜 필요한가]
//   푸터의 "지금 n명 보는 중"을 전에는 Upstash Redis로 직접 집계했는데,
//   무료 월 요청 한도(50만 건)를 금방 넘겨버렸다(2026-10-08).
//   GA4가 이미 "실시간 활성 사용자 수"를 정확히 세고 있으니,
//   그 숫자를 그대로 가져다 쓰면 별도 집계 인프라가 필요 없다.
//
//   blog_pipeline/src/ga.mjs(블로그 리포트 봇)와 똑같은 방식으로
//   서비스 계정 키로 JWT(서명된 인증서)를 만들어 구글 OAuth 서버에 제출 →
//   액세스 토큰 발급 → GA4 Data API의 runRealtimeReport 호출.
//   다만 여기는 Vercel 서버(Next.js) 환경이라 키 파일을 올려둘 수 없어서,
//   환경변수(GA_SA_CLIENT_EMAIL / GA_SA_PRIVATE_KEY / GA_PROPERTY_ID)로 받는다.
//
// 작성일: 2026년 10월 10일
// ──────────────────────────────────────────────
import crypto from 'crypto';

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'; // "읽기 전용" 권한만 요청
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

/** 서비스 계정으로 "나는 이 스코프를 읽을 자격이 있다"는 서명된 JWT를 만든다 (RS256) */
function signServiceAccountJWT(clientEmail: string, privateKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail, // 발급자 = 서비스 계정 이메일
    scope: GA_SCOPE,
    aud: TOKEN_URI, // 이 토큰을 받을 곳 = 구글 OAuth 서버
    iat: now,
    exp: now + 3600, // 유효 1시간
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encClaim = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const signingInput = `${encHeader}.${encClaim}`;
  // RS256 = RSA 개인키로 SHA-256 서명. 서비스 계정의 private key로 서명한다.
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

/** 서명된 JWT를 구글 OAuth 서버에 제출해 진짜 액세스 토큰을 받아온다 */
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = signServiceAccountJWT(clientEmail, privateKey);
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.access_token) {
    // 2026-10-10: 라이브에서 count:null만 뜨고 원인을 알 수 없었던 이유 —
    // 기존 코드가 이 실패를 조용히 삼켜서 Vercel 로그에 아예 안 남았다.
    // 토큰 발급 실패는 보통 "JWT 서명이 구글이 기대하는 형식과 다르다"는 뜻이라
    // 키 자체(비밀정보)는 절대 찍지 않고 구글이 돌려준 에러 사유만 한 줄 남긴다.
    throw new Error('GA 토큰 발급 실패(' + res.status + '): ' + (data.error_description || data.error || '알 수 없음'));
  }
  return data.access_token as string;
}

/**
 * 지금 이 순간 사이트를 보고 있는 GA4 실시간 활성 사용자 수를 가져온다.
 * (GA4 실시간 보고서 기본 집계창 = 최근 30분 활동)
 *
 * 환경변수(GA_SA_CLIENT_EMAIL / GA_SA_PRIVATE_KEY / GA_PROPERTY_ID)가 없거나
 * 중간에 무엇이든 실패하면 조용히 null을 돌려준다 — 호출부가 "숫자 없으면 숨김" 처리.
 * 다만 실패했을 때는(비밀값은 절대 찍지 않고) 원인만 콘솔에 한 줄 남겨서
 * Vercel 로그로 왜 null이 나왔는지 바로 알 수 있게 한다.
 */
export async function fetchActiveUsersNow(): Promise<number | null> {
  const clientEmail = process.env.GA_SA_CLIENT_EMAIL;
  const rawKey = process.env.GA_SA_PRIVATE_KEY;
  const propertyId = process.env.GA_PROPERTY_ID;

  if (!clientEmail || !rawKey || !propertyId) {
    // 환경변수 자체가 비어있는 경우 — 값은 찍지 않고 "있다/없다"만 남긴다
    console.error('[presence] GA 환경변수 누락 — clientEmail:%s privateKey:%s propertyId:%s', !!clientEmail, !!rawKey, !!propertyId);
    return null;
  }

  // Vercel에 원문(실제 줄바꿈 포함)으로 넣었든, 다른 곳에서 흔히 쓰는 "\n" 두 글자로
  // 넣었든 둘 다 받아내도록 두 경우 다 처리한다. 이미 실제 줄바꿈이 있으면 그대로 두고,
  // 리터럴 "\n" 글자가 보이면 그걸 실제 줄바꿈으로 바꿔준다.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    // PEM 헤더가 없다 = 줄바꿈 변환이 잘못됐거나 키가 중간에 잘렸다는 뜻
    console.error('[presence] GA_SA_PRIVATE_KEY가 PEM 형식이 아님(BEGIN PRIVATE KEY 헤더 없음) — 줄바꿈 처리 확인 필요');
    return null;
  }

  try {
    const token = await getAccessToken(clientEmail, privateKey);
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      // GA4 쪽에서 403(권한 없음)·400(속성 ID 오류) 등을 돌려준 경우 — 응답 본문을 그대로 한 줄 남긴다
      const body = await res.text().catch(() => '');
      console.error('[presence] GA4 runRealtimeReport 실패(%d): %s', res.status, body.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const raw = data?.rows?.[0]?.metricValues?.[0]?.value;
    const count = raw != null ? Number(raw) : 0;
    return Number.isFinite(count) ? count : null;
  } catch (err) {
    // 네트워크 오류·JWT 서명 실패·토큰 발급 실패 등 — 예외 메시지만(비밀값 없이) 한 줄 남긴다
    console.error('[presence] GA 조회 중 예외: %s', err instanceof Error ? err.message : String(err));
    return null;
  }
}
