'use client';

// 견적서에 빠지기 쉬운 항목 — 접힌 칸. 계산값에는 영향 없음(확인용 목록).
const ITEMS: { name: string; q: string }[] = [
  { name: '입주청소', q: '공사 뒤 청소가 들어 있나요?' },
  { name: '보양', q: '엘리베이터·공용부 보양이 적혀 있나요?' },
  { name: '폐기물', q: '철거 폐기물 처리비가 따로 있나요?' },
  { name: '가스', q: '가스 배관 이전·막음 비용이 있나요?' },
  { name: '실리콘', q: '창호·욕실 실리콘 마감이 포함인가요?' },
  { name: '공과잡비', q: '현장관리·공과잡비가 얼마인지 적혀 있나요?' },
  { name: '부가세', q: '부가세 10%가 별도인지 포함인지 확인했나요?' },
];

export default function MissingChecklist() {
  return (
    <details className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 group">
      <summary className="text-xs font-bold text-brown cursor-pointer list-none flex items-center justify-between">
        견적서에 빠지기 쉬운 것
        <span className="text-gray-300 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <ul className="mt-3 space-y-2">
        {ITEMS.map(it => (
          <li key={it.name} className="text-xs text-gray-500">
            <span className="font-medium text-brown">{it.name}</span> · {it.q}
          </li>
        ))}
      </ul>
    </details>
  );
}
