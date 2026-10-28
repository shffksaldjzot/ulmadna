// 환불 규정 (2026-10-28 신설, 결제사 심사 대비).
// [주의] 계획안에 환불 규정이 없어 토리가 쓴 초안 — 형아 확인 뒤 확정. 약관 페이지 틀 재사용.
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';
import BusinessInfo from '@/components/layout/BusinessInfo';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = {
  title: '환불 규정 | 얼마드나',
  description: '얼마드나 광고 서비스의 환불 기준과 절차를 안내합니다.',
  alternates: { canonical: '/refund' },
};

export default function RefundPage() {
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <div className="max-w-3xl py-12">
          <h1 className="t-page text-ink mb-8">환불 규정</h1>

          <div className="bg-surface rounded-card p-6 lg:p-8 border border-line space-y-6 t-body text-ink-2 leading-relaxed">
            <section>
              <h2 className="t-section text-ink mb-2">1. 적용 범위</h2>
              <p>도토리 스튜디오가 얼마드나에서 판매하는 광고 서비스(<Link href="/ads-terms" className="text-accent hover:text-ink">광고 서비스 이용약관</Link> 참고)의 결제 취소와 환불에 적용합니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">2. 환불 기준</h2>
              <div className="overflow-x-auto">
                <table className="w-full t-sub border border-line">
                  <thead className="bg-bg">
                    <tr>
                      <th className="text-left px-3 py-2">시점</th>
                      <th className="text-left px-3 py-2">환불</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-line"><td className="px-3 py-2">게재 시작 전</td><td className="px-3 py-2">전액 환불</td></tr>
                    <tr className="border-t border-line"><td className="px-3 py-2">게재 시작 후 7일 이내</td><td className="px-3 py-2">남은 일수만큼 일 단위로 계산해 환불</td></tr>
                    <tr className="border-t border-line"><td className="px-3 py-2">게재 시작 후 7일 지난 뒤</td><td className="px-3 py-2">환불 불가</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2">남은 일수 환불액 = 결제한 요금 ÷ 신청한 전체 일수 × 남은 일수. 게재 시작일은 배너가 실제로 게재된 날입니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">3. 배너 제작비</h2>
              <p>배너 제작을 대행으로 신청한 경우 제작비는 제작에 착수한 뒤에는 환불되지 않습니다. 착수 전에는 전액 환불합니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">4. 판매자 사유로 인한 환불</h2>
              <p>판매자의 사정으로 게재하지 못했거나 배너 심사에서 거절되어 게재할 수 없는 경우, 게재하지 못한 기간만큼(게재 전이면 전액) 환불합니다. 광고주가 약관을 위반해 게재가 중단된 경우에는 환불하지 않을 수 있습니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">5. 환불 절차</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>전화 {BUSINESS.phone} 또는 이메일 {BUSINESS.email}로 환불을 요청해 주세요(업체명·결제 일시 기재).</li>
                <li>요청 확인 후 영업일 기준 3일 안에 카드 결제 취소를 진행합니다. 카드사 사정에 따라 취소가 화면에 반영되기까지 며칠 더 걸릴 수 있습니다.</li>
              </ol>
            </section>

            <div className="pt-4 border-t border-line space-y-2">
              <p className="t-sub text-ink-2/70">시행일: 2026년 10월 28일 · 판매자: 도토리 스튜디오</p>
              <BusinessInfo />
            </div>
          </div>
        </div>
      </Container>
      <SiteFooter />
    </>
  );
}
