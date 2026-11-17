import type { Brush, Paint } from '../paints/paint';
import { findBrush, findPaint } from '../paints/inventory';
import { resizeImage } from '../platform/image';
import { applyScan, buildScanPrompt, checkInCatalogue, isComplete, parseScanAnswer } from '../scan/scan';
import { displayName } from '../paints/names';
import { findSet, setAsScan } from '../paints/sets';
import { copy } from './copy';
import { h, show, swatch, type Deps } from './dom';

interface PaintItem { paint: Paint; included: boolean; fromCatalogue?: boolean }
interface BrushItem { brush: Brush; included: boolean }

const brushComplete = (b: Brush) => !!b.code.trim() && !!b.name.trim();
// Same as Android: an owned paint gets the clear warning, an owned brush the plain "updates" line.
const alreadyText = (mine: Paint | Brush) =>
  'hex' in mine ? copy.inventory.alreadyOwned(displayName(mine), mine.code) : copy.scan.updates;

/**
 * Adds paints and brushes from a photo: 1. the photo, 2. send it to the AI with the scan instructions,
 * 3. paste the answer. The list it reads waits for the user to tick, correct or discard each item;
 * only "Add to my paints" writes the inventory. Same flow as the Android app. With setCode (#/scan/72.212)
 * the list of that set opens straight away, its paints already owned unticked.
 */
export async function renderScan(root: HTMLElement, deps: Deps, setCode?: string): Promise<void> {
  const c = copy.scan;
  const photoInput = h('input', { type: 'file', accept: 'image/*', 'data-testid': 'scan-photo' });
  const status = h('p', { role: 'status', 'data-testid': 'scan-status' });
  const promptBox = h('textarea', { 'data-testid': 'scan-prompt', readonly: true, hidden: true });
  const copyPrompt = h('button', { hidden: true, class: 'secondary', onclick: () => void navigator.clipboard?.writeText(promptBox.value).catch(() => promptBox.select()) }, copy.ask.copyPrompt);
  const errors = h('div', { 'data-testid': 'scan-errors', class: 'error' });
  const answer = h('textarea', { 'data-testid': 'scan-answer', placeholder: copy.ask.pasteHere, hidden: true });
  const readBtn = h('button', { 'data-testid': 'scan-read', hidden: true, onclick: () => void read(answer.value) }, c.read);

  const send = async () => {
    const file = photoInput.files?.[0];
    if (!file) return void (status.textContent = c.noPhoto);
    const image = await (deps.resize ?? resizeImage)(file);
    const fallback = (await deps.bridge.send({ text: buildScanPrompt(), image })) === 'fallback';
    status.textContent = fallback ? `${copy.ask.fallback} ${copy.ask.promptBox}` : '';
    promptBox.value = buildScanPrompt();
    promptBox.hidden = !fallback;
    copyPrompt.hidden = !fallback;
  };

  const read = async (raw: string) => {
    const inv = await deps.repo.getInventory();
    const parsed = parseScanAnswer(raw, inv);
    // The catalogue is checked first; the AI's data is kept only for paints it does not list.
    const result = parsed.ok ? checkInCatalogue(parsed, inv) : parsed;
    if (!result.ok) {
      answer.value = raw;
      answer.hidden = false;
      readBtn.hidden = false;
      errors.replaceChildren(h('p', {}, copy.ask.errors), h('ul', {}, ...result.errors.map((e) => h('li', {}, e))));
      return;
    }
    await confirmList(
      // A paint the user already owns comes unticked: ticking it updates the owned one.
      result.paints.map((s) => ({ paint: s.paint, included: isComplete(s.paint) && !s.existing, fromCatalogue: s.fromCatalogue })),
      result.brushes.map((s) => ({ brush: s.brush, included: brushComplete(s.brush) })),
    );
  };

  const paste = async () => {
    const raw = await deps.bridge.readAnswer();
    if (!raw?.trim()) {
      answer.hidden = false;
      readBtn.hidden = false;
      return;
    }
    await read(raw);
  };

  /** Every item read from the photo, ticked when complete; its fields can be corrected in place. */
  const confirmList = async (paints: PaintItem[], brushes: BrushItem[]) => {
    const inv = await deps.repo.getInventory();
    const saveBtn = h('button', { 'data-testid': 'scan-save' });
    const toSave = () => paints.filter((p) => p.included && isComplete(p.paint)).length + brushes.filter((b) => b.included && brushComplete(b.brush)).length;
    const refreshSave = () => {
      saveBtn.textContent = c.save(toSave());
      saveBtn.disabled = toSave() === 0;
    };

    const row = (
      prefix: string, index: number, item: { included: boolean }, complete: () => boolean, owned: () => Paint | Brush | undefined,
      fields: [string, string, (v: string) => void][], lead: Node | null, note: Node | null = null,
    ) => {
      const box = h('input', { type: 'checkbox', 'data-testid': `${prefix}-include-${index}` });
      const label = h('span', { class: 'hint' });
      const refresh = () => {
        box.disabled = !complete();
        box.checked = item.included && complete();
        const mine = owned();
        label.textContent = !complete() ? c.incomplete : mine ? alreadyText(mine) : c.isNew;
        const warn = complete() && !!mine && 'hex' in mine;
        label.className = warn ? 'error' : 'hint';
        if (warn) label.setAttribute('data-testid', `${prefix}-owned-${index}`);
        else label.removeAttribute('data-testid');
        refreshSave();
      };
      box.addEventListener('change', () => {
        item.included = box.checked;
        refresh();
      });
      const inputs = fields.map(([name, value, set]) => {
        const input = h('input', { value, placeholder: name, 'aria-label': name, 'data-testid': `${prefix}-${name}-${index}` });
        input.addEventListener('input', () => {
          const wasComplete = complete();
          set(input.value);
          // An item the user completes is ticked for them; one they already unticked stays unticked.
          if (!wasComplete && complete()) item.included = true;
          refresh();
        });
        return input;
      });
      refresh();
      return h('li', { class: 'scan-row' }, box, lead, ...inputs, label, note);
    };

    const paintRows = paints.map((item, i) => {
      const p = () => item.paint;
      const set = (patch: Partial<Paint>) => { item.paint = { ...item.paint, ...patch }; };
      return row('scan-paint', i, item, () => isComplete(p()), () => (p().code ? findPaint(inv, p()) : undefined), [
        ['brand', p().brand, (v) => set({ brand: v })],
        ['code', p().code, (v) => set({ code: v })],
        ['name', p().name, (v) => set({ name: v })],
        ['nameEn', p().nameEn ?? '', (v) => set({ nameEn: v.trim() || undefined })],
      ], swatch(p().hex), item.fromCatalogue ? h('span', { class: 'hint', 'data-testid': `scan-paint-catalogue-${i}` }, c.fromCatalogue) : null);
    });
    const brushRows = brushes.map((item, i) => {
      const set = (patch: Partial<Brush>) => { item.brush = { ...item.brush, ...patch }; };
      return row('scan-brush', i, item, () => brushComplete(item.brush), () => findBrush(inv, item.brush.code), [
        ['code', item.brush.code, (v) => set({ code: v })],
        ['name', item.brush.name, (v) => set({ name: v })],
      ], null);
    });

    saveBtn.addEventListener('click', async () => {
      const current = await deps.repo.getInventory();
      await deps.repo.saveInventory(applyScan(current,
        paints.filter((p) => p.included).map((p) => p.paint),
        brushes.filter((b) => b.included).map((b) => b.brush)));
      deps.navigate('#/inventory');
    });
    refreshSave();

    show(root,
      h('h2', {}, c.title),
      h('section', { 'data-testid': 'scan-list' },
        h('p', { class: 'hint' }, c.confirmHelp),
        paintRows.length ? h('section', { class: 'family' }, h('h3', {}, c.paints), h('ul', {}, ...paintRows)) : null,
        brushRows.length ? h('section', { class: 'family' }, h('h3', {}, c.brushes), h('ul', {}, ...brushRows)) : null,
        h('p', {},
          h('button', { 'data-testid': 'scan-discard', class: 'secondary', onclick: () => void renderScan(root, deps) }, c.discard),
          saveBtn)),
    );
  };

  const set = setCode ? findSet(setCode) : undefined;
  if (set) {
    const list = setAsScan(set, await deps.repo.getInventory());
    return confirmList(
      list.paints.map((s) => ({ paint: s.paint, included: isComplete(s.paint) && !s.existing, fromCatalogue: s.fromCatalogue })),
      [],
    );
  }

  show(root,
    h('h2', {}, c.title),
    h('section', { class: 'card' },
      h('h3', {}, c.stepPhoto),
      h('p', { class: 'hint' }, c.photoHelp),
      photoInput),
    h('section', { class: 'card' },
      h('h3', {}, c.stepSend),
      h('button', { 'data-testid': 'scan-send', onclick: () => void send() }, copy.ask.send),
      status, promptBox, copyPrompt),
    h('section', { class: 'card' },
      h('h3', {}, c.stepPaste),
      h('button', { 'data-testid': 'scan-paste', onclick: () => void paste() }, copy.ask.paste),
      answer, readBtn, errors),
  );
}
