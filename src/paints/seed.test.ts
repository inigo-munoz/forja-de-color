import { SEED_INVENTORY } from './seed';
import { paintKey } from './paint';

const paints = SEED_INVENTORY.paints;
const byFamily = (name: string) =>
  paints.filter((p) => p.family?.name === name).sort((a, b) => a.family!.order - b.family!.order);

describe('seed inventory', () => {
  it('has the 48 Vallejo Game Color paints, all opaque', () => {
    expect(paints).toHaveLength(48);
    for (const p of paints) {
      expect(p.brand).toBe('Vallejo');
      expect(p.range).toBe('Game Color');
      expect(p.type).toBe('opaque');
    }
  });

  it('has 48 unique brand + code keys', () => {
    expect(new Set(paints.map(paintKey)).size).toBe(48);
  });

  it('groups them in 12 families with orders exactly 1..4', () => {
    const families = [...new Set(paints.map((p) => p.family?.name))];
    expect(families).toHaveLength(12);
    for (const f of families) {
      expect(byFamily(f!).map((p) => p.family!.order)).toEqual([1, 2, 3, 4]);
    }
  });

  it('orders BSL Black from Blanco Calavera to Negro', () => {
    const black = byFamily('BSL Black');
    expect([black[0].code, black[0].name]).toEqual(['72.001', 'Blanco Calavera']);
    expect([black[3].code, black[3].name]).toEqual(['72.051', 'Negro']);
  });

  it('starts BSL Warm Flesh with Carne Pálida', () => {
    const warm = byFamily('BSL Warm Flesh');
    expect([warm[0].code, warm[0].name]).toEqual(['72.003', 'Carne Pálida']);
  });

  it('gives every paint a lowercase #rrggbb display colour', () => {
    for (const p of paints) expect(p.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves the BSL role unset until confirmed from the book', () => {
    for (const p of paints) expect(p.family?.role).toBeUndefined();
  });

  it('includes exactly the three brushes the user owns', () => {
    expect(SEED_INVENTORY.brushes).toEqual([
      { code: 'B02001', name: 'Detail núm. 1' },
      { code: 'B02002', name: 'Detail núm. 2' },
      { code: 'B07001', name: 'Dry Brush Small' },
    ]);
  });
});
