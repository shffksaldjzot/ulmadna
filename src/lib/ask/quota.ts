// ──────────────────────────────────────────────
// 물어보기 — 하루 제한 계산 (React·DB 없음, 서버·화면 공용, 테스트 대상)
//
// 셋 다 한국 시간 자정에 0으로 돌아간다.
//   전체: 사이트 전체 하루 질문 10개 선착순(ASK_DAILY_GLOBAL)
//   개인: 회원 한 명당 하루 질문 1개(ASK_DAILY_PER_USER)
//   댓글: 회원 한 명당 하루 댓글 3개 합계(ASK_DAILY_COMMENTS_PER_USER)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { ASK_DAILY_COMMENTS_PER_USER, ASK_DAILY_GLOBAL, ASK_DAILY_PER_USER } from './constants';

export interface QuotaInput {
  globalUsed: number; // 오늘 사이트 전체에 올라온 질문 수(숨김·씨앗 글 제외)
  userUsed: number | null; // 오늘 내가 올린 질문 수(로그인 전이면 null)
  commentUsed?: number | null; // 오늘 내가 단 댓글 수(로그인 전이면 null)
}

export interface QuotaResult {
  globalLimit: number;
  globalLeft: number;
  limit: number; // 개인 하루 질문 수
  left: number | null; // 개인 남은 수(로그인 전이면 null)
  commentLimit: number;
  commentLeft: number | null;
  canAsk: boolean; // 지금 질문을 올릴 수 있나(로그인 전이면 전체 남은 수만 봄)
  blocked: 'global' | 'user' | null; // 막힌 이유
}

/** 남은 수와 막힘 여부 계산 */
export function computeQuota(i: QuotaInput): QuotaResult {
  const globalLeft = Math.max(0, ASK_DAILY_GLOBAL - Math.max(0, i.globalUsed));
  const left = i.userUsed == null ? null : Math.max(0, ASK_DAILY_PER_USER - Math.max(0, i.userUsed));
  const commentLeft = i.commentUsed == null ? null : Math.max(0, ASK_DAILY_COMMENTS_PER_USER - Math.max(0, i.commentUsed));
  // 전체 마감이 먼저(개인 몫이 남아도 전체가 끝나면 못 올림)
  const blocked: QuotaResult['blocked'] = globalLeft === 0 ? 'global' : left === 0 ? 'user' : null;
  return {
    globalLimit: ASK_DAILY_GLOBAL,
    globalLeft,
    limit: ASK_DAILY_PER_USER,
    left,
    commentLimit: ASK_DAILY_COMMENTS_PER_USER,
    commentLeft,
    canAsk: blocked === null,
    blocked,
  };
}

/** 막혔을 때 서버가 돌려줄 문장 */
export function blockedMessage(b: QuotaResult['blocked']): string | null {
  if (b === 'global') return `오늘 접수가 끝났어요 · 내일 00:00에 다시 ${ASK_DAILY_GLOBAL}개`;
  if (b === 'user') return `오늘은 ${ASK_DAILY_PER_USER}개까지예요 · 내일 00:00에 다시 올릴 수 있어요`;
  return null;
}

/** 자정까지 남은 시간 "n시간 n분" (1분 단위, 올림) */
export function untilText(resetAtIso: string, nowMs: number): string {
  const ms = Math.max(0, Date.parse(resetAtIso) - nowMs);
  const totalMin = Math.ceil(ms / 60000);
  return `${Math.floor(totalMin / 60)}시간 ${totalMin % 60}분`;
}
