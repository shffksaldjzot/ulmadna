/**
 * URL 파라미터 인코딩/디코딩
 * Design Ref: §8 — URL 파라미터로 선택 조건 인코딩 → 동일 결과 재현
 */

import type { CalculatorInput } from '@/types/calculator';
import { createDefaultInput } from './calculator';

export function encodeToUrl(input: CalculatorInput): string {
  const params = new URLSearchParams();
  params.set('a', String(input.basic.area));
  params.set('h', input.basic.housingType);
  params.set('r', input.basic.region);
  params.set('g', input.basic.grade);

  // ON 상태인 공정 ID만 저장 (OFF 목록이 더 짧으면 OFF를 저장)
  const onIds = input.processes.filter(p => p.enabled).map(p => p.id);
  const offIds = input.processes.filter(p => !p.enabled).map(p => p.id);

  if (offIds.length < onIds.length) {
    params.set('off', offIds.join(','));
  } else {
    params.set('on', onIds.join(','));
  }

  return `${window.location.origin}?${params.toString()}`;
}

export function decodeFromUrl(searchParams: URLSearchParams): CalculatorInput | null {
  const area = searchParams.get('a');
  if (!area) return null;

  const defaultInput = createDefaultInput();

  const input: CalculatorInput = {
    basic: {
      area: parseInt(area) || 30,
      housingType: (searchParams.get('h') as CalculatorInput['basic']['housingType']) || 'old20',
      region: (searchParams.get('r') as CalculatorInput['basic']['region']) || 'seoul',
      grade: (searchParams.get('g') as CalculatorInput['basic']['grade']) || 'mid',
      contingencyRate: defaultInput.basic.contingencyRate,
    },
    processes: defaultInput.processes,
  };

  const onParam = searchParams.get('on');
  const offParam = searchParams.get('off');

  if (onParam) {
    const onIds = onParam.split(',');
    input.processes = input.processes.map(p => ({
      ...p,
      enabled: onIds.includes(p.id),
    }));
  } else if (offParam) {
    const offIds = offParam.split(',');
    input.processes = input.processes.map(p => ({
      ...p,
      enabled: !offIds.includes(p.id),
    }));
  }

  return input;
}
