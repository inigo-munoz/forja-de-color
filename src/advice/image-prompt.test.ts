import { SEED_INVENTORY } from '../paints/seed';
import { buildImagePrompt } from './image-prompt';
import type { RecipeResponse } from './schema';

const V = (code: string) => ({ brand: 'Vallejo', code });
const recipe: RecipeResponse = {
  version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [],
  zones: [
    { name: 'túnica', technique: 'slapchop', paint: V('72.032'), dilution: '1:3', steps: [] },
    { name: 'cara', technique: 'bsl', bsl: { base: V('72.099'), shadow: V('72.071'), light: V('72.098') }, steps: [] },
    { name: 'peana', technique: 'slapchop', paint: { brand: 'Citadel', code: 'Abaddon Black' }, dilution: '1:1', steps: [] },
  ],
};

describe('buildImagePrompt', () => {
  const text = buildImagePrompt(recipe, SEED_INVENTORY);

  it('asks to edit the attached photo keeping pose, sculpt and framing', () => {
    expect(text).toMatch(/edit the attached photo/i);
    expect(text).toMatch(/keep the exact pose, sculpt, base and framing/i);
  });

  it('gives each slapchop zone its paint name and hex colour', () => {
    expect(text).toContain('túnica');
    expect(text).toContain('Verde Escorpena');
    expect(text).toContain('#4e8437');
  });

  it('gives a bsl zone its base colour plus shadow and light', () => {
    expect(text).toContain('cara');
    expect(text).toContain('#e3ac86'); // base 72.099 Piel
    expect(text).toContain('#926640'); // shadow 72.071
    expect(text).toContain('#ebd7b9'); // light 72.098
  });

  it('describes a zone whose paint is not owned by its reference only', () => {
    expect(text).toContain('peana');
    expect(text).toContain('Citadel Abaddon Black');
  });

  it('asks for an image only, no text answer', () => {
    expect(text).toMatch(/reply with the image only/i);
  });
});
