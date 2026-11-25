// ──────────────────────────────────────────────
// 엑셀 → 엔진 데이터 자동 생성기
// 통합비율표.xlsx 의 '전체데이터' 시트를 읽어
// → src/app/v3/data/averages.generated.ts 를 자동 생성한다.
//
// 사용법:  node scripts/gen-engine-data.mjs
// 평면도(행)를 엑셀에 추가한 뒤 이 스크립트만 다시 돌리면 엔진 평균이 갱신됨.
// ──────────────────────────────────────────────
import xlsx from "xlsx";
import { writeFileSync } from "fs";

const XLSX_PATH = "C:/dotori/02_ulmadna/ulmadna_v1/v2 data/얼마드나_59_74_84_통합비율표_v1.xlsx";
const OUT_PATH = "C:/dotori/02_ulmadna/ulmadna_v1/src/app/v3/data/averages.generated.ts";
const SHEET = "전체데이터(62건)";

// 엑셀 컬럼명 → 엔진 필드명 매핑
const FIELD_MAP = {
  floor_wood: "마루㎡",
  floor_tile: "타일바닥㎡",
  wallpaper_wall: "도배벽㎡",
  wallpaper_ceiling: "도배천장㎡",
  bath_tile: "욕실타일㎡",
  baseboard: "걸레받이m",
  doors: "문(개)",
  windows: "창호(개소)",
};
const NOMINAL_AREA = { "59": 59, "74": 74, "84": 84 };

// ── 유틸 ──
const typeOf = (t) => String(t).match(/^\d+/)?.[0] ?? String(t);     // "84A" → "84"
const bayOf = (b) => (String(b).match(/[0-9]+/)?.[0]) ?? String(b);  // "2.5Bay코너" → "2"
const r1 = (n) => Math.round(n * 10) / 10;
const mean = (arr) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);
const num = (v) => Number(v) || 0;

// ── 엑셀 읽기 ──
const wb = xlsx.readFile(XLSX_PATH);
const rows = xlsx.utils.sheet_to_json(wb.Sheets[SHEET], { defval: "" });

// ── 타입별 평균 (TYPE_AVERAGES) ──
const TYPES = ["59", "74", "84"];
const typeAverages = {};
const sampleCounts = {};
for (const type of TYPES) {
  const subset = rows.filter((r) => typeOf(r["타입"]) === type);
  sampleCounts[type] = subset.length;
  const avg = { area: NOMINAL_AREA[type] };
  for (const [field, col] of Object.entries(FIELD_MAP)) {
    const vals = subset.map((r) => num(r[col]));
    // 문·창호는 반올림 정수, 면적류는 소수1자리
    avg[field] = field === "doors" || field === "windows" ? Math.round(mean(vals)) : r1(mean(vals));
  }
  typeAverages[type] = avg;
}

// ── 타입 × Bay 통계 (보정계수 검토용 — 사람이 보고 룰 결정) ──
const bayStats = {};
for (const type of TYPES) {
  bayStats[type] = {};
  for (const bay of ["2", "3", "4"]) {
    const subset = rows.filter((r) => typeOf(r["타입"]) === type && bayOf(r["Bay"]) === bay);
    if (!subset.length) continue;
    bayStats[type][bay] = {
      n: subset.length,
      wallpaper_total: r1(mean(subset.map((r) => num(r["도배합계㎡"])))),
      doors: r1(mean(subset.map((r) => num(r["문(개)"])))),
      windows: r1(mean(subset.map((r) => num(r["창호(개소)"])))),
      baseboard: r1(mean(subset.map((r) => num(r["걸레받이m"])))),
    };
  }
}

// ── 확장 분포 ──
const expCount = {};
rows.forEach((r) => { const k = String(r["확장"]) || "(미상)"; expCount[k] = (expCount[k] || 0) + 1; });

// ── 파일 생성 ──
const stamp = new Date().toISOString().slice(0, 10);
const banner = `// ⚠️ 자동 생성 파일 — 직접 수정 금지!
// 생성기: scripts/gen-engine-data.mjs  |  원본: ${SHEET}
// 갱신: 엑셀에 행 추가 후 \`node scripts/gen-engine-data.mjs\` 재실행
// 생성일: ${stamp}  |  분석 건수: ${rows.length}건 (${TYPES.map((t) => `${t}=${sampleCounts[t]}`).join(", ")})
// 확장 분포: ${JSON.stringify(expCount)}
`;

const body = `import type { TypeAverage, ApartmentType } from './types';

/** 타입별 평균 물량 (엑셀 ${rows.length}건 자동 집계) */
export const TYPE_AVERAGES: Record<ApartmentType, TypeAverage> = ${JSON.stringify(typeAverages, null, 2)};

/** 타입 × Bay 통계 (보정계수 BAY_* 결정 근거 — 표본수 n 확인용) */
export const BAY_STATS = ${JSON.stringify(bayStats, null, 2)} as const;

/** 타입별 표본 수 */
export const SAMPLE_COUNTS = ${JSON.stringify(sampleCounts)} as const;
`;

writeFileSync(OUT_PATH, banner + "\n" + body, "utf8");

// ── 콘솔 리포트 ──
console.log(banner);
console.log("✅ 생성 완료 →", OUT_PATH, "\n");
console.log("── 타입별 평균 ──");
console.table(typeAverages);
console.log("\n── 타입×Bay 표본수 & 도배/문/창호 평균 (얇은 셀 n≤2 주의) ──");
for (const type of TYPES) {
  for (const [bay, s] of Object.entries(bayStats[type])) {
    const warn = s.n <= 2 ? "  ⚠️표본부족" : "";
    console.log(`  ${type} ${bay}Bay (n=${s.n}): 도배 ${s.wallpaper_total}㎡ / 문 ${s.doors} / 창호 ${s.windows} / 걸레 ${s.baseboard}m${warn}`);
  }
}
