-- ============================================================
-- ⚠️ 초안 — 형아 실행 전. 라이브 DB 에 아직 실행하지 않았다.
-- 광고주 가입 시 국세청 상태조회 결과 기록 (2026-10-30)
--
--   partner_accounts.biz_status : 가입 때 국세청에 물은 결과
--     'active'  = 계속사업자 확인됨
--     'unchecked' = 국세청 장애로 확인 못 하고 통과시킴(나중에 다시 조회 가능)
--   (휴업·폐업·미등록은 가입이 막히므로 저장되지 않는다)
-- 여러 번 실행해도 안전하다. 실행 전에도 가입은 되도록 코드가 이 칸 없이 한 번 더 시도한다.
-- ============================================================
alter table public.partner_accounts
  add column if not exists biz_status text not null default 'unchecked'
  check (biz_status in ('active', 'unchecked'));
