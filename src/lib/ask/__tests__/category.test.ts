// ──────────────────────────────────────────────
// 물어보기 말머리(카테고리) 도우미 시험
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { normalizeCategory, categoryLabel, titleWithCategory, kindFromCategory, ASK_CATEGORIES } from '../constants';

describe('말머리', () => {
  it('목록 6개, key 중복 없음', () => {
    expect(ASK_CATEGORIES.length).toBe(6);
    expect(new Set(ASK_CATEGORIES.map((c) => c.key)).size).toBe(6);
  });
  it('모르는 값은 null, 라벨은 기타', () => {
    expect(normalizeCategory('defect')).toBe('defect');
    expect(normalizeCategory('xxx')).toBeNull();
    expect(categoryLabel('xxx')).toBe('기타');
  });
  it('[말머리] 제목', () => {
    expect(titleWithCategory('estimate', '34평 견적')).toBe('[견적서 봐주세요] 34평 견적');
  });
  it('옛 kind 호환', () => {
    expect(kindFromCategory('estimate')).toBe('estimate');
    expect(kindFromCategory('howto')).toBe('cost');
  });
});
