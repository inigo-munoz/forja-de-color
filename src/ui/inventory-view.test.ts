import type { Paint } from '../paints/paint';
import { renderInventory } from './inventory-view';
import { flush, makeDeps, mount } from './test-helpers';

describe('inventory view', () => {
  it('lists the 48 paints grouped by family, lightest first, with swatch, code and name', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    expect(root.querySelectorAll('[data-testid="paint"]')).toHaveLength(48);
    const black = root.querySelector('[data-family="BSL Black"]')!;
    const rows = [...black.querySelectorAll('[data-testid="paint"]')].map((r) => r.textContent);
    expect(rows[0]).toContain('72.001');
    expect(rows[0]).toContain('Blanco Calavera');
    expect(rows[3]).toContain('72.051');
    expect(black.querySelector('[data-testid="swatch"]')).not.toBeNull();
  });

  it('shows the BSL role next to each paint in a family', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    const blue = root.querySelector('[data-family="BSL Blue"]')!;
    const roles = [...blue.querySelectorAll('[data-testid="role"]')].map((r) => r.textContent);
    expect(roles).toEqual(['extra light', 'light', 'base', 'shadow']);
    expect(root.querySelector('[data-family="BSL Multipurpose"] [data-testid="role"]')).toBeNull();
  });

  it('lists the brushes', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    expect(root.querySelectorAll('[data-testid="brush"]')).toHaveLength(3);
    expect(root.textContent).not.toContain('null');
  });

  it('replaces a paint when adding one with an existing brand + code', async () => {
    const root = mount();
    const deps = await makeDeps();
    await renderInventory(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="add-paint"]')!;
    const set = (name: string, value: string) => ((form.elements.namedItem(name) as HTMLInputElement).value = value);
    set('brand', 'Vallejo'); set('code', '72003'); set('name', 'Carne Pálida (renombrada)'); set('range', 'Game Color'); set('hex', '#c9a47f');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    const inv = await deps.repo.getInventory();
    expect(inv.paints).toHaveLength(48);
    expect(inv.paints.find((p) => p.code === '72.003')?.name).toBe('Carne Pálida (renombrada)');
  });

  it('keeps the BSL family when the code is typed without the dot', async () => {
    const root = mount();
    const deps = await makeDeps();
    const before = (await deps.repo.getInventory()).paints.find((p) => p.code === '72.003')!.family;
    await renderInventory(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="add-paint"]')!;
    const set = (name: string, value: string) => ((form.elements.namedItem(name) as HTMLInputElement).value = value);
    set('brand', 'Vallejo'); set('code', '72003'); set('name', 'Carne Pálida'); set('range', 'Game Color'); set('hex', '#c9a47f');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    expect(before).toBeDefined();
    expect((await deps.repo.getInventory()).paints.find((p) => p.code === '72.003')?.family).toEqual(before);
  });

  it('adds a brush, and a brush with an existing code updates it instead of adding another', async () => {
    const root = mount();
    const deps = await makeDeps();
    await renderInventory(root, deps);
    const submit = async (code: string, name: string) => {
      const form = root.querySelector<HTMLFormElement>('[data-testid="add-brush"]')!;
      (form.elements.namedItem('code') as HTMLInputElement).value = code;
      (form.elements.namedItem('name') as HTMLInputElement).value = name;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await flush(); await flush();
    };
    await submit(' 5/0 ', 'Kolinsky detail');
    await submit('B02001', 'Detail 1, worn');
    const brushes = (await deps.repo.getInventory()).brushes;
    expect(brushes).toHaveLength(4);
    expect(brushes[0]).toEqual({ code: 'B02001', name: 'Detail 1, worn' });
    expect(brushes[3]).toEqual({ code: '5/0', name: 'Kolinsky detail' });
  });

  it('links to adding paints from a photo', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    expect(root.querySelector('[data-testid="scan-paints"]')!.getAttribute('href')).toBe('#/scan');
  });

  it('groups other paints by colour in wheel order, then neutrals and mediums, with BSL families apart', async () => {
    const deps = await makeDeps();
    const seed = await deps.repo.getInventory();
    const p = (code: string, name: string, hex: string, type: Paint['type'] = 'opaque'): Paint => ({ brand: 'Citadel', code, name, range: 'Base', type, hex });
    await deps.repo.saveInventory({ paints: [seed.paints[0], p('g1', 'Moss', '#2e6b2e'), p('r1', 'Scarlet', '#b01c1c'), p('m1', 'Lahmian Medium', '#ffffff', 'medium'), p('k1', 'Abaddon Black', '#141414')], brushes: [] });
    const root = mount();
    await renderInventory(root, deps);
    const groups = [...root.querySelectorAll<HTMLElement>('[data-testid="other-paints"] [data-colour]')];
    expect(groups.map((g) => g.dataset.colour)).toEqual(['red', 'green', 'neutrals', 'mediums']);
    expect(groups[0].querySelector('h4')!.textContent).toBe('Red');
    expect(groups[0].textContent).toContain('Scarlet');
    expect(root.querySelector(`[data-family="${seed.paints[0].family!.name}"]`)!.textContent).toContain(seed.paints[0].name);
  });

  it('shows each paint with its Spanish and English names', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    const rows = [...root.querySelectorAll('[data-testid="paint"]')].map((r) => r.textContent);
    expect(rows.some((t) => t!.includes('Blanco Calavera · Dead White'))).toBe(true);
  });

  it('warns while typing a code you already have, and saves the English name', async () => {
    const root = mount();
    const deps = await makeDeps();
    await renderInventory(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="add-paint"]')!;
    const warning = root.querySelector<HTMLElement>('[data-testid="already-owned"]')!;
    const set = (name: string, value: string) => {
      const input = form.elements.namedItem(name) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    expect(warning.hidden).toBe(true);
    set('code', '72001');
    expect(warning.hidden).toBe(false);
    expect(warning.textContent).toBe('You already have it: Blanco Calavera · Dead White (72.001)');
    set('code', '72.999');
    expect(warning.hidden).toBe(true);

    set('name', 'Nuevo'); set('nameEn', 'Brand New');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    expect((await deps.repo.getInventory()).paints.find((p) => p.code === '72.999')?.nameEn).toBe('Brand New');
  });

  it('shows the seed English name for a stored paint without one, without saving it', async () => {
    const deps = await makeDeps();
    const inv = await deps.repo.getInventory();
    await deps.repo.saveInventory({ ...inv, paints: inv.paints.map(({ nameEn: _n, ...p }) => p) });
    const root = mount();
    await renderInventory(root, deps);
    expect(root.textContent).toContain('Blanco Calavera · Dead White');
    expect(JSON.stringify(await deps.repo.getInventory())).not.toContain('nameEn');
  });

  it('searching the catalogue fills the add form with the chosen paint, still editable', async () => {
    const root = mount();
    const deps = await makeDeps();
    await renderInventory(root, deps);
    const search = root.querySelector<HTMLInputElement>('[data-testid="catalogue-search"]')!;
    search.value = '72010';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const first = root.querySelector<HTMLButtonElement>('[data-testid="catalogue-result-0"]')!;
    expect(first.textContent).toContain('Bloody Red');
    first.click();

    const form = root.querySelector<HTMLFormElement>('[data-testid="add-paint"]')!;
    const value = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    expect(['brand', 'code', 'name', 'nameEn', 'range', 'type', 'hex'].map(value)).toEqual(['Vallejo', '72.010', 'Bloody Red', 'Bloody Red', 'Game Color', 'opaque', '#d41c1c']);
    (form.elements.namedItem('name') as HTMLInputElement).value = 'Rojo Sanguina';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    const saved = (await deps.repo.getInventory()).paints.find((p) => p.code === '72.010')!;
    expect([saved.name, saved.nameEn]).toEqual(['Rojo Sanguina', 'Bloody Red']);
  });
});
