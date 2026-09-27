// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 새로 고침 복원(sessionStorage)
//
// 지시서 4-4절:
//   - 입력과 눌렀던 단계 기록을 sessionStorage에 저장한다. 열쇠 이름은 계산기별로
//     ("calc:wallpaper:v1" 등).
//   - 새로 고침하면 복원한다. 탭을 닫으면 사라진다(= sessionStorage 특성 그대로).
//   - 공유값(?d=)이 있으면 공유값이 우선이고 전부 완료 상태로 시작한다(기존 동작 유지 —
//     이 파일은 그 판단에 관여하지 않는다. 부르는 쪽이 "공유 링크면 세션을 안 쓴다"를 정한다).
//   - 저장소를 못 쓰는 환경(사생활 보호 창 등)에서도 화면은 정상 동작해야 한다 —
//     읽기·쓰기 전부 try/catch로 감싸서 실패하면 조용히 무시한다.
//   - 저장 형식에 판 번호(version)를 넣어서, 나중에 모양이 바뀌면 옛 값을 버리게 한다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

/** sessionStorage에 실제로 저장하는 봉투 모양 — 안에 판 번호를 같이 넣어 둔다 */
interface SessionEnvelope<T> {
  /** 저장 형식 판 번호. 이 값이 지금 코드가 기대하는 값과 다르면 옛 데이터로 보고 버린다 */
  v: number;
  /** 실제로 복원할 값 */
  data: T;
}

/**
 * 세션에 저장해 둔 값을 읽어온다.
 * 저장소가 없거나(사생활 보호 창), 저장된 게 없거나, 판 번호가 다르거나, JSON이
 * 깨져 있으면 전부 null로 취급한다 — 호출한 쪽은 null이면 기본값을 쓰면 된다.
 */
export function loadSessionState<T>(key: string, version: number): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionEnvelope<T>>;
    if (!parsed || parsed.v !== version || parsed.data === undefined) return null;
    return parsed.data;
  } catch {
    // 사생활 보호 창 등 저장소 접근 자체가 막힌 환경 — 조용히 복원 실패로 처리
    return null;
  }
}

/**
 * 지금 값을 세션에 저장한다. 실패해도(저장소 접근 불가 등) 화면은 계속 정상 동작해야
 * 하므로 예외를 밖으로 던지지 않는다.
 */
export function saveSessionState<T>(key: string, version: number, data: T): void {
  try {
    if (typeof window === 'undefined') return;
    const envelope: SessionEnvelope<T> = { v: version, data };
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // 저장 실패는 조용히 무시 — 새로 고침 복원이 안 될 뿐 화면 동작에는 지장이 없어야 한다
  }
}
