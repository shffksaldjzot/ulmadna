// ──────────────────────────────────────────────
// v1 허브 — 지역 선택 칸 + 바텀시트
// 입력칸을 누르면 바텀시트가 열리고, 시도별로 묶인 시군구 목록에서 하나를 고른다.
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { IconChevronDown } from './icons';
import { REGION_GROUPS } from '@/lib/v1/regions';

interface RegionPickerProps {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}

export default function RegionPicker({ value, onChange }: RegionPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[52px] w-full bg-white border border-v1-line-3 rounded-[4px] flex items-center justify-between px-[14px]"
      >
        <span className={`text-[16px] ${value ? 'text-foreground' : 'text-v1-text-disabled'}`}>
          {value ?? '시군구 선택'}
        </span>
        <IconChevronDown className="text-v1-text-label" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="지역 선택">
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
          className="h-12 flex items-center text-[16px] text-v1-text-secondary border-b border-v1-line-2"
        >
          선택 안 함
        </button>
        <div className="flex flex-col">
          {REGION_GROUPS.map((group) => (
            <div key={group.sido} className="py-2">
              <div className="text-[16px] font-semibold text-v1-text-label px-1 py-1">{group.sido}</div>
              <div className="flex flex-wrap gap-2 px-1">
                {group.gu.map((gu) => {
                  const label = `${group.sido} ${gu}`;
                  const selected = value === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onChange(label);
                        setOpen(false);
                      }}
                      className={
                        'h-11 px-4 rounded-full text-[16px] transition-colors duration-150 ' +
                        (selected
                          ? 'bg-brown text-white font-semibold'
                          : 'bg-white border border-v1-line-3 text-v1-text-secondary')
                      }
                    >
                      {gu}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
