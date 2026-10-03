// ──────────────────────────────────────────────
// 물어보기 — 닉네임 정하기 상자
//
// - 로그인 안 했으면 카카오 로그인 화면으로(돌아올 곳 = 이 화면)
// - 이미 이름이 있으면 그 이름을 채워 둔다(이름 바꾸기)
// - 칸에 적는 대로 0.4초 뒤 중복 확인(/api/ask/profile?check=)
// - [시작하기] → 저장 → 원래 가려던 화면(next)으로
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { LIMITS } from '@/lib/ask/constants';
import { nicknameProblem } from '@/lib/ask/format';

/** 추천 이름 후보 3개 — 서버 그림과 브라우저 그림이 같아야 해서 무작위로 섞지 않는다 */
const SUGGEST = ['입주준비', '도토리', '84타입'];

export default function AskNicknameClient({ next }: { next: string }) {
  const { status } = useSession();
  const [name, setName] = useState('');
  const [had, setHad] = useState<string | null>(null); // 원래 이름(있으면 "이름 바꾸기")
  const [check, setCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sugg = SUGGEST;

  // 로그인 확인 + 원래 이름 불러오기
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      window.location.replace(`/login?callbackUrl=${encodeURIComponent(`/ask/nickname?next=${encodeURIComponent(next)}`)}`);
      return;
    }
    fetch('/api/ask/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { nickname?: string | null }) => {
        if (d.nickname) {
          setHad(d.nickname);
          setName(d.nickname);
        }
      })
      .catch(() => {});
  }, [status, next]);

  // 적는 대로 중복 확인(0.4초 쉬었다가)
  useEffect(() => {
    const s = name.trim();
    if (!s) {
      setCheck(null);
      return;
    }
    const local = nicknameProblem(s);
    if (local) {
      setCheck({ ok: false, msg: local });
      return;
    }
    if (s === had) {
      setCheck({ ok: true, msg: '지금 쓰는 이름이에요' });
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/ask/profile?check=${encodeURIComponent(s)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { available?: boolean; problem?: string | null }) =>
          setCheck(d.available ? { ok: true, msg: '쓸 수 있는 이름이에요' } : { ok: false, msg: d.problem || '쓸 수 없는 이름이에요' }),
        )
        .catch(() => setCheck(null));
    }, 400);
    return () => clearTimeout(t);
  }, [name, had]);

  async function save() {
    const s = name.trim();
    if (busy || !check?.ok) return;
    if (s === had) {
      window.location.href = next;
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/ask/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: s }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || '저장하지 못했어요');
      window.location.href = next;
    } catch (e) {
      setCheck({ ok: false, msg: e instanceof Error ? e.message : '저장하지 못했어요' });
      setBusy(false);
    }
  }

  return (
    <section className="nickbox">
      <div className="av" aria-hidden="true">
        {name.trim().slice(0, 1) || '?'}
      </div>
      <h2>{had ? '이름 바꾸기' : '어떻게 불러 드릴까요?'}</h2>
      <p>질문과 댓글에 보이는 이름이에요 · 나중에 바꿀 수 있어요</p>
      <div className="f">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          aria-label="닉네임"
          maxLength={LIMITS.nickMax}
          placeholder={`${LIMITS.nickMin}~${LIMITS.nickMax}자`}
        />
        {check && <div className={check.ok ? 'ok' : 'no'}>{check.msg}</div>}
      </div>
      <div className="sugg">
        {sugg.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => setName(s)}>
            {s}
          </button>
        ))}
      </div>
      <button type="button" className="btn p" style={{ marginTop: 16 }} onClick={() => void save()} disabled={busy || !check?.ok}>
        {had ? '저장하기' : '시작하기'}
      </button>
    </section>
  );
}
