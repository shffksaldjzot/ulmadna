-- ============================================================
-- 얼마드나 물어보기 — 말머리(카테고리) 칸 추가
-- 작성: 2026년 10월 03일
--
-- [사장님 실행 방법]
--   Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
--   실행 전에도 사이트는 안 터진다(칸이 없으면 옛 kind 로 말머리를 대신 보여 줌).
--
-- [무엇을 하나]
--   ask_posts 에 category(말머리) 칸을 더한다. 값은 사이트 코드의 ASK_CATEGORIES key:
--   estimate(견적서 봐주세요) · cost(비용 질문) · howto(시공 질문) · material(자재·제품)
--   · defect(하자·AS) · etc(기타). 말머리가 늘 수 있어 DB엔 check 제약을 걸지 않는다
--   (검사는 사이트 서버가 한다).
--   옛 kind 칸(estimate|cost)은 답변기·씨앗 스크립트 호환용으로 그대로 둔다.
-- ============================================================

-- 1. 칸 추가(없을 때만). 기본값 'cost'
alter table public.ask_posts add column if not exists category text not null default 'cost';

-- 2. 이미 있는 글은 옛 kind 값으로 채운다(estimate → estimate, cost 는 기본값 그대로 cost)
--    다시 실행해도 새 말머리(howto 등)를 고른 글은 건드리지 않는다
update public.ask_posts set category = 'estimate' where kind = 'estimate' and category = 'cost';

-- 3. 말머리별 최신순 목록용 색인
create index if not exists ask_posts_category_created_idx on public.ask_posts (category, created_at desc);

-- 4. 공개 열쇠(anon)로도 말머리 칸을 읽을 수 있게(20261003_ask.sql 의 칸 단위 읽기 권한에 추가)
grant select (category) on public.ask_posts to anon, authenticated;
