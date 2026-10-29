-- ============================================================
-- ⚠️ 초안 — 형아 OK 뒤 실행. (라이브 DB 에 아직 실행하지 않았다)
-- 얼마드나 광고 — 배너 제작 대행 칸 추가
-- 작성: 2026년 10월 29일 (앞선 표: 20261029_ads_ops.sql, 20261031_partner_accounts.sql)
--
-- [무슨 기능인가]
--   광고주가 /partner/new 3단계에서 "제작 대행 맡기기"를 고르면 배너 그림 대신
--   업체 소개 한 줄·강조 문구·로고(선택)를 받고, 제작비(5만원, 광고주당 첫 1회 무료)를 함께 결제한다.
--   결제 기록(partner_payments)에 먼저 적고, 결제가 확인되면 광고 주문(ad_orders)으로 그대로 옮긴다.
--   주문은 배너 없이 '검토(review)' 상태로 생기고, 화면에는 "배너 제작 중"으로 보인다.
--   관리자가 배너를 올리면 "배너 검토 중"으로 바뀌고, 승인하면 게재된다(새 상태값은 만들지 않음).
--
-- [칸 3개 — 두 표에 똑같이]
--   design_requested  제작 대행을 맡겼는지(기본 false)
--   design_brief      입력 내용 {name, phone, intro, headline, logo_path}
--   design_fee        제작비 공급가(원, 첫 회 무료면 0). 주문의 amount(공급가)에는 이미 더해져 있다
--
-- [첫 회 무료 판정] 그 광고주의 ad_orders 에 design_requested = true 인 줄이 있는지로 서버가 판정한다.
-- [실행 방법] Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ============================================================

-- 1. 광고 주문
alter table public.ad_orders add column if not exists design_requested boolean not null default false;
alter table public.ad_orders add column if not exists design_brief     jsonb;
alter table public.ad_orders add column if not exists design_fee       int not null default 0;

-- 2. 카드 결제 기록
alter table public.partner_payments add column if not exists design_requested boolean not null default false;
alter table public.partner_payments add column if not exists design_brief     jsonb;
alter table public.partner_payments add column if not exists design_fee       int not null default 0;

-- 3. 제작비는 0 이상(이미 있으면 지우고 다시 건다 — 재실행 안전)
alter table public.ad_orders        drop constraint if exists ad_orders_design_fee_chk;
alter table public.ad_orders        add  constraint ad_orders_design_fee_chk        check (design_fee >= 0);
alter table public.partner_payments drop constraint if exists partner_payments_design_fee_chk;
alter table public.partner_payments add  constraint partner_payments_design_fee_chk check (design_fee >= 0);

-- 4. 첫 회 무료 판정용(광고주별 제작 대행 주문 찾기)
create index if not exists ad_orders_design_adv_idx on public.ad_orders (advertiser_id) where design_requested;
