// ─────────────────────────────────────────────────────────────
// 제작 대행 주문 → 배너 자동 제작 (서버 전용) — 2026년 11월 24일
//
// [왜]
//   결제사 입점 조건이 "결제일부터 서비스 종료일까지 90일 이내"라서, 제작 기간(전에는 3영업일)이
//   광고 기간 밖으로 나가면 안 된다. 그래서 결제가 확정되는 그 처리 안에서 바로 배너를 그려 붙인다.
//
// [규칙]
//   - 제작 대행 주문(design_requested)이고 배너가 아직 없을 때만 그린다.
//     관리자·광고주가 이미 올린 배너는 절대 덮어쓰지 않는다(배너 칸이 비어 있을 때만 적는 조건부 저장).
//   - 같은 주문은 늘 같은 파일 이름(<주문번호>/auto-<규격>.png)에 덮어쓰기로 올린다.
//     웹훅이 두 번 와서 두 번 그려도 파일 하나, 주문 칸 하나로 끝난다(멱등).
//   - 게재 상태(run_status)는 건드리지 않는다 — 지금처럼 검토(review) → 관리자 승인 뒤 게재.
//   - 그리기가 실패해도 예외를 던지지 않는다(결제 처리는 그대로 성공). 주문은 배너 없는
//     "배너 제작 중"으로 남아 관리자 화면에 "자동 제작 실패"로 보이고, 관리자 텔레그램으로 한 번 알린다.
//     관리자가 [자동 제작 다시] 또는 직접 올리기로 처리한다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { adminOrNull } from '@/lib/ask/server';
import { SLOT_INFO, checkBanner, fromDbSlot } from '@/lib/ads/pricing';
import { DEFAULT_AUTO_STYLE, autoBannerPath, autoSizesOf, autoTagOf } from '@/lib/ads/autoBannerRules';
import { cleanStyleKey } from '@/lib/ads/bannerStyles';
import { after } from 'next/server';
import { hit } from '@/lib/account/rateLimit';
import { notifyAdminTelegram } from '@/server/notify/adminTelegram';
import { renderBanner } from './bannerRender';

/** 보관함 이름(관리자 업로드와 같은 곳) */
const BUCKET = 'ad-banners';

/** 공용 규칙은 src/lib/ads/autoBannerRules.ts 에 둔다(관리자 화면·미리 보기 API 도 같이 씀) */
export { DEFAULT_AUTO_STYLE, autoSizesOf, autoBannerPath, isAutoBannerPath, autoTagOf } from '@/lib/ads/autoBannerRules';

/** 결제 응답을 기다리게 하는 최대 시간(넘으면 응답을 먼저 돌려주고 그리기는 뒤에서 마저 끝냄) */
const TIME_LIMIT_MS = 8_000;

/** 결과: made=새로 그림, exists=이미 배너 있음(그대로 둠), skip=제작 대행 아님, fail=실패(사유) */
export type AutoResult = { state: 'made'; path: string } | { state: 'exists' } | { state: 'skip' } | { state: 'fail'; error: string };

/** 실제 처리(시간 제한 없이) */
async function drawFor(orderId: number): Promise<AutoResult> {
  const sb = adminOrNull();
  if (!sb) return { state: 'fail', error: '저장소 연결 없음' };
  const { data: o, error } = await sb.from('ad_orders').select('*').eq('id', orderId).maybeSingle();
  if (error || !o) return { state: 'fail', error: '주문을 찾지 못함' };
  if (o.design_requested !== true) return { state: 'skip' };
  if (o.banner_path) return { state: 'exists' };
  const kind = fromDbSlot(String(o.slot_kind), (o.process as string | null) ?? null);
  if (!SLOT_INFO[kind]?.width) return { state: 'skip' }; // 그림 없는 자리(견적서 줄)
  const brief = (o.design_brief && typeof o.design_brief === 'object' ? o.design_brief : {}) as Record<string, unknown>;

  // 상호: 신청 때 적힌 상호, 없으면 광고주 표의 이름
  let name = typeof brief.name === 'string' ? brief.name : '';
  if (!name) {
    const { data: adv } = await sb.from('advertisers').select('name').eq('id', o.advertiser_id).maybeSingle();
    name = String(adv?.name ?? '');
  }
  // 로고(선택): 보관함에서 내려받는다. 못 받으면 로고 없이 그린다
  let logo: Uint8Array | null = null;
  if (typeof brief.logo_path === 'string' && brief.logo_path) {
    const dl = await sb.storage.from(BUCKET).download(brief.logo_path);
    if (!dl.error && dl.data) logo = new Uint8Array(await dl.data.arrayBuffer());
  }
  const style = cleanStyleKey(brief.style) || DEFAULT_AUTO_STYLE;
  const sizes = autoSizesOf(kind);
  const input = {
    style,
    name,
    phone: (typeof brief.phone === 'string' && brief.phone) || (o.phone as string | null) || null,
    intro: typeof brief.intro === 'string' ? brief.intro : '',
    headline: typeof brief.headline === 'string' ? brief.headline : '',
    tag: autoTagOf(kind, (o.process as string | null) ?? null),
    logo,
  };
  const maxBytes = SLOT_INFO[kind].maxKB * 1024;

  // 휴대폰 그림(필수)
  const png = await renderBanner({ ...input, size: sizes.mobile }, maxBytes);
  const why = checkBanner(kind, png); // 관리자 올리기와 같은 규격·용량 검사를 통과해야 쓴다
  if (why) return { state: 'fail', error: `규격 검사 실패: ${why}` };
  // 다시 그린 횟수(게재 전 문구 고치기, 2026년 11월 24일) — 판마다 다른 파일 이름
  const rev = Math.max(0, Math.floor(Number(brief.redraws) || 0));
  const path = autoBannerPath(orderId, sizes.mobile, rev);
  const up = await sb.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
  if (up.error) return { state: 'fail', error: '보관함 올리기 실패' };
  // 배너 칸이 비어 있을 때만 적는다 — 그사이 관리자가 올린 배너가 있으면 그것을 지킨다
  const { data: set, error: e2 } = await sb.from('ad_orders').update({ banner_path: path }).eq('id', orderId).is('banner_path', null).select('id');
  if (e2) return { state: 'fail', error: '주문 저장 실패' };
  if (!set?.length) return { state: 'exists' };

  // PC 그림(728x90, 맨 위·맨 아래 띠만). 칸이 없는 DB 거나 실패해도 휴대폰 그림만으로 게재된다
  if (sizes.desktop) {
    try {
      const pc = await renderBanner({ ...input, size: sizes.desktop }, maxBytes);
      if (!checkBanner(kind, pc, 'desktop')) {
        const pcPath = autoBannerPath(orderId, sizes.desktop, rev);
        const up2 = await sb.storage.from(BUCKET).upload(pcPath, pc, { contentType: 'image/png', upsert: true });
        if (!up2.error) await sb.from('ad_orders').update({ banner_desktop_path: pcPath }).eq('id', orderId).is('banner_desktop_path', null);
      }
    } catch {
      // PC 그림은 선택 — 실패해도 넘어간다
    }
  }
  return { state: 'made', path };
}

/**
 * 그리기 + 실패하면 관리자에게 알림(2026년 11월 24일 검사 지적: 실패를 아무도 모름)
 *   같은 주문은 하루에 한 번만 알린다(웹훅 재시도·관리자 [자동 제작 다시] 때마다 울리지 않게, 기존 횟수 세기 표 사용).
 */
async function drawAndAlert(orderId: number): Promise<AutoResult> {
  let r: AutoResult;
  try {
    r = await drawFor(orderId);
  } catch (e) {
    r = { state: 'fail', error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
  if (r.state === 'fail') {
    console.warn(`[auto-banner] 주문 ${orderId}: ${r.error}`);
    try {
      if ((await hit(`autobanner-alert:${orderId}`, 86400)) === 1) {
        await notifyAdminTelegram(`[얼마드나] 배너 자동 제작 실패 · 주문 #${orderId}
${r.error}
/admin/ads 에서 [자동 제작 다시] 또는 직접 올리기`);
      }
    } catch {
      // 알림 실패는 넘어간다
    }
  }
  return r;
}

/**
 * 주문 하나의 배너를 자동으로 만든다(결제 확정 처리 안에서 부른다).
 *   절대 예외를 던지지 않는다.
 *   TIME_LIMIT_MS 안에 못 끝내면 결제 응답을 먼저 돌려주고, 그리기는 응답 뒤에 끝까지 마치게 한다(Next 의 after).
 *   응답 뒤에도 못 끝내면(함수가 멈추면) 주문은 '배너 제작 중'으로 남고 다음 웹훅 재시도·관리자 [자동 제작 다시]가 이어 그린다.
 *   결과 저장은 늘 "배너 칸이 비어 있을 때만"이라 뒤늦게 끝나도 해가 없다.
 */
export async function ensureAutoBanner(orderId: number): Promise<AutoResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = drawAndAlert(orderId);
  try {
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), TIME_LIMIT_MS);
    });
    const r = await Promise.race([work, timeout]);
    if (r !== 'timeout') return r;
    // 시간 초과: 응답은 먼저 돌려주고 그리기는 응답 뒤에 마저 끝낸다(요청 밖에서 불렸으면 after 가 없으니 그냥 둔다)
    try {
      after(() => work.then(() => undefined));
    } catch {
      // 시험 등 요청 밖 — 그대로 진행
    }
    console.warn(`[auto-banner] 주문 ${orderId}: 시간 초과 — 응답 뒤에 마저 그림`);
    return { state: 'fail', error: '시간 초과(응답 뒤에 마저 그림)' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
