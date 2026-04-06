import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: '얼마드나 — 광고/제휴 안내 | 인테리어 견적 계산기 스폰서',
  description: '월 방문자 타겟 광고로 인테리어 고객에게 직접 도달하세요. 지역권 타겟, 공정별 스폰서, PDF 견적서 내 광고.',
};

const AD_SLOTS = [
  {
    id: 'AD-H',
    name: '헤더 하단 리더보드',
    size: '728×90',
    position: '페이지 최상단',
    target: '지역권 타겟',
    price: '3~8만원/월 (지역별)',
    desc: '사용자가 가장 먼저 보는 위치. IP 기반으로 해당 지역 업체만 노출됩니다.',
    mockup: (
      <div className="border border-dashed border-brown/20 rounded-lg p-3 bg-cream/50 text-center">
        <p className="text-[8px] text-gray-400 text-left">광고</p>
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="w-8 h-8 bg-brown/10 rounded-full" />
          <div className="text-left">
            <p className="text-xs font-medium text-brown">○○인테리어 — 남양주 No.1 시공 전문</p>
            <p className="text-[10px] text-gray-400">무료 상담 1588-XXXX</p>
          </div>
          <span className="text-[10px] bg-gold text-white px-2 py-0.5 rounded-full">견적 받기 →</span>
        </div>
      </div>
    ),
  },
  {
    id: 'AD-P',
    name: '공정별 스폰서 배너',
    size: '468×60',
    position: '입력 패널 공정 사이',
    target: '공정별 브랜드 스폰서',
    price: '5~15만원/월 (공정별)',
    desc: '사용자가 해당 공정을 선택할 때 자연스럽게 노출. 창호 옆에 KCC, 욕실 옆에 대림 등.',
    mockup: (
      <div className="border border-dashed border-brown/20 rounded-lg p-2 bg-cream/50">
        <p className="text-[8px] text-gray-400">광고</p>
        <div className="flex items-center gap-2 py-1">
          <div className="w-6 h-6 bg-brown/10 rounded" />
          <p className="text-[10px] text-gray-600">LX Z:IN 창호는 LX로 — 에너지등급 1등급 보장</p>
          <span className="text-[9px] text-gold ml-auto">자세히 →</span>
        </div>
      </div>
    ),
  },
  {
    id: 'AD-R',
    name: '결과 패널 렉탱글',
    size: '300×250',
    position: '견적 결과 영역',
    target: '지역권 타겟',
    price: '3~8만원/월 (지역별)',
    desc: '견적 결과를 확인하는 사용자에게 노출. 가장 구매 의향이 높은 시점입니다.',
    mockup: (
      <div className="border border-dashed border-brown/20 rounded-lg p-3 bg-cream/50 w-48 mx-auto">
        <p className="text-[8px] text-gray-400">광고</p>
        <div className="w-full h-16 bg-brown/5 rounded my-2 flex items-center justify-center text-[10px] text-gray-300">시공 사례 이미지</div>
        <p className="text-xs font-medium text-brown text-center">○○인테리어</p>
        <p className="text-[10px] text-gray-400 text-center">화도·남양주 전문 · 시공사례 200건+</p>
        <div className="mt-2 text-center">
          <span className="text-[10px] bg-gold text-white px-3 py-1 rounded-full">무료 상담 →</span>
        </div>
      </div>
    ),
  },
  {
    id: 'AD-PDF',
    name: 'PDF/엑셀 견적서 내 광고',
    size: '견적서 하단',
    position: '다운로드 견적서',
    target: '지역권 추천업체',
    price: '1~3만원/월 (지역별)',
    desc: '사용자가 다운받아 저장·공유하는 견적서 하단에 지역 추천업체 리스트가 포함됩니다. 엑셀은 별도 시트로 제공.',
    mockup: (
      <div className="border border-dashed border-brown/20 rounded-lg p-3 bg-cream/50 text-[10px]">
        <p className="text-gray-400 mb-2">📍 [남양주/구리 지역] 추천 인테리어 업체</p>
        <div className="space-y-1">
          <p className="text-gray-600">1. ○○인테리어 | 1588-XXXX | 시공사례 200건+</p>
          <p className="text-gray-600">2. △△디자인 | 010-XXXX | 강마루 전문</p>
          <p className="text-gray-600">3. □□홈 | 031-XXX | 욕실 리모델링</p>
        </div>
        <p className="text-gray-300 mt-2">※ 광고 제휴 업체입니다</p>
      </div>
    ),
  },
];

const STATS = [
  { value: '24', label: '공정 카테고리' },
  { value: '51+', label: '지역권 타겟 가능' },
  { value: '12', label: '광고 슬롯 (PC+모바일+PDF)' },
  { value: '₩1만~', label: '월 최소 광고비' },
];

export default function SponsorPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/ulmadna_logo.png" alt="얼마드나" width={100} height={34} />
          </Link>
          <a
            href="mailto:cs870@naver.com?subject=[얼마드나] 스폰서 광고 문의"
            className="bg-brown text-white text-xs px-4 py-2 rounded-full hover:bg-brown/90 transition-colors"
          >
            광고 문의하기
          </a>
        </div>
      </header>

      {/* 히어로 */}
      <section className="bg-cream py-16 lg:py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-gold tracking-widest mb-4">얼마드나 광고 파트너 안내</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-brown leading-tight mb-4">
            인테리어를 준비하는 고객에게<br />
            당신의 브랜드를 보여주세요
          </h1>
          <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
            얼마드나는 회원가입 없이 누구나 쓰는 무료 인테리어 견적 계산기입니다.
            매일 인테리어를 알아보는 실수요자가 방문하며,
            지역과 공정에 맞춰 당신의 광고만 보여줍니다.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              href="mailto:cs870@naver.com?subject=[얼마드나] 스폰서 광고 문의"
              className="bg-brown text-white text-sm px-6 py-3 rounded-full hover:bg-brown/90 transition-colors"
            >
              광고 문의하기
            </a>
            <a
              href="#slots"
              className="text-sm text-brown border border-brown px-6 py-3 rounded-full hover:bg-cream transition-colors"
            >
              광고 상품 보기
            </a>
            <a
              href="/sponsor/preview"
              className="text-sm text-gold border border-gold px-6 py-3 rounded-full hover:bg-gold/5 transition-colors"
            >
              실제 적용 미리보기 →
            </a>
          </div>
        </div>
      </section>

      {/* 왜 얼마드나인가 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-10">왜 얼마드나에 광고하나요?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">🎯</p>
              <h3 className="font-bold text-brown mb-2">실수요자만 방문합니다</h3>
              <p className="text-sm text-gray-500">인테리어 견적을 알아보는 사람만 옵니다. 구경하는 트래픽이 아니라 실제로 시공을 준비하는 고객입니다.</p>
            </div>
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">📍</p>
              <h3 className="font-bold text-brown mb-2">지역 타겟이 됩니다</h3>
              <p className="text-sm text-gray-500">서울 강남 사용자에게는 강남 업체 광고를, 남양주 사용자에게는 남양주 업체 광고를 보여줍니다. IP 기반 자동 타겟.</p>
            </div>
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">📄</p>
              <h3 className="font-bold text-brown mb-2">견적서에 함께 갑니다</h3>
              <p className="text-sm text-gray-500">PDF/엑셀 견적서를 다운받으면 하단에 추천 업체로 노출됩니다. 견적서가 공유될 때마다 자연스럽게 확산.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="bg-brown py-12 px-4">
        <div className="max-w-5xl mx-auto flex justify-center gap-12 lg:gap-20">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-gold">{s.value}</p>
              <p className="text-xs text-cream/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 광고 상품 */}
      <section id="slots" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-3">광고 상품 안내</h2>
          <p className="text-sm text-gray-400 text-center mb-10">모든 배너에 &ldquo;광고&rdquo; 라벨이 표시되며, 팝업/자동재생 광고는 없습니다</p>

          <div className="space-y-8">
            {AD_SLOTS.map(slot => (
              <div key={slot.id} className="bg-cream rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] bg-brown text-white px-2 py-0.5 rounded-full">{slot.id}</span>
                    <h3 className="text-base font-bold text-brown">{slot.name}</h3>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    <p><span className="text-gray-400">사이즈:</span> {slot.size}px</p>
                    <p><span className="text-gray-400">위치:</span> {slot.position}</p>
                    <p><span className="text-gray-400">타겟:</span> {slot.target}</p>
                    <p><span className="text-gray-400">가격:</span> <span className="text-gold font-medium">{slot.price}</span></p>
                  </div>
                  <p className="text-xs text-gray-500">{slot.desc}</p>
                </div>
                <div className="lg:w-[300px] shrink-0">
                  <p className="text-[10px] text-gray-400 mb-2">배너 미리보기</p>
                  {slot.mockup}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 배너 위치 맵 */}
      <section className="bg-cream py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-3">광고 위치 맵</h2>
          <p className="text-sm text-gray-400 text-center mb-8">데스크톱과 모바일에서 광고가 이렇게 보입니다</p>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* 데스크톱 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-brown mb-3">데스크톱 (6개 슬롯)</p>
              <div className="space-y-2 text-[10px]">
                <div className="bg-gold/10 border border-gold/20 rounded p-2 text-center text-gold">AD-H · 728×90 · 헤더 하단</div>
                <div className="flex gap-2">
                  <div className="flex-[6] space-y-2">
                    <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">입력 패널</div>
                    <div className="bg-gold/10 border border-gold/20 rounded p-1.5 text-center text-gold">AD-P1 · 468×60</div>
                    <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">공정 리스트</div>
                    <div className="bg-gold/10 border border-gold/20 rounded p-1.5 text-center text-gold">AD-P2 · 468×60</div>
                  </div>
                  <div className="flex-[4] space-y-2">
                    <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">결과 패널</div>
                    <div className="bg-gold/10 border border-gold/20 rounded p-3 text-center text-gold">AD-R1<br/>300×250</div>
                    <div className="bg-gold/10 border border-gold/20 rounded p-3 text-center text-gold">AD-R2<br/>300×250</div>
                  </div>
                </div>
                <div className="bg-gold/10 border border-gold/20 rounded p-2 text-center text-gold">AD-F · 728×90 · 푸터 상단</div>
              </div>
            </div>

            {/* 모바일 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-brown mb-3">모바일 (4개 슬롯)</p>
              <div className="max-w-[200px] mx-auto space-y-2 text-[10px]">
                <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">헤더 + 기본조건</div>
                <div className="bg-gray-50 rounded p-1.5 text-gray-400 text-center">총 금액</div>
                <div className="bg-gold/10 border border-gold/20 rounded p-1.5 text-center text-gold">AD-M1 · 320×100</div>
                <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">공정 리스트</div>
                <div className="bg-gold/10 border border-gold/20 rounded p-1.5 text-center text-gold">AD-M2 · 320×100</div>
                <div className="bg-gray-50 rounded p-2 text-gray-400 text-center">공정 리스트</div>
                <div className="bg-gold/10 border border-gold/20 rounded p-1.5 text-center text-gold">AD-M3 · 320×100</div>
                <div className="bg-gray-50 rounded p-1.5 text-gray-400 text-center">결과 + PDF</div>
                <div className="bg-gold/10 border border-gold/20 rounded p-1 text-center text-gold">AD-M4 · 320×50</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 가격표 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-8">가격표</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3">상품</th>
                  <th className="text-left px-5 py-3">슬롯</th>
                  <th className="text-left px-5 py-3">타겟</th>
                  <th className="text-right px-5 py-3">월 단가</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['전국 리더보드', 'AD-H', '전국', '20~50만원'],
                  ['지역권 리더보드', 'AD-H', '1개 지역', '3~8만원'],
                  ['공정별 스폰서', 'AD-P', '1개 공정', '5~15만원'],
                  ['지역권 렉탱글', 'AD-R', '1개 지역', '3~8만원'],
                  ['모바일 지역권', 'AD-M', '1개 지역', '2~5만원'],
                  ['PDF 추천업체', 'AD-PDF', '1개 지역', '1~3만원'],
                  ['PDF 상단 로고', 'AD-PDF-H', '전국', '10~30만원'],
                ].map(([name, slot, target, price], i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{name}</td>
                    <td className="px-5 py-3 text-gray-400">{slot}</td>
                    <td className="px-5 py-3 text-gray-400">{target}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gold">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-300 text-center mt-3">트래픽 성장에 따라 단가가 조정될 수 있습니다</p>
        </div>
      </section>

      {/* 디자인 규칙 */}
      <section className="bg-cream py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-8">광고 디자인 규칙</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-brown mb-3">허용</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 흰색 또는 크림 배경</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 로고 + 업체명 + 한 줄 카피</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> CTA 버튼 1개</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 시공 사례 이미지</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 둥근 모서리 (8px)</li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-brown mb-3">금지</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 팝업/전면 광고</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 자동 재생 동영상</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 원색/형광 배경</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 깜빡이는 애니메이션</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 콘텐츠를 가리는 오버레이</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl font-bold text-brown mb-3">광고 문의</h2>
        <p className="text-sm text-gray-500 mb-6">아래 이메일로 문의해 주시면 1영업일 내 회신 드립니다</p>
        <a
          href="mailto:cs870@naver.com?subject=[얼마드나] 스폰서 광고 문의"
          className="inline-block bg-brown text-white text-sm px-8 py-3 rounded-full hover:bg-brown/90 transition-colors"
        >
          cs870@naver.com 으로 문의하기
        </a>
        <p className="text-xs text-gray-300 mt-4">제출 항목: 배너 이미지 + 클릭 URL + 업체명 + 광고 지역 + 희망 슬롯 + 게재 기간</p>
      </section>

      {/* 푸터 */}
      <footer className="bg-brown text-cream/60 py-8 px-4">
        <div className="max-w-5xl mx-auto text-center text-xs space-y-2">
          <p>© 2026 얼마드나 · ulmadna.com</p>
          <p>
            <Link href="/terms" className="hover:text-cream">이용약관</Link> ·{' '}
            <Link href="/privacy" className="hover:text-cream">개인정보처리방침</Link> ·{' '}
            <Link href="/" className="hover:text-cream">견적 계산기</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
