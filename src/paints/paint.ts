export type PaintType = 'opaque' | 'wash' | 'ink' | 'metallic' | 'medium' | 'primer' | 'other';
export type BslRole = 'base' | 'shadow' | 'light' | 'fourth';

/** Identifies a paint. `code` is always stored normalized (see normalizeCode). */
export interface PaintRef {
  brand: string;
  code: string;
}

export interface PaintFamily {
  name: string;
  /** 1 = lightest … 4 = darkest, as printed on the BSL set. */
  order: 1 | 2 | 3 | 4;
  /** From the user's BSL book; absent for families without roles. Read it through bslRole. */
  role?: BslRole;
}

export interface Paint extends PaintRef {
  /** Spanish name (the one the BSL set and the advisor use). */
  name: string;
  /** English name, when known. Absent in older data: read it through englishName. */
  nameEn?: string;
  range: string;
  type: PaintType;
  /** Approximate display colour, '#rrggbb'. Only for the interface. */
  hex: string;
  family?: PaintFamily;
}

export interface Brush {
  code: string;
  name: string;
}

export interface Inventory {
  paints: Paint[];
  brushes: Brush[];
}

const VALLEJO_DIGITS = /^\d{5}$/;

export function normalizeCode(brand: string, raw: string): string {
  const trimmed = raw.trim();
  if (brand.trim().toLowerCase() !== 'vallejo') return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return VALLEJO_DIGITS.test(digits) ? `${digits.slice(0, 2)}.${digits.slice(2)}` : trimmed;
}

export function paintKey(ref: PaintRef): string {
  return `${ref.brand.trim().toLowerCase()}|${normalizeCode(ref.brand, ref.code)}`;
}
