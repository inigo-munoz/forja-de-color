import { vi } from 'vitest';
import type { AdviceEntry } from '../advice/schema';
import { addAdvice, createProject, setLook, type Project } from '../projects/project';
import { lookOf } from '../projects/style';
import { renderAsk } from './ask-view';
import { renderProject } from './project-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());
const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await flush(); };
const recipe = {
  id: 'e1', receivedAt: '2026-11-10T10:00:00Z', unknownPaints: [], unknownBrushes: [],
  response: { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [{ name: 'capa', technique: 'slapchop', paint: { brand: 'Vallejo', code: '72.021' }, dilution: '1:3', steps: [] }] },
} as AdviceEntry;

async function setup(change: (p: Project) => Project = (p) => p) {
  const deps = await makeDeps({ resize: vi.fn(async (b: Blob) => b) });
  deps.bridge.send.mockResolvedValue('shared');
  const photoId = await deps.repo.putBlob(new Blob(['photo'], { type: 'image/jpeg' }));
  await deps.repo.saveProject(change({ ...createProject('Bárbara', deps.now(), 'p1'), initialPhotoBlobId: photoId }));
  return { deps, root: mount() };
}
const select = (root: HTMLElement, id: string, value: string) => {
  const el = root.querySelector<HTMLSelectElement>(`[data-testid="${id}"]`)!;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const click = (root: HTMLElement, id: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click();

describe('painting style', () => {
  it('a project shows my method and no base setting by default, with a line explaining the style', async () => {
    const { deps, root } = await setup();
    await renderProject(root, deps, 'p1');
    expect(root.querySelector<HTMLSelectElement>('[data-testid="look-style"]')!.value).toBe('my-method');
    expect(root.querySelector<HTMLSelectElement>('[data-testid="look-base"]')!.value).toBe('');
    expect(root.querySelector('[data-testid="look-style-help"]')!.textContent).toContain('BSL');
  });

  it('choosing a style and a base setting in the project saves them', async () => {
    const { deps, root } = await setup();
    await renderProject(root, deps, 'p1');
    select(root, 'look-style', 'osl');
    await ticks();
    select(root, 'look-base', 'desert');
    await ticks();
    expect(lookOf((await deps.repo.getProject('p1'))!)).toEqual({ style: 'osl', baseSetting: 'desert' });
  });

  it('the advisor prompt follows the project style, also when changed in Ask', async () => {
    const { deps, root } = await setup((p) => setLook(p, { style: 'vivid', baseSetting: 'winter' }));
    await renderAsk(root, deps, 'p1');
    expect(root.querySelector<HTMLSelectElement>('[data-testid="look-style"]')!.value).toBe('vivid');
    click(root, 'send');
    await ticks();
    expect(deps.bridge.send.mock.calls[0][0].text).toContain('STYLE: Vivid');
    expect(deps.bridge.send.mock.calls[0][0].text).toContain('BASE SETTING: winter');

    select(root, 'look-style', 'nmm');
    await ticks();
    expect((await deps.repo.getProject('p1'))!.style).toBe('nmm');
    click(root, 'send');
    await ticks();
    expect(deps.bridge.send.mock.calls[1][0].text).toContain('STYLE: NMM');
  });

  it('paint it with ChatGPT follows the project style', async () => {
    const { deps, root } = await setup((p) => addAdvice(setLook(p, { style: 'grimdark', baseSetting: 'fantasy' }), recipe));
    await renderProject(root, deps, 'p1');
    root.querySelector<HTMLButtonElement>('[data-entry="e1"] [data-testid="paint-image"]')!.click();
    await ticks();
    const text = deps.bridge.send.mock.calls[0][0].text;
    expect(text).toContain('Painting style: grimdark');
    expect(text).toContain('Base: magical ground');
  });

  it('a free-text base motif is saved and sent to the advisor', async () => {
    const { deps, root } = await setup();
    await renderProject(root, deps, 'p1');
    const motif = root.querySelector<HTMLInputElement>('[data-testid="look-motif"]')!;
    motif.value = 'río de lava';
    motif.dispatchEvent(new Event('change', { bubbles: true }));
    await ticks();
    expect((await deps.repo.getProject('p1'))!.baseMotif).toBe('río de lava');
  });

  it('a recipe shows the basing materials the advisor recommends', async () => {
    const withMaterials = { ...recipe, response: { ...recipe.response, baseMaterials: ['arena fina', 'nieve artificial'] } } as AdviceEntry;
    const { deps, root } = await setup((p) => addAdvice(p, withMaterials));
    await renderProject(root, deps, 'p1');
    const box = root.querySelector('[data-testid="base-materials"]')!;
    expect(box.textContent).toContain('arena fina');
    expect(box.textContent).toContain('nieve artificial');
  });
});
