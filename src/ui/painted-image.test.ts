import { vi } from 'vitest';
import type { AdviceEntry } from '../advice/schema';
import { addAdvice, createProject } from '../projects/project';
import { renderProject } from './project-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());
const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await flush(); };
const recipe = {
  id: 'e1', receivedAt: '2026-11-11T10:00:00Z', unknownPaints: [], unknownBrushes: [],
  response: { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [{ name: 'túnica', technique: 'slapchop', paint: { brand: 'Vallejo', code: '72.032' }, dilution: '1:3', steps: [] }] },
} as AdviceEntry;

async function setup(withTarget: boolean, sendResult: 'shared' | 'fallback' = 'shared') {
  const deps = await makeDeps({ resize: vi.fn(async (b: Blob) => b) });
  deps.bridge.send.mockResolvedValue(sendResult);
  const photo = await deps.repo.putBlob(new Blob(['raw'], { type: 'image/jpeg' }));
  const target = withTarget ? await deps.repo.putBlob(new Blob(['painted'], { type: 'image/jpeg' })) : undefined;
  await deps.repo.saveProject({ ...addAdvice(createProject('Druida', deps.now(), 'p1'), recipe), initialPhotoBlobId: photo, targetImageBlobId: target });
  const root = mount();
  await renderProject(root, deps, 'p1');
  return { deps, root };
}

describe('painted image via ChatGPT', () => {
  it('sends the recipe colours as an image prompt together with the unpainted photo', async () => {
    const { deps, root } = await setup(false);
    root.querySelector<HTMLButtonElement>('[data-entry="e1"] [data-testid="paint-image"]')!.click();
    await ticks();
    const pkg = deps.bridge.send.mock.calls[0][0];
    expect(pkg.text).toContain('Verde Escorpena #4e8437');
    expect(pkg.image.size).toBe(3);
  });

  it('explains how to bring the image back when the share sheet could not be used', async () => {
    const { root } = await setup(false, 'fallback');
    root.querySelector<HTMLButtonElement>('[data-entry="e1"] [data-testid="paint-image"]')!.click();
    await ticks();
    expect(root.querySelector('[data-entry="e1"]')!.textContent).toMatch(/Set target image/);
  });
});

describe('before / after comparison', () => {
  it('appears only when both the photo and the painted image exist', async () => {
    expect((await setup(false)).root.querySelector('[data-testid="compare"]')).toBeNull();
    const { root } = await setup(true);
    const compare = root.querySelector('[data-testid="compare"]')!;
    expect(compare.querySelectorAll('img')).toHaveLength(2);
  });

  it('dragging the slider reveals more of the painted image', async () => {
    const { root } = await setup(true);
    const slider = root.querySelector<HTMLInputElement>('[data-testid="compare"] input[type="range"]')!;
    const painted = root.querySelector<HTMLElement>('[data-testid="compare-painted"]')!;
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect(painted.style.clipPath).toBe('inset(0 0 0 30%)');
  });
});
