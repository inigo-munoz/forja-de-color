import { addBrush, savePaintKeepingFamily } from '../paints/inventory';
import type { Paint, PaintType } from '../paints/paint';
import { bslRole } from '../paints/roles';
import { groupByColour, type ColourGroup } from '../paints/wheel';
import { copy } from './copy';
import { h, show, swatch, type Deps } from './dom';

const groupLabel = (g: ColourGroup) =>
  g === 'neutrals' ? copy.wheel.neutrals : g === 'mediums' ? copy.inventory.mediums : copy.wheel.colours[g];

const TYPES: PaintType[] = ['opaque', 'wash', 'metallic', 'medium', 'primer', 'other'];

export async function renderInventory(root: HTMLElement, deps: Deps): Promise<void> {
  const inv = await deps.repo.getInventory();
  const families = new Map<string, Paint[]>();
  const others: Paint[] = [];
  for (const p of inv.paints) {
    if (p.family) families.set(p.family.name, [...(families.get(p.family.name) ?? []), p]);
    else others.push(p);
  }
  const row = (p: Paint) => {
    const role = bslRole(p);
    return h('li', { 'data-testid': 'paint', class: 'paint-row' }, swatch(p.hex), h('span', { class: 'code' }, p.code), ` ${p.name}`,
      role ? ' · ' : null, role ? h('span', { 'data-testid': 'role', class: 'code' }, copy.inventory.roles[role]) : null);
  };

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
    // Same lookup as addPaint (normalized code), so "72003" finds 72.003 and keeps its BSL family.
    await deps.repo.saveInventory(savePaintKeepingFamily(await deps.repo.getInventory(), paint));
    await renderInventory(root, deps);
  });

  const brushForm = h('form', { 'data-testid': 'add-brush', class: 'card' },
    h('h3', {}, copy.inventory.brushTitle),
    field('code', copy.inventory.brushCode),
    field('name', copy.inventory.brushName),
    h('button', { type: 'submit' }, copy.inventory.addBrush),
  );
  brushForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const get = (n: string) => (brushForm.elements.namedItem(n) as HTMLInputElement).value.trim();
    if (!get('code') || !get('name')) return;
    // An existing code updates that brush instead of adding another.
    await deps.repo.saveInventory(addBrush(await deps.repo.getInventory(), { code: get('code'), name: get('name') }));
    await renderInventory(root, deps);
  });

  show(root, 
    h('h2', {}, copy.inventory.title),
    h('p', {}, h('a', { href: '#/scan', class: 'button', 'data-testid': 'scan-paints' }, copy.inventory.scan)),
    ...groups,
    // Paints outside a BSL set, grouped by colour with the colour wheel's rule.
    others.length ? h('section', { class: 'family', 'data-testid': 'other-paints' }, h('h3', {}, copy.inventory.otherPaints),
      ...groupByColour(others).map(([group, paints]) => h('div', { 'data-colour': group },
        h('h4', {}, groupLabel(group)), h('ul', {}, ...paints.map(row))))) : null,
    h('section', { class: 'family' }, h('h3', {}, copy.inventory.brushes),
      h('ul', {}, ...inv.brushes.map((b) => h('li', { 'data-testid': 'brush' }, h('span', { class: 'code' }, b.code), ` ${b.name}`)))),
    form,
    brushForm,
  );
}
