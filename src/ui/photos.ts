import { resizeImage } from '../platform/image';
import type { Deps } from './dom';

/** Resizes and stores the first file of an <input type=file>; returns the blob id. */
export async function storePhoto(deps: Deps, input: HTMLInputElement): Promise<string | null> {
  const file = input.files?.[0];
  if (!file) return null;
  const resized = await (deps.resize ?? resizeImage)(file);
  return deps.repo.putBlob(resized);
}

/** Every chosen file, resized and stored, up to max; returns their ids in order. */
export async function storePhotos(deps: Deps, input: HTMLInputElement, max: number): Promise<string[]> {
  const ids: string[] = [];
  for (const file of [...(input.files ?? [])].slice(0, max)) {
    ids.push(await deps.repo.putBlob(await (deps.resize ?? resizeImage)(file)));
  }
  return ids;
}
