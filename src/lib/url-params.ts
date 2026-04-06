/**
 * URL 파라미터 인코딩/디코딩 — v3
 */

import type { CalculatorInput } from '@/types/calculator';
import { createDefaultInput } from './calculator';

export function encodeToUrl(input: CalculatorInput): string {
  const params = new URLSearchParams();
  params.set('a', String(input.basic.area));
  params.set('h', input.basic.housingType);
  params.set('g', input.basic.grade);

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
      ...defaultInput.basic,
      area: parseInt(area) || 33,
      housingType: (searchParams.get('h') as CalculatorInput['basic']['housingType']) || 'old20',
      grade: (searchParams.get('g') as CalculatorInput['basic']['grade']) || 'mid',
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
