import { SEED_INVENTORY } from '../paints/seed';
import { buildAdvicePackage } from './package';
import { parseAdviceResponse } from './parse';

const V = (code: string) => ({ brand: 'Vallejo', code });
const base = { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [] };
const zone = (extra: Record<string, unknown> = {}) => ({ name: 'capa', technique: 'slapchop', paint: V('72.021'), dilution: '1:3', steps: [], ...extra });
const parse = (o: unknown) => parseAdviceResponse(typeof o === 'string' ? o : JSON.stringify(o), SEED_INVENTORY);
const photo = new Blob(['x']);

describe('parse hardening — the prompt pasted back by mistake', () => {
  it.each(['start', 'half-painted', 'during'] as const)('rejects the %s prompt itself', (moment) => {
    const pkg = buildAdvicePackage({ moment, zone: 'capa', question: 'light' }, SEED_INVENTORY, photo);
    const r = parse(pkg.text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/prompt/i);
  });
});

describe('parse hardening — malformed optional fields are rejected, not stored', () => {
  it.each([
    ['remainingSteps as a string', { ...base, moment: 'half-painted', zones: [zone()], remainingSteps: 'acabar' }, /remainingSteps/],
    ['brush as a number', { ...base, zones: [zone({ brush: 5 })] }, /brush/],
    ['alreadyPainted as a string', { ...base, zones: [zone({ alreadyPainted: 'yes' })] }, /alreadyPainted/],
    ['an unknown techniqueCard', { version: 1, kind: 'consultation', zone: 'capa', question: 'light', technique: 't', steps: [], paints: [], techniqueCard: 'slapchop | dilution' }, /techniqueCard/],
    ['a consultation brush as an object', { version: 1, kind: 'consultation', zone: 'capa', question: 'light', technique: 't', steps: [], paints: [], brush: {} }, /brush/],
  ])('%s', (_label, obj, error) => {
    const r = parse(obj);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(error);
  });
});

describe('parse hardening — reasonable answers are accepted', () => {
  it('accepts "1:3 (pintura:agua)" and "1 : 3", normalized to "1:3"', () => {
    for (const dilution of ['1:3 (pintura:agua)', '1 : 3']) {
      const r = parse({ ...base, zones: [zone({ dilution })] });
      expect(r.ok).toBe(true);
      if (r.ok) expect((r.entry.response as { zones: { dilution?: string }[] }).zones[0].dilution).toBe('1:3');
    }
  });

  it('accepts version "1" as 1', () => {
    const r = parse({ ...base, version: '1', zones: [zone()] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.response.version).toBe(1);
  });

  it('accepts an already-painted slapchop zone with no paint or dilution', () => {
    const r = parse({ ...base, moment: 'half-painted', zones: [{ name: 'capa', technique: 'slapchop', steps: [], alreadyPainted: true }] });
    expect(r.ok).toBe(true);
  });
});
