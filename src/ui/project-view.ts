import { lookOf } from '../projects/style';
import { lookFields } from './look-fields';
import { buildImagePrompt } from '../advice/image-prompt';
import { neededPaints } from '../advice/parse';
import { assignUnknownPaint } from '../advice/resolve';
import type { AdviceEntry, ConsultationResponse, RecipeResponse, ZoneRecipe } from '../advice/schema';
import { findPaint } from '../paints/inventory';
import type { Inventory, PaintRef } from '../paints/paint';
import { paintKey } from '../paints/paint';
import { MAX_ANGLES, addAngle, addProgressPhoto, markDone, removeAngle, reopen, setLook, setNotes, setZoneDone, type Project } from '../projects/project';
import { copy } from './copy';
import { blobUrl, h, show, swatch, type Deps } from './dom';
import { storePhoto } from './photos';

function paintLabel(inv: Inventory, ref: PaintRef, unknown: Set<string>): HTMLElement {
  const owned = findPaint(inv, ref);
  if (!owned || unknown.has(paintKey(ref))) {
    return h('span', { class: 'flag' }, `⚠ ${ref.brand} ${ref.code} (${copy.project.unknown})`);
  }
  return h('span', {}, swatch(owned.hex), h('span', { class: 'code' }, owned.code), ` ${owned.name}`);
}

function list(items: string[]): HTMLElement {
  return h('ol', {}, ...items.map((s) => h('li', {}, s)));
}

/** Ticks a zone off as painted (true) or back on (false). */
type ZoneToggle = (index: number, done: boolean) => void;

function zoneView(inv: Inventory, z: ZoneRecipe, unknown: Set<string>, index: number, done: boolean, onToggle: ZoneToggle): HTMLElement {
  const paints =
    z.technique === 'bsl' && z.bsl
      ? h('div', {}, ...(['base', 'shadow', 'light'] as const).map((role) => h('div', {}, `${role}: `, paintLabel(inv, z.bsl![role], unknown))))
      : z.paint
        ? h('div', {}, paintLabel(inv, z.paint, unknown), z.dilution ? h('strong', {}, ` · ${z.dilution}`) : null)
        : null;
  const box = h('input', { type: 'checkbox', 'data-testid': `zone_done_${index}`, 'aria-label': copy.project.zoneDone, checked: done });
  box.addEventListener('change', () => onToggle(index, box.checked));
  // A done zone stays readable, only dimmed.
  return h('section', { 'data-zone': z.name, class: done ? 'zone zone-done' : 'zone', style: done ? 'opacity:0.55' : undefined },
    h('h4', {}, box, ` ${z.name} · ${z.technique === 'bsl' ? 'BSL' : 'Slapchop'}`, z.alreadyPainted ? h('em', {}, ` (${copy.project.alreadyPainted})`) : null),
    paints,
    z.brush ? h('div', { class: 'code' }, `🖌 ${z.brush}`) : null,
    list(z.steps));
}

function recipeView(inv: Inventory, r: RecipeResponse, unknown: Set<string>, doneZones: number[], onToggle: ZoneToggle): HTMLElement[] {
  const done = new Set(doneZones);
  return [
    h('h4', {}, copy.project.prep), list(r.prep),
    h('p', { 'data-testid': 'zone_progress' }, copy.project.zoneProgress(r.zones.filter((_, i) => done.has(i)).length, r.zones.length)),
    ...r.zones.map((z, i) => zoneView(inv, z, unknown, i, done.has(i), onToggle)),
    r.complements?.length ? h('div', {}, h('h4', {}, copy.project.complements), h('ul', {}, ...r.complements.map((c) => h('li', {}, paintLabel(inv, c, unknown))))) : null,
    r.remainingSteps?.length ? h('div', {}, h('h4', {}, copy.project.remaining), list(r.remainingSteps)) : null,
    // Beyond the paint inventory, for the base only: the owner may need to buy them.
    r.baseMaterials?.length ? h('div', { 'data-testid': 'base-materials' }, h('h4', {}, copy.project.baseMaterials), list(r.baseMaterials)) : null,
    h('h4', {}, copy.project.tips), list(r.tips),
  ].filter((x): x is HTMLElement => x !== null);
}

function consultationView(inv: Inventory, c: ConsultationResponse, unknown: Set<string>): HTMLElement[] {
  return [
    h('h4', {}, `${c.zone} · ${copy.project.technique}: ${c.technique}`),
    list(c.steps),
    h('ul', {}, ...c.paints.map((p) => h('li', {}, paintLabel(inv, p.paint, unknown), p.dilution ? h('strong', {}, ` · ${p.dilution}`) : null))),
    ...(c.brush ? [h('div', { class: 'code' }, `🖌 ${c.brush}`)] : []),
    ...(c.techniqueCard ? [h('a', { href: `#/technique/${c.techniqueCard}` }, copy.project.seeTechnique)] : []),
  ];
}

const NOTES_DEBOUNCE_MS = 800;

/** Unpainted photo underneath, painted image on top clipped from the left by the slider. */
function compareView(before: string, after: string): HTMLElement {
  const painted = h('img', { src: after, alt: '', class: 'compare-after', 'data-testid': 'compare-painted' });
  const slider = h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': copy.project.compareHelp });
  const clip = () => {
    painted.style.clipPath = `inset(0 0 0 ${slider.value}%)`;
  };
  slider.addEventListener('input', clip);
  clip();
  return h('figure', { class: 'compare', 'data-testid': 'compare' },
    h('div', { class: 'compare-stage' }, h('img', { src: before, alt: '', class: 'compare-before' }), painted),
    slider,
    h('figcaption', {}, copy.project.compare));
}

// All writes from the project screen go through one queue, so two events fired back to back
// (blur on the notes + tap on "Mark as done") cannot both read the old project and race.
let queue: Promise<unknown> = Promise.resolve();
function serialize(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function renderProject(root: HTMLElement, deps: Deps, id: string): Promise<void> {
  const project = await deps.repo.getProject(id);
  if (!project) return void show(root, h('p', {}, '404'));
  const inv = await deps.repo.getInventory();
  // Every change re-reads the stored project first, so edits made elsewhere on this screen
  // (notes saved on blur, a picker) are never overwritten by the copy loaded at render time.
  const update = (change: (latest: Project) => Project, rerender = true) =>
    serialize(async () => {
      const latest = (await deps.repo.getProject(id)) ?? project;
      await deps.repo.saveProject(change(latest));
      if (rerender) await renderProject(root, deps, id);
    });

  const notes = h('textarea', { 'data-testid': 'notes' });
  notes.value = project.notes;
  // Notes are saved while typing (debounced), on blur, and when the page is hidden, so a
  // service-worker reload or Android discarding the app cannot lose them.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const saveNotes = () => {
    clearTimeout(timer);
    return update((p) => setNotes(p, notes.value), false);
  };
  notes.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => void saveNotes(), NOTES_DEBOUNCE_MS);
  });
  notes.addEventListener('blur', () => void saveNotes());
  window.addEventListener('pagehide', () => void saveNotes(), { once: true });

  // Angles of the unpainted miniature, besides the main photo (up to MAX_ANGLES).
  const angleInput = h('input', { type: 'file', accept: 'image/*', 'data-testid': 'add-angle' });
  angleInput.addEventListener('change', async () => {
    const blobId = await storePhoto(deps, angleInput);
    if (blobId) await update((p) => addAngle(p, blobId));
  });
  const angleUrls = await Promise.all((project.extraPhotoBlobIds ?? []).map(async (id) => [id, await blobUrl(deps, id)] as const));
  const angles = project.initialPhotoBlobId
    ? h('section', { class: 'card', 'data-testid': 'angles' }, h('h3', {}, copy.project.angles),
      h('div', { class: 'thumbs' }, ...angleUrls.map(([id, url]) => h('figure', { 'data-testid': 'angle-photo' },
        url ? h('img', { src: url, alt: '' }) : null,
        h('button', {
          type: 'button', class: 'secondary', 'data-testid': 'delete-angle',
          onclick: async () => {
            if (!window.confirm(copy.project.deleteAngleConfirm)) return;
            await update((p) => removeAngle(p, id));
            // Only when no project uses it any more (one restored from a backup may share it).
            const used = (await deps.repo.listProjects()).some((p) => [p.initialPhotoBlobId, ...(p.extraPhotoBlobIds ?? []), p.targetImageBlobId, ...p.progress.map((x) => x.blobId)].includes(id));
            if (!used) await deps.repo.deleteBlob(id);
          },
        }, copy.project.deleteAngle)))),
      (project.extraPhotoBlobIds?.length ?? 0) < MAX_ANGLES ? h('label', { class: 'button' }, copy.project.addAngle, angleInput) : null)
    : null;

  const progressInput = h('input', { type: 'file', accept: 'image/*', 'data-testid': 'add-progress' });
  progressInput.addEventListener('change', async () => {
    const blobId = await storePhoto(deps, progressInput);
    if (blobId) await update((p) => addProgressPhoto(p, { id: crypto.randomUUID(), takenAt: deps.now().toISOString(), blobId }));
  });
  const targetInput = h('input', { type: 'file', accept: 'image/*', 'data-testid': 'set-target' });
  targetInput.addEventListener('change', async () => {
    const blobId = await storePhoto(deps, targetInput);
    if (blobId) await update((p) => ({ ...p, targetImageBlobId: blobId }));
  });

  const photo = await blobUrl(deps, project.initialPhotoBlobId);
  const target = await blobUrl(deps, project.targetImageBlobId);
  const progress = await Promise.all(project.progress.map(async (pp) => {
    const url = await blobUrl(deps, pp.blobId);
    return h('figure', { 'data-testid': 'progress-photo' }, url ? h('img', { src: url, alt: '' }) : null, h('figcaption', {}, pp.takenAt.slice(0, 10)));
  }));

  const entryView = (e: AdviceEntry) => {
    const unknown = new Set(e.unknownPaints.map(paintKey));
    const toggleZone: ZoneToggle = (index, done) => void update((p) => setZoneDone(p, e.id, index, done));
    const body = e.response.kind === 'recipe'
      ? recipeView(inv, e.response, unknown, e.doneZones ?? [], toggleZone)
      : consultationView(inv, e.response, unknown);
    const pickers = e.unknownPaints.map((u) => {
      const select = h('select', { 'data-testid': 'assign' },
        h('option', { value: '' }, `${copy.project.assign}: ${u.brand} ${u.code}`),
        ...inv.paints.map((p) => h('option', { value: `${p.brand}|${p.code}` }, `${p.code} ${p.name}`)));
      select.addEventListener('change', async () => {
        const [brand, code] = select.value.split('|');
        if (!brand) return;
        await update((p) => ({ ...p, advice: p.advice.map((x) => (x.id === e.id ? assignUnknownPaint(x, u, { brand, code }) : x)) }));
      });
      return select;
    });
    const imageStatus = h('p', { role: 'status' });
    const paintBtn = e.response.kind === 'recipe'
      ? h('button', {
          'data-testid': 'paint-image',
          onclick: async () => {
            const blobId = project.initialPhotoBlobId;
            const photo = blobId ? await deps.repo.getBlob(blobId) : undefined;
            if (!photo || e.response.kind !== 'recipe') return;
            const result = await deps.bridge.send({ text: buildImagePrompt(e.response, inv, lookOf(project)), image: photo });
            imageStatus.textContent = result === 'fallback' ? copy.project.paintImageFallback : `${copy.ask.pasteHint} ${copy.project.paintImageSent}`;
          },
        }, copy.project.paintImage)
      : null;
    return h('article', { class: 'card', 'data-entry': e.id },
      h('h3', {}, `${copy.project.advice} · ${e.receivedAt.slice(0, 10)}`),
      h('button', { 'data-testid': 'delete-advice', class: 'secondary', onclick: () => void update((p) => ({ ...p, advice: p.advice.filter((x) => x.id !== e.id) })) }, copy.project.deleteAdvice),
      ...body,
      ...(paintBtn ? [paintBtn, imageStatus] : []),
      h('div', { 'data-testid': 'needed' }, h('h4', {}, copy.project.needed),
        h('ul', {}, ...neededPaints(e.response).map((r) => h('li', {}, paintLabel(inv, r, unknown))))),
      ...pickers,
      ...e.unknownBrushes.map((b) => h('p', { class: 'flag', 'data-testid': 'unknown-brush' }, `${copy.project.unknownBrush}: ${b}`)));
  };

  show(root,
    h('h2', {}, project.name),
    photo && target ? compareView(photo, target) : photo ? h('img', { src: photo, alt: '', class: 'photo' }) : null,
    h('p', {},
      h('a', { href: `#/ask/${encodeURIComponent(project.id)}`, class: 'button' }, copy.project.ask),
      h('button', { 'data-testid': 'toggle-done', onclick: () => void update((p) => (p.status === 'done' ? reopen(p) : markDone(p))) },
        project.status === 'done' ? copy.project.reopen : copy.project.markDone)),
    lookFields(lookOf(project), (look) => void update((p) => setLook(p, look))),
    ...[...project.advice].reverse().map(entryView),
    h('section', { class: 'card' }, h('h3', {}, copy.project.notes), notes),
    angles,
    h('section', { class: 'card' }, h('h3', {}, copy.project.progress), h('div', { class: 'thumbs' }, ...progress),
      h('label', { class: 'button' }, copy.project.addProgress, progressInput)),
    h('section', { class: 'card' }, h('h3', {}, copy.project.target), target ? h('img', { src: target, alt: '', class: 'photo' }) : null,
      h('label', { class: 'button' }, copy.project.setTarget, targetInput)),
  );
}
