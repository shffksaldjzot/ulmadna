// ── 전체 공정 데이터 export ──
// 17개 공정을 시공 순서대로 정렬해서 내보냄

import { DEMOLITION } from './demolition';
import { ELECTRICAL } from './electrical';
import { PLUMBING } from './plumbing';
import { EXPANSION } from './expansion';
import { WINDOW, WINDOW_AREAS } from './window';
import { WOODWORK } from './woodwork';
import { BATHROOM, SANITARY_INSTALL_COSTS, TOILET_OPTIONS, BASIN_OPTIONS, TAP_OPTIONS, ACCESSORY_OPTIONS } from './bathroom';
import { FLOORING, JANGPAN_OPTIONS, KANGMARU_OPTIONS, NATURAL_MARU_OPTIONS, FLOOR_TILE_OPTIONS } from './flooring';
import { WALLPAPER, WALLPAPER_ZONES } from './wallpaper';
import { PAINTING } from './painting';
import { FILM } from './film';
import { MIDDLEDOOR } from './middledoor';
import { AIRCON } from './aircon';
import { FURNITURE } from './furniture';
import { APPLIANCE } from './appliance';
import { CURTAIN, CURTAIN_FABRICS, CURTAIN_INSTALL, CURTAIN_MOTORIZED, CURTAIN_OPTIONS, CURTAIN_ROOM_TIPS } from './curtain';
import { FINISHING } from './finishing';

import type { ProcessData } from '../types';

// 개별 공정 re-export
export {
  DEMOLITION, ELECTRICAL, PLUMBING, EXPANSION,
  WINDOW, WINDOW_AREAS,
  WOODWORK,
  BATHROOM, SANITARY_INSTALL_COSTS, TOILET_OPTIONS, BASIN_OPTIONS, TAP_OPTIONS, ACCESSORY_OPTIONS,
  FLOORING, JANGPAN_OPTIONS, KANGMARU_OPTIONS, NATURAL_MARU_OPTIONS, FLOOR_TILE_OPTIONS,
  WALLPAPER, WALLPAPER_ZONES,
  PAINTING, FILM, MIDDLEDOOR, AIRCON,
  FURNITURE, APPLIANCE,
  CURTAIN, CURTAIN_FABRICS, CURTAIN_INSTALL, CURTAIN_MOTORIZED, CURTAIN_OPTIONS, CURTAIN_ROOM_TIPS,
  FINISHING,
};

/** 시공 순서대로 정렬된 전체 공정 배열 */
export const ALL_PROCESSES: ProcessData[] = [
  DEMOLITION,   // 1. 철거
  ELECTRICAL,   // 2. 전기
  PLUMBING,     // 3. 설비
  EXPANSION,    // 4. 확장
  WINDOW,       // 5. 창호
  WOODWORK,     // 6. 목공
  BATHROOM,     // 7. 욕실·타일
  FLOORING,     // 8. 바닥
  WALLPAPER,    // 9. 도배
  PAINTING,     // 10. 도장
  FILM,         // 11. 필름
  MIDDLEDOOR,   // 12. 중문
  AIRCON,       // 13. 시스템에어컨
  FURNITURE,    // 14. 가구
  APPLIANCE,    // 15. 가전
  CURTAIN,      // 16. 커튼
  FINISHING,    // 17. 기타 입주시공
];

/** 공정 ID로 공정 데이터 조회 */
export function getProcess(id: string): ProcessData | undefined {
  return ALL_PROCESSES.find(p => p.id === id);
}
