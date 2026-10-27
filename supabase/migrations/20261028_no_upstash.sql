-- ============================================================
-- Upstash Redis 완전 제거용 표·함수 — 횟수 제한 / 작은 키-값 / 로그인 오류 기록
-- 작성: 2026년 10월 28일
-- 실행: Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전.
-- 권한: 표·함수 모두 RLS 켜고 anon·authenticated 권한 회수, service_role(사이트 서버)만 사용.
-- ============================================================

-- 1. 횟수 제한(로그인 실패·가입 시도) — 키별 창 끝 시각과 횟수
create table if not exists public.rate_limits (
  key        text primary key,
  n          integer     not null default 0,
  expires_at timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- 원자적으로 +1 하고 센 뒤 횟수를 돌려준다(창이 지났으면 1부터 다시)
create or replace function public.rate_limit_hit(p_key text, p_window_sec integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  if p_key is null or length(p_key) > 200 or p_window_sec is null or p_window_sec < 1 or p_window_sec > 86400 then
    return 1;
  end if;
  insert into public.rate_limits as r (key, n, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window_sec))
  on conflict (key) do update
    set n = case when r.expires_at <= now() then 1 else r.n + 1 end,
        expires_at = case when r.expires_at <= now()
                          then now() + make_interval(secs => p_window_sec) else r.expires_at end
  returning n into v_n;
  -- 가끔 만료된 줄 청소(표가 커지지 않게)
  if random() < 0.02 then
    delete from public.rate_limits where expires_at < now() - interval '1 day';
  end if;
  return v_n;
end $$;
revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;

-- 2. 작은 키-값 표(킵얼라이브 마지막 실행 기록 등)
create table if not exists public.app_kv (
  name       text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);
alter table public.app_kv enable row level security;
revoke all on public.app_kv from anon, authenticated;

-- 3. 로그인 오류 기록(최근 50건만 보관)
create table if not exists public.auth_diag_log (
  id   bigint generated always as identity primary key,
  at   timestamptz not null default now(),
  item jsonb       not null
);
alter table public.auth_diag_log enable row level security;
revoke all on public.auth_diag_log from anon, authenticated;

create or replace function public.auth_diag_push(p_item jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auth_diag_log (item) values (p_item);
  delete from public.auth_diag_log
   where id <= (select id from public.auth_diag_log order by id desc offset 50 limit 1);
end $$;
revoke all on function public.auth_diag_push(jsonb) from public, anon, authenticated;
grant execute on function public.auth_diag_push(jsonb) to service_role;

grant select, insert, update, delete on public.rate_limits, public.app_kv, public.auth_diag_log to service_role;
