import type { Inventory, Paint, PaintRef } from './paint';
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
