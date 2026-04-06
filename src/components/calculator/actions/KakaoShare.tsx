'use client';

import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';
import { formatWon } from '@/lib/format';
import { encodeToUrl } from '@/lib/url-params';

const GRADE_LABELS: Record<string, string> = {
  basic: '기본', mid: '중급', premium: '고급',
};

interface KakaoShareProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

export default function KakaoShare({ input, output }: KakaoShareProps) {
  const handleShare = () => {
    const url = encodeToUrl(input);
    const title = `${input.basic.area}평 ${GRADE_LABELS[input.basic.grade]} 리모델링 예상 견적: ${formatWon(output.total)}`;
    const description = '얼마드나에서 확인 — 회원가입 없이 무료';

    // 카카오 SDK가 로드되어 있으면 카카오 공유, 아니면 클립보드 복사
    if (typeof window !== 'undefined' && (window as any).Kakao?.Share) {
      (window as any).Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description,
          imageUrl: `${window.location.origin}/og-image.png`,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [
          { title: '견적 확인하기', link: { mobileWebUrl: url, webUrl: url } },
        ],
      });
    } else {
      // 폴백: 클립보드 복사
      navigator.clipboard.writeText(url).then(() => {
        alert('링크가 복사되었어요. 카카오톡에 붙여넣기 해주세요!');
      });
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex-1 min-w-[140px] px-4 py-3 bg-[#FEE500] text-[#3C1E1E] rounded-lg text-sm font-medium hover:bg-[#FEE500]/90 transition-colors"
    >
      카카오톡으로 공유
    </button>
  );
}
