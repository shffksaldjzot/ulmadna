-- ============================================================
-- 얼마드나 회원 명부 — 로그인한 회원을 우리가 집계·관리하는 표
-- 작성: 2026년 10월 27일 (관리자 페이지 계획안 2-d, 결정 10 "카카오 회원 DB 에 남김")
--
-- [왜 만드나]
--   지금은 카카오로 로그인만 하고 물어보기를 안 쓴 사람은 어디에도 안 남는다
--   (물어보기 닉네임 표 ask_profiles 와 아이디 회원 표 ask_users 만 있음).
--   로그인이 성공할 때마다 사이트 서버가 이 표에 한 줄을 만들거나(첫 로그인)
--   마지막 로그인 시각·횟수만 고친다(두 번째부터).
--
-- [무엇을 담나 — 개인정보 최소]
--   - 카카오 고유 번호 원문은 저장하지 않는다. 사이트 서버만 아는 비밀값(MEMBER_HASH_SECRET)으로
--     섞어 만든 64글자 값(member_key)만 담는다. 같은 사람이면 늘 같은 값이 나와서 "같은 사람"은
--     알아보지만, 이 값만으로는 원래 번호를 되돌릴 수 없다.
--   - 이메일·전화번호·프로필 사진은 담지 않는다.
--   - 닉네임(사이트 닉네임, 없으면 카카오 닉네임)·첫/마지막 로그인 시각·로그인 횟수·상태만.
--
-- [탈퇴하면]
--   줄은 지우지 않고(회원 수 통계 유지) 상태만 '탈퇴'로 바꾸고, 사람을 알아볼 수 있는 값
--   (member_key·닉네임·아이디 회원 연결)을 비운다. 다시 로그인하면 새 회원 줄이 생긴다.
--
-- [사장님 실행 방법]
--   Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
--   ※ 20261003_ask_users.sql(아이디 회원 표)을 먼저 실행한 뒤에 실행한다(ask_users 연결).
--
-- [권한]
--   RLS(행 보안) 켜고 공개 정책 없음 + 공개 열쇠(anon)·로그인 열쇠 권한 전부 회수
--   → 사이트 서버(서비스 역할 열쇠)만 읽고 쓴다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 회원 명부 표
-- ------------------------------------------------------------
create table if not exists public.members (
  id              uuid        primary key default gen_random_uuid(),   -- 회원 번호(우리 쪽 번호)
  provider        text        not null check (provider in ('kakao','id')), -- 로그인 수단: 카카오 / 아이디
  -- 같은 사람 판별용 값(비밀값 섞은 해시, 소문자 16진수 64글자). 탈퇴하면 비운다(null).
  --   카카오 회원 = 카카오 고유 번호를, 아이디 회원 = "user:<아이디 회원 번호>" 를 섞어 만든다.
  member_key      text        null unique check (member_key is null or member_key ~ '^[0-9a-f]{64}$'),
  -- 아이디 회원이면 ask_users 줄 번호(아이디 회원 줄이 지워지면 자동으로 비워짐)
  ask_user_id     uuid        null references public.ask_users(id) on delete set null,
  nickname        text        null check (nickname is null or char_length(nickname) between 1 and 40),
  has_ask_profile boolean     not null default false,                  -- 물어보기 닉네임(ask_profiles)을 만들었나
  first_login_at  timestamptz not null default now(),                  -- 첫 로그인(옛 회원 채우기면 닉네임 만든 시각)
  last_login_at   timestamptz not null default now(),                  -- 마지막 로그인
  login_count     integer     not null default 1 check (login_count >= 0), -- 로그인 횟수(옛 회원 채우기 줄은 0부터)
  status          text        not null default 'active'
                  check (status in ('active','blocked','withdrawn')),  -- 정상 / 차단 / 탈퇴
  withdrawn_at    timestamptz null,                                    -- 탈퇴한 시각
  created_at      timestamptz not null default now(),
  -- 탈퇴가 아니면 같은 사람 판별값이 반드시 있어야 한다
  constraint members_key_unless_withdrawn check (status = 'withdrawn' or member_key is not null)
);

-- 관리자 화면·통계용 색인(새 회원 수 세기, 로그인 수단별 세기)
create index if not exists members_first_login_idx on public.members (first_login_at desc);
create index if not exists members_provider_status_idx on public.members (provider, status);

-- ------------------------------------------------------------
-- 2. 권한 — RLS 켜고 정책 없음 + 공개 열쇠 권한 전부 회수 = 서버만 접근
-- ------------------------------------------------------------
alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;

-- ------------------------------------------------------------
-- 3. 로그인 기록 함수 (members_touch)
--   처음 보는 사람이면 줄을 새로 만들고, 이미 있으면 마지막 로그인 시각·횟수만 올린다.
--   한 번의 명령으로 끝나서 같은 사람이 동시에 두 번 로그인해도 줄이 두 개 생기지 않는다.
--   - 상태(정상/차단)는 건드리지 않는다(차단된 사람이 로그인해도 차단 그대로).
--   - 닉네임: 물어보기 닉네임을 이미 만든 회원이면 그 이름을 지킨다(카카오 닉네임으로 덮지 않음).
--   - p_has_profile 이 null 이면 "모름" → 기존 값을 그대로 둔다.
--   돌려주는 값: 회원 번호(uuid)
-- 2026-10-28 형아 결정: 카카오 이름(본명일 수 있음)도 따로 기록한다 — 사이트 닉네임(nickname)과 별개 칸
alter table public.members add column if not exists real_name text null check (real_name is null or char_length(real_name) between 1 and 40);

-- ------------------------------------------------------------
create or replace function public.members_touch(
  p_key text, p_provider text, p_nickname text default null,
  p_ask_user_id uuid default null, p_has_profile boolean default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_nick text := nullif(left(btrim(coalesce(p_nickname, '')), 40), '');
begin
  -- 입력 검사(거절이면 오류 번호 22023 = 잘못된 값)
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'members: 잘못된 key' using errcode = '22023';
  end if;
  if p_provider is null or p_provider not in ('kakao','id') then
    raise exception 'members: 잘못된 provider %', p_provider using errcode = '22023';
  end if;

  insert into public.members as m (member_key, provider, nickname, real_name, ask_user_id, has_ask_profile)
  values (p_key, p_provider, v_nick, v_nick, p_ask_user_id, coalesce(p_has_profile, false))
  on conflict (member_key) do update set
    real_name       = coalesce(excluded.real_name, m.real_name), -- 로그인 때 받은 카카오 이름(본명일 수 있음)은 매번 최신으로
    last_login_at   = now(),
    login_count     = m.login_count + 1,
    nickname        = case when m.has_ask_profile then coalesce(m.nickname, excluded.nickname)
                           else coalesce(excluded.nickname, m.nickname) end,
    ask_user_id     = coalesce(excluded.ask_user_id, m.ask_user_id),
    has_ask_profile = coalesce(p_has_profile, m.has_ask_profile)
  returning m.id into v_id;
  return v_id;
end $$;

-- 실행 권한: 사이트 서버(서비스 역할 열쇠)만
revoke all on function public.members_touch(text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.members_touch(text, text, text, uuid, boolean) to service_role;
