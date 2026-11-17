import type { Paint } from './paint';
import { displayName, englishName } from './names';
import { SEED_INVENTORY } from './seed';

const stored = (over: Partial<Paint> = {}): Paint => ({
  brand: 'Vallejo', code: '72.001', name: 'Blanco Calavera', range: 'Game Color', type: 'opaque', hex: '#ffffff', ...over,
});

describe('paint names', () => {
  it('every seed BSL paint has its English name', () => {
    expect(SEED_INVENTORY.paints.every((p) => !!p.nameEn)).toBe(true);
    expect(SEED_INVENTORY.paints.find((p) => p.code === '72.001')?.nameEn).toBe('Dead White');
  });

  it('a paint saved before English names existed takes it from the seed by code', () => {
    expect(englishName(stored())).toBe('Dead White');
    expect(englishName(stored({ code: '72001' }))).toBe('Dead White');
  });

  it('its own English name wins, and a paint outside the seed may have none', () => {
    expect(englishName(stored({ nameEn: 'Skull White' }))).toBe('Skull White');
    expect(englishName(stored({ brand: 'Citadel', code: 'Abaddon Black', name: 'Abaddon Black' }))).toBeUndefined();
  });

  it('shows both names, or one when they are the same or there is no English name', () => {
    expect(displayName(stored())).toBe('Blanco Calavera · Dead White');
    expect(displayName(stored({ brand: 'Citadel', code: 'X', name: 'Abaddon Black', nameEn: 'Abaddon Black' }))).toBe('Abaddon Black');
    expect(displayName(stored({ brand: 'Citadel', code: 'X', name: 'Nuln Oil' }))).toBe('Nuln Oil');
  });
});
