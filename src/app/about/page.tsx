// 소개(About) 페이지 — 얼마드나가 무엇이고, 왜 만들었으며, 견적 데이터를
// 어떻게 만드는지 설명하는 신뢰(E-E-A-T) 페이지.
// 구글 애드센스가 요구하는 "누가·왜·어떤 근거로 운영하는가"를 밝혀 저품질 판정을 방지.
import type { Metadata } from 'next';
import Link from 'next/link';

// 검색엔진/애드센스 크롤러용 메타데이터
export const metadata: Metadata = {
  title: '얼마드나 소개 — 소비자 편에 선 인테리어 견적 서비스',
  description:
    '얼마드나는 실제 견적 데이터를 바탕으로, 로그인·연락처 없이 아파트 인테리어 예상 비용을 알려주는 무료 견적 서비스입니다. 업체 영업이 아닌 소비자를 위한 견적 도구를 지향합니다.',
  alternates: { canonical: 'https://ulmadna.com/about' },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
        {/* 홈으로 돌아가기 */}
        <Link href="/" className="text-sm text-gold hover:text-brown mb-8 inline-block">← 돌아가기</Link>
        <h1 className="text-2xl font-bold text-brown mb-2">얼마드나 소개</h1>
        <p className="text-sm text-gray-500 mb-8">소비자 편에 선 인테리어 견적 서비스</p>

        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-100 space-y-7 text-sm text-gray-600 leading-relaxed">
          {/* 우리가 누구인가 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">얼마드나는 어떤 서비스인가요?</h2>
            <p>
              얼마드나(ulmadna.com)는 <strong>아파트 인테리어 예상 견적을 무료로 알려주는 계산 서비스</strong>입니다.
              평형과 원하는 공사만 고르면, 로그인이나 연락처 입력 없이 우리 집 인테리어가 대략 얼마나 나올지
              30초 만에 확인할 수 있습니다.
            </p>
          </section>

          {/* 왜 만들었나 — 미션 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">왜 만들었나요?</h2>
            <p>
              인테리어 견적은 정보의 비대칭이 유난히 심한 분야입니다. 견적서를 받아봐도 항목이 두루뭉술하고,
              같은 34평(84타입) 공사인데도 업체마다 수천만 원씩 차이가 나서 &ldquo;이게 적정한 가격인지&rdquo;
              소비자가 판단하기 어렵습니다.
            </p>
            <p className="mt-2">
              시중의 많은 &lsquo;무료 견적&rsquo; 서비스는 사실 <strong>소비자의 연락처를 모아 업체에 넘기는 영업 도구</strong>입니다.
              얼마드나는 반대입니다. <strong>연락처를 받지 않고, 업체에 정보를 넘기지도 않습니다.</strong>
              오직 소비자가 &lsquo;대략적인 시세&rsquo;를 먼저 알고 협상 테이블에 앉을 수 있도록 돕는 것이 목표입니다.
            </p>
          </section>

          {/* 견적 근거 — 데이터 방법론 (E-E-A-T 핵심) */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">견적 금액은 어떤 근거로 나오나요?</h2>
            <p>
              얼마드나의 예상 견적은 <strong>실제 인테리어 견적서 데이터(1,000건+)</strong>에서 공정별 단가와
              평형별 물량을 추출해 산출합니다. 단순히 &lsquo;평당 얼마&rsquo;로 곱하는 방식이 아니라, 창호·도배·바닥·욕실 등
              공정별로 실제 시장에서 형성된 시세 범위를 반영합니다.
            </p>
            <p className="mt-2">
              블로그의 비용 정보 역시 같은 데이터와 현행 공사 단가를 근거로 작성합니다. 다만 실제 계약가는
              현장 상황, 자재 등급, 시공 업체, 지역, 자재 수급에 따라 달라지므로 <strong>모든 금액은 참고용 예상치</strong>입니다.
              계약 전에는 반드시 정식 견적서를 받아 비교하시기 바랍니다.
            </p>
          </section>

          {/* 무엇을 제공하나 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">무엇을 제공하나요?</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>무료 견적 계산기</strong> — 평형·공사 선택만으로 예상 비용 확인</li>
              <li><strong>인테리어 비용·가이드 블로그</strong> — 공정별 단가, 업체 고르는 법, 시공 순서, 하자 검수 등 실전 정보</li>
              <li><strong>숨은 비용 안내</strong> — 견적서에서 놓치기 쉬운 철거비·부가세·추가금 체크포인트</li>
            </ul>
          </section>

          {/* 운영 주체 — 신뢰 정보 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">운영 정보</h2>
            <p>
              얼마드나는 인테리어 견적 데이터를 다루는 사업자가 직접 운영합니다. 광고(배너·애드센스)와 스폰서 제휴로
              서비스를 무료로 유지하며, 광고는 콘텐츠와 명확히 구분해 표시합니다.
            </p>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              상호: 얼마드나 · 대표: 김지환<br />
              사업자등록번호: 565-58-00717<br />
              문의: <a href="mailto:cs870@naver.com" className="text-gold hover:text-brown">cs870@naver.com</a>
            </p>
          </section>

          {/* 관련 링크 */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <Link href="/contact" className="text-gold hover:text-brown">문의하기</Link>
            <Link href="/blog" className="text-gold hover:text-brown">블로그</Link>
            <Link href="/privacy" className="text-gold hover:text-brown">개인정보처리방침</Link>
            <Link href="/terms" className="text-gold hover:text-brown">이용약관</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
