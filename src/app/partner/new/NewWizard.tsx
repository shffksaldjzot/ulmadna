'use client';
// ─────────────────────────────────────────────────────────────
// 새 광고 신청 단계 화면 — 한 화면에 한 가지씩 (2026년 10월 31일)
//   1 자리 고르기(공정 스폰서면 공정도) → 2 지역·기간 → 3 배너·연결 주소 → 4 금액 확인·카드 결제
//   3단계에서 "배너 직접 올리기 / 제작 대행 맡기기"를 고른다(2026-10-29).
//   제작 대행이면 그림 대신 업체 소개 한 줄·강조 문구·로고(선택)를 받고 제작비가 더해진다(첫 회 무료).
//   자리·가격·규격은 광고 정본(SLOT_INFO)에서 읽는다. 금액은 화면에 보여 주기만 하고
//   실제 결제 금액은 서버가 다시 계산한다.
//   배너는 고르자마자 같은 규격 검사(checkBanner)로 바로 알려 준다.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { AD_PROCESS_GROUPS, DESIGN_FEE, SLOT_INFO, checkBanner, isHttpsUrl, type SlotKind } from '@/lib/ads/pricing';
import { BRIEF_MAX, PARTNER_REGIONS, PARTNER_SLOTS, PARTNER_UNITS, briefProblem, cleanBrief, imageKind, quoteNew, regionName, won } from '@/lib/partner/rules';
import { openCheckout, preparePay, type PayCfg } from '@/lib/partner/payClient';
import { inputCls, primaryBtn } from '../_ui';

/** 자리별 한 줄 설명(어디에 보이는지) */
const WHERE: Record<string, string> = {
  'AD-H': '모든 화면 맨 위, 가장 먼저 보임',
  'AD-R': '견적 숫자 바로 옆 네모',
  'AD-P': '창호·욕실 등 내 공정 자리 3곳',
  'AD-T': '전체 견적 본 사람에게 4곳 + 견적서',
  'AD-F': '모든 화면 맨 아래',
};

const STEPS = ['자리', '지역·기간', '배너', '결제'];

/** 고르기 칸(누르는 카드) 모양 */
const pickCls = (on: boolean) =>
  `w-full min-h-11 rounded-xl border px-4 py-3 text-left ${on ? 'border-accent bg-accent/5' : 'border-line bg-surface'}`;

export default function NewWizard({
  pay, region, email, name = '', designFree = false,
}: {
  pay: PayCfg | null; region: string; email: string; name?: string;
  /** 제작 대행 첫 회 무료인지(서버가 판정해 넘김 — 결제 금액은 서버가 다시 계산) */
  designFree?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<SlotKind | null>(null);
  const [process, setProcess] = useState('');
  const [sido, setSido] = useState(region);
  const [units, setUnits] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [clickUrl, setClickUrl] = useState('https://');
  const [phone, setPhone] = useState('');
  // 배너 제작 대행(2026-10-29): design=true 면 그림 대신 소개·강조 문구·로고(선택)
  const [design, setDesign] = useState(false);
  const [intro, setIntro] = useState('');
  const [headline, setHeadline] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoErr, setLogoErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 미리보기 주소 정리(메모리 새지 않게)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // 각 단계에서 [다음]을 눌러도 되는지
  const okStep = [
    !!kind && (kind !== 'AD-P' || !!process),
    !!sido && units > 0,
    // 배너: 직접 올리기면 그림, 제작 대행이면 소개·강조 문구. 전화는 이니시스 결제창 필수
    (design ? !briefProblem(cleanBrief(intro, BRIEF_MAX.intro), cleanBrief(headline, BRIEF_MAX.headline)) && !logoErr : !!file && !fileErr)
      && isHttpsUrl(clickUrl) && phone.replace(/\D/g, '').length >= 10,
    true,
  ][step];

  // 배너 고르기 → 바로 규격 검사
  const pickFile = async (f: File | undefined) => {
    setFile(null);
    setFileErr('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    if (!f || !kind) return;
    const why = checkBanner(kind, new Uint8Array(await f.arrayBuffer()));
    if (why) {
      setFileErr(why);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  // 로고 고르기(선택) → PNG/JPG·1MB 이하만
  const pickLogo = async (f: File | undefined) => {
    setLogo(null);
    setLogoErr('');
    if (!f) return;
    if (f.size > 1024 * 1024 || !imageKind(new Uint8Array(await f.arrayBuffer()))) {
      setLogoErr('로고는 1MB 이하 PNG/JPG 만 올릴 수 있어요');
      return;
    }
    setLogo(f);
  };

  // 카드 결제: 서버 준비 → 포트원 결제창 → 서버 확인
  const payNow = async () => {
    if (!pay || !kind || (!design && !file) || busy) return;
    setBusy(true);
    setErr('');
    const f = new FormData();
    f.set('mode', 'new');
    f.set('kind', kind);
    f.set('sido', sido);
    if (kind === 'AD-P') f.set('process', process);
    f.set('units', String(units));
    f.set('clickUrl', clickUrl.trim());
    f.set('phone', phone);
    if (design) {
      f.set('design', '1');
      f.set('intro', intro);
      f.set('headline', headline);
      if (logo) f.set('logo', logo);
    } else if (file) {
      f.set('file', file);
    }
    const p = await preparePay(f);
    if (!p.ok) {
      setErr(p.error);
      setBusy(false);
      return;
    }
    const r = await openCheckout(pay, p.data, email, phone, name);
    if (r.kind === 'done') {
      location.href = '/partner';
      return;
    }
    if (r.kind === 'fail') setErr(r.error);
    setBusy(false);
  };

  // 화면 표시용 금액(실제 결제 금액은 서버가 첫 회 여부를 다시 보고 계산)
  const q = kind ? quoteNew(kind, units, design ? { firstFree: designFree } : null) : null;
  const info = kind ? SLOT_INFO[kind] : null;

  return (
    <div>
      {/* 진행 표시 */}
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-brown">새 광고 신청</h1>
        <span className="text-[13px] text-ink-2 tabular-nums">{step + 1}/{STEPS.length}</span>
      </div>
      <div className="mb-5 grid grid-cols-4 gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 rounded-full ${i <= step ? 'bg-brown' : 'bg-line'}`} />
        ))}
      </div>

      {/* 1. 자리 */}
      {step === 0 && (
        <section className="space-y-2">
          <p className="mb-2 text-[15px] font-semibold text-ink">어디에 보일까요?</p>
          {PARTNER_SLOTS.map((k) => (
            <button key={k} type="button" className={pickCls(kind === k)} onClick={() => { setKind(k); setFile(null); setFileErr(''); setPreview(''); }}>
              <span className="flex items-center justify-between">
                <span className="text-[16px] font-semibold text-ink">{SLOT_INFO[k].name}</span>
                <span className="text-[14px] text-ink tabular-nums">{won(SLOT_INFO[k].price)}<span className="text-ink-2">/30일</span></span>
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-2">{WHERE[k]} · {SLOT_INFO[k].width}×{SLOT_INFO[k].height}</span>
            </button>
          ))}
          {kind === 'AD-P' && (
            <div className="pt-3">
              <p className="mb-2 text-[15px] font-semibold text-ink">공정</p>
              <div className="flex flex-wrap gap-2">
                {AD_PROCESS_GROUPS.map((g) => (
                  <button key={g} type="button" onClick={() => setProcess(g)} className={`h-11 rounded-chip border px-4 text-[14px] ${process === g ? 'border-accent bg-accent/5 font-semibold text-ink' : 'border-line bg-surface text-ink'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. 지역·기간 */}
      {step === 1 && (
        <section>
          <p className="mb-2 text-[15px] font-semibold text-ink">지역</p>
          <select className={inputCls} value={sido} onChange={(e) => setSido(e.target.value)} aria-label="지역">
            <option value="">고르기</option>
            {PARTNER_REGIONS.map(([c, n]) => (
              <option key={c} value={c}>{n}</option>
            ))}
          </select>
          <p className="mb-2 mt-5 text-[15px] font-semibold text-ink">기간</p>
          <div className="grid grid-cols-3 gap-2">
            {PARTNER_UNITS.map((u) => (
              <button key={u} type="button" onClick={() => setUnits(u)} className={`h-12 rounded-xl border text-[15px] ${units === u ? 'border-accent bg-accent/5 font-semibold text-ink' : 'border-line bg-surface text-ink'}`}>
                {u * 30}일
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-2">한 지역에 3개 업체가 돌아가며 보여요</p>
        </section>
      )}

      {/* 3. 배너·연결 주소 */}
      {step === 2 && info && (
        <section>
          {/* 배너 직접 올리기 / 제작 대행 맡기기 */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button type="button" className={pickCls(!design)} onClick={() => setDesign(false)} aria-pressed={!design}>
              <span className="block text-[15px] font-semibold text-ink">배너 직접 올리기</span>
              <span className="mt-0.5 block text-[12px] text-ink-2">그림이 있어요</span>
            </button>
            <button type="button" className={pickCls(design)} onClick={() => setDesign(true)} aria-pressed={design}>
              <span className="block text-[15px] font-semibold text-ink">제작 대행 맡기기</span>
              <span className="mt-0.5 block text-[12px] text-ink-2">{designFree ? '첫 제작 무료' : `${won(DESIGN_FEE)} · 부가세 별도`}</span>
            </button>
          </div>

          {design ? (
            <div>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold text-ink">업체 소개 한 줄</span>
                <input className={inputCls} value={intro} maxLength={BRIEF_MAX.intro} onChange={(e) => setIntro(e.target.value)} placeholder="남양주 올수리 전문 10년" />
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[15px] font-semibold text-ink">강조 문구</span>
                <input className={inputCls} value={headline} maxLength={BRIEF_MAX.headline} onChange={(e) => setHeadline(e.target.value)} placeholder="무료 실측 · 당일 견적" />
              </label>
              <p className="mb-1.5 mt-4 text-[15px] font-semibold text-ink">로고 <span className="font-normal text-ink-2">(선택)</span></p>
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-surface px-3 text-[14px] text-ink-2">
                {logo ? logo.name : '로고 고르기'}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => void pickLogo(e.target.files?.[0])} />
              </label>
              {logoErr && <p className="mt-1 text-[13px] text-danger" role="alert">{logoErr}</p>}
              <p className="mt-2 text-[13px] text-ink-2">시안 1개 · 수정 2회 · 3영업일</p>
            </div>
          ) : (
          <div>
          <p className="mb-1 text-[15px] font-semibold text-ink">배너 그림</p>
          <p className="mb-2 text-[13px] text-ink-2">
            {info.width}×{info.height} 또는 {info.width * 2}×{info.height * 2} · PNG/JPG · {info.maxKB}KB 이하
          </p>
          <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-surface p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="배너 미리보기" className="max-h-40 w-auto max-w-full" />
            ) : (
              <span className="text-[15px] text-ink-2">그림 고르기</span>
            )}
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} />
          </label>
          {fileErr && <p className="mt-1 text-[13px] text-danger" role="alert">{fileErr}</p>}
          </div>
          )}

          <label className="mt-5 block">
            <span className="mb-1.5 block text-[15px] font-semibold text-ink">누르면 갈 주소</span>
            <input className={inputCls} inputMode="url" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[15px] font-semibold text-ink">전화 번호 <span className="font-normal text-ink-2">(결제·연락용)</span></span>
            <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
          </label>
        </section>
      )}

      {/* 4. 금액 확인·카드 결제 */}
      {step === 3 && kind && q && (
        <section>
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-[16px] font-semibold text-ink">
              {SLOT_INFO[kind].name}
              {process && kind === 'AD-P' ? ` · ${process}` : ''}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-2">{regionName(sido)} · {units * 30}일 · 결제일부터 시작</p>
            <dl className="mt-4 space-y-1.5 text-[15px]">
              {design && (
                <>
                  <div className="flex justify-between"><dt className="text-ink-2">광고비</dt><dd className="tabular-nums text-ink">{won(q.adAmount)}</dd></div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">배너 제작</dt>
                    <dd className="tabular-nums text-ink">
                      {q.designFee === 0 ? (<><s className="mr-1.5 text-ink-2">{won(DESIGN_FEE)}</s>0원</>) : won(q.designFee)}
                    </dd>
                  </div>
                  {q.designFee === 0 && <p className="text-right text-[13px] font-semibold text-accent">첫 제작 무료</p>}
                </>
              )}
              <div className="flex justify-between"><dt className="text-ink-2">공급가</dt><dd className="tabular-nums text-ink">{won(q.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">부가세</dt><dd className="tabular-nums text-ink">{won(q.vat)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold text-ink">카드 결제</dt><dd className="text-[20px] font-bold tabular-nums text-ink">{won(q.total)}</dd></div>
            </dl>
          </div>
          <p className="mt-3 text-[13px] text-ink-2">
            {design ? '결제 뒤 3영업일 안에 시안을 보내 드려요' : '배너 검토 뒤 게재돼요. 반려되면 카드로 자동 환불돼요'}
          </p>
        </section>
      )}

      {err && <p className="mt-4 text-[14px] text-danger" role="alert">{err}</p>}

      {/* 아래 단추: 이전 · 다음(또는 결제) */}
      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button type="button" className="h-12 w-24 shrink-0 rounded-xl border border-line bg-surface text-[15px] text-ink" onClick={() => { setErr(''); setStep(step - 1); }} disabled={busy}>
            이전
          </button>
        )}
        {step < 3 ? (
          <button type="button" className={primaryBtn} disabled={!okStep} onClick={() => setStep(step + 1)}>
            다음
          </button>
        ) : (
          <button type="button" className={primaryBtn} disabled={!pay || busy} onClick={payNow}>
            {!pay ? '결제 준비 중' : busy ? '결제 중…' : `${q ? won(q.total) : ''} 카드 결제`}
          </button>
        )}
      </div>
    </div>
  );
}
