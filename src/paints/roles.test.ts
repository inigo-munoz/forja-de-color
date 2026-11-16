import { bslRole } from './roles';
import type { Paint } from './paint';

const stored = (code: string, family?: Paint['family']): Paint => ({
  brand: 'Vallejo', code, name: 'x', range: 'Game Color', type: 'opaque', hex: '#000000', family,
});

describe('bslRole', () => {
  it('fills the role from the seed for a stored paint without one', () => {
    expect(bslRole(stored('72.019', { name: 'BSL Blue', order: 4 }))).toBe('shadow');
    expect(bslRole(stored('72.003', { name: 'BSL Warm Flesh', order: 1 }))).toBe('fourth');
  });

  it('matches the seed through the normalized code and brand case', () => {
    expect(bslRole({ ...stored('72021', { name: 'BSL Blue', order: 2 }), brand: 'vallejo' })).toBe('light');
  });

  it('keeps an explicit role', () => {
    expect(bslRole(stored('72.019', { name: 'BSL Blue', order: 4, role: 'base' }))).toBe('base');
  });

  it('gives none when the family name differs from the seed', () => {
    expect(bslRole(stored('72.019', { name: 'Custom', order: 4 }))).toBeUndefined();
  });

  it('gives none without a family or for a paint the seed has no role for', () => {
    expect(bslRole(stored('72.019'))).toBeUndefined();
    expect(bslRole(stored('72.011', { name: 'BSL Multipurpose', order: 1 }))).toBeUndefined();
  });
});
