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
    throw new Error('GA 토큰 발급 실패: ' + (data.error_description || data.error || res.status));
  }
  return data.access_token as string;
}

/**
 * 지금 이 순간 사이트를 보고 있는 GA4 실시간 활성 사용자 수를 가져온다.
 * (GA4 실시간 보고서 기본 집계창 = 최근 30분 활동)
 *
 * 환경변수(GA_SA_CLIENT_EMAIL / GA_SA_PRIVATE_KEY / GA_PROPERTY_ID)가 없거나
 * 중간에 무엇이든 실패하면 조용히 null을 돌려준다 — 호출부가 "숫자 없으면 숨김" 처리.
 */
export async function fetchActiveUsersNow(): Promise<number | null> {
  const clientEmail = process.env.GA_SA_CLIENT_EMAIL;
  // Vercel 환경변수는 실제 줄바꿈을 못 담아서 "\n" 두 글자로 저장해두므로, 여기서 되돌린다
  const privateKey = process.env.GA_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!clientEmail || !privateKey || !propertyId) return null;

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
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.rows?.[0]?.metricValues?.[0]?.value;
    const count = raw != null ? Number(raw) : 0;
    return Number.isFinite(count) ? count : null;
  } catch {
    return null; // 네트워크 오류·키 오류 등 무엇이든 실패하면 조용히 null
  }
}
