// ──────────────────────────────────────────────
// 아이디 회원 가입 검사 시험
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { usernameProblem, passwordProblem, hintProblem, emailProblem, signupProblem, normalizeUsername, isIdUser } from '../validate';

const ok = { username: 'dotori84', password: 'abcd1234', password2: 'abcd1234', hint: '첫 강아지 이름', email: '', nickname: '수원새댁', agree: true };

describe('아이디', () => {
  it('영문·숫자 4~16자, 소문자로 저장', () => {
    expect(usernameProblem('Dotori84')).toBeNull();
    expect(normalizeUsername('  Dotori84 ')).toBe('dotori84');
    expect(usernameProblem('abc')).not.toBeNull();
    expect(usernameProblem('한글아이디')).not.toBeNull();
    expect(usernameProblem('admin1')).not.toBeNull();
  });
});

describe('비밀번호·힌트·이메일', () => {
  it('영문+숫자 8자 이상', () => {
    expect(passwordProblem('abcd1234')).toBeNull();
    expect(passwordProblem('abcdefgh')).not.toBeNull();
    expect(passwordProblem('12345678')).not.toBeNull();
    expect(passwordProblem('ab12')).not.toBeNull();
  });
  it('힌트는 2~30자, 비밀번호 포함 금지', () => {
    expect(hintProblem('첫 강아지 이름')).toBeNull();
    expect(hintProblem('a')).not.toBeNull();
    expect(hintProblem('내 비번 abcd1234', 'abcd1234')).not.toBeNull();
  });
  it('이메일은 선택', () => {
    expect(emailProblem('')).toBeNull();
    expect(emailProblem('a@b.co')).toBeNull();
    expect(emailProblem('ab.co')).not.toBeNull();
  });
});

describe('가입 전체', () => {
  it('정상', () => expect(signupProblem(ok)).toBeNull());
  it('확인 불일치', () => expect(signupProblem({ ...ok, password2: 'x' })?.field).toBe('password2'));
  it('동의 안 함', () => expect(signupProblem({ ...ok, agree: false })?.field).toBe('agree'));
  it('세션 접두사', () => {
    expect(isIdUser('user:1234')).toBe(true);
    expect(isIdUser('3812345678')).toBe(false);
  });
});
