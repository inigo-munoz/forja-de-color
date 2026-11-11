import { normalizeCode, paintKey } from './paint';

describe('normalizeCode', () => {
  it('formats a bare 5-digit Vallejo code as NN.NNN', () => {
    expect(normalizeCode('Vallejo', '72003')).toBe('72.003');
  });

  it('trims surrounding spaces from a Vallejo code', () => {
    expect(normalizeCode('Vallejo', ' 72.003 ')).toBe('72.003');
  });

  it('only trims codes of other brands', () => {
    expect(normalizeCode('Citadel', '  Abaddon-Black ')).toBe('Abaddon-Black');
  });
});

describe('paintKey', () => {
  it('is case-insensitive on the brand', () => {
    expect(paintKey({ brand: 'VALLEJO', code: '72.003' })).toBe(paintKey({ brand: 'vallejo', code: '72.003' }));
  });
});
