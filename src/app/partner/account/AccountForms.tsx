'use client';
// ─────────────────────────────────────────────────────────────
// 내 정보 화면의 입력 부분 (2026-10-30)
//   ① 기본 정보(상호·지역 수정, 사업자번호·이메일 표시)  ② 비밀번호 변경  ③ 로그아웃  ④ 탈퇴 요청(확인 창)
// ─────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { PARTNER_REGIONS, passwordProblem } from '@/lib/partner/rules';
import type { MyAccount } from '@/server/partner/store';
import LogoutButton from '../LogoutButton';
import { Card, ghostBtn, inputCls, primaryBtn } from '../_ui';

/** 000-00-00000 모양 */
const fmtBiz = (v: string) => (/^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v);

/** 서버에 JSON 을 보내고 오류 문구를 돌려준다(성공이면 null) */
async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return j.error ?? '처리하지 못했어요';
  } catch {
    return '네트워크를 확인해 주세요';
  }
}

/** 한 줄 읽기 전용 항목 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[14px] text-ink-2">{label}</span>
      <span className="min-w-0 truncate text-[15px] text-ink">{children}</span>
    </div>
  );
}

export default function AccountForms({ acc }: { acc: MyAccount }) {
  const [name, setName] = useState(acc.name);
  const [region, setRegion] = useState(acc.region);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askOut, setAskOut] = useState(false);
  const [withdrawn, setWithdrawn] = useState(acc.status === 'withdraw_requested');
  const [outErr, setOutErr] = useState('');

  const dirty = name.trim() !== acc.name || region !== acc.region;

  const saveProfile = async () => {
    setBusy(true);
    const err = await send('/api/partner/account', 'PATCH', { name: name.trim(), region });
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: '저장했어요' });
    if (!err) setTimeout(() => location.reload(), 600);
  };

  const pwBad = pw.next ? passwordProblem(pw.next) : null;
  const pwReady = !!pw.current && !passwordProblem(pw.next) && pw.next === pw.again;
  const savePw = async () => {
    setBusy(true);
    const err = await send('/api/partner/account/password', 'POST', { current: pw.current, next: pw.next });
    setBusy(false);
    if (err) return setPwMsg({ ok: false, text: err });
    setPw({ current: '', next: '', again: '' });
    setPwMsg({ ok: true, text: '바꿨어요. 다른 기기는 모두 로그아웃됐어요' });
  };

  const withdraw = async () => {
    setBusy(true);
    const err = await send('/api/partner/account/withdraw', 'POST');
    setBusy(false);
    if (err) return setOutErr(err);
    setAskOut(false);
    setWithdrawn(true);
  };

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <Card>
        <label className="block text-[14px] text-ink-2">상호</label>
        <input className={`${inputCls} mt-1`} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
        <label className="mt-3 block text-[14px] text-ink-2">지역</label>
        <select className={`${inputCls} mt-1`} value={region} onChange={(e) => setRegion(e.target.value)}>
          {PARTNER_REGIONS.map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </select>
        <button type="button" className={`${primaryBtn} mt-4`} disabled={busy || !dirty || !name.trim()} onClick={saveProfile}>저장</button>
        {msg && <p className={`mt-2 text-[14px] ${msg.ok ? 'text-ink-2' : 'text-red-600'}`}>{msg.text}</p>}
        <div className="mt-4 divide-y divide-line border-t border-line">
          <Row label="사업자번호">{fmtBiz(acc.bizNo)}</Row>
          {acc.bizStatus && <Row label="사업자 상태">{acc.bizStatus === 'active' ? '계속사업자 확인됨' : '확인 전'}</Row>}
          <Row label="이메일">{acc.email}</Row>
        </div>
        <p className="mt-2 text-[13px] text-ink-2">사업자번호·이메일 변경은 문의해 주세요</p>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <p className="text-[15px] font-semibold text-ink">비밀번호 변경</p>
        <input className={`${inputCls} mt-3`} type="password" autoComplete="current-password" placeholder="현재 비밀번호" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input className={`${inputCls} mt-2`} type="password" autoComplete="new-password" placeholder="새 비밀번호" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        {pwBad && <p className="mt-1 text-[13px] text-red-600">{pwBad}</p>}
        <input className={`${inputCls} mt-2`} type="password" autoComplete="new-password" placeholder="새 비밀번호 한 번 더" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
        {pw.again && pw.next !== pw.again && <p className="mt-1 text-[13px] text-red-600">새 비밀번호가 서로 달라요</p>}
        <button type="button" className={`${primaryBtn} mt-4`} disabled={busy || !pwReady} onClick={savePw}>비밀번호 바꾸기</button>
        {pwMsg && <p className={`mt-2 text-[14px] ${pwMsg.ok ? 'text-ink-2' : 'text-red-600'}`}>{pwMsg.text}</p>}
      </Card>

      {/* 로그아웃 */}
      <div className="flex justify-center">
        <LogoutButton />
      </div>

      {/* 탈퇴 요청 — 맨 아래 작게 */}
      <div className="pt-6 text-center">
        {withdrawn ? (
          <p className="text-[13px] text-ink-2">탈퇴를 요청했어요{acc.liveCount > 0 ? ' · 게재 중 광고가 끝난 뒤 처리돼요' : ' · 확인 뒤 처리돼요'}</p>
        ) : (
          <button type="button" className="h-11 px-3 text-[13px] text-ink-2 underline" onClick={() => { setOutErr(''); setAskOut(true); }}>탈퇴 요청</button>
        )}
      </div>

      {askOut && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-[400px] rounded-card bg-surface p-5">
            <p className="text-[17px] font-bold text-brown">탈퇴를 요청할까요?</p>
            <p className="mt-2 text-[14px] text-ink-2">
              {acc.liveCount > 0 ? `게재 중·검토 중 광고가 ${acc.liveCount}건 있어요. 게재 중 광고가 끝난 뒤 처리돼요.` : '확인 뒤 계정이 정리돼요.'}
            </p>
            {outErr && <p className="mt-2 text-[14px] text-red-600">{outErr}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className={ghostBtn} onClick={() => setAskOut(false)}>취소</button>
              <button type="button" className={`${ghostBtn} !border-red-300 !text-red-600`} disabled={busy} onClick={withdraw}>탈퇴 요청</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
