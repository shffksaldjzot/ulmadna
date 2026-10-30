// ─────────────────────────────────────────────────────────────
// 국세청 사업자 상태조회 (서버 전용) — 2026년 10월 30일
//
// [무슨 기능인가]
//   공공데이터포털(odcloud) "사업자등록정보 상태조회" API 로 사업자번호의 현재 상태
//   (계속사업자 / 휴업 / 폐업 / 등록되지 않음)를 묻는다. 모이다공구(09_moida09/lib/ntsVerify.ts)의
//   상태조회 부분만 옮겨 왔다(3종 진위확인은 광고주 가입에 필요 없어 뺌).
//   NTS_API_KEY 환경변수가 없거나 국세청 응답이 느리면(7초)·오류면 "확인 실패(network)"로 돌려주고,
//   호출부는 이 경우 가입을 막지 않는다(국세청 장애 때문에 광고주를 돌려보내지 않기).
// ─────────────────────────────────────────────────────────────
import 'server-only';

const URL_STATUS = 'https://api.odcloud.kr/api/nts-businessman/v1/status';
const TIMEOUT_MS = 7000;

/** 화면·서버가 같이 쓰는 판정 결과 */
export type BizCheck =
  | { ok: true; kind: 'active'; statusCd: string; statusName: string } // 계속사업자
  | { ok: true; kind: 'closed'; statusCd: string; statusName: string } // 휴업·폐업
  | { ok: true; kind: 'unknown'; statusCd: ''; statusName: '' } // 국세청에 등록되지 않은 번호
  | { ok: false; reason: 'not_configured' | 'network' }; // 확인 실패(열쇠 없음·장애)

/** 국세청 상태코드 → 판정 종류(순수 함수·시험용). 01 계속, 02·03 휴업·폐업, 비어 있으면 미등록 */
export function kindOfStatus(cd: string): 'active' | 'closed' | 'unknown' {
  if (cd === '01') return 'active';
  if (cd === '02' || cd === '03') return 'closed';
  return 'unknown';
}

/** 사업자번호 10자리 상태 조회 */
export async function checkBizNo(bNo: string): Promise<BizCheck> {
  const key = process.env.NTS_API_KEY;
  if (!key) return { ok: false, reason: 'not_configured' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${URL_STATUS}?serviceKey=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: [bNo] }),
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, reason: 'network' };
    const json = (await res.json()) as { data?: { b_stt_cd?: string; b_stt?: string }[] };
    const item = json.data?.[0];
    if (!item) return { ok: false, reason: 'network' };
    const cd = item.b_stt_cd ?? '';
    const kind = kindOfStatus(cd);
    if (kind === 'unknown') return { ok: true, kind, statusCd: '', statusName: '' };
    return { ok: true, kind, statusCd: cd, statusName: (item.b_stt ?? '').trim() || (cd === '01' ? '계속사업자' : cd === '02' ? '휴업자' : '폐업자') };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
