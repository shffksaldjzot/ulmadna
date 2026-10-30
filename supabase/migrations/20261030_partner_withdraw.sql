-- ============================================================
-- ⚠️ 초안 — 형아 실행 전. 라이브 DB 에 아직 실행하지 않았다.
-- 광고주 "탈퇴 요청" (2026-10-30)
--
--   partner_accounts.status 에 'withdraw_requested'(탈퇴 요청) 값을 추가하고
--   partner_accounts.withdraw_requested_at(요청 시각) 칸을 만든다.
--   탈퇴 요청 중에도 로그인은 되고(게재 중 광고 확인용), 관리자가 광고주 화면에서 처리한다.
-- 여러 번 실행해도 안전하다.
-- ============================================================
alter table public.partner_accounts drop constraint if exists partner_accounts_status_check;
alter table public.partner_accounts
  add constraint partner_accounts_status_check check (status in ('active', 'blocked', 'withdraw_requested'));
alter table public.partner_accounts add column if not exists withdraw_requested_at timestamptz;
