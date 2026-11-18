import { SEED_INVENTORY } from '../paints/seed';
import type { Inventory, Paint } from '../paints/paint';
import { buildAdvicePackage, buildBrainInstructions } from './package';
import type { RecipeResponse } from './schema';

const photo = new Blob(['x']);
const V = (code: string) => ({ brand: 'Vallejo', code });
const recipe: RecipeResponse = {
  version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [],
  zones: [
    { name: 'plumaje', technique: 'slapchop', paint: V('72.021'), dilution: '1:3', steps: [] },
    { name: 'cara', technique: 'bsl', bsl: { base: V('72.099'), shadow: V('72.071'), light: V('72.098') }, steps: [] },
    { name: 'peana', technique: 'slapchop', paint: { brand: 'Citadel', code: 'Abaddon Black' }, dilution: '1:1', steps: [] },
  ],
};
const ink: Paint = { brand: 'Vallejo', code: '72.091', name: 'Sepia', range: 'Game Color', type: 'ink', hex: '#563d27' };
const withInk: Inventory = { ...SEED_INVENTORY, paints: [...SEED_INVENTORY.paints, ink] };

describe('advice prompt for a miniature already started', () => {
  it("the inventory says each paint's type", () => {
    const text = buildAdvicePackage({ moment: 'start' }, withInk, photo).text;
    expect(text).toContain('INVENTORY (brand|code|name|family|order|role|type)');
    expect(text).toContain('Vallejo|72.003|Carne Pálida|BSL Warm Flesh|1|extra light|opaque');
    expect(text).toContain('Vallejo|72.091|Sepia|Game Color|||ink');
  });

  it('the "no translucent paints" rule appears only without inks or washes', () => {
    expect(buildAdvicePackage({ moment: 'start' }, SEED_INVENTORY, photo).text).toContain('I have no translucent paints');
    const text = buildAdvicePackage({ moment: 'start' }, withInk, photo).text;
    expect(text).not.toContain('I have no translucent paints');
    expect(text).toContain('use my inks and washes where they suit');
    expect(buildBrainInstructions(withInk)).toContain('use my inks and washes where they suit');
  });

  it('half-painted carries the earlier recipe, its paints and which zones are painted', () => {
    const text = buildAdvicePackage({ moment: 'half-painted', previous: { response: recipe, doneZones: [0] } }, SEED_INVENTORY, photo).text;
    const at = text.indexOf('PREVIOUS RECIPE');
    expect(at).toBeGreaterThan(text.indexOf('MOMENT: half-painted'));
    expect(at).toBeLessThan(text.indexOf('ANSWER FORMAT'));
    expect(text).toContain('keep these colours unless there is a reason to change them');
    expect(text).toContain('- plumaje (slapchop): Azul Mágico (Vallejo 72.021). Painted.');
    expect(text).toContain('- cara (bsl): base Piel (Vallejo 72.099), shadow Piel de Bárbaro (Vallejo 72.071), light Carne Élfica (Vallejo 72.098). Not painted yet.');
    expect(text).toContain('- peana (slapchop): Citadel Abaddon Black. Not painted yet.');
  });

  it('other moments, or no earlier recipe, add no previous recipe', () => {
    expect(buildAdvicePackage({ moment: 'start', previous: { response: recipe } }, SEED_INVENTORY, photo).text).not.toContain('PREVIOUS RECIPE');
    expect(buildAdvicePackage({ moment: 'half-painted' }, SEED_INVENTORY, photo).text).not.toContain('PREVIOUS RECIPE');
  });
});
