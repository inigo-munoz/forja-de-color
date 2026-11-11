import type { PaintRef } from '../paints/paint';
import { paintKey } from '../paints/paint';
import type { AdviceEntry, AdviceResponse } from './schema';

/** Applies fn to every PaintRef in a response, returning a new response. */
export function mapPaintRefs(r: AdviceResponse, fn: (ref: PaintRef) => PaintRef): AdviceResponse {
  if (r.kind === 'consultation') {
    return { ...r, paints: r.paints.map((p) => ({ ...p, paint: fn(p.paint) })) };
  }
  return {
    ...r,
    zones: r.zones.map((z) => ({
      ...z,
      ...(z.paint && { paint: fn(z.paint) }),
      ...(z.bsl && { bsl: { base: fn(z.bsl.base), shadow: fn(z.bsl.shadow), light: fn(z.bsl.light) } }),
    })),
    ...(r.complements && { complements: r.complements.map(fn) }),
  };
}

/** Every PaintRef in a response, in order of appearance (duplicates included). */
export function allPaintRefs(r: AdviceResponse): PaintRef[] {
  const refs: PaintRef[] = [];
  mapPaintRefs(r, (ref) => {
    refs.push(ref);
    return ref;
  });
  return refs;
}

export function assignUnknownPaint(e: AdviceEntry, unknown: PaintRef, owned: PaintRef): AdviceEntry {
  const key = paintKey(unknown);
  return {
    ...e,
    response: mapPaintRefs(e.response, (ref) => (paintKey(ref) === key ? owned : ref)),
    unknownPaints: e.unknownPaints.filter((u) => paintKey(u) !== key),
  };
}
