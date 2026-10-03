// ──────────────────────────────────────────────
// 물어보기 — 질문 쓰기 양식 (시안 new.html 그대로)
//
// 흐름:
//   1) 로그인 확인 → 안 했으면 카카오 로그인 화면(돌아올 곳 = 이 화면)
//   2) 닉네임 확인 → 없으면 닉네임 정하는 화면(돌아올 곳 = 이 화면)
//   3) 두 갈래(견적서 봐주세요 / 비용 물어보기) · 블로그 글 맥락 칩 · 사진 1~5장 ·
//      제목(60자) · 평형 · 지역 · 공정 칩 · 설명 · 안내 3줄
//   4) [질문 올리기] → POST /api/ask/posts → 만들어진 질문 화면으로 이동
//
// 사진은 고르는 즉시 올린다: 서버에서 "서명된 업로드 주소"를 받아 Supabase 비공개
// 보관함에 바로 올린다(서버를 거치지 않아 10MB도 된다). 올라간 경로만 질문과 함께 보낸다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LIMITS, PHOTO_TYPES, PYEONG_OPTIONS, REGIONS, TRADES, type AskKind } from '@/lib/ask/constants';
import { askHref } from '@/lib/ask/format';
import { showAskToast } from './AskToast';
import { IcBack } from './icons';

/** 고른 사진 한 장의 상태 */
interface PickedPhoto {
  key: string; // 화면용 고유값
  name: string;
  preview: string | null; // 미리보기 주소(heic는 브라우저가 못 그려서 null)
  status: 'uploading' | 'done' | 'error';
  path: string | null; // 올라간 보관함 경로
}

export default function AskNewForm({ fromSlug, fromTitle }: { fromSlug: string | null; fromTitle: string | null }) {
  const router = useRouter();
  const { status } = useSession();
  const [ready, setReady] = useState(false); // 로그인·닉네임 확인 끝났는지

  const [kind, setKind] = useState<AskKind>('estimate');
  const [from, setFrom] = useState<string | null>(fromSlug);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [title, setTitle] = useState('');
  const [pyeongSel, setPyeongSel] = useState(''); // '' | 'custom' | PYEONG_OPTIONS 번호
  const [pyeongCustom, setPyeongCustom] = useState('');
  const [region, setRegion] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 이 화면 주소(로그인·닉네임 화면에서 돌아올 곳)
  const selfUrl = `/ask/new${fromSlug ? `?from=${encodeURIComponent(fromSlug)}` : ''}`;

  // ── 1·2) 로그인·닉네임 확인 ──
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      window.location.replace(`/login?callbackUrl=${encodeURIComponent(selfUrl)}`);
      return;
    }
    let alive = true;
    fetch('/api/ask/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { nickname?: string | null }) => {
        if (!alive) return;
        if (!d.nickname) window.location.replace(`/ask/nickname?next=${encodeURIComponent(selfUrl)}`);
        else setReady(true);
      })
      .catch(() => alive && setReady(true)); // 확인 실패 시엔 일단 쓰게 두고, 보낼 때 서버가 다시 확인
    return () => {
      alive = false;
    };
  }, [status, selfUrl]);

  // 화면을 떠날 때 미리보기 주소를 정리(메모리 새는 것 방지)
  useEffect(() => () => photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 사진 한 장 올리기: 허가증(서명 주소) 받기 → 보관함에 바로 올리기 */
  async function uploadOne(file: File, key: string) {
    const mark = (patch: Partial<PickedPhoto>) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    try {
      const r = await fetch('/api/ask/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: file.size, type: file.type || 'image/heic' }),
      });
      const d = (await r.json()) as { path?: string; signedUrl?: string; error?: string };
      if (!r.ok || !d.path || !d.signedUrl) throw new Error(d.error || '사진을 올리지 못했어요');
      // Supabase 서명 업로드 방식 그대로(폼 데이터에 파일 한 개)
      const fd = new FormData();
      fd.append('cacheControl', '3600');
      fd.append('', file);
      const up = await fetch(d.signedUrl, { method: 'PUT', body: fd, headers: { 'x-upsert': 'false' } });
      if (!up.ok) throw new Error('사진을 올리지 못했어요');
      mark({ status: 'done', path: d.path });
    } catch (e) {
      mark({ status: 'error' });
      showAskToast(e instanceof Error ? e.message : '사진을 올리지 못했어요');
    }
  }

  /** 사진 고르기 — 형식·크기·장수 검사 뒤 바로 올리기 시작 */
  function onPick(list: FileList | null) {
    if (!list) return;
    const room = LIMITS.photosMax - photos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > room) showAskToast(`사진은 ${LIMITS.photosMax}장까지예요`);
    for (const f of files) {
      const type = f.type || (/\.hei[cf]$/i.test(f.name) ? 'image/heic' : '');
      if (!PHOTO_TYPES.includes(type)) {
        showAskToast('jpg · png · heic 사진만 올릴 수 있어요');
        continue;
      }
      if (f.size > LIMITS.photoBytes) {
        showAskToast('사진은 한 장에 10MB까지예요');
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = type.includes('hei') ? null : URL.createObjectURL(f);
      setPhotos((prev) => [...prev, { key, name: f.name, preview, status: 'uploading', path: null }]);
      void uploadOne(f, key);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.key === key);
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.key !== key);
    });
  }

  function toggleTrade(t: string) {
    setTrades((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  /** 보내기 전 검사 — 문제가 있으면 안내 문장 */
  function problem(): string | null {
    if (kind === 'estimate' && !photos.some((p) => p.status === 'done')) return '견적서 사진을 한 장 이상 올려 주세요';
    if (photos.some((p) => p.status === 'uploading')) return '사진을 올리는 중이에요';
    if (title.trim().length < LIMITS.titleMin) return `제목을 ${LIMITS.titleMin}자 이상 적어 주세요`;
    if (trades.length === 0) return '공정을 하나 이상 골라 주세요';
    if (pyeongSel === 'custom' && pyeongCustom && !/^\d{1,3}$/.test(pyeongCustom)) return '평형은 숫자로 적어 주세요';
    return null;
  }

  async function submit() {
    const p = problem();
    if (p) {
      setError(p);
      showAskToast(p);
      return;
    }
    setError('');
    setBusy(true);
    const opt = pyeongSel !== '' && pyeongSel !== 'custom' ? PYEONG_OPTIONS[Number(pyeongSel)] : null;
    try {
      const r = await fetch('/api/ask/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          body: body.trim(),
          pyeong: opt ? opt.pyeong : pyeongSel === 'custom' && pyeongCustom ? Number(pyeongCustom) : null,
          type_code: opt ? opt.type : null,
          region: region || null,
          trades,
          photos: photos.filter((x) => x.status === 'done' && x.path).map((x) => x.path),
          from_slug: from,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { slug?: string; error?: string; needNickname?: boolean };
      if (d.needNickname) {
        window.location.href = `/ask/nickname?next=${encodeURIComponent(selfUrl)}`;
        return;
      }
      if (!r.ok || !d.slug) throw new Error(d.error || '질문을 올리지 못했어요');
      router.push(askHref(d.slug));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '질문을 올리지 못했어요';
      setError(msg);
      showAskToast(msg);
      setBusy(false);
    }
  }

  const uploading = photos.some((p) => p.status === 'uploading');

  return (
    <>
      <main className="app form-page">
        <div className="sub">
          <Link href="/ask">
            <IcBack />
            물어보기
          </Link>
          <span>›</span>
          <span className="cur">질문하기</span>
        </div>
        <div className="bhead">
          <div className="eyebrow">얼마드나 물어보기</div>
          <h1 className="t-page">무엇이 궁금하세요?</h1>
          <p className="lead">
            실시간 답변이 아니에요 · 견적서 자료를 찾아 보느라 <b style={{ color: 'var(--ink)' }}>5~10분</b> 걸려요
          </p>
        </div>

        {/* 두 갈래 */}
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={kind === 'estimate'} className={kind === 'estimate' ? 'on' : ''} onClick={() => setKind('estimate')}>
            견적서 봐주세요
          </button>
          <button type="button" role="tab" aria-selected={kind === 'cost'} className={kind === 'cost' ? 'on' : ''} onClick={() => setKind('cost')}>
            비용 물어보기
          </button>
        </div>

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          aria-busy={!ready}
        >
          {/* 블로그 글에서 넘어왔으면 글 맥락 칩 */}
          {from && fromTitle && (
            <div className="ctx">
              <div>
                <b>{fromTitle}</b>이 글을 보다가 왔어요 · 답변에 글 내용을 참고해요
              </div>
              <button
                type="button"
                onClick={() => {
                  setFrom(null);
                  showAskToast('글 연결을 뺐어요');
                }}
              >
                빼기
              </button>
            </div>
          )}

          {/* 사진 */}
          <div className="f">
            <span className="lbl">
              {kind === 'estimate' ? '견적서 사진' : '사진'} <b>{kind === 'estimate' ? '필수' : '선택'}</b>
            </span>
            <div className="upload">
              {photos.map((p) => (
                <div key={p.key} className="has">
                  {p.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.preview} alt={p.name} />
                  ) : (
                    <span style={{ padding: 4, wordBreak: 'break-all' }}>{p.name}</span>
                  )}
                  {p.status !== 'done' && <span className="st">{p.status === 'uploading' ? '올리는 중' : '실패'}</span>}
                  <button type="button" className="x" onClick={() => removePhoto(p.key)} aria-label={`${p.name} 빼기`}>
                    ×
                  </button>
                </div>
              ))}
              {photos.length < LIMITS.photosMax && (
                <button type="button" onClick={() => fileRef.current?.click()}>
                  + 추가
                  <br />
                  최대 {LIMITS.photosMax}장
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
              multiple
              hidden
              onChange={(e) => onPick(e.target.files)}
            />
            <div className="hint">사진은 공개돼요 · 전화번호 · 동호수 · 개인 이름은 자동으로 가려요(업체명은 그대로)</div>
          </div>

          {/* 제목 */}
          <div className="f">
            <label htmlFor="ask-title">
              제목 <b>필수</b>
            </label>
            <input
              id="ask-title"
              value={title}
              maxLength={LIMITS.titleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'estimate' ? '34평 도배+강마루 견적 580만원, 적정한가요?' : '욕실 두 개 덧방하면 보통 얼마예요?'}
            />
            <div className="cnt">
              {title.length} / {LIMITS.titleMax}
            </div>
          </div>

          {/* 평형 · 지역 */}
          <div className="two">
            <div className="f">
              <label htmlFor="ask-pyeong">평형</label>
              <select id="ask-pyeong" value={pyeongSel} onChange={(e) => setPyeongSel(e.target.value)}>
                <option value="">선택</option>
                {PYEONG_OPTIONS.map((o, i) => (
                  <option key={o.type} value={String(i)}>
                    {o.pyeong}평 · {o.type}타입
                  </option>
                ))}
                <option value="custom">직접 입력</option>
              </select>
              {pyeongSel === 'custom' && (
                <input
                  style={{ marginTop: 8 }}
                  inputMode="numeric"
                  value={pyeongCustom}
                  onChange={(e) => setPyeongCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="평수(숫자)"
                  aria-label="평수 직접 입력"
                />
              )}
            </div>
            <div className="f">
              <label htmlFor="ask-region">지역</label>
              <select id="ask-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 공정 */}
          <div className="f">
            <span className="lbl">
              공정 <b>1개 이상</b>
            </span>
            <div className="chips wrap" style={{ padding: 0 }}>
              {TRADES.map((t) => (
                <button key={t} type="button" className={`chip${trades.includes(t) ? ' sel' : ''}`} aria-pressed={trades.includes(t)} onClick={() => toggleTrade(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div className="f">
            <label htmlFor="ask-body">설명</label>
            <textarea id="ask-body" value={body} maxLength={LIMITS.bodyMax} onChange={(e) => setBody(e.target.value)} />
            <div className="hint">공사 범위 · 포함 항목 · 현장 상태를 적을수록 비교가 정확해져요</div>
          </div>

          {error && (
            <div className="err" role="alert">
              {error}
            </div>
          )}

          <div className="notice">
            <span>답은 AI가 빅데이터 견적서 자료로 작성하고 &quot;AI 답변&quot;으로 표시돼요</span>
            <span>질문 · 답 · 견적서 사진은 누구나 볼 수 있고 검색에도 나와요 · 올린 견적서는 통계 자료로도 쓰여요</span>
            <span>이름 · 전화번호 · 주소는 적지 마세요</span>
          </div>
        </form>

        <aside className="aside">
          <div className="card pc-only">
            <div className="ttl">이렇게 물으면 좋아요</div>
            <div className="rows" style={{ marginTop: 6 }}>
              <div style={{ padding: '4px 0 12px', fontSize: 15.5, fontWeight: 500 }}>
                견적서 사진 + 평형 + 공사 범위
                <small style={{ display: 'block', fontSize: 13, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>항목별로 비교해 드려요</small>
              </div>
              <div style={{ padding: '12px 0 0', borderTop: '1px solid var(--line-2)', fontSize: 15.5, fontWeight: 500 }}>
                &quot;보통 얼마예요?&quot;도 괜찮아요
                <small style={{ display: 'block', fontSize: 13, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>조건을 가정해서 범위로 답해요</small>
              </div>
            </div>
          </div>
        </aside>

        {/* 보내기 단추 — 모바일은 하단 탭 위에 떠 있고, PC는 양식 아래 */}
        <div className="cta">
          <button type="button" className="btn p" onClick={() => void submit()} disabled={busy || !ready || uploading}>
            {busy ? '올리는 중…' : uploading ? '사진 올리는 중…' : '질문 올리기 · 5~10분 뒤 답변'}
          </button>
        </div>
      </main>
    </>
  );
}
