-- ============================================================
-- ⚠️ 초안 — 형아 OK 뒤 실행. (라이브 DB 에 아직 실행하지 않았다)
-- 얼마드나 광고주 셀프 화면(/partner) — 업체 계정·로그인 세션·카드 결제 기록
-- 작성: 2026년 10월 31일 (앞선 표: 20261029_ads_ops.sql, 20261030_ads_desktop_banner.sql)
--
-- [무슨 기능인가]
--   광고주가 직접 가입·로그인해서 자기 광고를 보고, 새 광고를 신청하고, 카드로 결제한다.
--   소비자 회원(카카오·아이디, NextAuth)과 섞지 않고 업체 계정을 따로 둔다.
--
-- [왜 advertisers 에 칸을 더하지 않고 표를 따로 만들었나]
--   기존 advertisers 표는 관리자가 손으로 등록하는 표라 email 칸이 비었거나 겹칠 수 있다.
--   거기에 unique·비밀번호 칸을 더하면 기존 줄이 제약에 걸릴 수 있어서,
--   로그인 정보는 partner_accounts 표에 따로 두고 advertisers 와 1:1 로 잇는다(덜 침습적).
--
-- [표 3개]
--   partner_accounts  업체 로그인 계정(이메일·비밀번호 해시·사업자번호·주 시공 지역·상태)
--   partner_sessions  로그인 세션(쿠키에 든 랜덤 값의 해시만 저장, 30일)
--   partner_payments  카드 결제 한 건(새 광고·30일 연장). 결제가 끝나야 ad_orders 에 주문이 생긴다
--
-- [권한] 세 표 모두 RLS 켜고 공개 정책 없음 → 사이트 서버(서비스 역할 열쇠)만 읽고 쓴다.
-- [실행 방법] Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 업체 로그인 계정 (광고주 1곳 = 계정 1개)
-- ------------------------------------------------------------
create table if not exists public.partner_accounts (
  id             bigint generated always as identity primary key,
  advertiser_id  bigint not null unique references public.advertisers(id) on delete cascade,
  email          text not null check (email = lower(email) and length(email) between 5 and 100),  -- 로그인 이메일(소문자로만 저장)
  password_hash  text not null,                                       -- bcrypt 해시(원문 비밀번호는 저장 안 함)
  biz_no         text not null check (biz_no ~ '^[0-9]{10}$'),        -- 사업자번호 숫자 10자리(형식만 검사, 진위 확인은 나중에)
  region         text not null check (region ~ '^[0-9]{2}$'),         -- 주로 시공하는 시도 번호(서울 11 ...)
  status         text not null default 'active' check (status in ('active','blocked')),
  agreed_at      timestamptz not null default now(),                  -- 약관 동의 시각
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);
create unique index if not exists partner_accounts_email_uq on public.partner_accounts (email);

-- ------------------------------------------------------------
-- 2. 로그인 세션 (쿠키 partner-session 의 값을 sha256 한 것만 저장)
-- ------------------------------------------------------------
create table if not exists public.partner_sessions (
  token_hash     text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  advertiser_id  bigint not null references public.advertisers(id) on delete cascade,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);
create index if not exists partner_sessions_adv_idx on public.partner_sessions (advertiser_id);
create index if not exists partner_sessions_exp_idx on public.partner_sessions (expires_at);

-- ------------------------------------------------------------
-- 3. 카드 결제 기록 (포트원 결제 한 건 = 한 줄)
--   kind 'new'    : 새 광고. 결제 확인 뒤 ad_orders 한 줄을 만들고 order_id 에 적는다
--   kind 'extend' : 기존 주문(order_id) 30일 연장. 결제 확인 뒤 그 주문의 마지막 날을 늘린다
--   slot_kind/process 는 ad_orders 와 같은 DB 저장 방식(토탈 인테리어 AD-T = 'AD-P' + '토탈 인테리어')
--   status ready(결제창 열림) → paid(확인 끝) / failed / refunded(반려 등으로 카드 취소)
-- ------------------------------------------------------------
create table if not exists public.partner_payments (
  id             bigint generated always as identity primary key,
  payment_id     text not null unique check (length(payment_id) between 8 and 64),  -- 포트원 결제 번호(우리가 만들어 넘김)
  advertiser_id  bigint not null references public.advertisers(id) on delete restrict,
  kind           text not null check (kind in ('new','extend')),
  order_id       bigint references public.ad_orders(id) on delete set null,
  slot_kind      text not null check (slot_kind in ('AD-H','AD-R','AD-P','AD-F','AD-PDF')),
  sido           text not null check (sido ~ '^[0-9]{2}$'),
  process        text,
  units          int  not null check (units between 1 and 24),
  amount         int  not null check (amount >= 0),                    -- 공급가
  vat            int  not null check (vat >= 0),                       -- 부가세
  total          int  not null check (total = amount + vat),           -- 카드로 낸 금액
  banner_path    text,                                                 -- 새 광고의 배너(보관함 ad-banners)
  click_url      text check (click_url is null or click_url ~ '^https://'),
  phone          text,
  status         text not null default 'ready' check (status in ('ready','paid','failed','refunded')),
  paid_at        timestamptz,
  refunded_at    timestamptz,
  fail_reason    text,
  tax_invoice_requested_at timestamptz,                                -- "세금계산서 요청" 누른 시각(관리자 처리는 나중에)
  created_at     timestamptz not null default now()
);
create index if not exists partner_payments_adv_idx on public.partner_payments (advertiser_id, created_at desc);

alter table public.partner_accounts enable row level security;
alter table public.partner_sessions enable row level security;
alter table public.partner_payments enable row level security;
-- 공개 정책을 일부러 만들지 않는다(= anon·로그인 열쇠로는 전부 거절). 서비스 역할은 RLS 를 건너뛴다.
