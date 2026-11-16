import { CARD_IDS, getCard } from './cards';

describe('technique cards', () => {
  it.each(CARD_IDS)('loads %s with a title and written sections, no placeholder left', (id) => {
    const card = getCard(id);
    expect(card.id).toBe(id);
    expect(card.title.length).toBeGreaterThan(0);
    expect(card.markdown).toMatch(/^## .+$/m);
    expect(card.markdown).not.toContain('TODO');
  });

  it('covers slapchop, dilution, bsl and drybrush', () => {
    expect([...CARD_IDS].sort()).toEqual(['bsl', 'dilution', 'drybrush', 'slapchop']);
  });
});
