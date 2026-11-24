// ─────────────────────────────────────────────────────────────
// 제작 요청 내용 고치기 + 배너 다시 그리기 (서버 전용) — 2026년 11월 24일
//
// [형아 결정(11-24 밤)]
//   광고가 게재되기 전(검토 단계)에는 광고주가 문구·스타일·로고를 고치면 배너를 다시 자동으로 그린다.
//   횟수 제한 없음(자동이라 원가 0 — 예전 "수정 2회" 규칙은 없앰). 게재가 시작되면 고칠 수 없다.
//   관리자·광고주가 손으로 올린 배너(자동 경로가 아닌 것)는 덮지 않는다.
//
// [순서]
//   1) 내 주문·제작 대행·검토 단계·배너가 비었거나 자동 배너인지 확인
//   2) 새 로고가 있으면 보관함에 올림
//   3) 제작 요청 내용 저장 + 배너 칸 비우기를 한 번에(조건: 그 사이 배너가 바뀌지 않았고 아직 검토 단계)
//      다시 그린 횟수(redraws)를 1 올려 새 판은 다른 파일 이름으로 그린다(옛 그림 캐시 방지)
//   4) 자동 제작(ensureAutoBanner) — 실패해도 저장은 그대로, 관리자 알림·[자동 제작 다시]로 이어짐
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { adminOrNull } from '@/lib/ask/server';
import { BRIEF_MAX, briefProblem, cleanBrief, imageKind } from '@/lib/partner/rules';
import { cleanStyleKey } from '@/lib/ads/bannerStyles';
import { isAutoBannerPath } from '@/lib/ads/autoBannerRules';
import { BUCKET } from './store';

type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** 로고 용량 한도(신청 때와 같음) */
const LOGO_MAX = 1024 * 1024;

/** 고칠 내용 */
export interface BriefInput {
  intro: unknown;
  headline: unknown;
  mood?: unknown;
  /** 보내지 않으면(undefined) 스타일은 그대로 */
  style?: unknown;
  /** 새 로고(없으면 그대로) */
  logo?: { bytes: Uint8Array; type: string } | null;
}

/** 고치기 + 다시 그리기. data.redrawn = 새 배너가 붙었는지 */
export async function updateBriefAndRedraw(advertiserId: number, orderId: number, input: BriefInput): Promise<Res<{ redrawn: boolean }>> {
  const intro = cleanBrief(input.intro, BRIEF_MAX.intro);
  const headline = cleanBrief(input.headline, BRIEF_MAX.headline);
  const mood = cleanBrief(input.mood, BRIEF_MAX.mood);
  const bp = briefProblem(intro, headline);
  if (bp) return { ok: false, status: 400, error: bp };
  if (input.logo && (input.logo.bytes.length > LOGO_MAX || !imageKind(input.logo.bytes))) {
    return { ok: false, status: 400, error: '로고는 1MB 이하 PNG/JPG 만 올릴 수 있어요' };
  }
  const sb = adminOrNull();
  if (!sb) return { ok: false, status: 503, error: '준비 중이에요' };
  // select('*') — PC 그림 칸이 아직 없는 DB 에서도 실패하지 않게
  const { data: o } = await sb.from('ad_orders').select('*').eq('id', orderId).eq('advertiser_id', advertiserId).maybeSingle();
  if (!o || o.design_requested !== true) return { ok: false, status: 404, error: '제작 대행 광고를 찾지 못했어요' };
  if (o.run_status !== 'review') return { ok: false, status: 409, error: '게재가 시작돼 더는 고칠 수 없어요' };
  const oldPath = (o.banner_path as string | null) ?? null;
  if (oldPath && !isAutoBannerPath(oldPath)) return { ok: false, status: 409, error: '직접 올린 배너가 있어 고칠 수 없어요' };

  // 새 로고(선택) — 신청 때와 같은 자리·이름 규칙
  const prev = o.design_brief && typeof o.design_brief === 'object' ? (o.design_brief as Record<string, unknown>) : {};
  let logoPath = (prev.logo_path as string | null | undefined) ?? null;
  if (input.logo) {
    const ext = imageKind(input.logo.bytes) === 'png' ? 'png' : 'jpg';
    const p = `partner/${advertiserId}/logo-${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(p, input.logo.bytes, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: false });
    if (up.error) return { ok: false, status: 500, error: '로고를 올리지 못했어요' };
    logoPath = p;
  }
  const brief = {
    ...prev,
    intro,
    headline,
    mood,
    style: input.style !== undefined ? cleanStyleKey(input.style) : (prev.style ?? ''),
    logo_path: logoPath,
    redraws: Math.max(0, Math.floor(Number(prev.redraws) || 0)) + 1,
  };
  // 저장 + 자동 배너 칸 비우기를 한 번에. 조건: 아직 검토 단계 + 그 사이 배너가 바뀌지 않음(관리자가 막 올린 배너를 지운다거나 하지 않게)
  const patch: Record<string, unknown> = { design_brief: brief, banner_path: null };
  const pc = (o as { banner_desktop_path?: string | null }).banner_desktop_path;
  if ('banner_desktop_path' in o && (pc == null || isAutoBannerPath(pc))) patch.banner_desktop_path = null;
  let q = sb.from('ad_orders').update(patch).eq('id', orderId).eq('advertiser_id', advertiserId).eq('run_status', 'review');
  q = oldPath ? q.eq('banner_path', oldPath) : q.is('banner_path', null);
  const { data: saved, error } = await q.select('id');
  if (error) return { ok: false, status: 500, error: '저장하지 못했어요' };
  if (!saved?.length) return { ok: false, status: 409, error: '방금 배너가 바뀌었어요. 새로 고친 뒤 다시 해 주세요' };

  // 다시 그리기(그리기 코드는 이때만 불러온다)
  const { ensureAutoBanner } = await import('@/server/banner/bannerAuto');
  const r = await ensureAutoBanner(orderId);
  return { ok: true, data: { redrawn: r.state === 'made' } };
}
