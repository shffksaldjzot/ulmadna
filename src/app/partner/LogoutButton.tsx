'use client';
// ─────────────────────────────────────────────────────────────
// 로그아웃 단추 — 세션을 지우고 로그인 화면으로 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
export default function LogoutButton() {
  const out = async () => {
    await fetch('/api/partner/logout', { method: 'POST' }).catch(() => undefined);
    location.href = '/partner/login';
  };
  return (
    <button type="button" onClick={out} className="h-11 px-2 text-[14px] text-ink-2">
      로그아웃
    </button>
  );
}
