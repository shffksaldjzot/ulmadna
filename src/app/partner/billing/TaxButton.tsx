'use client';
// ─────────────────────────────────────────────────────────────
// 세금계산서 요청 단추 — 한 번 누르면 "요청함"으로 바뀐다 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { ghostBtn } from '../_ui';

export default function TaxButton({ paymentId, requested }: { paymentId: string; requested: boolean }) {
  const [done, setDone] = useState(requested);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/partner/tax-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) setDone(true);
      else setErr(d.error || '요청하지 못했어요');
    } catch {
      setErr('연결이 끊겼어요');
    }
    setBusy(false);
  };

  return (
    <div className="mt-3">
      <button type="button" className={`${ghostBtn} w-full`} disabled={done || busy} onClick={ask}>
        {done ? '세금계산서 요청함' : '세금계산서 요청'}
      </button>
      {err && <p className="mt-1 text-[13px] text-danger">{err}</p>}
    </div>
  );
}
