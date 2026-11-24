'use client';
// ─────────────────────────────────────────────────────────────
// 내 광고 카드 한 장 — 상태 배지·남은 날·숫자·[30일 연장][배너 교체] (2026년 10월 31일)
//   연장: 서버 준비(prepare, mode=extend) → 포트원 결제창 → 서버 확인 → 새로고침
//   배너 교체: 파일 고르기 → /api/partner/banner(규격 검사·저장) → 검토 중으로 바뀜
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import { SLOT_INFO } from '@/lib/ads/pricing';
import { fitBanner } from '@/lib/partner/bannerFit';
import { BADGE_TEXT, EXTEND_MAX_REMAIN, EXTEND_TOO_EARLY, badgeOf, canManage, ctr, quote, regionName, remainDays, won, type BadgeKind } from '@/lib/partner/rules';
import { BRIEF_MAX } from '@/lib/partner/rules';
import { openCheckout, preparePay, type PayCfg } from '@/lib/partner/payClient';
import type { MyOrder } from '@/server/partner/store';
import StylePicker from '@/components/sponsor/StylePicker';
import { styleLabel } from '@/lib/ads/bannerStyles';
import { ghostBtn } from './_ui';

/** 배지 색(강조색은 쓰지 않고 상태 색만) */
const BADGE_CLS: Record<BadgeKind, string> = {
  design: 'bg-v1-badge-gold-bg text-brown', // 배너 제작 중(제작 대행, 2026-10-29)
  review: 'bg-v1-badge-gold-bg text-brown',
  live: 'bg-safe/10 text-safe',
  waiting: 'bg-bg text-ink-2',
  expired: 'bg-bg text-ink-2',
  stopped: 'bg-danger/10 text-danger',
  refunded: 'bg-danger/10 text-danger',
};

/**
 * 제작 요청 내용 칸(접힘) — [내용 고치기](2026-10-30)
 *   2026년 11월 24일 형아 결정: 게재 전(검토 단계)이고 배너가 비었거나 자동으로 그린 것이면 고칠 수 있고,
 *   고치면 배너를 다시 자동으로 그린다(횟수 제한 없음). 로고도 바꿀 수 있다.
 */
function BriefBox({ order: o, phone }: { order: MyOrder; phone: string }) {
  const br = o.design_brief ?? {};
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [intro, setIntro] = useState(br.intro ?? '');
  const [headline, setHeadline] = useState(br.headline ?? '');
  const [mood, setMood] = useState(br.mood ?? '');
  const [style, setStyle] = useState(br.style ?? '');
  const [logo, setLogo] = useState<File | null>(null); // 새 로고(고를 때만)
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // 게재 전 + (배너 없음 또는 자동 배너)일 때만 — 손으로 올린 배너나 게재 중 광고는 고칠 수 없다
  const canEdit = o.run_status === 'review' && (!o.has_banner || o.auto_banner);
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      // 로고까지 보내야 해서 multipart 로 보낸다(서버가 다시 그린다)
      const f = new FormData();
      f.set('intro', intro);
      f.set('headline', headline);
      f.set('mood', mood);
      f.set('style', style);
      if (logo) f.set('logo', logo);
      const r = await fetch(`/api/partner/orders/${o.id}/brief`, { method: 'PATCH', body: f });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) location.reload();
      else setErr(d.error || '저장하지 못했어요');
    } catch {
      setErr('연결이 끊겼어요');
    }
    setBusy(false);
  };
  const rows: [string, string][] = [
    ['상호', br.name || '-'],
    ['소개 문구', br.intro || '-'],
    ['강조 문구', br.headline || '-'],
    ['스타일', styleLabel(br.style)],
    ['원하는 느낌', br.mood || '-'],
    ['로고', br.logo_path ? '올림' : '없음'],
    ['전화', br.phone || phone || '-'],
  ];
  return (
    <div className="mt-3 rounded-xl border border-line">
      <button type="button" className="flex h-11 w-full items-center justify-between px-3 text-[14px] font-medium text-ink" onClick={() => setOpen(!open)} aria-expanded={open}>
        제작 요청 내용<span className="text-ink-2">{open ? '접기' : '보기'}</span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-3">
          {!edit ? (
            <>
              <dl className="space-y-1 text-[14px]">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex gap-3"><dt className="w-20 shrink-0 text-ink-2">{k}</dt><dd className="min-w-0 break-words text-ink">{v}</dd></div>
                ))}
              </dl>
              {canEdit && <button type="button" className={`${ghostBtn} mt-3 w-full`} onClick={() => setEdit(true)}>내용 고치기</button>}
            </>
          ) : (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-[13px] text-ink-2">소개 문구</span>
                <input className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink" value={intro} maxLength={BRIEF_MAX.intro} onChange={(e) => setIntro(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-[13px] text-ink-2">강조 문구</span>
                <input className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink" value={headline} maxLength={BRIEF_MAX.headline} onChange={(e) => setHeadline(e.target.value)} /></label>
              <div><span className="mb-1 block text-[13px] text-ink-2">스타일 (선택)</span><StylePicker value={style} onChange={setStyle} /></div>
              <label className="block"><span className="mb-1 block text-[13px] text-ink-2">로고 (바꿀 때만)</span>
                <input type="file" accept="image/png,image/jpeg" className="block w-full text-[14px] text-ink-2" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></label>
              <label className="block"><span className="mb-1 block text-[13px] text-ink-2">원하는 느낌 (선택)</span>
                <input className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink" value={mood} maxLength={BRIEF_MAX.mood} onChange={(e) => setMood(e.target.value)} /></label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={ghostBtn} disabled={busy} onClick={() => { setEdit(false); setErr(''); }}>취소</button>
                <button type="button" className={`${ghostBtn} !border-accent !text-accent`} disabled={busy} onClick={save}>{busy ? '다시 만드는 중' : '저장하고 다시 만들기'}</button>
              </div>
              {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdCard({ order: o, today, pay, email, name = '' }: { order: MyOrder; today: string; pay: PayCfg | null; email: string; name?: string }) {
  const b = badgeOf(o, today);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const manage = canManage(b);
  const ext = quote(o.slot_kind, 1, o.sido);
  // 연장 90일 규칙(2026년 11월 24일): 남은 날이 한도보다 많으면 연장 단추를 막고 이유 한 줄
  const tooEarly = b !== 'expired' && remainDays(o.end_date, today) > EXTEND_MAX_REMAIN;

  // 30일 연장
  const extend = async () => {
    if (!pay || busy) return;
    setBusy(true);
    setMsg('');
    const f = new FormData();
    f.set('mode', 'extend');
    f.set('orderId', String(o.id));
    const p = await preparePay(f);
    if (!p.ok) {
      setMsg(p.error);
      setBusy(false);
      return;
    }
    const r = await openCheckout(pay, p.data, email, (o as { phone?: string | null }).phone ?? undefined, name); // 이니시스 결제창 필수(전화·이름)
    if (r.kind === 'done') location.reload();
    else if (r.kind === 'fail') setMsg(r.pgMessage ? `${r.error} · ${r.pgMessage}` : r.error); // 결제사 거절 사유 그대로
    setBusy(false);
  };

  // 배너 교체
  const upload = async (picked: File) => {
    setBusy(true);
    setMsg('');
    // 자리 규격에 자동 맞춤(2026-10-30) — 크기가 달라도 가운데 잘라 채워 올린다
    const si = SLOT_INFO[o.slot_kind];
    const fit = await fitBanner(picked, { width: si.width, height: si.height }, si.maxKB);
    if (!fit.ok) {
      setMsg(fit.error);
      setBusy(false);
      return;
    }
    const file = fit.file;
    const f = new FormData();
    f.set('orderId', String(o.id));
    f.set('file', file);
    try {
      const r = await fetch('/api/partner/banner', { method: 'POST', body: f });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) location.reload();
      else setMsg(d.error || '그림을 올리지 못했어요');
    } catch {
      setMsg('연결이 끊겼어요');
    }
    setBusy(false);
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-ink">
            {SLOT_INFO[o.slot_kind].name}
            {o.process ? ` · ${o.process}` : ''}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {regionName(o.sido)} · {o.start_date.slice(5).replace('-', '.')}~{o.end_date.slice(5).replace('-', '.')}
            {b !== 'expired' && b !== 'refunded' ? ` · ${remainDays(o.end_date, today)}일 남음` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-chip px-2.5 py-1 text-[12px] font-semibold ${BADGE_CLS[b]}`}>{BADGE_TEXT[b]}</span>
      </div>

      {/* 배너 미리보기 */}
      {o.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.bannerUrl} alt="내 배너" className="mt-3 max-h-24 w-auto max-w-full rounded-lg border border-line" />
      )}

      {/* 숫자: 노출·클릭·클릭률(전체 기간) */}
      <div className="mt-3 grid grid-cols-3 rounded-xl bg-bg py-2 text-center">
        {[
          ['노출', o.impressions.toLocaleString('ko-KR')],
          ['클릭', o.clicks.toLocaleString('ko-KR')],
          ['클릭률', `${ctr(o.impressions, o.clicks)}%`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[12px] text-ink-2">{k}</p>
            <p className="text-[15px] font-semibold text-ink tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {/* 자동 제작이 실패해 아직 배너가 없을 때만 보인다 — 지킬 수 있는 말만(시간 약속 없음, 2026년 11월 24일) */}
      {b === 'design' && <p className="mt-2 text-[13px] text-ink-2">배너를 준비하고 있어요</p>}
      {o.design_requested && o.design_brief && <BriefBox order={o} phone={(o as { phone?: string | null }).phone ?? ''} />}
      {b === 'review' && o.pay_status === 'paid' && <p className="mt-2 text-[13px] text-ink-2">반려되면 카드로 자동 환불돼요</p>}
      {o.note && (b === 'stopped' || b === 'refunded') && <p className="mt-2 text-[13px] text-danger">{o.note}</p>}

      {manage && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={ghostBtn} disabled={busy || !pay || b === 'expired' || tooEarly} onClick={extend} title={pay ? `${won(ext.total)}` : '결제 준비 중'}>
            30일 연장
          </button>
          <button type="button" className={ghostBtn} disabled={busy || b === 'expired'} onClick={() => fileRef.current?.click()}>
            배너 교체
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {manage && !pay && b !== 'expired' && <p className="mt-2 text-[12px] text-ink-2">연장 결제 준비 중</p>}
      {manage && pay && tooEarly && <p className="mt-2 text-[12px] text-ink-2">{EXTEND_TOO_EARLY}</p>}
      {msg && <p className="mt-2 text-[13px] text-danger" role="alert">{msg}</p>}
    </div>
  );
}
