import { buildAdvicePackage } from '../advice/package';
import { parseAdviceResponse } from '../advice/parse';
import type { AdviceRequest, Moment, Question } from '../advice/schema';
import { resizeImage } from '../platform/image';
import { addAdvice, type Project } from '../projects/project';
import { copy } from './copy';
import { h, show, type Deps } from './dom';

const MOMENTS: Moment[] = ['start', 'half-painted', 'during'];
const QUESTIONS = Object.keys(copy.ask.questions) as Question[];

function recipeZones(p: Project): string[] {
  const names = p.advice.flatMap((e) => (e.response.kind === 'recipe' ? e.response.zones.map((z) => z.name) : []));
  return [...new Set(names)];
}

/** The photo to send: a freshly picked one, else the latest progress photo, else the initial photo. */
async function pickPhoto(deps: Deps, input: HTMLInputElement, p: Project): Promise<Blob | null> {
  const file = input.files?.[0];
  if (file) return (deps.resize ?? resizeImage)(file);
  const fallbackId = p.progress.at(-1)?.blobId ?? p.initialPhotoBlobId;
  return fallbackId ? ((await deps.repo.getBlob(fallbackId)) ?? null) : null;
}

export async function renderAsk(root: HTMLElement, deps: Deps, id: string): Promise<void> {
  const project = await deps.repo.getProject(id);
  if (!project) return void show(root, h('p', {}, '404'));

  const momentField = h('fieldset', {},
    h('legend', {}, copy.ask.moment),
    ...MOMENTS.map((m, i) =>
      h('label', {}, h('input', { type: 'radio', name: 'moment', value: m, checked: i === 0 }), ` ${copy.ask.moments[m]}`)));

  const zoneSelect = h('select', { 'data-testid': 'zone' }, ...recipeZones(project).map((z) => h('option', { value: z }, z)));
  const zoneText = h('input', { placeholder: copy.ask.zone, 'data-testid': 'zone-text' });
  const question = h('select', { 'data-testid': 'question' }, ...QUESTIONS.map((q) => h('option', { value: q }, copy.ask.questions[q])));
  const details = h('input', { placeholder: copy.ask.details });
  const duringFields = h('div', { 'data-testid': 'during-fields', hidden: true },
    h('label', {}, copy.ask.zone, zoneSelect, zoneText),
    h('label', {}, copy.ask.question, question, details));
  momentField.addEventListener('change', () => {
    duringFields.hidden = currentMoment() !== 'during';
  });
  const currentMoment = () => (momentField.querySelector<HTMLInputElement>('input[name="moment"]:checked')?.value ?? 'start') as Moment;

  const photoInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  const sendStatus = h('p', { role: 'status' });
  const errors = h('div', { 'data-testid': 'answer-errors', class: 'error' });
  const answer = h('textarea', { 'data-testid': 'answer', placeholder: copy.ask.pasteHere, hidden: true });
  const saveBtn = h('button', { 'data-testid': 'save-answer', hidden: true }, copy.ask.save);

  const send = async () => {
    const photo = await pickPhoto(deps, photoInput, project);
    if (!photo) return void (sendStatus.textContent = copy.ask.photo);
    const moment = currentMoment();
    const req: AdviceRequest = moment === 'during'
      ? { moment, zone: zoneText.value.trim() || zoneSelect.value, question: question.value as Question, freeText: details.value.trim() || undefined }
      : { moment };
    const result = await deps.bridge.send(buildAdvicePackage(req, await deps.repo.getInventory(), photo));
    sendStatus.textContent = result === 'fallback' ? copy.ask.fallback : '';
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
    const latest = (await deps.repo.getProject(id)) ?? project;
    await deps.repo.saveProject(addAdvice(latest, { id: crypto.randomUUID(), receivedAt: deps.now().toISOString(), ...parsed.entry }));
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
      duringFields,
      h('label', {}, copy.ask.photo, photoInput),
      h('button', { 'data-testid': 'send', onclick: () => void send() }, copy.ask.send),
      sendStatus),
    h('section', { class: 'card' },
      h('button', { 'data-testid': 'paste', onclick: () => void paste() }, copy.ask.paste),
      errors, answer, saveBtn),
  );
}
