import { vi } from 'vitest';
import type { AdviceEntry } from '../advice/schema';
import { addAdvice, createProject } from '../projects/project';
import { renderAsk } from './ask-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());
const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await flush(); };
const V = (code: string) => ({ brand: 'Vallejo', code });
const answer = JSON.stringify({
  version: 1, kind: 'recipe', moment: 'start', prep: ['Imprimar en negro'], tips: ['Capas finas'],
  zones: [{ name: 'capa', technique: 'slapchop', paint: V('72.021'), dilution: '1:3', steps: ['Veladura'] }],
});
const priorRecipe = {
  id: 'e0', receivedAt: '2026-11-10T10:00:00Z', unknownPaints: [], unknownBrushes: [],
  response: { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [{ name: 'capa', technique: 'slapchop', paint: V('72.021'), dilution: '1:3', steps: [] }] },
} as AdviceEntry;

async function setup(readAnswer: string | null = answer, sendResult: 'shared' | 'fallback' = 'shared') {
  const deps = await makeDeps({ resize: vi.fn(async (b: Blob) => b) });
  deps.bridge.readAnswer.mockResolvedValue(readAnswer);
  deps.bridge.send.mockResolvedValue(sendResult);
  const photoId = await deps.repo.putBlob(new Blob(['photo'], { type: 'image/jpeg' }));
  await deps.repo.saveProject({ ...addAdvice(createProject('Bárbara', deps.now(), 'p1'), priorRecipe), initialPhotoBlobId: photoId });
  const root = mount();
  await renderAsk(root, deps, 'p1');
  return { deps, root };
}
const click = (root: HTMLElement, id: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click();
const choose = (root: HTMLElement, moment: string) => {
  const radio = root.querySelector<HTMLInputElement>(`input[name="moment"][value="${moment}"]`)!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('ask view', () => {
  it('offers the four moments, primed right after start', async () => {
    const { root } = await setup();
    const values = [...root.querySelectorAll<HTMLInputElement>('input[name="moment"]')].map((r) => r.value);
    expect(values).toEqual(['start', 'primed', 'half-painted', 'during']);
  });

  it('asks zone and question only while painting, offering the recipe zones', async () => {
    const { root } = await setup();
    expect(root.querySelector('[data-testid="during-fields"]')?.hasAttribute('hidden')).toBe(true);
    choose(root, 'during');
    expect(root.querySelector('[data-testid="during-fields"]')?.hasAttribute('hidden')).toBe(false);
    expect([...root.querySelectorAll('[data-testid="zone"] option')].map((o) => o.textContent)).toContain('capa');
  });

  it('sends a package built for the chosen moment, using the project photo when none is picked', async () => {
    const { deps, root } = await setup();
    choose(root, 'during');
    root.querySelector<HTMLSelectElement>('[data-testid="question"]')!.value = 'highlight';
    click(root, 'send');
    await ticks();
    const pkg = deps.bridge.send.mock.calls[0][0];
    expect(pkg.text).toContain('"kind": "consultation"');
    expect(pkg.text).toContain('capa');
    expect(pkg.text).toContain('highlight');
    expect(pkg.image.size).toBe(5);
  });

  it('explains the fallback when the share sheet could not be used', async () => {
    const { root } = await setup(answer, 'fallback');
    click(root, 'send');
    await ticks();
    expect(root.textContent).toContain('Prompt copied and image downloaded — paste both in your chat');
  });

  it('saves a valid pasted answer and opens the project, with no confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { deps, root } = await setup();
    click(root, 'send');
    await ticks();
    click(root, 'paste');
    await ticks();
    const p = await deps.repo.getProject('p1');
    expect(p?.advice).toHaveLength(2);
    expect(deps.navigate).toHaveBeenCalledWith('#/project/p1');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows a textarea when the clipboard cannot be read, and saves from it', async () => {
    const { deps, root } = await setup(null);
    click(root, 'paste');
    await ticks();
    const area = root.querySelector<HTMLTextAreaElement>('[data-testid="answer"]')!;
    expect(area.hasAttribute('hidden')).toBe(false);
    area.value = 'Aquí va:\n```json\n' + answer + '\n```';
    click(root, 'save-answer');
    await ticks();
    expect((await deps.repo.getProject('p1'))?.advice).toHaveLength(2);
  });

  it('shows every error and keeps the pasted text when the answer is invalid', async () => {
    const bad = JSON.stringify({ version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [{ name: 'capa', technique: 'slapchop', steps: [] }] });
    const { deps, root } = await setup(bad);
    click(root, 'paste');
    await ticks();
    const errors = root.querySelector('[data-testid="answer-errors"]')!.textContent!;
    expect(errors).toMatch(/capa.*paint/);
    expect(errors).toMatch(/capa.*dilution/);
    expect(root.querySelector<HTMLTextAreaElement>('[data-testid="answer"]')!.value).toBe(bad);
    expect((await deps.repo.getProject('p1'))?.advice).toHaveLength(1);
  });
});

describe('ask view — review fixes', () => {
  it('shows the prompt in a copyable box when the share sheet could not be used', async () => {
    const { root } = await setup(answer, 'fallback');
    click(root, 'send');
    await ticks();
    const box = root.querySelector<HTMLTextAreaElement>('[data-testid="prompt"]')!;
    expect(box.hasAttribute('hidden')).toBe(false);
    expect(box.value).toContain('ANSWER FORMAT');
  });

  it('shows an error instead of failing silently when saving throws', async () => {
    const { deps, root } = await setup();
    vi.spyOn(deps.repo, 'saveProject').mockRejectedValue(new Error('QuotaExceededError'));
    click(root, 'paste');
    await ticks();
    expect(root.querySelector('[data-testid="answer-errors"]')?.textContent).toContain('QuotaExceededError');
  });

  it('after sharing, says the instructions are copied and how to paste them, since Claude keeps only the photo', async () => {
    const { root } = await setup();
    click(root, 'send');
    await ticks();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Instructions copied');
  });

  it('half-painted without a new photo or progress photos asks for a current one instead of sending the unpainted photo', async () => {
    const { deps, root } = await setup();
    choose(root, 'half-painted');
    click(root, 'send');
    await ticks();
    expect(deps.bridge.send).not.toHaveBeenCalled();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('current photo');
  });

  it('half-painted sends the earlier recipe and the zones ticked as painted', async () => {
    const { deps, root } = await setup();
    const p = (await deps.repo.getProject('p1'))!;
    await deps.repo.saveProject({ ...p, progress: [{ id: 'g1', takenAt: '2026-11-12T10:00:00.000Z', blobId: p.initialPhotoBlobId! }], advice: [{ ...p.advice[0], doneZones: [0] }] });
    await renderAsk(root, deps, 'p1');
    choose(root, 'half-painted');
    click(root, 'send');
    await ticks();
    const text = deps.bridge.send.mock.calls[0][0].text;
    expect(text).toContain('PREVIOUS RECIPE');
    expect(text).toContain('- capa (slapchop): Azul Mágico (Vallejo 72.021). Painted.');
  });

  it('start sends the main photo and every angle', async () => {
    const { deps, root } = await setup();
    const p = (await deps.repo.getProject('p1'))!;
    const a = await deps.repo.putBlob(new Blob(['side'], { type: 'image/jpeg' }));
    await deps.repo.saveProject({ ...p, extraPhotoBlobIds: [a] });
    await renderAsk(root, deps, 'p1');
    click(root, 'send');
    await ticks();
    const pkg = deps.bridge.send.mock.calls[0][0];
    expect(pkg.image.size).toBe(5);
    expect(pkg.extraImages.map((b: Blob) => b.size)).toEqual([4]);
  });

  it('primed without angles sends the latest progress photo, as before', async () => {
    const { deps, root } = await setup();
    const p = (await deps.repo.getProject('p1'))!;
    const prog = await deps.repo.putBlob(new Blob(['primed!'], { type: 'image/jpeg' }));
    await deps.repo.saveProject({ ...p, progress: [{ id: 'g1', takenAt: '2026-11-12T10:00:00.000Z', blobId: prog }] });
    await renderAsk(root, deps, 'p1');
    choose(root, 'primed');
    click(root, 'send');
    await ticks();
    const pkg = deps.bridge.send.mock.calls[0][0];
    expect(pkg.image.size).toBe(7);
    expect(pkg.extraImages).toBeUndefined();
  });

  it('the project photos are chosen in a panel; half-painted starts with the latest progress photo', async () => {
    const { deps, root } = await setup();
    const p = (await deps.repo.getProject('p1'))!;
    const old = await deps.repo.putBlob(new Blob(['old'], { type: 'image/jpeg' }));
    const now = await deps.repo.putBlob(new Blob(['now!!!'], { type: 'image/jpeg' }));
    await deps.repo.saveProject({ ...p, progress: [{ id: 'g1', takenAt: '2026-11-12T10:00:00.000Z', blobId: old }, { id: 'g2', takenAt: '2026-11-14T10:00:00.000Z', blobId: now }] });
    await renderAsk(root, deps, 'p1');
    choose(root, 'half-painted');
    expect(root.querySelectorAll('[data-testid="ask-chosen-photo"]')).toHaveLength(1);
    expect(root.querySelector<HTMLElement>('[data-testid="ask-project-photos"]')!.hidden).toBe(true);

    click(root, 'ask-choose-project-photo');
    const tiles = root.querySelectorAll<HTMLButtonElement>('[data-testid="ask-project-photo"]');
    expect(tiles).toHaveLength(3);
    expect(tiles[0].getAttribute('aria-pressed')).toBe('true');
    tiles[1].click();
    click(root, 'ask-project-photos-done');
    expect(root.querySelectorAll('[data-testid="ask-chosen-photo"]')).toHaveLength(2);

    click(root, 'send');
    await ticks();
    const pkg = deps.bridge.send.mock.calls[0][0];
    expect([pkg.image.size, ...pkg.extraImages.map((b: Blob) => b.size)]).toEqual([6, 3]);
  });
});
