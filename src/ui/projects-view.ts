import { MAX_ANGLES, createProject } from '../projects/project';
import { copy } from './copy';
import { blobUrl, h, show, type Deps } from './dom';
import { storePhotos } from './photos';

export async function renderProjects(root: HTMLElement, deps: Deps): Promise<void> {
  const projects = await deps.repo.listProjects();
  const ordered = [...projects].sort(
    (a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'in-progress' ? -1 : 1),
  );

  const items = await Promise.all(
    ordered.map(async (p) => {
      const url = await blobUrl(deps, p.initialPhotoBlobId);
      return h('li', {},
        h('a', { href: `#/project/${encodeURIComponent(p.id)}`, 'data-testid': 'project-link' },
          url ? h('img', { src: url, alt: '', class: 'thumb' }) : null,
          ` ${p.name} · ${p.status === 'done' ? copy.projects.done : copy.projects.inProgress}`));
    }),
  );

  const form = h('form', { 'data-testid': 'new-project', class: 'card' },
    h('h3', {}, copy.projects.new),
    h('label', {}, copy.projects.name, h('input', { name: 'name', required: true })),
    h('label', {}, copy.projects.photo, h('input', { name: 'photo', type: 'file', accept: 'image/*', multiple: true })),
    h('p', { class: 'hint' }, copy.projects.anglesHelp),
    h('button', { type: 'submit' }, copy.projects.create),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    if (!name) return;
    // Several angles at once: the first is the main photo, the rest are angles.
    const [main, ...angles] = await storePhotos(deps, form.elements.namedItem('photo') as HTMLInputElement, MAX_ANGLES + 1);
    const project = {
      ...createProject(name, deps.now(), crypto.randomUUID()),
      ...(main && { initialPhotoBlobId: main }),
      ...(angles.length && { extraPhotoBlobIds: angles }),
    };
    await deps.repo.saveProject(project);
    deps.navigate(`#/project/${encodeURIComponent(project.id)}`);
  });

  show(root,
    h('h2', {}, copy.projects.title),
    items.length ? h('ul', { class: 'card' }, ...items) : h('p', {}, copy.projects.empty),
    form,
  );
}
