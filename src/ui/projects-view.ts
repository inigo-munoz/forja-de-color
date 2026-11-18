import { MAX_ANGLES, createProject } from '../projects/project';
import { copy } from './copy';
import { blobUrl, h, show, type Deps } from './dom';
import { resizeImage } from '../platform/image';

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

  // Several angles of the miniature, each shown with a remove button; the first is the main photo.
  const pending: Blob[] = [];
  const thumbs = h('div', { class: 'thumbs', 'data-testid': 'new-project-photos' });
  const full = h('p', { class: 'hint', 'data-testid': 'new-project-photos-full', hidden: true }, copy.projects.photosFull);
  const choose = h('input', { name: 'photo', type: 'file', accept: 'image/*', multiple: true });
  const refresh = () => {
    thumbs.replaceChildren(...pending.map((blob, i) => h('figure', { 'data-testid': 'new-project-photo' },
      h('img', { src: URL.createObjectURL(blob), alt: '' }),
      h('button', {
        type: 'button', class: 'secondary', 'data-testid': 'new-project-photo-remove',
        onclick: () => { pending.splice(i, 1); refresh(); },
      }, copy.projects.removePhoto))));
    const isFull = pending.length > MAX_ANGLES;
    choose.disabled = isFull;
    full.hidden = !isFull;
  };
  // Each pick adds to the list (camera or gallery, one or several at a time): no capture attribute, so
  // the gallery stays available.
  choose.addEventListener('change', async () => {
    for (const file of [...(choose.files ?? [])]) {
      if (pending.length > MAX_ANGLES) break;
      pending.push(await (deps.resize ?? resizeImage)(file));
    }
    choose.value = '';
    refresh();
  });

  const form = h('form', { 'data-testid': 'new-project', class: 'card' },
    h('h3', {}, copy.projects.new),
    h('label', {}, copy.projects.name, h('input', { name: 'name', required: true })),
    h('p', { class: 'hint' }, copy.projects.anglesHelp),
    h('label', { class: 'button secondary' }, copy.projects.choosePhotos, choose),
    thumbs, full,
    h('button', { type: 'submit' }, copy.projects.create),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    if (!name) return;
    const [main, ...angles] = await Promise.all(pending.slice(0, MAX_ANGLES + 1).map((b) => deps.repo.putBlob(b)));
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
