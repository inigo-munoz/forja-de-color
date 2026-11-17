import { findPaint } from './inventory';
import type { Paint } from './paint';
import { SEED_INVENTORY } from './seed';

/**
 * The paint's English name: its own, else the seed's for the same brand + code (inventories stored
 * before English names existed). Never written back to stored data. Same rule as the Android app.
 */
export function englishName(paint: Paint): string | undefined {
  return paint.nameEn?.trim() || findPaint(SEED_INVENTORY, paint)?.nameEn;
}

/** "Blanco Calavera · Dead White"; just the name when there is no English one or it is the same. */
export function displayName(paint: Paint): string {
  const en = englishName(paint);
  return en && en.toLowerCase() !== paint.name.trim().toLowerCase() ? `${paint.name} · ${en}` : paint.name;
}
