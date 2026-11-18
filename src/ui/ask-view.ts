import { buildAdvicePackage } from '../advice/package';
import { parseAdviceResponse } from '../advice/parse';
import type { AdviceRequest, Moment, Question } from '../advice/schema';
import { resizeImage } from '../platform/image';
import { MAX_ANGLES, addAdvice, photosOf, setLook, type Project } from '../projects/project';
import { lookOf } from '../projects/style';
import { lookFields } from './look-fields';
import { copy } from './copy';
import { blobUrl, h, show, type Deps } from './dom';

const MOMENTS: Moment[] = ['start', 'primed', 'half-painted', 'during'];
const QUESTIONS = Object.keys(copy.ask.questions) as Question[];

function recipeZones(p: Project): string[] {
  const names = p.advice.flatMap((e) => (e.response.kind === 'recipe' ? e.response.zones.map((z) => z.name) : []));
  return [...new Set(names)];
}

/** Most photos sent in one go. */
const MAX_SENT = MAX_ANGLES + 1;

/** The project's photos the user can send: newest progress first, then the main photo and its angles. */
function askablePhotos(p: Project): string[] {
  return [...new Set([...[...p.progress].reverse().map((x) => x.blobId), ...photosOf(p)])];
}

/**
 * What is chosen when the moment changes: start, the unpainted miniature from every angle; primed and
 * during, the latest progress photo (else the main one); half-painted, the latest progress photo only.
 * Same as the Android app.
 */
function defaultPhotos(p: Project, moment: Moment): string[] {
  const latest = p.progress.length ? [p.progress[p.progress.length - 1].blobId] : [];
  const main = p.initialPhotoBlobId ? [p.initialPhotoBlobId] : [];
  const photos = photosOf(p);
  const chosen = moment === 'start' ? (photos.length ? photos : latest)
    : moment === 'primed' ? (latest.length ? latest : photos)
      : moment === 'half-painted' ? latest
        : latest.length ? latest : main;
  return chosen.slice(0, MAX_SENT);
}

export async function renderAsk(root: HTMLElement, deps: Deps, id: string): Promise<void> {
  const project = await deps.repo.getProject(id);
  if (!project) return void show(root, h('p', {}, '404'));

  const momentField = h('fieldset', {},
    h('legend', {}, copy.ask.moment),
    ...MOMENTS.map((m, i) =>
      h('label', {}, h('input', { type: 'radio', name: 'moment', value: m, checked: i === 0 }), ` ${copy.ask.moments[m]}`)));

  const look = lookFields(lookOf(project), async (l) => {
    const latest = (await deps.repo.getProject(id)) ?? project;
    await deps.repo.saveProject(setLook(latest, l));
  });

  const zoneSelect = h('select', { 'data-testid': 'zone' }, ...recipeZones(project).map((z) => h('option', { value: z }, z)));
  const zoneText = h('input', { placeholder: copy.ask.zone, 'data-testid': 'zone-text' });
  const question = h('select', { 'data-testid': 'question' }, ...QUESTIONS.map((q) => h('option', { value: q }, copy.ask.questions[q])));
  const details = h('input', { placeholder: copy.ask.details });
  const duringFields = h('div', { 'data-testid': 'during-fields', hidden: true },
    h('label', {}, copy.ask.zone, zoneSelect, zoneText),
    h('label', {}, copy.ask.question, question, details));
  momentField.addEventListener('change', () => {
    duringFields.hidden = currentMoment() !== 'during';
    chosen = defaultPhotos(project, currentMoment());
    showChosen();
  });
  const currentMoment = () => (momentField.querySelector<HTMLInputElement>('input[name="moment"]:checked')?.value ?? 'start') as Moment;

  const photoInput = h('input', { type: 'file', accept: 'image/*' });
  // The project photos to send: the moment's default until the user changes it in the panel.
  const order = askablePhotos(project);
  const urls = new Map(await Promise.all(order.map(async (pid) => [pid, await blobUrl(deps, pid)] as const)));
  let chosen = defaultPhotos(project, 'start');
  const chosenStrip = h('div', { class: 'thumbs' });
  const panel = h('div', { 'data-testid': 'ask-project-photos', class: 'card', hidden: true });
  const showChosen = () => {
    chosenStrip.replaceChildren(...(chosen.length ? [h('p', { class: 'hint' }, copy.ask.chosenPhotos)] : []),
      ...chosen.map((pid) => h('img', { src: urls.get(pid) ?? '', alt: '', 'data-testid': 'ask-chosen-photo', class: 'thumb' })));
  };
  const showPanel = () => {
    panel.replaceChildren(
      h('p', { class: 'hint' }, copy.ask.choosePhotos(MAX_SENT)),
      h('div', { class: 'thumbs' }, ...order.map((pid) => h('button', {
        type: 'button', class: chosen.includes(pid) ? 'photo-tile chosen' : 'photo-tile', 'data-testid': 'ask-project-photo',
        'aria-pressed': String(chosen.includes(pid)),
        onclick: () => {
          if (chosen.includes(pid)) chosen = chosen.filter((x) => x !== pid);
          else if (chosen.length + (photoInput.files?.length ? 1 : 0) < MAX_SENT) chosen = [...chosen, pid];
          showPanel();
        },
      }, h('img', { src: urls.get(pid) ?? '', alt: '' })))),
      h('button', { type: 'button', 'data-testid': 'ask-project-photos-done', onclick: () => { panel.hidden = true; showChosen(); } }, copy.ask.done),
    );
  };
  const chooseProjectPhoto = order.length
    ? h('button', { type: 'button', class: 'secondary', 'data-testid': 'ask-choose-project-photo', onclick: () => { showPanel(); panel.hidden = false; } }, copy.ask.chooseProjectPhoto)
    : null;
  showChosen();
  const sendStatus = h('p', { role: 'status' });
  const promptBox = h('textarea', { 'data-testid': 'prompt', readonly: true, hidden: true });
  const copyPrompt = h('button', { hidden: true, class: 'secondary', onclick: () => void navigator.clipboard?.writeText(promptBox.value).catch(() => promptBox.select()) }, copy.ask.copyPrompt);
  const errors = h('div', { 'data-testid': 'answer-errors', class: 'error' });
  const answer = h('textarea', { 'data-testid': 'answer', placeholder: copy.ask.pasteHere, hidden: true });
  const saveBtn = h('button', { 'data-testid': 'save-answer', hidden: true }, copy.ask.save);

  const send = async () => {
    const moment = currentMoment();
    const latest = (await deps.repo.getProject(id)) ?? project;
    // A photo taken or chosen here goes first, then the project photos the user chose (up to MAX_SENT).
    const file = photoInput.files?.[0];
    const pickedBlob = file ? await (deps.resize ?? resizeImage)(file) : null;
    const chosenBlobs = (await Promise.all(order.filter((pid) => chosen.includes(pid)).map((pid) => deps.repo.getBlob(pid))))
      .filter((b): b is Blob => !!b);
    const images = [...(pickedBlob ? [pickedBlob] : []), ...chosenBlobs].slice(0, MAX_SENT);
    // Half-painted needs the miniature as it is now: never the unpainted photo by default.
    if (!images.length) return void (sendStatus.textContent = moment === 'half-painted' ? copy.ask.currentPhoto : copy.ask.photo);
    const photo = images[0];
    const recipe = [...latest.advice].reverse().find((e) => e.response.kind === 'recipe');
    const req: AdviceRequest = moment === 'during'
      ? { moment, zone: zoneText.value.trim() || zoneSelect.value, question: question.value as Question, freeText: details.value.trim() || undefined }
      : moment === 'half-painted' && recipe && recipe.response.kind === 'recipe'
        ? { moment, previous: { response: recipe.response, doneZones: recipe.doneZones } }
        : { moment };
    // The project's look as saved now: it may have been changed on this screen.
    const look = lookOf(latest);
    const pkg = { ...buildAdvicePackage({ ...req, ...look }, await deps.repo.getInventory(), photo), ...(images.length > 1 && { extraImages: images.slice(1) }) };
    const result = await deps.bridge.send(pkg);
    const fallback = result === 'fallback';
    sendStatus.textContent = fallback ? `${copy.ask.fallback} ${copy.ask.promptBox}` : copy.ask.pasteHint;
    promptBox.value = pkg.text;
    promptBox.hidden = !fallback;
    copyPrompt.hidden = !fallback;
  };

  const accept = async (raw: string) => {
    const parsed = parseAdviceResponse(raw, await deps.repo.getInventory());
    if (!parsed.ok) {
      answer.value = raw;
      answer.hidden = false;
      saveBtn.hidden = false;
      errors.replaceChildren(h('p', {}, copy.ask.errors), h('ul', {}, ...parsed.errors.map((e) => h('li', {}, e))));
      return;
    }
    try {
      const latest = (await deps.repo.getProject(id)) ?? project;
      await deps.repo.saveProject(addAdvice(latest, { id: crypto.randomUUID(), receivedAt: deps.now().toISOString(), ...parsed.entry }));
    } catch (e) {
      answer.value = raw;
      answer.hidden = false;
      saveBtn.hidden = false;
      errors.replaceChildren(h('p', {}, copy.ask.errors), h('p', {}, String((e as Error).message ?? e)));
      return;
    }
    deps.navigate(`#/project/${encodeURIComponent(id)}`);
  };

  const paste = async () => {
    const raw = await deps.bridge.readAnswer();
    if (raw === null || raw.trim() === '') {
      answer.hidden = false;
      saveBtn.hidden = false;
      answer.focus();
      return;
    }
    await accept(raw);
  };
  saveBtn.addEventListener('click', () => void accept(answer.value));

  show(root,
    h('h2', {}, `${copy.ask.title} · ${project.name}`),
    h('section', { class: 'card' },
      momentField,
      look,
      duringFields,
      h('p', {}, chooseProjectPhoto, h('label', { class: 'button secondary' }, copy.ask.addPhoto, photoInput)),
      chosenStrip,
      panel,
      h('button', { 'data-testid': 'send', onclick: () => void send() }, copy.ask.send),
      sendStatus, promptBox, copyPrompt),
    h('section', { class: 'card' },
      h('button', { 'data-testid': 'paste', onclick: () => void paste() }, copy.ask.paste),
      errors, answer, saveBtn),
  );
}
