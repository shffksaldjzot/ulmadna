'use client';
// ──────────────────────────────────────────────
// 관리자 광고 자리 · 입력 폼과 주문별 단추 모음 — 2026년 10월 29일
//
// [무슨 기능인가]
//   광고주 등록 폼 · 주문 만들기 폼(기간·금액·부가세 자동 계산) · 주문 한 줄의 단추
//   (입금 확인·환불·배너 올리기·게재 승인·중지·클릭 주소 수정)를 담은 클라이언트 조각.
//   모두 관리자 API(/api/admin/ads, /api/admin/ad-banner)를 부르고, 성공하면 화면을 새로 읽는다.
//   관리자 로그인 쿠키는 브라우저가 자동으로 실어 보낸다.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AD_PROCESS_GROUPS, SLOT_INFO, SLOT_KINDS, calcOrder, kstToday, type SlotKind } from '@/lib/ads/pricing';

/** 시도 선택 목록(번호, 이름) */
export interface SidoOpt { code: string; name: string }
export interface AdvOpt { id: number; name: string }

const input = 'w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm';
const btn = 'px-3 py-1.5 rounded-md text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50';
// 주 단추: 2026-10-30 마우스를 올리면 더 진한 갈색, 누르면 한 번 더 진하게
const btnMain = 'px-3 py-1.5 rounded-md text-sm bg-brown text-white hover:bg-brown-hover active:bg-brown-press disabled:opacity-50';
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** 관리자 API 호출 공용 — 실패하면 서버가 준 한국어 문구를 돌려준다 */
async function post(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `오류 ${res.status}`;
  } catch {
    return '연결하지 못했어요';
  }
}

/** 광고주 등록 폼 */
export function AdvertiserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const d = Object.fromEntries(new FormData(f).entries());
    setBusy(true);
    const err = await post({ action: 'advertiser', ...d });
    setBusy(false);
    setMsg(err ?? '등록했어요');
    if (!err) {
      f.reset();
      router.refresh();
    }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <input name="name" required placeholder="업체명" className={input} />
      <input name="ceo" placeholder="대표자" className={input} />
      <input name="biz_no" placeholder="사업자번호" className={input} />
      <input name="phone" placeholder="연락처" className={input} />
      <input name="email" placeholder="이메일" className={input} />
      <input name="memo" placeholder="메모" className={input} />
      <div className="col-span-full flex items-center gap-3">
        <button className={btnMain} disabled={busy}>광고주 등록</button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </form>
  );
}

/** 주문 만들기 폼 — 자리·기간을 고르면 마지막 날·금액·부가세가 바로 계산돼 보인다 */
export function OrderForm({ advertisers, sidos }: { advertisers: AdvOpt[]; sidos: SidoOpt[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<SlotKind>('AD-H');
  const [start, setStart] = useState(kstToday());
  const [units, setUnits] = useState(1);
  const [amount, setAmount] = useState('');
  const [sido, setSido] = useState(''); // 지역 단계 가격 계산용
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const calc = useMemo(() => calcOrder(kind, start, units, amount === '' ? null : Number(amount), sido), [kind, start, units, amount, sido]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    setBusy(true);
    const err = await post({ action: 'order', ...d, slot_kind: kind, start_date: start, units, amount });
    setBusy(false);
    setMsg(err ?? '주문을 만들었어요');
    if (!err) router.refresh();
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <select name="advertiser_id" required className={input} defaultValue="">
        <option value="" disabled>광고주 고르기</option>
        {advertisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select value={kind} onChange={(e) => setKind(e.target.value as SlotKind)} className={input}>
        {SLOT_KINDS.map((k) => <option key={k} value={k}>{k} {SLOT_INFO[k].name}</option>)}
      </select>
      <select name="sido" required className={input} value={sido} onChange={(e) => setSido(e.target.value)}>
        <option value="" disabled>지역</option>
        {sidos.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
      </select>
      {kind === 'AD-P' ? (
        <select name="process" required className={input} defaultValue="">
          <option value="" disabled>공정</option>
          {AD_PROCESS_GROUPS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      ) : <div />}
      <label className="text-[11px] text-gray-400">시작일
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={input} required />
      </label>
      <label className="text-[11px] text-gray-400">30일 단위 개수
        <input type="number" min={1} max={24} value={units} onChange={(e) => setUnits(Number(e.target.value) || 1)} className={input} />
      </label>
      <label className="text-[11px] text-gray-400">금액 직접(무료 체험은 0)
        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="비우면 자동" className={input} />
      </label>
      <label className="text-[11px] text-gray-400">결제 방식
        <select name="pay_method" className={input} defaultValue="bank">
          <option value="bank">계좌이체</option>
          <option value="card">카드(준비 중)</option>
        </select>
      </label>
      <input name="click_url" placeholder="클릭 주소 https://... (비우면 전화로 연결)" className={`${input} sm:col-span-2`} />
      {/* 토탈 인테리어 스폰서(AD-T)는 이 전화 번호가 견적서 PDF 추천 줄에 상호와 함께 실린다 */}
      <input name="phone" placeholder={kind === 'AD-T' ? '전화번호(견적서 PDF 에 실림)' : '전화번호(선택)'} className={input} />
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 tabular-nums">
          {start} ~ {calc.endDate} ·{' '}
          {calc.discountPct > 0 && <>정가 <s>{won(calc.listAmount)}</s> → {calc.discountPct}% 할인 · </>}
          공급가 {won(calc.amount)} + 부가세 {won(calc.vat)} = <b>{won(calc.amount + calc.vat)}</b>
        </span>
        <button className={btnMain} disabled={busy}>주문 만들기</button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </form>
  );
}

/** 주문 한 줄의 단추 모음 */
export function OrderActions({
  id, kind, payStatus, runStatus, hasBanner, hasDesktopBanner = false, clickUrl, phone,
}: {
  id: number; kind: SlotKind; payStatus: string; runStatus: string; hasBanner: boolean;
  /** PC 그림(선택)이 올라가 있는지 — AD-H·AD-F 만 뜻이 있다 */
  hasDesktopBanner?: boolean;
  clickUrl: string | null; phone: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // PC 그림(728×90, 선택) 파일 고르기 칸 — PC 전용 규격이 있는 자리에서만 쓴다
  const pcFileRef = useRef<HTMLInputElement>(null);
  const pcSize = SLOT_INFO[kind].desktop;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  /** API 한 번 부르고 결과 문구를 보인다 */
  async function act(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const err = await post({ id, ...body });
    setBusy(false);
    setMsg(err ?? '');
    if (!err) router.refresh();
  }

  /** 배너 파일 올리기 — target 'desktop' 이면 PC 그림 칸으로 */
  async function upload(file: File, target: 'mobile' | 'desktop' = 'mobile') {
    setBusy(true);
    const fd = new FormData();
    fd.set('id', String(id));
    fd.set('file', file);
    fd.set('target', target);
    try {
      const res = await fetch('/api/admin/ad-banner', { method: 'POST', body: fd });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setMsg(res.ok ? '' : j?.error ?? `오류 ${res.status}`);
      if (res.ok) router.refresh();
    } catch {
      setMsg('연결하지 못했어요');
    }
    setBusy(false);
  }

  /** 클릭 주소·전화 고치기 */
  async function editLink() {
    const url = window.prompt("클릭 주소(https://..., 비우면 전화로 연결)", clickUrl ?? '');
    if (url === null) return;
    const tel = window.prompt('전화번호(비워도 됨)', phone ?? '');
    if (tel === null) return;
    await act({ action: 'link', click_url: url, phone: tel });
  }

  // 작은 단추: 2026-10-30 마우스를 올리면 바탕·테두리·글자가 함께 진해진다
  const b = 'px-2 py-1 rounded-md text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 whitespace-nowrap disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {payStatus === 'pending' && (
        <button className={`${b} !border-brown !text-brown`} disabled={busy} onClick={() => act({ action: 'pay', status: 'paid' }, '입금을 확인했나요? 결제 상태가 "입금 확인"으로 바뀌어요')}>입금 확인</button>
      )}
      {payStatus === 'paid' && <button className={b} disabled={busy} onClick={() => act({ action: 'pay', status: 'pending' }, '입금 확인을 취소할까요?')}>입금 취소</button>}
      {payStatus !== 'refunded' && <button className={`${b} !text-red-700`} disabled={busy} onClick={() => act({ action: 'pay', status: 'refunded' }, '환불 처리할까요? 게재도 중지돼요')}>환불</button>}
      {SLOT_INFO[kind].width > 0 && (
        <>
          <button className={b} disabled={busy} onClick={() => fileRef.current?.click()}>{hasBanner ? '배너 교체' : '배너 올리기'}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </>
      )}
      {/* PC 그림(선택) — 없으면 PC 에서도 휴대폰 그림이 가운데 나온다 */}
      {pcSize && (
        <>
          <button className={b} disabled={busy} onClick={() => pcFileRef.current?.click()}
            title={`PC ${pcSize.width}×${pcSize.height} 또는 2배 ${pcSize.width * 2}×${pcSize.height * 2}`}>
            {hasDesktopBanner ? 'PC 그림 교체' : `PC 그림(선택) ${pcSize.width}×${pcSize.height}`}
          </button>
          <input ref={pcFileRef} type="file" accept="image/png,image/jpeg" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, 'desktop'); e.target.value = ''; }} />
        </>
      )}
      <button className={b} disabled={busy} onClick={editLink}>주소 수정</button>
      {runStatus === 'review' && <button className={`${b} !border-brown !text-brown`} disabled={busy} onClick={() => act({ action: 'run', status: 'live' })}>승인·게재</button>}
      {runStatus === 'live' && <button className={b} disabled={busy} onClick={() => act({ action: 'run', status: 'stopped' }, '게재를 중지할까요?')}>중지</button>}
      {runStatus === 'stopped' && payStatus !== 'refunded' && <button className={b} disabled={busy} onClick={() => act({ action: 'run', status: 'live' })}>다시 게재</button>}
      {runStatus !== 'ended' && <button className={b} disabled={busy} onClick={() => act({ action: 'run', status: 'ended' }, '종료 처리할까요? 자리가 반환돼요')}>종료</button>}
      {msg && <span className="text-[11px] text-red-600 w-full">{msg}</span>}
    </div>
  );
}
