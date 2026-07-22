/* Exercises shared platform behavior so regressions are caught close to the domain workflow they protect. */
import { describe, expect, it } from 'vitest';
import { getDistrictsForRegion, getTanzaniaRegions, getWardsForDistrict, isValidTanzaniaLocation } from './tanzaniaAdministrativeAreas.js';

describe('tanzaniaAdministrativeAreas', () => {
  it('lists Tanzania regions from the NBS admin hierarchy', () => {
    expect(getTanzaniaRegions()).toContain('Dar es Salaam');
    expect(getTanzaniaRegions()).toContain('Dodoma');
    expect(getTanzaniaRegions()).toHaveLength(31);
  });

  it('accepts a valid region, district, and ward/shehia combination', () => {
    expect(getDistrictsForRegion('Dar es Salaam')).toContain('Ilala');
    expect(getWardsForDistrict('Dar es Salaam', 'Ilala')).toContain('Kariakoo');
    expect(isValidTanzaniaLocation({ region: 'Dar es Salaam', district: 'Ilala', ward: 'Kariakoo' })).toBe(true);
  });

  it('rejects districts and wards that do not belong to the selected parent', () => {
    expect(isValidTanzaniaLocation({ region: 'Dar es Salaam', district: 'Dodoma', ward: 'Kariakoo' })).toBe(false);
    expect(isValidTanzaniaLocation({ region: 'Dar es Salaam', district: 'Ilala', ward: 'Chamwino' })).toBe(false);
  });
});
