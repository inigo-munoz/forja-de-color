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

  it('gives each BSL family its roles from the book, lightest first', () => {
    const roles = (name: string) => byFamily(name).map((p) => p.family!.role);
    const usual = ['fourth', 'light', 'base', 'shadow'];
    for (const f of ['BSL Warm Flesh', 'BSL Flesh', 'BSL Yellow', 'BSL Orange', 'BSL Magenta', 'BSL Violet',
      'BSL Blue', 'BSL Turquoise', 'BSL Cold Green', 'BSL Black']) {
      expect(roles(f)).toEqual(usual);
    }
    expect(byFamily('BSL Blue').map((p) => p.code)).toEqual(['72.118', '72.021', '72.020', '72.019']);
    expect(byFamily('BSL Green').map((p) => [p.code, p.family!.role])).toEqual([
      ['72.122', 'fourth'], ['72.032', 'light'], ['72.123', 'light'], ['72.028', 'base'],
    ]);
    expect(roles('BSL Multipurpose')).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('includes exactly the three brushes the user owns', () => {
    expect(SEED_INVENTORY.brushes).toEqual([
      { code: 'B02001', name: 'Detail núm. 1' },
      { code: 'B02002', name: 'Detail núm. 2' },
      { code: 'B07001', name: 'Dry Brush Small' },
    ]);
  });
});
