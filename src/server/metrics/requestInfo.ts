// ──────────────────────────────────────────────
// 요청 정보 → 집계 칸 값 바꾸기 (지역·기기·유입·봇 판정)
//
// [무슨 기능인가]
//   조회수·계산기·문의 클릭을 Supabase 일별 표에 +1 할 때, "어느 시도에서·어떤 기기로·
//   어디서 들어온 사람인지"를 요청 머리글(headers)에서 뽑아 짧은 코드 하나로 바꾼다.
//   IP 주소·브라우저 정보(user-agent) 원문은 절대 저장하지 않는다 — 코드 한 단어만 남긴다.
//
// [왜 'server-only' 표식이 없나]
//   이 파일은 순수 함수뿐이라 미들웨어(middleware.ts, 유입 표식 쿠키를 심는 곳)와
//   시험(vitest)에서도 불러 써야 한다. 비밀 열쇠는 하나도 안 들어 있다.
//
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────

/** 지역 코드 — 시도 번호(ISO 3166-2:KR 숫자 부분) + 해외(ZZ) + 모름(unknown) */
export type RegionCode =
  | '11' | '26' | '27' | '28' | '29' | '30' | '31' | '41' | '43' | '44'
  | '46' | '47' | '48' | '49' | '50' | '51' | '52' | 'ZZ' | 'unknown';

/** 기기 종류 — 휴대폰 / 태블릿 / PC / 모름 */
export type DeviceKind = 'mobile' | 'tablet' | 'pc' | 'unknown';

/** 유입 경로 — 주소 직접 / 검색 / 결과 공유 링크 / 그 밖 */
export type TrafficSource = 'direct' | 'search' | 'share' | 'other';

/** 유입 경로를 세션 동안 기억하는 쿠키 이름 (값은 위 4개 단어 중 하나뿐, 개인정보 없음) */
export const SRC_COOKIE = 'ulm_src';

// ── 시도 번호 대응표 ──
// Vercel 이 붙여 주는 머리글 x-vercel-ip-country-region 의 값은 ISO 3166-2 지역 코드의
// 뒷부분이다(예: 서울 KR-11 → "11"). 강원·전북은 특별자치도 전환으로 번호가 바뀌어서
// 옛 번호(42·45)로 와도 새 번호(51·52)로 합쳐 센다.
const KR_REGION_MAP: Record<string, RegionCode> = {
  '11': '11', // 서울
  '26': '26', // 부산
  '27': '27', // 대구
  '28': '28', // 인천
  '29': '29', // 광주
  '30': '30', // 대전
  '31': '31', // 울산
  '50': '50', // 세종
  '41': '41', // 경기
  '42': '51', // 강원(옛 번호) → 새 번호
  '51': '51', // 강원특별자치도
  '43': '43', // 충북
  '44': '44', // 충남
  '45': '52', // 전북(옛 번호) → 새 번호
  '52': '52', // 전북특별자치도
  '46': '46', // 전남
  '47': '47', // 경북
  '48': '48', // 경남
  '49': '49', // 제주
};

/** 머리글 읽기 도우미 — Headers 객체가 없으면 빈 값 */
function h(headers: Headers | null | undefined, name: string): string {
  try {
    return headers?.get(name) ?? '';
  } catch {
    return '';
  }
}

/**
 * 요청 머리글 → 지역 코드.
 *   - 나라가 한국이 아니면 'ZZ'(해외)
 *   - 한국이면 시도 번호를 위 대응표로 바꾸고, 표에 없는 값이면 'unknown'
 *   - 머리글이 아예 없으면(로컬 개발 등) 'unknown'
 */
export function regionFromHeaders(headers: Headers | null | undefined): RegionCode {
  const country = h(headers, 'x-vercel-ip-country').trim().toUpperCase();
  if (country && country !== 'KR') return 'ZZ';
  // 혹시 "KR-11" 꼴로 오더라도 뒤 숫자만 쓰도록 앞의 "KR-" 를 떼어 낸다
  const raw = h(headers, 'x-vercel-ip-country-region').trim().toUpperCase().replace(/^KR-/, '');
  if (!raw) return 'unknown';
  return KR_REGION_MAP[raw] ?? 'unknown';
}

/**
 * user-agent → 기기 종류 (아주 단순한 판정 — 통계용이라 대략이면 충분)
 *   iPad·Android 태블릿(Android 인데 Mobile 표시가 없음)·Tablet → tablet
 *   iPhone·Android Mobile·Mobile 표시 → mobile
 *   그 외 값이 있으면 pc, 비어 있으면 unknown
 */
export function deviceFromUA(ua: string | null | undefined): DeviceKind {
  const s = (ua ?? '').trim();
  if (!s) return 'unknown';
  if (/iPad|Tablet|PlayBook|Silk/i.test(s)) return 'tablet';
  if (/Android/i.test(s) && !/Mobile/i.test(s)) return 'tablet';
  if (/iPhone|iPod|Mobile|Android|Windows Phone/i.test(s)) return 'mobile';
  return 'pc';
}

// ── 봇(검색엔진 수집기·자동 프로그램) 판정 목록 ──
// 사람이 아닌 프로그램이 글을 열거나 API 를 두드리면 숫자가 부풀어서 집계에서 뺀다.
// user-agent 안에 아래 단어 중 하나라도 들어 있으면(대소문자 무시) 봇으로 본다.
export const BOT_UA_WORDS: readonly string[] = [
  'bot', // Googlebot·bingbot·Yeti 외 대부분의 "~bot"
  'crawler', // 각종 수집기
  'spider', // Baiduspider 등
  'crawl', // "crawl" 이 들어간 수집기
  'slurp', // 야후 수집기
  'yeti', // 네이버 검색 수집기(Yeti)
  'daumoa', // 다음 검색 수집기(Daumoa) — 'daum' 만 쓰면 다음 앱 안 브라우저(사람)까지 걸러져서 정확한 이름으로
  'facebookexternalhit', // 페이스북 링크 미리보기
  'kakaotalk-scrap', // 카카오톡 링크 미리보기
  'headless', // 화면 없는 자동 브라우저(HeadlessChrome)
  'lighthouse', // 구글 속도 측정 도구
  'pagespeed', // 구글 페이지 속도 검사
  'preview', // 각종 링크 미리보기
  'python-requests', // 파이썬 자동 요청
  'curl', // 명령줄 요청 도구
  'wget', // 명령줄 내려받기 도구
  'axios', // 자바스크립트 자동 요청
  'node-fetch', // 노드 자동 요청
  'go-http-client', // Go 언어 자동 요청
  'vercel-screenshot', // Vercel 배포 미리보기 캡처
];

/** user-agent 가 봇이면 true. 비어 있는 user-agent 도 사람 브라우저가 아니라서 봇으로 본다. */
export function isBotUA(ua: string | null | undefined): boolean {
  const s = (ua ?? '').toLowerCase();
  if (!s.trim()) return true;
  return BOT_UA_WORDS.some((w) => s.includes(w));
}

// ── 검색엔진 주소 목록 (유입 경로 '검색' 판정용) ──
const SEARCH_HOST_RE = /(^|\.)(google\.[a-z.]+|naver\.com|daum\.net|bing\.com|yahoo\.[a-z.]+|duckduckgo\.com|zum\.com|nate\.com|baidu\.com|yandex\.[a-z.]+|ecosia\.org)$/i;

/**
 * 첫 화면 요청의 ref 쿼리 + Referer(직전 사이트 주소) → 유입 경로.
 *   - 주소에 ?ref=share 가 있으면 share(계산 결과 공유 링크로 들어옴)
 *   - Referer 가 없으면 direct(주소 직접 입력·즐겨찾기·카톡 앱 안 열기 등)
 *   - Referer 가 검색엔진이면 search
 *   - 그 밖의 사이트 → other
 *   - Referer 가 우리 사이트 안이면 null(사이트 안 이동 — 처음 들어온 경로를 바꾸지 않음)
 *
 * @param refParam 주소의 ref 쿼리 값
 * @param referer  Referer 머리글 값
 * @param ownHost  우리 사이트 주소(host) — 사이트 안 이동 판정용
 */
export function classifySource(
  refParam: string | null | undefined,
  referer: string | null | undefined,
  ownHost: string | null | undefined,
): TrafficSource | null {
  if ((refParam ?? '').toLowerCase() === 'share') return 'share';
  const r = (referer ?? '').trim();
  if (!r) return 'direct';
  let host = '';
  try {
    host = new URL(r).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  const own = (ownHost ?? '').toLowerCase().replace(/:\d+$/, '');
  // ulmadna.com ↔ www.ulmadna.com 도 같은 사이트로 본다
  const bare = (x: string) => x.replace(/^www\./, '');
  if (own && bare(host) === bare(own)) return null;
  if (SEARCH_HOST_RE.test(host)) return 'search';
  return 'other';
}

/** 쿠키 값 → 유입 경로 (모르는 값·없으면 direct) */
export function sourceFromCookie(value: string | null | undefined): TrafficSource {
  const v = (value ?? '').toLowerCase();
  return v === 'search' || v === 'share' || v === 'other' || v === 'direct' ? v : 'direct';
}

/** Cookie 머리글 문자열에서 유입 쿠키 값을 꺼낸다 (Request.headers 만 있을 때용) */
export function sourceFromCookieHeader(cookieHeader: string | null | undefined): TrafficSource {
  const m = (cookieHeader ?? '').match(new RegExp(`(?:^|;\\s*)${SRC_COOKIE}=([^;]*)`));
  return sourceFromCookie(m?.[1]);
}

/**
 * Referer 주소 → 집계용 화면 경로 (문의 클릭을 "어느 화면에서 눌렀나" 칸에 쓰는 값)
 *   - 우리 사이트 주소가 아니거나 비어 있으면 'unknown'
 *   - 쿼리(?d=… 같은 견적 조건)는 버리고 경로만, 소문자로
 *   - 허용 글자(영문 소문자·숫자·-·_·/) 밖이면 첫 칸까지만 남기고, 그래도 안 되면 'unknown'
 */
export function pageFromReferer(referer: string | null | undefined, ownHost: string | null | undefined): string {
  const r = (referer ?? '').trim();
  if (!r) return 'unknown';
  let u: URL;
  try {
    u = new URL(r);
  } catch {
    return 'unknown';
  }
  const own = (ownHost ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  if (own && u.hostname.toLowerCase().replace(/^www\./, '') !== own) return 'unknown';
  let p = u.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const ok = (x: string) => /^\/[a-z0-9/_-]{0,119}$/.test(x);
  if (ok(p)) return p;
  // 한글 카테고리 주소처럼 허용 글자 밖이면 첫 칸만(예: /blog/category/%EB… → /blog)
  p = '/' + (p.split('/')[1] ?? '');
  return ok(p) ? p : 'unknown';
}
