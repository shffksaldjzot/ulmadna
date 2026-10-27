-- ============================================================
-- 얼마드나 자체 집계 표 — 글 조회수·계산기 실행·문의 클릭·좋아요
-- 작성: 2026년 10월 27일 (관리자 페이지 계획안 1단계 1-a)
--
-- [왜 만드나]
--   지금까지 이 숫자들은 Upstash Redis(무료 월 50만 명령)에 쌓았는데, 10월에 한도가
--   바닥나 조회수·계산기 집계가 아무 표시 없이 빠졌다. Supabase 는 요청 횟수 제한이 없어서
--   여기로 옮긴다. 또 Redis 쪽은 "누적 숫자 1개"나 "40일 뒤 삭제"라서 기간 비교가 안 됐다.
--
-- [쌓는 방식]
--   사람 한 명의 행동을 한 줄씩 쌓지 않는다. "날짜 × 항목" 묶음 칸 하나에 숫자 +1 만 한다.
--   → 행 수가 작고, IP·브라우저 정보 원문 같은 개인정보가 전혀 남지 않는다.
--   더하기는 DB 함수(metrics_bump_*) 한 번 호출로 끝난다(동시에 여러 명이 눌러도 안 꼬임).
--
-- [사장님 실행 방법]
--   Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
--
-- [권한]
--   표 4개 모두 RLS(행 보안) 켜고 공개 정책 없음 → 공개 열쇠(anon)로는 읽기·쓰기 전부 막힌다.
--   쓰기는 더하기 함수(security definer)로만, 그것도 서비스 역할 열쇠(사이트 서버)로만 부를 수 있다.
--   함수 안에서 입력값을 허용 목록·정규식으로 한 번 더 검사한다.
--   읽기는 서버의 서비스 역할 열쇠(관리자·리포트 봇)로만.
-- ============================================================

-- ------------------------------------------------------------
-- 0. 공통 — 허용 값 목록
--   지역(region): 시도 번호(ISO 3166-2:KR 숫자). 강원 42→51, 전북 45→52 는 사이트 서버가
--                 새 번호로 바꿔서 보낸다. ZZ = 해외, unknown = 알 수 없음.
--                 'legacy' 는 옛 Upstash 이관 줄 표시용 — 더하기 함수로는 못 넣는다(이관 스크립트 전용).
--   기기(device): mobile(휴대폰) · tablet(태블릿) · pc · unknown
--   유입(src):    direct(주소 직접·즐겨찾기) · search(검색) · share(결과 공유 링크) · other(그 밖)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. 글·화면 조회수 (하루 × 글 × 지역 × 기기 × 유입)
--   slug: 블로그 글 slug(영문 소문자·숫자·하이픈), 또는 계산기 결과 화면 'calc/<공정>/result'
--   day '2000-01-01' 줄 = 옛 Upstash 누적 조회수 이관분(날짜 모름)
-- ------------------------------------------------------------
create table if not exists public.page_views_daily (
  day    date   not null,
  slug   text   not null,
  region text   not null default 'unknown',
  device text   not null default 'unknown',
  src    text   not null default 'direct',
  views  bigint not null default 0 check (views >= 0),
  primary key (day, slug, region, device, src)
);
-- 글 하나의 누적 조회수를 빨리 더하려고 slug 색인을 따로 둔다
create index if not exists page_views_daily_slug_idx on public.page_views_daily (slug);

-- ------------------------------------------------------------
-- 2. 계산기 실행 (하루 × 공정 × 모드 × 평형대 × 지역 × 기기 × 유입)
--   pyeong_bucket: 10평 단위('20','30'…), 평형 입력이 아니면 'na'
-- ------------------------------------------------------------
create table if not exists public.calc_runs_daily (
  day           date   not null,
  process       text   not null,
  mode          text   not null,
  pyeong_bucket text   not null default 'na',
  region        text   not null default 'unknown',
  device        text   not null default 'unknown',
  src           text   not null default 'direct',
  runs          bigint not null default 0 check (runs >= 0),
  primary key (day, process, mode, pyeong_bucket, region, device, src)
);

-- ------------------------------------------------------------
-- 3. 문의(전화·카톡) 클릭 (하루 × 종류 × 누른 화면 × 지역)
--   page: 누른 화면 주소(쿼리 뺀 경로, 예 '/blog/xxx', '/calc/wallpaper'), 모르면 'unknown'
-- ------------------------------------------------------------
create table if not exists public.contact_clicks_daily (
  day    date   not null,
  kind   text   not null,
  page   text   not null default 'unknown',
  region text   not null default 'unknown',
  runs   bigint not null default 0 check (runs >= 0),
  primary key (day, kind, page, region)
);

-- ------------------------------------------------------------
-- 4. 글 좋아요 누적 (글마다 숫자 1개 — 날짜 없음)
-- ------------------------------------------------------------
create table if not exists public.post_likes (
  slug       text        primary key,
  likes      bigint      not null default 0 check (likes >= 0),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. 권한 — RLS 켜고 공개 열쇠는 표에 직접 손 못 대게
-- ------------------------------------------------------------
alter table public.page_views_daily     enable row level security;
alter table public.calc_runs_daily      enable row level security;
alter table public.contact_clicks_daily enable row level security;
alter table public.post_likes           enable row level security;
revoke all on public.page_views_daily, public.calc_runs_daily,
              public.contact_clicks_daily, public.post_likes from anon, authenticated;

-- ------------------------------------------------------------
-- 6. 입력 검사 도우미 (거절이면 오류를 던진다 — 오류 번호 22023 = 잘못된 값)
-- ------------------------------------------------------------
create or replace function public.metrics_check_common(p_region text, p_device text, p_src text)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p_region is null or p_region not in ('11','26','27','28','29','30','31','41','43','44',
                                          '46','47','48','49','50','51','52','ZZ','unknown') then
    raise exception 'metrics: 잘못된 region %', p_region using errcode = '22023';
  end if;
  if p_device is null or p_device not in ('mobile','tablet','pc','unknown') then
    raise exception 'metrics: 잘못된 device %', p_device using errcode = '22023';
  end if;
  if p_src is null or p_src not in ('direct','search','share','other') then
    raise exception 'metrics: 잘못된 src %', p_src using errcode = '22023';
  end if;
end $$;

-- 한국 날짜(오늘) — 날짜는 호출하는 쪽이 아니라 DB가 정한다(조작 방지)
create or replace function public.metrics_kst_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- 글 slug 또는 계산기 결과 화면 이름인지 검사
create or replace function public.metrics_valid_slug(p_slug text)
returns boolean language sql immutable set search_path = public as $$
  select p_slug is not null and (
    p_slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'
    or p_slug ~ '^calc/(wallpaper|flooring|mortar|tile)/result$'
  );
$$;

-- ------------------------------------------------------------
-- 7. 더하기 함수 4개 (metrics_bump_*)
-- ------------------------------------------------------------

-- 7-1. 조회수 +1
create or replace function public.metrics_bump_view(
  p_slug text, p_region text, p_device text, p_src text default 'direct')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.metrics_valid_slug(p_slug) then
    raise exception 'metrics: 잘못된 slug %', p_slug using errcode = '22023';
  end if;
  perform public.metrics_check_common(p_region, p_device, p_src);
  insert into public.page_views_daily as t (day, slug, region, device, src, views)
  values (public.metrics_kst_today(), p_slug, p_region, p_device, p_src, 1)
  on conflict (day, slug, region, device, src) do update set views = t.views + 1;
end $$;

-- 7-2. 계산기 실행 +1
create or replace function public.metrics_bump_calc(
  p_process text, p_mode text, p_pyeong_bucket text,
  p_region text, p_device text, p_src text default 'direct')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_process is null or p_process not in ('wallpaper','flooring','mortar','tile') then
    raise exception 'metrics: 잘못된 process %', p_process using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('quick','precise') then
    raise exception 'metrics: 잘못된 mode %', p_mode using errcode = '22023';
  end if;
  -- 평형대: 'na' 또는 0~200 사이 10 단위
  if p_pyeong_bucket is null or not (p_pyeong_bucket = 'na'
       or (p_pyeong_bucket ~ '^[0-9]{1,3}0$' and p_pyeong_bucket::int <= 200)
       or p_pyeong_bucket = '0') then
    raise exception 'metrics: 잘못된 pyeong_bucket %', p_pyeong_bucket using errcode = '22023';
  end if;
  perform public.metrics_check_common(p_region, p_device, p_src);
  insert into public.calc_runs_daily as t (day, process, mode, pyeong_bucket, region, device, src, runs)
  values (public.metrics_kst_today(), p_process, p_mode, p_pyeong_bucket, p_region, p_device, p_src, 1)
  on conflict (day, process, mode, pyeong_bucket, region, device, src) do update set runs = t.runs + 1;
end $$;

-- 7-3. 문의 클릭 +1
create or replace function public.metrics_bump_contact(p_kind text, p_page text, p_region text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind is null or p_kind not in ('phone','kakao') then
    raise exception 'metrics: 잘못된 kind %', p_kind using errcode = '22023';
  end if;
  -- 화면 경로: '/'로 시작하는 영문 소문자·숫자·하이픈·밑줄·슬래시 120자 이하, 또는 'unknown'
  if p_page is null or not (p_page = 'unknown' or p_page ~ '^/[a-z0-9/_-]{0,119}$') then
    raise exception 'metrics: 잘못된 page %', p_page using errcode = '22023';
  end if;
  perform public.metrics_check_common(p_region, 'unknown', 'direct');
  insert into public.contact_clicks_daily as t (day, kind, page, region, runs)
  values (public.metrics_kst_today(), p_kind, p_page, p_region, 1)
  on conflict (day, kind, page, region) do update set runs = t.runs + 1;
end $$;

-- 7-4. 좋아요 +1 / -1 (0 밑으로는 안 내려감). 바뀐 뒤 숫자를 돌려준다.
create or replace function public.metrics_bump_like(p_slug text, p_delta int)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,99}$' then
    raise exception 'metrics: 잘못된 slug %', p_slug using errcode = '22023';
  end if;
  if p_delta is null or p_delta not in (1, -1) then
    raise exception 'metrics: 잘못된 delta %', p_delta using errcode = '22023';
  end if;
  insert into public.post_likes as t (slug, likes, updated_at)
  values (p_slug, greatest(p_delta, 0), now())
  on conflict (slug) do update set likes = greatest(t.likes + p_delta, 0), updated_at = now()
  returning likes into n;
  return n;
end $$;

-- ------------------------------------------------------------
-- 8. 읽기 함수 (서비스 역할 전용)
-- ------------------------------------------------------------

-- 8-1. 글 하나의 누적 조회수 + 좋아요 (글 화면이 60초 캐시로 1회 읽음)
create or replace function public.metrics_post_totals(p_slug text)
returns table (views bigint, likes bigint) language sql stable security definer set search_path = public as $$
  select coalesce((select sum(v.views) from public.page_views_daily v where v.slug = p_slug), 0)::bigint,
         coalesce((select l.likes from public.post_likes l where l.slug = p_slug), 0)::bigint;
$$;

-- 8-2. 리포트 봇용 기간 요약(한국 날짜 p_from ~ p_to, 양끝 포함) — JSON 하나로 돌려준다
--   calc:        공정별 실행 수            {"wallpaper": 3, ...}
--   contact:     종류별 클릭 수            {"phone": 1, "kakao": 2}
--   regions:     조회수 지역 상위 5        [{"region":"11","views":120}, ...]  ('legacy' 이관 줄 제외)
--   share_views: 공유 링크로 들어온 조회 수
--   share_runs:  공유 링크로 들어온 사람의 계산 실행 수
create or replace function public.metrics_report(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'calc', coalesce((select jsonb_object_agg(process, n) from (
               select process, sum(runs)::bigint n from public.calc_runs_daily
                where day between p_from and p_to group by process) c), '{}'::jsonb),
    'contact', coalesce((select jsonb_object_agg(kind, n) from (
               select kind, sum(runs)::bigint n from public.contact_clicks_daily
                where day between p_from and p_to group by kind) k), '{}'::jsonb),
    'regions', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'views', n) order by n desc) from (
               select region, sum(views)::bigint n from public.page_views_daily
                where day between p_from and p_to and region not in ('unknown','legacy')
                group by region order by n desc limit 5) r), '[]'::jsonb),
    'share_views', (select coalesce(sum(views), 0)::bigint from public.page_views_daily
                     where day between p_from and p_to and src = 'share'),
    'share_runs',  (select coalesce(sum(runs), 0)::bigint from public.calc_runs_daily
                     where day between p_from and p_to and src = 'share')
  );
$$;

-- ------------------------------------------------------------
-- 9. 함수 실행 권한
--   더하기 함수: 서비스 열쇠(사이트 서버)만. 공개 열쇠(anon)·로그인 열쇠로는 못 부른다
--                (2026-10-27 수정: 브라우저에 있는 공개 열쇠로 직접 불러 숫자를 부풀리는 것을 막음.
--                 사이트 서버가 봇 거르기·실제 글 확인을 한 뒤 서비스 열쇠로만 부른다).
--   읽기 함수:   서비스 열쇠만.
--   도우미 함수: 더하기 함수 안에서만 쓰므로 바깥 호출 막음.
-- ------------------------------------------------------------
revoke all on function public.metrics_bump_view(text, text, text, text)               from public, anon, authenticated;
revoke all on function public.metrics_bump_calc(text, text, text, text, text, text)   from public, anon, authenticated;
revoke all on function public.metrics_bump_contact(text, text, text)                  from public, anon, authenticated;
revoke all on function public.metrics_bump_like(text, int)                            from public, anon, authenticated;
grant execute on function public.metrics_bump_view(text, text, text, text)             to service_role;
grant execute on function public.metrics_bump_calc(text, text, text, text, text, text) to service_role;
grant execute on function public.metrics_bump_contact(text, text, text)                to service_role;
grant execute on function public.metrics_bump_like(text, int)                          to service_role;

revoke all on function public.metrics_post_totals(text)  from public, anon, authenticated;
revoke all on function public.metrics_report(date, date) from public, anon, authenticated;
grant execute on function public.metrics_post_totals(text)  to service_role;
grant execute on function public.metrics_report(date, date) to service_role;

revoke all on function public.metrics_check_common(text, text, text) from public, anon, authenticated;
revoke all on function public.metrics_valid_slug(text)               from public, anon, authenticated;
revoke all on function public.metrics_kst_today()                    from public, anon, authenticated;
