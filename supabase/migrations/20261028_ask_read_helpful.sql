-- ============================================================
-- 얼마드나 물어보기 - 글쓴이 읽음 확인 + "도움됐어요/아쉬워요" 칸 추가
-- 작성: 2026년 10월 28일
--
-- [실행 방법] Supabase 대시보드 > SQL Editor > 붙여 넣고 Run. 여러 번 실행해도 안전.
--   실행 전에도 사이트는 안 터진다(칸이 없으면 기록만 조용히 건너뜀).
--
-- [칸 설명]
--   author_read_at : 글쓴이 본인이 답변을 처음 읽은 시각(한 번 적히면 안 바뀜)
--   helpful        : 글쓴이 평가. true=도움됐어요, false=아쉬워요, null=아직 안 고름
--   helpful_at     : 평가를 마지막으로 고른 시각
-- ============================================================
alter table public.ask_answers add column if not exists author_read_at timestamptz;
alter table public.ask_answers add column if not exists helpful boolean;
alter table public.ask_answers add column if not exists helpful_at timestamptz;
