import { resizeImage } from '../platform/image';
import type { Deps } from './dom';

/** Resizes and stores the first file of an <input type=file>; returns the blob id. */
export async function storePhoto(deps: Deps, input: HTMLInputElement): Promise<string | null> {
  const file = input.files?.[0];
  if (!file) return null;
  const resized = await (deps.resize ?? resizeImage)(file);
  return deps.repo.putBlob(resized);
}
