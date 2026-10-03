// ──────────────────────────────────────────────
// 물어보기 하루 제한 계산 시험 (전체 10 · 개인 1 · 댓글 3)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { computeQuota, blockedMessage, untilText } from '../quota';

describe('하루 제한', () => {
  it('로그인 전: 전체 남은 수만', () => {
    const q = computeQuota({ globalUsed: 3, userUsed: null });
    expect(q.globalLeft).toBe(7);
    expect(q.left).toBeNull();
    expect(q.canAsk).toBe(true);
  });
  it('개인 1개 다 쓰면 user 막힘', () => {
    const q = computeQuota({ globalUsed: 3, userUsed: 1, commentUsed: 1 });
    expect(q.left).toBe(0);
    expect(q.blocked).toBe('user');
    expect(q.commentLeft).toBe(2);
  });
  it('전체 10개 마감이 개인보다 먼저', () => {
    const q = computeQuota({ globalUsed: 12, userUsed: 0 });
    expect(q.globalLeft).toBe(0);
    expect(q.blocked).toBe('global');
    expect(blockedMessage(q.blocked)).toContain('오늘 접수가 끝났어요');
  });
  it('댓글 3개 소진', () => {
    expect(computeQuota({ globalUsed: 0, userUsed: 0, commentUsed: 5 }).commentLeft).toBe(0);
  });
  it('자정까지 남은 시간', () => {
    const now = Date.parse('2026-10-03T11:35:00Z'); // 한국 20:35
    expect(untilText('2026-10-03T15:00:00.000Z', now)).toBe('3시간 25분');
    expect(untilText('2026-10-03T15:00:00.000Z', Date.parse('2026-10-03T15:00:30Z'))).toBe('0시간 0분');
  });
});
