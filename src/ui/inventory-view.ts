import { addPaint } from '../paints/inventory';
import type { Paint, PaintType } from '../paints/paint';
import { copy } from './copy';
import { h, show, swatch, type Deps } from './dom';

const TYPES: PaintType[] = ['opaque', 'wash', 'metallic', 'medium', 'primer', 'other'];

export async function renderInventory(root: HTMLElement, deps: Deps): Promise<void> {
  const inv = await deps.repo.getInventory();
  const families = new Map<string, Paint[]>();
  const others: Paint[] = [];
  for (const p of inv.paints) {
    if (p.family) families.set(p.family.name, [...(families.get(p.family.name) ?? []), p]);
    else others.push(p);
  }
  const row = (p: Paint) =>
    h('li', { 'data-testid': 'paint', class: 'paint-row' }, swatch(p.hex), h('span', { class: 'code' }, p.code), ` ${p.name}`);

  const groups = [...families.entries()].map(([name, paints]) =>
    h('section', { 'data-family': name, class: 'family' },
      h('h3', {}, name),
      h('ul', {}, ...[...paints].sort((a, b) => a.family!.order - b.family!.order).map(row))),
  );

  const field = (name: string, label: string, attrs: Record<string, string> = {}) =>
    h('label', {}, label, h('input', { name, required: 'true', ...attrs }));
  const form = h('form', { 'data-testid': 'add-paint', class: 'card' },
    h('h3', {}, copy.inventory.addTitle),
    field('brand', copy.inventory.brand, { value: 'Vallejo' }),
    field('code', copy.inventory.code),
    field('name', copy.inventory.name),
    field('range', copy.inventory.range, { value: 'Game Color' }),
    h('label', {}, copy.inventory.type, h('select', { name: 'type' }, ...TYPES.map((t) => h('option', { value: t }, t)))),
    field('hex', copy.inventory.hex, { type: 'color', value: '#888888' }),
    h('button', { type: 'submit' }, copy.inventory.add),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
    const paint: Paint = {
      brand: get('brand'), code: get('code'), name: get('name'), range: get('range'),
      type: (get('type') || 'opaque') as PaintType, hex: get('hex').toLowerCase(),
    };
    const current = await deps.repo.getInventory();
    const prior = current.paints.find((p) => p.brand.toLowerCase() === paint.brand.toLowerCase() && p.code === paint.code);
    await deps.repo.saveInventory(addPaint(current, prior?.family ? { ...paint, family: prior.family } : paint));
    await renderInventory(root, deps);
  });

  show(root, 
    h('h2', {}, copy.inventory.title),
    ...groups,
    others.length ? h('section', { class: 'family' }, h('h3', {}, copy.inventory.otherPaints), h('ul', {}, ...others.map(row))) : null,
    h('section', { class: 'family' }, h('h3', {}, copy.inventory.brushes),
      h('ul', {}, ...inv.brushes.map((b) => h('li', { 'data-testid': 'brush' }, h('span', { class: 'code' }, b.code), ` ${b.name}`)))),
    form,
  );
}
