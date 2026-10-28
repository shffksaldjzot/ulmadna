-- ============================================================
-- 얼마드나 광고 운영 표 — 광고주·광고 주문·일별 노출/클릭·배너 보관함
-- 작성: 2026년 10월 29일 (관리자 "광고 자리" 실제 운영 기능 1차: 계좌이체 수동 입금 확인)
--
-- [무슨 기능인가]
--   광고주를 등록하고, 주문(지역 x 자리 x 30일 단위 기간)을 만들고, 입금을 확인하고,
--   배너를 올려 승인하면 사이트 광고 자리에 방문자 시도와 맞는 배너가 나온다.
--   카드 결제(토스 PG)가 붙을 때를 대비해 결제 방식(pay_method)·결제 상태(pay_status)·
--   외부 결제번호(pay_ref) 칸을 미리 열어 뒀다.
--
-- [자리 종류 slot_kind]
--   AD-H   헤더 가로 배너 320x100        시도당 3개 업체
--   AD-R   결과 옆 네모 300x250          시도당 3개 업체
--   AD-P   공정 스폰서 320x50            시도 x 공정당 3개 업체 (process 칸에 공정 이름)
--   AD-F   푸터 로테이션 320x50          시도당 3개 업체
--   AD-PDF 견적서 추천 업체(글자만)      개수 제한 없음(견적서 안에 여러 업체)
--   "독점"이라는 말은 쓰지 않는다. 3개 업체가 돌아가며 보인다.
--
-- [기간] 30일 단위(units x 30일). end_date 는 마지막 날(포함). 예: 11-01 시작 1단위 → 11-30 종료.
--
-- [권한]
--   표 3개 모두 RLS 켜고 공개 정책 없음 → 공개 열쇠(anon)로는 읽기·쓰기 전부 막힌다.
--   읽기·쓰기는 사이트 서버(서비스 역할 열쇠)만. 더하기 함수도 service_role 만 실행 가능.
--
-- [실행 방법] Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 광고주
-- ------------------------------------------------------------
create table if not exists public.advertisers (
  id           bigint generated always as identity primary key,
  name         text not null check (length(name) between 1 and 80),  -- 업체명
  ceo          text,                                                  -- 대표자
  biz_no       text,                                                  -- 사업자등록번호
  phone        text,                                                  -- 연락처
  email        text,                                                  -- 이메일(세금계산서·알림용)
  memo         text,                                                  -- 관리자 메모
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. 광고 주문 (한 줄 = 한 업체가 한 자리를 한 기간 산 것)
-- ------------------------------------------------------------
create table if not exists public.ad_orders (
  id            bigint generated always as identity primary key,
  advertiser_id bigint not null references public.advertisers(id) on delete restrict,
  slot_kind     text not null check (slot_kind in ('AD-H','AD-R','AD-P','AD-F','AD-PDF')),
  sido          text not null check (sido ~ '^[0-9]{2}$'),            -- 시도 번호(서울 11, 경기 41 ...)
  process       text,                                                 -- AD-P 일 때 공정 이름(철거·창호 ...)
  start_date    date not null,
  end_date      date not null,                                        -- 마지막 날(포함)
  units         int  not null default 1 check (units between 1 and 24),  -- 30일 단위 개수
  amount        int  not null default 0 check (amount >= 0),          -- 공급가(부가세 별도). 무료 체험이면 0
  vat           int  not null default 0 check (vat >= 0),             -- 부가세
  -- 결제 칸 — 카드 결제 붙일 때 그대로 사용
  pay_method    text not null default 'bank' check (pay_method in ('bank','card')),
  pay_status    text not null default 'pending' check (pay_status in ('pending','paid','refunded')),
  paid_at       timestamptz,                                          -- 입금 확인한 시각
  pay_ref       text,                                                 -- 카드 결제 번호·입금자명 등 외부 참조
  -- 게재 칸
  run_status    text not null default 'review' check (run_status in ('review','live','ended','stopped')),
  banner_path   text,                                                 -- 보관함(ad-banners) 안 파일 경로
  click_url     text check (click_url is null or click_url ~ '^https://'),  -- 배너 누르면 갈 주소(https 만)
  phone         text,                                                 -- 전화 번호(없어도 됨)
  note          text,                                                 -- 반려 사유 등 메모
  created_at    timestamptz not null default now(),
  check (end_date >= start_date),
  check (slot_kind = 'AD-P' or process is null)
);
create index if not exists ad_orders_serve_idx on public.ad_orders (slot_kind, sido, run_status, start_date, end_date);
create index if not exists ad_orders_adv_idx   on public.ad_orders (advertiser_id);

-- ------------------------------------------------------------
-- 3. 일별 노출·클릭 (하루 x 주문 한 칸에 숫자만 더한다 — 개인정보 없음)
-- ------------------------------------------------------------
create table if not exists public.ad_events (
  order_id    bigint not null references public.ad_orders(id) on delete cascade,
  day         date   not null,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks      bigint not null default 0 check (clicks >= 0),
  primary key (order_id, day)
);

alter table public.advertisers enable row level security;
alter table public.ad_orders   enable row level security;
alter table public.ad_events   enable row level security;
-- 공개 정책을 일부러 만들지 않는다(= anon·로그인 열쇠로는 전부 거절). 서비스 역할은 RLS 를 건너뛴다.

-- ------------------------------------------------------------
-- 4. 노출·클릭 더하기 (서버가 부름. 한 번 호출 = 숫자 더하기)
-- ------------------------------------------------------------
create or replace function public.ads_bump(p_order bigint, p_imp int default 0, p_click int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_imp < 0 or p_click < 0 or p_imp > 100 or p_click > 100 then
    raise exception 'ads: 잘못된 값' using errcode = '22023';
  end if;
  insert into public.ad_events as t (order_id, day, impressions, clicks)
  values (p_order, d, p_imp, p_click)
  on conflict (order_id, day) do update
    set impressions = t.impressions + p_imp, clicks = t.clicks + p_click;
exception when foreign_key_violation then
  null; -- 지워진 주문이면 조용히 무시(화면에 이미 나간 배너 클릭 등)
end $$;

-- ------------------------------------------------------------
-- 5. 자리 동시 업체 수 검사
--   종류·시도(·공정)·기간이 겹치는 주문(환불·종료·중지 제외) 수를 센다.
--   겹치는 수가 한도(AD-PDF 만 제한 없음, 나머지 3)에 이르면 available = false.
--   p_exclude 는 수정 중인 주문 자신을 빼는 용도.
--   (겹치는 주문 수를 단순히 세므로 실제 동시 게재 수보다 엄격하게 막을 수 있다 — 안전한 쪽.)
-- ------------------------------------------------------------
create or replace function public.ads_slot_used(
  p_kind text, p_sido text, p_process text, p_from date, p_to date, p_exclude bigint default null)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ad_orders o
   where o.slot_kind = p_kind and o.sido = p_sido
     and (p_kind <> 'AD-P' or o.process is not distinct from p_process)
     and o.start_date <= p_to and o.end_date >= p_from
     and o.pay_status <> 'refunded' and o.run_status in ('review','live')
     and (p_exclude is null or o.id <> p_exclude);
$$;

create or replace function public.ads_slot_available(
  p_kind text, p_sido text, p_process text, p_from date, p_to date, p_exclude bigint default null)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_kind = 'AD-PDF' then true
              else public.ads_slot_used(p_kind, p_sido, p_process, p_from, p_to, p_exclude) < 3 end;
$$;

-- ------------------------------------------------------------
-- 6. 실행 권한 — 서비스 열쇠(사이트 서버)만
-- ------------------------------------------------------------
revoke all on function public.ads_bump(bigint, int, int) from public, anon, authenticated;
revoke all on function public.ads_slot_used(text, text, text, date, date, bigint) from public, anon, authenticated;
revoke all on function public.ads_slot_available(text, text, text, date, date, bigint) from public, anon, authenticated;
grant execute on function public.ads_bump(bigint, int, int) to service_role;
grant execute on function public.ads_slot_used(text, text, text, date, date, bigint) to service_role;
grant execute on function public.ads_slot_available(text, text, text, date, date, bigint) to service_role;

-- ------------------------------------------------------------
-- 7. 배너 보관함 ad-banners (공개 읽기 — 사이트에 그대로 보이는 그림이라 공개)
--   올리기는 관리자 API(서비스 열쇠)만. 크기 1MB·png/jpg 제한을 보관함 설정에서도 건다.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-banners', 'ad-banners', true, 1048576, array['image/png','image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png','image/jpeg'];
