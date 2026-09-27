// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 공용 타입
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 4-5절: "단계 정의는 목록 하나로" —
// 계산기마다 단계(제목·완료 조건·요약 글)를 배열 하나로 선언하고, 공용 조립기
// (FlowShell)가 그 배열을 받아 화면을 그린다. 이 파일은 그 "단계 하나"의 모양만 정의한다.
//
// 옛 부품(StepFlow.tsx·useStepFlow.ts)은 바닥재·미장이 아직 쓰고 있어 그대로 두고,
// 이 폴더(flow/)는 완전히 새로 만든 부품만 담는다 — 이름이 겹쳐도 옛 부품과는 무관하다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import type { ReactNode } from 'react';

/**
 * 단계 하나의 정의.
 * - key: React 리스트 키 + 세션 저장 등에 쓰는 고유 이름 (예: 'paperType')
 * - title: 번호 배지 옆에 쓰는 제목 (명사만, 말투 금지 — 지시서 1절)
 * - valid: 지금 폼 값이 "이 단계 기준으로 유효한지". touched와 별개로 순수 값 검증만 한다
 *   (사용자가 손을 안 대도 true일 수 있다 — 기본값이 이미 유효한 경우. 그래서 실제 "완료"
 *   판정은 valid && touched 둘 다 있어야 하고, 그건 useFlowSteps가 계산해 준다)
 * - content: 단계 안에 그릴 입력 내용(기존 카드 컴포넌트를 그대로 넣는다). 2026-09-27
 *   형아 결정(끝낸 단계를 접지 않기)으로 이 내용은 "지금 할 단계"뿐 아니라 "끝낸 단계"로
 *   바뀐 뒤에도 계속 펼쳐진 채 보인다 — summary(완료 줄 요약 글)·keepOpen(마지막 단계만
 *   안 접기) 개념은 이제 모든 단계가 똑같이 "안 접힌다"라서 필요 없어져 삭제했다.
 */
export interface FlowStepDef {
  key: string;
  title: string;
  valid: boolean;
  content: ReactNode;
}

/** 조정 칩 한 묶음 (예: "범위" 라벨 + 벽/천장 칩 2개) */
export interface AdjustChipGroup {
  /** React 키 겸 구분용 이름 */
  key: string;
  /** 왼쪽에 붙는 작은 라벨 (t-sub) */
  label: string;
  /** 실제 칩 버튼들 */
  children: ReactNode;
}

/** 제품 목록 시트(ProductSheet)에 넣는 한 줄 */
export interface PickerItem {
  /** 고유 코드 — onSelect에 그대로 돌려준다 */
  code: string;
  /** 굵게 보이는 제품 이름 */
  title: string;
  /** 아랫줄 — 브랜드·규격 등 (선택) */
  subtitle?: string;
  /** 오른쪽 끝 가격대 표기 (선택, 이미 공개된 소비자가만) */
  priceLabel?: string;
}
