-- ============================================================
-- 얼마드나 아이디 회원(익명 가입) — 회원 표 + 비밀번호 재설정 표
-- 작성: 2026년 10월 03일
--
-- [사장님 실행 방법]
--   Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
--   ※ 20261003_ask.sql(물어보기 표)을 먼저 실행한 뒤에 실행한다(ask_profiles 연동).
--
-- [무엇을 담나]
--   실명·전화번호는 받지 않는다. 아이디·비밀번호(암호화된 값만)·비밀번호 힌트·
--   (선택) 이메일·닉네임만. 비밀번호 원문은 어디에도 저장하지 않는다.
--
-- [권한]
--   두 표 모두 사이트 서버(서비스 역할 열쇠)만 읽고 쓴다. 공개 열쇠(anon)는 완전히 막는다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 아이디 회원 표
--   사이트 세션의 회원 번호는 "user:<id>" (카카오 회원 번호와 섞이지 않게 앞에 user: 를 붙임)
--   → ask_profiles.user_id 에도 "user:<id>" 로 들어간다.
-- ------------------------------------------------------------
create table if not exists public.ask_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique
                check (username ~ '^[a-z0-9]{4,16}$'),        -- 아이디: 영문 소문자·숫자 4~16자
  password_hash text not null,                                -- bcrypt 암호화 값(원문 아님)
  hint          text not null check (char_length(hint) between 2 and 30), -- 비밀번호 힌트
  email         text null unique,                             -- 선택(비밀번호 찾기용), 소문자로 저장
  nickname      text not null check (char_length(nickname) between 2 and 12),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz null,
  status        text not null default 'active' check (status in ('active','blocked'))
);

-- ------------------------------------------------------------
-- 2. 비밀번호 재설정 표 (메일로 보낸 1회용 열쇠 — 30분짜리)
--   열쇠 원문은 메일에만 있고, 여기엔 sha256 값만 저장한다.
-- ------------------------------------------------------------
create table if not exists public.ask_password_resets (
  id         bigserial primary key,
  token_hash text not null unique,
  user_id    uuid not null references public.ask_users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists ask_password_resets_user_idx on public.ask_password_resets (user_id, created_at desc);

-- ------------------------------------------------------------
-- 3. 권한 — RLS 켜고 정책 없음 + 공개 열쇠 권한 전부 회수 = 서버만 접근
-- ------------------------------------------------------------
alter table public.ask_users enable row level security;
alter table public.ask_password_resets enable row level security;
revoke all on public.ask_users, public.ask_password_resets from anon, authenticated;
revoke all on sequence public.ask_password_resets_id_seq from anon, authenticated;
