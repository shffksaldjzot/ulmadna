// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 입력 화면 (클라이언트)
// 디자인 가이드 v4 아트보드 05 기준. 세그먼트 "평형으로 / 실측으로 / 면적으로"에 따라
// 아래 칸이 통째로 바뀐다. 안내문 0줄 원칙 그대로.
//
// 계산은 여기서 하지 않는다 — "계산하기"를 누르면 입력값을 URL 쿼리(d)에 실어
// 결과 화면(/v1/calc/wallpaper/result)으로 넘기고, 실제 계산은 그 서버 화면에서
// calcWallpaper()를 직접 호출한다(단가 로직이 클라이언트 번들에 실리지 않도록).
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopNav from '@/components/v1/TopNav';
import Chip from '@/components/v1/Chip';
import Segment from '@/components/v1/Segment';
import Toggle from '@/components/v1/Toggle';
import TextField from '@/components/v1/TextField';
import NumberField from '@/components/v1/NumberField';
import Button from '@/components/v1/Button';
import RegionPicker from '@/components/v1/RegionPicker';
import {
  DEFAULT_WALLPAPER_FORM,
  decodeWallpaperForm,
  encodeWallpaperForm,
  type WallpaperFormState,
} from '@/lib/v1/wallpaperQuery';

// 평형 칩 목록 (설계 정본 1절)
const PYEONG_CHIPS = [18, 24, 25, 30, 34, 40, 45];

// 실측 모드 기본 방 6개. 이름은 치수 공통 모듈(dimensions.ts)의 guessRoomKey가
// 그대로 알아볼 수 있는 이름을 그대로 쓴다(거실·주방·안방·방2·방3·복도).
const DEFAULT_ROOMS: { name: string; widthM: number | ''; depthM: number | ''; doors?: number }[] = [
  { name: '거실', widthM: '', depthM: '' },
  { name: '주방', widthM: '', depthM: '' },
  { name: '안방', widthM: '', depthM: '' },
  { name: '방2', widthM: '', depthM: '' },
  { name: '방3', widthM: '', depthM: '' },
  { name: '복도', widthM: '', depthM: '' },
];

// "방 고르기" 범위에서 보여줄 칩. value는 서버 dimensions.ts의 guessRoomKey 결과와 맞춘다.
const SCOPE_ROOM_CHIPS: { key: string; label: string }[] = [
  { key: 'living', label: '거실' },
  { key: 'master', label: '안방' },
  { key: 'kitchen', label: '주방' },
  { key: 'bed2', label: '방2' },
  { key: 'bed3', label: '방3' },
  { key: 'etc', label: '복도' },
];

export default function WallpaperInputForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 결과 화면에서 "조건 바꾸기"로 돌아온 경우 URL의 d 쿼리로 이전 입력을 복원한다
  const initial = useMemo<WallpaperFormState>(
    () => decodeWallpaperForm(searchParams.get('d')) ?? DEFAULT_WALLPAPER_FORM,
    [searchParams],
  );

  // ── 공통 ──
  const [mode, setMode] = useState<WallpaperFormState['mode']>(initial.mode);
  const [scope, setScope] = useState<WallpaperFormState['scope']>(initial.scope ?? '전체');
  const [ceiling, setCeiling] = useState(initial.ceiling ?? true);
  const [paperType, setPaperType] = useState<'합지' | '실크'>(initial.paperType ?? '실크');
  const [region, setRegion] = useState<string | undefined>(initial.region);

  // ── 평형 모드 ──
  const [pyeong, setPyeong] = useState<number | ''>(initial.pyeong ?? 34);
  const [customPyeong, setCustomPyeong] = useState(!PYEONG_CHIPS.includes(Number(initial.pyeong ?? 34)));
  const [bay, setBay] = useState<2 | 3 | 4>(initial.bay ?? 3);

  // ── 실측 모드 ──
  const [rooms, setRooms] = useState(
    initial.rooms && initial.rooms.length > 0
      ? initial.rooms.map((r) => ({ ...r }))
      : DEFAULT_ROOMS.map((r) => ({ ...r })),
  );
  const [heightM, setHeightM] = useState<number | ''>(initial.heightM ?? 2.3);
  const [doorsOpenIdx, setDoorsOpenIdx] = useState<number | null>(null);

  // ── 면적 모드 ──
  const [wallSqm, setWallSqm] = useState<number | ''>(initial.areas?.wallSqm ?? '');
  const [ceilingSqm, setCeilingSqm] = useState<number | ''>(initial.areas?.ceilingSqm ?? '');
  const [perimeterM, setPerimeterM] = useState<number | ''>(initial.areas?.perimeterM ?? '');

  // ── 벽지 제품 직접 입력 ──
  const [productOpen, setProductOpen] = useState(!!initial.product);
  const [rollPrice, setRollPrice] = useState<number | ''>(initial.product?.rollPrice ?? '');
  const [widthCm, setWidthCm] = useState<number | ''>(initial.product?.widthCm ?? (paperType === '실크' ? 106 : 93));
  const [lengthM, setLengthM] = useState<number | ''>(initial.product?.lengthM ?? (paperType === '실크' ? 15.6 : 17.75));

  const [error, setError] = useState<string | null>(null);

  /** 방 한 줄 값 바꾸기 */
  function updateRoom(idx: number, patch: Partial<(typeof rooms)[number]>) {
    setRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  /** 방 삭제 */
  function removeRoom(idx: number) {
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  }

  /** 방 추가 */
  function addRoom() {
    setRooms((prev) => [...prev, { name: `방${prev.length + 1}`, widthM: '', depthM: '' }]);
  }

  /** "방 고르기" 칩 토글 */
  function toggleScopeRoom(key: string) {
    setScope((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
    });
  }

  /** 계산하기 — 입력을 검증한 뒤 결과 화면으로 이동 */
  function handleSubmit() {
    setError(null);

    if (mode === '평형') {
      if (!pyeong || pyeong <= 0) {
        setError('평형을 입력해 주세요');
        return;
      }
    }
    if (mode === '실측') {
      const validRooms = rooms.filter((r) => Number(r.widthM) > 0 && Number(r.depthM) > 0);
      if (validRooms.length === 0) {
        setError('방을 하나 이상, 가로·세로를 입력해 주세요');
        return;
      }
    }
    if (mode === '면적') {
      if (!wallSqm || wallSqm <= 0) {
        setError('벽 면적을 입력해 주세요');
        return;
      }
    }

    const state: WallpaperFormState = {
      mode,
      scope: mode === '평형' ? scope : '전체', // 실측·면적은 범위 칸이 없으니 항상 전체
      ceiling,
      paperType,
      region,
      ...(mode === '평형' && { pyeong: Number(pyeong), bay }),
      ...(mode === '실측' && {
        heightM: Number(heightM) || 2.3,
        rooms: rooms
          .filter((r) => Number(r.widthM) > 0 && Number(r.depthM) > 0)
          .map((r) => ({ name: r.name, widthM: Number(r.widthM), depthM: Number(r.depthM), doors: r.doors })),
      }),
      ...(mode === '면적' && {
        areas: {
          wallSqm: Number(wallSqm),
          ceilingSqm: ceilingSqm ? Number(ceilingSqm) : undefined,
          perimeterM: perimeterM ? Number(perimeterM) : undefined,
        },
      }),
      ...(productOpen &&
        rollPrice &&
        widthCm &&
        lengthM && {
          product: { rollPrice: Number(rollPrice), widthCm: Number(widthCm), lengthM: Number(lengthM) },
        }),
    };

    router.push(`/v1/calc/wallpaper/result?d=${encodeWallpaperForm(state)}`);
  }

  return (
    <>
      <TopNav title="도배 계산기" backHref="/v1" />

      <div className="px-4 py-4 pb-32 flex flex-col gap-6 max-w-[720px] mx-auto">
        {/* 입력 방식 3칸 */}
        <Segment
          value={mode}
          onChange={setMode}
          options={[
            { value: '평형', label: '평형으로' },
            { value: '실측', label: '실측으로' },
            { value: '면적', label: '면적으로' },
          ]}
        />

        {/* ── 평형 모드 ── */}
        {mode === '평형' && (
          <>
            <div className="flex flex-col gap-3">
              <span className="text-[16px] font-semibold text-foreground">평형</span>
              <div className="flex gap-2 flex-wrap">
                {PYEONG_CHIPS.map((p) => (
                  <Chip
                    key={p}
                    selected={!customPyeong && pyeong === p}
                    onClick={() => {
                      setCustomPyeong(false);
                      setPyeong(p);
                    }}
                  >
                    {p}
                  </Chip>
                ))}
                <Chip selected={customPyeong} onClick={() => setCustomPyeong(true)}>
                  직접 입력
                </Chip>
              </div>
              {customPyeong && (
                <NumberField value={pyeong} onChange={setPyeong} suffix="평" placeholder="평형 입력" aria-label="평형 직접 입력" />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[16px] font-semibold text-foreground">구조</span>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map((b) => (
                  <Chip key={b} selected={bay === b} onClick={() => setBay(b)}>
                    {b}베이
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 실측 모드 ── */}
        {mode === '실측' && (
          <div className="flex flex-col gap-3">
            <span className="text-[16px] font-semibold text-foreground">높이</span>
            <NumberField value={heightM} onChange={setHeightM} suffix="m" placeholder="2.3" aria-label="공통 높이" />

            <span className="text-[16px] font-semibold text-foreground mt-2">방 치수</span>
            <div className="flex flex-col gap-3">
              {rooms.map((r, i) => (
                <div key={i} className="border border-v1-line rounded-[4px] p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={r.name}
                      onChange={(e) => updateRoom(i, { name: e.target.value })}
                      className="flex-1 min-w-0 text-[16px] font-semibold text-foreground bg-transparent outline-none border-b border-v1-line-3 pb-1"
                    />
                    <button
                      type="button"
                      onClick={() => setDoorsOpenIdx((v) => (v === i ? null : i))}
                      className="text-[14px] text-v1-text-secondary flex-none"
                    >
                      문·창
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      aria-label="행 삭제"
                      className="text-[16px] text-v1-text-disabled flex-none w-6 h-6"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <NumberField
                      className="flex-1 min-w-0"
                      value={r.widthM}
                      onChange={(v) => updateRoom(i, { widthM: v })}
                      suffix="m"
                      placeholder="가로"
                      aria-label={`${r.name} 가로`}
                    />
                    <NumberField
                      className="flex-1 min-w-0"
                      value={r.depthM}
                      onChange={(v) => updateRoom(i, { depthM: v })}
                      suffix="m"
                      placeholder="세로"
                      aria-label={`${r.name} 세로`}
                    />
                  </div>
                  {doorsOpenIdx === i && (
                    <NumberField
                      value={r.doors ?? ''}
                      onChange={(v) => updateRoom(i, { doors: v === '' ? undefined : v })}
                      suffix="개"
                      placeholder="문 개수"
                      aria-label={`${r.name} 문 개수`}
                    />
                  )}
                </div>
              ))}
              <button type="button" onClick={addRoom} className="text-[16px] font-semibold text-brown underline underline-offset-4 self-start">
                + 방 추가
              </button>
            </div>
          </div>
        )}

        {/* ── 면적 모드 ── */}
        {mode === '면적' && (
          <div className="flex flex-col gap-3">
            <span className="text-[16px] font-semibold text-foreground">면적</span>
            <div className="flex gap-2">
              <NumberField className="flex-1 min-w-0" value={wallSqm} onChange={setWallSqm} suffix="㎡" placeholder="벽" aria-label="벽 면적" />
              <NumberField className="flex-1 min-w-0" value={ceilingSqm} onChange={setCeilingSqm} suffix="㎡" placeholder="천장" aria-label="천장 면적" />
              <NumberField className="flex-1 min-w-0" value={perimeterM} onChange={setPerimeterM} suffix="m" placeholder="선택" aria-label="둘레" />
            </div>
          </div>
        )}

        {/* 범위 — 평형 모드에서만 노출 */}
        {mode === '평형' && (
          <div className="flex flex-col gap-3">
            <span className="text-[16px] font-semibold text-foreground">범위</span>
            <Segment
              value={Array.isArray(scope) ? '방고르기' : scope}
              onChange={(v) => setScope(v === '방고르기' ? [] : (v as '전체' | '거실주방'))}
              options={[
                { value: '전체', label: '전체' },
                { value: '거실주방', label: '거실·주방' },
                { value: '방고르기', label: '방 고르기' },
              ]}
            />
            {Array.isArray(scope) && (
              <div className="flex gap-2 flex-wrap">
                {SCOPE_ROOM_CHIPS.map((c) => (
                  <Chip key={c.key} selected={scope.includes(c.key)} onClick={() => toggleScopeRoom(c.key)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 천장 포함 */}
        <div className="flex items-center justify-between min-h-11">
          <span className="text-[16px] font-semibold text-foreground">천장 포함</span>
          <Toggle checked={ceiling} onChange={setCeiling} label="천장 포함" />
        </div>

        {/* 벽지 */}
        <div className="flex flex-col gap-3">
          <span className="text-[16px] font-semibold text-foreground">벽지</span>
          <Segment
            value={paperType}
            onChange={setPaperType}
            options={[
              { value: '합지', label: '합지' },
              { value: '실크', label: '실크' },
            ]}
          />
          <div className="flex gap-2 items-center">
            <TextField withSearchIcon placeholder="브랜드·제품명" disabled className="opacity-60" />
            <button
              type="button"
              onClick={() => setProductOpen((v) => !v)}
              className="h-11 flex items-center text-[16px] font-semibold text-brown underline underline-offset-4 flex-none"
            >
              직접 입력
            </button>
          </div>
          {productOpen && (
            <div className="flex flex-col gap-2">
              <NumberField value={rollPrice} onChange={setRollPrice} suffix="원 / 롤" placeholder="롤당 가격" aria-label="롤당 가격" />
              <div className="flex gap-2">
                <NumberField className="flex-1 min-w-0" value={widthCm} onChange={setWidthCm} suffix="cm" placeholder="폭" aria-label="롤 폭" />
                <NumberField className="flex-1 min-w-0" value={lengthM} onChange={setLengthM} suffix="m" placeholder="길이" aria-label="롤 길이" />
              </div>
            </div>
          )}
        </div>

        {/* 지역 */}
        <div className="flex flex-col gap-3">
          <span className="text-[16px] font-semibold text-foreground">지역</span>
          <RegionPicker value={region} onChange={setRegion} />
        </div>

        {error && <p className="text-[16px] text-danger">{error}</p>}
      </div>

      {/* 하단 고정 계산하기 */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream px-4 pb-4 pt-2 max-w-[720px] mx-auto lg:static lg:max-w-none lg:px-0">
        <Button fullWidth onClick={handleSubmit}>
          계산하기
        </Button>
      </div>
    </>
  );
}
