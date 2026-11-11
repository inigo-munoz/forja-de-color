import type { Inventory, Paint } from './paint';
import { addPaint, findPaint, findPaintLoose, removePaint } from './inventory';

const carnePalida: Paint = {
  brand: 'Vallejo', code: '72.003', name: 'Carne Pálida', range: 'Game Color', type: 'opaque', hex: '#e6c9a8',
  family: { name: 'BSL Warm Flesh', order: 1 },
};
const negro: Paint = {
  brand: 'Vallejo', code: '72.051', name: 'Negro', range: 'Game Color', type: 'opaque', hex: '#000000',
  family: { name: 'BSL Black', order: 4 },
};
const base: Inventory = { paints: [carnePalida, negro], brushes: [] };

describe('inventory', () => {
  it('replaces a paint with the same brand + code instead of duplicating it', () => {
    const renamed = { ...carnePalida, name: 'Renamed' };
    const result = addPaint(base, renamed);
    expect(result.paints).toHaveLength(2);
    expect(findPaint(result, { brand: 'Vallejo', code: '72.003' })?.name).toBe('Renamed');
  });

  it('adds a paint with a new key', () => {
    const other: Paint = { ...negro, code: '72.001', name: 'Blanco Calavera' };
    expect(addPaint(base, other).paints).toHaveLength(3);
  });

  it('removes a paint by reference', () => {
    expect(removePaint(base, { brand: 'Vallejo', code: '72.051' }).paints).toEqual([carnePalida]);
  });

  it('finds a paint written as "Vallejo 72.003"', () => {
    expect(findPaintLoose(base, 'Vallejo 72.003')?.name).toBe('Carne Pálida');
  });

  it('finds a paint written as a bare "72003"', () => {
    expect(findPaintLoose(base, '72003')?.name).toBe('Carne Pálida');
  });

  it('returns undefined for a paint not in the inventory', () => {
    expect(findPaintLoose(base, 'Citadel Abaddon Black')).toBeUndefined();
  });
});
