// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 페이지 (서버 컴포넌트)
//
// 하는 일: 서버 전용 제품 마스터(WALLPAPER_PRODUCTS)를 읽어 화면에 필요한 칸만
// 골라(코드·브랜드·이름·종류·폭·롤길이·리피트·가격·출처 라벨) 클라이언트 컴포넌트에
// props로 내려준다. 이 파일이 "src/server/** import 금지" 규칙의 유일한 예외다
// (제품 판매가는 이미 공개된 소비자가라 단가 유출 규칙과 무관하다 — 단가 산식 자체는
// src/server/pricing/wallpaper.ts에만 있고 여기엔 없다).
//
// 실제 폼·결과 화면은 WallpaperCalculator(클라이언트)가 그린다.
// useSearchParams(공유 링크 ?d= 복원)를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다.
//
// 제품 마스터 원본 → 화면용 목록 변환은 result/page.tsx와 같이 쓰는 순수 함수
// (toWallpaperProductOptions, src/lib/v1/wallpaperProductOptions.ts)로 뺐다.
//
// 2026년 09월 14일: SEO 보강 — 실제 폼(WallpaperCalculator)은 searchParams를 쓰는
// 클라이언트 컴포넌트라 Suspense fallback(null)이 정적 HTML로 굳는다. 검색엔진이 처음
// 받는 페이지가 사실상 빈 껍데기였다(진단: 본문 13자, H1 0개, JSON-LD 0개). 그래서
// 이 서버 컴포넌트(항상 그대로 그려지는 자리)에 진짜 H1·JSON-LD·SEO 본문 섹션을 심는다.
// H1은 TopNav의 모바일 제목 줄("도배 계산기", 클라이언트 컴포넌트 안이라 검색엔진용으로는
// 못 믿음)과 화면에서 겹쳐 보이지 않도록 sr-only로 둔다 — 글자는 그대로, 자리만 숨김.
//
// 작성일: 2026년 09월 08일
// 2026년 09월 09일: 제품 변환 로직을 wallpaperProductOptions.ts로 공유
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import WallpaperCalculator from './WallpaperCalculator';
import { WALLPAPER_PRODUCTS } from '@/server/calc/data/wallpaper-products';
import { toWallpaperProductOptions } from '@/lib/v1/wallpaperProductOptions';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/wallpaper`;
const H1_TEXT = '도배 계산기 — 벽지 몇 롤, 도배 비용 얼마';

export const metadata: Metadata = {
  title: '도배 계산기 — 벽지 몇 롤, 도배 비용 얼마 | 얼마드나',
  description: '평형 하나만 넣어도 벽지 롤 수와 도배 비용 범위가 바로 나와요. 실측을 더하면 더 정확해집니다. 로그인·개인정보 없이 무료.',
  alternates: { canonical: PAGE_URL },
};

// 계산 근거 설명 — 표준품셈·제조사 규격·2026년 노임단가 기준(200~300자)
const INTRO =
  '평형을 입력하면 62건 실측 평면 비율표로 방마다 벽·천장 면적을 추정하고, 벽지 폭·롤 길이·무늬 반복(리피트) 규격에 맞춰 롤 수와 로스를 계산해요. 초배지·퍼티 같은 부자재 물량은 표준품셈 기준으로 자동 산출하고, 2026년 노임단가로 도배공 품수를 매겨 합산합니다. 실측 치수를 직접 넣으면 평형 추정 대신 그 값을 그대로 써서 더 정확해져요.';

const FAQS: CalcFaqItem[] = [
  {
    q: '34평 도배하면 벽지 몇 롤 필요한가요?',
    a: '평형·베이·시공 범위에 따라 달라지는데, 34평(84타입) 3베이 기준 전체 도배면 실크 벽지로 보통 30~40롤 안팎이 나와요. 계산기에 평형만 넣어도 바로 범위로 나옵니다.',
  },
  {
    q: '합지와 실크 벽지는 뭐가 다른가요?',
    a: '합지는 종이 벽지라 저렴하고 시공이 간단하지만 내구성이 낮아요. 실크는 PVC 코팅이라 때가 덜 타고 오래가는 대신 초배 작업이 더 들어가 시공비가 높아요.',
  },
  {
    q: '천장도 포함해서 계산되나요?',
    a: '네, 벽만·천장만·벽+천장 범위를 고를 수 있고 기본값은 벽+천장 전체예요.',
  },
  {
    q: '기존 벽지 철거 비용도 포함되나요?',
    a: '철거 여부를 선택할 수 있고, 켜면 철거 비용이 결과에 합산돼서 나와요.',
  },
  {
    q: '결과 금액에 부가세가 포함되나요?',
    a: '화면에 나오는 금액은 부가세 포함 소비자가 기준의 범위 견적이에요. 실제 견적은 시공사마다 다를 수 있어요.',
  },
  {
    q: '평형은 공급 기준인가요?',
    a: '네, 칩으로 고르는 평형은 분양 공고에 쓰는 공급 평형이에요. 전용면적(등기부·관리비 고지서 기준)을 알면 ㎡ 단위로 바꿔서 직접 넣을 수 있고, 계산은 전용면적으로 해요.',
  },
];

const RELATED: CalcRelatedLink[] = [
  { href: '/blog/wallpaper-cost', label: '도배 비용 — 합지 vs 실크 평형별 가격과 견적 차이의 진짜 이유' },
  { href: '/blog/diamant-wallpaper-cost', label: '디아망 도배 가격 — 일반 실크와 평형별 실제 견적 차이' },
  { href: '/blog/partial-wallpaper-cost', label: '부분 도배 비용 — 벽 한 면부터 방 하나까지 실제 가격표' },
];

export default function WallpaperCalcPage() {
  // 제품 마스터(src/server/calc/data/wallpaper-products.ts, 18건 초안·형아 검수 대기 항목 포함)에서
  // 화면이 실제로 쓰는 칸만 뽑아 내려준다. 규격·가격이 미확인(null)인 제품도 그대로 넘기고,
  // 계산에 못 쓸 만큼 정보가 없는 제품은 PaperPicker가 "조사 중"으로 표시하며 거른다.
  const products = toWallpaperProductOptions(WALLPAPER_PRODUCTS);

  return (
    <>
      {/* 검색엔진용 진짜 H1 — 화면 자리는 안 차지하되(sr-only) 글자는 그대로 존재 */}
      <h1 className="sr-only">{H1_TEXT}</h1>

      <Suspense fallback={null}>
        <WallpaperCalculator products={products} />
      </Suspense>

      <CalcSeoSection intro={INTRO} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={softwareApplicationLd({
          name: '도배 계산기',
          description: metadata.description as string,
          url: PAGE_URL,
        })}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '도배 계산기' },
        ])}
      />
    </>
  );
}
