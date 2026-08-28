// ──────────────────────────────────────────────
// v1 허브 — 아주 작은 토스트 부품
// "준비 중"처럼 짧은 알림에만 쓴다. 페이지마다 useState로 message를 들고
// 이 컴포넌트에 넘겨주면 화면 하단 가운데에 잠깐 떴다 사라진다.
// ──────────────────────────────────────────────

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-brown text-white text-[16px] px-4 py-3 rounded-[4px] shadow-lg"
      role="status"
    >
      {message}
    </div>
  );
}

/** 토스트 메시지를 잠깐 띄웠다가 자동으로 지우는 도우미 */
export function showToast(setMessage: (v: string | null) => void, text: string, ms = 1800) {
  setMessage(text);
  window.setTimeout(() => setMessage(null), ms);
}
