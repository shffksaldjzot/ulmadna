// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 정밀 폼: 문·창 표
//
// 이 파일이 하는 일:
//   벽 면적에서 빼야 하는 문·창을 줄 단위로 적는 표를 그린다.
//   한 줄 = 종류(문/창) · 가로(cm) · 세로(cm) · 개수. 오른쪽 ×로 그 줄을 지운다.
//   방 카드 안에서도 쓰고, "벽 전체 길이로" 모드에서도 똑같이 쓴다(같은 부품 재사용).
//
//   길이 단위 토글(m/mm)과 무관하게 문·창은 항상 cm로 적고 cm로 저장한다
//   (WallpaperOpening의 w·h가 cm 기준이라서. 문 90×210처럼 cm가 손에 익은 값이기도 하다).
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

'use client';

import Segment from '@/components/v1/Segment';
import NumberField from '@/components/v1/NumberField';
import { IconClose } from '@/components/v1/icons';
import type { WallpaperOpening } from '@/lib/v1/wallpaperQuery';
import { cmToDisplay, displayToCm } from './units';
import {
  rangeCaption,
  OPENING_WIDTH_CM_MIN,
  OPENING_WIDTH_CM_MAX,
  OPENING_HEIGHT_CM_MIN,
  OPENING_HEIGHT_CM_MAX,
} from '../../_components/inputRanges';

/** 문을 새로 추가할 때 미리 채워 두는 표준 규격 (cm) — 90 × 210 */
const DEFAULT_DOOR_CM = { w: 90, h: 210 } as const;

interface OpeningTableProps {
  /** 이 표가 들고 있는 문·창 목록 */
  openings: WallpaperOpening[];
  /** 목록이 바뀔 때마다 통째로 올려 준다(자식이 상태를 갖지 않는다는 규칙) */
  onChange: (v: WallpaperOpening[]) => void;
}

export default function OpeningTable({ openings, onChange }: OpeningTableProps) {
  /** 한 줄의 값 일부만 바꿔 목록 전체를 새로 만든다 */
  function patchRow(index: number, p: Partial<WallpaperOpening>) {
    onChange(openings.map((row, i) => (i === index ? { ...row, ...p } : row)));
  }

  /** 줄 추가 — 참고 폼과 같이 "문" 한 줄이 표준 규격(90×210)으로 먼저 생긴다 */
  function addRow() {
    const next: WallpaperOpening = { kind: 'door', w: DEFAULT_DOOR_CM.w, h: DEFAULT_DOOR_CM.h, count: 1 };
    onChange([...openings, next]);
  }

  /** 줄 삭제 */
  function removeRow(index: number) {
    onChange(openings.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 줄이 하나라도 있을 때만 칸 이름 줄을 보여 준다(아래 숫자칸 3개와 같은 비율로 맞춘다).
          2026-09-30 검사관 10차 지적 — 360px 폭에서 "가로·세로"(3자리 + cm)가 "개수"(1~2자리
          + 개)보다 더 넓은 칸이 필요한데 셋 다 flex-1로 똑같이 나눠서 "210"의 "0"이 cm
          글자와 겹쳐 잘려 보였다. 개수 칸을 좁히고 그만큼 가로·세로에 나눠 준다. */}
      {openings.length > 0 && (
        <div className="flex gap-2 text-[14px] text-v1-text-label">
          <span className="flex-[1.2] min-w-0">가로</span>
          <span className="flex-[1.2] min-w-0">세로</span>
          <span className="flex-[0.8] min-w-0">개수</span>
        </div>
      )}

      {openings.map((row, i) => {
        // 2026-09-30 지휘관 긴급 전달(중요 1) — 문·창 크기가 서버 범위(가로 10~1000cm ·
        // 세로 10~400cm)를 벗어나면 짧게 알려준다(값이 0이면 아직 안 적은 것이라 안 뜬다).
        const wCaption = rangeCaption(cmToDisplay(row.w) || '', OPENING_WIDTH_CM_MIN, OPENING_WIDTH_CM_MAX, 'cm');
        const hCaption = rangeCaption(cmToDisplay(row.h) || '', OPENING_HEIGHT_CM_MIN, OPENING_HEIGHT_CM_MAX, 'cm');
        return (
        <div key={i} className="flex flex-col gap-2">
          {/* 윗줄: 종류(문/창) 세그먼트 + 오른쪽 줄 삭제 × */}
          <div className="flex items-center gap-2">
            <Segment
              className="w-[150px] flex-none"
              options={[
                { value: 'door', label: '문' },
                { value: 'window', label: '창' },
              ]}
              value={row.kind}
              ariaLabel={`개구부 ${i + 1} 종류`}
              onChange={(v) => {
                // 창으로 바꿀 때, 아직 문 표준 규격 그대로면 창은 규격이 제각각이라 빈 칸으로 비워 준다
                if (v === 'window' && row.w === DEFAULT_DOOR_CM.w && row.h === DEFAULT_DOOR_CM.h) {
                  patchRow(i, { kind: 'window', w: 0, h: 0 });
                  return;
                }
                // 문으로 되돌릴 때, 비어 있으면 표준 문 규격(90×210)을 다시 채워 준다
                if (v === 'door' && row.w === 0 && row.h === 0) {
                  patchRow(i, { kind: 'door', w: DEFAULT_DOOR_CM.w, h: DEFAULT_DOOR_CM.h });
                  return;
                }
                patchRow(i, { kind: v });
              }}
            />
            <div className="flex-1" />
            {/* 시각은 작게, 터치 영역은 44px로 */}
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`${row.kind === 'door' ? '문' : '창'} 줄 삭제`}
              className="w-11 h-11 -mr-2 flex items-center justify-center text-v1-text-label"
            >
              <IconClose />
            </button>
          </div>

          {/* 아랫줄: 가로 cm · 세로 cm · 개수 — 위 칸 이름 줄과 같은 비율(1.2 : 1.2 : 0.8)로
              맞춘다(360px에서 세 자리 숫자가 cm과 겹치던 문제 수리, 2026-09-30 검사관 10차) */}
          <div className="flex gap-2">
            <NumberField
              className="flex-[1.2] min-w-0"
              aria-label="문·창 가로"
              suffix="cm"
              placeholder="가로"
              value={cmToDisplay(row.w)}
              onChange={(v) => patchRow(i, { w: displayToCm(v) })}
            />
            <NumberField
              className="flex-[1.2] min-w-0"
              aria-label="문·창 세로"
              suffix="cm"
              placeholder="세로"
              value={cmToDisplay(row.h)}
              onChange={(v) => patchRow(i, { h: displayToCm(v) })}
            />
            <NumberField
              className="flex-[0.8] min-w-0"
              aria-label="문·창 개수"
              suffix="개"
              placeholder="1"
              value={row.count === 0 ? '' : row.count}
              onChange={(v) => patchRow(i, { count: v === '' ? 0 : v })}
            />
          </div>
          {(wCaption || hCaption) && (
            <p className="t-sub text-danger">
              {[wCaption && `가로 ${wCaption}`, hCaption && `세로 ${hCaption}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        );
      })}

      {/* 줄 추가 — 참고 폼의 "+ 문·창문 추가"와 같은 자리. 새 줄은 문 90×210으로 시작한다 */}
      <button
        type="button"
        onClick={addRow}
        className="h-11 rounded-[4px] border border-dashed border-v1-line-3 text-[16px] text-v1-text-secondary"
      >
        + 문·창 추가
      </button>
    </div>
  );
}
