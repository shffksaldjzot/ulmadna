# Design: 얼마드나 인테리어 견적 계산기

> **Feature:** ulmadna-calculator
> **Created:** 2026-04-05
> **Architecture:** Option C — 실용적 균형
> **Plan:** [ulmadna-calculator.plan.md](../../01-plan/features/ulmadna-calculator.plan.md)

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 기존 견적 계산기는 전부 리드 수집 목적 + 합리성 판단 부재. "진짜 무료, 진짜 부담 없는" 도구로 신뢰를 독점한다. |
| **WHO** | 30~40대 신규 아파트 입주자 및 리모델링 계획자. 모바일 70% 이상. |
| **RISK** | 단가 정확도 논란, 트래픽 확보 실패, 엑셀 DB 관리 한계 |
| **SUCCESS** | 월 5,000 방문자, 이탈률 40% 이하, PDF 다운로드율 15% 이상 |
| **SCOPE** | Phase 1 — 견적 계산기 + PDF/엑셀 + 카카오 공유 + 선택적 카카오 로그인 + 배너 영역 |

---

## 1. Overview

### 1.1 아키텍처 선택: Option C — 실용적 균형

| 항목 | 결정 |
|------|------|
| 상태 관리 | `useReducer` + Context (계산기 전용) |
| 계산 엔진 | `lib/calculator.ts` 순수 함수 분리 |
| 컴포넌트 | 입력/결과/레이아웃 3계층 분리 |
| 데이터 | 빌드 타임 Excel→JSON, 정적 임포트 |
| 인증 | NextAuth.js + 카카오 OAuth |
| DB | Supabase PostgreSQL (서울/도쿄 리전) |
| 파일 수 | ~30개 |

### 1.2 핵심 설계 원칙

1. **계산 엔진은 UI와 완전 분리** — `lib/calculator.ts`는 순수 함수, React 의존성 없음
2. **모바일 퍼스트** — 모든 컴포넌트 모바일 먼저 설계, `lg:` 프리픽스로 데스크톱 확장
3. **데이터는 빌드 타임** — 단가 JSON은 번들에 포함, 런타임 API 호출 없음
4. **회원 기능은 부가적** — 인증/DB 관련 코드 제거해도 핵심 기능 100% 동작

---

## 2. 기술 스택 상세

| 계층 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 15.x |
| 언어 | TypeScript | 5.x |
| 스타일 | Tailwind CSS | 4.x |
| UI 컴포넌트 | shadcn/ui | latest |
| 차트 | Recharts | 2.x |
| PDF | jsPDF + html2canvas | latest |
| 엑셀 | SheetJS (xlsx) | latest |
| 폰트 | Pretendard | latest (CDN) |
| 인증 | NextAuth.js v5 | 5.x |
| DB | Supabase (PostgreSQL) | - |
| 호스팅 | Vercel (ICN 엣지) | - |
| 분석 | GA4 + 네이버 서치어드바이저 | - |

### 2.1 패키지 설치 명령

```bash
# 프로젝트 생성
npx create-next-app@latest ulmadna --typescript --tailwind --eslint --app --src-dir

# 핵심 의존성
npm install recharts jspdf html2canvas xlsx
npm install next-auth @supabase/supabase-js

# shadcn/ui 초기화
npx shadcn@latest init
npx shadcn@latest add button card switch select tabs badge separator

# 폰트
npm install pretendard

# 개발 의존성
npm install -D @types/jspdf
```

---

## 3. 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx                    # 루트 레이아웃 (폰트, 메타데이터, GA4)
│   ├── page.tsx                      # 메인 계산기 페이지 (SSG)
│   ├── globals.css                   # Tailwind + 커스텀 CSS 변수
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   │   └── route.ts             # NextAuth 카카오 OAuth
│   │   └── estimates/
│   │       └── route.ts             # 견적 CRUD API
│   ├── manifest.ts                  # PWA manifest (모바일 최적화)
│   └── sitemap.ts                   # SEO 사이트맵
│
├── components/
│   ├── calculator/
│   │   ├── InputPanel.tsx            # 입력 패널 컨테이너
│   │   ├── ResultPanel.tsx           # 결과 패널 컨테이너
│   │   ├── inputs/
│   │   │   ├── AreaSelector.tsx      # 평형 선택 (칩 그룹 + 직접입력)
│   │   │   ├── TypeSelector.tsx      # 주거 유형 (세그먼트)
│   │   │   ├── RegionSelector.tsx    # 지역 선택 (세그먼트)
│   │   │   ├── GradeSelector.tsx     # 자재 등급 (3카드)
│   │   │   ├── HeightSelector.tsx    # 천장 높이 (세그먼트)
│   │   │   └── ProcessToggles.tsx    # 공정 토글 리스트
│   │   ├── results/
│   │   │   ├── TotalCost.tsx         # 총 예상 비용 (큰 숫자)
│   │   │   ├── RationalityBadge.tsx  # 합리성 판단 배지
│   │   │   ├── EstimateTable.tsx     # 공정별 견적표
│   │   │   ├── CostChart.tsx         # 비용 비중 차트
│   │   │   ├── SavingTips.tsx        # 절약 팁
│   │   │   └── Timeline.tsx          # 공정 순서 타임라인
│   │   └── actions/
│   │       ├── PdfDownload.tsx       # PDF 다운로드 버튼
│   │       ├── ExcelDownload.tsx     # 엑셀 다운로드 버튼
│   │       ├── KakaoShare.tsx        # 카카오톡 공유
│   │       └── SaveEstimate.tsx      # 견적 저장 (회원용)
│   │
│   ├── layout/
│   │   ├── Header.tsx                # 헤더 (로고 + 서브 카피)
│   │   ├── Footer.tsx                # 푸터 (사업자 정보 + 면책)
│   │   └── BrandStory.tsx            # "왜 만들었나" 섹션
│   │
│   └── ads/
│       └── PartnerBanner.tsx         # 파트너 배너 광고
│
├── lib/
│   ├── calculator.ts                 # 계산 엔진 (순수 함수)
│   ├── rationality.ts                # 합리성 판단 로직
│   ├── savings.ts                    # 절약 팁 생성 로직
│   ├── format.ts                     # 금액 포맷팅 유틸리티
│   ├── pdf-generator.ts              # PDF 생성 로직
│   ├── excel-generator.ts            # 엑셀 생성 로직
│   ├── url-params.ts                 # URL 파라미터 인코딩/디코딩
│   ├── auth.ts                       # NextAuth 설정
│   └── supabase.ts                   # Supabase 클라이언트
│
├── hooks/
│   └── useCalculator.ts              # 계산기 상태 관리 (useReducer)
│
├── types/
│   └── calculator.ts                 # 타입 정의 (입력/출력/단가)
│
├── data/
│   ├── pricing.json                  # 공정별 단가 (30평 기준)
│   ├── coefficients.json             # 지역/유형/천장 계수
│   ├── brands.json                   # 등급별 대표 브랜드
│   ├── timeline.json                 # 공정 순서 + 예상 기간
│   └── copy.json                     # 모든 카피 텍스트 (중앙 관리)
│
├── scripts/
│   └── convert-excel.ts              # Excel→JSON 변환 스크립트
│
└── 인테리어_자재_시장단가_DB.xlsx      # 원본 단가 DB (루트에 유지)
```

---

## 4. 상태 관리 설계

### 4.1 Calculator State (useReducer)

```typescript
// types/calculator.ts

// --- 입력 타입 ---
type Grade = 'basic' | 'mid' | 'premium';
type HousingType = 'new' | 'old10' | 'old20';
type Region = 'seoul' | 'gyeonggi' | 'metro' | 'others';
type CeilingHeight = '2300' | '2400' | '2500';

interface ProcessOption {
  id: string;
  enabled: boolean;
  subOption?: string;    // 보일러: 'normal'|'condensing', 바닥: 'laminate'|... 등
  count?: number;        // 에어컨 개소, 욕실 개소, 붙박이장 개수 등
}

interface CalculatorInput {
  area: number;              // 평형 (기본: 30)
  housingType: HousingType;  // 기본: 'old20'
  region: Region;            // 기본: 'seoul'
  grade: Grade;              // 기본: 'mid'
  ceilingHeight: CeilingHeight; // 기본: '2300'
  processes: ProcessOption[]; // 19개 공정
}

// --- 출력 타입 ---
interface ProcessResult {
  id: string;
  name: string;
  amount: number;       // 계산된 금액
  percentage: number;   // 비중 (%)
  brand?: string;       // 참고 브랜드
}

interface CalculatorOutput {
  subtotal: number;          // 소계
  contingency: number;       // 예비비 (15%)
  total: number;             // 총 예산
  perPyeong: number;         // 평당 단가
  processes: ProcessResult[]; // 공정별 결과 (금액 큰 순 정렬)
  rationality: {
    level: 'good' | 'normal' | 'high'; // 그린/앰버/레드
    comment: string;
  };
  savingTips: SavingTip[];
}

// --- 상태 ---
interface CalculatorState {
  input: CalculatorInput;
  output: CalculatorOutput;
}

// --- 액션 ---
type CalculatorAction =
  | { type: 'SET_AREA'; payload: number }
  | { type: 'SET_HOUSING_TYPE'; payload: HousingType }
  | { type: 'SET_REGION'; payload: Region }
  | { type: 'SET_GRADE'; payload: Grade }
  | { type: 'SET_CEILING_HEIGHT'; payload: CeilingHeight }
  | { type: 'TOGGLE_PROCESS'; payload: string }
  | { type: 'SET_PROCESS_OPTION'; payload: { id: string; subOption?: string; count?: number } }
  | { type: 'LOAD_FROM_URL'; payload: CalculatorInput }
  | { type: 'LOAD_SAVED'; payload: CalculatorInput };
```

### 4.2 useCalculator Hook

```typescript
// hooks/useCalculator.ts

function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  let newInput: CalculatorInput;

  switch (action.type) {
    case 'SET_AREA':
      newInput = { ...state.input, area: action.payload };
      break;
    case 'SET_HOUSING_TYPE':
      newInput = { ...state.input, housingType: action.payload };
      break;
    // ... 각 액션 처리
    default:
      return state;
  }

  // 핵심: 입력이 바뀔 때마다 즉시 재계산
  const newOutput = calculate(newInput);
  return { input: newInput, output: newOutput };
}

export function useCalculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);
  return { state, dispatch };
}
```

**설계 포인트:**
- `dispatch`가 발생할 때마다 `calculate()` 순수 함수 호출 → 결과 즉시 업데이트
- `calculate()`는 `lib/calculator.ts`에 있으므로 UI 독립적으로 테스트 가능
- URL 파라미터에서 초기값 로드 (`LOAD_FROM_URL`) → 공유 링크 지원

### 4.3 Context Provider

```typescript
// page.tsx 에서 Provider 래핑 (필요 시)
// 현재 Phase 1은 단일 페이지이므로 page.tsx에서 useCalculator 직접 사용
// Phase 2에서 여러 페이지로 확장 시 Context로 전환

export default function Home() {
  const { state, dispatch } = useCalculator();

  return (
    <main>
      <Header />
      <div className="flex flex-col lg:flex-row">
        <InputPanel input={state.input} dispatch={dispatch} />
        <ResultPanel output={state.output} input={state.input} />
      </div>
      <BrandStory />
      <PartnerBanner />
      <Footer />
    </main>
  );
}
```

---

## 5. 계산 엔진 설계

### 5.1 핵심 함수 — `lib/calculator.ts`

```typescript
import pricingData from '@/data/pricing.json';
import coefficients from '@/data/coefficients.json';

/**
 * 순수 함수: 입력 → 결과 계산
 * UI 의존성 없음, 독립적으로 테스트 가능
 */
export function calculate(input: CalculatorInput): CalculatorOutput {
  const regionCoeff = coefficients.region[input.region];
  const housingCoeff = coefficients.housingType[input.housingType];
  const ceilingCoeff = coefficients.ceilingHeight[input.ceilingHeight];

  const processes: ProcessResult[] = input.processes
    .filter(p => p.enabled)
    .map(p => {
      const priceData = pricingData.find(d => d.id === p.id);
      const basePrice = priceData[input.grade]; // 30평 기준 단가

      // 공정별 금액 = 기본 단가[등급] × (평형/30) × 지역 × 유형 × 천장
      let amount = basePrice * (input.area / 30) * regionCoeff * housingCoeff * ceilingCoeff;

      // 개수 옵션 처리 (에어컨 개소, 욕실 개소 등)
      if (p.count && priceData.perUnit) {
        amount = priceData[input.grade + '_per_unit'] * p.count
          * regionCoeff * housingCoeff * ceilingCoeff;
      }

      return {
        id: p.id,
        name: priceData.name,
        amount: Math.round(amount),
        percentage: 0, // 아래에서 계산
        brand: priceData.brands?.[input.grade],
      };
    })
    .sort((a, b) => b.amount - a.amount); // 금액 큰 순 정렬

  const subtotal = processes.reduce((sum, p) => sum + p.amount, 0);

  // 비중 계산
  processes.forEach(p => {
    p.percentage = Math.round((p.amount / subtotal) * 1000) / 10;
  });

  const contingency = Math.round(subtotal * 0.15);
  const total = subtotal + contingency;
  const perPyeong = Math.round(total / input.area);

  return {
    subtotal,
    contingency,
    total,
    perPyeong,
    processes,
    rationality: evaluateRationality(perPyeong, input.grade),
    savingTips: generateSavingTips(input, processes),
  };
}
```

### 5.2 합리성 판단 — `lib/rationality.ts`

```typescript
const RANGES = {
  basic:   { min: 800000, max: 1200000 },  // 80~120만/평
  mid:     { min: 1300000, max: 1600000 },  // 130~160만/평
  premium: { min: 2000000, max: 2800000 },  // 200~280만/평
};

export function evaluateRationality(perPyeong: number, grade: Grade) {
  const range = RANGES[grade];
  const threshold = (range.max - range.min) * 0.2;

  if (perPyeong <= range.min + threshold) {
    return { level: 'good', comment: '합리적인 수준이에요. 잘 잡으셨어요.' };
  } else if (perPyeong <= range.max) {
    return { level: 'normal', comment: '시장 평균 범위 안, 적정 수준이에요.' };
  } else {
    return { level: 'high', comment: '시장 평균보다 다소 높은 편이에요. 아래 절약 팁을 확인해보세요.' };
  }
}
```

### 5.3 절약 팁 — `lib/savings.ts`

```typescript
export function generateSavingTips(input: CalculatorInput, results: ProcessResult[]): SavingTip[] {
  const tips: SavingTip[] = [];

  // 에어컨: 시스템 → 벽걸이 전환 시 절약
  const aircon = input.processes.find(p => p.id === 'aircon');
  if (aircon?.enabled && aircon.subOption === 'system') {
    const systemPrice = results.find(r => r.id === 'aircon')?.amount || 0;
    const wallPrice = /* 벽걸이 2대 가격 계산 */;
    if (systemPrice - wallPrice > 0) {
      tips.push({
        text: `시스템 에어컨 대신 벽걸이로 변경하면 약 ${formatWon(systemPrice - wallPrice)} 절약 가능`,
        saving: systemPrice - wallPrice,
      });
    }
  }

  // 욕실: 고급 → 중급 타일로 변경 시
  // 바닥: 원목마루 → 강마루 변경 시
  // ... 주요 절약 시나리오 2~3개 생성

  return tips.slice(0, 3); // 최대 3개
}
```

---

## 6. 데이터 설계

### 6.1 JSON 데이터 구조 — `data/pricing.json`

```json
[
  {
    "id": "demolition",
    "name": "철거",
    "basic": 2400000,
    "mid": 3000000,
    "premium": 4500000,
    "perUnit": false,
    "defaultOn": true,
    "order": 1,
    "duration": 3,
    "brands": {
      "basic": null,
      "mid": null,
      "premium": null
    },
    "subOptions": null
  },
  {
    "id": "aircon",
    "name": "에어컨",
    "basic": 900000,
    "mid": 4000000,
    "premium": 5500000,
    "perUnit": true,
    "basic_per_unit": 450000,
    "mid_per_unit": 1333333,
    "premium_per_unit": 1833333,
    "defaultOn": true,
    "defaultSubOption": "system",
    "defaultCount": 3,
    "order": 5,
    "duration": 2,
    "subOptions": [
      { "id": "wall", "name": "벽걸이", "grades": ["basic"] },
      { "id": "system", "name": "시스템", "grades": ["mid", "premium"] }
    ]
  }
  // ... 19개 공정
]
```

### 6.2 계수 데이터 — `data/coefficients.json`

```json
{
  "region": {
    "seoul": 1.00,
    "gyeonggi": 0.92,
    "metro": 0.85,
    "others": 0.78
  },
  "housingType": {
    "new": 0.70,
    "old10": 0.90,
    "old20": 1.00
  },
  "ceilingHeight": {
    "2300": 1.00,
    "2400": 1.05,
    "2500": 1.10
  }
}
```

### 6.3 카피 데이터 — `data/copy.json`

모든 UI 텍스트를 JSON으로 중앙 관리. 나중에 다국어 확장 가능.

```json
{
  "header": {
    "subtitle": "회원가입 없이 바로 사용 · 전화번호 입력 없음 · 완전 무료"
  },
  "hero": {
    "title": "우리 집 인테리어, 얼마 드나?",
    "subtitle": "평형·자재·공정만 선택하면 예상 견적이 바로 나옵니다."
  },
  "input": {
    "area": "어떤 평형에 사시나요?",
    "housingType": "집 상태가 어떤가요?",
    "region": "어디에 사시나요?",
    "grade": "어떤 느낌으로 하고 싶으세요?",
    "ceilingHeight": "천장 높이 (모르시면 그냥 넘어가세요)",
    "processes": "어떤 공사를 하시나요? (필요 없는 건 빼세요)"
  }
  // ... Plan 8장의 모든 카피
}
```

### 6.4 Excel→JSON 변환 — `scripts/convert-excel.ts`

```typescript
// npm run convert-data 로 실행
// 인테리어_자재_시장단가_DB.xlsx → data/*.json 변환

import XLSX from 'xlsx';
import fs from 'fs';

const wb = XLSX.readFile('인테리어_자재_시장단가_DB.xlsx');

// 30평_시뮬레이션 시트 → pricing.json
const simSheet = wb.Sheets['30평_시뮬레이션'];
// ... 변환 로직

// 지역_유형_계수 시트 → coefficients.json
const coeffSheet = wb.Sheets['지역_유형_계수'];
// ... 변환 로직

// package.json에 스크립트 추가:
// "convert-data": "ts-node scripts/convert-excel.ts"
```

---

## 7. DB 스키마 (Supabase)

### 7.1 테이블 설계

회원 기능은 단순: 유저 + 저장된 견적. 2개 테이블로 충분.

```sql
-- Supabase Auth가 users 테이블 자동 관리 (카카오 OAuth)
-- 추가 프로필이 필요하면 profiles 테이블 사용

-- 저장된 견적
CREATE TABLE saved_estimates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL DEFAULT '내 견적',      -- 사용자가 이름 붙이기
  input       JSONB NOT NULL,                        -- CalculatorInput 전체
  output      JSONB NOT NULL,                        -- CalculatorOutput 요약 (total, perPyeong)
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 유저당 최대 10건 제한은 API에서 처리
-- RLS (Row Level Security) 적용
ALTER TABLE saved_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own estimates"
  ON saved_estimates
  FOR ALL
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_estimates_user ON saved_estimates(user_id, created_at DESC);
```

### 7.2 API 설계

```
GET    /api/estimates          → 내 견적 목록 (최신 10건)
POST   /api/estimates          → 견적 저장 (10건 초과 시 가장 오래된 것 삭제)
DELETE /api/estimates/[id]     → 견적 삭제
```

```typescript
// app/api/estimates/route.ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const estimates = await supabase
    .from('saved_estimates')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json(estimates.data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // 10건 초과 체크
  const { count } = await supabase
    .from('saved_estimates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  if (count >= 10) {
    // 가장 오래된 것 삭제
    const oldest = await supabase
      .from('saved_estimates')
      .select('id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    await supabase.from('saved_estimates').delete().eq('id', oldest.data.id);
  }

  const result = await supabase
    .from('saved_estimates')
    .insert({ user_id: session.user.id, ...body })
    .select()
    .single();

  return NextResponse.json(result.data);
}
```

---

## 8. 컴포넌트 설계 상세

### 8.1 모바일 레이아웃 흐름

```
┌─────────────────────┐
│ Header              │ sticky top
│ "얼마드나"          │
│ 서브카피            │
├─────────────────────┤
│ Hero                │
│ "우리 집 인테리어,  │
│  얼마 드나?"        │
├─────────────────────┤
│ InputPanel          │ 아코디언/접기 가능
│ ┌─────────────────┐ │
│ │ 평형 (칩 그룹)  │ │
│ │ 유형 (세그먼트)  │ │
│ │ 지역 (세그먼트)  │ │
│ │ 등급 (3카드)    │ │
│ │ 천장 (세그먼트)  │ │
│ │ 공정 토글 (접기) │ │
│ └─────────────────┘ │
├─────────────────────┤
│ ResultPanel         │ 항상 보임
│ ┌─────────────────┐ │
│ │ 총 예상 비용    │ │ ← 가장 크게
│ │ "약 4,255만원"  │ │
│ │ 평당 142만원    │ │
│ ├─────────────────┤ │
│ │ 합리성 배지     │ │ ← 색상 배지
│ │ "적정 수준"     │ │
│ ├─────────────────┤ │
│ │ 공정별 견적표   │ │ ← 테이블 + 수평 바
│ ├─────────────────┤ │
│ │ 비용 비중 차트  │ │ ← 수평 바 차트
│ ├─────────────────┤ │
│ │ 절약 팁         │ │
│ ├─────────────────┤ │
│ │ 공정 순서       │ │ ← 세로 타임라인
│ ├─────────────────┤ │
│ │ [PDF] [엑셀]   │ │
│ │ [공유] [저장]   │ │
│ └─────────────────┘ │
├─────────────────────┤
│ "파트너 후원으로    │
│  무료 운영됩니다"   │
│ [배너] [배너]       │
├─────────────────────┤
│ BrandStory          │
│ "왜 만들었냐면요."  │
├─────────────────────┤
│ Footer              │
│ 사업자정보 + 면책   │
└─────────────────────┘
```

### 8.2 데스크톱 레이아웃 (lg: 1024px+)

```
┌──────────────────────────────────────────────┐
│ Header (sticky)                               │
├───────────────────┬──────────────────────────┤
│                   │                          │
│ InputPanel        │ ResultPanel (scroll)     │
│ (sticky, 380px)   │ (flex-1)                 │
│                   │                          │
│ 평형 선택         │ 총 예상 비용             │
│ 주거 유형         │ 합리성 판단              │
│ 지역              │ 견적표                   │
│ 자재 등급         │ 차트                     │
│ 천장 높이         │ 절약 팁                  │
│ 공정 토글         │ 타임라인                 │
│                   │ [PDF] [엑셀] [공유]      │
│                   │                          │
│                   │ 파트너 배너              │
│                   │ 브랜드 스토리            │
├───────────────────┴──────────────────────────┤
│ Footer                                        │
└──────────────────────────────────────────────┘
```

### 8.3 주요 컴포넌트 Props

```typescript
// InputPanel
interface InputPanelProps {
  input: CalculatorInput;
  dispatch: React.Dispatch<CalculatorAction>;
}

// ResultPanel
interface ResultPanelProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

// AreaSelector
interface AreaSelectorProps {
  value: number;
  onChange: (area: number) => void;  // dispatch 래핑
}

// GradeSelector
interface GradeSelectorProps {
  value: Grade;
  onChange: (grade: Grade) => void;
}

// ProcessToggles
interface ProcessTogglesProps {
  processes: ProcessOption[];
  onToggle: (id: string) => void;
  onOptionChange: (id: string, subOption?: string, count?: number) => void;
}
```

---

## 9. SEO + 퍼포먼스

### 9.1 렌더링 전략

| 부분 | 전략 | 이유 |
|------|------|------|
| 레이아웃/헤더/푸터 | SSG (빌드 타임) | 변하지 않는 정적 콘텐츠 |
| 입력 패널 | CSR (클라이언트) | 사용자 인터랙션 |
| 결과 패널 | CSR (클라이언트) | 실시간 계산 |
| OG 이미지 | 정적 이미지 (빌드 타임) | 30평 중급 기준 예시 |

### 9.2 메타데이터

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: '얼마드나 — 무료 인테리어 견적 계산기 | 회원가입 없이 바로 사용',
  description: '평형, 자재 등급, 공정만 선택하면 인테리어 예상 견적이 바로 나옵니다. 회원가입·전화번호 입력 없이 완전 무료.',
  keywords: '인테리어 견적, 인테리어 비용, 리모델링 비용, 평당 가격, 인테리어 얼마',
  openGraph: {
    title: '얼마드나 — 무료 인테리어 견적 계산기',
    description: '회원가입·전화번호 없이 바로 사용. 평형·자재·공정 선택하면 예상 견적이 나와요.',
    url: 'https://ulmadna.com',
    siteName: '얼마드나',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'ko_KR',
    type: 'website',
  },
};
```

### 9.3 퍼포먼스 최적화

| 기법 | 적용 |
|------|------|
| 폰트 최적화 | `next/font`로 Pretendard 서브셋 로드 |
| 이미지 최적화 | `next/image` + WebP |
| 코드 스플리팅 | PDF/엑셀 생성은 `dynamic import` (클릭 시 로드) |
| 차트 lazy | Recharts는 `dynamic(() => import('recharts'), { ssr: false })` |
| 번들 사이즈 | pricing.json ~5KB, 전체 데이터 ~15KB |

---

## 10. 인증 설계

### 10.1 NextAuth.js + 카카오

```typescript
// lib/auth.ts
import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import { SupabaseAdapter } from '@auth/supabase-adapter';

export const authOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
};
```

### 10.2 환경 변수

```env
# .env.local
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_URL=https://ulmadna.com
NEXTAUTH_SECRET=
```

---

## 11. Implementation Guide

### 11.1 구현 순서

| 순서 | 모듈 | 파일 | 의존성 |
|------|------|------|--------|
| 1 | 프로젝트 세팅 | Next.js + Tailwind + shadcn | 없음 |
| 2 | 데이터 변환 | scripts/convert-excel.ts → data/*.json | 없음 |
| 3 | 타입 정의 | types/calculator.ts | 없음 |
| 4 | 계산 엔진 | lib/calculator.ts, rationality.ts, savings.ts, format.ts | 타입, 데이터 |
| 5 | 상태 관리 | hooks/useCalculator.ts | 계산 엔진 |
| 6 | 입력 컴포넌트 | components/calculator/inputs/* | 상태 관리 |
| 7 | 결과 컴포넌트 | components/calculator/results/* | 상태 관리 |
| 8 | 레이아웃 | Header, Footer, BrandStory, page.tsx | 입력+결과 |
| 9 | 다운로드/공유 | PDF, 엑셀, 카카오 공유 | 결과 |
| 10 | 인증/DB | NextAuth + Supabase + 저장 API | 세팅 |
| 11 | 배너 광고 | PartnerBanner | 레이아웃 |
| 12 | SEO + GA4 | 메타데이터, sitemap, GA4 | 레이아웃 |

### 11.2 Module Map

| 모듈 ID | 이름 | 파일 수 | 예상 |
|---------|------|---------|------|
| M1 | 프로젝트 초기화 + 데이터 | 8 | 세팅+변환+타입+데이터 |
| M2 | 계산 엔진 + 상태 | 5 | calculator+rationality+savings+format+hook |
| M3 | 입력 UI | 7 | InputPanel + 6개 셀렉터 |
| M4 | 결과 UI | 7 | ResultPanel + 6개 결과 컴포넌트 |
| M5 | 레이아웃 + 페이지 통합 | 5 | Header+Footer+BrandStory+page+layout |
| M6 | 다운로드 + 공유 | 4 | PDF+엑셀+카카오+URL파라미터 |
| M7 | 인증 + DB + 저장 | 5 | NextAuth+Supabase+API+SaveEstimate |
| M8 | 배너 + SEO + GA4 | 4 | PartnerBanner+sitemap+manifest+GA4 |

### 11.3 Session Guide

| 세션 | 모듈 | 설명 | 예상 커밋 |
|------|------|------|-----------|
| **세션 1** | M1 + M2 | 프로젝트 세팅 + 데이터 + 계산 엔진 | 3~4 |
| **세션 2** | M3 + M4 | 입력 UI + 결과 UI (핵심 화면) | 4~5 |
| **세션 3** | M5 + M6 | 레이아웃 통합 + 다운로드/공유 | 3~4 |
| **세션 4** | M7 + M8 | 인증/DB + 배너/SEO 마무리 | 3~4 |

```
/pdca do ulmadna-calculator --scope M1,M2    # 세션 1
/pdca do ulmadna-calculator --scope M3,M4    # 세션 2
/pdca do ulmadna-calculator --scope M5,M6    # 세션 3
/pdca do ulmadna-calculator --scope M7,M8    # 세션 4
```

---

## 12. 테스트 계획

| 레벨 | 대상 | 방법 |
|------|------|------|
| 유닛 | calculator.ts | 30평 중급 시뮬레이션 결과 = 4,255만원(경기) 검증 |
| 유닛 | rationality.ts | 등급별 범위 경계값 테스트 |
| 통합 | 입력→결과 | 입력 변경 시 결과 즉시 업데이트 확인 |
| E2E | 전체 플로우 | 모바일에서 입력→결과→PDF 다운로드 |
| 시각 | 반응형 | 320px~1440px 레이아웃 전환 |

---

*얼마드나 Design v1.0 — 2026-04-05*
