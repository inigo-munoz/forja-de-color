import { addBrush, savePaintKeepingFamily } from '../paints/inventory';
import type { Inventory, Paint } from '../paints/paint';
import { MAX_SCAN_ANSWER_CHARS, applyScan, buildScanPrompt, parseScanAnswer, type ScanResult } from './scan';

const owned: Paint = { brand: 'Vallejo', code: '72.001', name: 'Blanco Calavera', range: 'Game Color', type: 'opaque', hex: '#ffffff', family: { name: 'BSL Black', order: 1 } };
const inv: Inventory = { paints: [owned], brushes: [{ code: '2', name: 'Round' }] };
const answer = (body: string) => 'Here is what I see:\n```json\n' + body + '\n```\nHappy painting!';
const success = (raw: string) => {
  const r = parseScanAnswer(raw, inv);
  if (!r.ok) throw new Error(r.errors.join());
  return r;
};
const errors = (raw: string) => (parseScanAnswer(raw, inv) as Extract<ScanResult, { ok: false }>).errors;

describe('scan answer', () => {
  it('the instructions ask for the scan JSON and say not to guess codes', () => {
    const prompt = buildScanPrompt();
    expect(prompt).toContain('"kind": "inventory"');
    expect(prompt).toContain('PAINT SCAN FORMAT');
    expect(prompt).toContain('leave "code" empty');
  });

  it('reads paints and brushes, normalizing codes and marking the ones already owned', () => {
    const r = success(answer(`{"version": 1, "kind": "inventory",
      "paints": [
        {"brand": "Vallejo", "code": "72001", "name": "Dead White", "range": "Game Color", "type": "opaque", "hex": "#FFFFFF"},
        {"brand": "Vallejo", "code": "72.090", "name": "Black Wash", "range": "Game Wash", "type": "wash", "hex": "#1a1a1a"}
      ],
      "brushes": [{"code": "2", "name": "Round kolinsky"}, {"code": "0", "name": "Detail"}]}`));
    expect(r.paints.map((p) => p.paint.code)).toEqual(['72.001', '72.090']);
    expect(r.paints[0].paint.hex).toBe('#ffffff');
    expect(r.paints[0].existing).toEqual(owned);
    expect(r.paints[1].existing).toBeUndefined();
    expect(r.paints[1].paint.type).toBe('wash');
    expect(r.brushes[0].existing).toEqual({ code: '2', name: 'Round' });
    expect(r.brushes[1].existing).toBeUndefined();
  });

  it('is lenient with what the AI gets loosely right', () => {
    const r = success(`{"version": "1", "kind": "inventory",
      "paints": [
        {"brand": "Army Painter", "code": "", "name": "Dragon Red", "type": "Opaque", "hex": "red", "extra": 1},
        {"brand": "Vallejo", "code": "72.001", "name": "Dead White", "type": "glossy"},
        {"brand": "Vallejo", "code": "72001", "name": "Dead White again"},
        {"brand": "Vallejo", "code": "", "name": ""}
      ]}`);
    expect(r.paints.map((p) => p.paint.name)).toEqual(['Dragon Red', 'Dead White']);
    expect(r.paints[0].paint).toMatchObject({ code: '', type: 'opaque', hex: '#888888', range: '' });
    expect(r.paints[1].paint.type).toBe('other');
    expect(r.brushes).toEqual([]);
  });

  it('explains what is wrong with an answer it cannot use, with the Android messages', () => {
    expect(errors('I could not read any label, sorry.')).toEqual(['no JSON found in the answer']);
    expect(errors('```json\n{"version": 1, "kind": "inventory",\n```')[0]).toMatch(/^invalid JSON/);
    expect(errors('{"version": 2, "kind": "inventory", "paints": []}')).toEqual(['version must be 1']);
    expect(errors('{"version": 1, "kind": "recipe"}')).toEqual(['this answer is not a paint list']);
    expect(errors('{"version": 1, "kind": "inventory", "paints": {}}')).toEqual(['paints must be a list']);
    expect(errors('{"version": 1, "kind": "inventory", "paints": [], "brushes": []}')).toEqual(['the AI did not find any paints or brushes']);
    expect(errors(buildScanPrompt())).toEqual(['this is the prompt, not the AI answer: paste what the AI replied']);
    expect(errors('x'.repeat(MAX_SCAN_ANSWER_CHARS + 1))).toEqual(['the answer is too long']);
  });

  it('keeps at most the first 200 paints', () => {
    const paints = Array.from({ length: 250 }, (_, i) => `{"brand": "Vallejo", "code": "70.${101 + i}", "name": "P${i + 1}"}`).join(',');
    expect(success(`{"version": 1, "kind": "inventory", "paints": [${paints}]}`).paints).toHaveLength(200);
  });
});

describe('saving a scan', () => {
  it('a confirmed paint replaces the owned one but keeps its BSL family', () => {
    const updated = savePaintKeepingFamily(inv, { ...owned, code: '72001', name: 'Dead White', family: undefined });
    expect(updated.paints).toEqual([{ ...owned, name: 'Dead White' }]);
  });

  it('a brush with an existing code is updated, a new one is added', () => {
    const updated = addBrush(addBrush(inv, { code: ' 2 ', name: 'Round kolinsky' }), { code: '0', name: 'Detail' });
    expect(updated.brushes).toEqual([{ code: '2', name: 'Round kolinsky' }, { code: '0', name: 'Detail' }]);
  });

  it('applying a scan saves the confirmed items and skips incomplete ones', () => {
    const newPaint: Paint = { brand: 'Vallejo', code: '72.090', name: 'Black Wash', range: 'Game Wash', type: 'wash', hex: '#1a1a1a' };
    const noCode: Paint = { brand: 'Army Painter', code: '', name: 'Dragon Red', range: '', type: 'opaque', hex: '#aa0000' };
    const updated = applyScan(inv, [newPaint, noCode], [{ code: '0', name: 'Detail' }, { code: '', name: 'Nameless' }]);
    expect(updated.paints).toEqual([owned, newPaint]);
    expect(updated.brushes).toEqual([{ code: '2', name: 'Round' }, { code: '0', name: 'Detail' }]);
  });
});
