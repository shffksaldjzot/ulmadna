// ──────────────────────────────────────────────
// 문의 시트(ContactSheet) 열림 상태 — 아주 작은 전역 저장소
//
// [왜 Context가 아니라 이런 방식인가]
// "문의" 알약(SiteHeader, 상단바)과 "문의" 탭(BottomTabs, 하단 탭)은 페이지마다
// 서로 다른 자리에서 각자 렌더된다. 둘 다 같은 문의 시트(ContactSheet)를 열어야 하는데,
// 두 컴포넌트를 감싸는 공용 Provider가 없다(레이아웃마다 SiteHeader만 쓰거나 SiteFooter만
// 쓰는 페이지가 섞여 있음). 그래서 새 Provider를 만드는 대신, 모듈 하나에 "지금 열려 있나 +
// 누가 열었나"만 담아두고 구독자(useSyncExternalStore)들이 그 값을 읽게 한다.
// ContactSheet.tsx 는 루트 레이아웃(app/layout.tsx)에 딱 한 번만 마운트해서 어느 페이지에서
// 열어도 항상 같은 시트 하나가 뜬다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

"use client";

import { useSyncExternalStore } from "react";
import type { ContactPlace } from "./contact";

interface ContactSheetState {
  open: boolean;
  /** 어디서 열었는지 — 시트 안 버튼을 눌렀을 때 추적 place로 그대로 쓴다 */
  place: ContactPlace;
}

let state: ContactSheetState = { open: false, place: "header" };
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

/** 문의 시트를 연다. place는 "어디서 열었는지"(header 알약 / tab 하단 탭) */
export function openContactSheet(place: ContactPlace): void {
  state = { open: true, place };
  emitChange();
}

/** 문의 시트를 닫는다 */
export function closeContactSheet(): void {
  if (!state.open) return; // 이미 닫혀 있으면 굳이 리렌더 안 시킴
  state = { ...state, open: false };
  emitChange();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ContactSheetState {
  return state;
}

/** 서버 렌더링 스냅샷 — 항상 닫힌 상태(시트는 클라이언트 상호작용 전용) */
function getServerSnapshot(): ContactSheetState {
  return { open: false, place: "header" };
}

/** 지금 문의 시트가 열려 있는지 + 누가 열었는지를 구독한다 */
export function useContactSheetState(): ContactSheetState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
