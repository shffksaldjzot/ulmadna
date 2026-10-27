// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 페이지(서버 컴포넌트) — /calc/tile-pro
//
// 화면은 TileProCalculator(클라이언트)가 그린다. 이 파일은 검색 노출을 맡는다:
//   제목·설명·og, 검색엔진용 H1(sr-only), 아래 접힘 칸(쓰는 법·계산 방식)·FAQ, 구조화 데이터.
// 금액은 다루지 않는다(물량 전용). 소비자용 견적 계산기는 /calc/tile.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import TileProCalculator from './TileProCalculator';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink, type CalcSeoExtraSection } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/tile-pro`;

/** 검색 결과 제목 */
const TITLE = '타일 물량 계산기 — 타일 배치도·컷 장 수·박스 수 | 얼마드나';
/** 검색 결과 설명(150자 안) */
const DESCRIPTION =
  '타일 물량 계산기 — 방 치수와 문·창을 넣으면 타일 배치도를 그려 온장·컷 장 수, 로스율, 박스 수, 줄눈재·압착시멘트 수량을 뽑아요. 바닥·벽 전개도, 일자·지그재그·대각 패턴. 도면 PNG 저장. 로그인 없이 무료.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: '타일 물량 계산기 — 타일 배치도·컷 장 수·박스 수',
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: '얼마드나',
    locale: 'ko_KR',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '얼마드나 — 무료 인테리어 견적 계산기' }],
    type: 'website',
  },
};

/** 계산 근거(검색엔진이 처음 받는 본문) */
const INTRO =
  '방 모양(사각형·ㄱ자·자유형)을 mm로 넣고 문·창 자리를 넣으면, 고른 규격·줄눈·패턴·시작 기준대로 타일을 한 장씩 깔아 봐요. 구역 안에 통째로 들어가는 타일은 온장, 벽 끝이나 문틀에 걸려 잘라야 하는 타일은 컷으로 세요. 자른 조각의 가로·세로가 다른 컷 자리에 실제로 들어맞으면 자투리로 다시 쓰고, 파손 여유를 더해 필요 장 수와 박스 수를 내요. 벽은 벽마다 길이×시공 높이 전개도로 깔고 문·창 넓이를 빼요. 줄눈재는 (가로+세로)÷(가로×세로)×줄눈 폭×두께×비중 1.6에 로스 20%, 압착시멘트는 ㎡당 5.5kg(600 이상 대형 7.5kg)으로 잡아요.';

const FAQS: CalcFaqItem[] = [
  {
    q: '타일 컷 장 수는 어떻게 세나요?',
    a: '타일을 실제 도면 위에 한 장씩 깔아 보고, 방 안에 99.5% 이상 들어가면 온장, 그보다 덜 들어가면 컷으로 세요. 시작 기준을 가운데로 하면 양쪽 끝이 대칭으로 잘려 컷이 늘고, 모서리(기본)로 하면 한쪽 끝에 몰려요. 그림에서 주황색 타일이 컷 자리예요.',
  },
  {
    q: '타일 로스율은 보통 몇 %인가요?',
    a: '같은 방이라도 규격·패턴·시작 기준에 따라 달라요. 넓은 방에 일자로 붙이면 5% 안팎, 대각은 10~15%, 좁은 욕실에 큰 타일을 붙이면 30%를 넘기도 해요. 이 계산기는 정해진 비율을 곱하지 않고 실제로 깔아 본 결과로 로스율을 내요.',
  },
  {
    q: '자투리 재사용은 무엇인가요?',
    a: '한쪽 끝에서 자르고 남은 조각을 다른 컷 자리에 쓰는 것이에요. 기본 "같은 치수"는 조각의 가로·세로가 실제로 들어맞을 때만 써요(칼날 3mm 포함, 돌리지 않음). 예를 들어 294mm 띠 두 개는 600mm 타일 한 장에서 나와요. "넓이 기준"은 모양을 안 보고 넓이로만 맞춰 보는 낙관값이고, "안 씀"은 컷 자리마다 새 타일 1장이에요.',
  },
  {
    q: '줄눈재는 몇 kg 필요한가요?',
    a: '㎡당 줄눈재 = (타일 가로+세로)÷(가로×세로)×줄눈 폭×줄눈 깊이(타일 두께)×1.6이에요. 300×600 타일, 줄눈 2mm, 두께 9mm면 ㎡당 약 0.14kg이고 로스 20%를 더해요. 줄눈이 넓고 타일이 작을수록 많이 들어요.',
  },
];

const EXTRA_SECTIONS: CalcSeoExtraSection[] = [
  {
    title: '타일 물량 계산기 쓰는 법',
    content: (
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>바닥·벽을 고르고 방 모양과 치수(mm)를 넣어요.</li>
        <li>문·창은 벽 번호와 벽 시작에서 거리, 폭으로 넣어요. 벽 번호는 도면의 동그라미 숫자예요.</li>
        <li>타일 규격·패턴·시작 기준·줄눈을 고르면 배치도와 물량표가 바로 바뀌어요.</li>
        <li>도면 PNG 저장으로 현장에 보내거나 링크 복사로 같은 입력값을 공유해요.</li>
      </ol>
    ),
  },
];

const RELATED: CalcRelatedLink[] = [{ href: '/calc/tile', label: '타일 시공 견적 계산기(비용)' }];

export default function TileProPage() {
  return (
    <>
      {/* 검색엔진용 진짜 H1 — 제목줄은 as="p"라 페이지 H1은 이것 하나 */}
      <h1 className="sr-only">타일 물량 계산기 — 타일 배치도·컷 장 수·박스 수</h1>

      <Suspense fallback={null}>
        <TileProCalculator />
      </Suspense>

      <CalcSeoSection intro={INTRO} sections={EXTRA_SECTIONS} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={{
          ...softwareApplicationLd({ name: '타일 물량 계산기', description: DESCRIPTION, url: PAGE_URL }),
          '@type': 'WebApplication',
          alternateName: ['타일 수량 계산기', '타일 배치 계산기', '타일 컷 계산기', '타일 로스 계산기'],
          inLanguage: 'ko-KR',
          browserRequirements: 'JavaScript 필요',
        }}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '타일 물량 계산기', href: '/calc/tile-pro' },
        ])}
      />
    </>
  );
}
