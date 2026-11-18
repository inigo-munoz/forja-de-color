import { SEED_INVENTORY } from '../paints/seed';
import { buildAdvicePackage } from '../advice/package';
import { buildImagePrompt } from '../advice/image-prompt';
import { parseAdviceResponse } from '../advice/parse';
import type { RecipeResponse } from '../advice/schema';
import { createProject, setLook } from './project';
import { lookOf } from './style';

const photo = new Blob(['x']);
const recipe: RecipeResponse = {
  version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [],
  zones: [{ name: 'capa', technique: 'slapchop', paint: { brand: 'Vallejo', code: '72.021' }, dilution: '1:3', steps: [] }],
};

describe('base motif', () => {
  it('a free-text motif is stored trimmed next to the base setting, and a blank one is absent', () => {
    const p = createProject('Búho', new Date('2026-11-18T10:00:00Z'), 'p1');
    expect(lookOf(setLook(p, { baseSetting: 'winter', baseMotif: '  ruinas nevadas  ' }))).toEqual({ style: 'my-method', baseSetting: 'winter', baseMotif: 'ruinas nevadas' });
    expect('baseMotif' in setLook(p, { baseMotif: '   ' })).toBe(false);
  });

  it('the advisor gets the motif and may recommend basing materials', () => {
    const text = buildAdvicePackage({ moment: 'start', baseMotif: 'lava' }, SEED_INVENTORY, photo).text;
    expect(text).toContain('BASE MOTIF: lava.');
    expect(text).toContain('"baseMaterials"');
    expect(buildAdvicePackage({ moment: 'start', baseSetting: 'desert' }, SEED_INVENTORY, photo).text).toContain('"baseMaterials"');
    expect(buildAdvicePackage({ moment: 'start' }, SEED_INVENTORY, photo).text).not.toContain('baseMaterials');
  });

  it('the image may add terrain on the base only when the base has a setting or motif', () => {
    const plain = buildImagePrompt(recipe, SEED_INVENTORY);
    const text = buildImagePrompt(recipe, SEED_INVENTORY, { baseMotif: 'lava' });
    expect(text).toContain('Base theme: lava.');
    expect(text).toContain('On the base only, you may add terrain');
    expect(plain).not.toContain('On the base only');
  });

  it('reads basing materials from the answer, and rejects a malformed list', () => {
    const ok = parseAdviceResponse(JSON.stringify({ ...recipe, baseMaterials: ['arena fina', 'nieve artificial'] }), SEED_INVENTORY);
    expect(ok.ok && ok.entry.response.kind === 'recipe' && ok.entry.response.baseMaterials).toEqual(['arena fina', 'nieve artificial']);
    const bad = parseAdviceResponse(JSON.stringify({ ...recipe, baseMaterials: 'arena' }), SEED_INVENTORY);
    expect(bad.ok ? [] : bad.errors).toContain('recipe: baseMaterials must be a list of materials');
  });
});
