import type { Brush, Inventory, Paint, PaintRef } from './paint';
import { normalizeCode, paintKey } from './paint';

export function addPaint(inv: Inventory, paint: Paint): Inventory {
  const normalized: Paint = { ...paint, code: normalizeCode(paint.brand, paint.code) };
  const key = paintKey(normalized);
  const exists = inv.paints.some((p) => paintKey(p) === key);
  const paints = exists
    ? inv.paints.map((p) => (paintKey(p) === key ? normalized : p))
    : [...inv.paints, normalized];
  return { ...inv, paints };
}

export function removePaint(inv: Inventory, ref: PaintRef): Inventory {
  const key = paintKey(ref);
  return { ...inv, paints: inv.paints.filter((p) => paintKey(p) !== key) };
}

export function findPaint(inv: Inventory, ref: PaintRef): Paint | undefined {
  const key = paintKey(ref);
  return inv.paints.find((p) => paintKey(p) === key);
}

/** Resolves free text such as "Vallejo 72.003" or "72003" against every brand in the inventory. */
export function findPaintLoose(inv: Inventory, text: string): Paint | undefined {
  const token = text.match(/\d{2}\.?\d{3}/)?.[0] ?? text.trim();
  const brands = [...new Set(inv.paints.map((p) => p.brand))];
  for (const brand of brands) {
    const found = findPaint(inv, { brand, code: token });
    if (found) return found;
  }
  return undefined;
}

/**
 * Saves the paint through addPaint. A paint that replaces one in a BSL family keeps that family, so
 * updating "72003" by hand or from a scan does not drop it from its set. Same rule as the Android app.
 */
export function savePaintKeepingFamily(inv: Inventory, paint: Paint): Inventory {
  const prior = findPaint(inv, paint);
  const { family: _drop, ...rest } = paint;
  return addPaint(inv, prior?.family ? { ...rest, family: prior.family } : paint.family ? paint : rest);
}

/** The owned brush with this code (trimmed, case-insensitive), if any. */
export function findBrush(inv: Inventory, code: string): Brush | undefined {
  const c = code.trim().toLowerCase();
  return inv.brushes.find((b) => b.code.toLowerCase() === c);
}

/** Adds the brush, or replaces the one with the same code (trimmed, case-insensitive). */
export function addBrush(inv: Inventory, brush: Brush): Inventory {
  const clean: Brush = { code: brush.code.trim(), name: brush.name.trim() };
  const same = (b: Brush) => b.code.toLowerCase() === clean.code.toLowerCase();
  const brushes = inv.brushes.some(same) ? inv.brushes.map((b) => (same(b) ? clean : b)) : [...inv.brushes, clean];
  return { ...inv, brushes };
}
