// ─────────────────────────────────────────────────────────────
// 제작 대행 배너 미리 보기 — POST /api/partner/banner-preview (2026년 11월 24일)
//   multipart { kind, process?, style?, intro, headline, phone?, logo? } → 배너 PNG
//   결제하면 실제로 만들어질 배너와 같은 그리기 코드(bannerRender.ts)·같은 규칙(꼬리표·기본 스타일)으로 그린다.
//   로그인한 광고주만, 한 광고주당 1시간 120장까지(남용 방지). 그린 그림은 저장하지 않는다.
//   그릴 수 없어 빠진 글자는 머리글 X-Banner-Dropped 로 알려 준다(화면이 한 줄로 보여 줌).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { PARTNER_SLOTS, BRIEF_MAX, cleanBrief, cleanPhone, imageKind } from '@/lib/partner/rules';
import { AD_PROCESS_GROUPS, SLOT_INFO, type SlotKind } from '@/lib/ads/pricing';
import { cleanStyleKey } from '@/lib/ads/bannerStyles';
import { hit } from '@/lib/account/rateLimit';
import { renderBanner } from '@/server/banner/bannerRender';
import { cleanBannerTextReport } from '@/server/banner/bannerText';
import { DEFAULT_AUTO_STYLE, autoSizesOf, autoTagOf } from '@/lib/ads/autoBannerRules';
import { fail, partnerOr401 } from '../_util';

export const dynamic = 'force-dynamic';
// 배너 자동 제작(그리기)이 이 처리 안에서 돌 수 있어 최대 시간을 정해 둔다(2026년 11월 24일, 프로젝트 기본값에 기대지 않음).
//   그리기는 보통 1초 안. 8초를 넘기면 응답을 먼저 돌려주고 after 로 마저 그린다(src/server/banner/bannerAuto.ts).
export const maxDuration = 60;
export const runtime = 'nodejs';

/** 한 광고주가 1시간에 그릴 수 있는 미리 보기 수 */
const PREVIEW_PER_HOUR = 120; // 2026년 11월 24일 60 → 120: 글을 여러 번 고치는 광고주가 금방 닿아서(검사 L5)

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  // 남용 방지: 광고주별 1시간 한도(여러 서버가 같은 숫자를 보도록 rate_limits 표에 센다)
  const n = await hit(`banner-preview:${me.id}`, 3600);
  if (n > PREVIEW_PER_HOUR) return fail(429, '잠시 뒤에 다시 봐 주세요');
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, '보낸 내용을 읽지 못했어요');
  const kind = form.get('kind') as SlotKind;
  if (!PARTNER_SLOTS.includes(kind) || !SLOT_INFO[kind].width) return fail(400, '자리를 골라 주세요');
  const process = kind === 'AD-P' && typeof form.get('process') === 'string' && AD_PROCESS_GROUPS.includes(String(form.get('process'))) ? String(form.get('process')) : null;
  const logoFile = form.get('logo');
  let logo: Uint8Array | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > 1024 * 1024) return fail(400, '로고는 1MB 이하만 쓸 수 있어요');
    logo = new Uint8Array(await logoFile.arrayBuffer());
    if (!imageKind(logo)) return fail(400, '로고는 PNG/JPG 만 쓸 수 있어요');
  }
  // 그릴 수 없어 빠지는 글자(한자·이모지 등) — 미리 보기 아래 한 줄로 광고주에게 알린다(2026년 11월 24일)
  const dropped = [...new Set([me.name, form.get('intro'), form.get('headline')].flatMap((v) => cleanBannerTextReport(v, 200).dropped))].slice(0, 10);
  try {
    const png = await renderBanner({
      style: cleanStyleKey(form.get('style')) || DEFAULT_AUTO_STYLE,
      size: autoSizesOf(kind).mobile,
      name: me.name,
      phone: cleanPhone(form.get('phone')) || null,
      intro: cleanBrief(form.get('intro'), BRIEF_MAX.intro),
      headline: cleanBrief(form.get('headline'), BRIEF_MAX.headline),
      tag: autoTagOf(kind, process),
      logo,
    }, SLOT_INFO[kind].maxKB * 1024);
    return new NextResponse(Buffer.from(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Banner-Dropped': encodeURIComponent(dropped.join(' ')) },
    });
  } catch {
    return fail(500, '미리 보기를 만들지 못했어요');
  }
}
