// ⚠️ 자동 생성 파일 — 직접 수정 금지!
// 생성기: scripts/gen-engine-data.mjs  |  원본: 전체데이터(62건)
// 갱신: 엑셀에 행 추가 후 `node scripts/gen-engine-data.mjs` 재실행
// 생성일: 2026-06-04  |  분석 건수: 62건 (59=25, 74=16, 84=21)
// 확장 분포: {"확장":61,"비확장":1}

import type { TypeAverage, ApartmentType } from './types';

/** 타입별 평균 물량 (엑셀 62건 자동 집계) */
export const TYPE_AVERAGES: Record<ApartmentType, TypeAverage> = {
  "59": {
    "area": 59,
    "floor_wood": 38.7,
    "floor_tile": 7.8,
    "wallpaper_wall": 138.2,
    "wallpaper_ceiling": 50.8,
    "bath_tile": 25.4,
    "baseboard": 60.3,
    "doors": 7,
    "windows": 7
  },
  "74": {
    "area": 74,
    "floor_wood": 48.6,
    "floor_tile": 9.3,
    "wallpaper_wall": 166.6,
    "wallpaper_ceiling": 68.1,
    "bath_tile": 31.8,
    "baseboard": 75.9,
    "doors": 8,
    "windows": 8
  },
  "84": {
    "area": 84,
    "floor_wood": 57.5,
    "floor_tile": 10.7,
    "wallpaper_wall": 177.3,
    "wallpaper_ceiling": 75.5,
    "bath_tile": 33.6,
    "baseboard": 78.3,
    "doors": 8,
    "windows": 7
  }
};

/** 타입 × Bay 통계 (보정계수 BAY_* 결정 근거 — 표본수 n 확인용) */
export const BAY_STATS = {
  "59": {
    "2": {
      "n": 6,
      "wallpaper_total": 181.1,
      "doors": 6.5,
      "windows": 6,
      "baseboard": 56.8
    },
    "3": {
      "n": 15,
      "wallpaper_total": 190.9,
      "doors": 7.2,
      "windows": 7,
      "baseboard": 60.8
    },
    "4": {
      "n": 4,
      "wallpaper_total": 194.1,
      "doors": 8,
      "windows": 8,
      "baseboard": 63.5
    }
  },
  "74": {
    "2": {
      "n": 1,
      "wallpaper_total": 239.8,
      "doors": 10,
      "windows": 8,
      "baseboard": 78
    },
    "3": {
      "n": 8,
      "wallpaper_total": 231.5,
      "doors": 7.5,
      "windows": 7,
      "baseboard": 74.6
    },
    "4": {
      "n": 7,
      "wallpaper_total": 237.5,
      "doors": 8.7,
      "windows": 8,
      "baseboard": 77.1
    }
  },
  "84": {
    "2": {
      "n": 2,
      "wallpaper_total": 223.2,
      "doors": 6.5,
      "windows": 6,
      "baseboard": 68
    },
    "3": {
      "n": 8,
      "wallpaper_total": 247.3,
      "doors": 7.4,
      "windows": 7.1,
      "baseboard": 76.4
    },
    "4": {
      "n": 11,
      "wallpaper_total": 262.3,
      "doors": 8.7,
      "windows": 8,
      "baseboard": 81.5
    }
  }
} as const;

/** 타입별 표본 수 */
export const SAMPLE_COUNTS = {"59":25,"74":16,"84":21} as const;
