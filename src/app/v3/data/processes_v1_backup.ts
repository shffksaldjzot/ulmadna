// ──────────────────────────────────────────────
// v3 견적 엔진 — 공정별 데이터
// 물량: 62건 평면도 분석 기반
// 단가: ulmadna_db.json (35건 견적서 기반) + 시장 검증
// ──────────────────────────────────────────────

// ── 타입별 평균 물량 (62건 분석) ──
export const TYPE_AVERAGES: Record<string, {
  area: number;
  floor_wood: number;   // 마루 면적(㎡)
  floor_tile: number;   // 타일 바닥(㎡)
  wallpaper_wall: number;    // 도배 벽(㎡)
  wallpaper_ceiling: number; // 도배 천장(㎡)
  bath_tile: number;    // 욕실 타일(㎡)
  baseboard: number;    // 걸레받이(m)
  doors: number;        // 문(개)
  windows: number;      // 창호(개소)
}> = {
  '59': { area: 59, floor_wood: 39.0, floor_tile: 7.8, wallpaper_wall: 136.7, wallpaper_ceiling: 51.0, bath_tile: 25.4, baseboard: 60, doors: 7, windows: 7 },
  '74': { area: 74, floor_wood: 48.7, floor_tile: 9.4, wallpaper_wall: 165.8, wallpaper_ceiling: 68.0, bath_tile: 31.2, baseboard: 75, doors: 8, windows: 8 },
  '84': { area: 84, floor_wood: 57.6, floor_tile: 10.6, wallpaper_wall: 175.2, wallpaper_ceiling: 75.8, bath_tile: 33.5, baseboard: 77, doors: 8, windows: 7 },
};

// ── 실별 면적 비율 ──
export const ROOM_RATIOS = {
  master: { name: '안방', ratio: 0.17 },
  bed2: { name: '침실2', ratio: 0.09 },
  bed3: { name: '침실3', ratio: 0.10 },
  living: { name: '거실+주방', ratio: 0.32 },
  entrance: { name: '현관', ratio: 0.07 },
  bath1: { name: '욕실1', ratio: 0.04 },
  bath2: { name: '욕실2', ratio: 0.05 },
  etc: { name: '복도/기타', ratio: 0.16 },
};

// ══════════════════════════════════════════════
// 1. 창호
// ══════════════════════════════════════════════
export const WINDOW_AREAS: Record<string, { name: string; area: number }[]> = {
  '59': [
    { name: '거실 대창', area: 6.9 },
    { name: '안방 창', area: 3.4 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
  '74': [
    { name: '거실 대창', area: 7.6 },
    { name: '안방 창', area: 3.9 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
  '84': [
    { name: '거실 대창', area: 7.6 },
    { name: '안방 창', area: 3.9 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
};

export const WINDOW_GRADE_PRICES: Record<string, { label: string; desc: string; pricePerSqm: number }> = {
  economy: { label: '가성비', desc: 'PVC 이중창 + 일반 복층유리', pricePerSqm: 430000 },
  standard: { label: '중급', desc: 'PVC 이중창 + Low-E', pricePerSqm: 510000 },
  premium: { label: '고급', desc: '시스템창 + Low-E + 아르곤', pricePerSqm: 630000 },
};

export const WINDOW_PRODUCT_OPTIONS = [
  { id: 'double', label: '이중창', tooltip: '단열 1.2~1.8 W/m²K (2~3등급) · 복층유리 · 가장 일반적' },
  { id: 'system', label: '시스템창', tooltip: '단열 0.6~0.9 W/m²K (1등급) · 3중유리+가스충전 · 최고 단열' },
  { id: 'none', label: '교체안함', tooltip: '' },
];

export const WINDOW_EXTRAS = {
  demolition: 35000,   // 철거·폐기 (원/㎡)
  transport: 700000,   // 사다리차/양중 (원/현장)
  delivery: 150000,    // 운반비 (원/현장)
};

// ══════════════════════════════════════════════
// 2. 도배
// 단가 출처: ulmadna_db.json (EST-028~035 교차검증)
// 단위: 평당 단가 (벽+천장 합산 면적 기준)
// ══════════════════════════════════════════════
export const WALLPAPER_GRADES: Record<string, { label: string; desc: string; pricePerPyeong: number }> = {
  economy: { label: '가성비', desc: '합지 도배', pricePerPyeong: 30000 },
  standard: { label: '중급', desc: '실크 (개나리/로하스)', pricePerPyeong: 89000 },
  premium: { label: '고급', desc: '디아망 (LX/L하우시스)', pricePerPyeong: 130000 },
};

// 도배 세부 품목: 위치별 자재 선택용
export const WALLPAPER_ITEMS = [
  { id: 'living', name: '거실' },
  { id: 'master', name: '안방' },
  { id: 'bed2', name: '침실2' },
  { id: 'bed3', name: '침실3' },
  { id: 'kitchen', name: '주방' },
  { id: 'entrance', name: '현관/복도' },
  { id: 'ceiling', name: '천장' },
];

export const WALLPAPER_PRODUCT_OPTIONS = [
  { id: 'hapji', label: '합지', pricePerPyeong: 30000 },
  { id: 'silk', label: '실크', pricePerPyeong: 89000 },
  { id: 'diamond', label: '디아망', pricePerPyeong: 130000 },
  { id: 'none', label: '안함', pricePerPyeong: 0 },
];

// ══════════════════════════════════════════════
// 3. 바닥
// 단가 출처: ulmadna_db.json (EST-027~035)
// 단위: 평당 단가 (바닥 시공면적 기준)
// ══════════════════════════════════════════════
export const FLOORING_GRADES: Record<string, { label: string; desc: string; pricePerPyeong: number }> = {
  economy: { label: '가성비', desc: '장판 2.2t', pricePerPyeong: 37000 },
  standard: { label: '중급', desc: '강마루 (동화 그란데 7T)', pricePerPyeong: 108000 },
  premium: { label: '고급', desc: '강마루 (구정 그랜드165)', pricePerPyeong: 145000 },
};

export const FLOORING_PRODUCT_OPTIONS = [
  { id: 'jangpan22', label: '장판 2.2t', pricePerPyeong: 37000 },
  { id: 'jangpan50', label: '장판 5.0t', pricePerPyeong: 85000 },
  { id: 'kangmaru_basic', label: '강마루 (기본)', pricePerPyeong: 108000 },
  { id: 'kangmaru_premium', label: '강마루 (고급)', pricePerPyeong: 145000 },
  { id: 'none', label: '안함', pricePerPyeong: 0 },
];

export const FLOORING_EXTRAS = {
  demolition: 35000,  // 기존 마루 철거비 (원/평)
};

// ══════════════════════════════════════════════
// 4. 문 (방문 교체)
// 단가 출처: ulmadna_db.json (EST-027~035)
// 단위: 조당 (문짝+문틀+하드웨어+시공비 포함)
// ══════════════════════════════════════════════
export const DOOR_GRADES: Record<string, { label: string; desc: string; pricePerUnit: number }> = {
  economy: { label: '가성비', desc: '리움/보급형', pricePerUnit: 250000 },
  standard: { label: '중급', desc: '예림 문짝+합판문틀 제작', pricePerUnit: 370000 },
  premium: { label: '고급', desc: 'ABS문+9MM문선+도무스', pricePerUnit: 500000 },
};

// 중문 옵션 (별도)
export const MIDDLE_DOOR_OPTIONS = [
  { id: 'none', label: '설치 안함', price: 0 },
  { id: 'basic', label: '초슬림 3연동', price: 800000 },
  { id: 'mid', label: '원슬라이딩 (아이지/영림)', price: 1150000 },
  { id: 'high', label: '원슬라이딩 (이노핸즈/스틸)', price: 1500000 },
];

// ══════════════════════════════════════════════
// 5. 욕실
// 단가 출처: ulmadna_db.json (EST-027~035)
// 단위: 개소당 (타일+도기+시공비 세트)
// ══════════════════════════════════════════════
export const BATHROOM_GRADES: Record<string, { label: string; desc: string; pricePerUnit: number }> = {
  economy: { label: '가성비', desc: '보급형 도기', pricePerUnit: 1300000 },
  standard: { label: '중급', desc: '대림/이누스', pricePerUnit: 3000000 },
  premium: { label: '고급', desc: '아메리칸스탠다드/한셈', pricePerUnit: 4000000 },
};

// ══════════════════════════════════════════════
// 6. 철거
// 단가 출처: ulmadna_db.json (EST-028~034)
// 단위: 평당 단가 (전용면적 기준)
// ══════════════════════════════════════════════
export const DEMOLITION_GRADES: Record<string, { label: string; desc: string; pricePerPyeong: number }> = {
  economy: { label: '부분 철거', desc: '욕실+싱크대+가구 위주', pricePerPyeong: 30000 },
  standard: { label: '일반 철거', desc: '마루+몰딩+가구+욕실', pricePerPyeong: 50000 },
  premium: { label: '올철거', desc: '전체 마루+천장+욕실+가구', pricePerPyeong: 65000 },
};

export const DEMOLITION_EXTRAS = {
  // 폐기물 처리 (별도)
  waste_basic: 500000,   // 1~2차
  waste_mid: 1000000,    // 2~3차
  waste_full: 1600000,   // 3~5차 (올수리)
};
