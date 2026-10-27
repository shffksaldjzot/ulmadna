// ──────────────────────────────────────────────
// 회원 명부 — 판별값 만들기·로그인 정보 고르기·로그인 콜백 시험
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import { memberKeyOf, loginRecordFrom, stableIdFromSession, cleanNickname } from '../key';
import { onJwt, memberIdFromToken, withTimeout } from '../callbacks';

const SECRET = 'test-secret-0123456789abcdef'; // 시험용 가짜 비밀값
const UUID = '0b6c6f2e-1d1a-4c5e-9a0b-123456789abc';
const MID = '7f0c2a1e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';

describe('판별값(memberKeyOf)', () => {
  it('같은 사람이면 같은 값, 다른 사람이면 다른 값', () => {
    const a = memberKeyOf('1234567890', SECRET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(memberKeyOf('1234567890', SECRET)).toBe(a);
    expect(memberKeyOf('1234567891', SECRET)).not.toBe(a);
  });
  it('비밀값이 다르면 값도 달라진다(비밀값 없이 되돌리기 불가)', () => {
    expect(memberKeyOf('1234567890', SECRET)).not.toBe(memberKeyOf('1234567890', SECRET + 'x'));
  });
  it('원문 번호가 결과에 들어 있지 않다', () => {
    expect(memberKeyOf('1234567890', SECRET)).not.toContain('1234567890');
  });
  it('비밀값이 없거나 짧으면 null(기록 안 함)', () => {
    expect(memberKeyOf('1', '')).toBeNull();
    expect(memberKeyOf('1', 'short')).toBeNull();
    expect(memberKeyOf('', SECRET)).toBeNull();
  });
});

describe('로그인 정보 고르기(loginRecordFrom)', () => {
  it('카카오: 무작위 세션 번호가 아니라 카카오 고유 번호를 쓴다', () => {
    const r = loginRecordFrom({ user: { id: UUID, name: ' 토리 ' }, account: { provider: 'kakao', providerAccountId: '4455667788' } });
    expect(r).toEqual({ provider: 'kakao', stableId: '4455667788', sessionId: UUID, askUserId: null, nickname: '토리' });
  });
  it('카카오: 고유 번호가 숫자가 아니면 기록 안 함', () => {
    expect(loginRecordFrom({ user: { id: UUID }, account: { provider: 'kakao', providerAccountId: 'abc' } })).toBeNull();
  });
  it('아이디 회원: user:<uuid> 를 그대로, ask_users 번호도 같이', () => {
    const r = loginRecordFrom({ user: { id: `user:${UUID}`, name: '닉' }, account: { provider: 'credentials', providerAccountId: `user:${UUID}` } });
    expect(r).toEqual({ provider: 'id', stableId: `user:${UUID}`, sessionId: `user:${UUID}`, askUserId: UUID, nickname: '닉' });
  });
  it('모르는 로그인 수단·이상한 값은 기록 안 함', () => {
    expect(loginRecordFrom({ user: { id: 'x' }, account: { provider: 'google', providerAccountId: '1' } })).toBeNull();
    expect(loginRecordFrom({ user: { id: '123' }, account: { provider: 'credentials' } })).toBeNull();
    expect(loginRecordFrom({})).toBeNull();
  });
  it('이메일은 받지도 넘기지도 않는다', () => {
    const r = loginRecordFrom({ user: { id: UUID, name: 'a', email: 'a@b.c' } as never, account: { provider: 'kakao', providerAccountId: '1' } });
    expect(JSON.stringify(r)).not.toContain('a@b.c');
  });
  it('세션 번호로 재료 고르기: 아이디 회원만 가능', () => {
    expect(stableIdFromSession(`user:${UUID}`)).toBe(`user:${UUID}`);
    expect(stableIdFromSession(UUID)).toBeNull();
    expect(cleanNickname('  ')).toBeNull();
    expect(cleanNickname('가'.repeat(50))).toHaveLength(40);
  });
});

describe('로그인 콜백(onJwt)', () => {
  const kakao = { user: { id: UUID, name: '토리' }, account: { provider: 'kakao', providerAccountId: '4455667788' } };

  it('로그인 순간에 한 번 기록하고 회원 번호를 token.mid 에 담는다', async () => {
    const record = vi.fn().mockResolvedValue(MID);
    const token = await onJwt({ token: { sub: UUID }, trigger: 'signIn', ...kakao }, record);
    expect(record).toHaveBeenCalledTimes(1);
    expect(token).toEqual({ sub: UUID, mid: MID });
    expect(memberIdFromToken(token)).toBe(MID);
  });
  it('로그인 순간이 아니면(세션 확인 등) 기록 안 함', async () => {
    const record = vi.fn().mockResolvedValue(MID);
    const token = await onJwt({ token: { sub: UUID, mid: MID } }, record);
    expect(record).not.toHaveBeenCalled();
    expect(token.mid).toBe(MID);
    await onJwt({ token: {}, trigger: 'update', ...kakao }, record);
    expect(record).not.toHaveBeenCalled();
  });
  it('기록이 실패(오류)해도 로그인 토큰은 그대로 나온다', async () => {
    const record = vi.fn().mockRejectedValue(new Error('표 없음'));
    const token = await onJwt({ token: { sub: UUID }, trigger: 'signIn', ...kakao }, record);
    expect(token).toEqual({ sub: UUID });
  });
  it('기록 함수가 동기적으로 던져도 로그인은 계속', async () => {
    const record = vi.fn(() => {
      throw new Error('터짐');
    });
    const token = await onJwt({ token: { sub: UUID }, trigger: 'signIn', ...kakao }, record as never);
    expect(token).toEqual({ sub: UUID });
  });
  it('기록이 늦으면 기다리지 않는다(시간 초과 → mid 없이 진행)', async () => {
    const record = vi.fn(() => new Promise<string>((r) => setTimeout(() => r(MID), 200)));
    const t0 = Date.now();
    const token = await onJwt({ token: { sub: UUID }, trigger: 'signIn', ...kakao }, record, 20);
    expect(Date.now() - t0).toBeLessThan(150);
    expect(token.mid).toBeUndefined();
  });
  it('기록 안 함(null)이면 mid 없음', async () => {
    const token = await onJwt({ token: { sub: UUID }, trigger: 'signIn', ...kakao }, vi.fn().mockResolvedValue(null));
    expect(token.mid).toBeUndefined();
  });
  it('mid 가 이상한 값이면 세션에 안 옮긴다', () => {
    expect(memberIdFromToken({ mid: 'x' })).toBeNull();
    expect(memberIdFromToken(null)).toBeNull();
  });
  it('withTimeout: 제시간이면 값, 실패면 null', async () => {
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(withTimeout(Promise.reject(new Error('x')), 50)).resolves.toBeNull();
  });
});
