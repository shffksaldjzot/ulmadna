-- ============================================================
-- 얼마드나 "물어보기" 게시판 — 표·권한·사진 보관함 한 번에 만들기
-- 작성: 2026년 10월 03일
--
-- [사장님 실행 방법]
--   Supabase 대시보드 → SQL Editor → 이 파일 내용을 통째로 붙여 넣고 Run.
--   여러 번 실행해도 안전하게(이미 있으면 건너뛰게) 썼다.
--
-- [권한 원칙]
--   - 쓰기(글·댓글·피드백·신고)는 전부 사이트 서버(서비스 역할 열쇠)만 한다.
--     → 브라우저가 공개 열쇠로 직접 쓰는 길은 막는다(RLS 켜고 쓰기 정책을 안 만듦).
--   - 읽기는 공개 자료라 누구나(anon) 허용한다. 단 카카오 회원 번호(user_id)는
--     공개 열쇠로 못 읽게 "칸 단위 권한"으로 뺀다.
--   - 집컴 답변기는 서비스 역할 열쇠로 직접 접속해 답을 쓴다(RLS 영향 없음).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 닉네임 표: 카카오 로그인 회원마다 닉네임 하나
-- ------------------------------------------------------------
create table if not exists public.ask_profiles (
  user_id    text primary key,                         -- NextAuth 카카오 회원 번호
  nickname   text not null unique
             check (char_length(nickname) between 2 and 12), -- 2~12자
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. 질문 표
-- ------------------------------------------------------------
create table if not exists public.ask_posts (
  id            bigserial primary key,
  slug          text not null unique,                  -- 주소용: "1024-34평-도배-강마루-견적"
  user_id       text not null,                         -- 쓴 사람(카카오 회원 번호, 비공개)
  nickname      text not null,                         -- 쓸 때의 닉네임(나중에 이름 바꿔도 글엔 그대로)
  kind          text not null check (kind in ('estimate','cost')), -- 견적서 봐주세요 / 비용 질문
  title         text not null check (char_length(title) between 2 and 60),
  body          text not null default '',
  pyeong        int null,                              -- 평형(예: 34)
  type_code     text null,                             -- 타입(예: '84')
  region        text null,                             -- 지역(예: '경기')
  trades        text[] not null default '{}',          -- 공정 태그(예: {도배,바닥})
  -- 사진 목록. 한 장마다 {"raw": 원본 경로(비공개 보관함), "masked": 가린 사본 경로(공개 보관함) 또는 null}
  -- 화면에는 masked만 보여 준다. masked가 비어 있으면 "가리는 중" 자리만 보인다.
  photos        jsonb not null default '[]'::jsonb,
  from_slug     text null,                             -- 블로그 글에서 왔으면 그 글 주소
  status        text not null default 'queued'
                check (status in ('queued','answered','hidden')),
  view_count    int not null default 0,
  comment_count int not null default 0,
  answered_at   timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ask_posts_status_created_idx on public.ask_posts (status, created_at desc);
create index if not exists ask_posts_created_idx on public.ask_posts (created_at desc);
create index if not exists ask_posts_user_idx on public.ask_posts (user_id, created_at desc);
create index if not exists ask_posts_from_slug_idx on public.ask_posts (from_slug);
create index if not exists ask_posts_trades_idx on public.ask_posts using gin (trades);

-- ------------------------------------------------------------
-- 3. AI 답변 표 (고쳐 쓰면 version이 하나씩 올라간다 — 화면은 가장 큰 version)
-- ------------------------------------------------------------
create table if not exists public.ask_answers (
  id         bigserial primary key,
  post_id    bigint not null references public.ask_posts(id) on delete cascade,
  version    int not null default 1,
  body_md    text not null,                            -- 답변 본문(마크다운, 표 가능)
  summary    text not null default '',                 -- 한 줄 요약 — 목록 미리보기·검색 설명문
  -- 근거 묶음. 화면이 읽는 칸:
  --   n(비슷한 견적서 수), period(예: "2026년 4~9월"), region(예: "수도권"),
  --   calcs([{label, href}]) 관련 계산기, posts([{title, slug}]) 관련 블로그 글,
  --   그 밖의 칸(항목표·판단 등)은 집컴이 자유롭게 넣어도 된다.
  basis      jsonb not null default '{}'::jsonb,
  model      text null,                                -- 답을 쓴 모델 이름
  created_at timestamptz not null default now(),
  unique (post_id, version)
);
create index if not exists ask_answers_post_idx on public.ask_answers (post_id, version desc);

-- ------------------------------------------------------------
-- 4. 댓글 표 (회원 댓글 + AI 재답변)
-- ------------------------------------------------------------
create table if not exists public.ask_comments (
  id         bigserial primary key,
  post_id    bigint not null references public.ask_posts(id) on delete cascade,
  user_id    text null,                                -- AI 댓글이면 비어 있음
  nickname   text not null,
  is_ai      boolean not null default false,
  body       text not null check (char_length(body) between 1 and 1000),
  status     text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists ask_comments_post_idx on public.ask_comments (post_id, created_at);
create index if not exists ask_comments_user_idx on public.ask_comments (user_id, created_at desc);

-- ------------------------------------------------------------
-- 5. 답변 평가 표 (도움 됐어요 / 틀렸어요 — 한 사람이 답변 하나에 한 번)
-- ------------------------------------------------------------
create table if not exists public.ask_feedback (
  id         bigserial primary key,
  answer_id  bigint not null references public.ask_answers(id) on delete cascade,
  user_id    text not null,
  kind       text not null check (kind in ('helpful','wrong')),
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

-- ------------------------------------------------------------
-- 6. 신고 표 (신고해도 글 상태는 그대로 — 사장님이 보고 판단)
-- ------------------------------------------------------------
create table if not exists public.ask_reports (
  id         bigserial primary key,
  post_id    bigint not null references public.ask_posts(id) on delete cascade,
  user_id    text null,                                -- 로그인 안 하고 신고하면 비어 있음
  reason     text null,
  created_at timestamptz not null default now()
);
create index if not exists ask_reports_post_idx on public.ask_reports (post_id);

-- ------------------------------------------------------------
-- 7. 숫자 표 (집컴이 밤마다 넣는 "오늘 기준 빅데이터 견적서" 숫자)
--    key='global' 한 줄. 집컴 build-stats.mjs 가 넣는 data 모양(사이트 화면 코드와 칸 이름 동일):
--    {"real": 470, "shown": 1470, "delta": 24, "updated": "2026.10.03"}
--    real=실제 견적서 수(화면에 안 보임), shown=표시 수(실제+1,000), delta=어제 대비 증감,
--    updated=갱신일("2026.10.03" 점 표기). shown이 없으면 화면이 real+1,000으로 계산한다.
-- ------------------------------------------------------------
create table if not exists public.ask_stats (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. 조회수 1 올리기 (동시에 여러 명이 봐도 숫자가 안 꼬이게 DB 안에서 한 번에)
-- ------------------------------------------------------------
create or replace function public.ask_inc_view(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.ask_posts set view_count = view_count + 1 where id = p_id;
$$;
revoke all on function public.ask_inc_view(bigint) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 8-2. 자동 맞춤 장치(트리거)
--   집컴 답변기는 사이트 API를 거치지 않고 DB에 직접 쓴다(AI 댓글·답변 상태 변경).
--   그래도 숫자·날짜가 어긋나지 않게 DB가 스스로 맞춘다.
--   (1) 댓글이 생기거나 숨겨지거나 지워지면 → 질문의 comment_count 를 다시 센다
--   (2) 질문 행이 바뀌면 → updated_at 을 지금 시각으로(사이트맵 "마지막 수정일"에 쓰임)
-- ------------------------------------------------------------
create or replace function public.ask_sync_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  pid := coalesce(new.post_id, old.post_id);
  update public.ask_posts
     set comment_count = (select count(*) from public.ask_comments c where c.post_id = pid and c.status = 'visible')
   where id = pid;
  return null;
end $$;
drop trigger if exists ask_comments_count_trg on public.ask_comments;
create trigger ask_comments_count_trg after insert or update of status or delete on public.ask_comments
  for each row execute function public.ask_sync_comment_count();

create or replace function public.ask_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ask_posts_touch_trg on public.ask_posts;
-- 조회수만 오를 때는 날짜를 안 바꾼다(조회수 1 오를 때마다 "수정됨"이 되면 사이트맵이 의미 없어짐)
create trigger ask_posts_touch_trg before update on public.ask_posts
  for each row when (old.* is distinct from new.* and old.view_count = new.view_count)
  execute function public.ask_touch_updated_at();

-- ------------------------------------------------------------
-- 9. 행 단위 보안(RLS) — 켜고, 읽기만 공개
-- ------------------------------------------------------------
alter table public.ask_profiles enable row level security;
alter table public.ask_posts    enable row level security;
alter table public.ask_answers  enable row level security;
alter table public.ask_comments enable row level security;
alter table public.ask_feedback enable row level security;
alter table public.ask_reports  enable row level security;
alter table public.ask_stats    enable row level security;

-- 공개 읽기 정책 (숨김 글·숨김 댓글은 공개 열쇠로 안 보이게)
drop policy if exists ask_posts_public_read on public.ask_posts;
create policy ask_posts_public_read on public.ask_posts for select to anon, authenticated using (status <> 'hidden');
drop policy if exists ask_answers_public_read on public.ask_answers;
create policy ask_answers_public_read on public.ask_answers for select to anon, authenticated using (true);
drop policy if exists ask_comments_public_read on public.ask_comments;
create policy ask_comments_public_read on public.ask_comments for select to anon, authenticated using (status = 'visible');
drop policy if exists ask_stats_public_read on public.ask_stats;
create policy ask_stats_public_read on public.ask_stats for select to anon, authenticated using (true);
-- ask_profiles·ask_feedback·ask_reports 는 공개 읽기 정책을 만들지 않는다(서버만 읽음)

-- 칸 단위 권한: 공개 열쇠로는 user_id 칸을 못 읽게 한다
revoke select on public.ask_posts from anon, authenticated;
grant select (id, slug, nickname, kind, title, body, pyeong, type_code, region, trades, photos,
              from_slug, status, view_count, comment_count, answered_at, created_at, updated_at)
  on public.ask_posts to anon, authenticated;
revoke select on public.ask_comments from anon, authenticated;
grant select (id, post_id, nickname, is_ai, body, status, created_at)
  on public.ask_comments to anon, authenticated;
grant select on public.ask_answers, public.ask_stats to anon, authenticated;
-- 쓰기 권한은 공개 열쇠에서 전부 회수(서비스 역할은 RLS·권한을 우회하므로 영향 없음)
revoke insert, update, delete on public.ask_profiles, public.ask_posts, public.ask_answers,
  public.ask_comments, public.ask_feedback, public.ask_reports, public.ask_stats from anon, authenticated;
revoke select on public.ask_profiles, public.ask_feedback, public.ask_reports from anon, authenticated;

-- ------------------------------------------------------------
-- 10. 사진 보관함(스토리지 버킷) 두 개
--   ask-photos-raw : 회원이 올린 원본(비공개). 전화번호·동호수가 그대로라 절대 공개하지 않는다.
--   ask-photos     : 집컴이 전화번호·동호수·개인 이름을 가린 사본(공개). 화면은 이것만 보여 준다.
--   둘 다 10MB 까지, jpg·png·heic만.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ask-photos-raw', 'ask-photos-raw', false, 10485760,
        array['image/jpeg','image/png','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ask-photos', 'ask-photos', true, 10485760,
        array['image/jpeg','image/png','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- 업로드는 사이트 서버가 발급한 "서명된 업로드 주소"로만 들어오므로 storage.objects에 공개 쓰기 정책은 만들지 않는다.
-- 공개 보관함(ask-photos)은 public=true라 주소만 있으면 누구나 볼 수 있다(정책 불필요).
