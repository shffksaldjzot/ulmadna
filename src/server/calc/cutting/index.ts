// ──────────────────────────────────────────────
// 재단 모듈 묶음 입구
// 자재 유형별 재단 함수를 한 곳에서 꺼내 쓴다.
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

export type { CuttingResult, CuttingKind, CuttingFn, LossMode } from './types';

// 구현 완료
export { calcRollWall, type RollWallInput } from './rollWall';

// 인터페이스만 (TODO 스텁)
export { calcSheet, type SheetInput, type SheetSpec, type RoomRect } from './sheet';
export { calcRollFloor, type RollFloorInput, type RollFloorSpec } from './rollFloor';
export { calcFabric, type FabricInput, type FabricSpec, type WindowSize } from './fabric';
export { calcLinear, type LinearInput, type LinearSpec, type WallRun } from './linear';
