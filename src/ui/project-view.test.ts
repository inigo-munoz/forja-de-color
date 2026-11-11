import { vi } from 'vitest';
import type { AdviceEntry } from '../advice/schema';
import { addAdvice, createProject, type Project } from '../projects/project';
import { renderProject } from './project-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());
const V = (code: string) => ({ brand: 'Vallejo', code });
const ticks = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };

const recipe: AdviceEntry = {
  id: 'e1', receivedAt: '2026-11-11T10:00:00Z', unknownPaints: [{ brand: 'Citadel', code: 'Abaddon Black' }], unknownBrushes: ['X999'],
  response: {
    version: 1, kind: 'recipe', moment: 'half-painted', prep: ['Imprimar en negro'], tips: ['Capas finas'],
    zones: [
      { name: 'capa', technique: 'slapchop', paint: V('72.021'), dilution: '1:3', steps: ['Veladura'], brush: 'X999' },
      { name: 'cara', technique: 'bsl', bsl: { base: V('72.099'), shadow: V('72.071'), light: V('72.098') }, steps: ['Base'] },
      { name: 'peana', technique: 'slapchop', paint: { brand: 'Citadel', code: 'Abaddon Black' }, dilution: '1:1', steps: [] },
      { name: 'botas', technique: 'slapchop', paint: V('72.021'), dilution: '1:2', steps: [], alreadyPainted: true },
    ],
    complements: [V('72.008')], remainingSteps: ['Barnizar'],
  },
};
const consultation: AdviceEntry = {
  id: 'e2', receivedAt: '2026-11-11T11:00:00Z', unknownPaints: [], unknownBrushes: [],
  response: { version: 1, kind: 'consultation', zone: 'capa', question: 'highlight', technique: 'Luz de filo', steps: ['Pincel seco'], paints: [{ paint: V('72.001') }], techniqueCard: 'drybrush' },
};

async function setup(p?: Project) {
  const deps = await makeDeps({ resize: vi.fn(async (b: Blob) => b) });
  const project = p ?? addAdvice(addAdvice(createProject('Bárbara', deps.now(), 'p1'), recipe), consultation);
  await deps.repo.saveProject(project);
  const root = mount();
  await renderProject(root, deps, 'p1');
  return { deps, root };
}

describe('project view — diary', () => {
  it('persists notes on blur', async () => {
    const { deps, root } = await setup();
    const notes = root.querySelector<HTMLTextAreaElement>('[data-testid="notes"]')!;
    notes.value = 'capa roja';
    notes.dispatchEvent(new Event('blur'));
    await ticks();
    expect((await deps.repo.getProject('p1'))?.notes).toBe('capa roja');
  });

  it('adds a dated progress photo', async () => {
    const { deps, root } = await setup();
    const input = root.querySelector<HTMLInputElement>('[data-testid="add-progress"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change'));
    await ticks();
    const p = await deps.repo.getProject('p1');
    expect(p?.progress).toHaveLength(1);
    expect(p?.progress[0].takenAt).toBe(deps.now().toISOString());
    expect(root.querySelectorAll('[data-testid="progress-photo"]')).toHaveLength(1);
  });

  it('sets an optional target image', async () => {
    const { deps, root } = await setup();
    const input = root.querySelector<HTMLInputElement>('[data-testid="set-target"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['t'], 't.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change'));
    await ticks();
    expect((await deps.repo.getProject('p1'))?.targetImageBlobId).toBeDefined();
  });

  it('marks done and reopens', async () => {
    const { deps, root } = await setup();
    root.querySelector<HTMLButtonElement>('[data-testid="toggle-done"]')!.click();
    await ticks();
    expect((await deps.repo.getProject('p1'))?.status).toBe('done');
    root.querySelector<HTMLButtonElement>('[data-testid="toggle-done"]')!.click();
    await ticks();
    expect((await deps.repo.getProject('p1'))?.status).toBe('in-progress');
  });
});

describe('project view — consistency', () => {
  it('keeps notes typed before marking the project done', async () => {
    const { deps, root } = await setup();
    const notes = root.querySelector<HTMLTextAreaElement>('[data-testid="notes"]')!;
    notes.value = 'no perder esto';
    notes.dispatchEvent(new Event('blur'));
    await ticks();
    root.querySelector<HTMLButtonElement>('[data-testid="toggle-done"]')!.click();
    await ticks();
    const p = await deps.repo.getProject('p1');
    expect(p?.status).toBe('done');
    expect(p?.notes).toBe('no perder esto');
  });
});

describe('project view — advice', () => {
  it('shows prep, slapchop zones with paint and dilution, bsl zones with three swatches, and tips', async () => {
    const { root } = await setup();
    const text = root.textContent!;
    expect(text).toContain('Imprimar en negro');
    expect(text).toContain('Azul Mágico');
    expect(text).toContain('1:3');
    expect(text).toContain('Capas finas');
    const cara = root.querySelector('[data-zone="cara"]')!;
    expect(cara.querySelectorAll('[data-testid="swatch"]')).toHaveLength(3);
  });

  it('shows complements, remaining steps and already-painted zones for half-painted', async () => {
    const { root } = await setup();
    const text = root.textContent!;
    expect(text).toContain('Naranja Fuego');
    expect(text).toContain('Barnizar');
    expect(root.querySelector('[data-zone="botas"]')?.textContent).toMatch(/already painted/);
  });

  it('shows a consultation with its technique, steps, paints and a technique card link', async () => {
    const { root } = await setup();
    expect(root.textContent).toContain('Luz de filo');
    expect(root.textContent).toContain('Blanco Calavera');
    expect(root.querySelector('a[href="#/technique/drybrush"]')).not.toBeNull();
  });

  it('lists each needed paint once', async () => {
    const { root } = await setup();
    const needed = [...root.querySelectorAll('[data-entry="e1"] [data-testid="needed"] li')].map((li) => li.textContent);
    expect(needed.filter((t) => t?.includes('72.021'))).toHaveLength(1);
  });

  it('flags unknown paints and brushes, and assigning a paint persists', async () => {
    const { deps, root } = await setup();
    expect(root.querySelector('[data-testid="unknown-brush"]')?.textContent).toContain('X999');
    const picker = root.querySelector<HTMLSelectElement>('[data-testid="assign"]')!;
    picker.value = 'Vallejo|72.051';
    picker.dispatchEvent(new Event('change'));
    await ticks();
    const saved = (await deps.repo.getProject('p1'))!.advice[0];
    expect(saved.unknownPaints).toEqual([]);
    const peana = (saved.response as { zones: { name: string; paint?: { code: string } }[] }).zones.find((z) => z.name === 'peana');
    expect(peana?.paint?.code).toBe('72.051');
  });
});
