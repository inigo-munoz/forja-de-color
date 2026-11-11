import { SEED_INVENTORY } from '../paints/seed';
import { parseAdviceResponse } from './parse';

const recipe = (zones: unknown[], extra: Record<string, unknown> = {}) => ({
  version: 1, kind: 'recipe', moment: 'start', prep: ['Imprimar en negro'], zones, tips: ['Capas finas'], ...extra,
});
const slap = (code: string, extra: Record<string, unknown> = {}) => ({
  name: 'capa', technique: 'slapchop', paint: { brand: 'Vallejo', code }, dilution: '1:3', steps: ['Aplicar'], ...extra,
});
const parse = (obj: unknown) => parseAdviceResponse(JSON.stringify(obj), SEED_INVENTORY);

describe('parseAdviceResponse — extraction', () => {
  it('extracts JSON from prose with a ```json fence', () => {
    const raw = 'Aquí tienes:\n```json\n' + JSON.stringify(recipe([slap('72.021')])) + '\n```\n¡Suerte!';
    expect(parseAdviceResponse(raw, SEED_INVENTORY).ok).toBe(true);
  });

  it('accepts a bare JSON object', () => {
    expect(parse(recipe([slap('72.021')])).ok).toBe(true);
  });

  it('rejects text with no JSON', () => {
    const r = parseAdviceResponse('Lo siento, no puedo ayudar.', SEED_INVENTORY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/no JSON/i);
  });

  it('rejects invalid JSON', () => {
    const r = parseAdviceResponse('```json\n{ "version": 1, \n```', SEED_INVENTORY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/invalid JSON/i);
  });

  it('rejects an unsupported version', () => {
    const r = parse({ ...recipe([slap('72.021')]), version: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/unsupported version/i);
  });
});

describe('parseAdviceResponse — validation', () => {
  it('names the zone and the field when a slapchop zone has no dilution', () => {
    const r = parse(recipe([slap('72.021', { dilution: undefined, name: 'capa roja' })]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/capa roja.*dilution/);
  });

  it('accepts "1:3" and rejects "a little water" as dilution', () => {
    expect(parse(recipe([slap('72.021', { dilution: '1:3' })])).ok).toBe(true);
    expect(parse(recipe([slap('72.021', { dilution: 'a little water' })])).ok).toBe(false);
  });

  it('requires base, shadow and light on a bsl zone', () => {
    const zone = { name: 'cara', technique: 'bsl', bsl: { base: { brand: 'Vallejo', code: '72.099' } }, steps: [] };
    const r = parse(recipe([zone]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/cara.*bsl/);
  });
});

describe('parseAdviceResponse — resolution', () => {
  it('resolves loosely written codes to the owned paint', () => {
    const r = parse(recipe([slap('72021'), { ...slap('Vallejo 72.020'), name: 'botas' }]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.unknownPaints).toEqual([]);
      const zones = (r.entry.response as { zones: { paint?: { code: string } }[] }).zones;
      expect(zones.map((z) => z.paint?.code)).toEqual(['72.021', '72.020']);
    }
  });

  it('keeps the recipe and flags a paint not in the inventory', () => {
    const zone = { ...slap('x'), paint: { brand: 'Citadel', code: 'Abaddon Black' } };
    const r = parse(recipe([zone]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.unknownPaints).toEqual([{ brand: 'Citadel', code: 'Abaddon Black' }]);
  });

  it('flags a brush not in the inventory and matches owned brushes case-insensitively', () => {
    const r = parse(recipe([slap('72.021', { brush: 'b02001' }), { ...slap('72.020', { brush: 'X999' }), name: 'botas' }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.unknownBrushes).toEqual(['X999']);
  });

  it('lists a paint used in two zones only once among the needed paints', () => {
    const r = parse(recipe([slap('72.049'), { ...slap('72.049'), name: 'peana' }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.neededPaints).toEqual([{ brand: 'Vallejo', code: '72.049' }]);
  });

  it('parses a consultation', () => {
    const r = parse({
      version: 1, kind: 'consultation', zone: 'capa', question: 'highlight', technique: 'Luz de filo',
      steps: ['Pincel seco'], paints: [{ paint: { brand: 'Vallejo', code: '72.001' } }], techniqueCard: 'drybrush',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.neededPaints).toEqual([{ brand: 'Vallejo', code: '72.001' }]);
  });
});
