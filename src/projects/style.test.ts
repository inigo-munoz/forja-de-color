import { SEED_INVENTORY } from '../paints/seed';
import { buildAdvicePackage } from '../advice/package';
import { buildImagePrompt } from '../advice/image-prompt';
import type { RecipeResponse } from '../advice/schema';
import { BASE_SETTINGS, PAINTING_STYLES, isBaseSetting, isPaintingStyle, lookOf } from './style';
import { createProject, setLook } from './project';

const photo = new Blob(['x']);
const recipe: RecipeResponse = {
  version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [],
  zones: [{ name: 'capa', technique: 'slapchop', paint: { brand: 'Vallejo', code: '72.021' }, dilution: '1:3', steps: [] }],
};

describe('painting styles', () => {
  it('offers the five miniature styles and the three base settings', () => {
    expect(PAINTING_STYLES).toEqual(['my-method', 'nmm', 'osl', 'vivid', 'grimdark']);
    expect(BASE_SETTINGS).toEqual(['winter', 'desert', 'fantasy']);
    expect(isPaintingStyle('osl')).toBe(true);
    expect(isPaintingStyle('cel-shading')).toBe(false);
    expect(isBaseSetting('desert')).toBe(true);
    expect(isBaseSetting('none')).toBe(false);
  });

  it('a project without a style is painted with my method and no base setting', () => {
    const p = createProject('Búho', new Date('2026-11-17T10:00:00Z'), 'p1');
    expect(p).not.toHaveProperty('style');
    expect(p).not.toHaveProperty('baseSetting');
    expect(lookOf(p)).toEqual({ style: 'my-method' });
  });

  it('my method and no base setting leave the advisor and image prompts as they were', () => {
    const plain = buildAdvicePackage({ moment: 'start' }, SEED_INVENTORY, photo).text;
    expect(buildAdvicePackage({ moment: 'start', style: 'my-method' }, SEED_INVENTORY, photo).text).toBe(plain);
    expect(plain).not.toContain('STYLE:');
    expect(buildImagePrompt(recipe, SEED_INVENTORY, { style: 'my-method' })).toBe(buildImagePrompt(recipe, SEED_INVENTORY));
  });

  it('a chosen style and base setting go into the advisor prompt before the answer format', () => {
    const text = buildAdvicePackage({ moment: 'start', style: 'osl', baseSetting: 'winter' }, SEED_INVENTORY, photo).text;
    const style = text.indexOf('STYLE: OSL');
    expect(style).toBeGreaterThan(text.indexOf('MOMENT: start'));
    expect(style).toBeLessThan(text.indexOf('ANSWER FORMAT'));
    expect(text).toContain('BASE SETTING: winter');
  });

  it('a base setting alone adds only the base line', () => {
    const text = buildAdvicePackage({ moment: 'during', zone: 'peana', question: 'light', baseSetting: 'desert' }, SEED_INVENTORY, photo).text;
    expect(text).toContain('BASE SETTING: desert');
    expect(text).not.toContain('STYLE:');
  });

  it('each style and setting reaches the image prompt', () => {
    const text = buildImagePrompt(recipe, SEED_INVENTORY, { style: 'grimdark', baseSetting: 'fantasy' });
    expect(text).toContain('Painting style: grimdark');
    expect(text).toContain('Base: ');
    for (const style of PAINTING_STYLES.filter((s) => s !== 'my-method')) {
      expect(buildImagePrompt(recipe, SEED_INVENTORY, { style })).not.toBe(buildImagePrompt(recipe, SEED_INVENTORY));
    }
  });

  it('setLook stores a style and a setting, and my method without setting as absent', () => {
    const p = createProject('Búho', new Date('2026-11-17T10:00:00Z'), 'p1');
    const styled = setLook(p, { style: 'nmm', baseSetting: 'winter' });
    expect(lookOf(styled)).toEqual({ style: 'nmm', baseSetting: 'winter' });
    expect(setLook(styled, { style: 'my-method' })).toEqual(p);
  });
});
