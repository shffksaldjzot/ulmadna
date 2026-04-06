import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '얼마드나 — 무료 인테리어 견적 계산기';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #FAF6F1 0%, #F5EDE4 50%, #E8DDD0 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 상단 장식 라인 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #5C3A1E 0%, #C9A96E 50%, #5C3A1E 100%)',
          }}
        />

        {/* 메인 카드 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 80px',
            background: 'white',
            borderRadius: 32,
            boxShadow: '0 8px 40px rgba(92, 58, 30, 0.08)',
            border: '1px solid #E8DDD0',
          }}
        >
          {/* 로고 텍스트 */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#5C3A1E',
              letterSpacing: -2,
              marginBottom: 12,
            }}
          >
            얼마드나
          </div>

          {/* 서브타이틀 */}
          <div
            style={{
              fontSize: 28,
              color: '#8B7355',
              marginBottom: 40,
            }}
          >
            무료 인테리어 견적 계산기
          </div>

          {/* 특징 뱃지들 */}
          <div style={{ display: 'flex', gap: 16 }}>
            {['회원가입 없음', '개인정보 없음', '완전 무료'].map((text) => (
              <div
                key={text}
                style={{
                  padding: '12px 28px',
                  background: '#FAF6F1',
                  borderRadius: 100,
                  fontSize: 20,
                  color: '#5C3A1E',
                  border: '1px solid #E8DDD0',
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 URL */}
        <div
          style={{
            marginTop: 32,
            fontSize: 22,
            color: '#C9A96E',
            letterSpacing: 2,
          }}
        >
          ulmadna.com
        </div>
      </div>
    ),
    { ...size }
  );
}
