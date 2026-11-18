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
    input.dispatchEvent(new Event('change'));
    for (let i = 0; i < 4; i++) await flush();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    for (let i = 0; i < 8; i++) await flush();
    const [p] = await deps.repo.listProjects();
    expect(p.name).toBe('Bárbara');
    expect(resize).toHaveBeenCalledOnce();
    expect((await deps.repo.getBlob(p.initialPhotoBlobId!))?.size).toBe(5);
    expect(deps.navigate).toHaveBeenCalledWith(`#/project/${p.id}`);
  });

  it('adds photos in several goes, shows each with a remove button, keeps 4 at most and makes the first the main one', async () => {
    const deps = await makeDeps({ resize: vi.fn(async (f: Blob) => f) });
    const root = mount();
    await renderProjects(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="new-project"]')!;
    (form.elements.namedItem('name') as HTMLInputElement).value = 'Búho';
    const add = async (input: HTMLInputElement, files: string[]) => {
      Object.defineProperty(input, 'files', { value: files.map((b) => new File([b], 'p.jpg', { type: 'image/jpeg' })), configurable: true });
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 6; i++) await flush();
    };
    const choose = form.elements.namedItem('photo') as HTMLInputElement;
    expect(choose.multiple).toBe(true);

    await add(choose, ['1', '22']);
    await add(choose, ['333']);
    expect(root.querySelectorAll('[data-testid="new-project-photo"]')).toHaveLength(3);
    root.querySelectorAll<HTMLButtonElement>('[data-testid="new-project-photo-remove"]')[1].click();
    await add(choose, ['4444', '55555', '666666']);
    expect(root.querySelectorAll('[data-testid="new-project-photo"]')).toHaveLength(4);
    expect(choose.disabled).toBe(true);
    expect(root.querySelector('[data-testid="new-project-photos-full"]')).not.toBeNull();

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    for (let i = 0; i < 12; i++) await flush();
    const [p] = await deps.repo.listProjects();
    const sizes = await Promise.all([p.initialPhotoBlobId!, ...p.extraPhotoBlobIds!].map(async (id) => (await deps.repo.getBlob(id))!.size));
    expect(sizes).toEqual([1, 3, 4, 5]);
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
