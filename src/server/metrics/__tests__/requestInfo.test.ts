// ──────────────────────────────────────────────
// 집계 칸 판정 시험 — 지역 코드 대응·기기·봇·유입·화면 경로 (2026-10-27)
// ──────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import {
  classifySource,
  deviceFromUA,
  isBotUA,
  pageFromReferer,
  regionFromHeaders,
  sourceFromCookieHeader,
} from '../requestInfo';

/** 머리글 묶음 만들기 도우미 */
const H = (o: Record<string, string>) => new Headers(o);

// 실제 브라우저 user-agent 예시
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_GALAXY = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const UA_TAB = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const UA_NAVER_APP = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.1.1)';
const UA_DAUM_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DaumApps/7.9.1';
const UA_KAKAO_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0';

describe('지역 코드 대응 (x-vercel-ip-country-region)', () => {
  it('시도 번호 그대로', () => {
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '11' }))).toBe('11');
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '41' }))).toBe('41');
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '50' }))).toBe('50');
  });
  it('강원 42→51, 전북 45→52 로 합침', () => {
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '42' }))).toBe('51');
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '45' }))).toBe('52');
  });
  it('"KR-11" 꼴도 받음', () => {
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': 'KR-11' }))).toBe('11');
  });
  it('해외는 ZZ, 머리글 없거나 모르는 값은 unknown', () => {
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'CA' }))).toBe('ZZ');
    expect(regionFromHeaders(H({}))).toBe('unknown');
    expect(regionFromHeaders(undefined)).toBe('unknown');
    expect(regionFromHeaders(H({ 'x-vercel-ip-country': 'KR', 'x-vercel-ip-country-region': '99' }))).toBe('unknown');
    // 나라 머리글 없이 지역만 와도 표에 있으면 받는다
    expect(regionFromHeaders(H({ 'x-vercel-ip-country-region': '26' }))).toBe('26');
  });
});

describe('기기 판정', () => {
  it('휴대폰·태블릿·PC', () => {
    expect(deviceFromUA(UA_IPHONE)).toBe('mobile');
    expect(deviceFromUA(UA_GALAXY)).toBe('mobile');
    expect(deviceFromUA(UA_TAB)).toBe('tablet');
    expect(deviceFromUA(UA_IPAD)).toBe('tablet');
    expect(deviceFromUA(UA_PC)).toBe('pc');
    expect(deviceFromUA('')).toBe('unknown');
  });
});

describe('봇 제외', () => {
  it('검색 수집기·자동 도구는 봇', () => {
    expect(isBotUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUA('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
    expect(isBotUA('Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)')).toBe(true);
    expect(isBotUA('Mozilla/5.0 (compatible; Daumoa/4.0)')).toBe(true);
    expect(isBotUA('Mozilla/5.0 (compatible; Baiduspider/2.0)')).toBe(true);
    expect(isBotUA('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUA('curl/8.4.0')).toBe(true);
    expect(isBotUA('Mozilla/5.0 HeadlessChrome/120.0')).toBe(true);
    expect(isBotUA('')).toBe(true);
    expect(isBotUA(null)).toBe(true);
  });
  it('사람 브라우저(네이버·다음·카톡 앱 안 포함)는 봇 아님', () => {
    for (const ua of [UA_IPHONE, UA_GALAXY, UA_TAB, UA_IPAD, UA_PC, UA_NAVER_APP, UA_DAUM_APP, UA_KAKAO_APP]) {
      expect(isBotUA(ua)).toBe(false);
    }
  });
});

describe('유입 경로 판정', () => {
  const own = 'ulmadna.com';
  it('ref=share 가 가장 먼저', () => {
    expect(classifySource('share', 'https://www.google.com/', own)).toBe('share');
  });
  it('Referer 없음 = direct, 검색 = search, 다른 사이트 = other, 사이트 안 = null', () => {
    expect(classifySource(null, null, own)).toBe('direct');
    expect(classifySource(null, 'https://www.google.co.kr/', own)).toBe('search');
    expect(classifySource(null, 'https://m.search.naver.com/search.naver?q=x', own)).toBe('search');
    expect(classifySource(null, 'https://search.daum.net/', own)).toBe('search');
    expect(classifySource(null, 'https://www.threads.net/', own)).toBe('other');
    expect(classifySource(null, 'https://ulmadna.com/blog', own)).toBe(null);
    expect(classifySource(null, 'https://www.ulmadna.com/blog', own)).toBe(null);
  });
  it('쿠키 머리글에서 값 꺼내기', () => {
    expect(sourceFromCookieHeader('a=1; ulm_src=share; b=2')).toBe('share');
    expect(sourceFromCookieHeader('ulm_src=hack')).toBe('direct');
    expect(sourceFromCookieHeader(null)).toBe('direct');
  });
});

describe('문의 클릭 화면 경로', () => {
  it('쿼리는 버리고 경로만', () => {
    expect(pageFromReferer('https://ulmadna.com/calc/wallpaper/result?d=abc', 'ulmadna.com')).toBe('/calc/wallpaper/result');
    expect(pageFromReferer('https://ulmadna.com/', 'ulmadna.com')).toBe('/');
    expect(pageFromReferer('https://ulmadna.com/blog/category/%EB%8F%84%EB%B0%B0', 'ulmadna.com')).toBe('/blog');
  });
  it('남의 사이트·없음은 unknown', () => {
    expect(pageFromReferer('https://evil.com/x', 'ulmadna.com')).toBe('unknown');
    expect(pageFromReferer(null, 'ulmadna.com')).toBe('unknown');
  });
});
