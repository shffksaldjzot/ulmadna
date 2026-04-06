'use client';

import Image from 'next/image';
import Link from 'next/link';

// 가상 광고주 배너 컴포넌트
function MockBanner({ id, size, advertiser, copy, cta, className = '' }: {
  id: string; size: string; advertiser: string; copy: string; cta: string; className?: string;
}) {
  return (
    <div className={`relative border-2 border-dashed border-gold/40 rounded-lg overflow-hidden group hover:border-gold transition-colors ${className}`}>
      {/* 슬롯 ID 라벨 */}
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        <span className="text-[8px] bg-gold text-white px-1.5 py-0.5 rounded font-bold">{id}</span>
        <span className="text-[8px] bg-black/50 text-white px-1.5 py-0.5 rounded">{size}</span>
      </div>
      {/* 광고 라벨 */}
      <div className="absolute top-1 right-1 z-10">
        <span className="text-[7px] text-gray-400 bg-white/80 px-1 py-0.5 rounded">광고</span>
      </div>
      {/* 배너 내용 */}
      <div className="bg-gradient-to-r from-cream to-white p-3 flex items-center gap-3 h-full">
        <div className="w-10 h-10 bg-brown/10 rounded-lg flex items-center justify-center text-brown text-xs font-bold shrink-0">
          {advertiser.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brown truncate">{advertiser}</p>
          <p className="text-[10px] text-gray-500 truncate">{copy}</p>
        </div>
        <span className="text-[9px] bg-gold text-white px-2 py-1 rounded-full shrink-0 whitespace-nowrap">{cta}</span>
      </div>
      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-xs text-gold font-medium bg-white/90 px-3 py-1.5 rounded-full shadow">이 자리에 광고가 들어갑니다</span>
      </div>
    </div>
  );
}

function MockBannerRect({ id, advertiser, copy }: { id: string; advertiser: string; copy: string }) {
  return (
    <div className="relative border-2 border-dashed border-gold/40 rounded-lg overflow-hidden group hover:border-gold transition-colors">
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        <span className="text-[8px] bg-gold text-white px-1.5 py-0.5 rounded font-bold">{id}</span>
        <span className="text-[8px] bg-black/50 text-white px-1.5 py-0.5 rounded">300×250</span>
      </div>
      <div className="absolute top-1 right-1 z-10">
        <span className="text-[7px] text-gray-400 bg-white/80 px-1 py-0.5 rounded">광고</span>
      </div>
      <div className="bg-gradient-to-br from-cream to-white p-4 text-center">
        <div className="w-full h-16 bg-brown/5 rounded-lg mb-3 flex items-center justify-center text-[10px] text-gray-300">시공 사례 이미지</div>
        <p className="text-sm font-bold text-brown">{advertiser}</p>
        <p className="text-[10px] text-gray-400 mt-1">{copy}</p>
        <button className="mt-3 text-[10px] bg-gold text-white px-4 py-1.5 rounded-full">무료 상담 →</button>
      </div>
      <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-xs text-gold font-medium bg-white/90 px-3 py-1.5 rounded-full shadow">이 자리에 광고가 들어갑니다</span>
      </div>
    </div>
  );
}

export default function SponsorPreview() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 프리뷰 안내 바 */}
      <div className="bg-gold text-white text-center py-2 text-xs sticky top-0 z-50">
        🔍 광고 프리뷰 모드 — 실제 서비스 화면에 배너가 이렇게 표시됩니다 &nbsp;
        <Link href="/sponsor" className="underline font-medium">광고 상품 안내로 돌아가기</Link>
      </div>

      {/* ───── 실제 서비스 레이아웃 재현 ───── */}
      <div className="bg-white max-w-[1400px] mx-auto shadow-xl">

        {/* 헤더 */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/ulmadna_logo.png" alt="얼마드나" width={100} height={34} />
            <span className="hidden md:inline-block text-[10px] text-gray-400 border border-gray-200 rounded-full px-3 py-1">
              완전 무료 · 회원가입 없음
            </span>
          </div>
          <span className="text-xs text-gray-400">로그인</span>
        </header>

        {/* AD-H: 헤더 하단 리더보드 */}
        <div className="px-4 lg:px-8 py-3">
          <MockBanner id="AD-H" size="728×90" advertiser="○○인테리어 — 남양주 No.1" copy="10년 경력 · 시공사례 200건+ · 무료 상담" cta="견적 받기 →" />
        </div>

        {/* 히어로 */}
        <div className="bg-cream px-4 lg:px-8 py-8">
          <p className="text-xs text-gold mb-2">무료 인테리어 견적 계산기</p>
          <h1 className="text-2xl font-bold text-brown">우리 집 인테리어, 얼마 드나?</h1>
          <p className="text-sm text-gray-500 mt-1">평형·자재·공정만 선택하면 예상 견적이 바로 나옵니다.</p>
        </div>

        {/* 메인 영역: 입력 + 결과 */}
        <div className="flex flex-col lg:flex-row">

          {/* 좌측: 입력 패널 (58%) */}
          <div className="lg:w-[58%] p-4 lg:p-8 border-r border-gray-100">
            <p className="text-[10px] text-gold mb-2">Step 01.</p>
            <p className="text-sm font-bold text-brown mb-4">기본 공간 정보</p>

            {/* 기본 조건 */}
            <div className="space-y-3 mb-6">
              <div className="flex flex-wrap gap-2">
                {['18평', '24평', '25평 국평', '30평', '34평'].map(a => (
                  <span key={a} className={`px-3 py-1.5 rounded-lg text-xs ${a === '25평 국평' ? 'bg-brown text-white' : 'bg-gray-100 text-gray-500'}`}>{a}</span>
                ))}
              </div>
              <div className="flex gap-2">
                {['신축 입주', '구축 10년', '구축 20년+'].map(t => (
                  <span key={t} className={`px-3 py-1.5 rounded-lg text-xs flex-1 text-center ${t === '구축 10년' ? 'bg-brown text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</span>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-gold mb-2">Step 02.</p>
            <p className="text-sm font-bold text-brown mb-4">공정 세부 선택</p>

            {/* 공정 리스트 (일부) */}
            <div className="space-y-2 mb-4">
              {[
                { name: '철거', amount: '230만' },
                { name: '설비/배관', amount: '120만' },
                { name: '목공', amount: '380만' },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brown" />
                    <span className="text-sm font-semibold text-brown">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gold">{p.amount}</span>
                </div>
              ))}
            </div>

            {/* AD-P1: 공정 사이 배너 */}
            <MockBanner id="AD-P1" size="468×60" advertiser="LX Z:IN 창호" copy="에너지등급 1등급 보장 · 전국 시공" cta="자세히 →" />

            <div className="space-y-2 mt-4 mb-4">
              {[
                { name: '바닥재', amount: '240만' },
                { name: '욕실', amount: '264만' },
                { name: '주방', amount: '315만' },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brown" />
                    <span className="text-sm font-semibold text-brown">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gold">{p.amount}</span>
                </div>
              ))}
            </div>

            {/* AD-P2: 공정 사이 배너 */}
            <MockBanner id="AD-P2" size="468×60" advertiser="대림바스 욕실" copy="프리미엄 욕실 리모델링 · 전시장 방문 예약" cta="더 보기 →" />

            <div className="space-y-2 mt-4">
              {[
                { name: '에어컨', amount: '560만' },
                { name: '부대비용', amount: '255만' },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brown" />
                    <span className="text-sm font-semibold text-brown">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gold">{p.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 결과 패널 (42%) */}
          <div className="lg:w-[42%] bg-cream/50 p-4 lg:p-6">
            {/* 견적 카드 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
              <p className="text-[10px] text-gold mb-3">실시간 견적 결과</p>
              <p className="text-xs text-gray-400 mb-2">25평 · 구축 10년 미만 · 중급(대중적)</p>
              <p className="text-3xl font-bold text-brown">₩43,120,000</p>
              <p className="text-sm text-gray-400 mt-1">예비비 10% 포함 · 평당 172만원</p>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-amber/10">
                <span className="w-2 h-2 rounded-full bg-amber" />
                <span className="text-xs font-medium text-amber">시장 평균 범위 안, 적정 수준이에요.</span>
              </div>
            </div>

            {/* AD-R1: 결과 패널 중간 배너 */}
            <div className="mb-4">
              <MockBannerRect id="AD-R1" advertiser="○○인테리어" copy="화도·남양주 전문 · 시공사례 200건+" />
            </div>

            {/* 공정별 비중 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <p className="text-xs font-bold text-brown mb-3">공정별 비용 비중</p>
              <div className="space-y-2">
                {[
                  { name: '에어컨', pct: 28 },
                  { name: '목공', pct: 19 },
                  { name: '주방', pct: 16 },
                  { name: '욕실', pct: 13 },
                ].map(p => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12">{p.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-gold rounded-full h-1.5" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 다운로드 버튼 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <span className="px-3 py-2.5 bg-brown text-white rounded-lg text-xs text-center">PDF 저장</span>
              <span className="px-3 py-2.5 bg-gold text-white rounded-lg text-xs text-center">엑셀 저장</span>
            </div>

            {/* AD-R2: 결과 패널 하단 배너 */}
            <MockBannerRect id="AD-R2" advertiser="△△자재 대리점" copy="경기 남부 자재 도매 · 강마루/타일 전문" />
          </div>
        </div>

        {/* AD-F: 푸터 상단 리더보드 */}
        <div className="px-4 lg:px-8 py-4 bg-cream">
          <MockBanner id="AD-F" size="728×90" advertiser="□□홈 인테리어" copy="수원·용인 전문 시공 · 3D 시뮬레이션 무료" cta="상담 예약 →" />
        </div>

        {/* 푸터 */}
        <footer className="bg-brown text-cream/60 py-6 px-4 lg:px-8 text-center text-xs">
          <p>© 2026 얼마드나 · ulmadna.com</p>
        </footer>
      </div>

      {/* 하단 설명 */}
      <div className="max-w-[1400px] mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-brown mb-4 text-center">배너 슬롯 요약</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-cream rounded-xl p-4">
              <p className="font-bold text-gold mb-2">데스크톱 6개 슬롯</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>AD-H — 헤더 하단 (728×90)</li>
                <li>AD-P1 — 공정 사이 상단 (468×60)</li>
                <li>AD-P2 — 공정 사이 하단 (468×60)</li>
                <li>AD-R1 — 결과 패널 중간 (300×250)</li>
                <li>AD-R2 — 결과 패널 하단 (300×250)</li>
                <li>AD-F — 푸터 상단 (728×90)</li>
              </ul>
            </div>
            <div className="bg-cream rounded-xl p-4">
              <p className="font-bold text-gold mb-2">모바일 4개 슬롯</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>AD-M1 — 기본조건 아래 (320×100)</li>
                <li>AD-M2 — 공정 중간 (320×100)</li>
                <li>AD-M3 — 공정 하단 (320×100)</li>
                <li>AD-M4 — 결과 아래 (320×50)</li>
              </ul>
            </div>
            <div className="bg-cream rounded-xl p-4">
              <p className="font-bold text-gold mb-2">PDF/엑셀 2개 슬롯</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>AD-PDF-H — 견적서 상단 로고</li>
                <li>AD-PDF-F — 견적서 하단 추천업체</li>
              </ul>
              <p className="text-[10px] text-gray-400 mt-2">견적서 다운로드·공유 시 함께 확산</p>
            </div>
          </div>
          <div className="text-center mt-6">
            <a
              href="mailto:cs870@naver.com?subject=[얼마드나] 스폰서 광고 문의"
              className="inline-block bg-brown text-white text-sm px-8 py-3 rounded-full hover:bg-brown/90 transition-colors"
            >
              광고 문의하기 — cs870@naver.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
