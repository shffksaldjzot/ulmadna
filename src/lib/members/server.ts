// ──────────────────────────────────────────────
// 회원 명부(members 표) — 서버 전용 읽기·쓰기 창구
//
// [무슨 기능인가]
//   - recordLogin   : 로그인 성공 때 한 번 — 명부에 새 줄을 만들거나 마지막 로그인 시각·횟수를 올린다
//   - markAskProfile: 물어보기 닉네임을 정했을 때 — 명부 줄에 "닉네임 있음"과 그 닉네임을 적는다
//   - withdrawMember: 회원 탈퇴 때 — 줄은 남기고 상태만 '탈퇴', 사람을 알아볼 값은 지운다
//   - getMemberStats: 관리자용 숫자(전체 회원 수·새 회원·로그인 수단별·물어보기 글 쓴 회원 수)
//
// [원칙]
//   서비스 역할 열쇠(getSupabaseAdmin)로만 접근 → 'server-only' 표식으로 브라우저 코드에서 못 부르게.
//   표가 아직 없거나(사장님 SQL 실행 전), 열쇠·비밀값이 없으면 조용히 건너뛴다(로그 한 줄만).
//   비밀값(MEMBER_HASH_SECRET)·판별값·카카오 번호는 로그에 절대 찍지 않는다.
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import 'server-only';
import { adminOrNull } from '@/lib/ask/server';
import { cleanNickname, memberKeyOf, stableIdFromSession, type LoginRecord, type MemberProvider } from './key';

/** 로그를 한 줄만(원인 문장만, 값은 안 찍음) */
function warn(where: string, err: unknown) {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  console.warn(`[members][${where}] ${msg}`);
}

/** 판별값 비밀값 — 환경변수 MEMBER_HASH_SECRET (없으면 명부 기록을 건너뜀) */
function secret(): string | null {
  const s = (process.env.MEMBER_HASH_SECRET || '').trim();
  return s.length >= 16 ? s : null;
}

// 비밀값이 없다는 경고는 서버가 뜰 때마다 한 번만
let warnedNoSecret = false;
function keyOrWarn(stableId: string | null): string | null {
  const s = secret();
  if (!s) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn('[members] MEMBER_HASH_SECRET 이 없어 회원 명부 기록을 건너뜁니다');
    }
    return null;
  }
  return memberKeyOf(stableId, s);
}

/**
 * 로그인 성공 때 명부에 기록. 회원 번호(uuid)를 돌려주고, 못 하면 null.
 * 오류는 밖으로 던지지 않는다(로그인을 막지 않기 위해).
 */
export async function recordLogin(rec: LoginRecord): Promise<string | null> {
  try {
    const key = keyOrWarn(rec.stableId);
    if (!key) return null;
    const sb = adminOrNull();
    if (!sb) return null;

    // 물어보기 닉네임(ask_profiles)이 이 세션 번호로 있나 — 있으면 그 닉네임을 쓴다
    //   아이디 회원: 세션 번호가 늘 같아서 정확히 찾는다.
    //   카카오 회원: 세션 번호가 매번 무작위라 보통 못 찾는다 → "모름(null)"으로 넘겨 기존 값 유지.
    let hasProfile: boolean | null = rec.provider === 'id' ? false : null;
    let nickname = rec.nickname;
    if (rec.sessionId) {
      const { data, error } = await sb.from('ask_profiles').select('nickname').eq('user_id', rec.sessionId).maybeSingle();
      if (!error && data) {
        hasProfile = true;
        nickname = cleanNickname((data as { nickname?: unknown }).nickname) ?? nickname;
      }
    }

    const { data, error } = await sb.rpc('members_touch', {
      p_key: key,
      p_provider: rec.provider,
      p_nickname: nickname,
      p_ask_user_id: rec.askUserId,
      p_has_profile: hasProfile,
    });
    if (error) {
      warn('recordLogin', error);
      return null;
    }
    return typeof data === 'string' ? data : null;
  } catch (e) {
    warn('recordLogin', e);
    return null;
  }
}

/**
 * 명부의 어느 줄인지 고르는 조건 만들기.
 * memberId(세션에 담긴 회원 번호)가 있으면 그것으로, 없으면 아이디 회원만 판별값으로 찾는다.
 * (카카오 회원은 세션 번호가 무작위라 memberId 가 없으면 찾을 수 없다 → null)
 */
function target(sessionId: string, memberId: string | null): { col: 'id' | 'member_key'; val: string } | null {
  if (memberId) return { col: 'id', val: memberId };
  const key = keyOrWarn(stableIdFromSession(sessionId));
  return key ? { col: 'member_key', val: key } : null;
}

/** 물어보기 닉네임을 정했을 때 명부에도 표시(실패해도 조용히) */
export async function markAskProfile(sessionId: string, memberId: string | null, nickname: string): Promise<void> {
  try {
    const t = target(sessionId, memberId);
    const sb = adminOrNull();
    if (!t || !sb) return;
    const { error } = await sb
      .from('members')
      .update({ has_ask_profile: true, nickname: cleanNickname(nickname) })
      .eq(t.col, t.val)
      .neq('status', 'withdrawn');
    if (error) warn('markAskProfile', error);
  } catch (e) {
    warn('markAskProfile', e);
  }
}

/**
 * 회원 탈퇴 — 줄은 남기고(회원 수 통계용) 상태만 '탈퇴'로, 사람을 알아볼 값은 지운다.
 * 판별값을 지우므로 같은 사람이 다시 로그인하면 새 회원 줄이 생긴다.
 * 실패해도 탈퇴 자체는 진행되게 오류를 던지지 않는다.
 */
export async function withdrawMember(sessionId: string, memberId: string | null): Promise<void> {
  try {
    const t = target(sessionId, memberId);
    const sb = adminOrNull();
    if (!t || !sb) return;
    const { error } = await sb
      .from('members')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
        member_key: null,
        nickname: null,
        real_name: null, // 탈퇴하면 카카오 이름도 지움
        ask_user_id: null,
        has_ask_profile: false,
      })
      .eq(t.col, t.val);
    if (error) warn('withdrawMember', error);
  } catch (e) {
    warn('withdrawMember', e);
  }
}

/** 관리자용 회원 숫자 */
export interface MemberStats {
  /** 전체 회원 수(탈퇴 제외 = 정상 + 차단) */
  total: number;
  active: number;
  blocked: number;
  withdrawn: number;
  /** 최근 7일·30일 새 회원(첫 로그인 기준, 그 뒤 탈퇴한 사람도 포함 — "그때 들어온 사람 수") */
  new7: number;
  new30: number;
  /** 로그인 수단별(탈퇴 제외) */
  byProvider: Record<MemberProvider, number>;
  /** 물어보기 글을 한 번이라도 쓴 회원 수(ask_posts 의 서로 다른 작성자, 예시 글 seed: 제외) */
  askWriters: number;
}

/**
 * 관리자 화면에서 볼 회원 숫자 한 묶음. 표가 없거나 연결이 안 되면 null.
 * @param now 기준 시각(시험용으로 바꿀 수 있게)
 */
export async function getMemberStats(now: Date = new Date()): Promise<MemberStats | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  try {
    const day = 24 * 3600 * 1000;
    const since7 = new Date(now.getTime() - 7 * day).toISOString();
    const since30 = new Date(now.getTime() - 30 * day).toISOString();
    // 줄을 가져오지 않고 개수만 세는 질의(head: true)
    const count = () => sb.from('members').select('id', { count: 'exact', head: true });

    const [active, blocked, withdrawn, new7, new30, kakao, id] = await Promise.all([
      count().eq('status', 'active'),
      count().eq('status', 'blocked'),
      count().eq('status', 'withdrawn'),
      count().gte('first_login_at', since7),
      count().gte('first_login_at', since30),
      count().eq('provider', 'kakao').neq('status', 'withdrawn'),
      count().eq('provider', 'id').neq('status', 'withdrawn'),
    ]);
    const firstErr = [active, blocked, withdrawn, new7, new30, kakao, id].find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    return {
      total: (active.count ?? 0) + (blocked.count ?? 0),
      active: active.count ?? 0,
      blocked: blocked.count ?? 0,
      withdrawn: withdrawn.count ?? 0,
      new7: new7.count ?? 0,
      new30: new30.count ?? 0,
      byProvider: { kakao: kakao.count ?? 0, id: id.count ?? 0 },
      askWriters: await countAskWriters(),
    };
  } catch (e) {
    warn('getMemberStats', e);
    return null;
  }
}

/** 물어보기 글을 쓴 서로 다른 작성자 수(seed: 예시 글 제외). 1000줄씩 나눠 읽는다 */
async function countAskWriters(): Promise<number> {
  const sb = adminOrNull();
  if (!sb) return 0;
  const writers = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('ask_posts')
      .select('user_id')
      .not('user_id', 'like', 'seed:%')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (data ?? []) as { user_id: string }[]) writers.add(r.user_id);
    if (!data || data.length < PAGE) break;
  }
  return writers.size;
}

/**
 * 카카오 회원이 관리자 화면에서 "차단"됐는지 확인(2026-10-28 추가).
 * - 로그인 순간(auth.ts 의 signIn 콜백)에 불러 true 면 로그인을 막는다.
 * - 열쇠·DB 오류가 나면 false(막지 않음) — 차단 확인 실패로 정상 회원이 못 들어오는 일을 막기 위해.
 */
export async function isKakaoBlocked(kakaoId: string | null | undefined): Promise<boolean> {
  try {
    const key = memberKeyOf(kakaoId ?? null, process.env.MEMBER_HASH_SECRET ?? null); // 카카오 번호 → 명부 판별값
    const sb = adminOrNull();
    if (!key || !sb) return false;
    const { data } = await sb.from('members').select('status').eq('member_key', key).maybeSingle();
    return data?.status === 'blocked';
  } catch {
    return false;
  }
}
