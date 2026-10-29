// ─────────────────────────────────────────────────────────────
// 광고주 계정 보안 함수 시험 — 세션 토큰·비밀번호 해시·로그인 잠금 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { clearFails, hashPassword, hashToken, isTokenShape, lockedFor, newSession, recordFail, verifyPassword, SESSION_DAYS } from './crypto';

describe('세션 토큰', () => {
  it('쿠키 값은 43자 랜덤, DB 에는 64자 해시만', () => {
    const s = newSession(0);
    expect(isTokenShape(s.token)).toBe(true);
    expect(s.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(s.hash).toBe(hashToken(s.token));
    expect(s.hash).not.toContain(s.token);
  });
  it('매번 다른 값, 30일 만료', () => {
    const a = newSession(0);
    const b = newSession(0);
    expect(a.token).not.toBe(b.token);
    expect(a.expiresAt.getTime()).toBe(SESSION_DAYS * 86400000);
  });
  it('이상한 쿠키 값은 거절', () => {
    expect(isTokenShape('abc')).toBe(false);
    expect(isTokenShape(undefined)).toBe(false);
    expect(isTokenShape("x'; drop table--".padEnd(43, 'a'))).toBe(false);
  });
});

describe('비밀번호 해시', () => {
  it('맞는 비밀번호만 통과, 원문은 해시에 없음', async () => {
    const h = await hashPassword('abc12345');
    expect(h).not.toContain('abc12345');
    expect(await verifyPassword('abc12345', h)).toBe(true);
    expect(await verifyPassword('abc12346', h)).toBe(false);
  });
  it('망가진 해시는 false(예외 없음)', async () => {
    expect(await verifyPassword('abc12345', 'not-a-hash')).toBe(false);
  });
});

describe('로그인 잠금(15분 5회)', () => {
  it('5번 틀리면 잠기고, 15분 뒤 풀린다', () => {
    const k = 'test:lock';
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordFail(k, t0);
    expect(lockedFor(k, t0)).toBe(0);
    recordFail(k, t0);
    expect(lockedFor(k, t0 + 1000)).toBeGreaterThan(0);
    expect(lockedFor(k, t0 + 15 * 60 * 1000 + 1)).toBe(0);
  });
  it('성공하면 기록이 지워진다', () => {
    const k = 'test:clear';
    for (let i = 0; i < 5; i++) recordFail(k);
    expect(lockedFor(k)).toBeGreaterThan(0);
    clearFails(k);
    expect(lockedFor(k)).toBe(0);
  });
});
