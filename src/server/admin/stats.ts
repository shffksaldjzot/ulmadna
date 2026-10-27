// ──────────────────────────────────────────────
// 관리자 상세 화면(계산기·글 조회수·물어보기·회원)용 읽기 모음 — 2026-10-28
//
// [무슨 기능인가]
//   Supabase 의 일별 집계 표(calc_runs_daily·page_views_daily)와 회원·물어보기 표를
//   서비스 롤로 읽어, 화면이 그대로 그릴 수 있는 묶음으로 돌려준다. 서버에서만 호출한다.
//   - 합산·정렬·빈 날짜 채우기는 format.ts 의 순수 함수로 따로 빼서 시험할 수 있게 했다.
//   - 표가 없거나 연결이 안 돼도 예외를 던지지 않는다 — 실패하면 null(화면은 "읽지 못함" 표시).
//   - 새 SQL 없음. 이미 있는 표만 읽는다.
// ──────────────────────────────────────────────
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminOrNull } from '@/lib/ask/server';
import { kstDay, readAll } from '@/server/metrics/adminDash';
import { fillDays, groupSum, type Counted } from './format';

const num = (v: unknown) => Number(v) || 0;

// ── 계산기 통계 ─────────────────────────────
export interface CalcStats {
  days: number;
  total: number;
  /** 같은 기간 문의 단추 클릭 수(전화+카톡) */
  contacts: number;
  byProcess: Counted[];
  byMode: Counted[];
  byBucket: Counted[];
  byRegion: Counted[];
  bySrc: Counted[];
  /** 날짜별 실행 수(빈 날은 0 으로 채움, 오래된 날 → 최근 순) */
  byDay: { day: string; n: number }[];
}

/** 평형대 버킷 정렬용 번호('na' 는 맨 뒤) */
function bucketOrder(key: string): number {
  const m = /^(\d+)/.exec(key);
  return m ? Number(m[1]) : 9999;
}

/** 최근 N일(오늘 포함) 계산기 실행 통계. 실패하면 null */
export async function getCalcStats(days: number, now: Date = new Date(), sbIn?: SupabaseClient | null): Promise<CalcStats | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    const today = kstDay(now);
    const from = kstDay(now, days - 1);
    const [rows, clicks] = await Promise.all([
      readAll<{ day: string; process: string; mode: string; pyeong_bucket: string; region: string; src: string; runs: number }>((a, b) =>
        sb.from('calc_runs_daily').select('day,process,mode,pyeong_bucket,region,src,runs').gte('day', from).lte('day', today).range(a, b)),
      readAll<{ runs: number }>((a, b) =>
        sb.from('contact_clicks_daily').select('runs').gte('day', from).lte('day', today).range(a, b)),
    ]);
    const n = (r: { runs: number }) => num(r.runs);
    return {
      days,
      total: rows.reduce((s, r) => s + n(r), 0),
      contacts: clicks.reduce((s, r) => s + n(r), 0),
      byProcess: groupSum(rows, (r) => r.process, n),
      byMode: groupSum(rows, (r) => r.mode, n),
      byBucket: groupSum(rows, (r) => r.pyeong_bucket, n).sort((a, b) => bucketOrder(a.key) - bucketOrder(b.key)),
      byRegion: groupSum(rows, (r) => r.region, n),
      bySrc: groupSum(rows, (r) => r.src, n),
      byDay: fillDays(from, today, groupSum(rows, (r) => r.day, n)),
    };
  } catch (e) {
    console.warn('[admin][calc]', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── 글 조회수 ─────────────────────────────
export interface PostViewRow {
  slug: string;
  views: number;
  /** 직전 같은 길이 기간의 조회수 */
  prev: number;
}
export interface PostViewStats {
  days: number;
  total: number;
  prevTotal: number;
  /** 글별 조회수(계산기 결과 화면 calc/... 은 제외), 많은 순 */
  posts: PostViewRow[];
  /** 계산기 결과 화면 조회수 합 */
  calcViews: number;
  bySrc: Counted[];
  byDay: { day: string; n: number }[];
}

/** 최근 N일 글 조회수 순위 + 직전 N일 비교. 실패하면 null */
export async function getPostViewStats(days: number, now: Date = new Date(), sbIn?: SupabaseClient | null): Promise<PostViewStats | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    const today = kstDay(now);
    const from = kstDay(now, days - 1);
    const prevFrom = kstDay(now, days * 2 - 1);
    const rows = await readAll<{ day: string; slug: string; src: string; views: number }>((a, b) =>
      sb.from('page_views_daily').select('day,slug,src,views').gte('day', prevFrom).lte('day', today).range(a, b));
    const cur = rows.filter((r) => r.day >= from);
    const prev = rows.filter((r) => r.day < from);
    const isPost = (r: { slug: string }) => !r.slug.startsWith('calc/');
    const v = (r: { views: number }) => num(r.views);
    const prevMap = new Map(groupSum(prev.filter(isPost), (r) => r.slug, v).map((g) => [g.key, g.n]));
    const curPosts = cur.filter(isPost);
    return {
      days,
      total: curPosts.reduce((s, r) => s + v(r), 0),
      prevTotal: prev.filter(isPost).reduce((s, r) => s + v(r), 0),
      posts: groupSum(curPosts, (r) => r.slug, v).map((g) => ({ slug: g.key, views: g.n, prev: prevMap.get(g.key) ?? 0 })),
      calcViews: cur.filter((r) => !isPost(r)).reduce((s, r) => s + v(r), 0),
      bySrc: groupSum(curPosts, (r) => r.src, v),
      byDay: fillDays(from, today, groupSum(curPosts, (r) => r.day, v)),
    };
  } catch (e) {
    console.warn('[admin][posts]', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── 물어보기 글 목록 ─────────────────────────
export interface AskAdminRow {
  id: number;
  slug: string;
  title: string;
  nickname: string;
  status: 'queued' | 'answered' | 'hidden';
  created_at: string;
  views: number;
  comments: number;
  answered: boolean;
  /** 글쓴이가 답변을 읽었나 */
  read: boolean;
  /** true=도움됐어요, false=아쉬워요, null=아직 */
  helpful: boolean | null;
}

/** 실제 글(예시 seed 제외) 최근 200건. 숨김 글도 포함(되돌릴 수 있게). 실패하면 null */
export async function listAskForAdmin(sbIn?: SupabaseClient | null): Promise<AskAdminRow[] | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('ask_posts')
      .select('id,slug,title,nickname,status,view_count,comment_count,created_at')
      .not('user_id', 'like', 'seed:%')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const posts = (data ?? []) as { id: number; slug: string; title: string; nickname: string; status: AskAdminRow['status']; view_count: number; comment_count: number; created_at: string }[];
    const ids = posts.map((p) => p.id);
    // 답변 칸(읽음·도움됨)이 아직 없는 DB 도 있어서, 실패하면 칸 없이 한 번 더 읽는다
    let answers: { post_id: number; version?: number; author_read_at?: string | null; helpful?: boolean | null }[] = [];
    if (ids.length) {
      const full = await sb.from('ask_answers').select('post_id,version,author_read_at,helpful').in('post_id', ids);
      if (full.error) {
        const basic = await sb.from('ask_answers').select('post_id,version').in('post_id', ids);
        if (basic.error) throw basic.error;
        answers = (basic.data ?? []) as typeof answers;
      } else {
        answers = (full.data ?? []) as typeof answers;
      }
    }
    // 글마다 가장 큰 version 의 답변 기준
    const latest = new Map<number, (typeof answers)[number]>();
    for (const a of answers) {
      const cur = latest.get(Number(a.post_id));
      if (!cur || num(a.version) > num(cur.version)) latest.set(Number(a.post_id), a);
    }
    return posts.map((p) => {
      const a = latest.get(Number(p.id));
      return {
        id: Number(p.id),
        slug: p.slug,
        title: p.title,
        nickname: p.nickname,
        status: p.status,
        created_at: p.created_at,
        views: num(p.view_count),
        comments: num(p.comment_count),
        answered: !!a,
        read: !!a?.author_read_at,
        helpful: a?.helpful === true ? true : a?.helpful === false ? false : null,
      };
    });
  } catch (e) {
    console.warn('[admin][ask-list]', e instanceof Error ? e.message : e);
    return null;
  }
}

/** 글 숨김/표시. 표시로 되돌릴 땐 답변이 있으면 answered, 없으면 queued. 성공 여부를 돌려줌 */
export async function setAskHidden(postId: number, hidden: boolean, sbIn?: SupabaseClient | null): Promise<boolean> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb || !Number.isInteger(postId) || postId <= 0) return false;
  try {
    let status: 'hidden' | 'answered' | 'queued' = 'hidden';
    if (!hidden) {
      const { data, error } = await sb.from('ask_answers').select('id').eq('post_id', postId).limit(1);
      if (error) throw error;
      status = data && data.length > 0 ? 'answered' : 'queued';
    }
    const { error } = await sb.from('ask_posts').update({ status }).eq('id', postId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[admin][ask-hide]', e instanceof Error ? e.message : e);
    return false;
  }
}

// ── 회원 목록 ─────────────────────────────
export interface MemberAdminRow {
  id: string;
  provider: 'kakao' | 'id';
  nickname: string | null;
  first_login_at: string;
  last_login_at: string;
  login_count: number;
  status: 'active' | 'blocked' | 'withdrawn';
  has_ask_profile: boolean;
}

/** 회원 최근 로그인 순 300명(탈퇴 포함 — 표에서 구분). 실패하면 null */
export async function listMembersForAdmin(sbIn?: SupabaseClient | null): Promise<MemberAdminRow[] | null> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('members')
      .select('id,provider,nickname,first_login_at,last_login_at,login_count,status,has_ask_profile')
      .order('last_login_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data ?? []) as MemberAdminRow[];
  } catch (e) {
    console.warn('[admin][members]', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 회원 차단/해제. 탈퇴 회원은 건드리지 않는다.
 * 아이디 회원이면 로그인 표(ask_users)의 상태도 같이 바꾼다(그쪽이 실제 로그인을 막는다).
 */
export async function setMemberBlocked(memberId: string, blocked: boolean, sbIn?: SupabaseClient | null): Promise<boolean> {
  const sb = sbIn === undefined ? adminOrNull() : sbIn;
  if (!sb || !/^[0-9a-f-]{36}$/i.test(memberId)) return false;
  try {
    const status = blocked ? 'blocked' : 'active';
    const { data, error } = await sb
      .from('members')
      .update({ status })
      .eq('id', memberId)
      .neq('status', 'withdrawn')
      .select('ask_user_id');
    if (error) throw error;
    const row = (data ?? [])[0] as { ask_user_id: string | null } | undefined;
    if (!row) return false;
    if (row.ask_user_id) {
      const r = await sb.from('ask_users').update({ status }).eq('id', row.ask_user_id);
      if (r.error) throw r.error;
    }
    return true;
  } catch (e) {
    console.warn('[admin][member-block]', e instanceof Error ? e.message : e);
    return false;
  }
}
