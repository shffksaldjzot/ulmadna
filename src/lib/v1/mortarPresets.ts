// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 — 공개 가능한 프리셋 값 (단가 아님)
//
// 이 파일이 하는 일:
//   용도 칩 라벨·기본 두께·기본 공법처럼 "화면에 그대로 보여도 되는" 값을 한 곳에 둔다.
//   단가·산식이 아니라서 클라이언트(src/lib/v1/**)와 서버(src/server/calc/**) 양쪽에서
//   똑같이 이 파일 하나만 가져다 쓴다 — 전에는 서버 계수 파일(schema/mortar-coefficients.ts)과
//   클라이언트 파일(mortarEngineInput.ts)에 같은 표를 두 번 적어 놨었는데(2026-09-14 검사관
//   지적), 그러면 한쪽만 고쳤을 때 서버·화면 기본값이 어긋나는 사고가 난다. 이제 여기 하나만
//   고치면 서버·화면이 같이 바뀐다.
//
// 값의 근거·등급은 src/server/calc/schema/mortar-coefficients.ts 파일 상단 설명과 같다
// (원본 출처: docs/도메인지식/06_미장.md §1·§5-4). 여기서는 값 자체만 옮겨 적는다.
//
// 작성일: 2026년 09월 14일 (2026-09-14 검사관 지적 반영으로 신설)
// ──────────────────────────────────────────────

/** 근거 등급 — A 확보 / B 산출 가능 / C 추정(화면에 "추정" 표기 필요) */
export type PresetGrade = 'A' | 'B' | 'C';

/** 계산기 모드 — 레미탈(일반 몰탈 손미장) / 셀프레벨링(수평몰탈) */
export type MortarMode = '레미탈' | '셀프레벨링';

/** 레미탈 모드 용도 칩 4개 */
export type MortarUsage = '확장부바닥' | '욕실현관구배' | '마루철거보수' | '방통전체';

/** 셀프레벨링 모드 용도(두께 칩과 짝지어지는 것) */
export type SelfLevelUsage = '마루장판전' | '타일전' | '방통위마감';

/**
 * 공법 — 장비 타설(모르타르 펌프로 넓게 타설) / 손미장(사람이 흙손으로 바름).
 * 2026-09-14 검사관 지적: 예전엔 "체적 10㎥ 이상이면 장비 타설"로 임의 문턱을 뒀는데,
 * 실제로는 용도가 공법을 정한다(방통처럼 바닥 전체를 까는 공사만 장비를 쓴다) — 문턱 폐기.
 */
export type MortarMethod = '장비타설' | '손미장';

/** 레미탈 용도 하나의 프리셋 — 두께 범위·기본 두께·기본 공법 */
export interface UsagePreset {
  /** 화면에 보이는 이름 */
  label: string;
  /** 두께 하한 (mm) */
  minMm: number;
  /** 두께 상한 (mm) */
  maxMm: number;
  /** 칩을 누르면 채워지는 기본 두께 (mm) */
  defaultMm: number;
  /** 이 용도가 기본으로 쓰는 공법 — 방통 전체만 장비 타설, 나머지는 손미장 */
  defaultMethod: MortarMethod;
  /** 근거 등급 (두께 범위 기준) */
  grade: PresetGrade;
}

/**
 * 용도별 두께 범위 + 기본 공법 (06_미장.md §1 표).
 * 표준품셈에는 "바닥 미장 두께" 자체를 규정한 항목이 없어(9-1-2는 벽체·24mm 이하 기준)
 * 방통(B등급, 삼표 공식 블로그 근거)을 빼면 전부 인테리어 실무 관행값(C등급)이다.
 */
export const USAGE_PRESET: Record<MortarUsage, UsagePreset> = {
  방통전체: { label: '방통 전체', minMm: 40, maxMm: 50, defaultMm: 45, defaultMethod: '장비타설', grade: 'B' },
  확장부바닥: { label: '확장부 바닥', minMm: 30, maxMm: 50, defaultMm: 40, defaultMethod: '손미장', grade: 'C' },
  욕실현관구배: { label: '욕실·현관 구배', minMm: 20, maxMm: 40, defaultMm: 30, defaultMethod: '손미장', grade: 'C' },
  마루철거보수: { label: '마루 철거 후 보수', minMm: 3, maxMm: 15, defaultMm: 10, defaultMethod: '손미장', grade: 'B' },
};

/** 레미탈 용도 칩 순서 (06_미장.md §1 표 순서 그대로) */
export const USAGE_ORDER: MortarUsage[] = ['방통전체', '확장부바닥', '욕실현관구배', '마루철거보수'];

/** 셀프레벨링 용도 하나의 프리셋 */
export interface SelfLevelUsagePreset {
  label: string;
  defaultMm: number;
  grade: PresetGrade;
}

/** 셀프레벨링 용도별 추천 두께 (06_미장.md §5-4) */
export const SELF_LEVEL_USAGE_PRESET: Record<SelfLevelUsage, SelfLevelUsagePreset> = {
  마루장판전: { label: '마루·장판 시공 전 평탄화', defaultMm: 5, grade: 'C' },
  타일전: { label: '타일 시공 전 평탄화', defaultMm: 10, grade: 'C' },
  방통위마감: { label: '방통 위 마감 평탄화', defaultMm: 15, grade: 'C' },
};

/** 셀프레벨링 용도 칩 순서 (06_미장.md §5-4 표 순서 그대로) */
export const SELF_LEVEL_USAGE_ORDER: SelfLevelUsage[] = ['마루장판전', '타일전', '방통위마감'];

/**
 * 레미탈 간단 모드 두께 칩(mm) — 용도 칩 아래에 따로 한 줄 더 둔다.
 * 2026-09-15 형아 피드백: 방통은 현장에서 50~150mm까지도 흔히 쓴다 — 06_미장.md 표(10~50)
 * 보다 넓게 잡는다. 용도 칩 기본값(예: 방통 전체 45mm)이 이 목록에 없을 수도 있는데, 그때는
 * 화면의 두께 숫자 입력칸이 그 값을 그대로 보여준다(칩은 "많이 쓰는 값" 지름길일 뿐이다).
 */
export const REMICON_THICKNESS_CHIPS: number[] = [30, 40, 50, 60, 80, 100, 120, 150];

/**
 * 셀프레벨링 간단 모드 두께 칩(mm). 예전엔 용도 라벨을 칩 문구에 같이 적었는데
 * (예: "5mm · 마루장판"), 이번에 용도 칩 줄을 따로 두면서 두께 칩은 숫자만 남겼다.
 */
export const SELF_LEVEL_THICKNESS_CHIPS: number[] = [3, 5, 10, 15, 20, 30];

/** 면적 입력 범위(㎡) — 서버 API·결과 페이지·화면 폼이 전부 이 값으로 클램프한다 */
export const AREA_SQM_MIN = 0.5;
export const AREA_SQM_MAX = 500;

/** 두께 입력 하한(mm) — 모드 공통 */
export const THICKNESS_MM_MIN = 1;

/**
 * 레미탈 두께 입력 상한(mm). 2026-09-15 형아 피드백(현장 경험): 방통은 50~150mm까지 흔하다 —
 * 06_미장.md 표는 10~50mm만 다루지만, 계산 자체는 150mm까지 받아 준다(막지 않는다).
 */
export const THICKNESS_MM_MAX_REMICON = 150;

/**
 * 셀프레벨링 두께 입력 상한(mm). 제품 스펙(RFSL30 등)이 다루는 최대 두께가 40mm 안팎이라
 * 여유를 조금 두고 50으로 잡는다.
 */
export const THICKNESS_MM_MAX_SELF_LEVEL = 50;

/** 모드에 맞는 두께 입력 상한(mm)을 고른다 — API 검증·클램프·화면 입력칸이 전부 이 함수를 쓴다 */
export function thicknessMmMax(mode: MortarMode): number {
  return mode === '레미탈' ? THICKNESS_MM_MAX_REMICON : THICKNESS_MM_MAX_SELF_LEVEL;
}

/**
 * 06_미장.md가 직접 다루는 표준 두께 범위를 벗어났는지 — 계산은 그대로 하되 화면에 안내만
 * 붙인다("계산은 하되 캡션 1줄"). 레미탈만 해당(50mm 초과일 때). 셀프레벨링은 칩 상한
 * (50mm) 자체가 이미 표준 범위 안이라 별도 안내가 필요 없다.
 */
export function isThicknessOutOfStandardRange(mode: MortarMode, thicknessMm: number): boolean {
  return mode === '레미탈' && thicknessMm > 50;
}

/** isThicknessOutOfStandardRange()가 true일 때 화면에 보여줄 캡션 1줄 */
export const THICKNESS_OUT_OF_RANGE_NOTE = '표준 범위 밖(두꺼운 방통은 2회 타설 등 현장 확인)';

/**
 * 장비 타설일 때 화면에 보여줄 안내 — 장비 사용료는 계상하지 않으니(단가 창작 금지) 문구로만
 * 알린다. 즉답(useMortarQuickCalc)·서버(mortar.ts) 둘 다 이 문구 하나를 그대로 쓴다.
 */
export const EQUIPMENT_RENTAL_NOTE = '모르타르 타설 장비비 별도(현장 견적)';

/**
 * 셀프레벨링 인건 안내 — 인건비만 분리한 근거가 없어 계산하지 않고(06_미장.md §6-4) 이
 * 문구로 대신한다. 즉답·서버 둘 다 이 문구 하나를 그대로 쓴다.
 */
export const SELF_LEVEL_LABOR_ADVISORY_NOTE = '시공비는 현장 견적 별도';

/** 로스율 입력 범위(0~0.2 = 0~20%) */
export const LOSS_RATE_MIN = 0;
export const LOSS_RATE_MAX = 0.2;

/**
 * 가로×세로 입력 한 변의 길이 상한(m) — 면적 상한(500㎡)보다 넉넉히 잡아 전형적인 방
 * 실측(수 m 단위)을 방해하지 않으면서도, 공유 링크(?d=)에 비정상적으로 큰 값(예: 1e22)이
 * 들어와도 화면 입력칸에 지수 표기(1e+22)가 그대로 찍히는 사고를 막는다.
 */
export const LENGTH_M_MIN = 0.1;
export const LENGTH_M_MAX = 100;

/** 숫자를 [min, max] 안으로 눌러 담는다 — 결과 공유 링크(?d=)의 비정상 값 방어용 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
