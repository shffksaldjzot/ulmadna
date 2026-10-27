// ──────────────────────────────────────────────
// 관리자 화면 공용 순수 함수·이름표 — 2026-10-28
//
// [무슨 기능인가]
//   DB 코드값(공정·모드·시도·기기·유입)을 한글 이름으로 바꾸고, 합산·날짜 채우기 같은
//   계산을 한다. 서버 전용 코드가 없어서 시험(vitest)과 화면 양쪽에서 쓸 수 있다.
// ──────────────────────────────────────────────

/** 이름별 합계 한 줄 */
export interface Counted {
  key: string;
  n: number;
}

/** 기간 선택 값: 허용 목록(기본 7·28·90)에 있는 것만, 그 밖은 첫 값 */
export function parseDays(raw: string | string[] | undefined, allowed: number[] = [7, 28, 90]): number {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return allowed.includes(v) ? v : allowed[0];
}

/** 키별 합계를 많은 순(같으면 키 순)으로 */
export function groupSum<T>(rows: T[], key: (r: T) => string, val: (r: T) => number): Counted[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** YYYY-MM-DD 에 일수를 더한다(UTC 날짜 계산이라 시간대 영향 없음) */
export function addDays(day: string, delta: number): string {
  const t = new Date(`${day}T00:00:00Z`).getTime() + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** from~to(양 끝 포함) 모든 날짜 목록 */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 날짜별 합계에 빠진 날을 0 으로 채운다(막대 그래프가 끊기지 않게) */
export function fillDays(from: string, to: string, got: Counted[]): { day: string; n: number }[] {
  const m = new Map(got.map((g) => [g.key, g.n]));
  return dayRange(from, to).map((day) => ({ day, n: m.get(day) ?? 0 }));
}

/** 증감률 표시: 직전 0 이면 "새로", 그 밖엔 +12% / -5% */
export function deltaText(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '새로' : '-';
  const p = Math.round(((cur - prev) / prev) * 100);
  return p > 0 ? `+${p}%` : `${p}%`;
}

export const PROCESS_NAMES: Record<string, string> = { wallpaper: '도배', flooring: '바닥재', mortar: '미장', tile: '타일' };
export const MODE_NAMES: Record<string, string> = { quick: '간단', precise: '정확', simple: '간단', exact: '정확' };
export const SRC_NAMES: Record<string, string> = { direct: '직접', search: '검색', share: '공유', other: '그 밖' };
export const DEVICE_NAMES: Record<string, string> = { mobile: '모바일', tablet: '태블릿', pc: 'PC', unknown: '알 수 없음' };
export const REGION_NAMES: Record<string, string> = {
  '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주', '30': '대전', '31': '울산', '50': '세종',
  '41': '경기', '51': '강원', '43': '충북', '44': '충남', '52': '전북', '46': '전남', '47': '경북', '48': '경남',
  '49': '제주', ZZ: '해외', unknown: '알 수 없음',
};

/** 시도 17곳(광고 자리판 행 순서) */
export const SIDO_CODES = ['11', '26', '27', '28', '29', '30', '31', '50', '41', '51', '43', '44', '52', '46', '47', '48', '49'];

/** 평형대 버킷 이름: '30' → '30평대', 'na' → '미입력' */
export function bucketLabel(key: string): string {
  return /^\d+$/.test(key) ? `${key}평대` : key === 'na' ? '미입력' : key;
}

/** 코드값 → 한글 이름(없으면 코드 그대로) */
export function nameOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

/** GA 가 주는 영어 시도 이름 → 한글(GA 의 region 차원은 "Seoul" 같은 영어로 온다) */
const GA_REGION_KO: Record<string, string> = {
  Seoul: '서울', Busan: '부산', Daegu: '대구', Incheon: '인천', Gwangju: '광주', Daejeon: '대전', Ulsan: '울산',
  Sejong: '세종', 'Gyeonggi-do': '경기', Gyeonggi: '경기', 'Gangwon-do': '강원', 'Gangwon State': '강원',
  'North Chungcheong': '충북', 'South Chungcheong': '충남', 'North Jeolla': '전북', 'South Jeolla': '전남',
  'North Gyeongsang': '경북', 'South Gyeongsang': '경남', Jeju: '제주', 'Jeju-do': '제주',
};
export function gaRegionKo(name: string): string {
  if (GA_REGION_KO[name]) return GA_REGION_KO[name];
  return name === '(not set)' ? '알 수 없음' : name;
}

/** GA 채널 그룹 영어 이름 → 한글 */
export function gaChannelKo(name: string): string {
  const m: Record<string, string> = {
    'Organic Search': '검색', Direct: '직접', 'Organic Social': '소셜', Referral: '다른 사이트', 'Paid Search': '유료 검색',
    Email: '이메일', Unassigned: '분류 안 됨', 'Organic Video': '영상', 'Organic Shopping': '쇼핑', Display: '배너',
  };
  return m[name] ?? name;
}

/** GA 의 YYYYMMDD → YYYY-MM-DD */
export function gaDay(d: string): string {
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
}
