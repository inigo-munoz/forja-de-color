import { checkInCatalogue, type ScanResult } from '../scan/scan';
import { findInCatalogue, paintFromCatalogue } from './catalogue';
import type { Inventory } from './paint';

/** A boxed set whose paints are also sold one by one; added in one go through the confirmation list. */
export interface PaintSet {
  brand: string;
  code: string;
  name: string;
  /** Codes of its paints, all in the catalogue. */
  paints: string[];
}

// Contents checked with three retailers on 2026-11-17 (Miniature Market, Oakridge, Element Games).
// Same data as the Android app (domain/paints/PaintSets.kt).
export const PAINT_SETS: PaintSet[] = [
  {
    brand: 'Vallejo', code: '72.212', name: 'Non-Metallic Metal (NMM) by Ángel Giráldez',
    paints: ['72.001', '72.019', '72.024', '72.050', '72.051', '72.091', '72.151', '72.153'],
  },
  {
    brand: 'Vallejo', code: '72.193', name: 'Non-Metallic Metal (NMM) by Ángel Giráldez, new formula',
    paints: ['72.001', '72.019', '72.024', '72.062', '72.043', '72.091', '72.050', '72.051'],
  },
];

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const compact = (s: string) => fold(s).replace(/[.\s-]/g, '');

export function findSet(code: string): PaintSet | undefined {
  return PAINT_SETS.find((s) => compact(s.code) === compact(code));
}

/** Sets whose code or name matches every word of the query. */
export function searchSets(query: string): PaintSet[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return PAINT_SETS.filter((s) => words.every((w) => fold(`${s.brand} ${s.code} ${s.name}`).includes(w) || compact(s.code).includes(w.replace(/[.\s-]/g, ''))));
}

/** The set as a list to confirm, like a photo scan: catalogue data, paints the user owns marked. */
export function setAsScan(set: PaintSet, inv: Inventory): Extract<ScanResult, { ok: true }> {
  const paints = set.paints.flatMap((code) => {
    const e = findInCatalogue({ brand: set.brand, code });
    return e ? [{ paint: paintFromCatalogue(e) }] : [];
  });
  return checkInCatalogue({ ok: true, paints, brushes: [] }, inv);
}
