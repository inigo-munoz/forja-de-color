import type { AdviceEntry, RecipeResponse } from './schema';
import { assignUnknownPaint } from './resolve';

const unknown = { brand: 'Citadel', code: 'Abaddon Black' };
const owned = { brand: 'Vallejo', code: '72.051' };
const entry: AdviceEntry = {
  id: 'e1', receivedAt: '2026-11-11T10:00:00Z', unknownPaints: [unknown], unknownBrushes: [],
  response: {
    version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [],
    zones: [
      { name: 'peana', technique: 'slapchop', paint: unknown, dilution: '1:1', steps: [] },
      { name: 'cinturón', technique: 'slapchop', paint: unknown, dilution: '1:2', steps: [] },
    ],
  },
};

describe('assignUnknownPaint', () => {
  it('replaces every occurrence and clears it from unknownPaints', () => {
    const result = assignUnknownPaint(entry, unknown, owned);
    const zones = (result.response as RecipeResponse).zones;
    expect(zones.map((z) => z.paint)).toEqual([owned, owned]);
    expect(result.unknownPaints).toEqual([]);
  });
});
