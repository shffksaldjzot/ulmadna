// ─────────────────────────────────────────────────────────────
// InteriorResourceLinks.tsx ─ 인테리어 공사 자료 바로가기 모음 카드
//
//  - 인테리어 공사 전후로 소비자가 직접 확인하면 좋은 "공식 사이트" 링크 모음.
//  - 광고 슬롯을 끈 자리(빈 공간)를 쓸모있는 정보로 대체 (2026년 06월 29일).
//  - 모바일 우선: 1열 → 작은화면 이상 2열 → PC 3열 그리드.
//  - 모든 링크는 새 탭(target=_blank)으로 열림. 외부 공식 사이트만 수록.
// ─────────────────────────────────────────────────────────────

// 자료 링크 한 건의 데이터 구조
interface ResourceLink {
  icon: string;        // 카드 앞 이모지 아이콘
  title: string;       // 자료 이름
  desc: string;        // 한 줄 설명 (왜 필요한지)
  href: string;        // 공식 사이트 URL
  host: string;        // 화면에 작게 보여줄 도메인 표기
}

// 수록 링크 목록 — 전부 정부/공공 공식 사이트 (2026년 06월 29일 검증)
const LINKS: ResourceLink[] = [
  {
    icon: '📄',
    title: '실내건축·창호 표준계약서',
    desc: '공정거래위원회 공식 양식 (HWP·PDF 다운로드). 계약 전 필수 비교.',
    href: 'https://www.ftc.go.kr/www/selectBbsNttView.do?key=202&bordCd=201&nttSn=11181',
    host: 'ftc.go.kr',
  },
  {
    icon: '🏢',
    title: '키스콘 (KISCON)',
    desc: '건설업체 등록 여부·시공능력·벌점 조회. 업체 검증할 때.',
    href: 'https://www.kiscon.net/',
    host: 'kiscon.net',
  },
  {
    icon: '🏠',
    title: '건축물대장 열람',
    desc: '정부24에서 우리 집 면적·구조 무료 확인 (견적 기초자료).',
    href: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098',
    host: 'gov.kr',
  },
  {
    icon: '⚖️',
    title: '하자심사·분쟁조정위원회',
    desc: '시공 하자 분쟁이 생겼을 때 신청하는 공식 기구.',
    href: 'https://www.adc.go.kr/',
    host: 'adc.go.kr',
  },
  {
    icon: '🙋',
    title: '한국소비자원 (소비자24)',
    desc: '피해구제·분쟁조정 신청. 업체와 해결 안 될 때.',
    href: 'https://www.consumer.go.kr/',
    host: 'consumer.go.kr',
  },
];

export default function InteriorResourceLinks() {
  return (
    // 하단 섹션 — 흰 배경으로 위 통계 섹션(cream)과 구분
    <section className="bg-white py-12 px-4 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* 제목부 */}
        <div className="text-center mb-8">
          <p className="text-[10px] text-gold tracking-widest mb-2">
            인테리어 공사 자료실
          </p>
          <h2 className="text-2xl font-bold text-brown">
            공사 전 꼭 확인하세요
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            계약서·업체조회·분쟁까지, 공식 사이트 바로가기 모음
          </p>
        </div>

        {/* 링크 그리드 — 모바일 1열 / sm 2열 / lg 3열 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              // 카드 — 호버 시 살짝 떠오르고 테두리 강조
              className="group flex items-start gap-3 bg-cream/40 hover:bg-cream border border-gray-100 hover:border-gold/40 rounded-xl p-4 transition-all"
            >
              <span className="text-2xl shrink-0">{link.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brown group-hover:text-gold transition-colors">
                  {link.title}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {link.desc}
                </p>
                {/* 도메인 + 외부링크 표시 */}
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {link.host} ↗
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* 안내 문구 — 외부 사이트임을 명시 */}
        <p className="text-[10px] text-gray-400 text-center mt-5">
          위 링크는 모두 정부·공공 공식 사이트로 연결됩니다. (새 창)
        </p>
      </div>
    </section>
  );
}
