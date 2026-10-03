// ──────────────────────────────────────────────
// 물어보기 게시판 — 글자·시간 다듬는 작은 함수들 (React 없음, 테스트 대상)
//
// 화면(브라우저)과 서버 양쪽에서 쓴다. 비밀 값 없음.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import { LIMITS } from './constants';

/**
 * 제목 → 주소용 글자. 한글은 그대로 두고 띄어쓰기·문장부호만 "-"로 바꾼다.
 * 예: "34평 도배+강마루 견적 580만원, 적정한가요?" → "34평-도배-강마루-견적-580만원-적정한가요"
 * 너무 길면 40자에서 자른다(주소가 지나치게 길어지지 않게).
 */
export function titleToSlugPart(title: string): string {
  const s = title
    .normalize('NFC')
    .replace(/[^0-9A-Za-z가-힣]+/g, '-') // 한글·영문·숫자 말고는 전부 하이픈
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
  return s || '질문';
}

/** 질문 번호 + 제목 조각 → 최종 주소 조각. 예: 1024 + "34평-도배" → "1024-34평-도배" */
export function makeSlug(id: number, title: string): string {
  return `${id}-${titleToSlugPart(title)}`;
}

/** 주소 조각 맨 앞의 질문 번호만 뽑는다. "1024-34평-도배" → 1024, 번호가 없으면 null */
export function idFromSlug(slug: string): number | null {
  const m = /^(\d{1,12})(?:-|$)/.exec(slug);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 주소에 넣을 때 쓰는 질문 상세 경로 — 한글을 안전하게 인코딩 */
export function askHref(slug: string): string {
  return `/ask/${encodeURIComponent(slug)}`;
}

/**
 * "몇 분 전" 표기. 1분 안=방금, 1시간 안=N분 전, 하루 안=N시간 전, 어제, 7일 안=N일 전, 그 뒤=MM.DD
 * now를 받아서 테스트에서 시간을 고정할 수 있게 했다.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  const d = toKst(new Date(t));
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}

/** "2026.10.03 14:12" 표기 (한국 시간 기준) */
export function fmtDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = toKst(new Date(t));
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "14:19" 표기 (한국 시간 기준) */
export function fmtTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = toKst(new Date(t));
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 두 시각 사이 분 수(답변까지 걸린 시간). 1분 미만은 1분으로 */
export function minutesBetween(a: string, b: string): number | null {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.max(1, Math.round((y - x) / 60000));
}

/** "2026-10-03" 또는 "2026.10.03" → "10.03" (갱신일 짧게) */
export function shortDate(d: string | null): string {
  if (!d) return '';
  const m = /^(\d{4})[-.](\d{2})[-.](\d{2})/.exec(d);
  return m ? `${m[2]}.${m[3]}` : d;
}

/** 오늘(한국 시간) 0시를 UTC ISO로 — "하루 3개" 제한을 한국 날짜 기준으로 세려고 */
export function kstDayStartIso(now: Date = new Date()): string {
  const k = toKst(now);
  const startUtc = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - 9 * 3600 * 1000;
  return new Date(startUtc).toISOString();
}

/** 조건 글자: "34평 · 84타입" 같은 평형 표기 */
export function pyeongLabel(pyeong: number | null, type: string | null): string {
  if (!pyeong) return '';
  return type ? `${pyeong}평 · ${type}타입` : `${pyeong}평`;
}

/**
 * 검색·설명문용 조건 한 줄: "34평 도배·바닥"
 * 제목 뒤에 붙여서 검색어(평형·공정)를 품게 한다.
 */
export function conditionText(pyeong: number | null, trades: string[]): string {
  const parts: string[] = [];
  if (pyeong) parts.push(`${pyeong}평`);
  if (trades.length) parts.push(trades.map((t) => t.replace(/\s·\s/g, '·')).join('·'));
  return parts.join(' ');
}

/** 닉네임 검사 — 2~12자, 한글·영문·숫자만. 문제가 있으면 안내 문장, 없으면 null */
export function nicknameProblem(nick: string): string | null {
  const s = nick.trim();
  if (s.length < LIMITS.nickMin || s.length > LIMITS.nickMax) return `${LIMITS.nickMin}~${LIMITS.nickMax}자로 지어 주세요`;
  if (!/^[0-9A-Za-z가-힣]+$/.test(s)) return '한글 · 영문 · 숫자만 쓸 수 있어요';
  if (/얼마드나|관리자|운영자|admin/i.test(s)) return '쓸 수 없는 이름이에요';
  return null;
}

/** 전화번호처럼 보이는 글자가 있는지(질문·댓글에 개인정보가 들어가는 것을 막는다) */
export function hasPhoneNumber(text: string): boolean {
  return /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/.test(text) || /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/.test(text);
}

/** 마크다운 기호를 걷어 낸 맨 글자(검색 설명문·구조화 데이터용) */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[#*_`>~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 내부 도우미 ──
/** 한국 시간(UTC+9)만큼 민 Date — getUTC* 로 읽으면 한국 시각이 나온다 */
function toKst(d: Date): Date {
  return new Date(d.getTime() + 9 * 3600 * 1000);
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
