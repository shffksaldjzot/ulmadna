// 광고 서비스 이용약관 (2026-10-28 신설, 결제사 심사 대비).
// [주의] 법률 문구 초안 — 형아 확인 뒤 확정. 이용약관 페이지와 같은 틀을 재사용한다.
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';
import BusinessInfo from '@/components/layout/BusinessInfo';

export const metadata: Metadata = {
  title: '광고 서비스 이용약관 | 얼마드나',
  description: '얼마드나 광고 서비스의 내용, 게재 기간, 결제, 배너 심사 기준, 해지와 책임 범위를 안내합니다.',
  alternates: { canonical: '/ads-terms' },
};

export default function AdsTermsPage() {
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <div className="max-w-3xl py-12">
          <h1 className="t-page text-ink mb-8">광고 서비스 이용약관</h1>

          <div className="bg-surface rounded-card p-6 lg:p-8 border border-line space-y-6 t-body text-ink-2 leading-relaxed">
            <section>
              <h2 className="t-section text-ink mb-2">제1조 (목적)</h2>
              <p>이 약관은 도토리 스튜디오(이하 &ldquo;판매자&rdquo;)가 운영하는 얼마드나(ulmadna.com)에서 판매하는 배너·스폰서·견적서 추천 업체 광고(이하 &ldquo;광고 서비스&rdquo;)의 이용 조건과 절차를 정함을 목적으로 합니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제2조 (서비스 내용)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>헤더 하단 배너(시도당 3개 업체), 계산 결과 옆 배너(시도당 3개 업체), 공정 스폰서 배너(시도·공정당 3개 업체), 견적서 추천 업체(견적서 안 공정마다 여러 업체)를 판매합니다.</li>
                <li>각 상품의 위치·규격·요금은 <Link href="/sponsor" className="text-accent hover:text-ink">광고 안내 페이지</Link>에 표시된 내용에 따릅니다.</li>
                <li>모든 광고에는 &ldquo;광고&rdquo; 표시가 붙으며, 같은 상품 안에서 여러 업체가 순서를 바꿔 가며 노출될 수 있습니다.</li>
                <li>노출 수·클릭 수·문의 수·매출 등 광고 성과는 보장하지 않습니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제3조 (게재 기간)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>광고 기간은 30일 단위이며, 30일의 배수로 신청할 수 있습니다.</li>
                <li>게재 시작일은 결제 완료 후 배너 심사를 통과해 실제로 게재된 날이며, 종료일은 시작일로부터 신청한 일수가 지난 날입니다.</li>
                <li>기간을 이어서 게재하려면 종료 전에 다시 결제해야 하며, 자동으로 연장·결제되지 않습니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제4조 (요금과 결제)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>요금은 30일 기준이며 부가세 별도입니다.</li>
                <li>결제는 신청한 전체 기간 요금을 한 번에 내는 일시불이며, 계좌이체 또는 카드 결제로 할 수 있습니다(카드 결제는 준비되는 대로 제공).</li>
                <li>카드 결제는 판매자가 지정한 결제대행사(PG)의 결제창에서 이루어지며 카드 매출전표가 증빙이 됩니다. 계좌이체는 세금계산서를 발행합니다.</li>
                <li>환불은 <Link href="/refund" className="text-accent hover:text-ink">환불 규정</Link>에 따릅니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제5조 (배너 심사 기준)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>배너는 게재 전 판매자의 심사를 거치며, 승인되기 전에는 게재되지 않습니다.</li>
                <li>규격(크기·용량·파일 형식)에 맞아야 하며, 글자는 읽을 수 있어야 합니다.</li>
                <li>다음 내용은 게재할 수 없습니다. 허위·과장 광고(예: 근거 없는 &ldquo;최저가 보장&rdquo;), 타사 비방, 음란·불법 내용, 타인의 상표·저작물 무단 사용, 팝업·자동재생·깜빡임 등 이용을 방해하는 방식, 연결 주소가 안전한 주소(https)가 아닌 경우.</li>
                <li>광고주는 배너와 연결 페이지의 내용에 대해 법령상 책임을 집니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제6조 (게재 거절·중단)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>판매자는 제5조의 기준에 맞지 않거나 관련 법령·제3자의 권리를 침해할 우려가 있는 광고의 게재를 거절하거나, 게재 중이라도 중단할 수 있습니다.</li>
                <li>거절 사유는 광고주에게 알리며, 고칠 수 있는 경우 수정 후 다시 심사를 요청할 수 있습니다.</li>
                <li>판매자 사정(서비스 장애, 운영 종료 등)으로 게재하지 못한 기간은 환불 규정에 따라 환불하거나 같은 기간만큼 연장합니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제7조 (중도 해지)</h2>
              <p>광고주는 언제든지 해지를 요청할 수 있으며, 환불 금액은 환불 규정에 따라 계산합니다. 광고주의 귀책으로 약관을 위반해 게재가 중단된 경우에는 환불하지 않을 수 있습니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제8조 (책임 제한)</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>판매자는 천재지변, 통신·서버 장애, 검색·광고 정책 변경 등 판매자가 통제할 수 없는 사유로 인한 게재 지연·중단에 책임지지 않습니다. 다만 이로 인해 게재하지 못한 기간은 제6조 제3항에 따라 처리합니다.</li>
                <li>판매자는 광고주와 이용자 사이의 거래·시공·분쟁에 관여하지 않으며 이에 책임지지 않습니다.</li>
                <li>판매자의 손해배상 책임은 해당 광고에 대해 광고주가 실제로 낸 요금을 넘지 않습니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">제9조 (분쟁 해결)</h2>
              <p>이 약관과 관련한 분쟁은 먼저 서로 협의해 풀며, 협의가 되지 않으면 대한민국 법을 적용하고 민사소송법에 따른 관할 법원에서 해결합니다. 문의는 아래 연락처로 해 주세요.</p>
            </section>

            <div className="pt-4 border-t border-line space-y-2">
              <p className="t-sub text-ink-2">시행일: 2026년 10월 28일 · 판매자: 도토리 스튜디오</p>
              <BusinessInfo />
            </div>
          </div>
        </div>
      </Container>
      <SiteFooter />
    </>
  );
}
