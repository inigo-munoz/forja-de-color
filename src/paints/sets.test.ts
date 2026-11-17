import { SEED_INVENTORY } from './seed';
import { PAINT_SETS, findSet, searchSets, setAsScan } from './sets';

describe('paint sets', () => {
  it("knows Vallejo's NMM sets by Ángel Giráldez, every paint in the catalogue", () => {
    expect(findSet('72212')).toMatchObject({ code: '72.212', paints: ['72.001', '72.019', '72.024', '72.050', '72.051', '72.091', '72.151', '72.153'] });
    expect(findSet('72.193')?.paints).toHaveLength(8);
    for (const set of PAINT_SETS) expect(setAsScan(set, { paints: [], brushes: [] }).paints).toHaveLength(set.paints.length);
  });

  it('finds a set by code or by words of its name', () => {
    expect(searchSets('72212').map((s) => s.code)).toEqual(['72.212']);
    expect(searchSets('nmm').map((s) => s.code)).toEqual(['72.212', '72.193']);
    expect(searchSets('giraldez')).toHaveLength(2);
    expect(searchSets('')).toEqual([]);
  });

  it('turns a set into a list to confirm: catalogue data, owned paints marked', () => {
    const list = setAsScan(findSet('72.212')!, SEED_INVENTORY);
    expect(list.paints.map((p) => [p.paint.code, !!p.existing])).toEqual([
      ['72.001', true], ['72.019', true], ['72.024', true], ['72.050', false], ['72.051', true], ['72.091', false], ['72.151', false], ['72.153', false],
    ]);
    expect(list.paints[5].paint).toMatchObject({ name: 'Sepia', type: 'ink' });
    expect(list.paints[0].paint.name).toBe('Blanco Calavera');
    expect(list.paints.every((p) => p.fromCatalogue)).toBe(true);
  });
});
