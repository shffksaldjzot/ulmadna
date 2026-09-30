// ──────────────────────────────────────────────
// v1 허브 — 결과 화면(도배·바닥재·미장 result/page.tsx) 공용: 공유 링크(?d=)를 풀어서
// 나온 값의 "모양"이 이상해도 500이 나지 않게 막는다.
//
// 2026-09-30 결함 수리(경미 결함 2번, 검사관 발견) — 정상 공유 링크의 d= 값을 풀어
// preciseRooms를 "abc"(배열이어야 할 자리에 문자열)로 바꿔 다시 인코딩해 열면 도배·
// 바닥재·미장 결과 화면이 전부 500이 났다. 원인: decode 함수(decodeMortarForm 등)는
// JSON.parse만 하고 "모양"(타입)은 검사하지 않는다 — 그래서 그 뒤 엔진 입력 변환·
// sanitize 단계의 `.map`·`.some`·`for...of` 같은 배열 전용 코드가 배열이 아닌 값을
// 만나 그대로 터졌다(서버 기록: "(a.preciseRooms ?? []).some is not a function",
// "b.preciseRooms.map is not a function" — src/lib/v1/mortarEngineInput.ts:536 근처).
// 새로 넣은 서버 검증(src/server/calc/validate/*.ts)은 이보다 "뒤"에서 돌기 때문에
// 이 사고를 못 막았다.
//
// 고침 — 두 겹 방어(계산·단가 로직은 전혀 안 건드린다):
//   1) 결과 화면이 디코드 직후 "배열이어야 할 자리가 실제로 배열인지"(Array.isArray)를
//      먼저 확인한다. 하나라도 아니면 계산을 아예 시도하지 않고 곧장 기존 'invalid'
//      화면("조건을 다시 넣어 주세요" + 계산기로 가기 버튼)으로 보낸다.
//   2) 이 검사로도 못 잡는 더 깊은 모양 문제(예: preciseRooms 안 항목 하나가 배열이
//      아니라 문자열인 경우 등, 미리 다 나열하기 어려운 경우)에 대비해 계산 자체도
//      safeCalc로 한 번 더 감싼다 — 무엇이 터지든(TypeError 등) 500 대신 같은 'invalid'
//      결과로 떨어진다. 정상 링크·기존 라이브 링크는 이 방어를 거쳐도 평소와 똑같이
//      계산된다(값이 정상 모양이면 try 안에서 아무 예외도 안 난다).
//
// 작성일: 2026년 09월 30일
// ──────────────────────────────────────────────

/**
 * 배열이어야 할 자리가 실제로 배열인지 확인한다. 아직 아무 것도 안 넣어 undefined거나
 * null이면(=옛 공유 링크 등에서 이 필드 자체가 없던 경우) "이상한 모양"으로 보지 않는다
 * — 문제는 값이 "있는데" 배열이 아닌 경우(문자열·숫자·객체 등)뿐이다.
 */
export function isArrayFieldOk(value: unknown): boolean {
  return value === undefined || value === null || Array.isArray(value);
}

/**
 * 계산 함수 하나를 감싸서, 그 안에서 어떤 예외가 나든(배열이 아닌 값에 .map·.some·
 * for-of를 쓰다 나는 TypeError 등) 잡아 대체 결과(onError)로 바꿔준다.
 * ValidationError(서버 검증 실패)처럼 이미 알고 처리하는 예외는 fn 안에서 먼저
 * 처리되어 있고, 여기서는 그 외의 "예상 못 한 모양" 문제만 최종 방어선으로 잡는다.
 */
export function safeCalc<T>(fn: () => T, onError: () => T): T {
  try {
    return fn();
  } catch {
    return onError();
  }
}
