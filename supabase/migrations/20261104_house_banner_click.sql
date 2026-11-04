-- ============================================================
-- 전국 고정 슬롯(도토리 인테리어 컨설팅 배너) 클릭 집계 허용 — 2026년 11월 04일
--
-- [무슨 일을 하나]
--   문의 클릭 표(contact_clicks_daily)의 +1 함수가 지금은 종류를 'phone','kakao' 만 받는다.
--   여기에 'house_incon'(전국 고정 슬롯 배너 클릭)을 더한다. 나머지 검사·동작은 원래와 똑같다.
--   표 구조는 바꾸지 않는다(종류 칸이 원래 글자 칸이라 그대로 쌓임).
--   이 SQL 을 실행하기 전에는 배너 클릭 숫자만 안 쌓이고, 배너 이동은 정상 동작한다.
-- ============================================================
create or replace function public.metrics_bump_contact(p_kind text, p_page text, p_region text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind is null or p_kind not in ('phone','kakao','house_incon') then
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

-- 권한은 원래대로(서버 열쇠만 실행)
revoke all on function public.metrics_bump_contact(text, text, text) from public, anon, authenticated;
grant execute on function public.metrics_bump_contact(text, text, text) to service_role;
