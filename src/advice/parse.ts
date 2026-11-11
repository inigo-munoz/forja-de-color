import type { Inventory, PaintRef } from '../paints/paint';
import { paintKey } from '../paints/paint';
import { findPaint, findPaintLoose } from '../paints/inventory';
import type { AdviceEntry, AdviceResponse } from './schema';
import { allPaintRefs, mapPaintRefs } from './resolve';

export type ParseResult =
  | { ok: true; entry: Omit<AdviceEntry, 'id' | 'receivedAt'>; neededPaints: PaintRef[] }
  | { ok: false; errors: string[] };

const DILUTION = /^\d+(\.\d+)?:\d+(\.\d+)?$/;

function extractJson(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end > start ? raw.slice(start, end + 1) : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isRef = (v: unknown): v is PaintRef => isObj(v) && typeof v.brand === 'string' && typeof v.code === 'string';

function validate(data: unknown): string[] {
  if (!isObj(data)) return ['the answer is not a JSON object'];
  if (data.version !== 1) return [`unsupported version: ${String(data.version)}`];
  const errors: string[] = [];
  if (data.kind === 'recipe') {
    if (data.moment !== 'start' && data.moment !== 'half-painted') errors.push('recipe: moment must be "start" or "half-painted"');
    if (!isStrArray(data.prep)) errors.push('recipe: prep must be a list of steps');
    if (!isStrArray(data.tips)) errors.push('recipe: tips must be a list');
    if (!Array.isArray(data.zones) || data.zones.length === 0) errors.push('recipe: zones must be a non-empty list');
    else data.zones.forEach((z, i) => {
      const name = isObj(z) && typeof z.name === 'string' ? z.name : `#${i + 1}`;
      if (!isObj(z) || typeof z.name !== 'string') return void errors.push(`zone ${name}: missing name`);
      if (!isStrArray(z.steps)) errors.push(`zone ${name}: steps must be a list`);
      if (z.technique === 'slapchop') {
        if (!isRef(z.paint)) errors.push(`zone ${name}: slapchop needs a paint`);
        if (typeof z.dilution !== 'string') errors.push(`zone ${name}: slapchop needs a dilution`);
        else if (!DILUTION.test(z.dilution.trim())) errors.push(`zone ${name}: dilution "${z.dilution}" must look like "1:3"`);
      } else if (z.technique === 'bsl') {
        const b = z.bsl;
        if (!isObj(b) || !isRef(b.base) || !isRef(b.shadow) || !isRef(b.light)) errors.push(`zone ${name}: bsl needs base, shadow and light`);
      } else errors.push(`zone ${name}: technique must be "slapchop" or "bsl"`);
    });
    if (data.complements !== undefined && !(Array.isArray(data.complements) && data.complements.every(isRef))) errors.push('recipe: complements must be paints');
  } else if (data.kind === 'consultation') {
    for (const f of ['zone', 'question', 'technique'] as const) {
      if (typeof data[f] !== 'string') errors.push(`consultation: missing ${f}`);
    }
    if (!isStrArray(data.steps)) errors.push('consultation: steps must be a list');
    if (!Array.isArray(data.paints) || !data.paints.every((p) => isObj(p) && isRef(p.paint))) errors.push('consultation: paints must be a list of { paint }');
  } else errors.push('kind must be "recipe" or "consultation"');
  return errors;
}

export function neededPaints(r: AdviceResponse): PaintRef[] {
  const seen = new Map<string, PaintRef>();
  for (const ref of allPaintRefs(r)) if (!seen.has(paintKey(ref))) seen.set(paintKey(ref), ref);
  return [...seen.values()];
}

function brushesOf(r: AdviceResponse): string[] {
  return r.kind === 'consultation' ? (r.brush ? [r.brush] : []) : r.zones.flatMap((z) => (z.brush ? [z.brush] : []));
}

export function parseAdviceResponse(raw: string, inv: Inventory): ParseResult {
  const json = extractJson(raw);
  if (json === null) return { ok: false, errors: ['no JSON found in the answer'] };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] };
  }
  const errors = validate(data);
  if (errors.length) return { ok: false, errors };

  const unknown = new Map<string, PaintRef>();
  const response = mapPaintRefs(data as AdviceResponse, (ref) => {
    const owned = findPaint(inv, ref) ?? findPaintLoose(inv, `${ref.brand} ${ref.code}`);
    if (owned) return { brand: owned.brand, code: owned.code };
    unknown.set(paintKey(ref), ref);
    return ref;
  });
  const owned = new Set(inv.brushes.map((b) => b.code.toLowerCase()));
  const unknownBrushes = [...new Set(brushesOf(response).filter((b) => !owned.has(b.trim().toLowerCase())))];

  return {
    ok: true,
    entry: { response, unknownPaints: [...unknown.values()], unknownBrushes },
    neededPaints: neededPaints(response),
  };
}
