import type { BslRole, Paint } from './paint';
import { findPaint } from './inventory';
import { SEED_INVENTORY } from './seed';

/**
 * The paint's BSL role: its own, else the seed's for the same brand + code when the family name matches
 * (inventories stored before roles existed). Never written back to stored data.
 */
export function bslRole(paint: Paint): BslRole | undefined {
  if (!paint.family) return undefined;
  if (paint.family.role) return paint.family.role;
  const seed = findPaint(SEED_INVENTORY, paint);
  return seed?.family?.name === paint.family.name ? seed.family.role : undefined;
}
