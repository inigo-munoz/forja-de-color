import type { Paint } from './paint';
import { CATALOGUE, findInCatalogue, lookUpInCatalogue, paintFromCatalogue, searchCatalogue } from './catalogue';

const scanned = (over: Partial<Paint>): Paint => ({ brand: 'Vallejo', code: '', name: '', range: '', type: 'other', hex: '#888888', ...over });

describe('paint catalogue', () => {
  it('carries the Vallejo, Citadel and Army Painter lists', () => {
    const brands = new Set(CATALOGUE.map((e) => e.brand));
    expect([...brands].sort()).toEqual(['Army Painter', 'Citadel', 'Vallejo']);
    expect(CATALOGUE.length).toBeGreaterThan(2000);
    expect(findInCatalogue({ brand: 'Vallejo', code: '72.010' })).toMatchObject({ nameEn: 'Bloody Red', range: 'Game Color', type: 'opaque' });
  });

  it('finds a paint by code however it is written, or by name for Citadel', () => {
    expect(findInCatalogue({ brand: 'vallejo', code: '72010' })?.nameEn).toBe('Bloody Red');
    expect(findInCatalogue({ brand: 'Citadel', code: '', name: 'nuln oil' })).toMatchObject({ code: 'Nuln Oil', type: 'wash' });
    expect(findInCatalogue({ brand: 'Games Workshop', code: 'Abaddon Black' })?.range).toBe('Base');
    expect(findInCatalogue({ brand: 'The Army Painter', code: 'WP1401' })?.nameEn).toBe('Abomination Gore');
    expect(findInCatalogue({ brand: 'Vallejo', code: '99.999' })).toBeUndefined();
  });

  it('searches by code or name, ignoring case and accents, exact codes first', () => {
    expect(searchCatalogue('72.010')[0]).toMatchObject({ brand: 'Vallejo', code: '72.010' });
    expect(searchCatalogue('72010')[0].code).toBe('72.010');
    expect(searchCatalogue('nuln oil').map((e) => e.code)).toContain('Nuln Oil');
    expect(searchCatalogue('BLOODY red').some((e) => e.code === '72.010')).toBe(true);
    expect(searchCatalogue('')).toEqual([]);
    expect(searchCatalogue('a', 5)).toHaveLength(5);
  });

  it('a catalogue paint takes the seed Spanish name for BSL codes, else the English name', () => {
    expect(paintFromCatalogue(findInCatalogue({ brand: 'Vallejo', code: '72.001' })!)).toMatchObject({ name: 'Blanco Calavera', nameEn: 'Dead White', code: '72.001' });
    expect(paintFromCatalogue(findInCatalogue({ brand: 'Vallejo', code: '72.010' })!)).toMatchObject({ name: 'Bloody Red', nameEn: 'Bloody Red' });
    expect(paintFromCatalogue(findInCatalogue({ brand: 'Vallejo', code: '72.010' })!, 'Rojo Sanguina').name).toBe('Rojo Sanguina');
  });

  it('a scanned paint found in the catalogue takes its data, keeping a Spanish name the AI gave', () => {
    const found = lookUpInCatalogue(scanned({ code: '72010', name: 'Rojo Sanguina', nameEn: 'Blood Red', hex: '#ff0000' }));
    expect(found.fromCatalogue).toBe(true);
    expect(found.paint).toMatchObject({ brand: 'Vallejo', code: '72.010', name: 'Rojo Sanguina', nameEn: 'Bloody Red', range: 'Game Color', type: 'opaque', hex: '#d41c1c' });

    const englishOnly = lookUpInCatalogue(scanned({ brand: 'Citadel', name: 'Nuln Oil', nameEn: 'Nuln Oil' }));
    expect(englishOnly.paint).toMatchObject({ code: 'Nuln Oil', name: 'Nuln Oil', type: 'wash' });

    const unknown = scanned({ brand: 'Scale75', code: 'SC-01', name: 'Black', hex: '#111111' });
    expect(lookUpInCatalogue(unknown)).toEqual({ paint: unknown, fromCatalogue: false });
  });

  it('types each paint from its range and whole words of its name, with inks apart', () => {
    const type = (brand: string, code: string) => findInCatalogue({ brand, code })?.type;
    expect(type('Vallejo', '70.939')).toBe('ink');
    expect(type('Vallejo', '72.091')).toBe('ink');
    // Checked against Vallejo's official charts: lines the name alone does not reveal.
    expect(['72.060', '72.082', '72.103', '72.131', '70.800', '70.934', '70.831'].map((c) => type('Vallejo', c)))
      .toEqual(['metallic', 'ink', 'other', 'other', 'metallic', 'other', 'wash']);
    expect(type('Citadel', 'Leadbelcher')).toBe('metallic');
    expect(type('Citadel', 'Steel Legion Drab')).toBe('opaque');
    expect(type('Vallejo', '70.987')).toBe('opaque');
    expect(type('Army Painter', 'Ancient Stone')).toBe('opaque');
    expect(type('Vallejo', '72.007')).toBe('opaque');
    expect(type('Citadel', 'Lahmian Medium')).toBe('medium');
    expect(type('Citadel', 'Nuln Oil')).toBe('wash');
  });
});
