// ──────────────────────────────────────────────
// 관리자 · 광고 자리 (보기 전용 뼈대) — 2026-10-28
//
// [무슨 기능인가]
//   계획안의 "지역 슬롯판"(시도 17곳 × 슬롯 4종)을 빈 판으로만 보여준다.
//   광고주·배너·노출 집계 표가 아직 없어서 모든 칸이 "빈칸"이다. 편집·저장 기능은 없다.
//   슬롯 종류는 src/lib/ads/types.ts 의 기준(AD-H·AD-R·AD-P·AD-F)과 같다.
// ──────────────────────────────────────────────
import { SIDO_CODES, REGION_NAMES } from '@/server/admin/format';
import { Card, PageHead } from '../_ui';

/** 슬롯 4종(이름·규격) */
const SLOTS = [
  { id: 'AD-H', name: '홈 가로', size: '320×100' },
  { id: 'AD-R', name: '결과 네모', size: '300×250' },
  { id: 'AD-P', name: '공정별', size: '320×50' },
  { id: 'AD-F', name: '하단 고정', size: '320×50' },
];

export default function AdsPage() {
  return (
    <div>
      <PageHead title="광고 자리" note="보기 전용 — 광고주·배너 표가 생기면 칸에 채워져요" />
      <Card>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 px-2 text-left text-[11px] font-medium text-gray-400">지역</th>
                {SLOTS.map((s) => (
                  <th key={s.id} className="py-2 px-2 text-center text-[11px] font-medium text-gray-400 whitespace-nowrap">
                    {s.id}<br /><span className="text-gray-300">{s.name} {s.size}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIDO_CODES.map((c) => (
                <tr key={c} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{REGION_NAMES[c]}</td>
                  {SLOTS.map((s) => (
                    <td key={s.id} className="py-1.5 px-2 text-center">
                      <span className="inline-block w-full rounded-md border border-dashed border-gray-200 py-1 text-[11px] text-gray-300">빈칸</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
