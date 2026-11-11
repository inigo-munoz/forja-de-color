import type { AdvisorBridge } from '../advice/bridge';
import type { Repository } from '../storage/repository';

export interface Deps {
  repo: Repository;
  bridge: AdvisorBridge;
  now: () => Date;
  navigate: (hash: string) => void;
  /** Photo resizer; defaults to platform/image resizeImage. Injected so views are testable without canvas. */
  resize?: (photo: Blob) => Promise<Blob>;
}

export type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Tiny element builder: h('button', { onclick, 'data-testid': 'x' }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'value' && 'value' in el) (el as HTMLInputElement).value = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function swatch(hex: string): HTMLElement {
  return h('span', { class: 'swatch', 'data-testid': 'swatch', style: `background:${hex}` });
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replaces root's children, skipping null/undefined/false (replaceChildren would render them as text). */
export function show(root: HTMLElement, ...children: Child[]): void {
  root.replaceChildren(...children.filter((c): c is Node | string => c !== null && c !== undefined && c !== false));
}

/** Object URL for a stored blob, or null when it is missing. */
export async function blobUrl(deps: Deps, id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const blob = await deps.repo.getBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}
