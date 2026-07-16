import { describe, expect, it } from 'vitest';
import enCommon from './locales/en/common.json';
import swCommon from './locales/sw/common.json';
import enStatic from './locales/en/procurex-static.json';
import swStatic from './locales/sw/procurex-static.json';

function flatten(value: unknown, prefix = ''): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key));
  }
  return [[prefix, value]];
}

function expectSameKeys(left: unknown, right: unknown) {
  const leftKeys = flatten(left).map(([key]) => key).sort();
  const rightKeys = flatten(right).map(([key]) => key).sort();
  expect(rightKeys).toEqual(leftKeys);
}

describe('localization resources', () => {
  it('keeps English and Swahili common namespaces in parity', () => {
    expectSameKeys(enCommon, swCommon);
    expect(swCommon.language).toBe('Lugha');
    expect(swCommon.actions.submit).toBe('Wasilisha');
    expect(swCommon.pages.dashboard.title).toBe('Dashibodi ya Kazi');
  });

  it('keeps static page maps in parity and removes generated translation artifacts', () => {
    expectSameKeys(enStatic, swStatic);
    const swValues = Object.values(swStatic).filter((value): value is string => typeof value === 'string');
    expect(swValues.join('\n')).not.toMatch(/tengenezad|hakikied|ujumbes|zabunis|mkatabas|mtumiajis|mnunuzis|mzabunis|shirikas|akauntis|warakas|malipos|uptarehed|phakiki/i);
    expect(swStatic['Create Tender']).toBe('Tengeneza Zabuni');
    expect(swStatic['Account Information']).toBe('Taarifa za Akaunti');
    expect(swStatic['View Tender']).toBe('Tazama Zabuni');
  });
});
