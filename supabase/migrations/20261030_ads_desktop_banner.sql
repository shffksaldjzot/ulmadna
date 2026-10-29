-- ============================================================
-- ⚠️ 초안 — 형아 OK 뒤 실행. (라이브 DB 에 아직 실행하지 않았다)
-- 얼마드나 광고 주문 · PC 그림 칸 추가
-- 작성: 2026년 10월 30일 (앞선 표 정의: 20261029_ads_ops.sql)
--
-- [무슨 기능인가]
--   AD-H(헤더 가로)·AD-F(푸터)는 PC(화면 폭 1024px 이상)에서 728x90 상자로 나온다.
--   주문 하나에 그림 두 장을 둘 수 있게 한다.
--     banner_path          휴대폰 그림(필수, 320x100 / 320x50 등 기존 그대로)
--     banner_desktop_path  PC 그림(선택, 728x90 또는 2배 1456x180) — 없으면 PC 에서도 휴대폰 그림을 가운데 보여 준다
--   그림 파일은 기존 보관함(ad-banners)에 같이 둔다(파일 이름 앞에 pc- 가 붙음).
--
-- [실행 전에도 사이트는 그대로 동작한다]
--   서버 코드는 이 칸이 없으면 PC 그림 없이(휴대폰 그림만) 배너를 보여 준다.
--   관리자 화면의 "PC 그림" 올리기만 "칸이 없어요" 문구로 실패한다.
--
-- [실행 방법] Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PC 그림 경로 칸 (선택)
-- ------------------------------------------------------------
alter table public.ad_orders add column if not exists banner_desktop_path text;
comment on column public.ad_orders.banner_desktop_path is 'PC 전용 배너 그림 경로(ad-banners 보관함, AD-H·AD-F 만, 선택)';

-- ------------------------------------------------------------
-- 2. 지역 '전국'(ALL) 허용 — 준비만(판매하지 않는다, 2026-10-29)
--   sido 칸에 'ALL' 이 있으면 사이트 서버가 방문자 지역과 상관없이 그 주문을 후보로 넣는다.
--   기존 제약(시도 두 자리 번호만)을 풀어 'ALL' 도 받게 한다.
-- ------------------------------------------------------------
alter table public.ad_orders drop constraint if exists ad_orders_sido_check;
alter table public.ad_orders add constraint ad_orders_sido_check check (sido ~ '^[0-9]{2}$' or sido = 'ALL');

-- ------------------------------------------------------------
-- 3. 자리 동시 업체 수 검사에 '전국' 반영
--   - 지역 주문을 검사할 때: 그 지역 주문 + 전국 주문을 함께 센다(전국 주문은 모든 지역 자리를 차지).
--   - 전국 주문을 검사할 때: 전국 주문 수 + 가장 많이 찬 지역의 주문 수.
--   그 밖의 조건(종류·공정·기간 겹침·환불/종료/중지 제외)은 20261029_ads_ops.sql 과 같다.
-- ------------------------------------------------------------
create or replace function public.ads_slot_used(
  p_kind text, p_sido text, p_process text, p_from date, p_to date, p_exclude bigint default null)
returns int language sql stable security definer set search_path = public as $$
  with o as (
    select o.sido from public.ad_orders o
     where o.slot_kind = p_kind
       and (p_kind <> 'AD-P' or o.process is not distinct from p_process)
       and o.start_date <= p_to and o.end_date >= p_from
       and o.pay_status <> 'refunded' and o.run_status in ('review','live')
       and (p_exclude is null or o.id <> p_exclude)
  )
  select (case
    when p_sido = 'ALL' then
      (select count(*) from o where sido = 'ALL')
      + coalesce((select max(c) from (select count(*) as c from o where sido <> 'ALL' group by sido) t), 0)
    else
      (select count(*) from o where sido = p_sido or sido = 'ALL')
  end)::int;
$$;
-- 권한은 20261029_ads_ops.sql 에서 준 그대로 유지된다(create or replace 는 권한을 바꾸지 않음)
