// ──────────────────────────────────────────────
// 기존 회원 채우기 스크립트(scripts/backfill-members.mjs) 시험
//   - 스크립트의 판별값 계산이 사이트(로그인 때)와 똑같은지
//   - seed: 제외·아이디/카카오 구분이 맞는지
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { memberKeyOf } from '../key';
import { keyOf, planRows } from '../../../../scripts/backfill-members.mjs';

const SECRET = 'test-secret-0123456789abcdef';
const U1 = '0b6c6f2e-1d1a-4c5e-9a0b-123456789abc';
const R1 = '9a8b7c6d-1111-4222-8333-444455556666';

describe('기존 회원 채우기', () => {
  it('판별값이 로그인 때 계산과 같다(카카오·아이디 모두)', () => {
    expect(keyOf('4455667788', SECRET)).toBe(memberKeyOf('4455667788', SECRET));
    expect(keyOf(`user:${U1}`, SECRET)).toBe(memberKeyOf(`user:${U1}`, SECRET));
  });

  it('seed: 제외, 아이디/카카오 구분, ask_users 없는 아이디 닉네임은 건너뜀', () => {
    const profiles = [
      { user_id: 'seed:1', nickname: '예시', created_at: '2026-10-03T00:00:00Z' },
      { user_id: `user:${U1}`, nickname: '아이디닉', created_at: '2026-10-05T00:00:00Z' },
      { user_id: 'user:00000000-0000-4000-8000-000000000000', nickname: '고아', created_at: '2026-10-05T00:00:00Z' },
      { user_id: '4455667788', nickname: '카톡', created_at: '2026-10-06T00:00:00Z' },
      { user_id: R1, nickname: '세션', created_at: '2026-10-07T00:00:00Z' },
      { user_id: '이상한값', nickname: 'x', created_at: '2026-10-07T00:00:00Z' },
    ];
    const users = [{ id: U1, nickname: '아이디닉', created_at: '2026-10-04T00:00:00Z', last_login_at: '2026-10-20T00:00:00Z', status: 'blocked' }];
    const { rows, counts } = planRows(profiles, users, SECRET);
    expect(counts).toEqual({ seed: 1, id: 1, kakaoNumeric: 1, kakaoSessionUuid: 1, idWithoutUser: 1, unknown: 1 });
    expect(rows).toHaveLength(3);
    const idRow = rows.find((r: { provider: string }) => r.provider === 'id');
    expect(idRow).toMatchObject({ ask_user_id: U1, status: 'blocked', first_login_at: '2026-10-04T00:00:00Z', last_login_at: '2026-10-20T00:00:00Z', login_count: 0, has_ask_profile: true });
    // 원문 번호가 어느 줄에도 들어가지 않는다
    expect(JSON.stringify(rows)).not.toContain('4455667788');
    expect(JSON.stringify(rows)).not.toContain(R1);
  });
});
