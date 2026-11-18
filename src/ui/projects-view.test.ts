import { vi } from 'vitest';
import { createProject, markDone } from '../projects/project';
import { renderProjects } from './projects-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());

describe('projects view', () => {
  it('creates a project with its photo stored resized, then opens it', async () => {
    const resize = vi.fn(async () => new Blob(['small'], { type: 'image/jpeg' }));
    const deps = await makeDeps({ resize });
    const root = mount();
    await renderProjects(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="new-project"]')!;
    (form.elements.namedItem('name') as HTMLInputElement).value = 'Bárbara';
    const input = form.elements.namedItem('photo') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['big-photo'], 'p.jpg', { type: 'image/jpeg' })] });
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    for (let i = 0; i < 8; i++) await flush();
    const [p] = await deps.repo.listProjects();
    expect(p.name).toBe('Bárbara');
    expect(resize).toHaveBeenCalledOnce();
    expect((await deps.repo.getBlob(p.initialPhotoBlobId!))?.size).toBe(5);
    expect(deps.navigate).toHaveBeenCalledWith(`#/project/${p.id}`);
  });

  it('several photos at once: the first is the main one, up to three more are angles', async () => {
    const deps = await makeDeps({ resize: vi.fn(async (f: Blob) => f) });
    const root = mount();
    await renderProjects(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="new-project"]')!;
    (form.elements.namedItem('name') as HTMLInputElement).value = 'Búho';
    const input = form.elements.namedItem('photo') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, 'files', { value: ['1', '22', '333', '4444', '55555'].map((b) => new File([b], 'p.jpg', { type: 'image/jpeg' })) });
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    for (let i = 0; i < 12; i++) await flush();
    const [p] = await deps.repo.listProjects();
    const sizes = await Promise.all([p.initialPhotoBlobId!, ...p.extraPhotoBlobIds!].map(async (id) => (await deps.repo.getBlob(id))!.size));
    expect(sizes).toEqual([1, 2, 3, 4]);
  });

  it('lists projects in progress before finished ones', async () => {
    const deps = await makeDeps();
    await deps.repo.saveProject(markDone(createProject('Terminada', deps.now(), 'a')));
    await deps.repo.saveProject(createProject('En curso', deps.now(), 'b'));
    const root = mount();
    await renderProjects(root, deps);
    const names = [...root.querySelectorAll('[data-testid="project-link"]')].map((a) => a.textContent);
    expect(names[0]).toContain('En curso');
    expect(names[1]).toContain('Terminada');
  });
});
