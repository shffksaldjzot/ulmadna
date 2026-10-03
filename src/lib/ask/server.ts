// ──────────────────────────────────────────────
// 물어보기 게시판 — 서버 전용 자료 읽기 창구
//
// [무슨 기능인가]
//   목록·상세·사이트맵·API가 Supabase에서 질문·답변·댓글·숫자를 읽어 올 때
//   전부 이 파일의 함수를 쓴다. 서비스 역할 열쇠(getSupabaseAdmin)를 쓰므로
//   'server-only' 표식으로 브라우저 코드에서 불러오면 빌드가 멈추게 막았다.
//
// [표가 아직 없을 때]
//   사장님이 SQL을 실행하기 전에는 표가 없어 Supabase가 오류를 돌려준다.
//   열쇠(환경변수)가 없는 로컬에서도 마찬가지. 그때 화면이 500으로 터지지 않게
//   모든 읽기 함수는 오류를 삼키고 "빈 목록 / null"을 돌려준다(콘솔에 한 줄만 남김).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { LIMITS, type AskBasis, type AskKind, type AskListItem, type AskPhoto, type AskStats } from './constants';

/** 서비스 역할 클라이언트를 안전하게 — 환경변수가 없으면 null */
export function adminOrNull(): SupabaseClient | null {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}

/** 오류를 한 줄만 남기고 넘어간다(표 없음·연결 실패 등) */
function warn(where: string, err: unknown) {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  console.warn(`[ask][${where}] ${msg}`);
}

/** 질문 상세에 쓰는 전체 값 */
export interface AskPost {
  id: number;
  slug: string;
  user_id: string;
  nickname: string;
  kind: AskKind;
  title: string;
  body: string;
  pyeong: number | null;
  type_code: string | null;
  region: string | null;
  trades: string[];
  photos: AskPhoto[];
  from_slug: string | null;
  status: 'queued' | 'answered' | 'hidden';
  view_count: number;
  comment_count: number;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AskAnswer {
  id: number;
  post_id: number;
  version: number;
  body_md: string;
  summary: string;
  basis: AskBasis;
  model: string | null;
  created_at: string;
}

export interface AskComment {
  id: number;
  nickname: string;
  is_ai: boolean;
  body: string;
  created_at: string;
}

// 목록 카드에 필요한 칸만 고른다(본문·user_id 제외 — 가볍게, 그리고 회원 번호가 새지 않게)
const LIST_COLS = 'id,slug,nickname,kind,title,trades,status,comment_count,view_count,created_at,photos';

/** DB 한 줄 → 목록 카드 값 (답변 요약은 따로 붙인다) */
function toListItem(r: Record<string, unknown>, summary: string | null): AskListItem {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    nickname: String(r.nickname ?? ''),
    kind: (r.kind as AskKind) ?? 'cost',
    title: String(r.title ?? ''),
    trades: Array.isArray(r.trades) ? (r.trades as string[]) : [],
    status: (r.status as AskListItem['status']) ?? 'queued',
    comment_count: Number(r.comment_count ?? 0),
    view_count: Number(r.view_count ?? 0),
    created_at: String(r.created_at ?? ''),
    photoCount: Array.isArray(r.photos) ? (r.photos as unknown[]).length : 0,
    summary,
  };
}

/** 여러 질문의 "가장 최근 답변 요약"을 한 번에 가져와 id → 요약 표로 */
async function summariesFor(sb: SupabaseClient, ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const { data, error } = await sb
    .from('ask_answers')
    .select('post_id,version,summary')
    .in('post_id', ids)
    .order('version', { ascending: false });
  if (error) {
    warn('summaries', error);
    return map;
  }
  for (const a of data ?? []) {
    // version 큰 것부터 오므로 처음 본 것만 담는다
    if (!map.has(a.post_id)) map.set(a.post_id, a.summary ?? '');
  }
  return map;
}

export interface ListQuery {
  cursor?: number | null; // 이 번호보다 작은(오래된) 질문부터
  kind?: AskKind | null;
  trade?: string | null;
  userId?: string | null; // 내 질문만
  limit?: number;
}

/**
 * 질문 목록(최신순). 숨김 글은 뺀다(내 질문 보기일 땐 내 글은 상태와 무관하게 보인다).
 * 돌려주는 값: items + 다음 쪽 커서(더 없으면 null)
 */
export async function listPosts(q: ListQuery = {}): Promise<{ items: AskListItem[]; next: number | null }> {
  const sb = adminOrNull();
  if (!sb) return { items: [], next: null };
  const limit = Math.min(50, q.limit ?? LIMITS.pageSize);
  try {
    let query = sb.from('ask_posts').select(LIST_COLS).order('id', { ascending: false }).limit(limit + 1);
    if (q.userId) query = query.eq('user_id', q.userId);
    else query = query.neq('status', 'hidden');
    if (q.cursor) query = query.lt('id', q.cursor);
    if (q.kind) query = query.eq('kind', q.kind);
    if (q.trade) query = query.contains('trades', [q.trade]);
    const { data, error } = await query;
    if (error) {
      warn('list', error);
      return { items: [], next: null };
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    const page = rows.slice(0, limit);
    const sums = await summariesFor(sb, page.map((r) => Number(r.id)));
    const items = page.map((r) => toListItem(r, sums.get(Number(r.id)) ?? null));
    const next = rows.length > limit ? items[items.length - 1]?.id ?? null : null;
    return { items, next };
  } catch (e) {
    warn('list', e);
    return { items: [], next: null };
  }
}

/** 전체 질문 수(숨김 제외) — "더 보기 6 / 128" 표기용 */
export async function countPosts(): Promise<number> {
  const sb = adminOrNull();
  if (!sb) return 0;
  try {
    const { count, error } = await sb.from('ask_posts').select('id', { count: 'exact', head: true }).neq('status', 'hidden');
    if (error) {
      warn('count', error);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    warn('count', e);
    return 0;
  }
}

/** 많이 본 질문(답변 달린 것 중 조회수 순) */
export async function popularPosts(limit = 5): Promise<AskListItem[]> {
  const sb = adminOrNull();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('ask_posts')
      .select(LIST_COLS)
      .eq('status', 'answered')
      .order('view_count', { ascending: false })
      .limit(limit);
    if (error) {
      warn('popular', error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map((r) => toListItem(r, null));
  } catch (e) {
    warn('popular', e);
    return [];
  }
}

/** 질문 하나(번호로) — 없거나 표가 없으면 null */
export async function getPostById(id: number): Promise<AskPost | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('ask_posts').select('*').eq('id', id).maybeSingle();
    if (error) {
      warn('post', error);
      return null;
    }
    if (!data) return null;
    return {
      ...(data as AskPost),
      trades: Array.isArray(data.trades) ? data.trades : [],
      photos: Array.isArray(data.photos) ? (data.photos as AskPhoto[]) : [],
    };
  } catch (e) {
    warn('post', e);
    return null;
  }
}

/** 질문의 가장 최근 답변 */
export async function getLatestAnswer(postId: number): Promise<AskAnswer | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('ask_answers')
      .select('*')
      .eq('post_id', postId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      warn('answer', error);
      return null;
    }
    if (!data) return null;
    return { ...(data as AskAnswer), basis: (data.basis ?? {}) as AskBasis };
  } catch (e) {
    warn('answer', e);
    return null;
  }
}

/** 답변의 "도움 됐어요" 수 */
export async function helpfulCount(answerId: number): Promise<number> {
  const sb = adminOrNull();
  if (!sb) return 0;
  try {
    const { count, error } = await sb
      .from('ask_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('answer_id', answerId)
      .eq('kind', 'helpful');
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** 질문의 댓글(보이는 것만, 오래된 순) */
export async function getComments(postId: number): Promise<AskComment[]> {
  const sb = adminOrNull();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('ask_comments')
      .select('id,nickname,is_ai,body,created_at')
      .eq('post_id', postId)
      .eq('status', 'visible')
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) {
      warn('comments', error);
      return [];
    }
    return (data ?? []) as AskComment[];
  } catch (e) {
    warn('comments', e);
    return [];
  }
}

/**
 * 비슷한 질문 — 공정이 겹치는 답변 완료 질문을 최신순으로, 모자라면 최근 답변 질문으로 채운다
 */
export async function similarPosts(post: Pick<AskPost, 'id' | 'trades'>, limit = 5): Promise<AskListItem[]> {
  const sb = adminOrNull();
  if (!sb) return [];
  try {
    const out: Record<string, unknown>[] = [];
    if (post.trades.length) {
      const { data } = await sb
        .from('ask_posts')
        .select(LIST_COLS)
        .eq('status', 'answered')
        .neq('id', post.id)
        .overlaps('trades', post.trades)
        .order('id', { ascending: false })
        .limit(limit);
      out.push(...((data ?? []) as Record<string, unknown>[]));
    }
    if (out.length < limit) {
      const { data } = await sb
        .from('ask_posts')
        .select(LIST_COLS)
        .eq('status', 'answered')
        .neq('id', post.id)
        .order('id', { ascending: false })
        .limit(limit * 2);
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        if (out.length >= limit) break;
        if (!out.some((o) => o.id === r.id)) out.push(r);
      }
    }
    return out.map((r) => toListItem(r, null));
  } catch (e) {
    warn('similar', e);
    return [];
  }
}

/** 블로그 글에서 나온 질문(답변 완료) — 블로그 글 끝 카드용 */
export async function postsFromBlog(fromSlug: string, limit = 2): Promise<AskListItem[]> {
  const sb = adminOrNull();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('ask_posts')
      .select(LIST_COLS)
      .eq('from_slug', fromSlug)
      .eq('status', 'answered')
      .order('id', { ascending: false })
      .limit(limit);
    if (error) {
      warn('fromBlog', error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map((r) => toListItem(r, null));
  } catch (e) {
    warn('fromBlog', e);
    return [];
  }
}

/** 사이트맵용 — 답변 완료 질문 전부(주소·갱신일) */
export async function answeredForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const sb = adminOrNull();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('ask_posts')
      .select('slug,updated_at')
      .eq('status', 'answered')
      .order('id', { ascending: false })
      .limit(5000);
    if (error) {
      warn('sitemap', error);
      return [];
    }
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch (e) {
    warn('sitemap', e);
    return [];
  }
}

/**
 * "오늘 기준 빅데이터 견적서" 숫자. 표가 없거나 값이 없으면 null(화면에서 상자를 숨긴다).
 * 표시 수 = display가 있으면 그것, 없으면 real + 1,000 (사장님 확정 규칙)
 */
export async function getStats(): Promise<AskStats | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('ask_stats').select('data,updated_at').eq('key', 'global').maybeSingle();
    if (error || !data) return null;
    const d = (data.data ?? {}) as Record<string, unknown>;
    const real = typeof d.real === 'number' ? d.real : null;
    const display = typeof d.display === 'number' ? d.display : real != null ? real + 1000 : null;
    if (display == null) return null;
    return {
      display,
      delta: typeof d.delta === 'number' ? d.delta : null,
      date: typeof d.date === 'string' ? d.date : String(data.updated_at ?? '').slice(0, 10) || null,
    };
  } catch {
    return null;
  }
}

/** 공개 보관함(가린 사본)의 사진 주소 */
export function maskedPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/ask-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** 닉네임 읽기 — 없으면 null */
export async function getNickname(userId: string): Promise<string | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  try {
    const { data } = await sb.from('ask_profiles').select('nickname').eq('user_id', userId).maybeSingle();
    return data?.nickname ?? null;
  } catch {
    return null;
  }
}
