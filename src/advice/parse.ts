import type { Inventory, PaintRef } from '../paints/paint';
import { paintKey } from '../paints/paint';
import { findPaint, findPaintLoose } from '../paints/inventory';
import type { AdviceEntry, AdviceResponse } from './schema';
import { allPaintRefs, mapPaintRefs } from './resolve';

export type ParseResult =
  | { ok: true; entry: Omit<AdviceEntry, 'id' | 'receivedAt'>; neededPaints: PaintRef[] }
  | { ok: false; errors: string[] };

const DILUTION = /(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)/;
const CARDS = ['slapchop', 'dilution', 'bsl', 'drybrush'];
// Markers that only appear in the prompt we send, never in a real answer.
const PROMPT_MARKERS = ['ANSWER FORMAT', 'INVENTORY (brand|code'];

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

/** Tolerates harmless variations of a reasonable answer before validating it. */
function normalize(data: unknown): unknown {
  if (!isObj(data)) return data;
  const out: Record<string, unknown> = { ...data };
  if (out.version === '1') out.version = 1;
  const fix = (d: unknown) => {
    if (typeof d !== 'string') return d;
    const m = d.match(DILUTION);
    return m ? `${m[1].replace(',', '.')}:${m[2].replace(',', '.')}` : d;
  };
  if (Array.isArray(out.zones)) out.zones = out.zones.map((z) => (isObj(z) && 'dilution' in z ? { ...z, dilution: fix(z.dilution) } : z));
  if (Array.isArray(out.paints)) out.paints = out.paints.map((p) => (isObj(p) && 'dilution' in p ? { ...p, dilution: fix(p.dilution) } : p));
  return out;
}

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
      if (z.brush !== undefined && typeof z.brush !== 'string') errors.push(`zone ${name}: brush must be a brush code`);
      if (z.alreadyPainted !== undefined && typeof z.alreadyPainted !== 'boolean') errors.push(`zone ${name}: alreadyPainted must be true or false`);
      const painted = z.alreadyPainted === true;
      if (z.technique === 'slapchop') {
        if (z.paint !== undefined || !painted) {
          if (!isRef(z.paint)) errors.push(`zone ${name}: slapchop needs a paint`);
        }
        if (z.dilution !== undefined || !painted) {
          if (typeof z.dilution !== 'string') errors.push(`zone ${name}: slapchop needs a dilution`);
          else if (!DILUTION.test(z.dilution)) errors.push(`zone ${name}: dilution "${z.dilution}" must look like "1:3"`);
        }
      } else if (z.technique === 'bsl') {
        const b = z.bsl;
        if ((b !== undefined || !painted) && (!isObj(b) || !isRef(b.base) || !isRef(b.shadow) || !isRef(b.light))) errors.push(`zone ${name}: bsl needs base, shadow and light`);
      } else errors.push(`zone ${name}: technique must be "slapchop" or "bsl"`);
    });
    if (data.complements !== undefined && !(Array.isArray(data.complements) && data.complements.every(isRef))) errors.push('recipe: complements must be paints');
    if (data.remainingSteps !== undefined && !isStrArray(data.remainingSteps)) errors.push('recipe: remainingSteps must be a list of steps');
  } else if (data.kind === 'consultation') {
    for (const f of ['zone', 'question', 'technique'] as const) {
      if (typeof data[f] !== 'string') errors.push(`consultation: missing ${f}`);
    }
    if (!isStrArray(data.steps)) errors.push('consultation: steps must be a list');
    if (!Array.isArray(data.paints) || !data.paints.every((p) => isObj(p) && isRef(p.paint))) errors.push('consultation: paints must be a list of { paint }');
    if (data.brush !== undefined && typeof data.brush !== 'string') errors.push('consultation: brush must be a brush code');
    if (data.techniqueCard !== undefined && !CARDS.includes(data.techniqueCard as string)) errors.push(`consultation: techniqueCard must be one of ${CARDS.join(', ')}`);
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
  if (PROMPT_MARKERS.some((m) => raw.includes(m))) {
    return { ok: false, errors: ['this is the prompt, not the AI answer: copy the answer from your chat and paste again'] };
  }
  const json = extractJson(raw);
  if (json === null) return { ok: false, errors: ['no JSON found in the answer'] };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] };
  }
  data = normalize(data);
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
