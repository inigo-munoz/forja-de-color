import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import type { AdvisorBridge } from '../advice/bridge';
import { openIndexedDbRepository } from '../storage/indexeddb';
import type { Deps } from './dom';

let n = 0;

export async function makeDeps(over: Partial<Deps> = {}): Promise<Deps & { bridge: AdvisorBridge & { send: ReturnType<typeof vi.fn>; readAnswer: ReturnType<typeof vi.fn> } }> {
  const repo = await openIndexedDbRepository(`ui-${++n}`);
  const bridge = { send: vi.fn().mockResolvedValue('shared'), readAnswer: vi.fn().mockResolvedValue(null) };
  return { repo, bridge, now: () => new Date('2026-11-11T10:00:00Z'), navigate: vi.fn(), ...over } as never;
}

export function mount(): HTMLElement {
  document.body.innerHTML = '<div id="root"></div>';
  return document.getElementById('root')!;
}

export const flush = () => new Promise((r) => setTimeout(r, 0));

export function stubObjectUrls(): Blob[] {
  const created: Blob[] = [];
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    created.push(b);
    return 'blob:fake';
  };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  return created;
}
