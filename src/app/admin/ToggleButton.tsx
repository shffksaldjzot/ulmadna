'use client';
// ──────────────────────────────────────────────
// 관리자 목록의 토글 단추(글 숨김/표시, 회원 차단/해제) — 2026-10-28
//
// [무슨 기능인가]
//   누르면 지정한 관리자 API 로 POST 하고, 성공하면 화면을 새로 읽는다.
//   confirmText 가 있으면 한 번 더 물어본다(차단처럼 되돌릴 수 있어도 실수 방지).
//   관리자 쿠키는 브라우저가 자동으로 실어 보낸다.
// ──────────────────────────────────────────────
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ToggleButton({
  url, body, label, confirmText, danger,
}: {
  /** 호출할 관리자 API 주소 */
  url: string;
  /** 보낼 값 */
  body: Record<string, unknown>;
  label: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={`px-2.5 py-1 rounded-md text-xs border whitespace-nowrap disabled:opacity-50 ${
        danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      {err ? '실패, 다시' : busy ? '...' : label}
    </button>
  );
}
