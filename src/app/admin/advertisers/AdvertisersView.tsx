'use client';
// ──────────────────────────────────────────────
// 관리자 광고주 목록·상세 (클라이언트 조각) — 2026년 10월 30일
//
// [무슨 기능인가]
//   - 목록: 검색(상호·이메일·사업자번호) + 칩(전체/게재 중 있음/주문 없음/정지), 줄을 누르면 상세가 펼쳐진다.
//   - 상세: 계정 정보 · 메모 편집 · 주문(게재/중지/반려) · 결제 내역 · 정지/활성 · 임시 비밀번호.
//   서버 쪽은 /api/admin/advertisers[/id] 와 기존 /api/admin/ads(게재·중지)를 부른다.
//   환불(반려)·정지·비밀번호 단추는 눌러도 되돌리기 어려워 확인 창을 한 번 거친다.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { REGION_NAMES } from '@/server/admin/format';
import type { AdvDetail, AdvRow } from '@/server/admin/advertisers';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const day = (s: string | null) => (s ? s.slice(0, 10) : '-');
const PAY: Record<string, string> = { pending: '입금 대기', paid: '결제 완료', refunded: '환불' };
const RUN: Record<string, string> = { review: '검토', live: '게재', ended: '종료', stopped: '중지' };
const PSTAT: Record<string, string> = { ready: '대기', paid: '결제', refunded: '환불', failed: '실패' };
const btn = 'px-3 py-1.5 rounded-md text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const sbtn = 'px-2 py-1 rounded text-xs border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50';

type Chip = 'all' | 'live' | 'none' | 'blocked';
const CHIPS: [Chip, string][] = [['all', '전체'], ['live', '게재 중 있음'], ['none', '주문 없음'], ['blocked', '정지']];

/** 목록 + 상세 */
export default function AdvertisersView({ rows }: { rows: AdvRow[] }) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [open, setOpen] = useState<number | null>(null);

  // 검색·칩으로 거른 목록(서버가 이미 가입일 최신순으로 정렬해 줌)
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const td = t.replace(/\D/g, '');
    return rows.filter((r) => {
      if (chip === 'live' && r.orders.live === 0) return false;
      if (chip === 'none' && r.orders.total !== 0) return false;
      if (chip === 'blocked' && r.status !== 'blocked') return false;
      if (!t) return true;
      return r.name.toLowerCase().includes(t) || r.email.toLowerCase().includes(t) || (td.length >= 3 && r.bizNo.replace(/\D/g, '').includes(td));
    });
  }, [rows, q, chip]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상호·이메일·사업자번호 검색"
          className="w-full sm:w-72 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setChip(k)}
              className={`px-3 py-1 rounded-full text-xs border ${chip === k ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{list.length}곳</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-[13px] table-fixed min-w-[1000px]">
          <thead>
            <tr className="text-[11px] text-gray-400 border-b border-gray-100">
              {['상호', '이메일', '사업자번호', '사업자 상태', '지역', '가입일', '최근 로그인', '주문 검/게/끝', '결제 합계', '상태', '메모'].map((h) => (
                <th key={h} className={`py-2 px-2 text-left font-medium whitespace-nowrap ${COLW[h] ?? ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={11} className="py-8 text-center text-gray-400">해당하는 광고주가 없어요</td></tr>
            )}
            {list.map((r) => (
              <RowBlock key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 목록 한 줄 + 펼침 상세 */
function RowBlock({ r, open, onToggle }: { r: AdvRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-b border-gray-50 hover:bg-[#faf6f0] ${open ? 'bg-[#faf6f0]' : ''}`}>
        <td className="py-2 px-2 font-medium text-gray-800 truncate">{r.name}</td>
        <td className="py-2 px-2 text-gray-600 truncate" title={r.email}>{r.email || "-"}</td>
        <td className="py-2 px-2 tabular-nums text-gray-600 whitespace-nowrap">{r.bizNo || '-'}</td>
        <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{r.bizStatus ?? '-'}</td>
        <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{r.region ? REGION_NAMES[r.region] ?? r.region : '-'}</td>
        <td className="py-2 px-2 tabular-nums text-gray-500 whitespace-nowrap">{day(r.createdAt)}</td>
        <td className="py-2 px-2 tabular-nums text-gray-500 whitespace-nowrap">{day(r.lastLoginAt)}</td>
        <td className="py-2 px-2 tabular-nums text-gray-600 whitespace-nowrap">{r.orders.review} / {r.orders.live} / {r.orders.ended}</td>
        <td className="py-2 px-2 tabular-nums text-gray-700 whitespace-nowrap text-right">{won(r.paidTotal)}</td>
        <td className="py-2 px-2 whitespace-nowrap">
          <span className={r.status === 'blocked' ? 'text-red-600' : r.status === 'none' ? 'text-gray-400' : 'text-gray-700'}>
            {r.status === 'blocked' ? '정지' : r.status === 'none' ? '계정 없음' : '활성'}
          </span>
        </td>
        <td className="py-2 px-2 text-gray-500 truncate" title={r.memo}>{r.memo.slice(0, 30)}</td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <td colSpan={11} className="p-4 whitespace-normal"><Detail id={r.id} /></td>
        </tr>
      )}
    </>
  );
}

/** 요청 한 번 보내고 오류 문구(없으면 null)와 응답을 돌려준다 */
async function call(url: string, method: string, body: unknown): Promise<{ err: string | null; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return { err: res.ok ? null : String(data.error ?? `오류 ${res.status}`), data };
  } catch {
    return { err: '연결하지 못했어요', data: {} };
  }
}

/** 상세 패널: 열릴 때 서버에서 읽는다 */
function Detail({ id }: { id: number }) {
  const [d, setD] = useState<AdvDetail | null>(null);
  const [fail, setFail] = useState('');
  const [memo, setMemo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState('');

  /** 상세를 다시 읽는다 */
  const load = async () => {
    try {
      const res = await fetch(`/api/admin/advertisers/${id}`, { cache: 'no-store' });
      if (!res.ok) return setFail('상세를 읽지 못했어요');
      const j = (await res.json()) as { advertiser: AdvDetail };
      setD(j.advertiser);
      setMemo(j.advertiser.memo);
    } catch {
      setFail('연결하지 못했어요');
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (fail) return <p className="text-sm text-red-600">{fail}</p>;
  if (!d) return <p className="text-sm text-gray-400">읽는 중…</p>;

  /** 단추 한 번 실행: 확인 문구가 있으면 먼저 묻는다 */
  const act = async (confirmText: string | null, run: () => Promise<{ err: string | null; data: Record<string, unknown> }>, ok: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg('');
    const r = await run();
    setBusy(false);
    if (r.err) return setMsg(r.err);
    setMsg(ok);
    if (typeof r.data.tempPassword === 'string') setTemp(r.data.tempPassword);
    await load();
  };

  const a = `/api/admin/advertisers/${id}`;
  return (
    <div className="space-y-4">
      {/* 계정 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
        {[
          ['상호', d.name], ['대표자', d.ceo ?? '-'], ['연락처', d.phone ?? '-'], ['이메일', d.email || '-'],
          ['사업자번호', d.bizNo || '-'], ['사업자 상태', d.bizStatus ?? '-'], ['지역', d.region ? REGION_NAMES[d.region] ?? d.region : '-'],
          ['가입일', day(d.createdAt)], ['약관 동의', day(d.agreedAt)], ['최근 로그인', day(d.lastLoginAt)],
          ['상태', d.status === 'blocked' ? '정지' : d.status === 'none' ? '계정 없음' : '활성'], ['결제 합계', won(d.paidTotal)],
        ].map(([k, v]) => (
          <div key={k}><p className="text-[11px] text-gray-400">{k}</p><p className="text-gray-800 break-all">{v}</p></div>
        ))}
      </div>

      {/* 메모 */}
      <div className="flex gap-2 items-start">
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} maxLength={500} placeholder="관리자 메모" className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm" />
        <button type="button" className={btn} disabled={busy || memo === d.memo} onClick={() => act(null, () => call(a, 'PATCH', { memo }), '메모를 저장했어요')}>메모 저장</button>
      </div>

      {/* 계정 단추 */}
      {d.status !== 'none' && (
        <div className="flex flex-wrap items-center gap-2">
          {d.status === 'active' ? (
            <button type="button" className={btn} disabled={busy} onClick={() => act('이 광고주를 정지할까요? 로그인이 막히고 지금 로그인도 끊겨요.', () => call(a, 'PATCH', { status: 'blocked' }), '정지했어요')}>정지</button>
          ) : (
            <button type="button" className={btn} disabled={busy} onClick={() => act(null, () => call(a, 'PATCH', { status: 'active' }), '활성으로 바꿨어요')}>활성</button>
          )}
          <button type="button" className={btn} disabled={busy} onClick={() => act('임시 비밀번호를 새로 만들까요? 기존 비밀번호는 못 써요.', () => call(a, 'POST', { action: 'reset' }), '임시 비밀번호를 만들었어요')}>비밀번호 재설정</button>
          {temp && <span className="text-sm">임시 비밀번호 <b className="select-all rounded bg-yellow-50 px-2 py-0.5 tabular-nums">{temp}</b> <span className="text-xs text-gray-400">(지금만 보여요)</span></span>}
        </div>
      )}
      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      {/* 주문 */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">주문 {d.orderList.length}건</p>
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-100">
          <table className="w-full text-xs min-w-[900px]">
            <thead><tr className="text-gray-400 border-b border-gray-100">{['자리', '지역', '기간', '금액', '결제', '게재', '노출/클릭', ''].map((h) => <th key={h} className="py-1.5 px-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {d.orderList.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-gray-400">주문이 없어요</td></tr>}
              {d.orderList.map((o) => (
                <tr key={o.id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 whitespace-nowrap">{o.slot_kind}{o.process ? ` · ${o.process}` : ''}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{o.sido === 'ALL' ? '전국' : REGION_NAMES[o.sido] ?? o.sido}</td>
                  <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">{o.start_date} ~ {o.end_date}</td>
                  <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">{won(o.total)}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{PAY[o.pay_status] ?? o.pay_status}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{RUN[o.run_status] ?? o.run_status}</td>
                  <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">{o.impressions.toLocaleString('ko-KR')} / {o.clicks.toLocaleString('ko-KR')}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      {o.run_status !== 'live' && o.pay_status !== 'refunded' && (
                        <button type="button" className={sbtn} disabled={busy} onClick={() => act(null, () => call('/api/admin/ads', 'POST', { action: 'run', id: o.id, status: 'live' }), '게재했어요')}>게재</button>
                      )}
                      {o.run_status === 'live' && (
                        <button type="button" className={sbtn} disabled={busy} onClick={() => act('이 광고를 중지할까요?', () => call('/api/admin/ads', 'POST', { action: 'run', id: o.id, status: 'stopped' }), '중지했어요')}>중지</button>
                      )}
                      {o.pay_status !== 'refunded' && (
                        <button
                          type="button"
                          className={`${sbtn} text-red-600`}
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt(`반려 사유(선택). ${o.paymentId ? '카드 결제가 전액 취소돼요.' : '환불 처리돼요.'}`, '');
                            if (reason === null) return;
                            void act(null, () => call(a, 'POST', { action: 'reject', orderId: o.id, reason }), '반려(환불)했어요');
                          }}
                        >반려(환불)</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 결제·환불 */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">결제·환불 {d.payments.length}건</p>
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-100">
          <table className="w-full text-xs min-w-[700px]">
            <thead><tr className="text-gray-400 border-b border-gray-100">{['결제일', '종류', '주문', '금액', '상태', '환불일', '세금계산서'].map((h) => <th key={h} className="py-1.5 px-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {d.payments.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-400">카드 결제 내역이 없어요</td></tr>}
              {d.payments.map((p) => (
                <tr key={p.payment_id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 tabular-nums">{day(p.paid_at ?? p.created_at)}</td>
                  <td className="py-1.5 px-2">{p.kind === 'extend' ? '연장' : '새 광고'}</td>
                  <td className="py-1.5 px-2 tabular-nums">{p.order_id ? `#${p.order_id}` : '-'}</td>
                  <td className="py-1.5 px-2 tabular-nums">{won(p.total)}</td>
                  <td className="py-1.5 px-2">{PSTAT[p.status] ?? p.status}</td>
                  <td className="py-1.5 px-2 tabular-nums">{day(p.refunded_at)}</td>
                  <td className="py-1.5 px-2">{p.tax_invoice_requested_at ? <b className="text-[var(--accent)]">요청 {day(p.tax_invoice_requested_at)}</b> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** 목록 칸 너비(고정 레이아웃) — 이메일·메모는 남는 폭을 나눠 쓴다 */
const COLW: Record<string, string> = {
  '상호': 'w-[110px]', '이메일': 'w-[170px]', '메모': 'w-[110px]', '사업자번호': 'w-[110px]', '사업자 상태': 'w-[80px]', '지역': 'w-[60px]', '가입일': 'w-[90px]',
  '최근 로그인': 'w-[90px]', '주문 검/게/끝': 'w-[90px]', '결제 합계': 'w-[90px]', '상태': 'w-[70px]',
};
