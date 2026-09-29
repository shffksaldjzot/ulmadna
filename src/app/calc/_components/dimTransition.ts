// ──────────────────────────────────────────────
// v1 허브 — "계산 중(옛 값을 보여주는 중)" 흐려짐 연출의 방향별 시간차
//
// 2026-09-29 검사관 지적(경미 결함 3번): 값을 바꾼 직후 33ms 시점에도 금액이 거의
// 또렷하게(투명도 0.97) 보였다 — 원인은 "흐려질 때"·"다시 또렷해질 때" 양쪽 다 같은
// transition-opacity duration-150을 써서, 흐려지는 것도 150ms에 걸쳐 서서히 진행됐기
// 때문이다. 사용자 눈에는 "수량은 이미 새 값인데 금액은 잠깐 옛 값처럼 또렷하게 남아
// 있다"는 어색한 순간으로 보인다.
//
// 고친 규칙: **흐려질 때(dim=true)는 연출 없이 즉시(0ms)**, **다시 또렷해질 때
// (dim=false)만 150ms**를 들인다. Tailwind의 duration-* 클래스는 방향과 무관하게
// 고정값이라 이걸 표현할 수 없어서, 인라인 style로 transitionDuration만 방향에 따라
// 갈아 끼운다(className은 transition-opacity만 맡고 opacity 값·duration은 이 함수가 준다).
//
// 결과 카드 금액 블록(도배·바닥재·미장 ResultPanel)과 하단 바 금액(BottomBar)이 전부
// 이 함수 하나를 같이 쓴다 — 세 계산기가 다른 규칙을 갖지 않게 통일한다.
//
// 작성일: 2026년 09월 29일
// ──────────────────────────────────────────────

import type { CSSProperties } from 'react';

/**
 * 흐려짐 상태(dim)에 따라 opacity 전환 시간을 돌려준다.
 * @param dim true면 "계산 중(옛 값을 보여주는 중)" — 즉시 흐려져야 한다(0ms).
 *            false면 "최신 값이 준비됨" — 150ms에 걸쳐 서서히 또렷해진다.
 */
export function dimTransitionStyle(dim: boolean): CSSProperties {
  return { transitionDuration: dim ? '0ms' : '150ms' };
}
