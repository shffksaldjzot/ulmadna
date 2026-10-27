// ──────────────────────────────────────────────
// 집계 기록 함수 시험 — 봇이면 DB 호출 안 함, 사람이면 칸 값 맞게 1회 호출 (2026-10-27)
//   실제 DB 대신 metricsStore 의 더하기 함수를 가짜로 바꿔 끼워 "몇 번, 무슨 값으로" 불렸는지 본다.
// ──────────────────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock 은 파일 맨 위로 끌어올려지므로, 가짜 함수도 vi.hoisted 로 같이 끌어올린다
const fakes = vi.hoisted(() => ({ bumpCalcRun: vi.fn(), bumpContactClick: vi.fn() }));
vi.mock('../metricsStore', () => fakes);

import { pyeongBucket, recordCalcRun } from '../calcCounter';
import { recordContactClick } from '../contactClick';

const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1';

beforeEach(() => {
  fakes.bumpCalcRun.mockClear();
  fakes.bumpContactClick.mockClear();
});

describe('계산기 실행 기록', () => {
  it('사람 요청 → 1회, 지역·기기·유입·평형대 칸', () => {
    recordCalcRun('tile', 'quick', 34, new Headers({
      'user-agent': UA_PHONE,
      'x-vercel-ip-country': 'KR',
      'x-vercel-ip-country-region': '41',
      cookie: 'ulm_src=share',
    }));
    expect(fakes.bumpCalcRun).toHaveBeenCalledTimes(1);
    expect(fakes.bumpCalcRun).toHaveBeenCalledWith({
      process: 'tile', mode: 'quick', pyeongBucket: '30', region: '41', device: 'mobile', src: 'share',
    });
  });
  it('봇 요청 → 호출 안 함', () => {
    recordCalcRun('tile', 'quick', 34, new Headers({ 'user-agent': 'Googlebot/2.1' }));
    expect(fakes.bumpCalcRun).not.toHaveBeenCalled();
  });
  it('평형대: 없으면 na, 200 넘으면 200', () => {
    expect(pyeongBucket(undefined)).toBe('na');
    expect(pyeongBucket(9)).toBe('0');
    expect(pyeongBucket(59)).toBe('50');
    expect(pyeongBucket(999)).toBe('200');
  });
});

describe('문의 클릭 기록', () => {
  it('사람 → 누른 화면 경로·지역', () => {
    recordContactClick('kakao', new Headers({
      'user-agent': UA_PHONE,
      host: 'ulmadna.com',
      referer: 'https://ulmadna.com/blog/my-post?x=1',
      'x-vercel-ip-country': 'KR',
      'x-vercel-ip-country-region': '11',
    }));
    expect(fakes.bumpContactClick).toHaveBeenCalledWith('kakao', '/blog/my-post', '11');
  });
  it('봇 → 호출 안 함', () => {
    recordContactClick('phone', new Headers({ 'user-agent': 'bingbot/2.0' }));
    expect(fakes.bumpContactClick).not.toHaveBeenCalled();
  });
});
